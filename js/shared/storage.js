// LocalStorage Wrapper for Cross-Portal Sync

const Storage = {
    // Keys
    KEYS: {
        TRIP_HISTORY: 'nhai_trip_history',
        RECHARGE_HISTORY: 'nhai_recharge_history',
        FASTAG_BALANCE: 'nhai_fastag_balance',
        EMERGENCIES: 'nhai_emergencies',
        ADMIN_ALERTS: 'nhai_admin_alerts',
        VEHICLE_LOGS: 'nhai_vehicle_logs',
        TOLL_STATES: 'nhai_toll_states', // Congestion & override data
        ACTIVE_TRIPS: 'nhai_active_trips' // Live trip tracking
    },

    get: (key, defaultValue = null) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.warn('Storage: corrupted data for key', key, '— resetting.');
            localStorage.removeItem(key);
            return defaultValue;
        }
    },

    set: (key, value) => {
        localStorage.setItem(key, JSON.stringify(value));
        window.dispatchEvent(new Event('local-storage-update'));
        
        // Sync writing to backend asynchronously
        Storage.syncToBackend(key, value);
    },

    syncToBackend: (key, value) => {
        // Only attempt backend writes for simulation keys starting with nhai_
        if (!key.startsWith('nhai_')) return;
        
        const backendUrl = window.NHAI_CONFIG?.backend?.url || 'http://localhost:3000';
        const token = sessionStorage.getItem('nhai_admin_auth') || '';

        fetch(`${backendUrl}/api/db/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value, token })
        }).catch(err => console.warn('[Storage] Backend write sync offline:', err));
    },

    syncFromBackend: async () => {
        try {
            const backendUrl = window.NHAI_CONFIG?.backend?.url || 'http://localhost:3000';
            const token = sessionStorage.getItem('nhai_admin_auth') || '';
            
            const res = await fetch(`${backendUrl}/api/db?token=${token}`);
            if (!res.ok) throw new Error('Network response status was not ok');
            
            const dbData = await res.json();
            for (const [key, val] of Object.entries(dbData)) {
                if (val !== null && val !== undefined) {
                    localStorage.setItem(key, JSON.stringify(val));
                }
            }
            console.log('[Storage] Successfully synced state from backend');
            window.dispatchEvent(new Event('local-storage-update'));
        } catch (e) {
            console.warn('[Storage] Backend server unreachable. Falling back to local offline cache.');
        }
    },

    initDefaults: () => {
        if (Storage.get(Storage.KEYS.FASTAG_BALANCE) === null) {
            Storage.set(Storage.KEYS.FASTAG_BALANCE, 1500); // Default simulated balance
        }
        if (!Storage.get(Storage.KEYS.EMERGENCIES)) Storage.set(Storage.KEYS.EMERGENCIES, []);
        if (!Storage.get(Storage.KEYS.ADMIN_ALERTS)) Storage.set(Storage.KEYS.ADMIN_ALERTS, []);
        if (!Storage.get(Storage.KEYS.VEHICLE_LOGS)) Storage.set(Storage.KEYS.VEHICLE_LOGS, []);
        if (!Storage.get(Storage.KEYS.TRIP_HISTORY)) Storage.set(Storage.KEYS.TRIP_HISTORY, []);
        if (!Storage.get(Storage.KEYS.TOLL_STATES)) {
            const states = {};
            if (window.TollSeedData) {
                const congestionLevels = ['NORMAL', 'NORMAL', 'NORMAL', 'MODERATE', 'MODERATE', 'HIGH'];
                // Only seed for the first 200 tolls to save performance
                TollSeedData.slice(0, 200).forEach(toll => {
                    const rand = congestionLevels[Math.floor(Math.random() * congestionLevels.length)];
                    states[toll.id] = { congestion: rand };
                });
            }
            Storage.set(Storage.KEYS.TOLL_STATES, states);
        }
        if (!Storage.get(Storage.KEYS.ACTIVE_TRIPS)) Storage.set(Storage.KEYS.ACTIVE_TRIPS, []);
    },

    // Specific Getters/Setters
    addEmergency: (emergencyData) => {
        const emergencies = Storage.get(Storage.KEYS.EMERGENCIES, []);
        emergencies.unshift(emergencyData); // Add to top
        Storage.set(Storage.KEYS.EMERGENCIES, emergencies);
    },

    updateEmergencyStatus: (id, newStatus, adminNote = '', resolutionImage = '') => {
        const emergencies = Storage.get(Storage.KEYS.EMERGENCIES, []);
        const idx = emergencies.findIndex(e => e.id === id);
        if (idx !== -1) {
            emergencies[idx].status = newStatus;
            if (adminNote) emergencies[idx].adminNote = adminNote;
            if (resolutionImage) emergencies[idx].resolutionImage = resolutionImage;
            emergencies[idx].updatedAt = new Date().toISOString();
            Storage.set(Storage.KEYS.EMERGENCIES, emergencies);
        }
    },

    addEmergencyFeedback: (id, rating, comment) => {
        const emergencies = Storage.get(Storage.KEYS.EMERGENCIES, []);
        const idx = emergencies.findIndex(e => e.id === id);
        if (idx !== -1) {
            emergencies[idx].status = 'CLOSED';
            emergencies[idx].feedbackRating = rating;
            emergencies[idx].feedbackComment = comment;
            emergencies[idx].updatedAt = new Date().toISOString();
            Storage.set(Storage.KEYS.EMERGENCIES, emergencies);
        }
    },

    logVehiclePassage: (logData) => {
        const logs = Storage.get(Storage.KEYS.VEHICLE_LOGS, []);
        logs.unshift(logData);
        // Keep last 1000 for simulation performance
        if (logs.length > 1000) logs.pop();
        Storage.set(Storage.KEYS.VEHICLE_LOGS, logs);
    },

    addAdminAlert: (alert) => {
        const alerts = Storage.get(Storage.KEYS.ADMIN_ALERTS, []);
        const record = {
            ...alert,
            id:        alert.id        || Utils.generateId('ALT'),
            timestamp: alert.timestamp || new Date().toISOString()
        };
        alerts.unshift(record);
        Storage.set(Storage.KEYS.ADMIN_ALERTS, alerts);
    },

    removeAdminAlert: (id) => {
        const alerts = Storage.get(Storage.KEYS.ADMIN_ALERTS, []);
        const updated = alerts.filter(a => a.id !== id);
        Storage.set(Storage.KEYS.ADMIN_ALERTS, updated);
    },

    setTollCongestion: (tollId, level) => {
        const states = Storage.get(Storage.KEYS.TOLL_STATES, {});
        if (!states[tollId]) states[tollId] = {};
        states[tollId].congestion = level;
        Storage.set(Storage.KEYS.TOLL_STATES, states);
    },

    logTripStart: (tripData) => {
        // Log to vehicle logs so admin OCC sees it
        Storage.logVehiclePassage({
            ...tripData,
            status: 'ACTIVE',
            tollsPassed: [],
            cost: 0
        });
        // Track as active trip
        const trips = Storage.get(Storage.KEYS.ACTIVE_TRIPS, []);
        trips.unshift({ ...tripData, status: 'ACTIVE', startTime: new Date().toISOString(), tollsPassed: [], totalCost: 0 });
        Storage.set(Storage.KEYS.ACTIVE_TRIPS, trips);
    },

    logTripEnd: (tripId, tollsPassed, totalCost, totalDistance = 0) => {
        // Update vehicle log entry for Admin
        const logs = Storage.get(Storage.KEYS.VEHICLE_LOGS, []);
        const logIdx = logs.findIndex(l => l.id === tripId);
        let tripRecord = null;

        if (logIdx !== -1) {
            logs[logIdx].status = 'COMPLETED';
            logs[logIdx].tollsPassed = tollsPassed;
            logs[logIdx].cost = totalCost;
            logs[logIdx].endTime = new Date().toISOString();
            tripRecord = { ...logs[logIdx], totalDistance: parseFloat(totalDistance) };
            Storage.set(Storage.KEYS.VEHICLE_LOGS, logs);
        }

        // Persist to User Trip History for Analytics
        if (tripRecord) {
            const history = Storage.get(Storage.KEYS.TRIP_HISTORY, []);
            history.unshift(tripRecord);
            Storage.set(Storage.KEYS.TRIP_HISTORY, history);
        }

        // Remove from active trips
        const trips = Storage.get(Storage.KEYS.ACTIVE_TRIPS, []);
        const tidx = trips.findIndex(t => t.id === tripId);
        if (tidx !== -1) trips.splice(tidx, 1);
        Storage.set(Storage.KEYS.ACTIVE_TRIPS, trips);
    },

    logTollPassage: (tripId, tollName, cost) => {
        // Update the vehicle log entry with toll passage
        const logs = Storage.get(Storage.KEYS.VEHICLE_LOGS, []);
        const logIdx = logs.findIndex(l => l.id === tripId);
        if (logIdx !== -1) {
            logs[logIdx].tollsPassed.push(tollName);
            logs[logIdx].cost += cost;
            Storage.set(Storage.KEYS.VEHICLE_LOGS, logs);
        }
    },

    seedDemoData: () => {
        // 1. Set FASTag Balance
        Storage.set(Storage.KEYS.FASTAG_BALANCE, 2850);
        
        // 2. Recharge History
        const now = new Date();
        Storage.set(Storage.KEYS.RECHARGE_HISTORY, [
            { id: 'TXN-9382', date: new Date(now.getTime() - 86400000).toISOString(), amount: 1000, fee: 10, net: 990, gateway: 'PhonePe UPI' },
            { id: 'TXN-9211', date: new Date(now.getTime() - 400000000).toISOString(), amount: -245, fee: 0, net: -245, gateway: 'Ludhiana Toll Plaza' },
            { id: 'TXN-8843', date: new Date(now.getTime() - 800000000).toISOString(), amount: 2000, fee: 20, net: 1980, gateway: 'Net Banking' }
        ]);

        // 3. Trip History
        Storage.set(Storage.KEYS.TRIP_HISTORY, [
            { id: 'TRP-DEMO1', origin: 'Chandigarh', dest: 'Ambala', tollsPassed: ['Dapper Toll Plaza', 'Ambala Toll'], cost: 185, totalDistance: 45.2, startTime: new Date(now.getTime() - 400000000).toISOString(), endTime: new Date(now.getTime() - 390000000).toISOString(), status: 'COMPLETED' },
            { id: 'TRP-DEMO2', origin: 'Delhi', dest: 'Panipat', tollsPassed: ['Singhu Border Toll', 'Murthal Toll'], cost: 210, totalDistance: 85.5, startTime: new Date(now.getTime() - 900000000).toISOString(), endTime: new Date(now.getTime() - 890000000).toISOString(), status: 'COMPLETED' }
        ]);

        // 4. Vehicle Garage
        Storage.set('nhai_vehicles', [
            { id: 'V-1111', regNum: 'DL-1C-AA-1111', type: 'LMV', make: 'Honda City', verified: true },
            { id: 'V-2222', regNum: 'HR-26-BB-2222', type: 'LCV', make: 'Mahindra Bolero', verified: false }
        ]);

        // 5. Gamification XP
        localStorage.setItem('nhai_xp', '450');
        localStorage.setItem('nhai_gamified_level', '2');
        localStorage.setItem('nhai_achievements', JSON.stringify({"first_trip":true, "fastag_hero":true}));

        // 6. Toll Congestion
        const states = {};
        if (window.TollSeedData) {
            const congestionLevels = ['NORMAL', 'NORMAL', 'NORMAL', 'MODERATE', 'MODERATE', 'HIGH'];
            TollSeedData.slice(0, 500).forEach(toll => {
                const rand = congestionLevels[Math.floor(Math.random() * congestionLevels.length)];
                states[toll.id] = { congestion: rand };
            });
        }
        Storage.set(Storage.KEYS.TOLL_STATES, states);

        // 7. Live Vehicles for Admin Map
        const livePos = {
            'TRP-V1': { lat: 28.7041, lng: 77.1025, timestamp: new Date().toISOString() }, // Delhi
            'TRP-V2': { lat: 19.0760, lng: 72.8777, timestamp: new Date().toISOString() }, // Mumbai
            'TRP-V3': { lat: 13.0827, lng: 80.2707, timestamp: new Date().toISOString() }, // Chennai
            'TRP-V4': { lat: 22.5726, lng: 88.3639, timestamp: new Date().toISOString() }, // Kolkata
            'TRP-V5': { lat: 12.9716, lng: 77.5946, timestamp: new Date().toISOString() }  // Bangalore
        };
        Storage.set('nhai_live_positions', livePos);

        console.log('[Storage] Demo data seeded successfully.');
    }
};

window.Storage = Storage;

// Sync database from backend first, then verify defaults
Storage.syncFromBackend().then(() => {
    Storage.initDefaults();
});
