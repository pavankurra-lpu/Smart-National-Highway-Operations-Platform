// Enforce Authentication
if (!sessionStorage.getItem('nhai_admin_auth')) {
    window.location.replace('login.html');
} else {
    // Hide body briefly while checking to prevent flash of content
    const style = document.createElement('style');
    style.id = 'auth-guard-style';
    style.innerHTML = 'body { opacity: 0 !important; }';
    document.head.appendChild(style);

    const revealUI = () => {
        const s = document.getElementById('auth-guard-style');
        if (s) s.remove();
    };

    // Failsafe timer so UI is NEVER permanently hidden
    setTimeout(revealUI, 150);

    if (window.Auth && Auth.guard) {
        Auth.guard().then(() => {
            revealUI();
        }).catch(() => {
            revealUI();
            window.location.replace('login.html');
        });
    } else {
        revealUI();
    }
}

// Bind logout functions globally if loaded
window.logoutAdmin = () => {
    if (window.Auth && Auth.logout) {
        Auth.logout();
    } else {
        sessionStorage.removeItem('nhai_admin_auth');
        window.location.href = 'login.html';
    }
};
