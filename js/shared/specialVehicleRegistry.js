// Simulated registry for Special Priority Vehicles

const SpecialVehicleRegistry = {
    // A mock database of VIP / Exempt / Emergency plates
    database: {
        'GOVT-1': { category: 'GOVT', authority: 'Central Gov', status: 'ACTIVE' },
        'GOVT-AP-CM': { category: 'GOVT', authority: 'AP State Gov', status: 'ACTIVE' },
        'PRESS-NDTV': { category: 'PRESS', authority: 'National Media', status: 'ACTIVE' },
        'ARMY-01': { category: 'ARMY', authority: 'Defense', status: 'ACTIVE' },
        'AMB-108': { category: 'AMBULANCE', authority: 'Health Dept', status: 'ACTIVE' },
        'FIRE-101': { category: 'FIRE', authority: 'Fire & Rescue', status: 'ACTIVE' },
        'POLICE-100': { category: 'POLICE', authority: 'Law Enforcement', status: 'ACTIVE' }
    },

    verify: (plateOrTagId) => {
        const record = SpecialVehicleRegistry.database[plateOrTagId.toUpperCase()];
        if (record && record.status === 'ACTIVE') {
            return { valid: true, data: record };
        }
        return { valid: false };
    }
};

window.SpecialVehicleRegistry = SpecialVehicleRegistry;
