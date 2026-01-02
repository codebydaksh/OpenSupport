import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';

const router = Router();

/**
 * POST /api/v1/widget/init
 * Initialize widget for a visitor
 * Uses org_id from request body (widget knows its org)
 */
router.post('/init', async (req, res, next) => {
    try {
        const { orgId, sessionId, visitorData } = req.body;

        if (!orgId || !sessionId) {
            throw new ValidationError('orgId and sessionId required');
        }

        // Verify org exists and get config
        const { data: org, error } = await supabaseAdmin
            .from('organizations')
            .select('id, name, plan')
            .eq('id', orgId)
            .single();

        if (error || !org) {
            throw new NotFoundError('Organization');
        }

        // Upsert visitor
        const { data: visitor } = await supabaseAdmin
            .from('visitors')
            .upsert({
                org_id: orgId,
                session_id: sessionId,
                name: visitorData?.name,
                email: visitorData?.email,
                metadata: visitorData?.metadata || {},
                first_seen_at: new Date().toISOString(),
                last_seen_at: new Date().toISOString()
            }, {
                onConflict: 'org_id,session_id',
                ignoreDuplicates: false
            })
            .select()
            .single();

        // Check for existing open conversation
        const { data: existingConversation } = await supabaseAdmin
            .from('conversations')
            .select('id')
            .eq('visitor_id', visitor.id)
            .eq('status', 'open')
            .single();

        // Get recent messages if conversation exists
        let messages = [];
        if (existingConversation) {
            const { data: recentMessages } = await supabaseAdmin
                .from('messages')
                .select('id, content, sender_type, created_at')
                .eq('conversation_id', existingConversation.id)
                .order('created_at', { ascending: false })
                .limit(50);

            messages = (recentMessages || []).reverse();
        }

        res.json({
            organization: {
                id: org.id,
                name: org.name
            },
            visitor: {
                id: visitor.id,
                sessionId: visitor.session_id
            },
            conversation: existingConversation ? {
                id: existingConversation.id,
                messages
            } : null,
            config: {
                // Widget configuration
                primaryColor: '#3b82f6',
                position: 'bottom-right',
                greeting: `Hi there! How can we help you today?`
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/v1/widget/identify
 * Update visitor information
 */
router.post('/identify', async (req, res, next) => {
    try {
        const { orgId, sessionId, email, name, metadata } = req.body;

        if (!orgId || !sessionId) {
            throw new ValidationError('orgId and sessionId required');
        }

        const updates = { last_seen_at: new Date().toISOString() };
        if (email) updates.email = email;
        if (name) updates.name = name;
        if (metadata) updates.metadata = metadata;

        const { data: visitor, error } = await supabaseAdmin
            .from('visitors')
            .update(updates)
            .eq('org_id', orgId)
            .eq('session_id', sessionId)
            .select()
            .single();

        if (error || !visitor) {
            throw new NotFoundError('Visitor');
        }

        res.json({ visitor });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/v1/widget/messages/:conversationId
 * Get messages for widget (no auth, uses session validation)
 */
router.get('/messages/:conversationId', async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const { sessionId, orgId } = req.query;

        if (!sessionId || !orgId) {
            throw new ValidationError('sessionId and orgId required');
        }

        // Verify session owns conversation
        const { data: conversation } = await supabaseAdmin
            .from('conversations')
            .select('id, visitors!inner(session_id)')
            .eq('id', conversationId)
            .eq('org_id', orgId)
            .single();

        if (!conversation || conversation.visitors.session_id !== sessionId) {
            throw new NotFoundError('Conversation');
        }

        const { data: messages } = await supabaseAdmin
            .from('messages')
            .select('id, content, sender_type, created_at')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true })
            .limit(100);

        res.json({ messages: messages || [] });
    } catch (error) {
        next(error);
    }
});

export default router;
