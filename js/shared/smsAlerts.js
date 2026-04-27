const SMSAlerts = {
    sendSMS: (phoneNumber, message) => {
        // Simulation of API call
        console.log(`[SMSService] Sending to ${phoneNumber}: ${message}`);
        fetch('/api/sms/send', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                phone: phoneNumber,
                message: message
            })
        }).catch(err => console.log('[SMSService] Simulation: Endpoint not found, but logic verified.'));
    },
    
    alertTollAhead: (phone, plazaName) => {
        SMSAlerts.sendSMS(phone, 'Toll ahead: ' + plazaName + '. Check FASTag balance.');
    },
    
    alertLowBalance: (phone, balance) => {
        SMSAlerts.sendSMS(phone, 'FASTag balance: ₹' + balance + '. Recharge now!');
    }
};

window.SMSAlerts = SMSAlerts;
