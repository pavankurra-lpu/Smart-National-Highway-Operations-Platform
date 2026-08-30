// SNHOP Real-time WebSocket Service (Cross-Device Live Event Bus)

const RealtimeService = {
    socket: null,
    serverUrl: window.NHAI_CONFIG?.backend?.url || 'http://localhost:3000',

    init: () => {
        if (typeof io === 'undefined') {
            return;
        }

        try {
            RealtimeService.socket = io(RealtimeService.serverUrl, {
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
                timeout: 5000
            });
        } catch (e) {
            console.warn('[Realtime] Socket connection error:', e.message);
            return;
        }

        RealtimeService.socket.on('connect', () => {
            const badge = document.getElementById('connection-status');
            if (badge) { 
                badge.style.color = '#10b981'; 
                badge.title = 'Live Server: Connected (Real-Time WebSockets Active)'; 
            }

            // Join admin room if admin authenticated
            const adminToken = sessionStorage.getItem('nhai_admin_auth');
            if (adminToken) {
                RealtimeService.socket.emit('join-room', 'admin-room');
            }

            // Sync initial state from server
            RealtimeService.syncStateFromServer();
        });

        // 1. Live Incident Events (SOS Emergency Logged)
        RealtimeService.socket.on('incident-created', (incident) => {
            // Sync to local storage
            const emergencies = Storage.get(Storage.KEYS.EMERGENCIES, []);
            if (!emergencies.some(e => e.id === incident.id)) {
                emergencies.unshift(incident);
                Storage.set(Storage.KEYS.EMERGENCIES, emergencies);
            }

            // Update UI on Admin Portal
            if (window.IncidentCenter && typeof IncidentCenter.refresh === 'function') {
                IncidentCenter.refresh();
            }
            if (window.Analytics && typeof Analytics.refresh === 'function') {
                Analytics.refresh();
            }

            // Show Toast Alert
            if (window.Utils) {
                Utils.showToast(`🚨 NEW EMERGENCY: ${incident.type} reported at ${incident.location}`, 'error');
            }
        });

        // 2. Incident Status Updates (Dispatched / Acknowledged)
        RealtimeService.socket.on('incident-updated', (incident) => {
            const emergencies = Storage.get(Storage.KEYS.EMERGENCIES, []);
            const idx = emergencies.findIndex(e => e.id === incident.id);
            if (idx !== -1) {
                emergencies[idx] = incident;
            } else {
                emergencies.unshift(incident);
            }
            Storage.set(Storage.KEYS.EMERGENCIES, emergencies);

            if (window.IncidentCenter && typeof IncidentCenter.refresh === 'function') {
                IncidentCenter.refresh();
            }
            if (window.EmergencyReporter && typeof EmergencyReporter.refreshUI === 'function') {
                EmergencyReporter.refreshUI();
            }
        });

        // 3. Incident Resolved (Admin closed case with proof)
        RealtimeService.socket.on('incident-resolved', (incident) => {
            const emergencies = Storage.get(Storage.KEYS.EMERGENCIES, []);
            const idx = emergencies.findIndex(e => e.id === incident.id);
            if (idx !== -1) {
                emergencies[idx] = incident;
            } else {
                emergencies.unshift(incident);
            }
            Storage.set(Storage.KEYS.EMERGENCIES, emergencies);

            if (window.IncidentCenter && typeof IncidentCenter.refresh === 'function') {
                IncidentCenter.refresh();
            }
            if (window.EmergencyReporter && typeof EmergencyReporter.refreshUI === 'function') {
                EmergencyReporter.refreshUI();
                // Prompt traveller for resolution rating & feedback
                EmergencyReporter.openFeedback(incident.id);
            }
            if (window.Utils) {
                Utils.showToast(`Incident ${incident.id} has been RESOLVED by Highway Patrol.`, 'success');
            }
        });

        // 4. Incident Closed (Traveler rating submitted)
        RealtimeService.socket.on('incident-closed', (incident) => {
            const emergencies = Storage.get(Storage.KEYS.EMERGENCIES, []);
            const idx = emergencies.findIndex(e => e.id === incident.id);
            if (idx !== -1) {
                emergencies[idx] = incident;
                Storage.set(Storage.KEYS.EMERGENCIES, emergencies);
            }
            if (window.IncidentCenter && typeof IncidentCenter.refresh === 'function') {
                IncidentCenter.refresh();
            }
        });

        // 5. Live FASTag Financial Balance Sync
        RealtimeService.socket.on('wallet-updated', (data) => {
            if (typeof data.newBalance === 'number') {
                Storage.set(Storage.KEYS.FASTAG_BALANCE, data.newBalance);
                
                // Update balance labels in user UI
                const balEls = document.querySelectorAll('.wallet-balance-val, #wallet-balance, #dash-fastag-bal');
                balEls.forEach(el => {
                    el.innerText = `₹${data.newBalance.toLocaleString('en-IN')}`;
                });
            }
            if (data.transaction) {
                const txs = Storage.get(Storage.KEYS.RECHARGE_HISTORY, []);
                if (!txs.some(t => t.id === data.transaction.id)) {
                    txs.unshift(data.transaction);
                    Storage.set(Storage.KEYS.RECHARGE_HISTORY, txs);
                }
            }
        });

        // 6. Global Admin Alert Broadcast
        RealtimeService.socket.on('broadcast-alert', (alert) => {
            const currentAlerts = Storage.get(Storage.KEYS.ADMIN_ALERTS, []);
            if (!currentAlerts.some(a => a.id === alert.id)) {
                currentAlerts.unshift(alert);
                Storage.set(Storage.KEYS.ADMIN_ALERTS, currentAlerts);
            }
            if (window.Notifications && typeof Notifications.updateAdvisory === 'function') {
                Notifications.updateAdvisory();
            }
            if (window.Utils) {
                Utils.showToast(`⚠️ HIGHWAY ADVISORY: ${alert.title} - ${alert.message}`, 'warning');
            }
        });

        // 7. Toll Plaza Congestion Updates
        RealtimeService.socket.on('toll-state-updated', (data) => {
            const states = Storage.get(Storage.KEYS.TOLL_STATES, {});
            states[data.plazaId] = data.state;
            Storage.set(Storage.KEYS.TOLL_STATES, states);
        });

        RealtimeService.socket.on('disconnect', () => {
            const badge = document.getElementById('connection-status');
            if (badge) { 
                badge.style.color = '#ef4444'; 
                badge.title = 'Live Server: Disconnected (Fallback Cache Mode)'; 
            }
        });

        RealtimeService.socket.on('connect_error', () => {
            const badge = document.getElementById('connection-status');
            if (badge) { 
                badge.style.color = '#f59e0b'; 
                badge.title = 'Live Server: Offline (Local Simulation Active)'; 
            }
        });
    },

    syncStateFromServer: async () => {
        try {
            const res = await fetch(`${RealtimeService.serverUrl}/api/incidents`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.incidents)) {
                    Storage.set(Storage.KEYS.EMERGENCIES, data.incidents);
                    if (window.IncidentCenter && typeof IncidentCenter.refresh === 'function') {
                        IncidentCenter.refresh();
                    }
                }
            }
        } catch (e) {}
    },

    updatePosition: (tripId, lat, lng) => {
        if (!tripId || !lat || !lng) return;
        const positions = Storage.get('nhai_live_positions', {});
        positions[tripId] = { lat, lng, timestamp: new Date().toISOString() };
        Storage.set('nhai_live_positions', positions);

        if (RealtimeService.socket && RealtimeService.socket.connected) {
            RealtimeService.socket.emit('update-position', { tripId, lat, lng });
        }
    }
};

window.RealtimeService = RealtimeService;
document.addEventListener('DOMContentLoaded', () => RealtimeService.init());
