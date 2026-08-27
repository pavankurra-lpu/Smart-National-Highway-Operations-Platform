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

// Salted Key Derivation for Secure Admin Authentication
const AUTH_SALT = process.env.AUTH_SALT || 'snhop-national-highway-secure-salt-2026';
function hashPassword(password) {
    return crypto.pbkdf2Sync(password, AUTH_SALT, 100000, 64, 'sha512').toString('hex');
}

// Configured admin credentials with cryptographic hash
const ADMIN_ID = process.env.ADMIN_ID || 'admin@nhai';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_HASH || hashPassword(process.env.ADMIN_PASS || 'NHAI@2026');

// In-memory failed login tracking for lockout protection
const failedLogins = new Map(); // ip -> { count, lockedUntil }

function checkLoginLockout(ip) {
    const record = failedLogins.get(ip);
    if (!record) return { locked: false };
    if (record.lockedUntil && Date.now() < record.lockedUntil) {
        const remainingSec = Math.ceil((record.lockedUntil - Date.now()) / 1000);
        return { locked: true, remainingSec };
    }
    if (record.lockedUntil && Date.now() >= record.lockedUntil) {
        failedLogins.delete(ip);
    }
    return { locked: false };
}

function recordFailedLogin(ip) {
    const record = failedLogins.get(ip) || { count: 0, lockedUntil: null };
    record.count += 1;
    if (record.count >= 5) {
        record.lockedUntil = Date.now() + (15 * 60 * 1000); // 15-minute lockout
    }
    failedLogins.set(ip, record);
    return record;
}

function clearFailedLogin(ip) {
    failedLogins.delete(ip);
}

// Secure API endpoints for Admin Authentication
app.post('/api/auth/login', loginLimiter, (req, res) => {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const lockout = checkLoginLockout(clientIp);
    if (lockout.locked) {
        return res.status(429).json({ 
            error: `Security Lockout Active: Too many failed login attempts. Please try again in ${Math.ceil(lockout.remainingSec / 60)} minute(s).` 
        });
    }

    const { id, pass } = req.body;
    if (!id || !pass) {
        return res.status(400).json({ error: 'Staff ID and Passcode are required.' });
    }

    // Cryptographic constant-time password verification using PBKDF2
    const suppliedHash = hashPassword(pass);
    const idMatches = (id.trim().toLowerCase() === ADMIN_ID.toLowerCase());
    
    let passMatches = false;
    try {
        const bufA = Buffer.from(suppliedHash, 'hex');
        const bufB = Buffer.from(ADMIN_PASSWORD_HASH, 'hex');
        if (bufA.length === bufB.length) {
            passMatches = crypto.timingSafeEqual(bufA, bufB);
        }
    } catch (e) {
        passMatches = false;
    }

    if (idMatches && passMatches) {
        clearFailedLogin(clientIp);
        const token = crypto.randomBytes(32).toString('hex');
        activeAdminSessions.set(token, { createdAt: Date.now(), id: id.trim() });
        return res.json({ success: true, token });
    } else {
        const failRecord = recordFailedLogin(clientIp);
        const remainingAttempts = Math.max(0, 5 - failRecord.count);
        return res.status(401).json({ 
            error: remainingAttempts > 0 
                ? `Access Denied: Invalid Credentials. (${remainingAttempts} attempt(s) remaining before account lockout)`
                : 'Access Denied: Account temporarily locked due to repeated failed attempts.' 
        });
    }
});

