// Simulated Data for Toll Plazas (Now pulling from LocalStorage Array)

const TollData = {
    init: () => {
        // TollSeedData is loaded via <script> tag — no need to duplicate in localStorage
        // Remove legacy copy if present to free up localStorage budget
        if (localStorage.getItem('nhai_tolls')) {
            localStorage.removeItem('nhai_tolls');
            console.log('TollData: cleared legacy localStorage copy to free space.');
        }
        // Filter out any fake/erroneous tolls outside India's bounding box
        if (window.TollSeedData) {
            window.TollSeedData = window.TollSeedData.filter(toll => {
                return toll.lat && toll.lng && 
                       toll.lat >= 6.5 && toll.lat <= 37.6 && 
                       toll.lng >= 68.0 && toll.lng <= 97.5;
            });
        }
        console.log(`TollData ready: ${(window.TollSeedData || []).length} plazas loaded.`);
    },

    getAllTolls: () => {
        if (window.TollSeedData && !window._tollsFiltered) {
            window.TollSeedData = window.TollSeedData.filter(toll => {
                return toll.lat && toll.lng && 
                       toll.lat >= 6.5 && toll.lat <= 37.6 && 
                       toll.lng >= 68.0 && toll.lng <= 97.5;
            });
            window._tollsFiltered = true;
        }
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

    // Official NHAI Fee Rules Multipliers by Vehicle Category (Gazette of India Fee Schedule)
    categoryMultipliers: {
        'LMV': 1.0,          // Car / Jeep / Van / Tata Ace (Private)
        'LCV': 1.62,         // Light Commercial Vehicle / Mini-Bus
        'BUS_2AXLE': 3.39,   // Bus / 2-Axle Truck
        'COM_3AXLE': 3.70,   // 3-Axle Commercial Vehicle
        'MAV_4_6': 5.32,     // 4 to 6-Axle Heavy MAV / Construction Machinery
        'OVERSIZED': 6.48,   // 7+ Axles Over-sized Vehicle
        'BIKE': 0.0,         // Two-Wheeler (NHAI Toll Exempt under NH Fee Rules)
        // Priority / Pre-Registered Exempt Vehicles (Rule 11)
        'GOVT': 0.0,
        'PRESS': 0.0,
        'ARMY': 0.0,
        'AMBULANCE': 0.0,
        'FIRE': 0.0,
        'POLICE': 0.0
    },

    passes: {
        MONTHLY_LOCAL: { price: 350, label: 'Monthly Pass (Local Plaza - within 20km)' },
        ANNUAL_NH: { price: 3075, label: 'Annual Pass (National Highways)', eligibility: 'LMV' },
        MONTHLY_PLAZA: { multiplier: 33.5, label: 'Commercial Monthly Pass (50 Trips)' }, 
        RETURN: { multiplier: 1.5, label: 'Return Pass (2-Way within 24h)' }, 
    },

    getTollCost: (plazaId, category = 'LMV', journeyType = 'SINGLE') => {
        const plaza = TollData.getTollById(plazaId);
        if (!plaza) return 0;
        
        // Handle priority / exempt vehicles
        const isExempt = ['GOVT','PRESS','ARMY','AMBULANCE','FIRE','POLICE','BIKE'].includes(category);
        if (isExempt) return 0;

        const isReturn = (journeyType === 'RETURN' || journeyType === '2-WAY' || journeyType === 'ROUND');

        if (isReturn) {
            if (plaza.returnRatesByVehicleClass && plaza.returnRatesByVehicleClass[category] !== undefined && plaza.returnRatesByVehicleClass[category] > 0) {
                return plaza.returnRatesByVehicleClass[category];
            }
            if (plaza.returnRate && category === 'LMV') return plaza.returnRate;
        } else {
            if (plaza.tollRatesByVehicleClass && plaza.tollRatesByVehicleClass[category] !== undefined && plaza.tollRatesByVehicleClass[category] > 0) {
                return plaza.tollRatesByVehicleClass[category];
            }
        }

        // Accurate NHAI vehicle multiplier based on plaza base rate
        const base = plaza.baseRate || plaza.singleJourney || 50;
        const mult = TollData.categoryMultipliers[category] !== undefined ? TollData.categoryMultipliers[category] : 1.0;
        const singleCost = Math.round((base * mult) / 5) * 5;
        
        if (isReturn) {
            return Math.round((singleCost * 1.5) / 5) * 5;
        }
        return singleCost;
    },

    getTollSchedule: (plazaId) => {
        const plaza = TollData.getTollById(plazaId);
        if (!plaza) return null;
        return {
            id: plaza.id,
            name: plaza.name,
            state: plaza.state,
            nhCorridor: plaza.nhCorridor,
            baseRate: plaza.baseRate,
            returnRate: plaza.returnRate || Math.round((plaza.baseRate * 1.5) / 5) * 5,
            singleRates: plaza.tollRatesByVehicleClass || {},
            returnRates: plaza.returnRatesByVehicleClass || {},
            monthlyRates: plaza.monthlyPassByVehicleClass || {},
            localMonthlyPass: plaza.monthlyPassLocal || 350
        };
    }
};

window.TollData = TollData;
// Auto-initialize when file loads 
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', TollData.init);
} else {
    TollData.init();
}
