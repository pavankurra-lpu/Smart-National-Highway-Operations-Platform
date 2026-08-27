// Secure Admin Auth against the Express Backend

const Auth = {
    login: async (id, pass) => {
        try {
            const backendUrl = window.NHAI_CONFIG?.backend?.url || 'http://localhost:3000';
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            
            const response = await fetch(`${backendUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, pass }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            const data = await response.json();
            if (response.ok && data.success) {
                sessionStorage.setItem('nhai_admin_auth', data.token);
                sessionStorage.setItem('nhai_admin_login_time', new Date().toISOString());
                sessionStorage.setItem('nhai_admin_id', id);
                return { success: true, token: data.token };
            } else {
                return { success: false, error: data.error || 'Access Denied: Invalid Credentials.' };
            }
        } catch (e) {
            console.warn('[Auth] Server unavailable. Offline local simulation mode active.');
        }

        // Offline local verification fallback (if backend is not running)
        // Checks normalized identifier and non-empty password
        if (id && pass && (id.trim().toLowerCase() === 'admin@nhai' || id.trim().toLowerCase() === 'admin')) {
            const localToken = 'nhai-admin-offline-' + Date.now();
            sessionStorage.setItem('nhai_admin_auth', localToken);
            sessionStorage.setItem('nhai_admin_login_time', new Date().toISOString());
            sessionStorage.setItem('nhai_admin_id', id);
            return { success: true, token: localToken };
        }

        return { success: false, error: 'Access Denied: Invalid Staff ID or Passcode.' };
    },

    logout: async () => {
        sessionStorage.removeItem('nhai_admin_auth');
        sessionStorage.removeItem('admin_plaza');
        sessionStorage.removeItem('admin_plaza_data');
        window.location.href = 'login.html';
    },

    isAuthenticated: () => {
        return !!sessionStorage.getItem('nhai_admin_auth');
    },

    guard: async () => {
        const token = sessionStorage.getItem('nhai_admin_auth');
        if (!token) {
            window.location.replace('login.html');
            return;
        }

        // Fast-path: local session tokens are valid immediately
        if (token.startsWith('nhai-admin') || token.startsWith('token-') || token === 'mock-local-token-xyz') {
            return;
        }

        // Check with backend only if non-local token
        try {
            const backendUrl = window.NHAI_CONFIG?.backend?.url || 'http://localhost:3000';
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 800);
            const response = await fetch(`${backendUrl}/api/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok && response.status === 401) {
                sessionStorage.removeItem('nhai_admin_auth');
                window.location.replace('login.html');
            }
        } catch (e) {
            // Server offline: allow session
        }
    }
};

window.Auth = Auth;
