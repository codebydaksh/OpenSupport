import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { conversationsApi, messagesApi } from '../lib/api';
import Sidebar from '../components/Sidebar';
import ConversationList from '../components/ConversationList';
import MessageThread from '../components/MessageThread';
import EmptyState from '../components/EmptyState';

export default function Dashboard() {
    const { id: conversationId } = useParams();
    const navigate = useNavigate();
    const { user, organization } = useAuth();
    const { socket, connected } = useSocket();

    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('open');

    // Load conversations
    const loadConversations = useCallback(async () => {
        try {
            const { conversations } = await conversationsApi.list(filter);
            setConversations(conversations);
        } catch (err) {
            console.error('Failed to load conversations:', err);
        }
    }, [filter]);

    // Load single conversation with messages
    const loadConversation = useCallback(async (id) => {
        try {
            const data = await conversationsApi.get(id);
            setActiveConversation(data);
            setMessages(data.messages || []);
        } catch (err) {
            console.error('Failed to load conversation:', err);
            navigate('/');
        }
    }, [navigate]);

    // Initial load
    useEffect(() => {
        loadConversations().finally(() => setLoading(false));
    }, [loadConversations]);

    // Load active conversation when ID changes
    useEffect(() => {
        if (conversationId) {
            loadConversation(conversationId);
        } else {
            setActiveConversation(null);
            setMessages([]);
        }
    }, [conversationId, loadConversation]);

    // Socket event handlers
    useEffect(() => {
        if (!socket) return;

        const handleNewConversation = (data) => {
            setConversations(prev => [data.conversation, ...prev]);
        };

        const handleConversationUpdated = (data) => {
            setConversations(prev => prev.map(conv =>
                conv.id === data.conversationId
                    ? { ...conv, ...data.updates, lastMessage: data.lastMessage || conv.lastMessage }
                    : conv
            ));
        };

        const handleNewMessage = (data) => {
            if (data.message.conversationId === conversationId) {
                setMessages(prev => {
                    // Deduplicate by ID
                    if (prev.some(m => m.id === data.message.id)) return prev;
                    return [...prev, data.message];
                });
            }
            // Update conversation list
            setConversations(prev => prev.map(conv =>
                conv.id === data.message.conversationId
                    ? { ...conv, lastMessage: data.message, updatedAt: data.message.createdAt }
                    : conv
            ));
        };

        socket.on('conversation:new', handleNewConversation);
        socket.on('conversation:updated', handleConversationUpdated);
        socket.on('message:new', handleNewMessage);

        return () => {
            socket.off('conversation:new', handleNewConversation);
            socket.off('conversation:updated', handleConversationUpdated);
            socket.off('message:new', handleNewMessage);
        };
    }, [socket, conversationId]);

    const handleSelectConversation = (conv) => {
        navigate(`/conversation/${conv.id}`);
    };

    const handleSendMessage = async (content, idempotencyKey) => {
        const { message } = await messagesApi.send(conversationId, content, idempotencyKey);
        setMessages(prev => {
            if (prev.some(m => m.id === message.id)) return prev;
            return [...prev, message];
        });
    };

    const handleCloseConversation = async () => {
        await conversationsApi.update(conversationId, { status: 'closed' });
        loadConversations();
        navigate('/');
    };

    return (
        <div className="h-screen flex bg-slate-50">
            <Sidebar />

            <div className="flex-1 flex">
                <ConversationList
                    conversations={conversations}
                    activeId={conversationId}
                    filter={filter}
                    onFilterChange={setFilter}
                    onSelect={handleSelectConversation}
                    loading={loading}
                />

                <div className="flex-1 flex flex-col">
                    {activeConversation ? (
                        <MessageThread
                            conversation={activeConversation}
                            messages={messages}
                            onSend={handleSendMessage}
                            onClose={handleCloseConversation}
                            connected={connected}
                        />
                    ) : (
                        <EmptyState />
                    )}
                </div>
            </div>
        </div>
    );
}
