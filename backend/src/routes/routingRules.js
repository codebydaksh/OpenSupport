import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireRole } from '../middleware/tenantContext.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';

const router = Router();

const ruleSchema = z.object({
    urlPattern: z.string().min(1),
    targetAgentId: z.string().uuid().nullable().optional(),
    priority: z.number().int().min(0).max(100).default(0),
    enabled: z.boolean().default(true)
});

/**
 * GET /api/v1/routing-rules
 * List routing rules for organization
 */
router.get('/', async (req, res, next) => {
    try {
        const { data: rules, error } = await supabaseAdmin
            .from('routing_rules')
            .select('*, target_agent:users(id, name, email)')
            .eq('org_id', req.orgId)
            .order('priority', { ascending: false });

        if (error) throw error;

        res.json({ rules });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/v1/routing-rules
 * Create new routing rule
 */
router.post('/', requireRole('owner', 'admin'), async (req, res, next) => {
    try {
        const data = ruleSchema.parse(req.body);

        const { data: rule, error } = await supabaseAdmin
            .from('routing_rules')
            .insert({
                org_id: req.orgId,
                url_pattern: data.urlPattern,
                target_agent_id: data.targetAgentId || null,
                priority: data.priority,
                enabled: data.enabled
            })
            .select('*, target_agent:users(id, name, email)')
            .single();

        if (error) throw error;

        res.status(201).json({ rule });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/v1/routing-rules/:id
 * Update routing rule
 */
router.patch('/:id', requireRole('owner', 'admin'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const updates = {};

        if (req.body.urlPattern !== undefined) updates.url_pattern = req.body.urlPattern;
        if (req.body.targetAgentId !== undefined) updates.target_agent_id = req.body.targetAgentId || null;
        if (req.body.priority !== undefined) updates.priority = req.body.priority;
        if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;

        if (Object.keys(updates).length === 0) {
            throw new ValidationError('No valid updates provided');
        }

        const { data: rule, error } = await supabaseAdmin
            .from('routing_rules')
            .update(updates)
            .eq('id', id)
            .eq('org_id', req.orgId)
            .select('*, target_agent:users(id, name, email)')
            .single();

        if (error || !rule) {
            throw new NotFoundError('Routing rule');
        }

        res.json({ rule });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/v1/routing-rules/:id
 * Delete routing rule
 */
router.delete('/:id', requireRole('owner', 'admin'), async (req, res, next) => {
    try {
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from('routing_rules')
            .delete()
            .eq('id', id)
            .eq('org_id', req.orgId);

        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

export default router;
