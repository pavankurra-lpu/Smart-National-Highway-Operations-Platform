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
            const color = a.type === 'EMERGENCY' ? '#f43f5e' : (a.type === 'TRAFFIC' ? '#f59e0b' : '#10b981');
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
                `<span><i class="fa-solid fa-satellite-dish" style="color:#10b981;"></i> GPS Telemetry Active · Real-time National Highway monitoring enabled.</span>`,
                `<span><i class="fa-solid fa-shield-halved" style="color:#10b981;"></i> 1033 National Emergency Dispatch ready 24/7 across all corridors.</span>`,
                `<span><i class="fa-solid fa-wallet" style="color:#a855f7;"></i> Automated FASTag Toll clearance operational on 1,232+ Indian plazas.</span>`,
                `<span><i class="fa-solid fa-triangle-exclamation" style="color:#fbbf24;"></i> Heavy vehicle lane discipline mandatory across all Expressways.</span>`
            ];
        }

        // Duplicate items so scrolling marquee is seamless
        const fullContent = tickerItems.join('') + tickerItems.join('');
        tickerEl.innerHTML = fullContent;

        setTimeout(() => {
            const scrollW = tickerEl.scrollWidth;
            const halfW = scrollW / 2;
            const pxPerSec = window.innerWidth <= 768 ? 26 : 42;
            const duration = Math.max(35, Math.round(halfW / pxPerSec));
            tickerEl.style.animationDuration = `${duration}s`;
        }, 50);
    },

    calcDistance: (lat1, lon1, lat2, lon2) => {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    },

    renderCurrent: () => {
        if (Notifications.activeAlerts.length === 0) return;
        const alert = Notifications.activeAlerts[Notifications.currentIndex];
        
        const typeIcons = {
            'TRAFFIC': '<i class="fa-solid fa-car-burst" style="color:var(--accent-yellow)"></i>',
            'WEATHER': '<i class="fa-solid fa-cloud-showers-heavy" style="color:#10b981"></i>',
            'EMERGENCY': '<i class="fa-solid fa-triangle-exclamation" style="color:var(--accent-red)"></i>',
            'INFO': '<i class="fa-solid fa-circle-info" style="color:var(--primary)"></i>'
        };

        const icon = typeIcons[alert.type] || typeIcons['INFO'];
        
        // Calculate traveller proximity if coordinates available
        let proximityBadge = '';
        let userPos = null;
        if (window.IndiaMapPlanner) {
            if (IndiaMapPlanner.lastKnownGps) userPos = IndiaMapPlanner.lastKnownGps;
            else if (IndiaMapPlanner.userLocationMarker) userPos = IndiaMapPlanner.userLocationMarker.getLatLng();
            else if (IndiaMapPlanner.selectedOrigin) userPos = IndiaMapPlanner.selectedOrigin;
        }

        if (userPos && alert.lat && alert.lng && (alert.lat !== 20.5937 || alert.lng !== 78.9629)) {
            const dist = Notifications.calcDistance(userPos.lat, userPos.lng || userPos.lon, alert.lat, alert.lng);
            if (dist <= 10) {
                proximityBadge = `
                    <div style="margin-top:6px; background:rgba(239,68,68,0.22); border:1px solid rgba(239,68,68,0.5); border-radius:6px; padding:3px 8px; font-size:10px; font-weight:800; color:#f87171; display:inline-flex; align-items:center; gap:5px;">
                        <i class="fa-solid fa-triangle-exclamation"></i> YOU ARE WITHIN 10KM TOLL GEOFENCE (${dist.toFixed(1)} km away)
                    </div>
                `;
            } else {
                proximityBadge = `
                    <div style="margin-top:4px; font-size:9.5px; color:#94a3b8;">
                        <i class="fa-solid fa-satellite-dish" style="color:#10b981;"></i> 10km Geofence Area • ${dist.toFixed(0)} km from current location
                    </div>
                `;
            }
        }

        const advisory = document.getElementById('advisory-text');
        if (advisory) {
            advisory.innerHTML = `
                <div style="margin-bottom: 4px; font-weight:bold; color:#fff; font-size:12px; display:flex; align-items:center; gap:6px;">
                    ${icon} <span>${alert.title}</span>
                </div>
                <div style="font-size:11.5px; color:#cbd5e1; line-height:1.4;">${alert.message}</div>
                ${proximityBadge}
                <div style="font-size:9px; color:#10b981; margin-top:5px; font-weight:600; display:flex; align-items:center; gap:6px;">
                    <span><i class="fa-solid fa-archway"></i> ${alert.plaza || 'All Corridors'}</span>
                    <span>•</span>
                    <span><i class="fa-regular fa-clock"></i> ${Utils.formatDateTime ? Utils.formatDateTime(alert.timestamp) : new Date(alert.timestamp).toLocaleTimeString()}</span>
                </div>
            `;
        }

        Notifications.renderUserBroadcastCircles();
    },

    broadcastCircles: {},

    renderUserBroadcastCircles: () => {
        if (!window.IndiaMapPlanner || !IndiaMapPlanner.map) return;
        const map = IndiaMapPlanner.map;
        const alerts = Notifications.activeAlerts || [];

        // Remove previous circles
        Object.values(Notifications.broadcastCircles).forEach(c => {
            try { map.removeLayer(c); } catch(e){}
        });
        Notifications.broadcastCircles = {};

        alerts.forEach(alert => {
            if (alert.lat && alert.lng && (alert.lat !== 20.5937 || alert.lng !== 78.9629)) {
                const radiusMeters = (alert.radiusKm || 10) * 1000; // 10,000 meters (10 km)
                const color = alert.type === 'EMERGENCY' ? '#ef4444' : (alert.type === 'TRAFFIC' ? '#f59e0b' : '#10b981');

                const circle = L.circle([alert.lat, alert.lng], {
                    radius: radiusMeters,
                    color: color,
                    weight: 2,
                    fillColor: color,
                    fillOpacity: 0.12,
                    dashArray: '5, 8'
                }).bindPopup(`
                    <div style="font-family:'Inter',sans-serif; color:#090d10; padding:4px;">
                        <strong style="color:${color}; font-size:12px;"><i class="fa-solid fa-tower-broadcast"></i> 10km NHAI Broadcast Zone</strong><br>
                        <strong style="font-size:11.5px;">${alert.title}</strong><br>
                        <p style="font-size:11px; color:#475569; margin:4px 0;">${alert.message}</p>
                        <span style="font-size:9.5px; color:#64748b; font-weight:bold;">${alert.plaza || 'Toll Gate'} • 10 km Radius Coverage</span>
                    </div>
                `).addTo(map);

                Notifications.broadcastCircles[alert.id] = circle;
            }
        });
    }
};

window.Notifications = Notifications;
