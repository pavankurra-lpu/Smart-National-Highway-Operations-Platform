const EmailAlerts = {
    sendTripEmail: (tripData) => {
        const backendUrl = window.NHAI_CONFIG?.backend?.url || 'https://smart-national-highway-operations.onrender.com';
        fetch(`${backendUrl}/api/email/send`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                to: Storage.get('nhai_user_profile', { email: 'user@email.com' }).email,
                subject: 'Trip Invoice - ' + new Date().toLocaleDateString(),
                trip: tripData
            })
        }).catch(() => {});
    },
    
    sendPassReminder: (passName, expiryDays) => {
        if (expiryDays <= 7) {
            const backendUrl = window.NHAI_CONFIG?.backend?.url || 'https://smart-national-highway-operations.onrender.com';
            fetch(`${backendUrl}/api/email/send`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    to: Storage.get('nhai_user_profile', { email: 'user@email.com' }).email,
                    subject: passName + ' expires in ' + expiryDays + ' days',
                    message: 'Your pass will expire soon. Renew now to avoid interruption.'
                })
            }).catch(() => {});
        }
    }
};

window.EmailAlerts = EmailAlerts;
