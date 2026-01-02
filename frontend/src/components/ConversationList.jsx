import { formatDistanceToNow } from 'date-fns';

export default function ConversationList({
    conversations,
    activeId,
    filter,
    onFilterChange,
    onSelect,
    loading
}) {
    return (
        <div className="w-80 border-r border-slate-200 bg-white flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900 mb-3">Conversations</h2>

                {/* Filter tabs */}
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                    {['open', 'closed', 'all'].map(f => (
                        <button
                            key={f}
                            onClick={() => onFilterChange(f)}
                            className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === f
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="p-4 space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="animate-pulse">
                                <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                                <div className="h-3 bg-slate-100 rounded w-full"></div>
                            </div>
                        ))}
                    </div>
                ) : conversations.length === 0 ? (
                    <div className="p-4 text-center text-slate-500">
                        <p>No conversations yet</p>
                        <p className="text-sm mt-1">Install the widget to start receiving messages</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {conversations.map(conv => (
                            <ConversationItem
                                key={conv.id}
                                conversation={conv}
                                isActive={conv.id === activeId}
                                onClick={() => onSelect(conv)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function ConversationItem({ conversation, isActive, onClick }) {
    const visitor = conversation.visitor || {};
    const lastMessage = conversation.lastMessage;

    return (
        <button
            onClick={onClick}
            className={`w-full p-4 text-left hover:bg-slate-50 transition-colors ${isActive ? 'bg-primary-50 border-l-2 border-primary-600' : ''
                }`}
        >
            <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-medium text-sm flex-shrink-0">
                    {visitor.name?.[0]?.toUpperCase() || visitor.email?.[0]?.toUpperCase() || '?'}
                </div>

                <div className="flex-1 min-w-0">
                    {/* Visitor name/email */}
                    <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-900 truncate">
                            {visitor.name || visitor.email || `Visitor ${visitor.session_id?.slice(0, 8)}`}
                        </span>
                        {lastMessage && (
                            <span className="text-xs text-slate-400 flex-shrink-0">
                                {formatDistanceToNow(new Date(lastMessage.createdAt), { addSuffix: false })}
                            </span>
                        )}
                    </div>

                    {/* Last message preview */}
                    {lastMessage && (
                        <p className="text-sm text-slate-500 truncate mt-0.5">
                            {lastMessage.senderType === 'agent' && <span className="text-slate-400">You: </span>}
                            {lastMessage.content}
                        </p>
                    )}

                    {/* Page URL */}
                    {conversation.pageUrl && (
                        <p className="text-xs text-slate-400 truncate mt-1">
                            {new URL(conversation.pageUrl).pathname}
                        </p>
                    )}
                </div>
            </div>
        </button>
    );
}
