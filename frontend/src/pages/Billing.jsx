import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { billingApi } from '../lib/api';
import Sidebar from '../components/Sidebar';

export default function Billing() {
    const { organization } = useAuth();
    const [searchParams] = useSearchParams();
    const [usage, setUsage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    useEffect(() => {
        loadUsage();
    }, []);

    const loadUsage = async () => {
        try {
            const data = await billingApi.getUsage();
            setUsage(data);
        } catch (err) {
            console.error('Failed to load usage:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpgrade = async () => {
        setActionLoading(true);
        try {
            const { checkoutUrl } = await billingApi.createCheckout();
            window.location.href = checkoutUrl;
        } catch (err) {
            alert(err.message || 'Failed to start checkout');
            setActionLoading(false);
        }
    };

    const handleManage = async () => {
        setActionLoading(true);
        try {
            const { portalUrl } = await billingApi.createPortal();
            window.location.href = portalUrl;
        } catch (err) {
            alert(err.message || 'Failed to open billing portal');
            setActionLoading(false);
        }
    };

    const isPaid = organization?.plan === 'paid';

    return (
        <div className="h-screen flex bg-slate-50">
            <Sidebar />

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto p-8">
                    <h1 className="text-2xl font-bold text-slate-900 mb-8">Billing</h1>

                    {/* Success/Cancel banners */}
                    {success && (
                        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
                            Welcome to Pro! Your account has been upgraded.
                        </div>
                    )}
                    {canceled && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg mb-6">
                            Checkout was canceled. You can try again anytime.
                        </div>
                    )}

                    {/* Current Plan */}
                    <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Current Plan</h2>
                                <p className="text-slate-500 text-sm">
                                    {isPaid ? 'Pro - $49/month' : 'Free'}
                                </p>
                            </div>
                            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${isPaid ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                                }`}>
                                {isPaid ? 'Active' : 'Free tier'}
                            </span>
                        </div>

                        {isPaid ? (
                            <button
                                onClick={handleManage}
                                disabled={actionLoading}
                                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
                            >
                                {actionLoading ? 'Loading...' : 'Manage subscription'}
                            </button>
                        ) : (
                            <button
                                onClick={handleUpgrade}
                                disabled={actionLoading}
                                className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition disabled:opacity-50"
                            >
                                {actionLoading ? 'Loading...' : 'Upgrade to Pro - $49/month'}
                            </button>
                        )}
                    </section>

                    {/* Usage */}
                    <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Usage this month</h2>

                        {loading ? (
                            <div className="animate-pulse space-y-4">
                                <div className="h-8 bg-slate-100 rounded w-1/2"></div>
                                <div className="h-8 bg-slate-100 rounded w-1/2"></div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <UsageBar
                                    label="Conversations"
                                    current={usage?.usage?.conversations?.current || 0}
                                    limit={usage?.usage?.conversations?.limit}
                                />
                                <UsageBar
                                    label="Team members"
                                    current={usage?.usage?.agents?.current || 0}
                                    limit={usage?.usage?.agents?.limit}
                                />
                            </div>
                        )}
                    </section>

                    {/* Plan Comparison */}
                    <section className="bg-white rounded-xl border border-slate-200 p-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Plan comparison</h2>

                        <div className="grid md:grid-cols-2 gap-6">
                            <PlanCard
                                name="Free"
                                price="$0"
                                features={[
                                    '1 team member',
                                    '100 conversations/month',
                                    '30-day message history',
                                    'No email notifications'
                                ]}
                                current={!isPaid}
                            />
                            <PlanCard
                                name="Pro"
                                price="$49/month"
                                features={[
                                    'Unlimited team members',
                                    '1,000 conversations/month',
                                    'Unlimited message history',
                                    'Email notifications',
                                    'Priority support'
                                ]}
                                current={isPaid}
                                highlight
                            />
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

function UsageBar({ label, current, limit }) {
    const percentage = limit ? Math.min((current / limit) * 100, 100) : 0;
    const isNearLimit = percentage >= 80;

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">{label}</span>
                <span className="text-sm text-slate-500">
                    {current} {limit ? `/ ${limit}` : '(unlimited)'}
                </span>
            </div>
            {limit && (
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all ${isNearLimit ? 'bg-amber-500' : 'bg-primary-500'
                            }`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            )}
        </div>
    );
}

function PlanCard({ name, price, features, current, highlight }) {
    return (
        <div className={`rounded-xl border-2 p-6 ${highlight ? 'border-primary-500 bg-primary-50/50' : 'border-slate-200'
            }`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">{name}</h3>
                {current && (
                    <span className="text-xs font-medium text-primary-600 bg-primary-100 px-2 py-1 rounded">
                        Current
                    </span>
                )}
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-4">{price}</p>
            <ul className="space-y-2">
                {features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                    </li>
                ))}
            </ul>
        </div>
    );
}
