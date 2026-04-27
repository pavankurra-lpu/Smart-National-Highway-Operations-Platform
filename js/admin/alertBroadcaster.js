// Admin Alert Broadcaster

const AlertBroadcaster = {
    init: () => {
        const btn = document.getElementById('btn-broadcast');
        if (btn) {
            btn.addEventListener('click', () => {
                const type = document.getElementById('bc-type').value;
                const region = document.getElementById('bc-region').value;
                const title = document.getElementById('bc-title').value;
                const msg = document.getElementById('bc-msg').value;

                if (!title || !msg) {
                    Utils.showToast("Please enter a title and message.", "error");
                    return;
                }

                Storage.addAdminAlert({ type, title, message: msg, region });
                Utils.showToast(`Alert pushed to ${region === 'ALL' ? 'all' : region} portals!`);
                
                document.getElementById('bc-title').value = '';
                document.getElementById('bc-msg').value = '';
            });
        }
    }
};

window.AlertBroadcaster = AlertBroadcaster;
