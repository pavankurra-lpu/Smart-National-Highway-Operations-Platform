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

        // Initialize Services
        ThemeManager.init();
        EntryScreen.init();
        UserProfile.init();
        VehicleGarage.init();
        IndiaMapPlanner.init();
        FastagEngine.init();
        EmergencyReporter.init();
        Notifications.init();
    }
};

// Bootstrap when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    UserApp.init();
});
