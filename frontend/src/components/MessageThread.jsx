import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

export default function MessageThread({
    conversation,
    messages,
    onSend,
    onClose,
    connected
}) {
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, [conversation?.id]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const content = input.trim();
        if (!content || sending) return;

        setSending(true);
        setInput('');

        try {
            // Generate idempotency key for retry safety
            const idempotencyKey = uuidv4();
            await onSend(content, idempotencyKey);
        } catch (err) {
            console.error('Failed to send message:', err);
            setInput(content); // Restore input on failure
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const visitor = conversation?.visitor || {};

    return (
        <div className="flex-1 flex flex-col bg-white">
            {/* Header */}
            <div className="h-16 border-b border-slate-200 px-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-medium">
                        {visitor.name?.[0]?.toUpperCase() || visitor.email?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                        <h3 className="font-medium text-slate-900">
                            {visitor.name || visitor.email || `Visitor ${visitor.session_id?.slice(0, 8)}`}
                        </h3>
                        {visitor.email && visitor.name && (
                            <p className="text-sm text-slate-500">{visitor.email}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!connected && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                            Reconnecting...
                        </span>
                    )}

                    {conversation?.conversation?.status === 'open' && (
                        <button
                            onClick={onClose}
                            className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Close conversation
                        </button>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg, idx) => (
                    <Message key={msg.id || idx} message={msg} />
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {conversation?.conversation?.status === 'open' ? (
                <form onSubmit={handleSubmit} className="border-t border-slate-200 p-4">
                    <div className="flex gap-3">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type your reply..."
                            rows={1}
                            className="flex-1 resize-none px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                            disabled={sending}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || sending}
                            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {sending ? 'Sending...' : 'Send'}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="border-t border-slate-200 p-4 bg-slate-50 text-center text-slate-500">
                    This conversation is closed
                </div>
            )}
        </div>
    );
}

function Message({ message }) {
    const isAgent = message.sender_type === 'agent' || message.senderType === 'agent';
    const time = format(new Date(message.created_at || message.createdAt), 'h:mm a');

    return (
        <div className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] message-enter ${isAgent
                    ? 'bg-primary-600 text-white rounded-2xl rounded-br-md'
                    : 'bg-slate-100 text-slate-900 rounded-2xl rounded-bl-md'
                } px-4 py-3`}>
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                <p className={`text-xs mt-1 ${isAgent ? 'text-primary-200' : 'text-slate-400'}`}>
                    {time}
                </p>
            </div>
        </div>
    );
}
