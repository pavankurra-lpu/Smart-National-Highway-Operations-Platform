// Handles Receiving Admin Broadcasts & Realtime Highway Traffic Alerts

const Notifications = {
    init: () => {
        Notifications.updateAdvisory();
        Notifications.updateLiveTicker();

        // 1. Listen for storage changes to see if admin pushed an alert (current window)
        window.addEventListener('local-storage-update', () => {
            Notifications.updateAdvisory();
            Notifications.updateLiveTicker();
        });

        // 2. Listen for native storage events to sync across different tabs on the same device
        window.addEventListener('storage', (e) => {
            if (e.key === Storage.KEYS.ADMIN_ALERTS || e.key === Storage.KEYS.TOLL_STATES) {
                Notifications.updateAdvisory();
                Notifications.updateLiveTicker();
            }
        });

        // 3. Listen to Realtime WebSocket if connected
        if (window.RealtimeService && RealtimeService.socket) {
            RealtimeService.socket.on('admin-broadcast', (data) => {
                console.log('[Notifications] Received live admin broadcast over socket:', data);
                if (data && data.alertData) {
                    Storage.addAdminAlert(data.alertData);
                    Notifications.updateAdvisory();
                    Notifications.updateLiveTicker();
                    Utils.showToast(`🚨 NHAI ALERT: ${data.alertData.title}`, 'warning');
                }
            });
        }
        
        // 4. Fast polling interval to guarantee all alerts & traffic states reflect immediately
        setInterval(() => {
            Notifications.updateAdvisory();
            Notifications.updateLiveTicker();
        }, 4000);

        // Auto rotate active alerts if multiple
        setInterval(() => {
            if (Notifications.activeAlerts.length > 1) {
                Notifications.currentIndex = (Notifications.currentIndex + 1) % Notifications.activeAlerts.length;
                Notifications.renderCurrent();
            }
        }, 5000);
    },

    activeAlerts: [],
    currentIndex: 0,

    updateAdvisory: () => {
        const alerts = Storage.get(Storage.KEYS.ADMIN_ALERTS, []);
        const now = new Date().getTime();

        // Include any broadcast from last 24 hours
        const newAlerts = alerts.filter(a => {
            if (!a.timestamp) return true;
            const at = new Date(a.timestamp).getTime();
            return (now - at) < (24 * 60 * 60 * 1000);
        });

        // If we found a new alert that wasn't in our active list, notify
        if (newAlerts.length > Notifications.activeAlerts.length) {
            const latest = newAlerts[0];
            if (window.PushNotifications) {
                PushNotifications.sendNotification(`NHAI ALERT: ${latest.title}`, latest.message);
            }
            Utils.showToast(`🚨 Live NHAI Advisory: ${latest.title}`, 'warning');
        }

        Notifications.activeAlerts = newAlerts;

        const panel = document.getElementById('admin-broadcasts-panel');
        if (Notifications.activeAlerts.length > 0) {
            if (panel) panel.classList.remove('hidden');
            if (Notifications.currentIndex >= Notifications.activeAlerts.length) {
                Notifications.currentIndex = 0;
            }
            Notifications.renderCurrent();
        } else {
            if (panel) panel.classList.add('hidden');
        }
    },

    updateLiveTicker: () => {
        const tickerEl = document.getElementById('alerts-ticker-content');
        if (!tickerEl) return;

        const adminAlerts = Storage.get(Storage.KEYS.ADMIN_ALERTS, []);
        const tollStates = Storage.get(Storage.KEYS.TOLL_STATES, {});

        let tickerItems = [];

        // 1. Add active admin broadcast alerts
        adminAlerts.slice(0, 5).forEach(a => {
            const icon = a.type === 'EMERGENCY' ? 'fa-triangle-exclamation' : (a.type === 'TRAFFIC' ? 'fa-car-burst' : 'fa-bullhorn');
            const color = a.type === 'EMERGENCY' ? '#f43f5e' : (a.type === 'TRAFFIC' ? '#f59e0b' : '#38bdf8');
            tickerItems.push(`
                <span style="color:${color}; font-weight:700;">
                    <i class="fa-solid ${icon}"></i> [NHAI BROADCAST]: ${a.title} — ${a.message}
                </span>
            `);
        });

        // 2. Add congested toll plaza warnings
        if (window.TollSeedData) {
            Object.keys(tollStates).forEach(tId => {
                const st = tollStates[tId];
                if (st && (st.congestion === 'HIGH' || st.congestion === 'MODERATE')) {
                    const toll = window.TollSeedData.find(t => t.id === tId || t.name === tId);
                    const name = toll ? toll.name : tId;
                    const corr = toll?.nhCorridor ? ` [NH-${toll.nhCorridor}]` : '';
                    if (st.congestion === 'HIGH') {
                        tickerItems.push(`
                            <span style="color:#f43f5e; font-weight:700;">
                                <i class="fa-solid fa-triangle-exclamation"></i> [HIGH CONGESTION]: Heavy traffic at ${name}${corr}. Expect delays.
                            </span>
                        `);
                    } else {
                        tickerItems.push(`
                            <span style="color:#fbbf24; font-weight:600;">
                                <i class="fa-solid fa-clock"></i> [TRAFFIC UPDATE]: Moderate flow at ${name}${corr}.
                            </span>
                        `);
                    }
                }
            });
        }

        // 3. Fallback standard national advisories if no critical alerts
        if (tickerItems.length === 0) {
            tickerItems = [
                `<span><i class="fa-solid fa-satellite-dish" style="color:#38bdf8;"></i> GPS Telemetry Active · Real-time National Highway monitoring enabled.</span>`,
                `<span><i class="fa-solid fa-shield-halved" style="color:#10b981;"></i> 1033 National Emergency Dispatch ready 24/7 across all corridors.</span>`,
                `<span><i class="fa-solid fa-wallet" style="color:#a855f7;"></i> Automated FASTag Toll clearance operational on 1,558+ Indian plazas.</span>`,
                `<span><i class="fa-solid fa-triangle-exclamation" style="color:#fbbf24;"></i> Heavy vehicle lane discipline mandatory across all Expressways.</span>`
            ];
        }

        // Duplicate items so scrolling marquee is seamless
        const fullContent = tickerItems.join('') + tickerItems.join('');
        tickerEl.innerHTML = fullContent;
    },

    renderCurrent: () => {
        if (Notifications.activeAlerts.length === 0) return;
        const alert = Notifications.activeAlerts[Notifications.currentIndex];
        
        const typeIcons = {
            'TRAFFIC': '<i class="fa-solid fa-car-burst" style="color:var(--accent-yellow)"></i>',
            'WEATHER': '<i class="fa-solid fa-cloud-showers-heavy" style="color:#3b82f6"></i>',
            'EMERGENCY': '<i class="fa-solid fa-triangle-exclamation" style="color:var(--accent-red)"></i>',
            'INFO': '<i class="fa-solid fa-circle-info" style="color:var(--primary)"></i>'
        };

        const icon = typeIcons[alert.type] || typeIcons['INFO'];
        
        const advisory = document.getElementById('advisory-text');
        if (advisory) {
            advisory.innerHTML = `
                <div style="margin-bottom: 4px; font-weight:bold; color:#fff; font-size:12px;">
                    ${icon} ${alert.title}
                </div>
                <div style="font-size:11.5px; color:#cbd5e1; line-height:1.4;">${alert.message}</div>
                <div style="font-size:9.5px; color:#38bdf8; margin-top:5px; font-weight:600;">
                    <i class="fa-solid fa-tower-broadcast"></i> Region: ${alert.plaza || 'All Corridors'} • ${Utils.formatDateTime(alert.timestamp)}
                </div>
            `;
        }
    }
};

window.Notifications = Notifications;
