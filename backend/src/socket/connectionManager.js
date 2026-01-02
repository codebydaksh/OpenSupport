import { supabaseAdmin } from '../lib/supabase.js';
import { sendAgentReplyNotification } from '../services/emailService.js';

// Store active connections
const visitorConnections = new Map(); // sessionId -> socket
const agentConnections = new Map();   // agentId -> Set<socket>
const orgRooms = new Map();           // orgId -> Set<sessionId|agentId>

/**
 * Set up Socket.io event handlers
 */
export function setupSocketHandlers(io) {
    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        // Widget connection (visitor)
        socket.on('widget:connect', async (data) => {
            try {
                await handleWidgetConnect(socket, data);
            } catch (error) {
                socket.emit('error', { message: 'Connection failed' });
                console.error('Widget connect error:', error);
            }
        });

        // Agent dashboard connection
        socket.on('agent:connect', async (data) => {
            try {
                await handleAgentConnect(socket, data);
            } catch (error) {
                socket.emit('error', { message: 'Connection failed' });
                console.error('Agent connect error:', error);
            }
        });

        // Message from visitor
        socket.on('message:send', async (data) => {
            try {
                await handleVisitorMessage(io, socket, data);
            } catch (error) {
                socket.emit('message:error', {
                    idempotencyKey: data.idempotencyKey,
                    error: 'Failed to send message'
                });
                console.error('Message send error:', error);
            }
        });

        // Message from agent
        socket.on('agent:reply', async (data) => {
            try {
                await handleAgentReply(io, socket, data);
            } catch (error) {
                socket.emit('message:error', {
                    idempotencyKey: data.idempotencyKey,
                    error: 'Failed to send reply'
                });
                console.error('Agent reply error:', error);
            }
        });

        // Typing indicators
        socket.on('typing:start', (data) => {
            socket.to(`conversation:${data.conversationId}`).emit('typing:start', {
                conversationId: data.conversationId,
                senderType: data.senderType
            });
        });

        socket.on('typing:stop', (data) => {
            socket.to(`conversation:${data.conversationId}`).emit('typing:stop', {
                conversationId: data.conversationId,
                senderType: data.senderType
            });
        });

        // Disconnect handling
        socket.on('disconnect', () => {
            handleDisconnect(socket);
        });
    });
}

async function handleWidgetConnect(socket, { orgId, sessionId, visitorId }) {
    if (!orgId || !sessionId) {
        socket.emit('error', { message: 'Missing orgId or sessionId' });
        return;
    }

    // Verify org exists
    const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('id, plan')
        .eq('id', orgId)
        .single();

    if (!org) {
        socket.emit('error', { message: 'Invalid organization' });
        return;
    }

    // Store connection
    socket.orgId = orgId;
    socket.sessionId = sessionId;
    socket.visitorId = visitorId;
    socket.connectionType = 'visitor';

    visitorConnections.set(sessionId, socket);

    // Join org room for broadcasts
    socket.join(`org:${orgId}`);

    // If there's an existing conversation, join that room too
    if (visitorId) {
        const { data: conversation } = await supabaseAdmin
            .from('conversations')
            .select('id')
            .eq('visitor_id', visitorId)
            .eq('status', 'open')
            .single();

        if (conversation) {
            socket.join(`conversation:${conversation.id}`);
            socket.conversationId = conversation.id;
        }
    }

    socket.emit('widget:connected', {
        sessionId,
        visitorId,
        conversationId: socket.conversationId
    });

    console.log(`Visitor connected: ${sessionId} to org ${orgId}`);
}

async function handleAgentConnect(socket, { agentId, orgId, accessToken }) {
    if (!agentId || !orgId) {
        socket.emit('error', { message: 'Missing agentId or orgId' });
        return;
    }

    // Verify agent belongs to org
    const { data: agent } = await supabaseAdmin
        .from('users')
        .select('id, org_id, name')
        .eq('id', agentId)
        .eq('org_id', orgId)
        .single();

    if (!agent) {
        socket.emit('error', { message: 'Invalid agent' });
        return;
    }

    // Store connection
    socket.orgId = orgId;
    socket.agentId = agentId;
    socket.agentName = agent.name;
    socket.connectionType = 'agent';

    if (!agentConnections.has(agentId)) {
        agentConnections.set(agentId, new Set());
    }
    agentConnections.get(agentId).add(socket);

    // Join org room
    socket.join(`org:${orgId}`);
    socket.join(`agents:${orgId}`);

    socket.emit('agent:connected', { agentId });

    console.log(`Agent connected: ${agentId} to org ${orgId}`);
}

