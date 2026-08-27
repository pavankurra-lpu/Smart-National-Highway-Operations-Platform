/**
 * Test Suite: Adaptive Multi-Signal Toll-Lane Recommendation Engine
 * 
 * Verifies mathematical integrity, tri-signal fusion formula, edge cases,
 * temporal decay dynamics, and decision tree arbitration.
 */

const assert = require('assert');
const AdaptiveLaneEngine = require('../js/shared/adaptiveLaneEngine.js');

let totalPassed = 0;
let totalFailed = 0;

function runTest(testName, testFn) {
    try {
        testFn();
        console.log(`  \x1b[32m✔ PASS:\x1b[0m ${testName}`);
        totalPassed++;
    } catch (err) {
        console.error(`  \x1b[31m✖ FAIL:\x1b[0m ${testName}`);
        console.error(`    \x1b[33mError:\x1b[0m ${err.message}`);
        totalFailed++;
    }
}

console.log('\n=============================================================');
console.log('🧪 RUNNING ADAPTIVE LANE ENGINE UNIT TEST SUITE');
console.log('=============================================================\n');

// ── TEST 1: ZERO BALANCE / NEGATIVE BALANCE FORECAST ───────────────────────
runTest('Edge Case 1: Zero balance forces S_balance = 1.0 and recommends Trip Pass', () => {
    const result = AdaptiveLaneEngine.evaluateRoute({
        currentBalance: 0,
        proposedTripCost: 150,
        tripHistory: [
            { cost: 150, startTime: new Date(Date.now() - 86400000).toISOString() },
            { cost: 150, startTime: new Date(Date.now() - 172800000).toISOString() }
        ],
        rechargeHistory: [
            { amount: 500, date: new Date(Date.now() - 604800000).toISOString() },
            { amount: 500, date: new Date(Date.now() - 1209600000).toISOString() }
        ],
        weatherSummary: 'CLEAR',
        incidents: []
    });

    assert.strictEqual(result.signals.s_balance, 1.0, 'S_balance must be 1.0 for zero balance');
    assert.strictEqual(result.subMetrics.balance.isDepletingEarly, true, 'Must flag early depletion');
    assert.strictEqual(result.subMetrics.balance.tripsUntilDepletion, 0, 'Trips until depletion must be 0');
    assert.strictEqual(result.decision, 'Recommend Trip Pass', 'Decision must be Recommend Trip Pass');
    assert.ok(result.auditId.startsWith('AUD-'), 'Audit ID must be properly generated');
    assert.ok(result.rationale.length > 10, 'Rationale must be descriptive');
});

// ── TEST 2: COLD START (NO TRIP OR RECHARGE HISTORY) ───────────────────────
runTest('Edge Case 2: Cold Start (zero history) utilizes safe mathematical fallbacks without NaN', () => {
    const balSignal = AdaptiveLaneEngine.calculateBalanceSignal({
        currentBalance: 800,
        tripHistory: [],
        rechargeHistory: []
    });

    assert.ok(!isNaN(balSignal.signalValue), 'Signal value must not be NaN');
    assert.ok(!isNaN(balSignal.emaSpend), 'EMA spend must not be NaN');
    assert.strictEqual(balSignal.emaSpend, AdaptiveLaneEngine.config.defaultEmaSpend, 'Must match default fallback EMA');
    assert.strictEqual(balSignal.tripsUntilRecharge, 7, 'Must fallback to default ratio (336h / 48h = 7 trips)');

    const fullResult = AdaptiveLaneEngine.evaluateRoute({
        currentBalance: 800,
        tripHistory: [],
        rechargeHistory: [],
        weatherSummary: null,
        incidents: []
    });

    assert.ok(!isNaN(fullResult.compositeScore), 'Composite score must be a valid number');
    assert.ok(fullResult.compositeScore >= 0 && fullResult.compositeScore <= 1.0, 'Score must be bounded in [0, 1]');
});

