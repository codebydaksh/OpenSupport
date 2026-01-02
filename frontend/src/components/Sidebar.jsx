import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function Sidebar() {
    const location = useLocation();
    const { user, organization, logout } = useAuth();
    const { connected } = useSocket();

    const navItems = [
        { path: '/', label: 'Inbox', icon: InboxIcon },
        { path: '/install', label: 'Install', icon: CodeIcon },
        { path: '/settings', label: 'Settings', icon: SettingsIcon },
        { path: '/billing', label: 'Billing', icon: CreditCardIcon },
    ];

    return (
        <div className="w-16 bg-slate-900 flex flex-col items-center py-4">
            {/* Logo */}
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white font-bold mb-6">
                OS
            </div>

            {/* Connection status */}
            <div className={`w-2 h-2 rounded-full mb-6 ${connected ? 'bg-green-400' : 'bg-red-400'}`}
                title={connected ? 'Connected' : 'Disconnected'} />

            {/* Navigation */}
            <nav className="flex-1 flex flex-col gap-2">
                {navItems.map(item => {
                    const isActive = location.pathname === item.path ||
                        (item.path === '/' && location.pathname.startsWith('/conversation'));

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isActive
                                    ? 'bg-primary-600 text-white'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                            title={item.label}
                        >
                            <item.icon className="w-5 h-5" />
                        </Link>
                    );
                })}
            </nav>

            {/* User menu */}
            <div className="mt-auto">
                <button
                    onClick={logout}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Logout"
                >
                    <LogoutIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}

function InboxIcon({ className }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
    );
}

function CodeIcon({ className }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
    );
}

function SettingsIcon({ className }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    );
}

function CreditCardIcon({ className }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
    );
}

function LogoutIcon({ className }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
    );
}