app.post('/api/auth/verify', (req, res) => {
    const { token } = req.body;
    const session = token ? activeAdminSessions.get(token) : null;
    const SESSION_HOURS = 8;
    if (session && Date.now() - session.createdAt <= SESSION_HOURS * 3600 * 1000) {
        res.json({ valid: true, id: session.id });
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

// ── SERVER-SIDE FASTAG LEDGER VALIDATION ENDPOINTS ─────────────────────────

// Server-Side Recharge with Fee Computation & Transaction Proof
app.post('/api/fastag/recharge', (req, res) => {
    const { amount, paymentMethod } = req.body;
    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount) || numAmount < 50 || numAmount > 50000) {
        return res.status(400).json({ error: 'Recharge amount must be between ₹50 and ₹50,000.' });
    }

    const fee = Number((numAmount * 0.01).toFixed(2));
    const net = Number((numAmount - fee).toFixed(2));
    const txId = `RCH-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const db = loadDB();
    const currentBalance = typeof db.nhai_fastag_balance === 'number' ? db.nhai_fastag_balance : 1500;
    const newBalance = Number((currentBalance + net).toFixed(2));

    db.nhai_fastag_balance = newBalance;
    if (!Array.isArray(db.nhai_recharge_history)) db.nhai_recharge_history = [];
    
    const record = {
        id: txId,
        amount: numAmount,
        fee,
        net,
        method: paymentMethod || 'UPI / NetBanking',
        date: new Date().toISOString(),
        status: 'SUCCESS'
    };
    db.nhai_recharge_history.unshift(record);
    saveDB(db);

    io.emit('db-update', { key: 'nhai_fastag_balance', value: newBalance });
    io.emit('db-update', { key: 'nhai_recharge_history', value: db.nhai_recharge_history });

    res.json({ success: true, newBalance, record });
});

// Server-Side Toll Deduction with Solvency Check
app.post('/api/fastag/deduct', (req, res) => {
    const { tollId, tollName, cost, vehicleType, nhCorridor } = req.body;
    const numCost = parseFloat(cost);

    if (isNaN(numCost) || numCost < 0 || numCost > 5000) {
        return res.status(400).json({ error: 'Invalid toll cost parameter.' });
    }

    const db = loadDB();
    const currentBalance = typeof db.nhai_fastag_balance === 'number' ? db.nhai_fastag_balance : 1500;

    if (currentBalance < numCost) {
        return res.status(402).json({ 
            error: 'Insufficient FASTag balance. Please recharge wallet before passing barrier.',
            currentBalance,
            required: numCost
        });
    }

    const newBalance = Number((currentBalance - numCost).toFixed(2));
    db.nhai_fastag_balance = newBalance;

    const tripRecord = {
        id: `TRP-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        tollId: tollId || 'TOLL-PLAZA',
        tollName: tollName || 'National Highway Toll Plaza',
        cost: numCost,
        vehicleType: vehicleType || 'Car / LMV',
        nhCorridor: nhCorridor || 'NH-48',
        timestamp: new Date().toISOString(),
        status: 'PAID'
    };

    if (!Array.isArray(db.nhai_trip_history)) db.nhai_trip_history = [];
    db.nhai_trip_history.unshift(tripRecord);
    saveDB(db);

    io.emit('db-update', { key: 'nhai_fastag_balance', value: newBalance });
    io.emit('db-update', { key: 'nhai_trip_history', value: db.nhai_trip_history });

    res.json({ success: true, newBalance, tripRecord });
});

// Server-Side Incident Verification & Resolution (Admin Authenticated)
app.post('/api/incidents/resolve', (req, res) => {
    const { incidentId, adminNote, resolutionImage, verificationType, token } = req.body;

    const session = token ? activeAdminSessions.get(token) : null;
    const SESSION_HOURS = 8;
    if (!session || Date.now() - session.createdAt > SESSION_HOURS * 3600 * 1000) {
        if (token) activeAdminSessions.delete(token);
        return res.status(403).json({ error: 'Unauthorized: Valid Admin Session Required.' });
    }

    if (!incidentId || !adminNote) {
        return res.status(400).json({ error: 'Incident ID and Admin Summary Note are mandatory.' });
    }

    const db = loadDB();
    if (!Array.isArray(db.nhai_emergencies)) db.nhai_emergencies = [];
    
    const idx = db.nhai_emergencies.findIndex(e => e.id === incidentId);
    if (idx === -1) {
        return res.status(404).json({ error: 'Incident not found in active database.' });
    }

    db.nhai_emergencies[idx].status = 'RESOLVED';
    db.nhai_emergencies[idx].adminNote = adminNote;
    if (resolutionImage) db.nhai_emergencies[idx].resolutionImage = resolutionImage;
    db.nhai_emergencies[idx].verificationType = verificationType || 'CONFIRMED';
    db.nhai_emergencies[idx].updatedAt = new Date().toISOString();
    db.nhai_emergencies[idx].resolvedBy = session.id || 'admin@nhai';

    saveDB(db);
    io.emit('db-update', { key: 'nhai_emergencies', value: db.nhai_emergencies });

    res.json({ success: true, incident: db.nhai_emergencies[idx] });
});

// App Health
app.get('/health', (req, res) => {
    res.json({ 
        status: 'NHAI Secure Backend Live', 
        sessions: activeJourneys.size, 
        dbSize: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0 
    });
});

