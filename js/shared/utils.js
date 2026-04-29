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
        const styles = {
            success: { color: 'var(--primary)',    border: 'var(--primary)',    icon: 'fa-circle-check' },
            error:   { color: 'var(--accent-red)', border: 'var(--accent-red)', icon: 'fa-circle-exclamation' },
            warning: { color: '#fbbf24',           border: '#fbbf24',           icon: 'fa-triangle-exclamation' },
            info:    { color: '#60a5fa',           border: '#60a5fa',           icon: 'fa-circle-info' }
        };
        const s = styles[type] || styles.success;
        
        const toast = document.createElement('div');
        Object.assign(toast.style, {
            position: 'fixed', bottom: '30px', right: '30px',
            padding: '16px 28px', borderRadius: 'var(--radius)',
            background: 'var(--bg-panel)', backdropFilter: 'var(--glass)',
            color: s.color,
            border: `1px solid ${s.border}`,
            boxShadow: 'var(--shadow-lg)', zIndex: '99999',
            transform: 'translateX(100px)', opacity: '0',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '12px'
        });
        toast.innerHTML = `<i class="fa-solid ${s.icon}"></i> <span>${message}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.transform = 'translateX(0)'; toast.style.opacity = '1'; }, 100);
        setTimeout(() => {
            toast.style.transform = 'translateX(100px)'; toast.style.opacity = '0';
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
