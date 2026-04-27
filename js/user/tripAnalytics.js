const TripAnalytics = {
    chartInstance: null,

    init: () => {
        TripAnalytics.generateReport();
        TripAnalytics.drawChart();
        TripAnalytics.renderTripLog();
    },
    
    generateReport: () => {
        const trips = Storage.get(Storage.KEYS.TRIP_HISTORY, []);
        const totalTrips = trips.length;
        const totalDistance = trips.reduce((sum, t) => sum + (parseFloat(t.totalDistance) || 0), 0);
        const totalCost = trips.reduce((sum, t) => sum + (t.cost || 0), 0);
        
        const tripsEl = document.getElementById('total-trips');
        const distEl = document.getElementById('total-distance');
        const costEl = document.getElementById('total-cost');

        if (tripsEl) tripsEl.innerText = totalTrips;
        if (distEl) distEl.innerText = totalDistance.toFixed(0) + ' km';
        if (costEl) costEl.innerText = '₹' + totalCost.toFixed(2);
    },

    renderTripLog: () => {
        const trips = Storage.get(Storage.KEYS.TRIP_HISTORY, []);
        const listEl = document.getElementById('trip-history-list');
        if (!listEl) return;

        if (trips.length === 0) {
            listEl.innerHTML = '<p style="color:var(--text-muted); font-size:11px; text-align:center; padding:10px;">No trip history yet.</p>';
            return;
        }

        listEl.innerHTML = trips.map(t => {
            const date = new Date(t.timestamp || t.startTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            return `
                <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-light); border-radius: 8px; padding: 12px; transition: all 0.2s ease; cursor: default;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <div>
                            <p style="color: var(--primary); font-size: 11px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 5px;">
                                <i class="fa-solid fa-route"></i> ${t.origin || 'Unknown'} → ${t.dest || 'Unknown'}
                            </p>
                            <p style="color: var(--text-muted); font-size: 9px; margin: 2px 0 0;">${date}</p>
                        </div>
                        <div style="text-align: right;">
                            <p style="color: var(--accent-yellow); font-size: 12px; font-weight: 700; margin: 0;">₹${(t.cost || 0).toFixed(2)}</p>
                            <p style="color: var(--text-muted); font-size: 9px; margin: 2px 0 0;">${t.totalDistance || 0} km</p>
                        </div>
                    </div>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                        ${(t.tollsPassed || []).slice(0, 3).map(toll => `
                            <span style="font-size: 8px; padding: 2px 6px; background: rgba(0,0,0,0.3); border-radius: 4px; color: var(--text-sec); border: 1px solid rgba(255,255,255,0.05);">
                                ${toll}
                            </span>
                        `).join('')}
                        ${(t.tollsPassed || []).length > 3 ? `<span style="font-size: 8px; color: var(--text-muted); padding-top:2px;">+${t.tollsPassed.length - 3} more</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    drawChart: () => {
        const trips = Storage.get(Storage.KEYS.TRIP_HISTORY, []);
        const canvas = document.getElementById('costChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Aggregate daily costs
        const dailyCosts = {};
        trips.forEach(trip => {
            const date = new Date(trip.timestamp || trip.startTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            dailyCosts[date] = (dailyCosts[date] || 0) + (trip.cost || 0);
        });

        if (TripAnalytics.chartInstance) {
            TripAnalytics.chartInstance.destroy();
        }

        const labels = Object.keys(dailyCosts);
        const data = Object.values(dailyCosts);

        if (labels.length === 0) return;

        TripAnalytics.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Daily Toll Spend (₹)',
                    data: data,
                    backgroundColor: '#d9e35b',
                    borderColor: '#d9e35b',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#999', font: { size: 9 } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#999', font: { size: 9 } }
                    }
                }
            }
        });
    }
};

window.TripAnalytics = TripAnalytics;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => TripAnalytics.init());
} else {
    TripAnalytics.init();
}
