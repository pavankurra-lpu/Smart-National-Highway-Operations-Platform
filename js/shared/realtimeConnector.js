// Frontend Connector for the Real-time Backend
const RealtimeService = {
    socket: null,
    serverUrl: 'http://localhost:3000',

    init: () => {
        // Only attempt connection if Socket.io client library is loaded
        if (typeof io === 'undefined') {
            console.log('[Realtime] Socket.io client not found. Running in offline simulation mode.');
            return;
        }

        RealtimeService.socket = io(RealtimeService.serverUrl);

        RealtimeService.socket.on('connect', () => {
            console.log('[Realtime] Connected to NHAI Live Server');
            Utils.showToast("Live server connected", "success");
            const badge = document.getElementById('connection-status');
            if (badge) { badge.style.color = 'var(--primary)'; badge.title = 'Live server: Connected'; }
        });

        // Listen for global admin broadcasts
        RealtimeService.socket.on('broadcast-alert', (alert) => {
            console.log('[Realtime] Received Broadcast:', alert);
            if (window.Notifications) {
                const currentAlerts = Storage.get(Storage.KEYS.ADMIN_ALERTS, []);
                const alreadyExists = alert.id && currentAlerts.some(a => a.id === alert.id);
                if (!alreadyExists) {
                    currentAlerts.unshift(alert);
                    Storage.set(Storage.KEYS.ADMIN_ALERTS, currentAlerts);
                }
                Notifications.updateAdvisory();
            }
            if (window.PushNotifications) {
                PushNotifications.sendNotification(`NHAI: ${alert.title}`, alert.message);
            }
        });

        RealtimeService.socket.on('disconnect', () => {
            console.log('[Realtime] Disconnected from server');
            Utils.showToast("Live server disconnected — alerts may be delayed", "warning");
            const badge = document.getElementById('connection-status');
            if (badge) { badge.style.color = 'var(--accent-red)'; badge.title = 'Live server: Disconnected'; }
        });

        RealtimeService.socket.on('connect_error', () => {
            const badge = document.getElementById('connection-status');
            if (badge) { badge.style.color = '#fcd34d'; badge.title = 'Live server: Offline'; }
        });
    },

    // Send SOS to server so other admins/users can see
    emitSOS: (sosData) => {
        if (RealtimeService.socket && RealtimeService.socket.connected) {
            RealtimeService.socket.emit('send-sos', sosData);
        }
    },

    // Track position for admin monitoring
    updatePosition: (tripId, lat, lng) => {
        if (RealtimeService.socket && RealtimeService.socket.connected) {
            RealtimeService.socket.emit('update-position', { tripId, lat, lng });
        }
    }
};

window.RealtimeService = RealtimeService;
document.addEventListener('DOMContentLoaded', () => RealtimeService.init());
