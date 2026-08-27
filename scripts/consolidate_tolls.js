const fs = require('fs');
const path = require('path');

const tolls = JSON.parse(fs.readFileSync(path.join(__dirname, '../tolls.json'), 'utf8'));

const consolidated = [];

for (let i = 0; i < tolls.length; i++) {
    const t = tolls[i];
    const normName = (t.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    
    let existing = null;
    for (const m of consolidated) {
        const mNorm = (m.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const dLat = (m.lat - t.lat) * 111;
        const dLng = (m.lng - t.lng) * 111 * Math.cos(t.lat * Math.PI / 180);
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);
        
        if (normName === mNorm || dist < 2.5) {
            existing = m;
            break;
        }
    }

    if (!existing) {
        const dirA = 'Inbound (Entry / Direction A)';
        const dirB = 'Outbound (Exit / Opposite Direction B)';
        
        consolidated.push({
            id: 'TP_' + (consolidated.length + 1),
            name: t.name,
            lat: t.lat,
            lng: t.lng,
            state: t.state || 'India',
            district: t.district || '',
            nhCorridor: t.nhCorridor || 'NH-44',
            baseRate: t.baseRate || 85,
            lanesInbound: 3,
            lanesOutbound: 3,
            totalLanes: 6,
            directionA: dirA,
            directionB: dirB,
            tollRatesByVehicleClass: t.tollRatesByVehicleClass || {
                LMV: t.baseRate || 85,
                LCV: Math.round((t.baseRate || 85) * 1.6),
                BUS_2AXLE: Math.round((t.baseRate || 85) * 3.3),
                COM_3AXLE: Math.round((t.baseRate || 85) * 3.6),
                MAV_4_6: Math.round((t.baseRate || 85) * 5.2),
                OVERSIZED: Math.round((t.baseRate || 85) * 6.4),
                BIKE: 0
            },
            returnRatesByVehicleClass: t.returnRatesByVehicleClass || {
                LMV: Math.round(((t.baseRate || 85) * 1.5) / 5) * 5,
                LCV: Math.round(((t.baseRate || 85) * 1.6 * 1.5) / 5) * 5,
                BUS_2AXLE: Math.round(((t.baseRate || 85) * 3.3 * 1.5) / 5) * 5,
                COM_3AXLE: Math.round(((t.baseRate || 85) * 3.6 * 1.5) / 5) * 5,
                MAV_4_6: Math.round(((t.baseRate || 85) * 5.2 * 1.5) / 5) * 5,
                OVERSIZED: Math.round(((t.baseRate || 85) * 6.4 * 1.5) / 5) * 5,
                BIKE: 0
            }
        });
    }
}

fs.writeFileSync(path.join(__dirname, '../tolls.json'), JSON.stringify(consolidated, null, 2));

const jsContent = `const TollSeedData = ${JSON.stringify(consolidated, null, 2)};

if (typeof window !== 'undefined') {
    window.TollSeedData = TollSeedData;
}
if (typeof module !== 'undefined') {
    module.exports = TollSeedData;
}
`;

fs.writeFileSync(path.join(__dirname, '../js/shared/tollSeedData.js'), jsContent);

console.log(`Successfully wrote ${consolidated.length} consolidated bidirectional toll plazas.`);
