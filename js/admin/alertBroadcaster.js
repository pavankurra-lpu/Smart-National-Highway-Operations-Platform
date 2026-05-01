// Admin Alert Broadcaster

const AlertBroadcaster = {
    init: () => {
        const btn = document.getElementById('btn-broadcast');
        if (btn) {
            btn.addEventListener('click', () => {
                const type   = document.getElementById('bc-type').value;
                const region = document.getElementById('bc-region').value;
                const title  = document.getElementById('bc-title').value;
                const msg    = document.getElementById('bc-msg').value;

                if (!title || !msg) {
                    Utils.showToast("Please enter a title and message.", "error");
                    return;
                }

                const alertPayload = {
                    id:        Utils.generateId('ALT'),
                    type,
                    title,
                    message:   msg,
                    region,
                    timestamp: new Date().toISOString()
                };

                // Write to localStorage (same-device fallback)
                Storage.addAdminAlert(alertPayload);

                // Emit over WebSocket so users on OTHER devices receive it
                if (window.RealtimeService && RealtimeService.socket?.connected) {
                    RealtimeService.socket.emit('admin-broadcast', {
                        token:     window.NHAI_CONFIG?.admin?.socketToken || 'NHAI_ADMIN',
                        alertData: alertPayload
                    });
                    Utils.showToast(`Alert broadcast to all live users in ${region === 'ALL' ? 'India' : region}`, 'success');
                } else {
                    Utils.showToast(`Alert saved. WebSocket offline — only local users will see this.`, 'warning');
                }

                document.getElementById('bc-title').value = '';
                document.getElementById('bc-msg').value = '';
            });
        }
    }
};

window.AlertBroadcaster = AlertBroadcaster;
