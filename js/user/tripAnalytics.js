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
            listEl.innerHTML = `
                <div style="text-align: center; padding: 30px 20px; background: rgba(255,255,255,0.02); border: 1px dashed var(--border); border-radius: 12px; margin-top: 10px;">
                    <i class="fa-solid fa-map-location-dot" style="font-size: 24px; color: var(--text-muted); margin-bottom: 12px;"></i>
                    <p style="color: var(--text-main); font-size: 13px; font-weight: 600; margin: 0 0 4px;">No Trips Recorded</p>
                    <p style="color: var(--text-muted); font-size: 11px; margin: 0; line-height: 1.4;">Navigate to the Route Planner and start your first simulated trip to see journey logs here.</p>
                </div>
            `;
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

        if (labels.length === 0) {
            canvas.style.display = 'none';
            const parent = canvas.parentElement;
            if (!parent.querySelector('.no-data-msg')) {
                const msg = document.createElement('div');
                msg.className = 'no-data-msg';
                msg.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; background: rgba(255,255,255,0.02); border: 1px dashed var(--border); border-radius: 12px; margin-bottom: 20px;">
                        <i class="fa-solid fa-chart-column" style="font-size: 24px; color: var(--text-muted); margin-bottom: 12px;"></i>
                        <p style="color: var(--text-main); font-size: 13px; font-weight: 600; margin: 0 0 4px;">No Analytics Data</p>
                        <p style="color: var(--text-muted); font-size: 11px; margin: 0;">Plan your first trip to unlock spending and travel charts.</p>
                    </div>
                `;
                parent.appendChild(msg);
            }
            return;
        }
        
        // Remove stale no-data message if data now exists
        const staleMsg = canvas.parentElement.querySelector('.no-data-msg');
        if (staleMsg) staleMsg.remove();
        canvas.style.display = '';

        // Create gradient fill for line chart
        let gradient = null;
        try {
            gradient = ctx.createLinearGradient(0, 0, 0, 150);
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
            gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
        } catch (e) {
            gradient = 'rgba(16, 185, 129, 0.05)';
        }

        TripAnalytics.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Daily Toll Spend (₹)',
                    data: data,
                    fill: true,
                    backgroundColor: gradient,
                    borderColor: '#10b981',
                    borderWidth: 2,
                    tension: 0.38,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: 'rgba(255,255,255,0.15)',
                    pointBorderWidth: 1.5,
                    pointRadius: 2.5,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: '#10b981',
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2
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
                        grid: { color: 'rgba(255, 255, 255, 0.04)' },
                        ticks: { color: '#8e8e93', font: { size: 8.5, family: 'Space Grotesk' } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#8e8e93', font: { size: 8.5, family: 'Space Grotesk' } }
                    }
                }
            }
        });

        // ═══════════════════════════════════════════════════════════════
        // Bklit UI: Spend Share Donut Chart
        // ═══════════════════════════════════════════════════════════════
        const donutCanvas = document.getElementById('donutChart');
        if (donutCanvas) {
            const donutCtx = donutCanvas.getContext('2d');
            
            if (TripAnalytics.donutInstance) {
                TripAnalytics.donutInstance.destroy();
            }

            // Aggregate spend share by vehicle
            const vehicleCosts = {};
            trips.forEach(trip => {
                const vehicle = trip.vehicleName || 'Primary Car';
                vehicleCosts[vehicle] = (vehicleCosts[vehicle] || 0) + (trip.cost || 0);
            });

            const donutLabels = Object.keys(vehicleCosts).length ? Object.keys(vehicleCosts) : ['Primary Car'];
            const donutData = Object.keys(vehicleCosts).length ? Object.values(vehicleCosts) : [0.01]; // placeholder if zero
            const donutColors = Object.keys(vehicleCosts).length ? ['#10b981', '#ff671f', '#0ea5e9', '#a855f7'] : ['rgba(255,255,255,0.06)'];

            TripAnalytics.donutInstance = new Chart(donutCtx, {
                type: 'doughnut',
                data: {
                    labels: donutLabels,
                    datasets: [{
                        data: donutData,
                        backgroundColor: donutColors,
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '76%',
                    plugins: {
                        legend: {
                            display: true,
                            position: 'right',
                            labels: {
                                color: '#a1a1aa',
                                font: { size: 8.5, family: 'Space Grotesk', weight: '500' },
                                boxWidth: 7,
                                padding: 8
                            }
                        }
                    }
                }
            });
        }
    }
};

window.TripAnalytics = TripAnalytics;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => TripAnalytics.init());
} else {
    TripAnalytics.init();
}
