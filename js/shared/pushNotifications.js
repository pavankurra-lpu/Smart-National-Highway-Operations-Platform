const PushNotifications = {
    init: () => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js')
                .catch(err => console.warn('Service worker not registered:', err.message));
        }
        
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    },
    
    sendNotification: (title, message) => {
        if (Notification.permission === 'granted') {
            new Notification(title, {
                body: message,
                icon: '/assets/icon.png'
            });
        }
    },
    
    notifyTollAhead: (plazaName) => {
        PushNotifications.sendNotification(
            '🚗 Toll Ahead',
            plazaName + ' - Check FASTag balance'
        );
    },
    
    notifyLowBalance: (balance) => {
        PushNotifications.sendNotification(
            '⚠️ Low Balance',
            'FASTag balance: ₹' + balance + ' - Recharge soon'
        );
    }
};

window.PushNotifications = PushNotifications;
document.addEventListener('DOMContentLoaded', () => PushNotifications.init());
