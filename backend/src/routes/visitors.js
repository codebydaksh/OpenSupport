import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { NotFoundError } from '../middleware/errorHandler.js';

const router = Router();

/**
 * GET /api/v1/visitors
 * List visitors for organization
 */
router.get('/', async (req, res, next) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const { data: visitors, error } = await supabaseAdmin
            .from('visitors')
            .select('*')
            .eq('org_id', req.orgId)
            .order('last_seen_at', { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        if (error) throw error;

        res.json({ visitors });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/v1/visitors/:id
 * Get single visitor
 */
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        const { data: visitor, error } = await supabaseAdmin
            .from('visitors')
            .select('*')
            .eq('id', id)
            .eq('org_id', req.orgId)
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
 * PATCH /api/v1/visitors/:id
 * Update visitor info
 */
router.patch('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, email, metadata } = req.body;

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (email !== undefined) updates.email = email;
        if (metadata !== undefined) updates.metadata = metadata;

        const { data: visitor, error } = await supabaseAdmin
            .from('visitors')
            .update(updates)
            .eq('id', id)
            .eq('org_id', req.orgId)
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

export default router;
