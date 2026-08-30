/**
 * NHAI Smart Highway Platform - Central Config
 * @version 2.0
 * India-only routing & services configuration
 */
const NHAI_CONFIG = {

    /* ── MAP ──────────────────────────────────────────────── */
    map: {
        defaultCenter: [20.5937, 78.9629],   // Centre of India
        defaultZoom: 5,
        minZoom: 4,
        maxZoom: 19,
        worldCopyJump: false,
        // Soft India bounding box (enforced in UI)
        bounds: {
            north: 39.0,
            south: 3.5,
            west: 60.0,
            east: 102.0
        }
    },
    
    /* ── TILE LAYERS ──────────────────────────────────────── */
    tiles: {
        satellite: {
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            options: { maxZoom: 19, maxNativeZoom: 17, attribution: 'Tiles &copy; Esri', noWrap: false }
        },
        labels: {
            // Transparent label overlay on top of satellite
            url: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png',
            options: { maxZoom: 19, pane: 'shadowPane', opacity: 0.8, noWrap: false }
        },
        street: {
            url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            options: { maxZoom: 20, subdomains: ['a', 'b', 'c', 'd'], attribution: '&copy; OSM &copy; CARTO', noWrap: false }
        }
    },

    /* ── ROUTING (OSRM public demo — India capable) ───────── */
    routing: {
        baseUrl: 'https://router.project-osrm.org/route/v1/driving',
        alternatives: false,         // single optimal NH route only
        maxAlternatives: 0,
        overview: 'full',
        geometries: 'geojson',
        steps: true,
        // Corridor radius (km) for toll matching
        tollCorridorKm: 2.5
    },

    /* ── GEOCODING (Nominatim — free, OSM-based) ──────────── */
    geocoding: {
        baseUrl: 'https://nominatim.openstreetmap.org/search',
        // Restrict results to India
        countryCodes: 'in',
        limit: 8,
        format: 'json',
        addressdetails: 1
    },

    /* ── ON-ROUTE SERVICES (Overpass API — OSM) ────────────── */
    services: {
        overpassUrl: 'https://overpass-api.de/api/interpreter',
        // Sample points along route for service search
        sampleEveryKm: 80,
        maxSamplesPerSearch: 6,
        searchRadiusKm: 5,
        maxResultsPerCategory: 4,
        categories: [
            { key: 'hospital',      icon: '🏥', label: 'Hospital',       tags: 'amenity=hospital' },
            { key: 'fuel',          icon: '⛽', label: 'Petrol Pump',    tags: 'amenity=fuel' },
            { key: 'hotel',         icon: '🏨', label: 'Hotel',          tags: 'tourism=hotel' },
            { key: 'restaurant',    icon: '🍽️', label: 'Restaurant',     tags: 'amenity=restaurant' },
            { key: 'police',        icon: '🚔', label: 'Police Station', tags: 'amenity=police' },
            { key: 'car_repair',    icon: '🔧', label: 'Mechanic',       tags: 'shop=car_repair' },
            { key: 'rest_area',     icon: '🛑', label: 'Rest Area',      tags: 'highway=rest_area' }
        ]
    },

    /* ── TRIP SIMULATION ──────────────────────────────────── */
    trip: {
        intervalMs: 400,       // step update interval
        pointsPerStep: null    // computed dynamically based on route length
    },

    /* ── SECURE BACKEND CONFIGURATION ──────────────────────── */
    backend: {
        // Direct connection to deployed backend on Render (with localhost dev override)
        url: (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost' && window.location.port === '3000')
            ? 'http://localhost:3000'
            : 'https://smart-national-highway-operations.onrender.com'
    }
};

window.NHAI_CONFIG = NHAI_CONFIG;

// Automated Background Backend Warmup & Keep-Alive (Prevents Render cold-start sleep during demos)
(function initBackendWarmup() {
    if (typeof window === 'undefined') return;
    const ping = () => {
        const backendUrl = window.NHAI_CONFIG?.backend?.url || 'https://smart-national-highway-operations.onrender.com';
        try {
            fetch(`${backendUrl}/health`, { mode: 'cors', cache: 'no-cache' }).catch(() => {});
        } catch (e) {}
    };
    ping();
    setInterval(ping, 4 * 60 * 1000); // 4-minute interval
})();
