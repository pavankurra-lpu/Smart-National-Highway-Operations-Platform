const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const ADMIN_ID = process.env.ADMIN_ID || 'admin@nhai';

// SECURITY: no more hardcoded default password. If ADMIN_PASS_HASH isn't
// set, generate a random one-time password and print it once - this
// used to always fall back to hashing the well-known default 'NHAI@2026',
// which meant that "default" was a permanently valid login regardless of
// configuration.
let ADMIN_HASH = process.env.ADMIN_PASS_HASH;
if (!ADMIN_HASH) {
    const generated = crypto.randomBytes(9).toString('base64url');
    ADMIN_HASH = bcrypt.hashSync(generated, 10);
    console.warn('\n============================================================');
    console.warn('⚠️  No ADMIN_PASS_HASH set - generated a one-time admin password.');
    console.warn(`   Admin ID:       ${ADMIN_ID}`);
    console.warn(`   Admin Password: ${generated}   (shown once, not stored anywhere)`);
    console.warn('   For production, set ADMIN_ID and ADMIN_PASS_HASH env vars.');
    console.warn('============================================================\n');
}

app.use(rateLimit({ windowMs: 60 * 1000, max: 600 }));

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' }
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const failedLogins = new Map();

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
        record.lockedUntil = Date.now() + (15 * 60 * 1000);
    }
    failedLogins.set(ip, record);
    return record;
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'] || req.headers['x-auth-token'];
    const token = authHeader && (authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader);

    if (!token) {
        return res.status(401).json({ error: 'Authentication required. Please provide a valid session token.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
    }
}

function authenticateAdmin(req, res, next) {
    const authHeader = req.headers['authorization'] || req.headers['x-admin-token'];
    const token = authHeader && (authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader);

    if (!token) {
        return res.status(403).json({ error: 'Forbidden: Admin authentication required.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
        }
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Admin session expired. Please re-authenticate.' });
    }
}

async function sendSmsOtp(phone, otp) {
    const { FAST2SMS_API_KEY } = process.env;
    if (!FAST2SMS_API_KEY) return { sent: false, reason: 'not-configured' };

    try {
        const https = require('https');
        const params = new URLSearchParams({
            authorization: FAST2SMS_API_KEY,
            route: 'otp',
            variables_values: String(otp),
            numbers: phone
        }).toString();

        await new Promise((resolve, reject) => {
            const request = https.request({
                hostname: 'www.fast2sms.com',
                path: `/dev/bulkV2?${params}`,
                method: 'GET'
            }, (r) => {
                let body = '';
                r.on('data', (c) => { body += c; });
                r.on('end', () => resolve(body));
            });
            request.on('error', reject);
            request.end();
        });
        return { sent: true };
    } catch (e) {
        console.error('[SMS OTP] Fast2SMS send failed, falling back to dev mode:', e.message);
        return { sent: false, reason: 'send-failed' };
    }
}

app.post('/api/auth/traveller/send-otp', loginLimiter, async (req, res) => {
    const { phone } = req.body;
    if (!phone || !/^[6-9]\d{9}$/.test(phone.trim())) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
    }

    const cleanPhone = phone.trim();
    const otp = Math.floor(100000 + Math.random() * 900000);
    db.createOtp(cleanPhone, otp);

    const smsResult = await sendSmsOtp(cleanPhone, otp);
    console.log(`[SMS OTP] ${smsResult.sent ? 'Sent via Fast2SMS' : 'DEV MODE (no gateway configured)'} — +91-${cleanPhone}: ${otp} (valid 5 mins)`);

    res.json({
        success: true,
        message: smsResult.sent
            ? `OTP sent to +91-${cleanPhone.substring(0, 3)}****${cleanPhone.substring(7)}`
            : `DEV MODE: SMS gateway not configured. Your OTP is shown below instead of being texted.`,
        expiresInSec: 300,
        devOtp: smsResult.sent ? undefined : otp
    });
});

app.post('/api/auth/traveller/verify-otp', (req, res) => {
    const { phone, otp, name } = req.body;
    if (!phone || !otp) {
        return res.status(400).json({ error: 'Phone number and OTP code are required.' });
    }

    const cleanPhone = phone.trim();
    const verifyResult = db.verifyOtp(cleanPhone, otp);

    if (!verifyResult.valid) {
        return res.status(400).json({ error: verifyResult.error });
    }

    let user = db.findUserByPhone(cleanPhone);
    let wallet;

    if (!user) {
        const created = db.createUser({ phone: cleanPhone, name: name || 'Highway Traveler' });
        user = created.user;
        wallet = created.wallet;
    } else {
        wallet = db.getWalletByUserId(user.id);
    }

    const token = jwt.sign(
        { id: user.id, phone: user.phone, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: '30d' }
    );

    res.json({
        success: true,
        token,
        user,
        wallet
    });
});

app.post('/api/auth/admin/login', loginLimiter, (req, res) => {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const lockout = checkLoginLockout(clientIp);
    if (lockout.locked) {
        return res.status(429).json({
            error: `Security Lockout: Too many failed login attempts. Please try again in ${Math.ceil(lockout.remainingSec / 60)} minute(s).`
        });
    }

    const { id, pass } = req.body;
    if (!id || !pass) {
        return res.status(400).json({ error: 'Staff ID and Passcode are required.' });
    }

    const cleanId = id.trim().toLowerCase();
    const cleanPass = pass.trim();

    const validAdminIds = process.env.ADMIN_ID
        ? [process.env.ADMIN_ID.toLowerCase()]
        : ['admin@nhai']; // SECURITY: set ADMIN_ID in production - do not rely on this default

    const idMatches = validAdminIds.includes(cleanId);

    // SECURITY FIX: this used to fall back to a plaintext comparison
    // (`cleanPass === ADMIN_PASS`) whenever the bcrypt check failed, which
    // fully defeated the point of hashing - the plaintext default password
    // was always a valid login regardless of what ADMIN_HASH contained.
    // Also reduced from 6 hardcoded valid admin IDs down to one
    // (configurable via env), since every extra guessable ID is extra
    // attack surface for zero benefit.
    let passMatches = false;
    try {
        passMatches = bcrypt.compareSync(cleanPass, ADMIN_HASH);
    } catch (e) {
        passMatches = false;
    }

    if (idMatches && passMatches) {
        failedLogins.delete(clientIp);
        const token = jwt.sign(
            { id: cleanId, role: 'admin', name: 'NHAI Highway Operations Officer' },
            JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.json({
            success: true,
            token,
            admin: { id: cleanId, role: 'admin', name: 'NHAI Highway Operations Officer' }
        });
    } else {
        const failRecord = recordFailedLogin(clientIp);
        const remainingAttempts = Math.max(0, 5 - failRecord.count);
        res.status(401).json({
            error: remainingAttempts > 0
                ? `Access Denied: Invalid Staff ID or Passcode. (${remainingAttempts} attempt(s) remaining)`
                : 'Access Denied: Account temporarily locked due to repeated failed attempts.'
        });
    }
});

app.post('/api/auth/admin/verify', (req, res) => {
    const authHeader = req.headers['authorization'] || req.headers['x-admin-token'];
    const token = (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader) || req.body?.token;
    if (!token) return res.status(401).json({ valid: false, error: 'Token missing' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role === 'admin') {
            return res.json({ valid: true, admin: decoded });
        }
    } catch (e) {}

    res.status(401).json({ valid: false, error: 'Invalid or expired admin token' });
});

app.post('/api/auth/login', (req, res, next) => {
    req.url = '/api/auth/admin/login';
    app.handle(req, res, next);
});

app.post('/api/auth/verify', (req, res, next) => {
    req.url = '/api/auth/admin/verify';
    app.handle(req, res, next);
});

app.get('/api/wallet', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const wallet = db.getWalletByUserId(userId);
    const transactions = db.getTransactionsByWalletId(wallet.id, 30);
    res.json({ success: true, wallet, transactions });
});

app.post('/api/wallet/recharge', authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;
        const { amount, paymentMethod } = req.body;

        const { wallet, transaction } = db.rechargeWallet({
            userId,
            amount,
            paymentMethod: paymentMethod || 'UPI / NetBanking'
        });

        io.emit('wallet-updated', { userId, newBalance: wallet.balance, transaction });

        res.json({
            success: true,
            wallet,
            transaction,
            message: `Recharge of ₹${amount} successful. Net credited: ₹${transaction.net} (1% Platform Fee: ₹${transaction.fee}).`
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/wallet/deduct', authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;
        const { tollId, tollName, cost, vehicleType, nhCorridor } = req.body;

        const { wallet, transaction, trip } = db.deductToll({
            userId,
            tollId,
            tollName,
            cost,
            vehicleType,
            nhCorridor
        });

        io.emit('wallet-updated', { userId, newBalance: wallet.balance, transaction });
        io.emit('trip-completed', { userId, trip });

        res.json({
            success: true,
            wallet,
            transaction,
            trip,
            message: `Toll deduction of ₹${cost} successful at ${tollName || 'Plaza'}.`
        });
    } catch (err) {
        if (err.code === 'INSUFFICIENT_FUNDS') {
            return res.status(402).json({
                error: 'Insufficient FASTag balance. Please recharge before approaching barrier.',
                currentBalance: err.currentBalance,
                required: err.required
            });
        }
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/wallet/buy-pass', authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;
        const { passType, tollId, tollName, cost, validityDays } = req.body;

        const { wallet, transaction } = db.purchasePass({
            userId,
            passType: passType || 'MONTHLY_PASS',
            tollId,
            tollName,
            cost,
            validityDays: validityDays || 30
        });

        io.emit('wallet-updated', { userId, newBalance: wallet.balance, transaction });

        res.json({
            success: true,
            wallet,
            transaction,
            message: `Pass purchase of ₹${cost} successful. Valid for ${validityDays || 30} days.`
        });
    } catch (err) {
        if (err.code === 'INSUFFICIENT_FUNDS') {
            return res.status(402).json({ error: 'Insufficient FASTag balance for pass purchase.' });
        }
        res.status(400).json({ error: err.message });
    }
});

app.get('/api/wallet/transactions', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const wallet = db.getWalletByUserId(userId);
    const transactions = db.getTransactionsByWalletId(wallet.id, 100);
    res.json({ success: true, transactions });
});

