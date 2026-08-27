/**
 * Adaptive Multi-Signal Toll-Lane & Pass Recommendation Engine
 * 
 * Implements a tri-signal arbitration algorithm fusing:
 *  1. FASTag balance depletion forecasting (Exponential Moving Average + Recharge Interval Inference)
 *  2. Weather-adjusted, time-of-day/day-of-week congestion-corrected ETA multiplier
 *  3. Incident-feedback reliability score with exponential temporal decay (Confirmed vs False Alarm)
 * 
 * Documented as a technical invention disclosure in docs/INVENTION-DISCLOSURE.md
 */

const AdaptiveLaneEngine = {
    // ── CONFIGURATION PARAMETERS (Adjustable & Recalibratable) ─────────────────
    config: {
        // Signal Weights (must sum to 1.0)
        weights: {
            balance: 0.35,
            eta: 0.35,
            incident: 0.30
        },
        // EMA smoothing factor for toll spend (0 < alpha <= 1)
        emaAlpha: 0.35,
        // Fallback default toll spend per trip if no history exists (INR)
        defaultEmaSpend: 120.0,
        // Fallback recharge interval if insufficient history (hours)
        defaultRechargeIntervalHours: 336.0, // 14 days
        // Fallback trip interval if insufficient history (hours)
        defaultTripIntervalHours: 48.0,      // 2 days
        // Maximum normalized ETA multiplier ceiling for scaling
        maxEtaMultiplier: 2.5,
        // Incident temporal decay half-life in hours
        incidentHalfLifeHours: 4.0,
        // Normalization factor for raw incident score
        incidentNormFactor: 2.5,
        // Thresholds for decision outputs
        thresholds: {
            switchRouteComposite: 0.70,
            switchRouteIncidentMin: 0.40,
            switchRouteIncidentDominant: 0.65,
            switchRouteEtaMin: 0.50,
            monthlyPassMinMonthlyTrips: 8,
            monthlyPassCostThreshold: 1200.0, // INR
            monthlyPassBalanceSignalMin: 0.45,
            tripPassBalanceSignalMin: 0.50,
            tripPassCombinedMin: 0.30,
            tripPassEtaMin: 0.40,
            noActionMaxComposite: 0.35
        },
        // Maximum audit records stored in circular memory buffer
        maxAuditLogSize: 200
    },

    // ── AUDIT LOG BUFFER ───────────────────────────────────────────────────────
    auditLogs: [],

    // ── 1. FASTAG BALANCE DEPLETION FORECAST SIGNAL (S_balance) ───────────────
    /**
     * Projects remaining balance N trips forward using rolling Exponential Moving Average (EMA).
     * Compares depletion velocity against inferred recharge periodicity.
     * 
     * @param {Object} params
     * @param {number} params.currentBalance - Current FASTag wallet balance
     * @param {Array<Object>} [params.tripHistory] - List of historical trips with cost & timestamps
     * @param {Array<Object>} [params.rechargeHistory] - List of historical recharges with amount & timestamps
     * @param {number} [params.proposedTripCost] - Expected toll cost of current route
     * @returns {Object} { signalValue, emaSpend, tripsUntilRecharge, tripsUntilDepletion, projectedBalance, isDepletingEarly, monthlySpendForecast }
     */
    calculateBalanceSignal: (params = {}) => {
        const currentBalance = typeof params.currentBalance === 'number' ? params.currentBalance : 0;
        const tripHistory = Array.isArray(params.tripHistory) ? params.tripHistory : [];
        const rechargeHistory = Array.isArray(params.rechargeHistory) ? params.rechargeHistory : [];
        const proposedTripCost = typeof params.proposedTripCost === 'number' ? params.proposedTripCost : null;

        const alpha = AdaptiveLaneEngine.config.emaAlpha;

        // A. Calculate Exponential Moving Average (EMA) of toll spend
        let emaSpend = AdaptiveLaneEngine.config.defaultEmaSpend;
        const completedTripsWithCost = tripHistory
            .filter(t => t && typeof t.cost === 'number' && t.cost > 0)
            .sort((a, b) => new Date(a.startTime || a.endTime || 0) - new Date(b.startTime || b.endTime || 0));

        if (completedTripsWithCost.length > 0) {
            emaSpend = completedTripsWithCost[0].cost;
            for (let i = 1; i < completedTripsWithCost.length; i++) {
                emaSpend = (alpha * completedTripsWithCost[i].cost) + ((1 - alpha) * emaSpend);
            }
        }

        // If a proposed route cost is provided, blend it into the operational spend
        const effectiveTripSpend = proposedTripCost !== null && proposedTripCost > 0
            ? (alpha * proposedTripCost) + ((1 - alpha) * emaSpend)
            : emaSpend;

        // B. Infer Historical Recharge Interval (Delta t_recharge)
        let rechargeIntervalHours = AdaptiveLaneEngine.config.defaultRechargeIntervalHours;
        const validRecharges = rechargeHistory
            .filter(r => r && (r.amount > 0 || r.net > 0) && r.date)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        if (validRecharges.length >= 2) {
            let totalDiffMs = 0;
            for (let i = 1; i < validRecharges.length; i++) {
                totalDiffMs += Math.max(0, new Date(validRecharges[i].date) - new Date(validRecharges[i - 1].date));
            }
            const avgDiffHours = (totalDiffMs / (validRecharges.length - 1)) / (1000 * 60 * 60);
            if (avgDiffHours > 1) {
                rechargeIntervalHours = avgDiffHours;
            }
        }

        // C. Infer Historical Trip Frequency (Delta t_trip)
        let tripIntervalHours = AdaptiveLaneEngine.config.defaultTripIntervalHours;
        if (completedTripsWithCost.length >= 2) {
            let totalTripDiffMs = 0;
            for (let i = 1; i < completedTripsWithCost.length; i++) {
                const tA = new Date(completedTripsWithCost[i - 1].startTime || completedTripsWithCost[i - 1].endTime);
                const tB = new Date(completedTripsWithCost[i].startTime || completedTripsWithCost[i].endTime);
                totalTripDiffMs += Math.max(0, tB - tA);
            }
            const avgTripDiffHours = (totalTripDiffMs / (completedTripsWithCost.length - 1)) / (1000 * 60 * 60);
            if (avgTripDiffHours > 0.5) {
                tripIntervalHours = avgTripDiffHours;
            }
        }

        // D. Projected Trips Until Next Expected Recharge
        const tripsUntilRecharge = Math.max(1, Math.round(rechargeIntervalHours / tripIntervalHours));

        // E. Forward Depletion Projection
        const tripsUntilDepletion = effectiveTripSpend > 0
            ? (currentBalance > 0 ? currentBalance / effectiveTripSpend : 0)
            : Infinity;

        const projectedBalance = currentBalance - (tripsUntilRecharge * effectiveTripSpend);
        const isDepletingEarly = projectedBalance < 0 || currentBalance <= 0;

        // F. Monthly Spend Forecast
        const monthlyTripsEstimate = Math.max(1, Math.round((24 * 30) / tripIntervalHours));
        const monthlySpendForecast = monthlyTripsEstimate * effectiveTripSpend;

        // G. Normalized Signal Value S_balance in [0.0, 1.0]
        let signalValue = 0.0;
        if (currentBalance <= 0) {
            signalValue = 1.0;
        } else if (isDepletingEarly) {
            // High risk gradient scaling between 0.6 and 1.0 depending on how rapidly balance exhausts
            const deficitRatio = Math.min(2.0, Math.abs(projectedBalance) / (effectiveTripSpend * tripsUntilRecharge + 1));
            signalValue = Math.min(1.0, 0.60 + (deficitRatio * 0.20));
        } else {
            // Buffer safety margin: safe ratio of projected balance to threshold buffer
            const safetyBuffer = effectiveTripSpend * 3;
            if (projectedBalance < safetyBuffer) {
                signalValue = Math.max(0.15, Math.min(0.55, (safetyBuffer - projectedBalance) / safetyBuffer * 0.55));
            } else {
                signalValue = Math.max(0.0, 0.15 * (1.0 - Math.min(1.0, projectedBalance / (safetyBuffer * 4))));
            }
        }

        return {
            signalValue: Number(signalValue.toFixed(4)),
            emaSpend: Number(effectiveTripSpend.toFixed(2)),
            tripsUntilRecharge,
            tripsUntilDepletion: Number(tripsUntilDepletion.toFixed(2)),
            projectedBalance: Number(projectedBalance.toFixed(2)),
            isDepletingEarly,
            monthlySpendForecast: Number(monthlySpendForecast.toFixed(2)),
            monthlyTripsEstimate
        };
    },

    // ── 2. WEATHER-ADJUSTED CONGESTION-CORRECTED ETA SIGNAL (S_eta) ────────────
    /**
     * Combines meteorological risk factors with time-of-day/day-of-week empirical
     * congestion multipliers derived from trip history and live toll congestion.
     * 
     * @param {Object} params
     * @param {string|Object} [params.weatherSummary] - Weather condition code/object
     * @param {Date} [params.currentTime] - Departure/evaluation time
     * @param {Array<Object>} [params.tripHistory] - Historical trip durations for time-of-day learning
     * @param {Array<Object>} [params.tollsOnRoute] - Toll plazas on route with live congestion state
     * @returns {Object} { signalValue, weatherMultiplier, timeMultiplier, tollMultiplier, compositeEtaMultiplier }
     */
    calculateEtaSignal: (params = {}) => {
        const currentTime = params.currentTime instanceof Date ? params.currentTime : new Date();
        const tripHistory = Array.isArray(params.tripHistory) ? params.tripHistory : [];
        const tollsOnRoute = Array.isArray(params.tollsOnRoute) ? params.tollsOnRoute : [];

        // A. Weather Multiplier (M_weather)
        let weatherMultiplier = 1.0;
        let weatherCode = 'CLEAR';

        if (typeof params.weatherSummary === 'string') {
            weatherCode = params.weatherSummary.toUpperCase();
        } else if (params.weatherSummary && typeof params.weatherSummary.overallRisk === 'string') {
            const risk = params.weatherSummary.overallRisk;
            if (risk === 'HIGH') weatherMultiplier = 1.35;
            else if (risk === 'MEDIUM') weatherMultiplier = 1.15;
            weatherCode = params.weatherSummary.overallConditionName || risk;
        }

        if (weatherCode.includes('RAIN') || weatherCode.includes('SHOWER')) weatherMultiplier = Math.max(weatherMultiplier, 1.20);
        else if (weatherCode.includes('FOG') || weatherCode.includes('SMOG')) weatherMultiplier = Math.max(weatherMultiplier, 1.35);
        else if (weatherCode.includes('STORM') || weatherCode.includes('THUNDER')) weatherMultiplier = Math.max(weatherMultiplier, 1.50);
        else if (weatherCode.includes('HEAT')) weatherMultiplier = Math.max(weatherMultiplier, 1.15);

        // B. Time-of-Day & Day-of-Week Multiplier (M_time) Derived from History
        const hour = currentTime.getHours();
        const dayOfWeek = currentTime.getDay(); // 0 = Sun, 6 = Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        let timeMultiplier = 1.0;

        // Derive empirical congestion multiplier from stored trip history if matching hour intervals exist
        const matchingHistoricalTrips = tripHistory.filter(t => {
            if (!t.startTime) return false;
            const tDate = new Date(t.startTime);
            return Math.abs(tDate.getHours() - hour) <= 1 && ((tDate.getDay() === 0 || tDate.getDay() === 6) === isWeekend);
        });

        if (matchingHistoricalTrips.length >= 3) {
            // Compute average speed / delay factor from historical data
            const avgSpeed = matchingHistoricalTrips.reduce((acc, t) => {
                const dist = t.totalDistance || t.distance || 50;
                const durationHrs = Math.max(0.2, (new Date(t.endTime) - new Date(t.startTime)) / (1000 * 60 * 60));
                return acc + (dist / durationHrs);
            }, 0) / matchingHistoricalTrips.length;

            // Baseline free-flow highway speed ~75 km/h
            if (avgSpeed < 45) timeMultiplier = 1.35;
            else if (avgSpeed < 60) timeMultiplier = 1.20;
            else timeMultiplier = 1.05;
        } else {
            // Deterministic diurnal traffic model based on Indian Highway flow patterns
            if (!isWeekend) {
                if ((hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 21)) {
                    timeMultiplier = 1.30; // Weekday peak rush
                } else if (hour >= 12 && hour <= 16) {
                    timeMultiplier = 1.10; // Midday baseline
                } else {
                    timeMultiplier = 1.00; // Night / early morning free flow
                }
            } else {
                if (hour >= 16 && hour <= 22) {
                    timeMultiplier = 1.25; // Weekend evening leisure peak
                } else if (hour >= 10 && hour <= 15) {
                    timeMultiplier = 1.15;
                } else {
                    timeMultiplier = 1.00;
                }
            }
        }

        // C. Route Toll Congestion Multiplier (M_toll)
        let tollMultiplier = 1.0;
        if (tollsOnRoute.length > 0) {
            const tollStates = (typeof Storage !== 'undefined' && Storage.get)
                ? Storage.get(Storage.KEYS.TOLL_STATES, {})
                : {};

            let highCount = 0;
            let modCount = 0;

            tollsOnRoute.forEach(t => {
                const tId = typeof t === 'object' ? (t.id || t) : t;
                const state = tollStates[tId]?.congestion || 'NORMAL';
                if (state === 'HIGH') highCount++;
                else if (state === 'MODERATE') modCount++;
            });

            const highRatio = highCount / tollsOnRoute.length;
            const modRatio = modCount / tollsOnRoute.length;

            tollMultiplier = 1.0 + (highRatio * 0.45) + (modRatio * 0.20);
        }

        // D. Composite ETA Multiplier
        const compositeEtaMultiplier = weatherMultiplier * timeMultiplier * tollMultiplier;

        // E. Normalized Signal S_eta in [0.0, 1.0]
        const maxEta = AdaptiveLaneEngine.config.maxEtaMultiplier;
        const normalizedSignal = Math.max(0.0, Math.min(1.0, (compositeEtaMultiplier - 1.0) / (maxEta - 1.0)));

        return {
            signalValue: Number(normalizedSignal.toFixed(4)),
            weatherMultiplier: Number(weatherMultiplier.toFixed(2)),
            timeMultiplier: Number(timeMultiplier.toFixed(2)),
            tollMultiplier: Number(tollMultiplier.toFixed(2)),
            compositeEtaMultiplier: Number(compositeEtaMultiplier.toFixed(3))
        };
    },

    // ── 3. INCIDENT-FEEDBACK RELIABILITY & DECAY SIGNAL (S_incident) ───────────
    /**
     * Computes route incident risk by applying exponential time decay to verified incident reports.
     * Accurately discounts or penalizes 'FALSE_ALARM' tagged incidents.
     * 
     * @param {Object} params
     * @param {Array<Object>} [params.incidents] - List of incident/SOS objects
     * @param {Array<string>} [params.routeCorridors] - Highway IDs/plazas on route (e.g. ['NH-48', 'Ghamroj'])
     * @param {Date} [params.evaluationTime] - Current timestamp
     * @returns {Object} { signalValue, confirmedCount, falseAlarmCount, activeCount, rawIncidentScore }
     */
    calculateIncidentSignal: (params = {}) => {
        const incidents = Array.isArray(params.incidents) ? params.incidents : [];
        const routeCorridors = Array.isArray(params.routeCorridors)
            ? params.routeCorridors.map(c => String(c).toLowerCase())
            : [];
        const evalTime = params.evaluationTime instanceof Date ? params.evaluationTime : new Date();

        const halfLifeHours = AdaptiveLaneEngine.config.incidentHalfLifeHours;
        const lambda = Math.LN2 / halfLifeHours; // Decay constant

        let rawScore = 0.0;
        let confirmedCount = 0;
        let falseAlarmCount = 0;
        let activeCount = 0;

        incidents.forEach(inc => {
            if (!inc) return;

            // Spatial matching against route corridors / locations
            if (routeCorridors.length > 0) {
                const locStr = `${inc.location || ''} ${inc.description || ''} ${inc.nhCorridor || ''}`.toLowerCase();
                const matchesRoute = routeCorridors.some(rc => locStr.includes(rc));
                if (!matchesRoute) return;
            }

            // Elapsed time in hours
            const incTime = new Date(inc.timestamp || inc.updatedAt || inc.createdAt || evalTime);
            const elapsedHours = Math.max(0, (evalTime - incTime) / (1000 * 60 * 60));

            // Exponential temporal decay factor
            const decayFactor = Math.exp(-lambda * elapsedHours);

            // Verification & Status Weighting
            let verificationWeight = 0.0;
            const status = (inc.status || '').toUpperCase();
            const verType = (inc.verificationType || inc.resolutionType || '').toUpperCase();

            if (status === 'RESOLVED' || status === 'CLOSED') {
                if (verType === 'CONFIRMED' || !verType) {
                    // Confirmed hazard that occurred recently still carries lingering delay/risk
                    verificationWeight = 1.0;
                    confirmedCount++;
                } else if (verType === 'FALSE_ALARM') {
                    // False alarms are penalized to zero contribution
                    verificationWeight = -0.5;
                    falseAlarmCount++;
                }
            } else if (status === 'RAISED' || status === 'DISPATCHED' || status === 'ACKNOWLEDGED') {
                // Active ongoing emergencies carry heightened weight
                verificationWeight = 1.4;
                activeCount++;
            }

            // Severity multiplier based on incident type
            let severityFactor = 0.8;
            const incType = (inc.type || '').toUpperCase();
            if (incType.includes('CRASH') || incType.includes('ACCIDENT')) severityFactor = 1.2;
            else if (incType.includes('BLOCK') || incType.includes('WATERLOG')) severityFactor = 1.1;
            else if (incType.includes('BREAKDOWN') || incType.includes('TYRE')) severityFactor = 0.7;

            rawScore += (verificationWeight * severityFactor * decayFactor);
        });

        // Ensure non-negative lower bound for final score
        const boundedRawScore = Math.max(0.0, rawScore);
        const normFactor = AdaptiveLaneEngine.config.incidentNormFactor;
        const normalizedSignal = Math.min(1.0, boundedRawScore / normFactor);

        return {
            signalValue: Number(normalizedSignal.toFixed(4)),
            confirmedCount,
            falseAlarmCount,
            activeCount,
            rawIncidentScore: Number(rawScore.toFixed(3))
        };
    },

    // ── 4. MULTI-SIGNAL FUSION ARBITRATION & DECISION ENGINE ──────────────────
    /**
     * Executes the formal tri-signal fusion formula and outputs an auditable decision.
     * 
     * @param {Object} input - Aggregate parameter payload
     * @returns {Object} Complete evaluation result with audit log record
     */
    evaluateRoute: (input = {}) => {
        const evalTime = input.currentTime instanceof Date
            ? input.currentTime
            : (input.evaluationTime instanceof Date ? input.evaluationTime : new Date());

        // 1. Compute Individual Signals
        const balResult = AdaptiveLaneEngine.calculateBalanceSignal(input);
        const etaResult = AdaptiveLaneEngine.calculateEtaSignal({ ...input, currentTime: evalTime });
        const incResult = AdaptiveLaneEngine.calculateIncidentSignal({ ...input, evaluationTime: evalTime });

        const w = AdaptiveLaneEngine.config.weights;
        const th = AdaptiveLaneEngine.config.thresholds;

        // 2. Exact Fusion Formula: F = (w_bal * S_bal) + (w_eta * S_eta) + (w_inc * S_inc)
        const compositeScore = (w.balance * balResult.signalValue) +
                               (w.eta * etaResult.signalValue) +
                               (w.incident * incResult.signalValue);

        const roundedComposite = Number(compositeScore.toFixed(4));

        // 3. Explicit Rule-Based Decision Matrix
        let decision = "No Action";
        let rationale = "Route conditions are optimal and FASTag balance is solvent.";
        let priority = "LOW";

        const tripHistoryLength = (input.tripHistory && Array.isArray(input.tripHistory)) ? input.tripHistory.length : 0;

        // Condition A: High incident hazard & road congestion -> SWITCH ROUTE
        if (
            (incResult.signalValue >= th.switchRouteIncidentDominant && etaResult.signalValue >= th.switchRouteEtaMin) ||
            (roundedComposite >= th.switchRouteComposite && incResult.signalValue >= th.switchRouteIncidentMin)
        ) {
            decision = "Switch Route";
            priority = "URGENT";
            rationale = `Severe verified incident risk (${(incResult.signalValue * 100).toFixed(0)}%) combined with heavy traffic congestion multiplier (${etaResult.compositeEtaMultiplier}x) detected. Dynamic detour recommended to bypass corridor delay.`;
        }
        // Condition B: High-frequency commuter with cost-saving pass threshold -> RECOMMEND MONTHLY PASS
        else if (
            tripHistoryLength >= 4 &&
            balResult.monthlyTripsEstimate >= th.monthlyPassMinMonthlyTrips &&
            balResult.monthlySpendForecast >= th.monthlyPassCostThreshold &&
            balResult.signalValue >= th.monthlyPassBalanceSignalMin
        ) {
            decision = "Recommend Monthly Pass";
            priority = "HIGH";
            rationale = `Traveler exhibits high trip frequency (~${balResult.monthlyTripsEstimate} trips/month, projected spend ₹${balResult.monthlySpendForecast}). An NHAI Monthly Pass (₹${th.monthlyPassCostThreshold}) eliminates balance depletion risk and yields significant cost savings.`;
        }
        // Condition C: Balance depletion hazard or multi-barrier round trip -> RECOMMEND TRIP PASS
        else if (
            balResult.signalValue >= th.tripPassBalanceSignalMin ||
            (balResult.signalValue >= th.tripPassCombinedMin && etaResult.signalValue >= th.tripPassEtaMin)
        ) {
            decision = "Recommend Trip Pass";
            priority = "MEDIUM";
            rationale = `FASTag balance (₹${input.currentBalance || 0}) is forecast to deplete in ${balResult.tripsUntilDepletion} trips prior to next estimated recharge interval (${balResult.tripsUntilRecharge} trips). A prepaid Daily/Return Trip Pass prevents barrier lockout and expedites express passage.`;
        }
        // Condition D: Nominal conditions -> NO ACTION
        else {
            decision = "No Action";
            priority = "LOW";
            rationale = `Healthy FASTag balance buffer (projected +₹${balResult.projectedBalance}) and clear route corridor (${etaResult.compositeEtaMultiplier}x baseline ETA, 0 active hazards). Proceed on primary expressway.`;
        }

        // 4. Construct Structured Audit Log Record
        const auditRecord = {
            auditId: `AUD-${evalTime.getTime()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            timestamp: evalTime.toISOString(),
            inputs: {
                currentBalance: input.currentBalance,
                proposedTripCost: input.proposedTripCost,
                weatherSummary: (input.weatherSummary && typeof input.weatherSummary === 'object') ? input.weatherSummary.overallRisk : input.weatherSummary,
                incidentCount: (input.incidents || []).length
            },
            signals: {
                s_balance: balResult.signalValue,
                s_eta: etaResult.signalValue,
                s_incident: incResult.signalValue
            },
            subMetrics: {
                balance: balResult,
                eta: etaResult,
                incident: incResult
            },
            weights: { ...w },
            compositeScore: roundedComposite,
            decision,
            priority,
            rationale
        };

        // Store into internal circular audit buffer
        AdaptiveLaneEngine.auditLogs.unshift(auditRecord);
        if (AdaptiveLaneEngine.auditLogs.length > AdaptiveLaneEngine.config.maxAuditLogSize) {
            AdaptiveLaneEngine.auditLogs.pop();
        }

        // Persist to Storage if available
        if (typeof Storage !== 'undefined' && Storage.set) {
            try {
                Storage.set('nhai_adaptive_engine_last_decision', auditRecord);
            } catch(e){}
        }

        return auditRecord;
    },

    // ── 5. ONLINE WEIGHT RECALIBRATION ─────────────────────────────────────────
    /**
     * Recalibrates signal weights at runtime with normalization check.
     * 
     * @param {Object} newWeights - { balance, eta, incident }
     * @returns {boolean} True if recalibration was successful
     */
    recalibrateWeights: (newWeights = {}) => {
        if (typeof newWeights !== 'object' || newWeights === null) return false;

        const b = typeof newWeights.balance === 'number' ? newWeights.balance : AdaptiveLaneEngine.config.weights.balance;
        const e = typeof newWeights.eta === 'number' ? newWeights.eta : AdaptiveLaneEngine.config.weights.eta;
        const i = typeof newWeights.incident === 'number' ? newWeights.incident : AdaptiveLaneEngine.config.weights.incident;

        if (b < 0 || e < 0 || i < 0) {
            throw new Error("Weights must be non-negative.");
        }

        const sum = b + e + i;
        if (Math.abs(sum - 1.0) > 0.001) {
            // Auto-normalize
            AdaptiveLaneEngine.config.weights.balance = Number((b / sum).toFixed(4));
            AdaptiveLaneEngine.config.weights.eta = Number((e / sum).toFixed(4));
            AdaptiveLaneEngine.config.weights.incident = Number((i / sum).toFixed(4));
        } else {
            AdaptiveLaneEngine.config.weights.balance = b;
            AdaptiveLaneEngine.config.weights.eta = e;
            AdaptiveLaneEngine.config.weights.incident = i;
        }

        return true;
    },

    /**
     * Retrieves recent audit logs for regulatory/operational inspection.
     * @param {number} [limit=50]
     * @returns {Array<Object>}
     */
    getAuditLogs: (limit = 50) => {
        return AdaptiveLaneEngine.auditLogs.slice(0, limit);
    }
};

// Module export for Node.js test suites & Browser global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdaptiveLaneEngine;
}
if (typeof window !== 'undefined') {
    window.AdaptiveLaneEngine = AdaptiveLaneEngine;
}
