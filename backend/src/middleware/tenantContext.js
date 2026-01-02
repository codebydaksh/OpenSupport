import { supabaseAdmin } from '../lib/supabase.js';
import { AuthorizationError } from './errorHandler.js';

/**
 * Extract and validate tenant context from authenticated user
 * Attaches org_id to request for all subsequent operations
 */
export async function tenantContext(req, res, next) {
    try {
        if (!req.user) {
            throw new AuthorizationError('User context required');
        }

        // Get user's organization membership
        const { data: userRecord, error } = await supabaseAdmin
            .from('users')
            .select('org_id, role, organizations(id, name, slug, plan)')
            .eq('id', req.user.id)
            .single();

        if (error || !userRecord) {
            throw new AuthorizationError('User not associated with any organization');
        }

        // Attach tenant context to request
        req.orgId = userRecord.org_id;
        req.userRole = userRecord.role;
        req.organization = userRecord.organizations;

        next();
    } catch (error) {
        next(error);
    }
}

/**
 * Require specific roles for an endpoint
 */
export function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.userRole || !allowedRoles.includes(req.userRole)) {
            return next(new AuthorizationError(`Requires role: ${allowedRoles.join(' or ')}`));
        }
        next();
    };
}
