import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';

export default function Install() {
    const { organization } = useAuth();
    const [copied, setCopied] = useState(false);

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://api.opensupport.app';
    const widgetUrl = import.meta.env.VITE_WIDGET_URL || 'https://widget.opensupport.app';

    const embedCode = `<!-- OpenSupport Chat Widget -->
<script>
  window.OpenSupport = {
    orgId: '${organization?.id || 'YOUR_ORG_ID'}'
  };
</script>
<script src="${widgetUrl}/widget.js" async></script>`;

    const handleCopy = () => {
        navigator.clipboard.writeText(embedCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="h-screen flex bg-slate-50">
            <Sidebar />

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto p-8">
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Install Widget</h1>
                    <p className="text-slate-500 mb-8">Add the chat widget to your website in under 5 minutes</p>

                    {/* Step 1 */}
                    <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-semibold text-sm">
                                1
                            </span>
                            <h2 className="text-lg font-semibold text-slate-900">Copy the embed code</h2>
                        </div>

                        <div className="relative">
                            <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
                                <code>{embedCode}</code>
                            </pre>
                            <button
                                onClick={handleCopy}
                                className="absolute top-3 right-3 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition"
                            >
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                    </section>

                    {/* Step 2 */}
                    <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-semibold text-sm">
                                2
                            </span>
                            <h2 className="text-lg font-semibold text-slate-900">Paste before &lt;/body&gt;</h2>
                        </div>

                        <p className="text-slate-600 mb-4">
                            Add the code snippet to your website, just before the closing <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">&lt;/body&gt;</code> tag.
                        </p>

                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm">
                            <p className="text-slate-600 mb-2">Works with:</p>
                            <div className="flex flex-wrap gap-2">
                                {['HTML', 'React', 'Next.js', 'Vue', 'WordPress', 'Shopify', 'Webflow'].map(tech => (
                                    <span key={tech} className="px-2 py-1 bg-white border border-slate-200 rounded text-slate-700">
                                        {tech}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Step 3 */}
                    <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-semibold text-sm">
                                3
                            </span>
                            <h2 className="text-lg font-semibold text-slate-900">Start chatting</h2>
                        </div>

                        <p className="text-slate-600">
                            Visit your website and click the chat bubble in the bottom right corner.
                            Send a test message - it will appear in your inbox instantly.
                        </p>
                    </section>

                    {/* Optional: Identify users */}
                    <section className="bg-white rounded-xl border border-slate-200 p-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Optional: Identify users</h2>
                        <p className="text-slate-600 mb-4">
                            If you know who your visitor is (logged in users), you can pass their info to the widget:
                        </p>

                        <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
                            <code>{`<script>
  window.OpenSupport = {
    orgId: '${organization?.id || 'YOUR_ORG_ID'}',
    user: {
      email: 'user@example.com',
      name: 'John Doe'
    }
  };
</script>`}</code>
                        </pre>
                    </section>
                </div>
            </div>
        </div>
    );
}
