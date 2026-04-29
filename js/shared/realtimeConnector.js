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
            Utils.showToast("Real-time Network Active", "success");
        });

        // Listen for global admin broadcasts
        RealtimeService.socket.on('broadcast-alert', (alert) => {
            console.log('[Realtime] Received Broadcast:', alert);
            if (window.Notifications) {
                // Deduplicate: only add if this alert ID doesn't already exist
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
