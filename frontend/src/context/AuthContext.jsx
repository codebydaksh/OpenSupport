import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [organization, setOrganization] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for stored session
        const stored = localStorage.getItem('opensupport_session');
        if (stored) {
            try {
                const session = JSON.parse(stored);
                if (session.expiresAt > Date.now()) {
                    setUser(session.user);
                    setOrganization(session.organization);
                    api.setToken(session.accessToken);
                } else {
                    localStorage.removeItem('opensupport_session');
                }
            } catch (e) {
                localStorage.removeItem('opensupport_session');
            }
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        const response = await api.post('/auth/login', { email, password });
        const { user, organization, session } = response;

        localStorage.setItem('opensupport_session', JSON.stringify({
            user,
            organization,
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            expiresAt: session.expiresAt * 1000
        }));

        api.setToken(session.accessToken);
        setUser(user);
        setOrganization(organization);

        return response;
    };

    const signup = async (data) => {
        const response = await api.post('/auth/signup', data);
        const { user, organization, session } = response;

        localStorage.setItem('opensupport_session', JSON.stringify({
            user,
            organization,
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            expiresAt: session.expiresAt * 1000
        }));

        api.setToken(session.accessToken);
        setUser(user);
        setOrganization(organization);

        return response;
    };

    const logout = async () => {
        try {
            await api.post('/auth/logout');
        } catch (e) {
            // Ignore logout errors
        }
        localStorage.removeItem('opensupport_session');
        api.setToken(null);
        setUser(null);
        setOrganization(null);
    };

    const value = {
        user,
        organization,
        loading,
        login,
        signup,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
