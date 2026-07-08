const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const rateLimit = require('express-rate-limit');
app.use(rateLimit({ windowMs: 60000, max: 600 }));

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 login requests per windowMs
    message: { error: 'Too many login attempts. Please try again after 15 minutes.' }
});

// Path to file database
const DB_PATH = path.join(__dirname, 'db.json');

// Prune database logs to keep size stable
function pruneDB(db) {
    if (db.nhai_vehicle_logs && db.nhai_vehicle_logs.length > 1000) {
        db.nhai_vehicle_logs = db.nhai_vehicle_logs.slice(0, 1000);
    }
    if (db.nhai_trip_history && db.nhai_trip_history.length > 500) {
        db.nhai_trip_history = db.nhai_trip_history.slice(0, 500);
    }
    if (db.nhai_admin_alerts && db.nhai_admin_alerts.length > 100) {
        db.nhai_admin_alerts = db.nhai_admin_alerts.slice(0, 100);
    }
    return db;
}

// Initialize database with default SNHOP schema
function loadDB() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('[DB] Error loading database:', e);
    }
    return {
        nhai_trip_history: [],
        nhai_recharge_history: [],
        nhai_fastag_balance: 1500,
        nhai_emergencies: [],
        nhai_admin_alerts: [],
        nhai_vehicle_logs: [],
        nhai_toll_states: {},
        nhai_active_trips: [],
        nhai_user_profile: null,
        nhai_face_auth_time: null,
        nhai_face_auth_interval: 12 // Default 12 hours
    };
}

function saveDB(db) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(pruneDB(db), null, 2), 'utf8');
    } catch (e) {
        console.error('[DB] Error saving database:', e);
    }
}

// Ensure database file is initialized on startup
saveDB(loadDB());

// Store active admin sessions in memory (token -> { createdAt })
const activeAdminSessions = new Map();

// Active vehicle tracking sessions in memory
const activeJourneys = new Map();

// Clean up journeys older than 6 hours
setInterval(() => {
    const cutoff = Date.now() - (6 * 60 * 60 * 1000);
    for (const [tripId, data] of activeJourneys.entries()) {
        if (data.lastUpdate < cutoff) {
            activeJourneys.delete(tripId);
        }
    }
}, 30 * 60 * 1000);

// API Endpoints for DB Synchronization
app.get('/api/db', (req, res) => {
    const token = req.headers['x-admin-token'] || req.query.token;
    const session = token ? activeAdminSessions.get(token) : null;
    const SESSION_HOURS = 8;

    const db = loadDB();
    // Return full DB for authenticated admin, filtered version for users
    if (session && Date.now() - session.createdAt <= SESSION_HOURS * 3600 * 1000) {
        return res.json(db);
    }

    const publicDB = {
        nhai_trip_history: db.nhai_trip_history || [],
        nhai_recharge_history: db.nhai_recharge_history || [],
        nhai_fastag_balance: db.nhai_fastag_balance !== undefined ? db.nhai_fastag_balance : 1500,
        nhai_emergencies: db.nhai_emergencies || [],
        nhai_admin_alerts: db.nhai_admin_alerts || [],
        nhai_active_trips: db.nhai_active_trips || [],
        nhai_user_profile: db.nhai_user_profile || null,
        nhai_face_auth_time: db.nhai_face_auth_time || null,
        nhai_face_auth_interval: db.nhai_face_auth_interval || 12
    };
    res.json(publicDB);
});

// Admin-only keys that require session tokens
const ADMIN_KEYS = ['nhai_admin_alerts', 'nhai_vehicle_logs', 'nhai_toll_states'];

app.post('/api/db/update', (req, res) => {
    const { key, value, token } = req.body;
    if (!key) return res.status(400).json({ error: 'Missing key parameter' });
    
    // Security validation on key prefix
    if (!key.startsWith('nhai_')) {
        return res.status(400).json({ error: 'Unauthorized key modification' });
    }

    // Require token check for admin specific updates
    if (ADMIN_KEYS.includes(key)) {
        const session = token ? activeAdminSessions.get(token) : null;
        const SESSION_HOURS = 8;
        if (!session || Date.now() - session.createdAt > SESSION_HOURS * 3600 * 1000) {
            if (token) activeAdminSessions.delete(token);
            return res.status(403).json({ error: 'Forbidden' });
        }
    }

    // Basic validation for nhai_fastag_balance
    // NOTE: In a real system, balance changes should be derived server-side from validated
    // recharge/toll-deduction events, not accepted as a raw client-supplied number.
    // This validation is a stop-gap for the demo, not a substitute for a secure ledger redesign.
    if (key === 'nhai_fastag_balance') {
        if (typeof value !== 'number' || isNaN(value) || value < 0 || value > 1000000) {
            return res.status(400).json({ error: 'Invalid balance amount. Must be a numeric value between 0 and 1,000,000.' });
        }
    }

    const db = loadDB();
    db[key] = value;
    saveDB(db);

    // Broadcast the update to all active tabs
    io.emit('db-update', { key, value });
    res.json({ success: true });
});

