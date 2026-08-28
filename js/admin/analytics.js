// Admin Analytics and Overview logic

const Analytics = {
    chartInstance: null,

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

        const plaza = sessionStorage.getItem('admin_plaza') || 'ALL';

        // Helper to check if a log is in the plaza (using origin/dest keywords or toll names)
        const isLogInPlaza = (log) => {
            if (plaza === 'ALL') return true;
            // Simple string matching for demo purposes
            const str = (log.origin + ' ' + log.dest).toLowerCase();
            const p = plaza.toLowerCase();
            if (str.includes(p)) return true;
            return false;
        };

        const filteredLogs = logs.filter(isLogInPlaza);

        filteredLogs.forEach(log => {
            const cost = log.cost || 0;
            const time = new Date(log.timestamp).getTime();
            
            if (time >= startOfDay) revenueToday += cost;
            if (time >= startOfMonth) revenueMonth += cost;
            if (time >= startOfYear) revenueYear += cost;
        });

        const elToday = document.getElementById('stat-revenue-today');
        const elMonth = document.getElementById('stat-revenue-month');
        const elYear = document.getElementById('stat-revenue-year');
        
        if (window.animateNumber) {
            if (elToday) window.animateNumber('stat-revenue-today', revenueToday, '₹', '', 2);
            if (elMonth) window.animateNumber('stat-revenue-month', revenueMonth, '₹', '', 2);
            if (elYear) window.animateNumber('stat-revenue-year', revenueYear, '₹', '', 2);
        } else {
            if (elToday) elToday.innerText = Utils.formatCurrency(revenueToday);
            if (elMonth) elMonth.innerText = Utils.formatCurrency(revenueMonth);
            if (elYear) elYear.innerText = Utils.formatCurrency(revenueYear);
        }

        // Active incidents stat
        const incidents = Storage.get(Storage.KEYS.EMERGENCIES, []);
        
        const isIncidentInRegion = (incident) => {
            if (region === 'ALL') return true;
            const loc = (incident.location || '').toLowerCase();
            const r = region.toLowerCase();
            if (loc.includes(r)) return true;
            if (r === 'maharashtra' && (loc.includes('mumbai') || loc.includes('pune') || loc.includes('nashik'))) return true;
            if (r === 'punjab' && (loc.includes('amritsar') || loc.includes('ludhiana') || loc.includes('jalandhar'))) return true;
            if (r === 'delhi' && (loc.includes('delhi') || loc.includes('noida') || loc.includes('gurgaon'))) return true;
            if (r === 'karnataka' && (loc.includes('bengaluru') || loc.includes('bangalore') || loc.includes('mysuru'))) return true;
            return false;
        };
        
        const activeCount = incidents.filter(i => 
            ['RAISED', 'ACKNOWLEDGED', 'DISPATCHED'].includes(i.status) && isIncidentInRegion(i)
        ).length;
        
        const statIncidents = document.getElementById('stat-incidents');
        
        if (statIncidents) {
            if (window.animateNumber) {
                window.animateNumber('stat-incidents', activeCount);
            } else {
                statIncidents.innerText = activeCount;
            }
        }

        // Draw/Refresh Bklit-style Chart
        Analytics.drawRevenueChart(filteredLogs);
    },

    drawRevenueChart: (logs) => {
        const canvas = document.getElementById('admin-revenue-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Group last 7 days of logs
        const dailyData = {};
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            dailyData[dateStr] = { revenue: 0, count: 0 };
        }

        logs.forEach(log => {
            const dateStr = new Date(log.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            if (dailyData[dateStr] !== undefined) {
                dailyData[dateStr].revenue += log.cost || 0;
                dailyData[dateStr].count += 1;
            }
        });

        const labels = Object.keys(dailyData);
        const revenueValues = labels.map(l => dailyData[l].revenue);
        const trafficValues = labels.map(l => dailyData[l].count);

        if (Analytics.chartInstance) {
            Analytics.chartInstance.destroy();
        }

        let gradient = null;
        try {
            gradient = ctx.createLinearGradient(0, 0, 0, 250);
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
            gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
        } catch (e) {
            gradient = 'rgba(16, 185, 129, 0.05)';
        }

        Analytics.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'line',
                        label: 'Revenue (₹)',
                        data: revenueValues,
                        borderColor: '#10b981',
                        borderWidth: 2.5,
                        fill: true,
                        backgroundColor: gradient,
                        tension: 0.35,
                        pointBackgroundColor: '#10b981',
                        pointHoverRadius: 6,
                        yAxisID: 'y-rev'
                    },
                    {
                        type: 'bar',
                        label: 'Transit Counts',
                        data: trafficValues,
                        backgroundColor: 'rgba(242, 169, 59, 0.4)',
                        borderColor: '#d98f22',
                        borderWidth: 1,
                        borderRadius: 4,
                        barThickness: 12,
                        yAxisID: 'y-count'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#a1a1aa',
                            font: { size: 9, family: var(--font-display), weight: '500' },
                            boxWidth: 8,
                            padding: 10
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(9, 9, 11, 0.95)',
                        borderColor: 'rgba(255,255,255,0.08)',
                        borderWidth: 1,
                        titleFont: { family: var(--font-display), size: 10 },
                        bodyFont: { family: 'Inter', size: 10 },
                        padding: 8
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: { color: '#71717a', font: { size: 9, family: 'Inter' } }
                    },
                    'y-rev': {
                        type: 'linear',
                        position: 'left',
                        beginAtZero: true,
                        grid: { display: false },
                        border: { display: false },
                        ticks: {
                            color: '#71717a',
                            font: { size: 9, family: 'Inter' },
                            callback: (v) => '₹' + v
                        }
                    },
                    'y-count': {
                        type: 'linear',
                        position: 'right',
                        beginAtZero: true,
                        grid: { display: false },
                        border: { display: false },
                        ticks: {
                            color: '#71717a',
                            font: { size: 9, family: 'Inter' }
                        }
                    }
                }
            }
        });

        // ═══════════════════════════════════════════════════════════════
        // Real-Time Live Graph Updates (Bklit Style)
        // ═══════════════════════════════════════════════════════════════
        if (Analytics.liveInterval) clearInterval(Analytics.liveInterval);
        
        Analytics.liveInterval = setInterval(() => {
            if (!Analytics.chartInstance) return;
            
            const livePositions = Storage.get(Storage.KEYS.LIVE_POSITIONS, []);
            const currentActive = livePositions.length;
            
            // Randomly fluctuate the last point to simulate real-time operations
            const dataset = Analytics.chartInstance.data.datasets[1]; // traffic count bar
            const lastIndex = dataset.data.length - 1;
            
            if (lastIndex >= 0) {
                // Add the current active vehicles to the today's traffic count to simulate live pulsing
                const baseCount = trafficValues[lastIndex];
                dataset.data[lastIndex] = baseCount + currentActive + Math.floor(Math.random() * 3);
                Analytics.chartInstance.update('none'); // Update without full animation for smooth real-time feel
            }
        }, 2500);
    }
};

window.Analytics = Analytics;
document.addEventListener('DOMContentLoaded', Analytics.init);
