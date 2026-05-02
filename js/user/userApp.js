// Main entry point for User Application

const UserApp = {
    init: () => {
        // Tab Switching Logic
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-tab');
                
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));

                btn.classList.add('active');
                const targetEl = document.getElementById(target);
                if (targetEl) targetEl.classList.add('active');

                // Special handling for analytics chart rendering
                if (target === 'tab-analytics' && window.TripAnalytics) {
                    TripAnalytics.init();
                }
            });
        });

        // Initialize Services with error boundaries
        try { ThemeManager.init(); } catch(e) { console.error('ThemeManager init error:', e); }
        try { EntryScreen.init(); } catch(e) { console.error('EntryScreen init error:', e); }
        try { UserProfile.init(); } catch(e) { console.error('UserProfile init error:', e); }
        try { VehicleGarage.init(); } catch(e) { console.error('VehicleGarage init error:', e); }
        try { IndiaMapPlanner.init(); } catch(e) { console.error('IndiaMapPlanner init error:', e); }
        try { FastagEngine.init(); } catch(e) { console.error('FastagEngine init error:', e); }
        try { EmergencyReporter.init(); } catch(e) { console.error('EmergencyReporter init error:', e); }
        try { Notifications.init(); } catch(e) { console.error('Notifications init error:', e); }
    }
};

// Bootstrap when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    UserApp.init();
});
