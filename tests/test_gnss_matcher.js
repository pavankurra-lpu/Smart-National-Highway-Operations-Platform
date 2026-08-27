const assert = require('assert');
const gnss = require('../js/shared/gnssTollMatcher');

console.log('\n=============================================================');
console.log('🧪 RUNNING GNSS TOLL MATCHER UNIT TEST SUITE');
console.log('=============================================================\n');

let passed = 0;
let total = 0;

function test(name, fn) {
    total++;
    try {
        fn();
        console.log(`  ✔ PASS: ${name}`);
        passed++;
    } catch (e) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error('    Error:', e.message);
    }
}

test('Haversine distance calculation matches geodesic baseline', () => {
    const d = gnss.haversineKm(28.6139, 77.2090, 19.0760, 72.8777);
    assert.ok(d > 1140 && d < 1160, `Distance from Delhi to Mumbai should be ~1150km, got ${d}`);
});

test('Bearing calculation correctly identifies Cardinal and Intercardinal headings', () => {
    const northBearing = gnss.calculateBearing(28.0, 77.0, 29.0, 77.0);
    assert.ok(Math.abs(northBearing - 0.0) < 0.1 || Math.abs(northBearing - 360.0) < 0.1, 'North bearing must be 0/360');

    const eastBearing = gnss.calculateBearing(28.0, 77.0, 28.0, 78.0);
    assert.ok(Math.abs(eastBearing - 90.0) < 1.0, 'East bearing must be ~90');
});

test('Cross-track distance correctly computes orthogonal offset from line segment', () => {
    const xte = gnss.crossTrackDistanceKm(28.5100, 77.0006, 28.5000, 77.0000, 28.5200, 77.0000);
    assert.ok(xte > 0.045 && xte < 0.075, `Orthogonal offset should be ~0.058 km, got ${xte}`);
});

test('Route Toll Matching accurately captures on-route toll and ignores off-route plazas', () => {
    const route = [
        [28.4500, 77.0000],
        [28.4600, 77.0100],
        [28.4700, 77.0200],
        [28.4800, 77.0300]
    ];

    const tollPlazas = [
        { id: 'T1', name: 'On Route Plaza', lat: 28.4650, lng: 77.0150, state: 'Haryana' },
        { id: 'T2', name: 'Far Away Plaza', lat: 29.1000, lng: 76.5000, state: 'Haryana' }
    ];

    const matched = gnss.matchRouteTolls(route, tollPlazas, { corridorWidthKm: 0.20 });
    assert.strictEqual(matched.length, 1, 'Only on-route plaza should match');
    assert.strictEqual(matched[0].id, 'T1');
});

test('Virtual Gantry Crossing Confirmation validates geofence and heading alignment', () => {
    const gantry = {
        gantryLat: 28.4000,
        gantryLng: 77.0000,
        gantryBearingDeg: 45.0,
        radiusMeters: 100
    };

    const validCrossing = gnss.confirmGantryCrossing({
        currentLat: 28.4001,
        currentLng: 77.0001,
        speedKmph: 75,
        headingDeg: 48.0
    }, gantry);

    assert.strictEqual(validCrossing.confirmed, true, 'Valid crossing with aligned heading must confirm');
    assert.ok(validCrossing.confidence >= 0.85, 'Confidence must be high');

    const headingMismatch = gnss.confirmGantryCrossing({
        currentLat: 28.4001,
        currentLng: 77.0001,
        speedKmph: 75,
        headingDeg: 140.0
    }, gantry);

    assert.strictEqual(headingMismatch.confirmed, false, 'Perpendicular cross-traffic must be rejected');
    assert.strictEqual(headingMismatch.reason, 'HEADING_MISMATCH');
});

console.log('\n-------------------------------------------------------------');
console.log(`🏁 TEST RESULTS: ${passed}/${total} PASSED, ${total - passed} FAILED`);
console.log('-------------------------------------------------------------\n');

if (passed === total) {
    process.exit(0);
} else {
    process.exit(1);
}
