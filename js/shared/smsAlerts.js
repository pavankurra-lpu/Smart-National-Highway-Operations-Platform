const SMSAlerts = {
    sendSMS: (phoneNumber, message) => {
        const backendUrl = window.NHAI_CONFIG?.backend?.url || 'https://smart-national-highway-operations.onrender.com';
        fetch(`${backendUrl}/api/sms/send`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                phone: phoneNumber,
                message: message
            })
        }).catch(() => {});
    },
    
    alertTollAhead: (phone, plazaName) => {
        SMSAlerts.sendSMS(phone, 'Toll ahead: ' + plazaName + '. Check FASTag balance.');
    },
    
    alertLowBalance: (phone, balance) => {
        SMSAlerts.sendSMS(phone, 'FASTag balance: ₹' + balance + '. Recharge now!');
    }
};

window.SMSAlerts = SMSAlerts;
