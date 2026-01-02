import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { ValidationError } from '../middleware/errorHandler.js';

const router = Router();

const signupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1),
    organizationName: z.string().min(1)
});

/**
 * POST /api/v1/auth/signup
 * Create new user and organization with email verification
 */
router.post('/signup', async (req, res, next) => {
    try {
        const data = signupSchema.parse(req.body);

        // Create auth user with email confirmation required
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: false // Require email verification
        });

        if (authError) {
            throw new ValidationError(authError.message);
        }

        // Generate unique slug from org name
        const slug = data.organizationName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') +
            '-' + Date.now().toString(36);

        // Create organization
        const { data: org, error: orgError } = await supabaseAdmin
            .from('organizations')
            .insert({
                name: data.organizationName,
                slug,
                plan: 'free'
            })
            .select()
            .single();

        if (orgError) {
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            throw orgError;
        }

        // Create user record
        const { error: userError } = await supabaseAdmin
            .from('users')
            .insert({
                id: authData.user.id,
                org_id: org.id,
                email: data.email,
                name: data.name,
                role: 'owner'
            });

        if (userError) {
            await supabaseAdmin.from('organizations').delete().eq('id', org.id);
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            throw userError;
        }

        // Send verification email via Supabase
        const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
            redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify`
        });

        if (inviteError) {
            console.error('Failed to send verification email:', inviteError);
        }

        res.status(201).json({
            message: 'Account created. Please check your email to verify your account.',
            user: {
                id: authData.user.id,
                email: data.email,
                name: data.name,
                emailVerified: false
            },
            organization: {
                id: org.id,
                name: org.name,
                slug: org.slug
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/v1/auth/login
 * Sign in existing user (requires verified email)
 */
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new ValidationError('Email and password required');
        }

        const { data: session, error } = await supabaseAdmin.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            if (error.message.includes('Email not confirmed')) {
                throw new ValidationError('Please verify your email before logging in');
            }
            throw new ValidationError('Invalid email or password');
        }

        // Get user details
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('*, organizations(*)')
            .eq('id', session.user.id)
            .single();

        if (!user) {
            throw new ValidationError('User record not found');
        }

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                emailVerified: session.user.email_confirmed_at !== null
            },
            organization: {
                id: user.organizations.id,
                name: user.organizations.name,
                slug: user.organizations.slug,
                plan: user.organizations.plan
            },
            session: {
                accessToken: session.session.access_token,
                refreshToken: session.session.refresh_token,
                expiresAt: session.session.expires_at
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/v1/auth/resend-verification
 * Resend verification email
 */
router.post('/resend-verification', async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            throw new ValidationError('Email required');
        }

        const { error } = await supabaseAdmin.auth.resend({
            type: 'signup',
            email,
            options: {
                emailRedirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify`
            }
        });

        if (error) {
            throw new ValidationError(error.message);
        }

        res.json({ message: 'Verification email sent' });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            throw new ValidationError('Refresh token required');
        }

        const { data, error } = await supabaseAdmin.auth.refreshSession({
            refresh_token: refreshToken
        });

        if (error) {
            throw new ValidationError('Invalid refresh token');
        }

        res.json({
            session: {
                accessToken: data.session.access_token,
                refreshToken: data.session.refresh_token,
                expiresAt: data.session.expires_at
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/v1/auth/logout
 * Sign out user
 */
router.post('/logout', async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            await supabaseAdmin.auth.admin.signOut(token);
        }
        res.json({ success: true });
    } catch (error) {
        res.json({ success: true });
    }
});

export default router;
