import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { checkAgentLimit } from '../services/limitService.js';
import { requireRole } from '../middleware/tenantContext.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';

const router = Router();

const inviteUserSchema = z.object({
    email: z.string().email(),
    name: z.string().min(1),
    role: z.enum(['admin', 'agent']).default('agent')
});

/**
 * GET /api/v1/teams/members
 * List team members
 */
router.get('/members', async (req, res, next) => {
    try {
        const { data: members, error } = await supabaseAdmin
            .from('users')
            .select('id, email, name, role, created_at')
            .eq('org_id', req.orgId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        res.json({ members });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/v1/teams/invite
 * Invite new team member
 */
router.post('/invite', requireRole('owner', 'admin'), async (req, res, next) => {
    try {
        const data = inviteUserSchema.parse(req.body);

        // Check agent limit
        await checkAgentLimit(req.orgId, req.organization.plan);

        // Create auth user with random password (they'll reset it)
        const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password: tempPassword,
            email_confirm: true
        });

        if (authError) {
            if (authError.message.includes('already registered')) {
                throw new ValidationError('User with this email already exists');
            }
            throw authError;
        }

        // Create user record
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .insert({
                id: authData.user.id,
                org_id: req.orgId,
                email: data.email,
                name: data.name,
                role: data.role
            })
            .select()
            .single();

        if (userError) {
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            throw userError;
        }

        // Send password reset email
        await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email: data.email
        });

        res.status(201).json({
            member: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/v1/teams/members/:id
 * Update team member
 */
router.patch('/members/:id', requireRole('owner', 'admin'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, role } = req.body;

        // Can't change owner role
        const { data: targetUser } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', id)
            .eq('org_id', req.orgId)
            .single();

        if (!targetUser) {
            throw new NotFoundError('Team member');
        }

        if (targetUser.role === 'owner' && role !== 'owner') {
            throw new ValidationError('Cannot change owner role');
        }

        const updates = {};
        if (name) updates.name = name;
        if (role && ['admin', 'agent'].includes(role)) updates.role = role;

        const { data: member, error } = await supabaseAdmin
            .from('users')
            .update(updates)
            .eq('id', id)
            .eq('org_id', req.orgId)
            .select()
            .single();

        if (error) throw error;

        res.json({ member });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/v1/teams/members/:id
 * Remove team member
 */
router.delete('/members/:id', requireRole('owner', 'admin'), async (req, res, next) => {
    try {
        const { id } = req.params;

        // Can't delete self or owner
        if (id === req.user.id) {
            throw new ValidationError('Cannot remove yourself');
        }

        const { data: targetUser } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', id)
            .eq('org_id', req.orgId)
            .single();

        if (!targetUser) {
            throw new NotFoundError('Team member');
        }

        if (targetUser.role === 'owner') {
            throw new ValidationError('Cannot remove owner');
        }

        // Delete from users table (cascade will handle auth)
        await supabaseAdmin
            .from('users')
            .delete()
            .eq('id', id)
            .eq('org_id', req.orgId);

        // Delete auth user
        await supabaseAdmin.auth.admin.deleteUser(id);

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/v1/teams/organization
 * Get organization details
 */
router.get('/organization', async (req, res, next) => {
    try {
        res.json({
            organization: {
                id: req.organization.id,
                name: req.organization.name,
                slug: req.organization.slug,
                plan: req.organization.plan
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/v1/teams/organization
 * Update organization
 */
router.patch('/organization', requireRole('owner', 'admin'), async (req, res, next) => {
    try {
        const { name } = req.body;

        if (!name) {
            throw new ValidationError('Name required');
        }

        const { data: org, error } = await supabaseAdmin
            .from('organizations')
            .update({ name })
            .eq('id', req.orgId)
            .select()
            .single();

        if (error) throw error;

        res.json({ organization: org });
    } catch (error) {
        next(error);
    }
});

export default router;
