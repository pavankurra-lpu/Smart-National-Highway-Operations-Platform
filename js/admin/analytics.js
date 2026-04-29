// Admin Analytics and Overview logic

const Analytics = {
    init: () => {
        Analytics.refresh();
    },

    refresh: () => {
        const logs = Storage.get(Storage.KEYS.VEHICLE_LOGS, []);
        
        let revenue = 0;
        let count = logs.length;
        
        const tbody = document.querySelector('#analytics-table tbody');
        let html = '';

        logs.forEach(log => {
            revenue += (log.cost || 0);
            const status = log.status || 'COMPLETED';
            const statusColor = status === 'ACTIVE' ? 'color: #10b981; font-weight:bold;' : 'color: var(--primary);';
            let rowColor = log.isSpecial ? 'color: var(--accent-yellow);' : '';
            html += `
                <tr style="${rowColor}">
                    <td style="font-size: 11px;">${log.id}</td>
                    <td>${log.origin} → ${log.dest}</td>
                    <td>${log.vehicleType}</td>
                    <td>${(log.tollsPassed || []).length}</td>
                    <td>${Utils.formatCurrency(log.cost || 0)}</td>
                    <td style="font-size: 11px; ${statusColor}">${status}</td>
                    <td style="font-size: 11px; color: var(--text-sec);">${Utils.formatDateTime(log.timestamp)}</td>
                </tr>
            `;
        });

        // Top level stats
        const statVehicles = document.getElementById('stat-vehicles');
        const statRevenue = document.getElementById('stat-revenue');
        if (statVehicles) statVehicles.innerText = count;
        if (statRevenue) statRevenue.innerText = Utils.formatCurrency(revenue);
        
        if (tbody) {
            tbody.innerHTML = html.length ? html : '<tr><td colspan="7" style="text-align:center;">No vehicle logs yet. Trips will appear when travellers start journeys.</td></tr>';
        }

        // Active incidents stat
        const incidents = Storage.get(Storage.KEYS.EMERGENCIES, []);
        const activeCount = incidents.filter(i => ['RAISED', 'ACKNOWLEDGED', 'DISPATCHED'].includes(i.status)).length;
        const statIncidents = document.getElementById('stat-incidents');
        if (statIncidents) statIncidents.innerText = activeCount;
    }
};

window.Analytics = Analytics;
