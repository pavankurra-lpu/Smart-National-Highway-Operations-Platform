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
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    },

    set: (key, value) => {
        localStorage.setItem(key, JSON.stringify(value));
        // Cross-tab trigger manually for the current window just in case
        window.dispatchEvent(new Event('local-storage-update'));
    },

    initDefaults: () => {
        if (Storage.get(Storage.KEYS.FASTAG_BALANCE) === null) {
            Storage.set(Storage.KEYS.FASTAG_BALANCE, 1500); // Default simulated balance
        }
        if (!Storage.get(Storage.KEYS.EMERGENCIES)) Storage.set(Storage.KEYS.EMERGENCIES, []);
        if (!Storage.get(Storage.KEYS.ADMIN_ALERTS)) Storage.set(Storage.KEYS.ADMIN_ALERTS, []);
        if (!Storage.get(Storage.KEYS.VEHICLE_LOGS)) Storage.set(Storage.KEYS.VEHICLE_LOGS, []);
        if (!Storage.get(Storage.KEYS.TRIP_HISTORY)) Storage.set(Storage.KEYS.TRIP_HISTORY, []);
        if (!Storage.get(Storage.KEYS.TOLL_STATES)) Storage.set(Storage.KEYS.TOLL_STATES, {});
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
        alerts.unshift({ ...alert, id: Utils.generateId('ALT'), timestamp: new Date().toISOString() });
        Storage.set(Storage.KEYS.ADMIN_ALERTS, alerts);
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
    }
};

window.Storage = Storage;

// Initialize on load
Storage.initDefaults();
