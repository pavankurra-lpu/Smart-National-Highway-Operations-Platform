// Secure Admin Auth against the Express Backend

const Auth = {
    login: async (id, pass) => {
        try {
            const response = await fetch('http://localhost:3000/api/auth/login', {
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
            console.error('[Auth] Server login request failed:', e);
        }
        return false;
    },

    logout: async () => {
        const token = sessionStorage.getItem('nhai_admin_auth');
        if (token) {
            try {
                await fetch('http://localhost:3000/api/auth/logout', {
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

        // Securely verify token with backend
        try {
            const response = await fetch('http://localhost:3000/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });

            if (!response.ok) {
                sessionStorage.removeItem('nhai_admin_auth');
                window.location.replace('login.html');
            }
        } catch (e) {
            console.warn('[Auth] Server verify offline, allowing local fallback.');
        }
    }
};

window.Auth = Auth;