app.get('/api/incidents', (req, res) => {
    const incidents = db.getAllIncidents(100);
    res.json({ success: true, incidents });
});

app.post('/api/incidents/report', (req, res) => {
    const { userId, type, location, lat, lng, description, nhCorridor, vehicleNumber } = req.body;
    
    if (!type || !location) {
        return res.status(400).json({ error: 'Incident type and location description are required.' });
    }

    const incident = db.createIncident({
        userId: userId || 'ANONYMOUS-TRAVELLER',
        type,
        location,
        lat: parseFloat(lat) || 28.6139,
        lng: parseFloat(lng) || 77.2090,
        description,
        nhCorridor,
        vehicleNumber
    });

    io.emit('incident-created', incident);
    io.emit('db-update', { key: 'nhai_emergencies', value: db.getAllIncidents(100) });

    res.json({
        success: true,
        incident,
        message: `Emergency SOS ${incident.id} logged. NHAI Highway Patrol & Responders notified.`
    });
});

app.post('/api/incidents/dispatch', authenticateAdmin, (req, res) => {
    const { incidentId, etaMinutes, responderUnit } = req.body;
    if (!incidentId) return res.status(400).json({ error: 'Incident ID is required.' });

    const note = `[DISPATCHED] Responder unit (${responderUnit || 'Ambulance & Patrol'}) dispatched. ETA: ${etaMinutes || 12} mins.`;
    const incident = db.updateIncidentStatus({
        incidentId,
        status: 'DISPATCHED',
        adminNote: note,
        adminId: req.admin?.id || 'admin@nhai'
    });

    if (!incident) return res.status(404).json({ error: 'Incident not found.' });

    io.emit('incident-updated', incident);
    io.emit('db-update', { key: 'nhai_emergencies', value: db.getAllIncidents(100) });

    res.json({ success: true, incident });
});

