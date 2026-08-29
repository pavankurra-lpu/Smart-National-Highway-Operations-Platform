const Auth = {
    login: async (id, pass) => {
        const cleanId = (id || '').trim().toLowerCase();
        const cleanPass = (pass || '').trim();

        const validIds = ['admin@nhai', 'officer@nhai', 'admin', 'nhai@admin', 'admin@nhai.gov.in', 'operator@nhai'];
        const validPasses = ['NHAI@2026', 'nhai@2026', 'admin@2026', 'admin123', 'admin', 'pass@2026'];

        const isStandardCreds = validIds.includes(cleanId) && validPasses.some(p => p.toLowerCase() === cleanPass.toLowerCase());

        const backendUrl = window.NHAI_CONFIG?.backend?.url || 'https://smart-national-highway-operations.onrender.com';

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            
            const response = await fetch(`${backendUrl}/api/auth/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: cleanId, pass: cleanPass }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.token) {
                    sessionStorage.setItem('nhai_admin_auth', data.token);
                    sessionStorage.setItem('nhai_admin_login_time', new Date().toISOString());
                    sessionStorage.setItem('nhai_admin_id', cleanId);
                    return { success: true, token: data.token };
                }
            }
        } catch (e) {
            // Backend offline or sleeping - will fall through to standard credential check
        }

        // Grant seamless access if standard credentials matched
        if (isStandardCreds) {
            const fallbackToken = 'nhai_admin_offline_' + btoa(JSON.stringify({ id: cleanId, role: 'admin', ts: Date.now() }));
            sessionStorage.setItem('nhai_admin_auth', fallbackToken);
            sessionStorage.setItem('nhai_admin_login_time', new Date().toISOString());
            sessionStorage.setItem('nhai_admin_id', cleanId);
            return { success: true, token: fallbackToken };
        }

        return { success: false, error: 'Access Denied: Invalid Staff ID or Passcode (Default: admin@nhai / NHAI@2026).' };
    },

    getAdminLoginUrl: () => {
        const path = window.location.pathname;
        if (path.includes('/admin/')) {
            return path.substring(0, path.indexOf('/admin/') + 7) + 'login.html';
        }
        if (path.endsWith('/admin')) {
            return path + '/login.html';
        }
        return '/admin/login.html';
    },

    logout: async () => {
        sessionStorage.removeItem('nhai_admin_auth');
        sessionStorage.removeItem('admin_plaza');
        sessionStorage.removeItem('admin_plaza_data');
        window.location.href = Auth.getAdminLoginUrl();
    },

    isAuthenticated: () => {
        return !!sessionStorage.getItem('nhai_admin_auth');
    },

    guard: async () => {
        const token = sessionStorage.getItem('nhai_admin_auth');
        if (!token) {
            window.location.replace(Auth.getAdminLoginUrl());
            return;
        }

        if (token.startsWith('nhai_admin_offline_')) {
            return;
        }

        try {
            const backendUrl = window.NHAI_CONFIG?.backend?.url || 'https://smart-national-highway-operations.onrender.com';
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);
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

            if (!response.ok && response.status === 401) {
                sessionStorage.removeItem('nhai_admin_auth');
                window.location.replace('login.html');
            }
        } catch (e) {}
    }
};

window.Auth = Auth;
