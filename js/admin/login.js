// Login Form Handler

document.addEventListener('DOMContentLoaded', () => {
    // If already logged in, redirect to index
    if (Auth.isAuthenticated()) {
        window.location.href = 'index.html';
    }

    const form = document.getElementById('login-form');
    const errorEl = document.getElementById('login-error');

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const id = document.getElementById('admin-id').value;
            const pass = document.getElementById('admin-pass').value;

            // Simple visual delay for realism
            const btn = form.querySelector('button');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> VERIFYING...';
            btn.disabled = true;

            setTimeout(() => {
                if (Auth.login(id, pass)) {
                    window.location.href = 'index.html';
                } else {
                    errorEl.innerText = "ACCESS DENIED. Invalid Credentials.";
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            }, 800);
        });
    }
});
