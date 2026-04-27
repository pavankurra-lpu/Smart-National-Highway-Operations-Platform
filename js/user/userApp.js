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
                document.getElementById(target).classList.add('active');
            });
        });

        // Initialize Services
        ThemeManager.init();
        EntryScreen.init();
        IndiaMapPlanner.init();
        FastagEngine.init();
        EmergencyReporter.init();
        Notifications.init();

        // Welcome Message
        setTimeout(() => {
            Utils.showToast("Connected to LIVE SNHOP SERVER.", "success");
        }, 2000);
    }
};

// Bootstrap when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    UserApp.init();
});
