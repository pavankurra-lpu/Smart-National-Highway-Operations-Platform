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
        const toast = document.createElement('div');
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.padding = '12px 24px';
        toast.style.borderRadius = '8px';
        toast.style.background = type === 'success' ? '#020c1b' : '#330000';
        toast.style.color = type === 'success' ? '#64ffda' : '#ff5e5e';
        toast.style.border = `1px solid ${type === 'success' ? '#64ffda' : '#ff5e5e'}`;
        toast.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
        toast.style.zIndex = '99999';
        toast.style.transform = 'translateY(100px)';
        toast.style.opacity = '0';
        toast.style.transition = 'all 0.3s ease';
        toast.innerText = message;

        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateY(0)';
            toast.style.opacity = '1';
        }, 100);

        // Remove
        setTimeout(() => {
            toast.style.transform = 'translateY(100px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
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
