// Enforce Authentication
if (!sessionStorage.getItem('nhai_admin_auth')) {
    // Immediate redirect before DOM loads to prevent flash of content
    window.location.replace('login.html');
} else {
    // Hide body until verification resolves to prevent flash of unauthorized UI
    const style = document.createElement('style');
    style.innerHTML = 'body { display: none !important; }';
    document.head.appendChild(style);

    // Validate session token with backend server
    Auth.guard().then(() => {
        style.remove();
    }).catch(() => {
        window.location.replace('login.html');
    });
}

// Bind logout functions globally if loaded
window.logoutAdmin = () => {
    Auth.logout();
};
