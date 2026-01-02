import { Link } from 'react-router-dom';

export default function EmptyState() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-8">
            <div className="w-16 h-16 bg-slate-200 rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
            </div>

            <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Select a conversation
            </h3>
            <p className="text-slate-500 text-center max-w-sm mb-6">
                Choose a conversation from the list to view messages and reply to your visitors.
            </p>

            <Link
                to="/install"
                className="text-primary-600 hover:text-primary-700 font-medium flex items-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Install widget to start receiving messages
            </Link>
        </div>
    );
}
