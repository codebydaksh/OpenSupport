import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function useSocket() {
    return useContext(SocketContext);
}

export function SocketProvider({ children }) {
    const { user, organization } = useAuth();
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        if (!user || !organization) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
                setConnected(false);
            }
            return;
        }

        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

        const newSocket = io(backendUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 10
        });

        newSocket.on('connect', () => {
            console.log('Socket connected');
            setConnected(true);

            // Join as agent
            newSocket.emit('agent:connect', {
                agentId: user.id,
                orgId: organization.id
            });
        });

        newSocket.on('disconnect', () => {
            console.log('Socket disconnected');
            setConnected(false);
        });

        newSocket.on('agent:connected', (data) => {
            console.log('Agent connected to socket', data);
        });

        newSocket.on('error', (error) => {
            console.error('Socket error:', error);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [user, organization]);

    const joinConversation = useCallback((conversationId) => {
        if (socket && connected) {
            socket.emit('join:conversation', { conversationId });
        }
    }, [socket, connected]);

    const leaveConversation = useCallback((conversationId) => {
        if (socket && connected) {
            socket.emit('leave:conversation', { conversationId });
        }
    }, [socket, connected]);

    const sendTyping = useCallback((conversationId, isTyping) => {
        if (socket && connected) {
            socket.emit(isTyping ? 'typing:start' : 'typing:stop', {
                conversationId,
                senderType: 'agent'
            });
        }
    }, [socket, connected]);

    const value = {
        socket,
        connected,
        joinConversation,
        leaveConversation,
        sendTyping
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
}
