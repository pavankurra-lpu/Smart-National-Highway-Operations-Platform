// Secure Admin Auth against the Express Backend

const Auth = {
    login: async (id, pass) => {
        const defaultCreds = { id: 'admin@nhai', pass: 'NHAI@2026' };
        try {
            const backendUrl = window.NHAI_CONFIG?.backend?.url || 'http://localhost:3000';
            const response = await fetch(`${backendUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, pass })
            });

            if (response.ok) {
                const data = await response.json();
                sessionStorage.setItem('nhai_admin_auth', data.token);
                sessionStorage.setItem('nhai_admin_login_time', new Date().toISOString());
                return true;
            }
        } catch (e) {
            console.error('[Auth] Server login request failed, trying offline fallback:', e);
        }

        // Client-side offline fallback
        if (id === defaultCreds.id && pass === defaultCreds.pass) {
            console.log('[Auth] Authenticated via offline local credentials fallback.');
            sessionStorage.setItem('nhai_admin_auth', 'mock-local-token-xyz');
            sessionStorage.setItem('nhai_admin_login_time', new Date().toISOString());
            return true;
        }

        return false;
    },

    logout: async () => {
        const token = sessionStorage.getItem('nhai_admin_auth');
        if (token && token !== 'mock-local-token-xyz') {
            try {
                const backendUrl = window.NHAI_CONFIG?.backend?.url || 'http://localhost:3000';
                await fetch(`${backendUrl}/api/auth/logout`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token })
                });
            } catch (e) {
                console.error('[Auth] Server logoff request failed:', e);
            }
        }
        sessionStorage.removeItem('nhai_admin_auth');
        window.location.href = 'login.html';
    },

    isAuthenticated: () => {
        // Fast synchronous check of session token presence
        return !!sessionStorage.getItem('nhai_admin_auth');
    },

    guard: async () => {
        const token = sessionStorage.getItem('nhai_admin_auth');
        if (!token) {
            window.location.replace('login.html');
            return;
        }

        // If local offline fallback token is active, bypass backend request
        if (token === 'mock-local-token-xyz') {
            return;
        }

        // Securely verify token with backend
        try {
            const backendUrl = window.NHAI_CONFIG?.backend?.url || 'http://localhost:3000';
            const response = await fetch(`${backendUrl}/api/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });

            if (!response.ok) {
                sessionStorage.removeItem('nhai_admin_auth');
                window.location.replace('login.html');
            }
        } catch (e) {
            console.warn('[Auth] Server verify failed or offline. Allowing local session bypass.', e);
        }
    }
};

window.Auth = Auth;
