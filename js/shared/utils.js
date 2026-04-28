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
        const colors = {
            success: 'var(--primary)',
            error:   'var(--accent-red)',
            warning: '#fcd34d',
            info:    '#3b82f6'
        };
        const icons = {
            success: '<i class="fa-solid fa-circle-check"></i>',
            error:   '<i class="fa-solid fa-circle-exclamation"></i>',
            warning: '<i class="fa-solid fa-triangle-exclamation"></i>',
            info:    '<i class="fa-solid fa-circle-info"></i>'
        };
        const color = colors[type] || colors.success;
        const iconStr  = icons[type]  || icons.success;

        const toast = document.createElement('div');
        Object.assign(toast.style, {
            position: 'fixed', bottom: '30px', right: '30px',
            padding: '16px 28px', borderRadius: 'var(--radius)',
            background: 'var(--bg-panel)', backdropFilter: 'var(--glass)',
            color: color,
            border: `1px solid ${type === 'success' ? 'var(--border)' : color}`,
            boxShadow: 'var(--shadow-lg)', zIndex: '99999',
            transform: 'translateX(100px)', opacity: '0',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '12px'
        });
        
        toast.innerHTML = `${iconStr} <span>${message}</span>`;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        }, 100);

        setTimeout(() => {
            toast.style.transform = 'translateX(100px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    },


    toggleVisibility: (elementId, show) => {
        const el = document.getElementById(elementId);
        if (el) {
            if (show) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    }
};

window.Utils = Utils;
