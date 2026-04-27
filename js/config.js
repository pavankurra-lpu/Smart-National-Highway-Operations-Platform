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
        // Soft India bounding box (enforced in UI)
        bounds: {
            north: 37.6,
            south: 6.5,
            west: 68.0,
            east: 97.5
        }
    },
/* ── TILE LAYERS ──────────────────────────────────────── */
    tiles: {
        satellite: {
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            options: { maxZoom: 19, attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN' }
        },
        labels: {
            // Transparent label overlay on top of satellite
            url: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
            options: { maxZoom: 19, pane: 'shadowPane', opacity: 0.8 }
        },
        street: {
            url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            options: { maxZoom: 19 }
        }
    },

    /* ── ROUTING (OSRM public demo — India capable) ───────── */
    routing: {
        // OSRM public demo server — real roads, supports India
        baseUrl: 'https://router.project-osrm.org/route/v1/driving',
        alternatives: true,          // ask for up to 3 alternatives
        maxAlternatives: 2,
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

    /* ── ROUTE DISPLAY ────────────────────────────────────── */
    route: {
        primary: { color: '#3b82f6', weight: 6, opacity: 0.90 },
        alternate1: { color: '#6366f1', weight: 4, opacity: 0.65, dashArray: '8 4' },
        alternate2: { color: '#8b5cf6', weight: 4, opacity: 0.55, dashArray: '6 4' }
    },

    /* ── TRIP SIMULATION ──────────────────────────────────── */
    trip: {
        intervalMs: 400,       // step update interval
        pointsPerStep: null    // computed dynamically based on route length
    },

    /* ── ADMIN CREDENTIALS (SECURITY NOTE: Demo only) ──────── */
    admin: {
        id: 'admin@nhai',
        pass: 'NHAI@2026'
    }
};

window.NHAI_CONFIG = NHAI_CONFIG;
