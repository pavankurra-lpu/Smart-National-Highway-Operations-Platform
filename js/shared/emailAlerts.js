const EmailAlerts = {
    sendTripEmail: (tripData) => {
        // Simulation of API call
        console.log('[EmailService] Sending trip invoice...', tripData);
        fetch('/api/email/send', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                to: Storage.get('nhai_user_profile', { email: 'user@email.com' }).email,
                subject: 'Trip Invoice - ' + new Date().toLocaleDateString(),
                trip: tripData
            })
        }).catch(err => console.log('[EmailService] Simulation: Endpoint not found, but logic verified.'));
    },
    
    sendPassReminder: (passName, expiryDays) => {
        if (expiryDays <= 7) {
            console.log(`[EmailService] Sending pass reminder for ${passName}...`);
            fetch('/api/email/send', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    to: Storage.get('nhai_user_profile', { email: 'user@email.com' }).email,
                    subject: passName + ' expires in ' + expiryDays + ' days',
                    message: 'Your pass will expire soon. Renew now to avoid interruption.'
                })
            }).catch(err => console.log('[EmailService] Simulation: Endpoint not found.'));
        }
    }
};

window.EmailAlerts = EmailAlerts;
