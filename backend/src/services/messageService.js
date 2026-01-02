import { supabaseAdmin } from '../lib/supabase.js';
import { v4 as uuidv4 } from 'uuid';
import { ConflictError, ValidationError } from '../middleware/errorHandler.js';

/**
 * Send a message with idempotency guarantee
 * Returns existing message if idempotency_key already exists
 */
export async function sendMessage({
    orgId,
    conversationId,
    senderType,
    senderId,
    content,
    idempotencyKey
}) {
    if (!idempotencyKey) {
        idempotencyKey = uuidv4();
    }

    // Check for existing message with same idempotency key
    const { data: existing } = await supabaseAdmin
        .from('messages')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .single();

    if (existing) {
        // Return existing message - idempotent behavior
        return { message: existing, isNew: false };
    }

    // Insert new message
    const { data: message, error } = await supabaseAdmin
        .from('messages')
        .insert({
            org_id: orgId,
            conversation_id: conversationId,
            sender_type: senderType,
            sender_id: senderId,
            content: content.trim(),
            idempotency_key: idempotencyKey
        })
        .select()
        .single();

    if (error) {
        // Handle race condition - another request inserted with same key
        if (error.code === '23505') { // unique violation
            const { data: existing } = await supabaseAdmin
                .from('messages')
                .select('*')
                .eq('idempotency_key', idempotencyKey)
                .single();

            if (existing) {
                return { message: existing, isNew: false };
            }
        }
        throw error;
    }

    // Update conversation updated_at
    await supabaseAdmin
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

    return { message, isNew: true };
}

/**
 * Get messages for a conversation with deduplication
 */
export async function getConversationMessages(orgId, conversationId, options = {}) {
    const { limit = 50, before = null, historyLimit = null } = options;

    let query = supabaseAdmin
        .from('messages')
        .select('*')
        .eq('org_id', orgId)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (before) {
        query = query.lt('created_at', before);
    }

    if (historyLimit) {
        query = query.gte('created_at', historyLimit.toISOString());
    }

    const { data: messages, error } = await query;

    if (error) {
        throw error;
    }

    // Deduplicate by idempotency_key (shouldn't be needed but safety)
    const seen = new Set();
    const deduplicated = messages.filter(msg => {
        if (seen.has(msg.idempotency_key)) {
            return false;
        }
        seen.add(msg.idempotency_key);
        return true;
    });

    return deduplicated.reverse(); // Return in chronological order
}

/**
 * Mark messages as delivered (for tracking)
 */
export async function markMessagesDelivered(messageIds) {
    // For MVP, we just track in logs
    // Full implementation would update a delivery_status column
    console.log(`Messages delivered: ${messageIds.join(', ')}`);
}
