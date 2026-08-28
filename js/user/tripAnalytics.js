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

        if (window.animateNumber) {
            if (tripsEl) window.animateNumber('total-trips', totalTrips);
            if (distEl) window.animateNumber('total-distance', totalDistance, '', ' km', 0);
            if (costEl) window.animateNumber('total-cost', totalCost, '₹', '', 2);
        } else {
            if (tripsEl) tripsEl.innerText = totalTrips;
            if (distEl) distEl.innerText = totalDistance.toFixed(0) + ' km';
            if (costEl) costEl.innerText = '₹' + totalCost.toFixed(2);
        }
    },

    renderTripLog: () => {
        const trips = Storage.get(Storage.KEYS.TRIP_HISTORY, []);
        const listEl = document.getElementById('trip-history-list');
        if (!listEl) return;

        if (trips.length === 0) {
            listEl.innerHTML = `
                <div class="reactbits-empty-state">
                    <div class="empty-state-beacon">
                        <i class="fa-solid fa-map-location-dot"></i>
                    </div>
                    <div class="empty-state-title">No Trips Recorded</div>
                    <div class="empty-state-desc">Navigate to the Route Planner and start your first simulated trip to see journey logs here.</div>
                    <button type="button" class="empty-state-cta" onclick="document.getElementById('tab-btn-plan').click()">
                        <i class="fa-solid fa-location-arrow"></i> Plan Route Now
                    </button>
                </div>
            `;
            return;
        }

        listEl.innerHTML = trips.map(t => {
            const date = new Date(t.timestamp || t.startTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            return `
                <div style="background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; transition: all 0.25s cubic-bezier(0.2,0.8,0.2,1); box-shadow: 0 4px 12px rgba(0,0,0,0.25);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <div>
                            <p style="color: #fff; font-size: 12px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 6px;">
                                <span style="color:var(--primary); font-size:13px;"><i class="fa-solid fa-route"></i></span> ${t.origin || 'Unknown'} → ${t.dest || 'Unknown'}
                            </p>
                            <p style="color: var(--text-muted); font-size: 10px; margin: 3px 0 0;"><i class="fa-regular fa-calendar"></i> ${date}</p>
                        </div>
                        <div style="text-align: right;">
                            <p style="color: var(--accent-yellow); font-size: 13px; font-weight: 800; margin: 0; font-family:var(--font-display);">₹${(t.cost || 0).toFixed(2)}</p>
                            <span style="display:inline-block; font-size: 9px; font-weight:700; color: var(--accent-blue); background:rgba(59, 130, 246,0.1); padding:2px 6px; border-radius:4px; margin-top:2px;">${t.totalDistance || 0} km</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 5px; flex-wrap: wrap; margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.05);">
                        ${(t.tollsPassed || []).slice(0, 3).map(toll => `
                            <span style="font-size: 9px; padding: 2px 7px; background: rgba(0,0,0,0.35); border-radius: 6px; color: var(--text-sec); border: 1px solid rgba(255,255,255,0.08);">
                                📍 ${toll}
                            </span>
                        `).join('')}
                        ${(t.tollsPassed || []).length > 3 ? `<span style="font-size: 9px; color: var(--primary); font-weight:600; padding-top:2px;">+${t.tollsPassed.length - 3} more</span>` : ''}
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
                    <div class="reactbits-empty-state" style="padding: 22px 14px;">
                        <div class="empty-state-beacon" style="width: 42px; height: 42px; font-size: 17px; margin-bottom: 8px;">
                            <i class="fa-solid fa-chart-column"></i>
                        </div>
                        <div class="empty-state-title" style="font-size: 12.5px;">No Analytics Data</div>
                        <div class="empty-state-desc" style="font-size: 10.5px; margin-bottom: 10px;">Plan your first trip to unlock spending and travel charts.</div>
                        <button type="button" class="empty-state-cta" style="padding: 5px 12px; font-size: 10px;" onclick="document.getElementById('tab-btn-plan').click()">
                            <i class="fa-solid fa-route"></i> Start Routing
                        </button>
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
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
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
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(9, 9, 11, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#a1a1aa',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 10,
                        usePointStyle: true,
                        cornerRadius: 8,
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { display: false }, // Hidden for Bklit style
                        border: { display: false },
                        ticks: { color: '#71717a', font: { size: 9, family: 'Inter' } }
                    },
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: { color: '#71717a', font: { size: 9, family: 'Inter' } }
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
            const donutColors = Object.keys(vehicleCosts).length ? ['#10b981', '#ff671f', '#2563eb', '#a855f7'] : ['rgba(255,255,255,0.06)'];

            TripAnalytics.donutInstance = new Chart(donutCtx, {
                type: 'doughnut',
                data: {
                    labels: donutLabels,
                    datasets: [{
                        data: donutData,
                        backgroundColor: donutColors,
                        borderWidth: 2,
                        borderColor: '#1a1510', // match dark bg
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '76%',
                    plugins: {
                        tooltip: {
                            backgroundColor: 'rgba(9, 9, 11, 0.9)',
                            titleColor: '#fff',
                            bodyColor: '#a1a1aa',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1,
                            padding: 10,
                            boxPadding: 4,
                            usePointStyle: true,
                            cornerRadius: 8
                        },
                        legend: {
                            display: true,
                            position: 'right',
                            labels: {
                                color: '#a1a1aa',
                                font: { size: 9, family: 'Inter', weight: '500' },
                                boxWidth: 8,
                                boxHeight: 8,
                                usePointStyle: true,
                                padding: 12
                            }
                        }
                    }
                }
            });
        }

        // ═══════════════════════════════════════════════════════════════
        // Bklit UI: Top Plazas Bar Chart
        // ═══════════════════════════════════════════════════════════════
        const barCanvas = document.getElementById('barChart');
        if (barCanvas && trips.length > 0) {
            const barCtx = barCanvas.getContext('2d');
            
            if (TripAnalytics.barInstance) {
                TripAnalytics.barInstance.destroy();
            }

            // Aggregate tolls passed
            const plazaCounts = {};
            trips.forEach(trip => {
                (trip.tollsPassed || []).forEach(toll => {
                    plazaCounts[toll] = (plazaCounts[toll] || 0) + 1;
                });
            });

            // Sort top 5
            const sortedPlazas = Object.entries(plazaCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);
            const barLabels = sortedPlazas.map(p => p[0].split(' ')[0] + '..');
            const barData = sortedPlazas.map(p => p[1]);

            // Create gradient
            let barGradient = 'rgba(59, 130, 246, 0.8)';
            try {
                barGradient = barCtx.createLinearGradient(0, 0, 0, 120);
                barGradient.addColorStop(0, '#f59e0b');
                barGradient.addColorStop(1, 'rgba(59, 130, 246, 0.2)');
            } catch(e) {}

            TripAnalytics.barInstance = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels: barLabels,
                    datasets: [{
                        label: 'Crossings',
                        data: barData,
                        backgroundColor: barGradient,
                        borderRadius: 4,
                        barThickness: 12
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(9, 9, 11, 0.9)',
                            titleColor: '#fff',
                            bodyColor: '#a1a1aa',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1,
                            padding: 10,
                            cornerRadius: 8
                        }
                    },
                    scales: {
                        y: { display: false }, // Hide Y completely for Bklit minimalism
                        x: {
                            grid: { display: false },
                            ticks: { color: '#71717a', font: { size: 9, family: 'Inter' } },
                            border: { display: false }
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