// Admin API active-journeys for map plotting
app.get('/api/active-journeys', (req, res) => {
    const journeys = {};
    for (const [tripId, data] of activeJourneys.entries()) {
        journeys[tripId] = { lat: data.lat, lng: data.lng, lastUpdate: data.lastUpdate };
    }
    res.json(journeys);
});

// Secure API endpoints for Admin Authentication
app.post('/api/auth/login', loginLimiter, (req, res) => {
    const { id, pass } = req.body;
    const adminCreds = {
        id: process.env.ADMIN_ID || 'admin@nhai',
        pass: process.env.ADMIN_PASS || 'NHAI@2026'
    };

    // NOTE: In a production environment, passwords should be securely hashed (e.g. using bcrypt)
    // and compared using constant-time comparison algorithms rather than plain-text comparison.
    if (id === adminCreds.id && pass === adminCreds.pass) {
        const token = crypto.randomBytes(24).toString('hex');
        activeAdminSessions.set(token, { createdAt: Date.now() });
        res.json({ success: true, token });
    } else {
        res.status(401).json({ error: 'ACCESS DENIED. Invalid Credentials.' });
    }
});

app.post('/api/auth/verify', (req, res) => {
    const { token } = req.body;
    const session = token ? activeAdminSessions.get(token) : null;
    const SESSION_HOURS = 8;
    if (session && Date.now() - session.createdAt <= SESSION_HOURS * 3600 * 1000) {
        res.json({ valid: true });
    } else {
        if (token) activeAdminSessions.delete(token);
        res.status(401).json({ valid: false });
    }
});

app.post('/api/auth/logout', (req, res) => {
    const { token } = req.body;
    if (token) activeAdminSessions.delete(token);
    res.json({ success: true });
});

// App Health
app.get('/health', (req, res) => {
    res.json({ 
        status: 'NHAI Secure Backend Live', 
        sessions: activeJourneys.size, 
        dbSize: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0 
    });
});

// Serve frontend static files from the parent directory
app.use(express.static(path.join(__dirname, '..')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join admin room for authenticated dashboards
    socket.on('join-admin-room', (data) => {
        const token = data ? data.token : null;
        const session = token ? activeAdminSessions.get(token) : null;
        const SESSION_HOURS = 8;
        if (session && Date.now() - session.createdAt <= SESSION_HOURS * 3600 * 1000) {
            socket.join('admins');
            console.log(`Socket ${socket.id} joined admins room`);
        } else {
            socket.emit('error', 'Unauthorized to join admins room');
        }
    });

    // Join a specific vehicle trip for updates
    socket.on('join-trip', (tripId) => {
        socket.join(tripId);
        console.log(`Socket ${socket.id} joined trip ${tripId}`);
    });

    // Handle SOS alerts from user to broadcast to admin
    socket.on('send-sos', (sosData) => {
        console.log('SOS Received:', sosData);
        io.to('admins').emit('new-sos-alert', {
            ...sosData,
            serverTimestamp: new Date().toISOString()
        });
    });

    // Handle Admin Broadcasts (Traffic, Weather, etc)
    socket.on('admin-broadcast', (data) => {
        const token = data ? data.token : null;
        const session = token ? activeAdminSessions.get(token) : null;
        const SESSION_HOURS = 8;
        if (!session || Date.now() - session.createdAt > SESSION_HOURS * 3600 * 1000) {
            if (token) activeAdminSessions.delete(token);
            socket.emit('error', 'Unauthorized');
            return;
        }
        console.log('Admin Broadcast:', data.alertData);
        io.emit('broadcast-alert', { ...data.alertData });
    });

    // Live Vehicle Position Tracking
    socket.on('update-position', (data) => {
        const { tripId, lat, lng } = data;
        activeJourneys.set(tripId, { lat, lng, lastUpdate: Date.now() });
        // Emit only to rooms where admins monitor this specific vehicle/trip
        socket.to(tripId).emit('vehicle-moved', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`NHAI Real-time Server running on http://localhost:${PORT}`);
    
    // Log warnings if insecure default credentials are used
    if (!process.env.ADMIN_ID || !process.env.ADMIN_PASS) {
        console.warn('\n============================================================');
        console.warn('⚠️  WARNING: Insecure default admin credentials configuration!');
        if (!process.env.ADMIN_ID) {
            console.warn(' - process.env.ADMIN_ID is missing. Falling back to default: "admin@nhai"');
        }
        if (!process.env.ADMIN_PASS) {
            console.warn(' - process.env.ADMIN_PASS is missing. Falling back to default: "NHAI@2026"');
        }
        console.warn(' This fallback configuration is only intended for local development.');
        console.warn(' For production deployment, set ADMIN_ID and ADMIN_PASS environment variables.');
        console.warn('============================================================\n');
    }
});
