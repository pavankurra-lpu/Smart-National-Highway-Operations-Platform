// Dynamic Full-Featured Lane Allocation Engine

const LaneAdvisor = {
    selectedLane: null,
    selectedPlazaId: null,

    getLanesForPlaza: (plazaId, vehicleType = 'LMV', isSpecialVerified = false) => {
        const tollStates = Storage.get(Storage.KEYS.TOLL_STATES, {});
        const tollState = tollStates[plazaId] || { congestion: 'NORMAL', lanes: { total: 6, open: 6 } };
        const cong = tollState.congestion || 'NORMAL';
        const totalLanes = tollState.lanes?.total || 6;
        const openLanes = tollState.lanes?.open || totalLanes;

        const isExempt = isSpecialVerified || ['GOVT','PRESS','ARMY','AMBULANCE','FIRE','POLICE','BIKE'].includes(vehicleType);

        // Base 8 NHAI Toll Lane Specifications
        const allLanes = [
            {
                laneNum: 'Lane 1',
                type: 'Priority VIP / Emergency Corridor',
                icon: 'fa-shield-halved',
                description: 'Pre-registered exempt, ambulances, emergency & VIP fast-track',
                allowed: ['GOVT','PRESS','ARMY','AMBULANCE','FIRE','POLICE','BIKE','SPECIAL'],
                baseWait: 0,
                status: 'OPEN',
                isPriority: true,
                recommended: isExempt
            },
            {
                laneNum: 'Lane 2',
                type: '100% Dedicated FASTag (LMV / Cars)',
                icon: 'fa-bolt',
                description: 'High-speed automatic RFID beam detection for private light vehicles',
                allowed: ['LMV', 'LCV'],
                baseWait: cong === 'HIGH' ? 8 : (cong === 'MODERATE' ? 3 : 1),
                status: openLanes >= 2 ? 'OPEN' : 'CLOSED',
                recommended: !isExempt && vehicleType === 'LMV' && openLanes >= 2
            },
            {
                laneNum: 'Lane 3',
                type: 'FASTag Express Flow (LMV & Mini-Buses)',
                icon: 'fa-car',
                description: 'Express clearance for cars, taxis, and light commercial vehicles',
                allowed: ['LMV', 'LCV'],
                baseWait: cong === 'HIGH' ? 10 : (cong === 'MODERATE' ? 4 : 2),
                status: openLanes >= 3 ? 'OPEN' : 'CLOSED',
                recommended: !isExempt && vehicleType === 'LCV' && openLanes >= 3
            },
            {
                laneNum: 'Lane 4',
                type: 'Commercial FASTag (Buses & 2-Axle Freight)',
                icon: 'fa-bus',
                description: 'Designated clearance lane for passenger buses and commercial trucks',
                allowed: ['BUS_2AXLE', 'COM_3AXLE'],
                baseWait: cong === 'HIGH' ? 14 : (cong === 'MODERATE' ? 6 : 3),
                status: openLanes >= 4 ? 'OPEN' : 'CLOSED',
                recommended: !isExempt && ['BUS_2AXLE', 'COM_3AXLE'].includes(vehicleType) && openLanes >= 4
            },
            {
                laneNum: 'Lane 5',
                type: 'Heavy Freight / MAV Multi-Axle (4-6 Axles)',
                icon: 'fa-truck-moving',
                description: 'Heavy multi-axle freight, container trailers and oversized loads',
                allowed: ['MAV_4_6', 'OVERSIZED', 'COM_3AXLE'],
                baseWait: cong === 'HIGH' ? 18 : (cong === 'MODERATE' ? 9 : 4),
                status: openLanes >= 5 ? 'OPEN' : 'CLOSED',
                recommended: !isExempt && ['MAV_4_6', 'OVERSIZED'].includes(vehicleType) && openLanes >= 5
            },
            {
                laneNum: 'Lane 6',
                type: 'Hybrid Lane (FASTag Blacklist & Cash Penalty)',
                icon: 'fa-money-bill-wave',
                description: 'Manual verification, low-balance tag resolution, non-FASTag 2x cash',
                allowed: ['LMV', 'LCV', 'BUS_2AXLE', 'COM_3AXLE', 'MAV_4_6', 'OVERSIZED'],
                baseWait: cong === 'HIGH' ? 22 : (cong === 'MODERATE' ? 12 : 6),
                status: openLanes >= 6 ? 'OPEN' : 'CLOSED',
                recommended: false
            },
            {
                laneNum: 'Lane 7',
                type: 'Dynamic Peak Overflow Clearance Lane',
                icon: 'fa-traffic-light',
                description: 'Activated during peak hour surges for express light traffic relief',
                allowed: ['LMV', 'LCV'],
                baseWait: cong === 'HIGH' ? 6 : (cong === 'MODERATE' ? 3 : 1),
                status: openLanes >= 7 ? 'OPEN' : 'CLOSED',
                recommended: !isExempt && vehicleType === 'LMV' && openLanes >= 7 && cong === 'HIGH'
            },
            {
                laneNum: 'Lane 8',
                type: 'Emergency Green Channel / Heavy Clearance',
                icon: 'fa-truck-fast',
                description: 'Multi-axle bypass & emergency backup channel managed by NHAI marshals',
                allowed: ['MAV_4_6', 'OVERSIZED', 'SPECIAL'],
                baseWait: cong === 'HIGH' ? 8 : (cong === 'MODERATE' ? 4 : 2),
                status: openLanes >= 8 ? 'OPEN' : 'CLOSED',
                recommended: false
            }
        ];

        return allLanes.slice(0, Math.max(6, totalLanes));
    },

    renderAdvisor: (routeData, isSpecialVerified) => {
        if (!routeData || !routeData.tolls || routeData.tolls.length === 0) {
            return `<div style="text-align:center; padding: 24px; color:var(--text-sec);">
                <i class="fa-solid fa-road" style="font-size:32px; color:var(--primary); opacity:0.6; margin-bottom:8px; display:block;"></i>
                <strong>Direct Highway Corridor</strong><br>No toll gates detected along this section. Maintain standard cruising speed.
            </div>`;
        }

        const vType = document.getElementById('route-vehicle-selector')?.value || document.getElementById('vehicle-type')?.value || 'LMV';
        
        // Use selected plaza ID or default to the first upcoming toll
        let targetToll = routeData.tolls[0];
        if (LaneAdvisor.selectedPlazaId) {
            const match = routeData.tolls.find(t => (t.id || t) === LaneAdvisor.selectedPlazaId);
            if (match) targetToll = match;
        }

        const plazaId = typeof targetToll === 'object' ? targetToll.id : targetToll;
        LaneAdvisor.selectedPlazaId = plazaId;

        const td = window.TollSeedData?.find(s => s.id === plazaId) || (typeof targetToll === 'object' ? targetToll : {});
        const plazaName = td.name || td.tollName || targetToll.name || 'National Highway Toll Plaza';
        const nhCorridor = (td.nhCorridor && td.nhCorridor !== 'N/A') ? `NH-${td.nhCorridor}` : 'National Highway';
        const stateName = td.state || 'India';

        const tollStates = Storage.get(Storage.KEYS.TOLL_STATES, {});
        const tollState = tollStates[plazaId] || { congestion: 'NORMAL', lanes: { total: 6, open: 6 } };
        const cong = tollState.congestion || 'NORMAL';
        const openLanes = tollState.lanes?.open || 6;
        const totalLanes = tollState.lanes?.total || 6;

        const congColors = { NORMAL: '#10b981', MODERATE: '#fbbf24', HIGH: '#f43f5e' };
        const congLabels = { NORMAL: '🟢 Normal Flow', MODERATE: '🟡 Moderate Flow (+5m)', HIGH: '🔴 High Congestion (+15m)' };

        // Render Toll Plaza Selector Dropdown if multiple tolls exist
        let plazaSelectHtml = '';
        if (routeData.tolls.length > 1) {
            plazaSelectHtml = `
                <div style="margin-bottom: 12px; display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:8px; border:1px solid var(--border-light);">
                    <label style="font-size:10px; font-weight:700; color:var(--text-sec); text-transform:uppercase; white-space:nowrap;">
                        <i class="fa-solid fa-layer-group" style="color:var(--primary);"></i> Select Plaza:
                    </label>
                    <select onchange="LaneAdvisor.onPlazaChanged(this.value)" style="flex:1; font-size:11px; font-weight:600; background:rgba(15,23,42,0.9); color:#fff; border:1px solid rgba(255,255,255,0.15); padding:5px 8px; border-radius:6px; outline:none; cursor:pointer;">
                        ${routeData.tolls.map((t, idx) => {
                            const tId = t.id || t;
                            const tName = t.name || window.TollSeedData?.find(s => s.id === tId)?.name || `Toll Plaza ${idx + 1}`;
                            return `<option value="${tId}" ${tId === plazaId ? 'selected' : ''}>${idx + 1}. ${tName}</option>`;
                        }).join('')}
                    </select>
                </div>
            `;
        }

        const lanes = LaneAdvisor.getLanesForPlaza(plazaId, vType, isSpecialVerified);

        let lanesHtml = '';
        lanes.forEach(l => {
            const isRec = l.recommended;
            const isClosed = l.status === 'CLOSED';
            const isSelected = LaneAdvisor.selectedLane === l.laneNum;

            let borderCol = isSelected ? '#38bdf8' : (isRec ? 'var(--primary)' : 'var(--border-light)');
            let bgCol = isSelected ? 'rgba(56,189,248,0.16)' : (isRec ? 'rgba(0,229,179,0.1)' : 'rgba(0,0,0,0.25)');
            
            let statusBadge = isClosed 
                ? `<span style="font-size:9px; padding:2px 6px; border-radius:4px; background:rgba(239,68,68,0.2); color:#f43f5e; font-weight:700; border:1px solid rgba(239,68,68,0.4);">🔴 CLOSED</span>`
                : `<span style="font-size:9px; padding:2px 6px; border-radius:4px; background:rgba(16,185,129,0.2); color:#10b981; font-weight:700; border:1px solid rgba(16,185,129,0.4);">🟢 OPEN</span>`;

            lanesHtml += `
                <div class="lane-card ${isRec ? 'recommended' : ''}" style="
                    border: 1px solid ${borderCol};
                    background: ${bgCol};
                    border-radius: 10px;
                    padding: 10px 12px;
                    margin-bottom: 8px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 10px;
                    transition: all 0.2s ease;
                    opacity: ${isClosed ? '0.6' : '1.0'};
                ">
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                            <i class="fa-solid ${l.icon}" style="color:${isRec ? 'var(--primary)' : '#94a3b8'}; font-size:12px;"></i>
                            <strong style="color:#fff; font-size:12.5px;">${l.laneNum}</strong>
                            ${isRec ? `<span style="font-size:8px; font-weight:800; background:var(--primary); color:#000; padding:1px 5px; border-radius:3px; letter-spacing:0.4px;">⭐ RECOMMENDED</span>` : ''}
                            ${isSelected ? `<span style="font-size:8px; font-weight:800; background:#38bdf8; color:#000; padding:1px 5px; border-radius:3px;">SELECTED</span>` : ''}
                        </div>
                        <div style="font-size:11px; font-weight:600; color:var(--text-main); margin-bottom:2px;">${l.type}</div>
                        <div style="font-size:9.5px; color:var(--text-muted); line-height:1.3;">${l.description}</div>
                    </div>

                    <div style="text-align:right; flex-shrink:0; display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                        <div>${statusBadge}</div>
                        <div style="font-size:10.5px; color:#fff; font-weight:600;">
                            <i class="fa-solid fa-stopwatch" style="color:var(--accent-yellow); font-size:10px;"></i> ${isClosed ? '—' : (l.baseWait === 0 ? '< 1 min' : `~${l.baseWait} min`)}
                        </div>
                        ${!isClosed ? `
                        <button type="button" onclick="LaneAdvisor.selectLane('${l.laneNum}', '${plazaName}')" style="
                            font-size: 9.5px;
                            font-weight: 700;
                            padding: 3px 8px;
                            border-radius: 4px;
                            border: 1px solid ${isSelected ? '#38bdf8' : 'rgba(255,255,255,0.15)'};
                            background: ${isSelected ? '#38bdf8' : 'rgba(255,255,255,0.06)'};
                            color: ${isSelected ? '#000' : '#fff'};
                            cursor: pointer;
                            transition: all 0.2s;
                        ">${isSelected ? '✓ Assigned' : 'Choose'}</button>` : ''}
                    </div>
                </div>
            `;
        });

        return `
            ${plazaSelectHtml}

            <!-- Plaza Header Banner -->
            <div style="background:linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.95)); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:10px 12px; margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <div style="font-size:13px; font-weight:800; color:#fff;">📍 ${plazaName}</div>
                        <div style="font-size:10px; color:#94a3b8; margin-top:2px;">${stateName} · <strong>${nhCorridor}</strong></div>
                    </div>
                    <div style="font-size:10px; font-weight:700; color:${congColors[cong]}; background:${congColors[cong]}20; padding:3px 8px; border-radius:6px; border:1px solid ${congColors[cong]}40;">
                        ${congLabels[cong]}
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.08); font-size:10px; color:#cbd5e1;">
                    <span><i class="fa-solid fa-bars-staggered" style="color:var(--primary);"></i> Active Toll Lanes: <strong style="color:#fff;">${openLanes} / ${totalLanes} Open</strong></span>
                    <span><i class="fa-solid fa-car-side" style="color:#38bdf8;"></i> Vehicle: <strong style="color:#fff;">${vType}</strong></span>
                </div>
            </div>

            <!-- Adaptive Multi-Signal Recommendation Engine Banner -->
            ${(() => {
                if (!window.AdaptiveLaneEngine) return '';
                const currentBal = (typeof FastagEngine !== 'undefined' && typeof FastagEngine.getBalance === 'function') 
                    ? FastagEngine.getBalance() 
                    : ((typeof Storage !== 'undefined' && Storage.get) ? (Storage.get(Storage.KEYS.FASTAG_BALANCE, 0) || 0) : 0);
                const tripHist = (typeof Storage !== 'undefined' && Storage.get) ? Storage.get(Storage.KEYS.TRIP_HISTORY, []) : [];
                const rechHist = (typeof Storage !== 'undefined' && Storage.get) ? Storage.get(Storage.KEYS.RECHARGE_HISTORY, []) : [];
                const emgList = (typeof Storage !== 'undefined' && Storage.get) ? Storage.get(Storage.KEYS.EMERGENCIES, []) : [];
                const weatherSum = (window.WeatherEngine && routeData.nodes) ? WeatherEngine.generateRouteSummary(routeData.nodes) : 'CLEAR';

                const evalRes = AdaptiveLaneEngine.evaluateRoute({
                    currentBalance: currentBal,
                    tripHistory: tripHist,
                    rechargeHistory: rechHist,
                    proposedTripCost: routeData.totalCost || routeData.totalTollCost || 120,
                    weatherSummary: weatherSum,
                    incidents: emgList,
                    routeCorridors: [td.name, td.nhCorridor, routeData.originName, routeData.destName].filter(Boolean),
                    tollsOnRoute: routeData.tolls || []
                });

                const decColors = {
                    'Switch Route': { border: '#f43f5e', bg: 'rgba(244,63,94,0.12)', text: '#f43f5e', icon: 'fa-diamond-turn-right' },
                    'Recommend Monthly Pass': { border: '#a855f7', bg: 'rgba(168,85,247,0.12)', text: '#c084fc', icon: 'fa-calendar-check' },
                    'Recommend Trip Pass': { border: '#fbbf24', bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', icon: 'fa-ticket' },
                    'No Action': { border: '#10b981', bg: 'rgba(16,185,129,0.12)', text: '#34d399', icon: 'fa-shield-halved' }
                };
                const theme = decColors[evalRes.decision] || decColors['No Action'];

                return `
                    <div style="background: ${theme.bg}; border: 1px solid ${theme.border}; border-radius: 10px; padding: 10px 12px; margin-bottom: 12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
                            <div style="font-size:11px; font-weight:800; color:${theme.text}; display:flex; align-items:center; gap:6px;">
                                <i class="fa-solid ${theme.icon}"></i> ${evalRes.decision}
                            </div>
                            <div style="font-size:9.5px; font-weight:700; color:#94a3b8;">
                                Fusion Score: <strong style="color:#fff;">${evalRes.compositeScore}</strong>
                            </div>
                        </div>
                        <div style="font-size:9.5px; color:#cbd5e1; line-height:1.35; margin-bottom:8px;">
                            ${evalRes.rationale}
                        </div>
                        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:6px; background:rgba(0,0,0,0.3); padding:6px; border-radius:6px; font-size:9px; text-align:center;">
                            <div>
                                <span style="color:#94a3b8; display:block;">FASTag Risk</span>
                                <strong style="color:${evalRes.signals.s_balance > 0.5 ? '#f43f5e' : '#34d399'};">${(evalRes.signals.s_balance * 100).toFixed(0)}%</strong>
                            </div>
                            <div style="border-left: 1px solid rgba(255,255,255,0.08);">
                                <span style="color:#94a3b8; display:block;">ETA Delay</span>
                                <strong style="color:${evalRes.signals.s_eta > 0.5 ? '#fbbf24' : '#34d399'};">${(evalRes.signals.s_eta * 100).toFixed(0)}%</strong>
                            </div>
                            <div style="border-left: 1px solid rgba(255,255,255,0.08);">
                                <span style="color:#94a3b8; display:block;">Hazard Decay</span>
                                <strong style="color:${evalRes.signals.s_incident > 0.4 ? '#f43f5e' : '#34d399'};">${(evalRes.signals.s_incident * 100).toFixed(0)}%</strong>
                            </div>
                        </div>
                    </div>
                `;
            })()}

            <!-- Lanes List -->
            <div style="display:flex; flex-direction:column;">
                ${lanesHtml}
            </div>
        `;
    },

    onPlazaChanged: (newPlazaId) => {
        LaneAdvisor.selectedPlazaId = newPlazaId;
        const content = document.getElementById('lane-advisor-content');
        if (content && window.IndiaMapPlanner?.selectedRouteData) {
            content.innerHTML = LaneAdvisor.renderAdvisor(IndiaMapPlanner.selectedRouteData, IndiaMapPlanner.isSpecialVerified);
        }
    },

    selectLane: (laneNum, plazaName) => {
        LaneAdvisor.selectedLane = laneNum;
        Utils.showToast(`✅ ${laneNum} Assigned for ${plazaName}! Maintain approach speed.`, 'success');
        
        if (window.VoiceAssistant) {
            VoiceAssistant.speak(`Lane guidance updated. Proceed to ${laneNum} on approach to ${plazaName}.`);
        }

        const content = document.getElementById('lane-advisor-content');
        if (content && window.IndiaMapPlanner?.selectedRouteData) {
            content.innerHTML = LaneAdvisor.renderAdvisor(IndiaMapPlanner.selectedRouteData, IndiaMapPlanner.isSpecialVerified);
        }
    }
};

window.LaneAdvisor = LaneAdvisor;
