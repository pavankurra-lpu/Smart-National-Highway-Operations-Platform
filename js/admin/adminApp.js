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

        // Listen for user actions dynamically
        window.addEventListener('local-storage-update', () => {
            Analytics.refresh();
            IncidentCenter.refresh();
            SpecialVehicleControl.refresh();
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

        // Bind socket listener for vehicle tracking
        let socketBound = false;
        const bindSocket = () => {
            if (socketBound) return;
            if (window.RealtimeService && window.RealtimeService.socket) {
                RealtimeService.socket.on('vehicle-moved', (data) => {
                    AdminApp.updateVehicleMarker(data);
                });
                socketBound = true;
            }
        };
        bindSocket();
        setInterval(bindSocket, 1000);

        // Load initial positions
        fetch('http://localhost:3000/api/active-journeys')
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
            zoom: 5
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
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AdminApp.init();
});
