import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { getMessageHistoryCutoff } from '../services/limitService.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';

const router = Router();

/**
 * GET /api/v1/conversations
 * List conversations for organization
 */
router.get('/', async (req, res, next) => {
    try {
        const { status = 'open', limit = 50, offset = 0 } = req.query;

        let query = supabaseAdmin
            .from('conversations')
            .select(`
        *,
        visitors (id, name, email, session_id),
        assigned_agent:users (id, name),
        messages (content, sender_type, created_at)
      `)
            .eq('org_id', req.orgId)
            .order('updated_at', { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        if (status !== 'all') {
            query = query.eq('status', status);
        }

        const { data: conversations, error, count } = await query;

        if (error) throw error;

        // Get last message for each conversation
        const formatted = conversations.map(conv => {
            const lastMessage = conv.messages
                ?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

            return {
                id: conv.id,
                status: conv.status,
                visitor: conv.visitors,
                assignedAgent: conv.assigned_agent,
                pageUrl: conv.page_url,
                createdAt: conv.created_at,
                updatedAt: conv.updated_at,
                lastMessage: lastMessage ? {
                    content: lastMessage.content,
                    senderType: lastMessage.sender_type,
                    createdAt: lastMessage.created_at
                } : null
            };
        });

        res.json({ conversations: formatted });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/v1/conversations/:id
 * Get single conversation with messages
 */
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const historyCutoff = getMessageHistoryCutoff(req.organization.plan);

        const { data: conversation, error } = await supabaseAdmin
            .from('conversations')
            .select(`
        *,
        visitors (*),
        assigned_agent:users (id, name, email)
      `)
            .eq('id', id)
            .eq('org_id', req.orgId)
            .single();

        if (error || !conversation) {
            throw new NotFoundError('Conversation');
        }

        // Get messages with history limit
        let messagesQuery = supabaseAdmin
            .from('messages')
            .select('*')
            .eq('conversation_id', id)
            .eq('org_id', req.orgId)
            .order('created_at', { ascending: true });

        if (historyCutoff) {
            messagesQuery = messagesQuery.gte('created_at', historyCutoff.toISOString());
        }

        const { data: messages } = await messagesQuery;

        res.json({
            conversation: {
                id: conversation.id,
                status: conversation.status,
                pageUrl: conversation.page_url,
                createdAt: conversation.created_at,
                updatedAt: conversation.updated_at
            },
            visitor: conversation.visitors,
            assignedAgent: conversation.assigned_agent,
            messages: messages || []
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/v1/conversations/:id
 * Update conversation (status, assignment)
 */
router.patch('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, assignedAgentId } = req.body;

        const updates = {};
        if (status) {
            if (!['open', 'closed', 'snoozed'].includes(status)) {
                throw new ValidationError('Invalid status');
            }
            updates.status = status;
        }
        if (assignedAgentId !== undefined) {
            updates.assigned_agent_id = assignedAgentId;
        }

        if (Object.keys(updates).length === 0) {
            throw new ValidationError('No valid updates provided');
        }

        const { data: conversation, error } = await supabaseAdmin
            .from('conversations')
            .update(updates)
            .eq('id', id)
            .eq('org_id', req.orgId)
            .select()
            .single();

        if (error || !conversation) {
            throw new NotFoundError('Conversation');
        }

        // Notify via WebSocket
        const io = req.app.get('io');
        io.to(`org:${req.orgId}`).emit('conversation:updated', {
            conversationId: id,
            updates
        });

        res.json({ conversation });
    } catch (error) {
        next(error);
    }
});

export default router;
