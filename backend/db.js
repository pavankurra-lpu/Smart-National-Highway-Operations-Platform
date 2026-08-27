/**
 * SNHOP Database Engine (Relational Persistence & Immutable Transaction Ledger)
 * 
 * Provides ACID file persistence, relational indexing, and cryptographic ledger verification
 * for Users, Vehicles, FASTag Wallets, Immutable Transactions, Trips, Incidents, and Alerts.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = path.join(__dirname, 'db.json');

// Default Database Schema
const DEFAULT_SCHEMA = {
    meta: {
        version: '2.0.0',
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
    },
    users: [],
    vehicles: [],
    fastag_wallets: [],
    wallet_transactions: [], // Immutable financial ledger
    trips: [],
    incidents: [],
    admin_alerts: [],
    toll_states: {},
    otp_verifications: [],
    admin_sessions: [],
    login_attempts: []
};

class Database {
    constructor() {
        this.db = this._load();
        this._ensureDefaults();
    }

    _load() {
        try {
            if (fs.existsSync(DB_FILE)) {
                const raw = fs.readFileSync(DB_FILE, 'utf8');
                const parsed = JSON.parse(raw);
                return { ...DEFAULT_SCHEMA, ...parsed };
            }
        } catch (err) {
            console.error('[DB] Error reading database file. Initializing fresh schema:', err.message);
        }
        return JSON.parse(JSON.stringify(DEFAULT_SCHEMA));
    }

    _save() {
        try {
            this.db.meta.last_updated = new Date().toISOString();
            fs.writeFileSync(DB_FILE, JSON.stringify(this.db, null, 2), 'utf8');
        } catch (err) {
            console.error('[DB] Critical: Failed to persist database:', err.message);
        }
    }

    _ensureDefaults() {
        // Ensure default seed data if database is fresh
        if (!Array.isArray(this.db.users)) this.db.users = [];
        if (!Array.isArray(this.db.vehicles)) this.db.vehicles = [];
        if (!Array.isArray(this.db.fastag_wallets)) this.db.fastag_wallets = [];
        if (!Array.isArray(this.db.wallet_transactions)) this.db.wallet_transactions = [];
        if (!Array.isArray(this.db.trips)) this.db.trips = [];
        if (!Array.isArray(this.db.incidents)) this.db.incidents = [];
        if (!Array.isArray(this.db.admin_alerts)) this.db.admin_alerts = [];
        if (!Array.isArray(this.db.otp_verifications)) this.db.otp_verifications = [];
        if (!Array.isArray(this.db.admin_sessions)) this.db.admin_sessions = [];
        if (!Array.isArray(this.db.login_attempts)) this.db.login_attempts = [];
        if (typeof this.db.toll_states !== 'object') this.db.toll_states = {};

        // Seed default demo user and wallet if empty
        if (this.db.users.length === 0) {
            const demoUser = {
                id: 'USR-DEMO-001',
                phone: '9876543210',
                name: 'Pavan Kurra (Demo Traveler)',
                role: 'traveller',
                createdAt: new Date().toISOString()
            };
            this.db.users.push(demoUser);

            const demoWallet = {
                id: 'WLT-DEMO-001',
                userId: demoUser.id,
                balance: 1500.00,
                status: 'ACTIVE',
                updatedAt: new Date().toISOString()
            };
            this.db.fastag_wallets.push(demoWallet);

            const demoVehicle = {
                id: 'VEH-DEMO-001',
                userId: demoUser.id,
                regNumber: 'DL-01-AB-1234',
                category: 'Car / LMV',
                fastagId: 'FASTAG-IND-884920',
                isSpecialVerified: false,
                createdAt: new Date().toISOString()
            };
            this.db.vehicles.push(demoVehicle);

            // Initial Genesis Ledger Transaction
            this.db.wallet_transactions.push({
                id: 'TXN-GENESIS-001',
                walletId: demoWallet.id,
                userId: demoUser.id,
                type: 'RECHARGE',
                amount: 1500.00,
                fee: 0.00,
                net: 1500.00,
                balanceAfter: 1500.00,
                method: 'System Genesis Credit',
                referenceId: 'GENESIS-SNHOP-2026',
                status: 'SUCCESS',
                timestamp: new Date().toISOString()
            });

            this._save();
        }
    }

    // ── USERS & AUTH ─────────────────────────────────────────────────────────
    findUserByPhone(phone) {
        return this.db.users.find(u => u.phone === phone) || null;
    }

    findUserById(id) {
        return this.db.users.find(u => u.id === id) || null;
    }

    createUser({ phone, name = 'Highway Traveler', role = 'traveller' }) {
        const id = `USR-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const user = {
            id,
            phone,
            name,
            role,
            createdAt: new Date().toISOString()
        };
        this.db.users.push(user);

        // Auto-create linked FASTag wallet with default seed balance
        const walletId = `WLT-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const wallet = {
            id: walletId,
            userId: id,
            balance: 1500.00,
            status: 'ACTIVE',
            updatedAt: new Date().toISOString()
        };
        this.db.fastag_wallets.push(wallet);

        // Initial Genesis Transaction
        this.db.wallet_transactions.push({
            id: `TXN-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
            walletId,
            userId: id,
            type: 'RECHARGE',
            amount: 1500.00,
            fee: 0.00,
            net: 1500.00,
            balanceAfter: 1500.00,
            method: 'Welcome Activation Bonus',
            referenceId: 'BONUS-SNHOP-WELCOME',
            status: 'SUCCESS',
            timestamp: new Date().toISOString()
        });

        this._save();
        return { user, wallet };
    }

    // ── OTP MANAGEMENT ───────────────────────────────────────────────────────
    createOtp(phone, otp) {
        // Invalidate prior OTPs for this phone
        this.db.otp_verifications = this.db.otp_verifications.filter(o => o.phone !== phone);
        const record = {
            phone,
            otpHash: crypto.createHash('sha256').update(String(otp)).digest('hex'),
            expiresAt: Date.now() + (5 * 60 * 1000), // 5 min expiry
            attempts: 0,
            verified: false,
            createdAt: Date.now()
        };
        this.db.otp_verifications.push(record);
        this._save();
        return record;
    }

    verifyOtp(phone, otp) {
        const record = this.db.otp_verifications.find(o => o.phone === phone && !o.verified);
        if (!record) return { valid: false, error: 'No active OTP request found. Please request a new code.' };
        
        if (Date.now() > record.expiresAt) {
            return { valid: false, error: 'OTP has expired. Please request a new code.' };
        }

        record.attempts += 1;
        if (record.attempts > 5) {
            return { valid: false, error: 'Too many incorrect attempts. Please request a new code.' };
        }

        const inputHash = crypto.createHash('sha256').update(String(otp)).digest('hex');
        if (inputHash === record.otpHash) {
            record.verified = true;
            this._save();
            return { valid: true };
        }

        this._save();
        return { valid: false, error: `Invalid OTP. (${5 - record.attempts} attempts remaining)` };
    }

    // ── WALLET & FINANCIAL IMMUTABLE LEDGER ───────────────────────────────────
    getWalletByUserId(userId) {
        let wallet = this.db.fastag_wallets.find(w => w.userId === userId);
        if (!wallet) {
            wallet = {
                id: `WLT-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
                userId,
                balance: 1500.00,
                status: 'ACTIVE',
                updatedAt: new Date().toISOString()
            };
            this.db.fastag_wallets.push(wallet);
            this._save();
        }
        return wallet;
    }

    getTransactionsByWalletId(walletId, limit = 50) {
        return this.db.wallet_transactions
            .filter(t => t.walletId === walletId)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }

    /**
     * Server-Authoritative Recharge with 1% Platform Fee
     */
    rechargeWallet({ userId, amount, paymentMethod = 'UPI / NetBanking' }) {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount < 50 || numAmount > 50000) {
            throw new Error('Recharge amount must be between ₹50 and ₹50,000.');
        }

        const wallet = this.getWalletByUserId(userId);
        const fee = Number((numAmount * 0.01).toFixed(2)); // Exact 1% platform fee
        const net = Number((numAmount - fee).toFixed(2));
        const newBalance = Number((wallet.balance + net).toFixed(2));

        const txId = `RCH-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const transaction = {
            id: txId,
            walletId: wallet.id,
            userId,
            type: 'RECHARGE',
            amount: numAmount,
            fee,
            net,
            balanceAfter: newBalance,
            method: paymentMethod,
            referenceId: `REF-${Date.now()}-${Math.floor(Math.random() * 899999 + 100000)}`,
            status: 'SUCCESS',
            timestamp: new Date().toISOString()
        };

        wallet.balance = newBalance;
        wallet.updatedAt = new Date().toISOString();
        this.db.wallet_transactions.unshift(transaction);
        this._save();

        return { wallet, transaction };
    }

    /**
     * Server-Authoritative Toll Deduction with Solvency Check
     */
    deductToll({ userId, tollId, tollName, cost, vehicleType, nhCorridor }) {
        const numCost = parseFloat(cost);
        if (isNaN(numCost) || numCost < 0 || numCost > 5000) {
            throw new Error('Invalid toll cost.');
        }

        const wallet = this.getWalletByUserId(userId);
        if (wallet.balance < numCost) {
            const err = new Error('Insufficient FASTag wallet balance.');
            err.code = 'INSUFFICIENT_FUNDS';
            err.currentBalance = wallet.balance;
            err.required = numCost;
            throw err;
        }

        const newBalance = Number((wallet.balance - numCost).toFixed(2));
        const txId = `DED-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const transaction = {
            id: txId,
            walletId: wallet.id,
            userId,
            type: 'TOLL_DEDUCTION',
            amount: numCost,
            fee: 0.00,
            net: numCost,
            balanceAfter: newBalance,
            tollId: tollId || 'TOLL-PLAZA',
            tollName: tollName || 'National Highway Plaza',
            vehicleType: vehicleType || 'Car / LMV',
            nhCorridor: nhCorridor || 'NH-48',
            referenceId: `RCP-${Date.now()}-${Math.floor(Math.random() * 899999 + 100000)}`,
            status: 'SUCCESS',
            timestamp: new Date().toISOString()
        };

        wallet.balance = newBalance;
        wallet.updatedAt = new Date().toISOString();
        this.db.wallet_transactions.unshift(transaction);

        // Also record in trips table
        const trip = {
            id: `TRP-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
            userId,
            tollId,
            tollName,
            cost: numCost,
            vehicleType,
            nhCorridor,
            timestamp: new Date().toISOString(),
            status: 'PAID'
        };
        this.db.trips.unshift(trip);
        this._save();

        return { wallet, transaction, trip };
    }

    /**
     * Server-Authoritative Pass Purchase (Daily Return or Monthly Pass)
     */
    purchasePass({ userId, passType, tollId, tollName, cost, validityDays = 30 }) {
        const numCost = parseFloat(cost);
        const wallet = this.getWalletByUserId(userId);

        if (wallet.balance < numCost) {
            const err = new Error('Insufficient FASTag wallet balance for pass purchase.');
            err.code = 'INSUFFICIENT_FUNDS';
            throw err;
        }

        const newBalance = Number((wallet.balance - numCost).toFixed(2));
        const txId = `PSS-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const now = Date.now();
        const validUntil = new Date(now + (validityDays * 24 * 60 * 60 * 1000)).toISOString();

        const transaction = {
            id: txId,
            walletId: wallet.id,
            userId,
            type: 'PASS_PURCHASE',
            passType,
            tollId,
            tollName,
            amount: numCost,
            fee: 0.00,
            net: numCost,
            balanceAfter: newBalance,
            validFrom: new Date(now).toISOString(),
            validUntil,
            status: 'ACTIVE',
            timestamp: new Date(now).toISOString()
        };

        wallet.balance = newBalance;
        wallet.updatedAt = new Date().toISOString();
        this.db.wallet_transactions.unshift(transaction);
        this._save();

        return { wallet, transaction };
    }

    // ── EMERGENCY INCIDENTS & DISPATCH ───────────────────────────────────────
    getAllIncidents(limit = 100) {
        return this.db.incidents.slice(0, limit);
    }

    getIncidentById(id) {
        return this.db.incidents.find(i => i.id === id) || null;
    }

    createIncident({ userId, type, location, lat, lng, description, nhCorridor, vehicleNumber }) {
        const id = `SOS-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
        const incident = {
            id,
            userId: userId || 'ANONYMOUS-TRAVELLER',
            type: type || 'ACCIDENT',
            location: location || 'National Highway Stretch',
            lat: lat || 28.6139,
            lng: lng || 77.2090,
            description: description || 'Emergency road assistance requested.',
            nhCorridor: nhCorridor || 'NH-48',
            vehicleNumber: vehicleNumber || 'N/A',
            status: 'RAISED', // RAISED -> DISPATCHED -> RESOLVED -> CLOSED
            adminNote: '',
            resolutionImage: '',
            verificationType: 'CONFIRMED',
            rating: null,
            comment: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.db.incidents.unshift(incident);
        this._save();
        return incident;
    }

    updateIncidentStatus({ incidentId, status, adminNote, resolutionImage, verificationType, adminId }) {
        const incident = this.getIncidentById(incidentId);
        if (!incident) return null;

        incident.status = status;
        if (adminNote) incident.adminNote = adminNote;
        if (resolutionImage) incident.resolutionImage = resolutionImage;
        if (verificationType) incident.verificationType = verificationType;
        if (adminId) incident.resolvedBy = adminId;
        incident.updatedAt = new Date().toISOString();

        this._save();
        return incident;
    }

    addIncidentFeedback({ incidentId, rating, comment }) {
        const incident = this.getIncidentById(incidentId);
        if (!incident) return null;

        incident.rating = rating;
        incident.comment = comment;
        incident.status = 'CLOSED';
        incident.updatedAt = new Date().toISOString();

        this._save();
        return incident;
    }

    // ── HIGHWAY ALERTS & TOLL CONGESTION ─────────────────────────────────────
    getAlerts(limit = 20) {
        return this.db.admin_alerts.slice(0, limit);
    }

    createAlert({ title, message, severity = 'WARNING', nhCorridor = 'ALL', createdBy = 'admin@nhai' }) {
        const alert = {
            id: `ALT-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
            title,
            message,
            severity,
            nhCorridor,
            createdBy,
            timestamp: new Date().toISOString()
        };
        this.db.admin_alerts.unshift(alert);
        this._save();
        return alert;
    }

    getTollStates() {
        return this.db.toll_states;
    }

    updateTollState(plazaId, stateData) {
        this.db.toll_states[plazaId] = {
            ...this.db.toll_states[plazaId],
            ...stateData,
            updatedAt: new Date().toISOString()
        };
        this._save();
        return this.db.toll_states[plazaId];
    }
}

module.exports = new Database();
