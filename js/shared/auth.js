// Admin Auth Simulation via sessionStorage

const Auth = {
    CREDENTIALS: {
        id: 'admin@nhai',
        pass: 'NHAI@2026'
    },

    login: (id, pass) => {
        if (id === Auth.CREDENTIALS.id && pass === Auth.CREDENTIALS.pass) {
            sessionStorage.setItem('nhai_admin_auth', 'authenticated');
            sessionStorage.setItem('nhai_admin_login_time', new Date().toISOString());
            return true;
        }
        return false;
    },

    logout: () => {
        sessionStorage.removeItem('nhai_admin_auth');
        window.location.href = 'login.html';
    },

    isAuthenticated: () => {
        return sessionStorage.getItem('nhai_admin_auth') === 'authenticated';
    },

    guard: () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
        }
    }
};

window.Auth = Auth;
