// Secure Admin Auth against the Express Backend
const Auth = {
    login: async (id, pass) => {
        const backendUrl = window.NHAI_CONFIG?.backend?.url || 'https://smart-national-highway-operations.onrender.com';
        
        try {
            const controller = new AbortController();
            // 15s timeout to allow Render free tier wake-up from cold sleep
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch(`${backendUrl}/api/auth/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, pass }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            const data = await response.json();
            if (response.ok && data.success && data.token) {
                sessionStorage.setItem('nhai_admin_auth', data.token);
                sessionStorage.setItem('nhai_admin_login_time', new Date().toISOString());
                sessionStorage.setItem('nhai_admin_id', id);
                return { success: true, token: data.token };
            } else {
                return { success: false, error: data.error || 'Access Denied: Invalid Staff ID or Passcode.' };
            }
        } catch (e) {
            console.error('[Auth] Server authentication error:', e);
            if (e.name === 'AbortError') {
                return { success: false, error: 'Authentication timeout: Live server is waking up. Please retry in 5 seconds.' };
            }
            return { success: false, error: 'Access Denied: Unable to reach authentication server. Please check internet connection.' };
        }
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

        // Verify token with backend server
        try {
            const backendUrl = window.NHAI_CONFIG?.backend?.url || 'https://smart-national-highway-operations.onrender.com';
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(`${backendUrl}/api/auth/admin/verify`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ token }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                sessionStorage.removeItem('nhai_admin_auth');
                window.location.replace('login.html');
            }
        } catch (e) {
            // If offline or network glitch, do not log out immediately if token exists
            console.warn('[Auth Guard] Could not verify token with backend:', e.message);
        }
    }
};

window.Auth = Auth;
