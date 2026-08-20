// Admin Dashboard Orchestrator

const AdminApp = {
    map: null,
    vehicleMarkers: {},

    init: () => {
        // Navigation logic
        const navBtns = document.querySelectorAll('.admin-nav-btn');
        const views = document.querySelectorAll('.view-section');

        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                navBtns.forEach(b => b.classList.remove('active'));
                views.forEach(v => v.classList.remove('active'));
                
                btn.classList.add('active');
                document.getElementById(btn.getAttribute('data-view')).classList.add('active');
                
                // Redraw map on view switch if it was hidden
                if (btn.getAttribute('data-view') === 'view-overview' && AdminApp.map) {
                    setTimeout(() => AdminApp.map.invalidateSize(), 100);
                }
            });
        });

        // Initialize features
        ThemeManager.init();
        Analytics.init();
        if(window.CCTVManager) CCTVManager.init();
        CCTVPanel.init();
        IncidentCenter.init();
        TrafficControl.init();
        AlertBroadcaster.init();
        SpecialVehicleControl.init();

        // Init map
        AdminApp.initMap();
        AdminApp.renderIncidentMarkers();

        // Listen for user actions dynamically
        window.addEventListener('local-storage-update', () => {
            Analytics.refresh();
            IncidentCenter.refresh();
            SpecialVehicleControl.refresh();
            AdminApp.renderIncidentMarkers();
        });
        
        // Change-detection poll: only re-render when data actually changes
        let _lastSyncHash = '';
        setInterval(() => {
            const hash = [
                Storage.get(Storage.KEYS.VEHICLE_LOGS, []).length,
                Storage.get(Storage.KEYS.EMERGENCIES, []).length,
                Storage.get(Storage.KEYS.ADMIN_ALERTS, []).length
            ].join(',');
            if (hash !== _lastSyncHash) {
                _lastSyncHash = hash;
                window.dispatchEvent(new Event('local-storage-update'));
            }
        }, 3000);

        // Bind socket listener for vehicle tracking and SOS alerts
        let socketBound = false;
        const bindSocket = () => {
            if (socketBound) return;
            if (window.RealtimeService && window.RealtimeService.socket) {
                RealtimeService.socket.on('vehicle-moved', (data) => {
                    AdminApp.updateVehicleMarker(data);
                });
                
                RealtimeService.socket.on('new-sos-alert', (sosData) => {
                    const emergencies = Storage.get(Storage.KEYS.EMERGENCIES, []);
                    const exists = emergencies.some(e => e.id === sosData.id);
                    if (!exists) {
                        emergencies.unshift(sosData);
                        Storage.set(Storage.KEYS.EMERGENCIES, emergencies);
                    }
                    if (window.Utils) {
                        Utils.showToast(`🚨 SOS Alert: ${sosData.type} at ${sosData.location}`, 'error');
                    }
                    if (window.IncidentCenter) {
                        IncidentCenter.refresh();
                    }
                });

                socketBound = true;
            }
        };
        bindSocket();
        setInterval(bindSocket, 1000);

        // Load initial positions from dynamic backend url
        const backendUrl = window.NHAI_CONFIG?.backend?.url || 'http://localhost:3000';
        fetch(`${backendUrl}/api/active-journeys`)
            .then(res => res.json())
            .then(data => {
                for (const tripId in data) {
                    AdminApp.updateVehicleMarker({ tripId, ...data[tripId] });
                }
            })
            .catch(() => console.log('Active journeys server offline'));
    },

    initMap: () => {
        const mapEl = document.getElementById('admin-live-map');
        if (!mapEl) return;

        AdminApp.map = L.map('admin-live-map', {
            zoomControl: true,
            attributionControl: true,
            center: [20.5937, 78.9629],
            zoom: 5,
            worldCopyJump: true
        });

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
        }).addTo(AdminApp.map);
    },

    updateVehicleMarker: (data) => {
        const { tripId, lat, lng } = data;
        if (!AdminApp.map || !lat || !lng) return;
        
        if (AdminApp.vehicleMarkers[tripId]) {
            AdminApp.vehicleMarkers[tripId].setLatLng([lat, lng]);
        } else {
            const icon = L.divIcon({
                className: '',
                html: `<div style="background:#3b82f6; width:12px; height:12px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 6px #3b82f6;"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            });
            const m = L.marker([lat, lng], { icon })
                .bindTooltip(`Vehicle: ${tripId}`, { permanent: false, sticky: true })
                .addTo(AdminApp.map);
            AdminApp.vehicleMarkers[tripId] = m;
        }
    },

    incidentMarkers: {},

    renderIncidentMarkers: () => {
        if (!AdminApp.map) return;

        const emergencies = Storage.get(Storage.KEYS.EMERGENCIES, []);
        
        // Remove markers for emergencies that are no longer in storage or resolved
        const currentIds = emergencies.map(e => e.id);
        Object.keys(AdminApp.incidentMarkers).forEach(id => {
            if (!currentIds.includes(id)) {
                AdminApp.map.removeLayer(AdminApp.incidentMarkers[id]);
                delete AdminApp.incidentMarkers[id];
            }
        });

        // Add/Update markers
        emergencies.forEach(e => {
            if (e.status === 'RESOLVED' || e.status === 'CLOSED') {
                if (AdminApp.incidentMarkers[e.id]) {
                    AdminApp.map.removeLayer(AdminApp.incidentMarkers[e.id]);
                    delete AdminApp.incidentMarkers[e.id];
                }
                return;
            }

            let lat = 20.5937;
            let lng = 78.9629;
            let found = false;

            if (window.IndiaMapData) {
                const query = e.location.toLowerCase();
                for (const code in IndiaMapData.nodes) {
                    const node = IndiaMapData.nodes[code];
                    if (query.includes(node.name.toLowerCase()) || node.name.toLowerCase().includes(query)) {
                        lat = node.lat;
                        lng = node.lng;
                        found = true;
                        break;
                    }
                }
                if (!found && IndiaMapData.cities) {
                    const city = IndiaMapData.cities.find(c => query.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(query));
                    if (city) {
                        lat = city.lat;
                        lng = city.lng;
                        found = true;
                    }
                }
            }

            if (!found) {
                const seed = e.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
                lat = 20.5937 + ((seed % 100) - 50) * 0.05;
                lng = 78.9629 + (((seed >> 2) % 100) - 50) * 0.05;
            }

            const statusColors = {
                'RAISED': '#ef4444',
                'ACKNOWLEDGED': '#f59e0b',
                'DISPATCHED': '#0ea5e9'
            };
            const color = statusColors[e.status] || '#ef4444';

            if (AdminApp.incidentMarkers[e.id]) {
                AdminApp.incidentMarkers[e.id].setLatLng([lat, lng]);
            } else {
                const icon = L.divIcon({
                    className: '',
                    html: `
                        <div style="position: relative; width: 18px; height: 18px;">
                            <div style="position: absolute; width: 18px; height: 18px; background: ${color}; border-radius: 50%; animation: radarPulse 1.5s infinite; opacity: 0.6;"></div>
                            <div style="position: absolute; top: 4px; left: 4px; width: 10px; height: 10px; background: ${color}; border-radius: 50%; border: 1.5px solid #fff; box-shadow: 0 0 6px ${color};"></div>
                        </div>
                    `,
                    iconSize: [18, 18],
                    iconAnchor: [9, 9]
                });

                const marker = L.marker([lat, lng], { icon })
                    .bindPopup(`
                        <div style="font-family: 'Space Grotesk', sans-serif; font-size: 11px; padding: 2px;">
                            <strong style="color: ${color}; font-size:12px; display:block; margin-bottom:4px;">🚨 SOS [${e.id}]</strong>
                            <strong style="color:#fff;">Type:</strong> ${e.type}<br>
                            <strong style="color:#fff;">Loc:</strong> ${e.location}<br>
                            <strong style="color:#fff;">Desc:</strong> ${e.description || 'No description'}<br>
                            <strong style="color:#fff;">Status:</strong> <span style="color:${color};font-weight:700;">${e.status}</span>
                        </div>
                    `, { className: 'admin-map-popup' })
                    .addTo(AdminApp.map);

                AdminApp.incidentMarkers[e.id] = marker;
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AdminApp.init();
});
