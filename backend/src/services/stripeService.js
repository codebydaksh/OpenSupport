import Stripe from 'stripe';
import { supabaseAdmin } from '../lib/supabase.js';

const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : null;

/**
 * Create Stripe customer for organization
 */
export async function createCustomer(orgId, email, name) {
    if (!stripe) {
        console.warn('Stripe not configured');
        return null;
    }

    const customer = await stripe.customers.create({
        email,
        name,
        metadata: { org_id: orgId }
    });

    // Update organization with Stripe customer ID
    await supabaseAdmin
        .from('organizations')
        .update({ stripe_customer_id: customer.id })
        .eq('id', orgId);

    return customer;
}

/**
 * Create checkout session for subscription
 */
export async function createCheckoutSession(orgId, customerId, successUrl, cancelUrl) {
    if (!stripe) {
        throw new Error('Stripe not configured');
    }

    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [{
            price: process.env.STRIPE_PRICE_ID_MONTHLY,
            quantity: 1
        }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { org_id: orgId },
        subscription_data: {
            metadata: { org_id: orgId }
        }
    });

    return session;
}

/**
 * Create billing portal session
 */
export async function createPortalSession(customerId, returnUrl) {
    if (!stripe) {
        throw new Error('Stripe not configured');
    }

    const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl
    });

    return session;
}

/**
 * Handle Stripe webhook events
 */
export async function handleWebhook(payload, signature) {
    if (!stripe) {
        throw new Error('Stripe not configured');
    }

    const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            await handleCheckoutComplete(session);
            break;
        }

        case 'customer.subscription.updated': {
            const subscription = event.data.object;
            await handleSubscriptionUpdate(subscription);
            break;
        }

        case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            await handleSubscriptionCanceled(subscription);
            break;
        }

        case 'invoice.payment_failed': {
            const invoice = event.data.object;
            await handlePaymentFailed(invoice);
            break;
        }
    }

    return { received: true };
}

async function handleCheckoutComplete(session) {
    const orgId = session.metadata?.org_id;
    if (!orgId) return;

    await supabaseAdmin
        .from('organizations')
        .update({
            stripe_subscription_id: session.subscription,
            plan: 'paid'
        })
        .eq('id', orgId);

    console.log(`Organization ${orgId} upgraded to paid plan`);
}

async function handleSubscriptionUpdate(subscription) {
    const orgId = subscription.metadata?.org_id;
    if (!orgId) return;

    const isActive = ['active', 'trialing'].includes(subscription.status);

    await supabaseAdmin
        .from('organizations')
        .update({
            plan: isActive ? 'paid' : 'free'
        })
        .eq('id', orgId);
}

async function handleSubscriptionCanceled(subscription) {
    const orgId = subscription.metadata?.org_id;
    if (!orgId) return;

    await supabaseAdmin
        .from('organizations')
        .update({
            plan: 'free',
            stripe_subscription_id: null
        })
        .eq('id', orgId);

    console.log(`Organization ${orgId} downgraded to free plan`);
}

async function handlePaymentFailed(invoice) {
    // Log for alerting - don't immediately downgrade
    console.error(`Payment failed for invoice ${invoice.id}`);
}

/**
 * Get subscription status
 */
export async function getSubscriptionStatus(subscriptionId) {
    if (!stripe || !subscriptionId) {
        return null;
    }

    try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        return {
            status: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end
        };
    } catch (error) {
        console.error('Failed to get subscription status:', error);
        return null;
    }
}
