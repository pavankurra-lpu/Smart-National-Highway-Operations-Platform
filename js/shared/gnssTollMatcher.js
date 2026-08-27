const GNSSTollMatcher = {
    EARTH_RADIUS_KM: 6371.0088,

    toRad: (deg) => (deg * Math.PI) / 180.0,
    toDeg: (rad) => (rad * 180.0) / Math.PI,

    haversineKm: (lat1, lon1, lat2, lon2) => {
        const dLat = GNSSTollMatcher.toRad(lat2 - lat1);
        const dLon = GNSSTollMatcher.toRad(lon2 - lon1);
        const rLat1 = GNSSTollMatcher.toRad(lat1);
        const rLat2 = GNSSTollMatcher.toRad(lat2);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(rLat1) * Math.cos(rLat2) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return GNSSTollMatcher.EARTH_RADIUS_KM * c;
    },

    calculateBearing: (lat1, lon1, lat2, lon2) => {
        const rLat1 = GNSSTollMatcher.toRad(lat1);
        const rLat2 = GNSSTollMatcher.toRad(lat2);
        const dLon = GNSSTollMatcher.toRad(lon2 - lon1);

        const y = Math.sin(dLon) * Math.cos(rLat2);
        const x = Math.cos(rLat1) * Math.sin(rLat2) -
                  Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLon);
        const brng = GNSSTollMatcher.toDeg(Math.atan2(y, x));
        return (brng + 360.0) % 360.0;
    },

    crossTrackDistanceKm: (pLat, pLon, aLat, aLon, bLat, bLon) => {
        const d13 = GNSSTollMatcher.haversineKm(aLat, aLon, pLat, pLon) / GNSSTollMatcher.EARTH_RADIUS_KM;
        const brng13 = GNSSTollMatcher.toRad(GNSSTollMatcher.calculateBearing(aLat, aLon, pLat, pLon));
        const brng12 = GNSSTollMatcher.toRad(GNSSTollMatcher.calculateBearing(aLat, aLon, bLat, bLon));

        const dXt = Math.asin(Math.sin(d13) * Math.sin(brng13 - brng12));
        return Math.abs(dXt * GNSSTollMatcher.EARTH_RADIUS_KM);
    },

    isPointInCorridor: (toll, pA, pB, maxCorridorWidthKm = 0.12) => {
        const distA = GNSSTollMatcher.haversineKm(toll.lat, toll.lng, pA[0], pA[1]);
        const distB = GNSSTollMatcher.haversineKm(toll.lat, toll.lng, pB[0], pB[1]);
        const segmentLen = GNSSTollMatcher.haversineKm(pA[0], pA[1], pB[0], pB[1]);

        if (distA > segmentLen + maxCorridorWidthKm || distB > segmentLen + maxCorridorWidthKm) {
            return false;
        }

        const xte = GNSSTollMatcher.crossTrackDistanceKm(toll.lat, toll.lng, pA[0], pA[1], pB[0], pB[1]);
        return xte <= maxCorridorWidthKm;
    },

    matchRouteTolls: (routeCoords, tollPlazas, options = {}) => {
        if (!Array.isArray(routeCoords) || routeCoords.length < 2 || !Array.isArray(tollPlazas)) {
            return [];
        }

        const corridorWidthKm = options.corridorWidthKm || 0.15;
        const candidateRadiusKm = options.candidateRadiusKm || 1.2;
        const matchedTolls = [];
        const seenTollIds = new Set();

        const lats = routeCoords.map(c => c[0]);
        const lngs = routeCoords.map(c => c[1]);
        const minLat = Math.min(...lats) - 0.05;
        const maxLat = Math.max(...lats) + 0.05;
        const minLng = Math.min(...lngs) - 0.05;
        const maxLng = Math.max(...lngs) + 0.05;

        const candidatePlazas = tollPlazas.filter(t => {
            return t.lat >= minLat && t.lat <= maxLat && t.lng >= minLng && t.lng <= maxLng;
        });

        for (const toll of candidatePlazas) {
            const tollId = toll.id || `${toll.lat.toFixed(4)}_${toll.lng.toFixed(4)}`;
            if (seenTollIds.has(tollId)) continue;

            for (let i = 0; i < routeCoords.length - 1; i++) {
                const pA = routeCoords[i];
                const pB = routeCoords[i + 1];

                const coarseDist = GNSSTollMatcher.haversineKm(toll.lat, toll.lng, pA[0], pA[1]);
                if (coarseDist > candidateRadiusKm) {
                    continue;
                }

                if (GNSSTollMatcher.isPointInCorridor(toll, pA, pB, corridorWidthKm)) {
                    const segmentBearing = GNSSTollMatcher.calculateBearing(pA[0], pA[1], pB[0], pB[1]);
                    matchedTolls.push({
                        ...toll,
                        matchedSegmentIndex: i,
                        trajectoryBearing: segmentBearing,
                        crossTrackOffsetKm: GNSSTollMatcher.crossTrackDistanceKm(toll.lat, toll.lng, pA[0], pA[1], pB[0], pB[1])
                    });
                    seenTollIds.add(tollId);
                    break;
                }
            }
        }

        return matchedTolls.sort((a, b) => a.matchedSegmentIndex - b.matchedSegmentIndex);
    },

    confirmGantryCrossing: (vehicleTelemetry, gantryConfig) => {
        const { currentLat, currentLng, speedKmph, headingDeg } = vehicleTelemetry;
        const { gantryLat, gantryLng, gantryBearingDeg, radiusMeters = 80 } = gantryConfig;

        const distKm = GNSSTollMatcher.haversineKm(currentLat, currentLng, gantryLat, gantryLng);
        const distMeters = distKm * 1000.0;

        if (distMeters > radiusMeters) {
            return { confirmed: false, reason: 'OUT_OF_GEOFENCE', distanceMeters: distMeters };
        }

        if (gantryBearingDeg !== undefined && headingDeg !== undefined) {
            let angleDiff = Math.abs(headingDeg - gantryBearingDeg) % 360.0;
            if (angleDiff > 180.0) angleDiff = 360.0 - angleDiff;

            if (angleDiff > 45.0 && Math.abs(angleDiff - 180.0) > 45.0) {
                return { confirmed: false, reason: 'HEADING_MISMATCH', angleDiff, distanceMeters: distMeters };
            }
        }

        return {
            confirmed: true,
            distanceMeters: distMeters,
            speedKmph: speedKmph || 0,
            confidence: Math.max(0.85, 1.0 - (distMeters / radiusMeters) * 0.15)
        };
    }
};

if (typeof window !== 'undefined') {
    window.GNSSTollMatcher = GNSSTollMatcher;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GNSSTollMatcher;
}
