// Admin Dashboard Orchestrator

const AdminApp = {
    init: () => {
        // Navigation logic
        const navBtns = document.querySelectorAll('.admin-nav-btn');
        const views = document.querySelectorAll('.view-section');

        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                navBtns.forEach(b => b.classList.remove('active'));
                views.forEach(v => v.classList.remove('active'));
                
                btn.classList.add('active');
                document.getElementById(btn.getAttribute('data-view')).classList.add('active');
            });
        });

        // Initialize features
        ThemeManager.init();
        Analytics.init();
        if(window.CCTVManager) CCTVManager.init();
        CCTVPanel.init();
        IncidentCenter.init();
        TrafficControl.init();
        AlertBroadcaster.init();
        SpecialVehicleControl.init();

        // Listen for user actions dynamically
        window.addEventListener('local-storage-update', () => {
            Analytics.refresh();
            IncidentCenter.refresh();
            SpecialVehicleControl.refresh();
        });
        
        // Change-detection poll: only re-render when data actually changes
        let _lastSyncHash = '';
        setInterval(() => {
            const hash = [
                Storage.get(Storage.KEYS.VEHICLE_LOGS, []).length,
                Storage.get(Storage.KEYS.EMERGENCIES, []).length,
                Storage.get(Storage.KEYS.ADMIN_ALERTS, []).length
            ].join(',');
            if (hash !== _lastSyncHash) {
                _lastSyncHash = hash;
                window.dispatchEvent(new Event('local-storage-update'));
            }
        }, 3000);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AdminApp.init();
});
