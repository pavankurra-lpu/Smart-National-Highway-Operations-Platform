// Common Utility Functions

const Utils = {
    generateId: (prefix = 'ID') => {
        return `${prefix}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    },

    formatCurrency: (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    },

    formatDateTime: (timestamp) => {
        if (!timestamp) return 'N/A';
        const d = new Date(timestamp);
        return d.toLocaleString('en-IN', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    },

    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    showToast: (message, type = 'success') => {
        let container = document.querySelector('.shadcn-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'shadcn-toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `shadcn-toast toast-${type}`;

        const icons = {
            success: { class: 'fa-circle-check', color: 'var(--primary)' },
            error:   { class: 'fa-circle-exclamation', color: 'var(--accent-red)' },
            warning: { class: 'fa-triangle-exclamation', color: 'var(--accent-yellow)' },
            info:    { class: 'fa-circle-info', color: 'var(--accent-blue)' }
        };
        const s = icons[type] || icons.success;

        // Parse message: "Title: Description"
        let title = 'System Update';
        let desc = message;
        if (message.includes(':')) {
            const parts = message.split(':');
            title = parts[0].trim();
            desc = parts.slice(1).join(':').trim();
        } else {
            // Give custom titles depending on type
            if (type === 'success') title = 'Action Successful';
            else if (type === 'error') title = 'Access Denied / Error';
            else if (type === 'warning') title = 'System Alert';
            else if (type === 'info') title = 'Notice';
        }

        toast.innerHTML = `
            <div class="shadcn-toast-icon"><i class="fa-solid ${s.class}" style="color: ${s.color}"></i></div>
            <div class="shadcn-toast-content">
                <div class="shadcn-toast-title">${title}</div>
                <div class="shadcn-toast-description">${desc}</div>
            </div>
            <button class="shadcn-toast-close"><i class="fa-solid fa-xmark"></i></button>
        `;

        container.appendChild(toast);

        // Dismiss action
        const dismiss = () => {
            if (typeof Motion !== 'undefined') {
                Motion.animate(toast, { opacity: 0, scale: 0.9, y: 10 }, { duration: 0.2 }).then(() => toast.remove());
            } else {
                toast.style.opacity = '0';
                toast.style.transform = 'scale(0.9) translateY(10px)';
                setTimeout(() => toast.remove(), 250);
            }
        };

        toast.querySelector('.shadcn-toast-close').addEventListener('click', dismiss);

        // Entry animation
        if (typeof Motion !== 'undefined') {
            toast.style.opacity = '0';
            toast.style.transform = 'scale(0.9) translateY(15px)';
            Motion.animate(
                toast, 
                { opacity: [0, 1], scale: [0.9, 1], y: [15, 0] }, 
                { duration: 0.35, easing: [0.34, 1.56, 0.64, 1] }
            );
        } else {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease-out';
            setTimeout(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateY(0)';
            }, 50);
        }

        // Auto dismiss
        setTimeout(() => {
            if (toast.parentNode) dismiss();
        }, 4500);
    },


    toggleVisibility: (elementId, show) => {
        const el = document.getElementById(elementId);
        if (el) {
            if (el.classList.contains('drawer-overlay')) {
                if (show) el.classList.add('active');
                else el.classList.remove('active');
            } else {
                if (show) el.classList.remove('hidden');
                else el.classList.add('hidden');
            }
        }
    },

    toggleCommandPalette: (show) => {
        const overlay = document.getElementById('command-palette-overlay');
        if (overlay) {
            if (show) {
                overlay.classList.add('active');
                setTimeout(() => document.getElementById('cmd-input')?.focus(), 100);
            } else {
                overlay.classList.remove('active');
            }
        }
    },

    escapeHtml: (str) => {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
};

window.Utils = Utils;

// Global hotkeys (Command Palette ⌘K / Ctrl+K)
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        Utils.toggleCommandPalette(true);
    }
    if (e.key === 'Escape') {
        Utils.toggleCommandPalette(false);
    }
});