// ── TEST 3: ALL-FALSE-ALARM ROUTE WITH INCIDENT FEEDBACK ───────────────────
runTest('Edge Case 3: All-false-alarm incidents decay to zero risk (S_incident = 0.0)', () => {
    const now = new Date();
    const mockIncidents = [
        {
            id: 'SOS-001',
            type: 'ACCIDENT',
            status: 'RESOLVED',
            verificationType: 'FALSE_ALARM',
            location: 'NH-48 Corridor Mile 42',
            timestamp: new Date(now.getTime() - 1000 * 60 * 30).toISOString() // 30 mins ago
        },
        {
            id: 'SOS-002',
            type: 'ROAD_BLOCK',
            status: 'CLOSED',
            verificationType: 'FALSE_ALARM',
            location: 'NH-48 Corridor Mile 50',
            timestamp: new Date(now.getTime() - 1000 * 60 * 60).toISOString() // 1 hr ago
        }
    ];

    const incSignal = AdaptiveLaneEngine.calculateIncidentSignal({
        incidents: mockIncidents,
        routeCorridors: ['NH-48'],
        evaluationTime: now
    });

    assert.strictEqual(incSignal.signalValue, 0.0, 'S_incident must be 0.0 for pure false alarms');
    assert.strictEqual(incSignal.falseAlarmCount, 2, 'Must record 2 false alarms');
    assert.strictEqual(incSignal.confirmedCount, 0, 'Confirmed count must be 0');
    assert.ok(incSignal.rawIncidentScore <= 0, 'Raw incident score must be non-positive');
});

// ── TEST 4: SEVERE WEATHER + HIGH CONGESTION + CONFIRMED INCIDENT ──────────
runTest('Edge Case 4: Severe Storm + Confirmed Crash triggers "Switch Route" (URGENT)', () => {
    const now = new Date();
    // Monday at 9:00 AM (Rush hour peak)
    const mondayMorning = new Date(2026, 7, 24, 9, 0, 0);

    const mockIncidents = [
        {
            id: 'SOS-CRASH-99',
            type: 'MAJOR_CRASH_PILEUP',
            status: 'RAISED', // Active live incident
            location: 'NH-48 Expressway Ghamroj',
            timestamp: new Date(mondayMorning.getTime() - 1000 * 60 * 15).toISOString() // 15 min ago
        },
        {
            id: 'SOS-CRASH-98',
            type: 'WATERLOG_BLOCK',
            status: 'RESOLVED',
            verificationType: 'CONFIRMED',
            location: 'NH-48 Expressway Tauru',
            timestamp: new Date(mondayMorning.getTime() - 1000 * 60 * 45).toISOString() // 45 min ago
        }
    ];

    const result = AdaptiveLaneEngine.evaluateRoute({
        currentBalance: 2000,
        proposedTripCost: 180,
        currentTime: mondayMorning,
        weatherSummary: 'STORM',
        tollsOnRoute: [
            { id: 'TOLL_GHAMROJ', congestion: 'HIGH' },
            { id: 'TOLL_TAURU', congestion: 'HIGH' }
        ],
        incidents: mockIncidents,
        routeCorridors: ['NH-48', 'Ghamroj', 'Tauru']
    });

    assert.ok(result.signals.s_incident >= 0.65, `S_incident (${result.signals.s_incident}) should be >= 0.65`);
    assert.ok(result.signals.s_eta >= 0.50, `S_eta (${result.signals.s_eta}) should be >= 0.50`);
    assert.strictEqual(result.decision, 'Switch Route', 'Must trigger Switch Route decision');
    assert.strictEqual(result.priority, 'URGENT', 'Priority must be URGENT');
});

