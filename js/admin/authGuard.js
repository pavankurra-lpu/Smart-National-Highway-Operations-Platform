const getAdminLoginPath = () => {
    const loc = window.location.pathname;
    if (loc.includes('/admin/')) {
        return loc.substring(0, loc.lastIndexOf('/admin/') + 7) + 'login.html';
    }
    if (loc.endsWith('/admin')) {
        return loc + '/login.html';
    }
    return '/admin/login.html';
};

if (!sessionStorage.getItem('nhai_admin_auth')) {
    window.location.replace(getAdminLoginPath());
} else {
    const style = document.createElement('style');
    style.id = 'auth-guard-style';
    style.innerHTML = 'body { opacity: 0 !important; }';
    document.head.appendChild(style);

    const revealUI = () => {
        const s = document.getElementById('auth-guard-style');
        if (s) s.remove();
    };

    if (window.Auth && Auth.guard) {
        Auth.guard().then(() => {
            revealUI();
        }).catch(() => {
            revealUI();
            window.location.replace(getAdminLoginPath());
        });
    } else {
        revealUI();
    }
}

window.logoutAdmin = () => {
    if (window.Auth && Auth.logout) {
        Auth.logout();
    } else {
        sessionStorage.removeItem('nhai_admin_auth');
        window.location.href = getAdminLoginPath();
    }
};