async function handleVisitorMessage(io, socket, { content, idempotencyKey, pageUrl }) {
    const { orgId, sessionId, visitorId, conversationId } = socket;

    if (!content?.trim()) {
        socket.emit('message:error', { idempotencyKey, error: 'Empty message' });
        return;
    }

    // Import here to avoid circular dependency
    const { sendMessage } = await import('../services/messageService.js');
    const { checkConversationLimit } = await import('../services/limitService.js');

    // Get org plan
    const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('plan')
        .eq('id', orgId)
        .single();

    let actualConversationId = conversationId;
    let actualVisitorId = visitorId;

    // Create or get visitor
    if (!actualVisitorId) {
        const { data: visitor } = await supabaseAdmin
            .from('visitors')
            .upsert({
                org_id: orgId,
                session_id: sessionId,
                first_seen_at: new Date().toISOString(),
                last_seen_at: new Date().toISOString()
            }, {
                onConflict: 'org_id,session_id',
                ignoreDuplicates: false
            })
            .select()
            .single();

        actualVisitorId = visitor.id;
        socket.visitorId = visitor.id;
    }

    // Create or get conversation
    if (!actualConversationId) {
        // Check conversation limit before creating
        await checkConversationLimit(orgId, org.plan);

        const { data: conversation } = await supabaseAdmin
            .from('conversations')
            .insert({
                org_id: orgId,
                visitor_id: actualVisitorId,
                status: 'open',
                page_url: pageUrl
            })
            .select()
            .single();

        actualConversationId = conversation.id;
        socket.conversationId = conversation.id;
        socket.join(`conversation:${conversation.id}`);

        // Notify agents of new conversation
        io.to(`agents:${orgId}`).emit('conversation:new', {
            conversation: {
                id: conversation.id,
                visitorId: actualVisitorId,
                pageUrl,
                createdAt: conversation.created_at
            }
        });
    }

    // Send message with idempotency
    const { message, isNew } = await sendMessage({
        orgId,
        conversationId: actualConversationId,
        senderType: 'visitor',
        senderId: actualVisitorId,
        content,
        idempotencyKey
    });

    // Acknowledge to sender
    socket.emit('message:ack', {
        idempotencyKey,
        messageId: message.id,
        conversationId: actualConversationId
    });

    // Broadcast to conversation room (agents watching this convo)
    if (isNew) {
        socket.to(`conversation:${actualConversationId}`).emit('message:new', {
            message: {
                id: message.id,
                conversationId: actualConversationId,
                senderType: 'visitor',
                content: message.content,
                createdAt: message.created_at
            }
        });

        // Also notify all agents in org about new message
        io.to(`agents:${orgId}`).emit('conversation:updated', {
            conversationId: actualConversationId,
            lastMessage: {
                content: message.content,
                senderType: 'visitor',
                createdAt: message.created_at
            }
        });
    }
}

async function handleAgentReply(io, socket, { conversationId, content, idempotencyKey }) {
    const { orgId, agentId, agentName } = socket;

    if (!content?.trim() || !conversationId) {
        socket.emit('message:error', { idempotencyKey, error: 'Invalid message or conversation' });
        return;
    }

    // Verify conversation belongs to org
    const { data: conversation } = await supabaseAdmin
        .from('conversations')
        .select('id, org_id, visitor_id, visitors(email, session_id)')
        .eq('id', conversationId)
        .eq('org_id', orgId)
        .single();

    if (!conversation) {
        socket.emit('message:error', { idempotencyKey, error: 'Conversation not found' });
        return;
    }

    const { sendMessage } = await import('../services/messageService.js');

    // Send message with idempotency
    const { message, isNew } = await sendMessage({
        orgId,
        conversationId,
        senderType: 'agent',
        senderId: agentId,
        content,
        idempotencyKey
    });

    // Acknowledge to agent
    socket.emit('message:ack', {
        idempotencyKey,
        messageId: message.id
    });

    if (isNew) {
        // Find visitor's socket
        const visitorSocket = visitorConnections.get(conversation.visitors.session_id);

        if (visitorSocket) {
            // Visitor is online - send real-time
            visitorSocket.emit('message:new', {
                message: {
                    id: message.id,
                    conversationId,
                    senderType: 'agent',
                    senderName: agentName,
                    content: message.content,
                    createdAt: message.created_at
                }
            });
        } else {
            // Visitor is offline - send email notification
            const { data: org } = await supabaseAdmin
                .from('organizations')
                .select('name, plan')
                .eq('id', orgId)
                .single();

            await sendAgentReplyNotification({
                plan: org.plan,
                visitorEmail: conversation.visitors.email,
                agentName,
                orgName: org.name,
                messageContent: content
            });
        }

        // Broadcast to other agents
        socket.to(`conversation:${conversationId}`).emit('message:new', {
            message: {
                id: message.id,
                conversationId,
                senderType: 'agent',
                senderId: agentId,
                senderName: agentName,
                content: message.content,
                createdAt: message.created_at
            }
        });
    }
}

function handleDisconnect(socket) {
    if (socket.connectionType === 'visitor') {
        visitorConnections.delete(socket.sessionId);
        console.log(`Visitor disconnected: ${socket.sessionId}`);
    } else if (socket.connectionType === 'agent') {
        const agentSockets = agentConnections.get(socket.agentId);
        if (agentSockets) {
            agentSockets.delete(socket);
            if (agentSockets.size === 0) {
                agentConnections.delete(socket.agentId);
            }
        }
        console.log(`Agent disconnected: ${socket.agentId}`);
    }
}

/**
 * Check if a visitor is currently online
 */
export function isVisitorOnline(sessionId) {
    return visitorConnections.has(sessionId);
}

/**
 * Get online agent count for an org
 */
export function getOnlineAgentCount(orgId) {
    let count = 0;
    for (const [agentId, sockets] of agentConnections) {
        for (const socket of sockets) {
            if (socket.orgId === orgId) {
                count++;
                break; // Count each agent once
            }
        }
    }
    return count;
}
