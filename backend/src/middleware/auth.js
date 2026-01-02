import { supabaseAdmin, createSupabaseClient } from '../lib/supabase.js';
import { AuthenticationError } from './errorHandler.js';

/**
 * Verify Supabase JWT and attach user to request
 */
export async function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AuthenticationError('Missing or invalid authorization header');
        }

        const token = authHeader.substring(7);

        // Verify JWT with Supabase
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !user) {
            throw new AuthenticationError('Invalid or expired token');
        }

        // Attach user and token to request
        req.user = user;
        req.accessToken = token;
        req.supabase = createSupabaseClient(token);

        next();
    } catch (error) {
        next(error);
    }
}

/**
 * Optional auth - doesn't fail if no token, but attaches user if valid
 */
export async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const { data: { user } } = await supabaseAdmin.auth.getUser(token);

            if (user) {
                req.user = user;
                req.accessToken = token;
                req.supabase = createSupabaseClient(token);
            }
        }

        next();
    } catch (error) {
        // Ignore auth errors for optional auth
        next();
    }
}
