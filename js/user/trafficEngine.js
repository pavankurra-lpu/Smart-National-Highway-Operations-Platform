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
        const polylines = IndiaMapPlanner.routePolylines || [];
        const polyline = polylines.find(p => p.segmentId === data.segmentId);
        if (polyline) {
            polyline.setStyle({ color: data.color, weight: 8 });
        }
    },

    addCongestionMarker: (alert) => {
        if (!IndiaMapPlanner || !IndiaMapPlanner.map) return;

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
            .addTo(IndiaMapPlanner.map);

        TrafficEngine.trafficMarkers.set(alert.id, marker);

        // Auto-remove marker after 5 minutes if it's a live update
        setTimeout(() => {
            marker.remove();
            TrafficEngine.trafficMarkers.delete(alert.id);
        }, 300000);
    },

    /**
     * Compute real-time highway corridor congestion from OSRM velocity & Open-Meteo weather
     * @param {number} distanceKm - Route distance in kilometers
     * @param {number} durationMin - Route estimated duration in minutes
     * @param {Object} [weather] - Real-time Open-Meteo weather parameters
     * @returns {Object} Physical congestion metrics, avg velocity, and delay projection
     */
    evaluateCorridorCongestion: (distanceKm, durationMin, weather) => {
        if (!distanceKm || !durationMin) return { score: 0.1, status: 'NORMAL', avgSpeedKmH: 80, delayMinutes: 0 };
        const avgSpeedKmH = distanceKm / (durationMin / 60);
        
        // National Highway Baseline Speed is ~85 km/h
        const baselineSpeed = 85.0;
        const speedRatio = Math.min(1.2, avgSpeedKmH / baselineSpeed);
        
        // Physical weather impedance from Open-Meteo
        let weatherImpedance = 0.0;
        if (weather) {
            if (weather.precipitation > 5.0 || weather.rain > 5.0) weatherImpedance += 0.15;
            if (weather.visibility && weather.visibility < 2000) weatherImpedance += 0.12;
        }

        const congestionScore = Math.min(1.0, Math.max(0.0, (1.0 - speedRatio * 0.85) + weatherImpedance));
        
        let status = 'NORMAL';
        if (congestionScore > 0.48) status = 'HIGH';
        else if (congestionScore > 0.25) status = 'MODERATE';

        return {
            score: parseFloat(congestionScore.toFixed(2)),
            status,
            avgSpeedKmH: Math.round(avgSpeedKmH),
            delayMinutes: Math.max(0, Math.round(durationMin - (distanceKm / (baselineSpeed / 60))))
        };
    },

    // Simulate sending data (for testing)
    simulateTrafficData: () => {
        if (window.RealtimeService && RealtimeService.socket) {
            RealtimeService.socket.emit('admin-broadcast', {
                token: 'NHAI_ADMIN',
                alertData: {
                    type: 'TRAFFIC',
                    title: 'Congestion Near Panipat',
                    message: 'Heavy traffic due to construction. Expect 20 min delay.',
                    region: 'Haryana',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
};

window.TrafficEngine = TrafficEngine;
TrafficEngine.init();
