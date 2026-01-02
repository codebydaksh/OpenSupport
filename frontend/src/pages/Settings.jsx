import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { teamsApi } from '../lib/api';
import Sidebar from '../components/Sidebar';
import RoutingRulesManager from '../components/RoutingRulesManager';

export default function Settings() {
    const { organization } = useAuth();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteData, setInviteData] = useState({ email: '', name: '', role: 'agent' });
    const [inviting, setInviting] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('team');

    useEffect(() => {
        loadMembers();
    }, []);

    const loadMembers = async () => {
        try {
            const { members } = await teamsApi.listMembers();
            setMembers(members);
        } catch (err) {
            console.error('Failed to load members:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        setError('');
        setInviting(true);

        try {
            await teamsApi.invite(inviteData);
            setShowInvite(false);
            setInviteData({ email: '', name: '', role: 'agent' });
            loadMembers();
        } catch (err) {
            setError(err.message || 'Failed to invite member');
        } finally {
            setInviting(false);
        }
    };

    const handleRemove = async (id) => {
        if (!confirm('Are you sure you want to remove this team member?')) return;

        try {
            await teamsApi.removeMember(id);
            loadMembers();
        } catch (err) {
            alert(err.message || 'Failed to remove member');
        }
    };

    return (
        <div className="h-screen flex bg-slate-50">
            <Sidebar />

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto p-8">
                    <h1 className="text-2xl font-bold text-slate-900 mb-8">Settings</h1>

                    {/* Tabs */}
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit mb-6">
                        {['team', 'routing'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tab
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                            >
                                {tab === 'team' ? 'Team' : 'Routing Rules'}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'team' && (
                        <>
                            {/* Organization */}
                            <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                                <h2 className="text-lg font-semibold text-slate-900 mb-4">Organization</h2>
                                <div className="grid gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                                        <p className="text-slate-900">{organization?.name}</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Plan</label>
                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-sm font-medium ${organization?.plan === 'paid'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-slate-100 text-slate-700'
                                            }`}>
                                            {organization?.plan === 'paid' ? 'Pro' : 'Free'}
                                        </span>
                                    </div>
                                </div>
                            </section>

                            {/* Team Members */}
                            <section className="bg-white rounded-xl border border-slate-200 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-semibold text-slate-900">Team Members</h2>
                                    <button
                                        onClick={() => setShowInvite(true)}
                                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition"
                                    >
                                        Invite member
                                    </button>
                                </div>

                                {loading ? (
                                    <div className="animate-pulse space-y-3">
                                        {[1, 2].map(i => (
                                            <div key={i} className="h-12 bg-slate-100 rounded"></div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {members.map(member => (
                                            <div key={member.id} className="py-4 flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium text-slate-900">{member.name}</p>
                                                    <p className="text-sm text-slate-500">{member.email}</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${member.role === 'owner' ? 'bg-purple-100 text-purple-700' :
                                                            member.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                                                                'bg-slate-100 text-slate-700'
                                                        }`}>
                                                        {member.role}
                                                    </span>
                                                    {member.role !== 'owner' && (
                                                        <button
                                                            onClick={() => handleRemove(member.id)}
                                                            className="text-red-600 hover:text-red-700 text-sm"
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </>
                    )}

                    {activeTab === 'routing' && (
                        <RoutingRulesManager members={members} />
                    )}

                    {/* Invite Modal */}
                    {showInvite && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                            <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">Invite team member</h3>

                                <form onSubmit={handleInvite} className="space-y-4">
                                    {error && (
                                        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                                            {error}
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                                        <input
                                            type="text"
                                            value={inviteData.name}
                                            onChange={(e) => setInviteData(d => ({ ...d, name: e.target.value }))}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                        <input
                                            type="email"
                                            value={inviteData.email}
                                            onChange={(e) => setInviteData(d => ({ ...d, email: e.target.value }))}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                                        <select
                                            value={inviteData.role}
                                            onChange={(e) => setInviteData(d => ({ ...d, role: e.target.value }))}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                        >
                                            <option value="agent">Agent</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowInvite(false)}
                                            className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={inviting}
                                            className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition disabled:opacity-50"
                                        >
                                            {inviting ? 'Inviting...' : 'Send invite'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
