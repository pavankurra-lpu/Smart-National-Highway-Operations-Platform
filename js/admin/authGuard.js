// Enforce Authentication

// Place this script at the VERY TOP of the admin/index.html <head>
if (!sessionStorage.getItem('nhai_admin_auth')) {
    // Immediate redirect before DOM loads to prevent flash of content
    window.location.replace('login.html');
}

// Bind logout functions globally if loaded
window.logoutAdmin = () => {
    sessionStorage.removeItem('nhai_admin_auth');
    window.location.replace('login.html');
};
