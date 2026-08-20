// Theme Manager — NHAI Platform v2.0

const ThemeManager = {
    init: () => {
        const savedTheme = localStorage.getItem('nhai_theme') || 'dark';
        ThemeManager._applyTheme(savedTheme);

        document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
            btn.addEventListener('click', ThemeManager.toggle);
        });

        // Kokonut UI: Spotlight hover coordinate tracker with delegation
        document.addEventListener('mousemove', (e) => {
            const card = e.target.closest('.spotlight-card');
            if (!card) return;
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });

        // Cross-tab sync
        window.addEventListener('storage', e => {
            if (e.key === 'nhai_theme') ThemeManager._applyTheme(e.newValue || 'dark');
        });
    },

    toggle: () => {
        const isLight  = document.body.classList.contains('light-mode');
        const newTheme = isLight ? 'dark' : 'light';
        ThemeManager._applyTheme(newTheme);
        localStorage.setItem('nhai_theme', newTheme);
    },

    _applyTheme: (theme) => {
        if (theme === 'light') {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
        ThemeManager._updateIcons(theme);
    },

    _updateIcons: (theme) => {
        document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
            // Use sun icon in dark mode (click → go light), moon in light mode (click → go dark)
            const icon = theme === 'light' ? 'fa-moon' : 'fa-sun';
            btn.innerHTML = `<i class="fa-solid ${icon}"></i>`;
            btn.title = theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode';
        });
    }
};

window.ThemeManager = ThemeManager;
