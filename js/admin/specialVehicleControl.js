// VIP and Priority Vehicle Logs logic for Admin

const SpecialVehicleControl = {
    init: () => {
        SpecialVehicleControl.refresh();
    },

    refresh: () => {
        const logs = Storage.get(Storage.KEYS.VEHICLE_LOGS, []);
        const tbody = document.getElementById('vip-table-body');
        if (!tbody) return;

        // Filter only special vehicles
        const vipLogs = logs.filter(l => l.isSpecial);
        
        let html = '';
        vipLogs.slice(0, 50).forEach(log => { // Last 50 vips
            html += `
                <tr>
                    <td style="font-size: 11px; font-weight:bold; color:var(--primary);">${log.id}</td>
                    <td>${log.vehicleType}</td>
                    <td>${log.tollsPassed.length}</td>
                    <td style="font-size: 11px; color: var(--text-sec);">${Utils.formatDateTime(log.timestamp)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html.length ? html : '<tr><td colspan="4" style="text-align:center;">No pre-registered VIP vehicles passed recently.</td></tr>';
    }
};

window.SpecialVehicleControl = SpecialVehicleControl;
