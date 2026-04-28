// Handles Receiving Admin Broadcasts

const Notifications = {
    init: () => {
        Notifications.updateAdvisory();

        // Listen for storage changes to see if admin pushed an alert
        window.addEventListener('local-storage-update', () => {
            Notifications.updateAdvisory();
        });
        
        // Auto rotate active alerts if multiple
        setInterval(() => {
            if (Notifications.activeAlerts.length > 1) {
                Notifications.currentIndex = (Notifications.currentIndex + 1) % Notifications.activeAlerts.length;
                Notifications.renderCurrent();
            }
        }, 5000);
    },

    activeAlerts: [],
    currentIndex: 0,

    updateAdvisory: () => {
        const alerts = Storage.get(Storage.KEYS.ADMIN_ALERTS, []);
        // Only consider alerts from last 2 hours as active for simulation
        const now = new Date().getTime();
        
        let currentState = 'ALL';
        if (window.IndiaMapPlanner && IndiaMapPlanner.selectedOrigin && IndiaMapPlanner.selectedOrigin.state) {
            currentState = IndiaMapPlanner.selectedOrigin.state;
        }

        const newAlerts = alerts.filter(a => {
            const at = new Date(a.timestamp).getTime();
            const isRecent = (now - at) < (2 * 60 * 60 * 1000);
            const isTargeted = (!a.region || a.region === 'ALL' || a.region === currentState);
            return isRecent && isTargeted;
        });

        // If we found a new alert that wasn't in our active list, notify
        if (newAlerts.length > Notifications.activeAlerts.length) {
            const latest = newAlerts[0];
            if (window.PushNotifications) {
                PushNotifications.sendNotification(`NHAI: ${latest.title}`, latest.message);
            }
        }

        Notifications.activeAlerts = newAlerts;

        const panel = document.getElementById('admin-broadcasts-panel');
        if (Notifications.activeAlerts.length > 0) {
            if (panel) panel.classList.remove('hidden');
            if(Notifications.currentIndex >= Notifications.activeAlerts.length) {
                Notifications.currentIndex = 0;
            }
            Notifications.renderCurrent();
        } else {
            if (panel) panel.classList.add('hidden');
        }
    },

    renderCurrent: () => {
        if (Notifications.activeAlerts.length === 0) return;
        const alert = Notifications.activeAlerts[Notifications.currentIndex];
        
        const typeIcons = {
            'TRAFFIC': '<i class="fa-solid fa-car-burst" style="color:var(--accent-yellow)"></i>',
            'WEATHER': '<i class="fa-solid fa-cloud-showers-heavy" style="color:#3b82f6"></i>',
            'EMERGENCY': '<i class="fa-solid fa-triangle-exclamation" style="color:var(--accent-red)"></i>',
            'INFO': '<i class="fa-solid fa-circle-info" style="color:var(--primary)"></i>'
        };

        const icon = typeIcons[alert.type] || typeIcons['INFO'];
        
        const advisory = document.getElementById('advisory-text');
        if (advisory) {
            advisory.innerHTML = `
                <div style="margin-bottom: 4px; font-weight:bold; color:#fff;">
                    ${icon} ${alert.title}
                </div>
                <div>${alert.message}</div>
                <div style="font-size:9px; color:rgba(255,255,255,0.4); margin-top:4px;">
                    Broadcasted: ${Utils.formatDateTime(alert.timestamp)}
                </div>
            `;
        }
    }
};

window.Notifications = Notifications;
