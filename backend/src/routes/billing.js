import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { getUsageStats, LIMITS } from '../services/limitService.js';
import {
    createCustomer,
    createCheckoutSession,
    createPortalSession,
    handleWebhook,
    getSubscriptionStatus
} from '../services/stripeService.js';
import { requireRole } from '../middleware/tenantContext.js';
import { ValidationError } from '../middleware/errorHandler.js';

const router = Router();

/**
 * GET /api/v1/billing/usage
 * Get current usage stats
 */
router.get('/usage', async (req, res, next) => {
    try {
        const usage = await getUsageStats(req.orgId, req.organization.plan);

        res.json({
            plan: req.organization.plan,
            usage,
            limits: LIMITS[req.organization.plan]
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/v1/billing/checkout
 * Create Stripe checkout session
 */
router.post('/checkout', requireRole('owner', 'admin'), async (req, res, next) => {
    try {
        let customerId = req.organization.stripe_customer_id;

        // Create Stripe customer if needed
        if (!customerId) {
            const customer = await createCustomer(
                req.orgId,
                req.user.email,
                req.organization.name
            );
            customerId = customer?.id;
        }

        if (!customerId) {
            throw new ValidationError('Failed to create billing account');
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

        const session = await createCheckoutSession(
            req.orgId,
            customerId,
            `${frontendUrl}/billing?success=true`,
            `${frontendUrl}/billing?canceled=true`
        );

        res.json({ checkoutUrl: session.url });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/v1/billing/portal
 * Create Stripe billing portal session
 */
router.post('/portal', requireRole('owner', 'admin'), async (req, res, next) => {
    try {
        const customerId = req.organization.stripe_customer_id;

        if (!customerId) {
            throw new ValidationError('No billing account found');
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

        const session = await createPortalSession(
            customerId,
            `${frontendUrl}/billing`
        );

        res.json({ portalUrl: session.url });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/v1/billing/subscription
 * Get subscription status
 */
router.get('/subscription', async (req, res, next) => {
    try {
        const subscriptionId = req.organization.stripe_subscription_id;

        if (!subscriptionId) {
            return res.json({
                subscription: null,
                plan: 'free'
            });
        }

        const status = await getSubscriptionStatus(subscriptionId);

        res.json({
            subscription: status,
            plan: req.organization.plan
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/v1/billing/webhook
 * Handle Stripe webhooks (no auth, uses Stripe signature)
 */
router.post('/webhook', async (req, res, next) => {
    try {
        const signature = req.headers['stripe-signature'];

        if (!signature) {
            throw new ValidationError('Missing Stripe signature');
        }

        const result = await handleWebhook(req.body, signature);

        res.json(result);
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(400).json({ error: error.message });
    }
});

export default router;