app.post('/api/incidents/resolve', authenticateAdmin, (req, res) => {
    const { incidentId, adminNote, resolutionImage, verificationType } = req.body;

    if (!incidentId || !adminNote || !adminNote.trim()) {
        return res.status(400).json({ error: 'Incident ID and Admin Summary Note are mandatory for resolution.' });
    }

    const incident = db.updateIncidentStatus({
        incidentId,
        status: 'RESOLVED',
        adminNote: `[RESOLVED: ${verificationType || 'CONFIRMED'}] ${adminNote.trim()}`,
        resolutionImage: resolutionImage || '',
        verificationType: verificationType || 'CONFIRMED',
        adminId: req.admin?.id || 'admin@nhai'
    });

    if (!incident) return res.status(404).json({ error: 'Incident not found.' });

    io.emit('incident-resolved', incident);
    io.emit('db-update', { key: 'nhai_emergencies', value: db.getAllIncidents(100) });

    res.json({
        success: true,
        incident,
        message: `Incident ${incidentId} resolved. Awaiting user rating & confirmation.`
    });
});

app.post('/api/incidents/feedback', (req, res) => {
    const { incidentId, rating, comment } = req.body;
    if (!incidentId) return res.status(400).json({ error: 'Incident ID is required.' });

    const incident = db.addIncidentFeedback({
        incidentId,
        rating: parseInt(rating) || 5,
        comment: comment || ''
    });

    if (!incident) return res.status(404).json({ error: 'Incident not found.' });

    io.emit('incident-closed', incident);
    io.emit('db-update', { key: 'nhai_emergencies', value: db.getAllIncidents(100) });

    res.json({ success: true, incident });
});

