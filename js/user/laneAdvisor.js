// Dynamic Lane Allocation Advisor

const LaneAdvisor = {
    generateLanesForPlaza: (plazaId, vehicleType, isSpecialVerified) => {
        // Read congestion levels set by admin
        const tollStates = Storage.get(Storage.KEYS.TOLL_STATES, {});
        const state = tollStates[plazaId] || { congestion: 'NORMAL' };

        let lanes = [];

        // Special logic for PRE-REGISTERED Exempt
        if (isSpecialVerified) {
            lanes.push({
                laneNum: 'Lane 1',
                type: 'Priority / Exempt',
                status: 'FREE',
                wait: '0 min',
                recommended: true
            });
            lanes.push({
                laneNum: 'Lane 2',
                type: 'FASTag Private',
                status: state.congestion,
                wait: state.congestion === 'HIGH' ? '12 min' : '3 min',
                recommended: false
            });
            return lanes;
        }

        // Standard Logic
        if (['LMV', 'LCV'].includes(vehicleType)) {
            lanes.push({
                laneNum: 'Lane 3',
                type: 'FASTag LMV',
                status: state.congestion === 'HIGH' ? 'HEAVY' : 'NORMAL',
                wait: state.congestion === 'HIGH' ? '15 min' : '4 min',
                recommended: state.congestion !== 'HIGH'
            });
            lanes.push({
                laneNum: 'Lane 4',
                type: 'FASTag LMV / Cash',
                status: 'NORMAL',
                wait: '8 min',
                recommended: state.congestion === 'HIGH'
            });
        } else {
            // Heavy Vehicles
            lanes.push({
                laneNum: 'Lane 7',
                type: 'Commercial FASTag',
                status: state.congestion,
                wait: state.congestion === 'HIGH' ? '25 min' : '10 min',
                recommended: true
            });
            lanes.push({
                laneNum: 'Lane 8',
                type: 'Oversized / Manual',
                status: 'SLOW',
                wait: '20 min',
                recommended: false
            });
        }

        return lanes;
    },

    renderAdvisor: (routeData, isSpecialVerified) => {
        if (!routeData || routeData.tolls.length === 0) {
            return `<div style="text-align:center; padding: 20px; color:var(--text-sec);">No tolls ahead. Maintain highway speed.</div>`;
        }

        // Show info for the *first* toll plaza on the route
        const nextPlazaId = routeData.tolls[0];
        const plaza = TollData.getTollById(nextPlazaId);
        const plazaName = plaza?.name || plaza?.tollName || plaza?.plazaName || 'Unknown Toll';

        let html = `<h4 style="margin-bottom:10px; color:#fff;">Upcoming: ${plazaName}</h4>`;
        
        const lanes = LaneAdvisor.generateLanesForPlaza(nextPlazaId, routeData.vehicleType, isSpecialVerified);

        lanes.forEach(l => {
            const rClass = l.recommended ? 'recommended' : '';
            const statusColor = l.status === 'HEAVY' || l.status === 'HIGH' ? 'var(--accent-red)' : 
                               (l.status === 'FREE' ? 'var(--primary)' : 'var(--text-sec)');
                               
            html += `
                <div class="lane-card ${rClass}">
                    <div>
                        <strong style="color:var(--text-main); font-size:13px;">${l.laneNum}</strong>
                        <div style="font-size:10px; color:var(--text-sec);">${l.type}</div>
                        ${l.recommended ? '<span style="font-size:9px; background:var(--primary); color:#000; padding:2px 4px; border-radius:2px; margin-top:4px; display:inline-block;">SUGGESTED</span>' : ''}
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:10px; color:${statusColor}; font-weight:bold;">${l.status}</div>
                        <div style="font-size:11px; color:#fff;"><i class="fa-solid fa-hourglass-half"></i> ${l.wait}</div>
                    </div>
                </div>
            `;
        });

        return html;
    }
};

window.LaneAdvisor = LaneAdvisor;
