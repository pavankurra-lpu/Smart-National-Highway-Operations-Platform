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
app.use(rateLimit({ windowMs: 60000, max: 200 }));

// Path to file database
const DB_PATH = path.join(__dirname, 'db.json');

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
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
    } catch (e) {
        console.error('[DB] Error saving database:', e);
    }
}

// Ensure database file is initialized on startup
saveDB(loadDB());

// Store active admin sessions in memory
const activeAdminSessions = new Set();

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
    res.json(loadDB());
});

app.post('/api/db/update', (req, res) => {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'Missing key parameter' });
    
    // Security validation on key prefix
    if (!key.startsWith('nhai_')) {
        return res.status(400).json({ error: 'Unauthorized key modification' });
    }

    const db = loadDB();
    db[key] = value;
    saveDB(db);

    // Broadcast the update to all active tabs
    io.emit('db-update', { key, value });
    res.json({ success: true });
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
        activeAdminSessions.add(token);
        res.json({ success: true, token });
    } else {
        res.status(401).json({ error: 'ACCESS DENIED. Invalid Credentials.' });
    }
});

app.post('/api/auth/verify', (req, res) => {
    const { token } = req.body;
    if (token && activeAdminSessions.has(token)) {
        res.json({ valid: true });
    } else {
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
        socket.to(tripId).emit('vehicle-moved', data);
        io.emit('vehicle-moved', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`NHAI Real-time Server running on http://localhost:${PORT}`);
});