const weatherCache = new Map();
const WEATHER_CACHE_TTL = 15 * 60 * 1000;

app.get('/api/weather', async (req, res) => {
    const lat = parseFloat(req.query.lat) || 28.6139;
    const lng = parseFloat(req.query.lng) || 77.2090;
    const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;

    const cached = weatherCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < WEATHER_CACHE_TTL)) {
        return res.json(cached.data);
    }

    try {
        const https = require('https');
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation&timezone=auto`;

        https.get(url, (response) => {
            let body = '';
            response.on('data', chunk => { body += chunk; });
            response.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    const cur = parsed.current || {};
                    const temp = Math.round(cur.temperature_2m !== undefined ? cur.temperature_2m : 30);
                    const wmo = cur.weather_code !== undefined ? cur.weather_code : 0;
                    
                    let risk = 'LOW';
                    let conditionName = 'Clear Skies';
                    let icon = 'fa-sun';
                    let advisory = 'Optimal travel conditions. Highway clear.';
                    let etaMultiplier = 1.0;

                    if ([95, 96, 99].includes(wmo)) {
                        risk = 'HIGH'; conditionName = 'Severe Thunderstorm'; icon = 'fa-cloud-bolt';
                        advisory = 'High crosswinds & lightning hazard. Proceed with extreme caution.';
                        etaMultiplier = 1.50;
                    } else if ([45, 48].includes(wmo)) {
                        risk = 'HIGH'; conditionName = 'Dense Fog / Mist'; icon = 'fa-smog';
                        advisory = 'Low visibility advisory. Use fog lamps & maintain lane spacing.';
                        etaMultiplier = 1.35;
                    } else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 85, 86].includes(wmo)) {
                        risk = 'MEDIUM'; conditionName = 'Heavy Rain / Showers'; icon = 'fa-cloud-showers-heavy';
                        advisory = 'Slippery roads. Reduce speed by 20%. Maintain safe braking distance.';
                        etaMultiplier = 1.20;
                    } else if (temp >= 42) {
                        risk = 'HIGH'; conditionName = 'Extreme Heatwave'; icon = 'fa-temperature-arrow-up';
                        advisory = 'Extreme heatwave alert. Inspect tyre pressures and coolant. Hydrate frequently.';
                        etaMultiplier = 1.15;
                    }

                    const payload = {
                        success: true,
                        temp,
                        humidity: cur.relative_humidity_2m || 50,
                        windSpeed: cur.wind_speed_10m || 10,
                        precipitation: cur.precipitation || 0,
                        risk,
                        conditionName,
                        icon,
                        advisory,
                        etaMultiplier,
                        source: 'LIVE_OPEN_METEO'
                    };

                    weatherCache.set(cacheKey, { data: payload, timestamp: Date.now() });
                    res.json(payload);
                } catch (e) {
                    res.json(getLocalFallbackWeather(lat));
                }
            });
        }).on('error', () => {
            res.json(getLocalFallbackWeather(lat));
        });
    } catch (e) {
        res.json(getLocalFallbackWeather(lat));
    }
});

function getLocalFallbackWeather(lat) {
    const baseTemp = Math.round(42 - (lat * 0.6));
    return {
        success: true,
        temp: baseTemp,
        humidity: 50,
        windSpeed: 12,
        precipitation: 0,
        risk: 'LOW',
        conditionName: 'Clear Skies',
        icon: 'fa-sun',
        advisory: 'Optimal travel conditions.',
        etaMultiplier: 1.0,
        source: 'LOCAL_MODEL'
    };
}

app.get('/api/alerts', (req, res) => {
    res.json({ success: true, alerts: db.getAlerts(30) });
});

app.post('/api/alerts/broadcast', authenticateAdmin, (req, res) => {
    const { title, message, severity, nhCorridor } = req.body;
    if (!title || !message) {
        return res.status(400).json({ error: 'Alert title and message are required.' });
    }

    const alert = db.createAlert({
        title,
        message,
        severity: severity || 'WARNING',
        nhCorridor: nhCorridor || 'ALL',
        createdBy: req.admin?.id || 'admin@nhai'
    });

    io.emit('broadcast-alert', alert);
    io.emit('db-update', { key: 'nhai_admin_alerts', value: db.getAlerts(30) });

    res.json({ success: true, alert });
});

app.get('/api/tolls', (req, res) => {
    res.json({ success: true, tollStates: db.getTollStates() });
});

app.post('/api/tolls/congestion', authenticateAdmin, (req, res) => {
    const { plazaId, congestion, openLanes, totalLanes } = req.body;
    if (!plazaId) return res.status(400).json({ error: 'Plaza ID is required.' });

    const updated = db.updateTollState(plazaId, {
        congestion: congestion || 'NORMAL',
        openLanes: openLanes !== undefined ? openLanes : 6,
        totalLanes: totalLanes !== undefined ? totalLanes : 8
    });

    io.emit('toll-state-updated', { plazaId, state: updated });
    io.emit('db-update', { key: 'nhai_toll_states', value: db.getTollStates() });

    res.json({ success: true, tollState: updated });
});

app.post('/api/sms/send', (req, res) => {
    const { phone, message } = req.body;
    const msgId = `SMS-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[SMS Broadcast] Sent to ${phone}: ${message} (${msgId})`);
    }
    res.json({ success: true, messageId: msgId, status: 'DELIVERED', timestamp: new Date().toISOString() });
});

app.post('/api/email/send', (req, res) => {
    const { to, subject, trip, message } = req.body;
    const emailId = `EML-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[Email Dispatch] Sent to ${to}: ${subject} (${emailId})`);
    }
    res.json({ success: true, emailId, status: 'SENT', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'SNHOP Real-Time National Highway Backend Live',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        database: {
            users: db.db.users.length,
            wallets: db.db.fastag_wallets.length,
            transactions: db.db.wallet_transactions.length,
            incidents: db.db.incidents.length,
            alerts: db.db.admin_alerts.length
        }
    });
});

io.on('connection', (socket) => {
    socket.on('join-room', (room) => {
        socket.join(room);
    });

    socket.on('update-position', (data) => {
        socket.broadcast.emit('vehicle-moved', data);
    });

    socket.on('disconnect', () => {});
});

module.exports = { app, server, io };

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`SNHOP Server running on port ${PORT}`);
    });
}
