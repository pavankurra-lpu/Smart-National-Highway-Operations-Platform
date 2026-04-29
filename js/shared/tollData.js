// Simulated Data for Toll Plazas (Now pulling from LocalStorage Array)

const TollData = {
    init: () => {
        // TollSeedData is loaded via <script> tag — no need to duplicate in localStorage
        // Remove legacy copy if present to free up localStorage budget
        if (localStorage.getItem('nhai_tolls')) {
            localStorage.removeItem('nhai_tolls');
            console.log('TollData: cleared legacy localStorage copy to free space.');
        }
        console.log(`TollData ready: ${(window.TollSeedData || []).length} plazas loaded.`);
    },

    getAllTolls: () => {
        return window.TollSeedData || [];
    },

    getTollById: (id) => {
        // Search in the merged list
        const tolls = TollData.getAllTolls();
        // Check both id and tollId (some datasets use tollId)
        return tolls.find(t => t.id === id || t.tollId === id || t.id === "TP_" + id);
    },

    searchTollsByName: (query) => {
        const q = query.toLowerCase();
        return TollData.getAllTolls().filter(t => {
            const name = t.name || t.tollName || t.plazaName || "";
            return name.toLowerCase().includes(q);
        });
    },

    filterByState: (state) => {
        if (!state || state === 'ALL') return TollData.getAllTolls();
        return TollData.getAllTolls().filter(t => t.state === state);
    },

    filterByCorridor: (corridor) => {
        if (!corridor || corridor === 'ALL') return TollData.getAllTolls();
        return TollData.getAllTolls().filter(t => t.nhCorridor === corridor);
    },

    getTollCongestionStatus: (tollId) => {
        // Read admin-set congestion from shared storage instead of random
        const states = Storage.get(Storage.KEYS.TOLL_STATES, {});
        const level = states[tollId]?.congestion || 'NORMAL';
        const map = {
            'HIGH':     { status: 'HIGH',   label: 'Heavy Traffic', color: '#ff5e5e' },
            'MODERATE': { status: 'MEDIUM', label: 'Moderate',      color: '#fcd34d' },
            'NORMAL':   { status: 'NORMAL', label: 'Normal',        color: '#64ffda' }
        };
        return map[level] || map['NORMAL'];
    },

    // NHAI Style Multipliers based on vehicle category (FY 2026-27 Updates)
    categoryMultipliers: {
        'LMV': 1.0,          // Car / Jeep / Van
        'LCV': 1.6,          // Light Commercial Vehicle
        'BUS_2AXLE': 3.3,    // Bus/Truck 2 Axle
        'COM_3AXLE': 3.6,    // 3-axle commercial
        'MAV_4_6': 5.2,      // MAV 4-6 axles
        'OVERSIZED': 6.3,    // 7+ axles
        // Special Pre-Registered
        'GOVT': 0.0,
        'PRESS': 0.0,
        'ARMY': 0.0,
        'AMBULANCE': 0.0,
        'FIRE': 0.0,
        'POLICE': 0.0
    },

    passes: {
        MONTHLY_LOCAL: { price: 335, label: 'Monthly Pass (Local Plaza)' },
        ANNUAL_NH: { price: 3075, label: 'Annual Pass (National Highways)', eligibility: 'LMV' },
        MONTHLY_PLAZA: { multiplier: 33, label: 'Monthly Plaza Pass' }, 
        RETURN: { multiplier: 1.5, label: 'Return Pass' }, 
    },

    getTollCost: (plazaId, category) => {
        const plaza = TollData.getTollById(plazaId);
        if (!plaza) return 0;
        
        // Handle vehicle class specific rates if present in the plaza data
        if (plaza.tollRatesByVehicleClass && plaza.tollRatesByVehicleClass[category] !== undefined) {
            return plaza.tollRatesByVehicleClass[category];
        }

        // Fallback for older mocks or simple base rates
        const base = plaza.baseRate || plaza.singleJourney || 0;
        const mult = TollData.categoryMultipliers[category] !== undefined ? TollData.categoryMultipliers[category] : 1.0;
        return Math.floor(base * mult);
    }
};

window.TollData = TollData;
// Auto-initialize when file loads 
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', TollData.init);
} else {
    TollData.init();
}
