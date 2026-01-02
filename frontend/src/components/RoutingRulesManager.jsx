import { useState, useEffect } from 'react';
import { routingRulesApi } from '../lib/api';

export default function RoutingRulesManager({ members }) {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [formData, setFormData] = useState({ urlPattern: '', targetAgentId: '', priority: 0, enabled: true });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        loadRules();
    }, []);

    const loadRules = async () => {
        try {
            const { rules } = await routingRulesApi.list();
            setRules(rules);
        } catch (err) {
            console.error('Failed to load rules:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);

        try {
            await routingRulesApi.create({
                urlPattern: formData.urlPattern,
                targetAgentId: formData.targetAgentId || null,
                priority: parseInt(formData.priority) || 0,
                enabled: formData.enabled
            });
            setShowAdd(false);
            setFormData({ urlPattern: '', targetAgentId: '', priority: 0, enabled: true });
            loadRules();
        } catch (err) {
            setError(err.message || 'Failed to create rule');
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (rule) => {
        try {
            await routingRulesApi.update(rule.id, { enabled: !rule.enabled });
            loadRules();
        } catch (err) {
            alert(err.message || 'Failed to update rule');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this routing rule?')) return;

        try {
            await routingRulesApi.delete(id);
            loadRules();
        } catch (err) {
            alert(err.message || 'Failed to delete rule');
        }
    };

    return (
        <section className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Routing Rules</h2>
                    <p className="text-sm text-slate-500">Route conversations based on page URL</p>
                </div>
                <button
                    onClick={() => setShowAdd(true)}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition"
                >
                    Add rule
                </button>
            </div>

            {loading ? (
                <div className="animate-pulse space-y-3">
                    <div className="h-12 bg-slate-100 rounded"></div>
                    <div className="h-12 bg-slate-100 rounded"></div>
                </div>
            ) : rules.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                    <p>No routing rules configured</p>
                    <p className="text-sm mt-1">Add a rule to route conversations to specific agents</p>
                </div>
            ) : (
                <div className="divide-y divide-slate-100">
                    {rules.map(rule => (
                        <div key={rule.id} className="py-4 flex items-center justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <code className="text-sm bg-slate-100 px-2 py-1 rounded">{rule.url_pattern}</code>
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${rule.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                        {rule.enabled ? 'Active' : 'Disabled'}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-500 mt-1">
                                    {rule.target_agent
                                        ? `Assign to ${rule.target_agent.name}`
                                        : 'No specific agent (first available)'}
                                    {' | Priority: '}{rule.priority}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleToggle(rule)}
                                    className="text-sm text-slate-600 hover:text-slate-900"
                                >
                                    {rule.enabled ? 'Disable' : 'Enable'}
                                </button>
                                <button
                                    onClick={() => handleDelete(rule.id)}
                                    className="text-sm text-red-600 hover:text-red-700"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Rule Modal */}
            {showAdd && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">Add routing rule</h3>

                        <form onSubmit={handleAdd} className="space-y-4">
                            {error && (
                                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    URL Pattern
                                </label>
                                <input
                                    type="text"
                                    value={formData.urlPattern}
                                    onChange={(e) => setFormData(d => ({ ...d, urlPattern: e.target.value }))}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                    placeholder="*/pricing*, */checkout*"
                                    required
                                />
                                <p className="text-xs text-slate-500 mt-1">Use * as wildcard</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Assign to Agent
                                </label>
                                <select
                                    value={formData.targetAgentId}
                                    onChange={(e) => setFormData(d => ({ ...d, targetAgentId: e.target.value }))}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                >
                                    <option value="">First available agent</option>
                                    {members.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Priority (higher = checked first)
                                </label>
                                <input
                                    type="number"
                                    value={formData.priority}
                                    onChange={(e) => setFormData(d => ({ ...d, priority: e.target.value }))}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                    min="0"
                                    max="100"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="enabled"
                                    checked={formData.enabled}
                                    onChange={(e) => setFormData(d => ({ ...d, enabled: e.target.checked }))}
                                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                />
                                <label htmlFor="enabled" className="text-sm text-slate-700">Enabled</label>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAdd(false)}
                                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : 'Add rule'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
