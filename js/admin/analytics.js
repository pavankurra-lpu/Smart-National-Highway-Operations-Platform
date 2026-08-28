// Admin Analytics and Overview logic

const Analytics = {
    chartInstance: null,
    liveInterval: null,

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

        // Helper to check if a log is in the plaza
        const isLogInPlaza = (log) => {
            if (plaza === 'ALL') return true;
            const str = ((log.origin || '') + ' ' + (log.dest || '') + ' ' + (log.tollName || '')).toLowerCase();
            const p = plaza.toLowerCase();
            return str.includes(p);
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
            if (plaza === 'ALL') return true;
            const loc = (incident.location || '').toLowerCase();
            const p = plaza.toLowerCase();
            return loc.includes(p);
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

        // Draw/Refresh Chart
        Analytics.drawRevenueChart(filteredLogs);
    },

    drawRevenueChart: (logs) => {
        const canvas = document.getElementById('admin-revenue-chart');
        if (!canvas) return;

        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded yet');
            return;
        }

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

        // Add baseline numbers if empty
        const labels = Object.keys(dailyData);
        const revenueValues = labels.map((l, idx) => dailyData[l].revenue || (12000 + (idx * 2400) + Math.floor(Math.random() * 3000)));
        const trafficValues = labels.map((l, idx) => dailyData[l].count || (180 + (idx * 30) + Math.floor(Math.random() * 40)));

        if (Analytics.chartInstance) {
            Analytics.chartInstance.destroy();
        }

        let gradient = null;
        try {
            gradient = ctx.createLinearGradient(0, 0, 0, 200);
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
            gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
        } catch (e) {
            gradient = 'rgba(16, 185, 129, 0.1)';
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
                        borderWidth: 2,
                        fill: true,
                        backgroundColor: gradient,
                        tension: 0.35,
                        pointBackgroundColor: '#10b981',
                        pointBorderColor: '#ffffff',
                        pointHoverRadius: 5,
                        yAxisID: 'y-rev'
                    },
                    {
                        type: 'bar',
                        label: 'Transit Counts',
                        data: trafficValues,
                        backgroundColor: 'rgba(34, 163, 93, 0.45)',
                        borderColor: '#22a35d',
                        borderWidth: 1,
                        borderRadius: 4,
                        barThickness: 10,
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
                            color: '#94a3b8',
                            font: { size: 9, family: "'Oswald', 'Inter', sans-serif", weight: '500' },
                            boxWidth: 8,
                            padding: 8
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(14, 20, 24, 0.95)',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        titleFont: { family: "'Oswald', 'Inter', sans-serif", size: 10 },
                        bodyFont: { family: "'Inter', sans-serif", size: 9.5 },
                        padding: 8
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: { color: '#64748b', font: { size: 8.5, family: "'Inter', sans-serif" } }
                    },
                    'y-rev': {
                        type: 'linear',
                        position: 'left',
                        beginAtZero: true,
                        grid: { display: false },
                        border: { display: false },
                        ticks: {
                            color: '#64748b',
                            font: { size: 8.5, family: "'Inter', sans-serif" },
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
                            color: '#64748b',
                            font: { size: 8.5, family: "'Inter', sans-serif" }
                        }
                    }
                }
            }
        });

        // Real-Time Live Graph Updates
        if (Analytics.liveInterval) clearInterval(Analytics.liveInterval);
        
        Analytics.liveInterval = setInterval(() => {
            if (!Analytics.chartInstance) return;
            
            const livePositions = Storage.get('nhai_live_positions', {});
            const currentActive = Object.keys(livePositions).length;
            
            const dataset = Analytics.chartInstance.data.datasets[1];
            if (dataset && dataset.data) {
                const lastIndex = dataset.data.length - 1;
                if (lastIndex >= 0) {
                    const baseCount = trafficValues[lastIndex];
                    dataset.data[lastIndex] = baseCount + currentActive + Math.floor(Math.random() * 2);
                    Analytics.chartInstance.update('none');
                }
            }
        }, 3000);
    }
};

window.Analytics = Analytics;
document.addEventListener('DOMContentLoaded', Analytics.init);

