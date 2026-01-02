import { supabaseAdmin } from '../lib/supabase.js';
import { LimitExceededError } from '../middleware/errorHandler.js';

/**
 * Plan limits
 */
const LIMITS = {
    free: {
        agents: 1,
        conversationsPerMonth: 100,
        messageHistoryDays: 30,
        emailNotifications: false
    },
    paid: {
        agents: Infinity, // charged per agent after 3
        conversationsPerMonth: 1000,
        messageHistoryDays: Infinity,
        emailNotifications: true
    }
};

/**
 * Get the current billing period start date
 */
function getBillingPeriodStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Check if organization can add more agents
 */
export async function checkAgentLimit(orgId, plan) {
    const limit = LIMITS[plan]?.agents || LIMITS.free.agents;

    if (limit === Infinity) {
        return { allowed: true, current: 0, limit: null };
    }

    const { count, error } = await supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId);

    if (error) {
        throw error;
    }

    const allowed = count < limit;

    if (!allowed) {
        throw new LimitExceededError(
            `Agent limit (${limit})`,
            `/billing?upgrade=agents`
        );
    }

    return { allowed, current: count, limit };
}

/**
 * Check if organization can create more conversations this month
 */
export async function checkConversationLimit(orgId, plan) {
    const limit = LIMITS[plan]?.conversationsPerMonth || LIMITS.free.conversationsPerMonth;
    const periodStart = getBillingPeriodStart();

    const { count, error } = await supabaseAdmin
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('created_at', periodStart.toISOString());

    if (error) {
        throw error;
    }

    const allowed = count < limit;

    if (!allowed) {
        // Log for sales intelligence
        await logLimitHit(orgId, 'conversation', count, limit);

        throw new LimitExceededError(
            `Monthly conversation limit (${limit})`,
            `/billing?upgrade=conversations`
        );
    }

    return { allowed, current: count, limit };
}

/**
 * Check if email notifications are allowed
 */
export function checkEmailNotificationsAllowed(plan) {
    return LIMITS[plan]?.emailNotifications || false;
}

/**
 * Get message history cutoff date based on plan
 */
export function getMessageHistoryCutoff(plan) {
    const days = LIMITS[plan]?.messageHistoryDays || LIMITS.free.messageHistoryDays;

    if (days === Infinity) {
        return null; // No cutoff
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return cutoff;
}

/**
 * Log limit hit for sales intelligence
 */
async function logLimitHit(orgId, metric, current, limit) {
    try {
        await supabaseAdmin.from('usage_logs').insert({
            org_id: orgId,
            metric,
            count: current,
            period_start: getBillingPeriodStart().toISOString(),
            period_end: new Date().toISOString()
        });
    } catch (error) {
        // Don't fail the request if logging fails
        console.error('Failed to log limit hit:', error);
    }
}

/**
 * Get current usage stats for an organization
 */
export async function getUsageStats(orgId, plan) {
    const periodStart = getBillingPeriodStart();

    const [agents, conversations] = await Promise.all([
        supabaseAdmin
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', orgId),
        supabaseAdmin
            .from('conversations')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .gte('created_at', periodStart.toISOString())
    ]);

    return {
        agents: {
            current: agents.count || 0,
            limit: LIMITS[plan]?.agents === Infinity ? null : LIMITS[plan]?.agents
        },
        conversations: {
            current: conversations.count || 0,
            limit: LIMITS[plan]?.conversationsPerMonth
        },
        billingPeriodStart: periodStart.toISOString()
    };
}

export { LIMITS };
