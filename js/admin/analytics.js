// Admin Analytics and Overview logic

const Analytics = {
    init: () => {
        Analytics.refresh();
    },

    refresh: () => {
        const logs = Storage.get(Storage.KEYS.VEHICLE_LOGS, []);
        
        let revenueToday = 0;
        let revenueMonth = 0;
        let revenueYear = 0;
        
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

        logs.forEach(log => {
            const cost = log.cost || 0;
            const time = new Date(log.timestamp).getTime();
            
            if (time >= startOfDay) revenueToday += cost;
            if (time >= startOfMonth) revenueMonth += cost;
            if (time >= startOfYear) revenueYear += cost;
        });

        const elToday = document.getElementById('stat-revenue-today');
        const elMonth = document.getElementById('stat-revenue-month');
        const elYear = document.getElementById('stat-revenue-year');
        
        if (elToday) elToday.innerText = Utils.formatCurrency(revenueToday);
        if (elMonth) elMonth.innerText = Utils.formatCurrency(revenueMonth);
        if (elYear) elYear.innerText = Utils.formatCurrency(revenueYear);

        // Active incidents stat
        const incidents = Storage.get(Storage.KEYS.EMERGENCIES, []);
        const activeCount = incidents.filter(i => ['RAISED', 'ACKNOWLEDGED', 'DISPATCHED'].includes(i.status)).length;
        const statIncidents = document.getElementById('stat-incidents');
        if (statIncidents) statIncidents.innerText = activeCount;
    }
};

window.Analytics = Analytics;