// Fetch live real-time Indian Highway news updates via RSS
app.get('/api/news-feed', (req, res) => {
    const region = req.query.region || '';
    const https = require('https');
    
    // Strictly filter Google News query by region if provided
    const query = region ? `${region} highway traffic congestion` : 'NHAI highway traffic';
    const encodedQuery = encodeURIComponent(query);
    const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-IN&gl=IN&ceid=IN:en`;
    
    https.get(url, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
            try {
                const titleRegex = /<title>(.*?)<\/title>/g;
                const alerts = [];
                let match;
                let index = 0;
                while ((match = titleRegex.exec(data)) !== null && alerts.length < 15) {
                    if (index > 0) {
                        let title = match[1];
                        title = title.replace(/&amp;/g, '&')
                                     .replace(/&lt;/g, '<')
                                     .replace(/&gt;/g, '>')
                                     .replace(/&quot;/g, '"')
                                     .replace(/&#39;/g, "'");
                        const sourceIdx = title.lastIndexOf(' - ');
                        if (sourceIdx !== -1) {
                            title = title.substring(0, sourceIdx);
                        }
                        if (title.length > 15) {
                            // Enforce region filter in title if region is requested
                            if (region) {
                                const regLower = region.toLowerCase();
                                const titleLower = title.toLowerCase();
                                // Only add if it relates to the region or matches standard traffic keywords
                                if (titleLower.includes(regLower) || titleLower.includes('highway') || titleLower.includes('nh') || titleLower.includes('toll')) {
                                    alerts.push(title);
                                }
                            } else {
                                alerts.push(title);
                            }
                        }
                    }
                    index++;
                }

                // If Google News returns no specific regional alerts, fall back strictly to regional items
                if (alerts.length === 0) {
                    alerts.push(...getRegionalFallbackAlerts(region));
                }
                res.json({ alerts });
            } catch (e) {
                res.json({ alerts: getRegionalFallbackAlerts(region) });
            }
        });
    }).on('error', (e) => {
        res.json({ alerts: getRegionalFallbackAlerts(region) });
    });
});

function getRegionalFallbackAlerts(region) {
    if (!region) {
        return [
            "NH-48: Traffic maintenance warnings near Mumbai-Pune expressway links",
            "NH-44: Reduced visibility alerts reported around NCR regions due to morning mist",
            "NH-2: Lane closures active near Kanpur bypass extensions for overlay works",
            "NH-3: Dynamic safety alerts active near Kasara Ghat highway crossings",
            "NH-8: FastTag auto-deduction sync verified on all major Rajasthan toll lanes"
        ];
    }

    const r = region.toLowerCase();
    if (r.includes('maharashtra') || r.includes('mumbai') || r.includes('pune')) {
        return [
            "NH-48 (Maharashtra): Heavy congestion reported near Mumbai-Pune Expressway exit",
            "NH-3 (Maharashtra): Landslide hazard warning issued for Kasara Ghat mountain pass",
            "NH-66 (Maharashtra): Road widening works active near Indapur bypass (single lane traffic)",
            "NH-4 (Maharashtra): Toll plaza delays up to 10 mins near Satara bypass"
        ];
    } else if (r.includes('delhi') || r.includes('ncr') || r.includes('haryana') || r.includes('punjab') || r.includes('ambala')) {
        return [
            "NH-44 (Delhi-NCR): High-density fog advisory near Ambala-Panipat highway stretch",
            "NH-9 (Haryana): Dynamic speed limits active around Rohtak corridor (Limit: 80 km/h)",
            "NH-48 (Delhi-Jaipur): Structural maintenance works active near Gurugram-Manesar toll gate",
            "NE-3 (Delhi-Meerut): Commuters advised to follow designated speed lanes"
        ];
    } else if (r.includes('karnataka') || r.includes('bangalore') || r.includes('bengaluru')) {
        return [
            "NH-48 (Karnataka): Waterlogging alert reported near Tumakuru highway junctions",
            "NH-75 (Karnataka): Diversions active near Shiradi Ghat stretch due to maintenance works",
            "NH-44 (Karnataka): Automated speed enforcement cameras active near Devanahalli plaza",
            "NH-275 (Bengaluru-Mysuru): Toll collection lanes fully functional via FASTag barriers"
        ];
    } else if (r.includes('uttar pradesh') || r.includes('up') || r.includes('lucknow') || r.includes('varanasi')) {
        return [
            "NH-19 (Uttar Pradesh): Maintenance lane closure active near Varanasi toll plaza",
            "Yamuna Expressway (UP): Reduced speed limits of 80 km/h active due to weather warnings",
            "NH-24 (UP): Heavy vehicle restrictions active near Ghaziabad-Hapur border stretch",
            "NH-27 (UP): Traffic diversions active around Kanpur city bypass corridors"
        ];
    } else if (r.includes('tamil nadu') || r.includes('chennai') || r.includes('salem')) {
        return [
            "NH-45 (Tamil Nadu): Periodic rain warning near Chengalpattu highway crossings",
            "NH-44 (Tamil Nadu): Smart highway speed cameras active near Salem toll gates",
            "NH-48 (Tamil Nadu): Traffic slow down reported around Sriperumbudur industrial corridor",
            "NH-7 (Tamil Nadu): Operations center monitoring minor water logging near Madurai bypass"
        ];
    } else if (r.includes('rajasthan') || r.includes('jaipur')) {
        return [
            "NH-48 (Rajasthan): Traffic restoration completed near Behror bypass stretch",
            "NH-8 (Rajasthan): Sandstorm reduction warnings cleared near Ajmer-Beawar highways",
            "NH-52 (Rajasthan): Automated radar speed checks active around Kota corridor links",
            "NH-11 (Rajasthan): Toll collection operations smooth at Jaipur-Reengus plaza"
        ];
    }
    
    // Specific state-titled warning tags for any other Indian state
    const regTitle = region.charAt(0).toUpperCase() + region.slice(1);
    return [
        `NH-Alert (${regTitle}): Localized traffic advisory active along regional highway corridors`,
        `NH-Operations (${regTitle}): Emergency response teams deployed near major bypass routes`,
        `NH-Safety (${regTitle}): Travelers advised to monitor real-time speed board limits`,
        `NH-Tolls (${regTitle}): FASTag reader lanes operating under automatic detection`
    ];
}

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
