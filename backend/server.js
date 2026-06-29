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
app.post('/api/auth/login', (req, res) => {
    const { id, pass } = req.body;
    const adminCreds = {
        id: process.env.ADMIN_ID || 'admin@nhai',
        pass: process.env.ADMIN_PASS || 'NHAI@2026'
    };

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

    // Join a specific vehicle trip for updates
    socket.on('join-trip', (tripId) => {
        socket.join(tripId);
        console.log(`Socket ${socket.id} joined trip ${tripId}`);
    });

    // Handle SOS alerts from user to broadcast to admin
    socket.on('send-sos', (sosData) => {
        console.log('SOS Received:', sosData);
        io.emit('new-sos-alert', {
            ...sosData,
            serverTimestamp: new Date().toISOString()
        });
    });

    // Handle Admin Broadcasts (Traffic, Weather, etc)
    socket.on('admin-broadcast', (data) => {
        const validToken = process.env.ADMIN_TOKEN || 'NHAI_ADMIN';
        if (!data.token || data.token !== validToken) {
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
});
