const TrafficEngine = {
    trafficLayer: null,
    trafficMarkers: new Map(),

    init: () => {
        // Wait for RealtimeService to be ready
        if (window.RealtimeService) {
            TrafficEngine.setupSocketListeners();
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                if (window.RealtimeService) TrafficEngine.setupSocketListeners();
            });
        }
    },

    setupSocketListeners: () => {
        const socket = RealtimeService.socket;
        if (!socket) return;

        // Listen for live traffic intensity updates
        socket.on('traffic-update', (data) => {
            console.log('[Traffic] Live Update:', data);
            TrafficEngine.updateTrafficOnMap(data);
        });

        // Listen for live congestion reports
        socket.on('congestion-alert', (alert) => {
            Utils.showToast(`Traffic Alert: ${alert.location}`, 'warning');
            TrafficEngine.addCongestionMarker(alert);
        });
    },

    updateTrafficOnMap: (data) => {
        // data: { segmentId, intensity, color }
        // In a real app, this would update polyline colors on the map
        // For now, we'll log it and ensure the map reflects the change
        const polyline = IndiaMapPlanner.routeLines?.find(p => p.segmentId === data.segmentId);
        if (polyline) {
            polyline.setStyle({ color: data.color, weight: 8 });
        }
    },

    addCongestionMarker: (alert) => {
        if (!window.map) return;

        // alert: { id, lat, lng, type, severity }
        if (TrafficEngine.trafficMarkers.has(alert.id)) {
            TrafficEngine.trafficMarkers.get(alert.id).remove();
        }

        const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color:${alert.severity === 'HIGH' ? '#ff4444' : '#ffbb33'}; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });

        const marker = L.marker([alert.lat, alert.lng], { icon: icon })
            .bindPopup(`<strong>${alert.type}</strong><br>${alert.message || 'Heavy traffic reported'}`)
            .addTo(map);

        TrafficEngine.trafficMarkers.set(alert.id, marker);

        // Auto-remove marker after 5 minutes if it's a live update
        setTimeout(() => {
            marker.remove();
            TrafficEngine.trafficMarkers.delete(alert.id);
        }, 300000);
    },

    // Simulate sending data (for testing)
    simulateTrafficData: () => {
        if (window.RealtimeService && RealtimeService.socket) {
            RealtimeService.socket.emit('admin-broadcast', {
                type: 'TRAFFIC',
                title: 'Congestion Near Panipat',
                message: 'Heavy traffic due to construction. Expect 20 min delay.',
                timestamp: new Date().toISOString()
            });
        }
    }
};

window.TrafficEngine = TrafficEngine;
TrafficEngine.init();
