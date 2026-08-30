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

                // Auto close mobile drawer
                const sidebar = document.querySelector('.admin-sidebar');
                const backdrop = document.getElementById('admin-sidebar-backdrop');
                if (sidebar) sidebar.classList.remove('open');
                if (backdrop) backdrop.classList.remove('active');
            });
        });

        // Setup Plaza Access
        AdminApp.plaza = sessionStorage.getItem('admin_plaza') || 'ALL';
        let plazaData = null;
        try {
            const raw = sessionStorage.getItem('admin_plaza_data');
            if (raw) plazaData = JSON.parse(raw);
        } catch(e){}
        AdminApp.plazaData = plazaData;

        const badge = document.getElementById('admin-region-badge');
        if (badge) {
            if (AdminApp.plaza === 'ALL') {
                badge.innerHTML = '<i class="fa-solid fa-earth-asia"></i> ALL INDIA (SUPER ADMIN)';
                badge.style.background = 'rgba(16, 185, 129, 0.15)';
                badge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                badge.style.color = '#10b981';
            } else {
                const sub = plazaData?.state ? ` (${plazaData.state})` : '';
                badge.innerHTML = `<i class="fa-solid fa-map-pin"></i> ${AdminApp.plaza.toUpperCase()}${sub}`;
                badge.style.background = 'rgba(16, 185, 129, 0.18)';
                badge.style.borderColor = 'rgba(16, 185, 129, 0.45)';
                badge.style.color = '#34d399';
            }
        }

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
        AdminApp.renderBroadcastCircles();

        // Listen for user actions dynamically
        window.addEventListener('local-storage-update', () => {
            Analytics.refresh();
            IncidentCenter.refresh();
            SpecialVehicleControl.refresh();
            AdminApp.renderIncidentMarkers();
            AdminApp.renderBroadcastCircles();
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
            .catch(() => {});
    },

    initMap: () => {
        const mapEl = document.getElementById('admin-live-map');
        if (!mapEl) return;

        // Determine Assigned Toll Plaza (Defaults to assigned plaza or flagship NHAI Plaza)
        let activePlaza = AdminApp.plazaData;
        if ((!activePlaza || !activePlaza.lat) && window.TollSeedData && window.TollSeedData.length > 0) {
            activePlaza = window.TollSeedData.find(t => t.id === 'TP_1' || t.name.includes('Kherki') || t.name.includes('Western')) || window.TollSeedData[0];
            AdminApp.plazaData = activePlaza;
        }

        const center = (activePlaza && activePlaza.lat && activePlaza.lng) ? [activePlaza.lat, activePlaza.lng] : [28.3986, 76.9856];
        const zoom = 16; // Locked high-detail toll plaza area zoom

        const indiaBounds = L.latLngBounds([3.5, 60.0], [39.0, 102.0]);
        AdminApp.map = L.map('admin-live-map', {
            zoomControl: true,
            attributionControl: false,
            center: center,
            zoom: zoom,
            minZoom: 4,
            maxZoom: 19,
            maxBounds: indiaBounds,
            maxBoundsViscosity: 0.85,
            worldCopyJump: false
        });

        // High-Definition Satellite Imagery Layer (Esri World Imagery)
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            minZoom: 4,
            attribution: 'Esri Satellite'
        }).addTo(AdminApp.map);

        // High-Contrast Road & City Labels Overlay on Satellite
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            minZoom: 4,
            subdomains: 'abcd',
            opacity: 0.95
        }).addTo(AdminApp.map);

        // Render Current Assigned Toll Plaza Area Marker & Geofence
        AdminApp.renderPlazaArea(activePlaza);

        // Populate Admin Toll Plaza Switcher dropdown
        AdminApp.initPlazaSwitcher(activePlaza?.id);

        // Invalidate size to ensure complete canvas render
        setTimeout(() => {
            if (AdminApp.map) AdminApp.map.invalidateSize();
        }, 250);
        window.addEventListener('resize', () => {
            if (AdminApp.map) AdminApp.map.invalidateSize();
        });
    },

    plazaMarker: null,
    plazaCircle: null,

    renderPlazaArea: (plaza) => {
        if (!AdminApp.map || !plaza || !plaza.lat || !plaza.lng) return;

        if (AdminApp.plazaMarker) try { AdminApp.map.removeLayer(AdminApp.plazaMarker); } catch(e){}
        if (AdminApp.plazaCircle) try { AdminApp.map.removeLayer(AdminApp.plazaCircle); } catch(e){}

        const tollIcon = L.divIcon({
            className: '',
            html: `<div style="background: #eab308; color:#090d10; width:38px; height:38px; border-radius:12px; border:2.5px solid #ffffff; box-shadow:0 0 24px rgba(234, 179, 8, 0.9); display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:900;">⛩️</div>`,
            iconSize: [38, 38],
            iconAnchor: [19, 19]
        });

        AdminApp.plazaCircle = L.circle([plaza.lat, plaza.lng], {
            radius: 800,
            color: '#eab308',
            weight: 2,
            dashArray: '6, 6',
            fillColor: '#eab308',
            fillOpacity: 0.08
        }).addTo(AdminApp.map);

        AdminApp.plazaMarker = L.marker([plaza.lat, plaza.lng], { icon: tollIcon, zIndexOffset: 1000 })
            .bindPopup(`
                <div style="font-family:'Inter',sans-serif; color:#f8fafc; background:#090d10; padding:8px 10px; border-radius:8px; min-width:180px;">
                    <div style="font-size:8.5px; color:#eab308; font-weight:800; text-transform:uppercase; letter-spacing:0.8px;">⛩️ ASSIGNED TOLL PLAZA</div>
                    <strong style="font-size:13px; color:#ffffff; display:block; margin:2px 0;">${plaza.name}</strong>
                    <div style="font-size:10px; color:#94a3b8;">${plaza.district ? plaza.district + ', ' : ''}${plaza.state || 'India'}</div>
                    <div style="margin-top:4px; font-size:10px; color:#34d399; font-weight:700;">${plaza.nhCorridor && plaza.nhCorridor !== 'N/A' ? 'Corridor: NH-' + plaza.nhCorridor : 'National Highway'}</div>
                    <div style="margin-top:2px; font-size:9.5px; color:#38bdf8;">● 8 FASTag RFID Electronic Lanes Active</div>
                </div>
            `)
            .addTo(AdminApp.map);

        AdminApp.plazaMarker.openPopup();
    },

    initPlazaSwitcher: (activeId) => {
        const sel = document.getElementById('admin-plaza-switcher');
        if (!sel || !window.TollSeedData) return;

        let html = '';
        window.TollSeedData.slice(0, 80).forEach(t => {
            const isSel = t.id === activeId ? 'selected' : '';
            html += `<option value="${t.id}" ${isSel}>⛩️ ${t.name} (${t.state || 'NHAI'})</option>`;
        });
        sel.innerHTML = html;
    },

    switchPlaza: (plazaId) => {
        const toll = window.TollSeedData?.find(t => t.id === plazaId);
        if (!toll || !toll.lat || !toll.lng || !AdminApp.map) return;

        AdminApp.plazaData = toll;
        AdminApp.map.flyTo([toll.lat, toll.lng], 16, { duration: 1.2 });
        AdminApp.renderPlazaArea(toll);

        const badge = document.getElementById('admin-region-badge');
        if (badge) {
            badge.innerHTML = `<i class="fa-solid fa-map-pin"></i> ${toll.name.toUpperCase()}`;
        }
    },

    updateVehicleMarker: (data) => {
        const { tripId, lat, lng } = data;
        if (!AdminApp.map || !lat || !lng) return;
        
        if (AdminApp.vehicleMarkers[tripId]) {
            AdminApp.vehicleMarkers[tripId].setLatLng([lat, lng]);
        } else {
            const icon = L.divIcon({
                className: '',
                html: `<div style="background:#10b981; width:12px; height:12px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 6px #10b981;"></div>`,
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
                'DISPATCHED': '#059669'
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
                        <div style="font-family: var(--font-display), sans-serif; font-size: 11px; padding: 2px;">
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
    },

    broadcastCircles: {},

    renderBroadcastCircles: () => {
        if (!AdminApp.map) return;
        const alerts = Storage.get(Storage.KEYS.ADMIN_ALERTS, []);

        // Remove old circles
        Object.values(AdminApp.broadcastCircles).forEach(c => {
            try { AdminApp.map.removeLayer(c); } catch(e){}
        });
        AdminApp.broadcastCircles = {};

        alerts.forEach(alert => {
            if (alert.lat && alert.lng && (alert.lat !== 20.5937 || alert.lng !== 78.9629)) {
                const radiusMeters = (alert.radiusKm || 10) * 1000;
                const color = alert.type === 'EMERGENCY' ? '#ef4444' : (alert.type === 'TRAFFIC' ? '#f59e0b' : '#10b981');
                
                const circle = L.circle([alert.lat, alert.lng], {
                    radius: radiusMeters,
                    color: color,
                    weight: 2,
                    fillColor: color,
                    fillOpacity: 0.12,
                    dashArray: '6, 6'
                }).bindPopup(`
                    <div style="font-family:'Inter',sans-serif; color:#090d10; padding:4px;">
                        <strong style="color:${color}; font-size:12px;">📡 10km Broadcast Geofence</strong><br>
                        <strong style="font-size:11.5px;">${alert.title}</strong><br>
                        <span style="font-size:11px; color:#64748b;">${alert.plaza || 'Toll Gate'} (${alert.radiusKm || 10}km Radius)</span>
                    </div>
                `).addTo(AdminApp.map);

                AdminApp.broadcastCircles[alert.id] = circle;
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AdminApp.init();
});
