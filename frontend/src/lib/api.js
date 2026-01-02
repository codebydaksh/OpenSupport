const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

class ApiClient {
    constructor() {
        this.token = null;
    }

    setToken(token) {
        this.token = token;
    }

    async request(method, path, data = null, options = {}) {
        const url = `${API_BASE}${path}`;

        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const config = {
            method,
            headers,
            ...options
        };

        if (data && method !== 'GET') {
            config.body = JSON.stringify(data);
        }

        const response = await fetch(url, config);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
            const err = new Error(error.error?.message || 'Request failed');
            err.status = response.status;
            err.code = error.error?.code;
            err.details = error.error?.details;
            throw err;
        }

        return response.json();
    }

    get(path, options) {
        return this.request('GET', path, null, options);
    }

    post(path, data, options) {
        return this.request('POST', path, data, options);
    }

    patch(path, data, options) {
        return this.request('PATCH', path, data, options);
    }

    delete(path, options) {
        return this.request('DELETE', path, null, options);
    }
}

export const api = new ApiClient();

// Conversation APIs
export const conversationsApi = {
    list: (status = 'open') => api.get(`/conversations?status=${status}`),
    get: (id) => api.get(`/conversations/${id}`),
    update: (id, data) => api.patch(`/conversations/${id}`, data)
};

// Messages APIs
export const messagesApi = {
    send: (conversationId, content, idempotencyKey) =>
        api.post('/messages', { conversationId, content, idempotencyKey }),
    list: (conversationId) => api.get(`/messages/${conversationId}`)
};

// Teams APIs
export const teamsApi = {
    listMembers: () => api.get('/teams/members'),
    invite: (data) => api.post('/teams/invite', data),
    updateMember: (id, data) => api.patch(`/teams/members/${id}`, data),
    removeMember: (id) => api.delete(`/teams/members/${id}`),
    getOrganization: () => api.get('/teams/organization'),
    updateOrganization: (data) => api.patch('/teams/organization', data)
};

// Billing APIs
export const billingApi = {
    getUsage: () => api.get('/billing/usage'),
    createCheckout: () => api.post('/billing/checkout'),
    createPortal: () => api.post('/billing/portal'),
    getSubscription: () => api.get('/billing/subscription')
};

// Routing Rules APIs
export const routingRulesApi = {
    list: () => api.get('/routing-rules'),
    create: (data) => api.post('/routing-rules', data),
    update: (id, data) => api.patch(`/routing-rules/${id}`, data),
    delete: (id) => api.delete(`/routing-rules/${id}`)
};

// Auth APIs
export const authApi = {
    resendVerification: (email) => api.post('/auth/resend-verification', { email })
};
