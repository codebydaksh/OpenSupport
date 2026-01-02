import { Router } from 'express';
import { z } from 'zod';
import { sendMessage, getConversationMessages } from '../services/messageService.js';
import { getMessageHistoryCutoff } from '../services/limitService.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

const sendMessageSchema = z.object({
    conversationId: z.string().uuid(),
    content: z.string().min(1).max(10000),
    idempotencyKey: z.string().optional()
});

/**
 * POST /api/v1/messages
 * Send message as agent
 */
router.post('/', async (req, res, next) => {
    try {
        const data = sendMessageSchema.parse(req.body);

        // Verify conversation belongs to org
        const { data: conversation, error: convError } = await supabaseAdmin
            .from('conversations')
            .select('id, org_id, visitor_id, visitors(email, session_id)')
            .eq('id', data.conversationId)
            .eq('org_id', req.orgId)
            .single();

        if (convError || !conversation) {
            throw new NotFoundError('Conversation');
        }

        const { message, isNew } = await sendMessage({
            orgId: req.orgId,
            conversationId: data.conversationId,
            senderType: 'agent',
            senderId: req.user.id,
            content: data.content,
            idempotencyKey: data.idempotencyKey
        });

        // Get agent name
        const { data: agent } = await supabaseAdmin
            .from('users')
            .select('name')
            .eq('id', req.user.id)
            .single();

        // Broadcast via WebSocket if new
        if (isNew) {
            const io = req.app.get('io');

            io.to(`conversation:${data.conversationId}`).emit('message:new', {
                message: {
                    id: message.id,
                    conversationId: data.conversationId,
                    senderType: 'agent',
                    senderId: req.user.id,
                    senderName: agent?.name,
                    content: message.content,
                    createdAt: message.created_at
                }
            });
        }

        res.status(201).json({
            message: {
                id: message.id,
                conversationId: message.conversation_id,
                senderType: message.sender_type,
                senderId: message.sender_id,
                content: message.content,
                createdAt: message.created_at
            },
            isNew
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/v1/messages/:conversationId
 * Get messages for a conversation
 */
router.get('/:conversationId', async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const { limit = 50, before } = req.query;

        // Verify conversation belongs to org
        const { data: conversation } = await supabaseAdmin
            .from('conversations')
            .select('id')
            .eq('id', conversationId)
            .eq('org_id', req.orgId)
            .single();

        if (!conversation) {
            throw new NotFoundError('Conversation');
        }

        const historyLimit = getMessageHistoryCutoff(req.organization.plan);

        const messages = await getConversationMessages(
            req.orgId,
            conversationId,
            { limit: parseInt(limit), before, historyLimit }
        );

        res.json({ messages });
    } catch (error) {
        next(error);
    }
});

export default router;