// ── TEST 5: HIGH-FREQUENCY COMMUTER MONTHLY PASS OPTIMIZATION ──────────────
runTest('Edge Case 5: Frequent commuter (22 trips/mo, high spend) triggers "Recommend Monthly Pass"', () => {
    const now = new Date();
    const tripIntervalMs = (1000 * 60 * 60 * 24 * 30) / 22; // ~32.7 hours between trips (~22 trips/month)

    const mockTrips = [];
    for (let i = 0; i < 10; i++) {
        mockTrips.unshift({
            id: `TRP-COMMUTE-${i}`,
            cost: 190, // ₹190 per trip * 22 = ₹4,180/mo (far exceeds ₹1,200 monthly pass)
            startTime: new Date(now.getTime() - (i * tripIntervalMs)).toISOString(),
            endTime: new Date(now.getTime() - (i * tripIntervalMs) + 3600000).toISOString()
        });
    }

    const mockRecharges = [
        { amount: 1000, date: new Date(now.getTime() - (1000 * 60 * 60 * 24 * 14)).toISOString() },
        { amount: 1000, date: new Date(now.getTime() - (1000 * 60 * 60 * 24 * 28)).toISOString() }
    ];

    const result = AdaptiveLaneEngine.evaluateRoute({
        currentBalance: 400, // Balance covers ~2 trips before depleting prior to 14-day recharge
        proposedTripCost: 190,
        tripHistory: mockTrips,
        rechargeHistory: mockRecharges,
        weatherSummary: 'CLEAR',
        incidents: []
    });

    assert.ok(result.subMetrics.balance.monthlyTripsEstimate >= 8, 'Monthly trips estimate must be >= 8');
    assert.ok(result.subMetrics.balance.monthlySpendForecast >= 1200, 'Monthly spend forecast must exceed ₹1200');
    assert.strictEqual(result.decision, 'Recommend Monthly Pass', 'Must recommend Monthly Pass');
    assert.strictEqual(result.priority, 'HIGH', 'Priority must be HIGH');
});

// ── TEST 6: ONLINE WEIGHT RECALIBRATION & NORMALIZATION ─────────────────────
runTest('Recalibration: Engine dynamically recalibrates and normalizes weights', () => {
    // Save previous weights
    const prevWeights = { ...AdaptiveLaneEngine.config.weights };

    // Set non-normalized weights summing to 2.0
    const success = AdaptiveLaneEngine.recalibrateWeights({
        balance: 1.0,
        eta: 0.6,
        incident: 0.4
    });

    assert.strictEqual(success, true, 'Recalibration should succeed');
    assert.strictEqual(AdaptiveLaneEngine.config.weights.balance, 0.50, 'Balance weight normalized to 0.50');
    assert.strictEqual(AdaptiveLaneEngine.config.weights.eta, 0.30, 'ETA weight normalized to 0.30');
    assert.strictEqual(AdaptiveLaneEngine.config.weights.incident, 0.20, 'Incident weight normalized to 0.20');

    // Restore default weights
    AdaptiveLaneEngine.recalibrateWeights(prevWeights);
    assert.strictEqual(AdaptiveLaneEngine.config.weights.balance, prevWeights.balance, 'Restored balance weight');
});

// ── TEST 7: TEMPORAL EXPONENTIAL DECAY VERIFICATION ─────────────────────────
runTest('Temporal Decay: Confirmed incident decays significantly after 24 hours vs 30 minutes', () => {
    const evalTime = new Date(2026, 7, 27, 12, 0, 0);

    const freshIncident = [{
        id: 'INC-FRESH',
        type: 'ACCIDENT',
        status: 'RESOLVED',
        verificationType: 'CONFIRMED',
        location: 'NH-44 Corridor',
        timestamp: new Date(evalTime.getTime() - 1000 * 60 * 30).toISOString() // 0.5 hrs ago
    }];

    const oldIncident = [{
        id: 'INC-OLD',
        type: 'ACCIDENT',
        status: 'RESOLVED',
        verificationType: 'CONFIRMED',
        location: 'NH-44 Corridor',
        timestamp: new Date(evalTime.getTime() - 1000 * 60 * 60 * 24).toISOString() // 24 hrs ago
    }];

    const freshSignal = AdaptiveLaneEngine.calculateIncidentSignal({
        incidents: freshIncident,
        routeCorridors: ['NH-44'],
        evaluationTime: evalTime
    });

    const oldSignal = AdaptiveLaneEngine.calculateIncidentSignal({
        incidents: oldIncident,
        routeCorridors: ['NH-44'],
        evaluationTime: evalTime
    });

    assert.ok(freshSignal.signalValue > 0.40, `Fresh signal (${freshSignal.signalValue}) should be high`);
    assert.ok(oldSignal.signalValue < 0.05, `Old signal (${oldSignal.signalValue}) should decay to < 0.05`);
    assert.ok(freshSignal.signalValue > oldSignal.signalValue * 8, 'Fresh incident must score >8x higher than 24h old incident');
});

console.log('\n-------------------------------------------------------------');
console.log(`🏁 TEST RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
console.log('-------------------------------------------------------------\n');

if (totalFailed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
