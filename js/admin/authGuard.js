// Enforce Authentication
if (!sessionStorage.getItem('nhai_admin_auth')) {
    // Immediate redirect before DOM loads to prevent flash of content
    window.location.replace('login.html');
} else {
    // Validate session token with backend server
    Auth.guard();
}

// Bind logout functions globally if loaded
window.logoutAdmin = () => {
    Auth.logout();
};
