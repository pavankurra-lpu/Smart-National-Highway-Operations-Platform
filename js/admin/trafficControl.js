// Enhanced Traffic and Congestion Admin Control with GPS Local Filtering

const TrafficControl = {
    currentPage: 0,
    pageSize: 25,
    filteredData: [],
    useGpsFilter: false,
    gpsCoords: null,

    init: () => {
        TrafficControl.populateStateFilter();
        TrafficControl.applyFilters();
        
        window.setCongestion = TrafficControl.setCongestion;

        const searchInput = document.getElementById('traffic-search');
        const stateFilter = document.getElementById('traffic-state-filter');
        const congFilter = document.getElementById('traffic-congestion-filter');
        
        if (searchInput) searchInput.addEventListener('input', () => { TrafficControl.currentPage = 0; TrafficControl.applyFilters(); });
        if (stateFilter) stateFilter.addEventListener('change', () => { TrafficControl.currentPage = 0; TrafficControl.applyFilters(); });
        if (congFilter) congFilter.addEventListener('change', () => { TrafficControl.currentPage = 0; TrafficControl.applyFilters(); });

        if (sessionStorage.getItem('admin_plaza') && sessionStorage.getItem('admin_plaza') !== 'ALL') {
            const plazaName = sessionStorage.getItem('admin_plaza');
            if (searchInput && !searchInput.value) {
                searchInput.value = plazaName;
            }
        }
        TrafficControl.applyFilters();

        const prevBtn = document.getElementById('tc-prev');
        const nextBtn = document.getElementById('tc-next');
        if (prevBtn) prevBtn.addEventListener('click', () => { if (TrafficControl.currentPage > 0) { TrafficControl.currentPage--; TrafficControl.renderGrid(); } });
        if (nextBtn) nextBtn.addEventListener('click', () => {
            const maxPage = Math.floor((TrafficControl.filteredData.length - 1) / TrafficControl.pageSize);
            if (TrafficControl.currentPage < maxPage) { TrafficControl.currentPage++; TrafficControl.renderGrid(); }
        });

        // GPS Geolocation Filter Button
        const gpsBtn = document.getElementById('btn-gps-filter');
        if (gpsBtn) {
            gpsBtn.addEventListener('click', () => {
                TrafficControl.useGpsFilter = !TrafficControl.useGpsFilter;
                
                if (TrafficControl.useGpsFilter) {
                    gpsBtn.style.background = 'var(--primary)';
                    gpsBtn.style.color = '#021a12';
                    gpsBtn.style.borderColor = 'var(--primary)';
                    
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                            (pos) => {
                                const lat = pos.coords.latitude;
                                const lng = pos.coords.longitude;
                                
                                // Bounding box verify (India limits)
                                const inIndia = lat >= 6.5 && lat <= 37.6 && lng >= 68.0 && lng <= 97.5;
                                if (inIndia) {
                                    TrafficControl.gpsCoords = { lat, lng };
                                    Utils.showToast('GPS active: Showing local toll plazas.', 'success');
                                } else {
                                    // Fallback mock center: Jaipur/Delhi area toll plazas
                                    TrafficControl.gpsCoords = { lat: 26.9124, lng: 75.7873 };
                                    Utils.showToast('GPS outside India. Simulating local location in Jaipur.', 'info');
                                }
                                TrafficControl.currentPage = 0;
                                TrafficControl.applyFilters();
                            },
                            (err) => {
                                TrafficControl.gpsCoords = { lat: 26.9124, lng: 75.7873 };
                                Utils.showToast('GPS access blocked. Simulating location in Jaipur.', 'info');
                                TrafficControl.currentPage = 0;
                                TrafficControl.applyFilters();
                            }
                        );
                    } else {
                        TrafficControl.gpsCoords = { lat: 26.9124, lng: 75.7873 };
                        Utils.showToast('GPS unsupported. Simulating location in Jaipur.', 'info');
                        TrafficControl.currentPage = 0;
                        TrafficControl.applyFilters();
                    }
                } else {
                    gpsBtn.style.background = 'rgba(255, 255, 255, 0.05)';
                    gpsBtn.style.color = '#fff';
                    gpsBtn.style.borderColor = 'var(--border)';
                    TrafficControl.gpsCoords = null;
                    TrafficControl.currentPage = 0;
                    TrafficControl.applyFilters();
                }
            });
        }

        // Refresh stats periodically
        setInterval(() => TrafficControl.updateStats(), 5000);
    },

    calcDistance: (lat1, lon1, lat2, lon2) => {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    },

    populateStateFilter: () => {
        const sel = document.getElementById('traffic-state-filter');
        if (!sel) return;
        const sourceData = window.TollSeedData || [];
        const states = new Set();
        sourceData.forEach(p => { if (p.state) states.add(p.state); });
        Array.from(states).sort().forEach(st => {
            const opt = document.createElement('option');
            opt.value = st;
            opt.innerText = st;
            sel.appendChild(opt);
        });
    },

    applyFilters: () => {
        const sourceData = window.TollSeedData || [];
        const search = (document.getElementById('traffic-search')?.value || '').toLowerCase();
        const stateF = document.getElementById('traffic-state-filter')?.value || '';
        const congF = document.getElementById('traffic-congestion-filter')?.value || '';
        const currentStates = Storage.get(Storage.KEYS.TOLL_STATES, {});

        const assignedPlaza = sessionStorage.getItem('admin_plaza');
        if (assignedPlaza && assignedPlaza !== 'ALL') {
            const cleanAssigned = assignedPlaza.toLowerCase();
            TrafficControl.filteredData = sourceData.filter(plaza => {
                const pName = (plaza.name || '').toLowerCase();
                const pId = (plaza.id || '').toLowerCase();
                return pId === cleanAssigned || pName.includes(cleanAssigned);
            });
            TrafficControl.updateStats();
            TrafficControl.renderGrid();
            return;
        }

        TrafficControl.filteredData = sourceData.filter(plaza => {
            if (search) {
                const searchStr = `${plaza.name} ${plaza.state} ${plaza.id}`.toLowerCase();
                if (!searchStr.includes(search)) return false;
            }
            if (stateF && plaza.state !== stateF) return false;
            if (congF) {
                const cong = currentStates[plaza.id]?.congestion || 'NORMAL';
                if (cong !== congF) return false;
            }
            
            // GPS local distance restriction filter
            if (TrafficControl.useGpsFilter && TrafficControl.gpsCoords) {
                const plazaLat = plaza.lat || 0;
                const plazaLng = plaza.lng || 0;
                if (plazaLat !== 0 && plazaLng !== 0) {
                    const dist = TrafficControl.calcDistance(
                        TrafficControl.gpsCoords.lat, 
                        TrafficControl.gpsCoords.lng, 
                        plazaLat, 
                        plazaLng
                    );
                    if (dist > 150) return false;
                } else if (TrafficControl.gpsCoords.lat !== 26.9124) {
                    return false;
                }
            }
            
            return true;
        });

        TrafficControl.updateStats();
        TrafficControl.renderGrid();
    },

    updateStats: () => {
        const sourceData = window.TollSeedData || [];
        const currentStates = Storage.get(Storage.KEYS.TOLL_STATES, {});
        
        let normal = 0, moderate = 0, high = 0;
        sourceData.forEach(p => {
            const c = currentStates[p.id]?.congestion || 'NORMAL';
            if (c === 'HIGH') high++;
            else if (c === 'MODERATE') moderate++;
            else normal++;
        });

        const el = (id, val) => { const e = document.getElementById(id); if (e) e.innerText = val; };
        el('tc-stat-total', sourceData.length);
        el('tc-stat-normal', normal);
        el('tc-stat-moderate', moderate);
        el('tc-stat-high', high);
    },

    renderGrid: () => {
        const grid = document.getElementById('toll-control-grid');
        if (!grid) return;

        const currentStates = Storage.get(Storage.KEYS.TOLL_STATES, {});
        const data = TrafficControl.filteredData;
        const start = TrafficControl.currentPage * TrafficControl.pageSize;
        const end = Math.min(start + TrafficControl.pageSize, data.length);
        const page = data.slice(start, end);

        // Update page info
        const pageInfo = document.getElementById('tc-page-info');
        if (pageInfo) pageInfo.innerText = data.length > 0 ? `Showing ${start + 1}–${end} of ${data.length}` : 'No results';

        if (page.length === 0) {
            grid.innerHTML = '<div style="color:var(--text-sec); font-size:12px; padding:40px; text-align:center;"><i class="fa-solid fa-circle-exclamation" style="font-size: 24px; color: var(--border); display:block; margin-bottom:10px;"></i>No Toll Plazas Match Criteria</div>';
            return;
        }

        let html = '';
        page.forEach(plaza => {
            const tId = plaza.id;
            const stateA = currentStates[tId]?.congestionA || currentStates[tId]?.congestion || 'NORMAL';
            const stateB = currentStates[tId]?.congestionB || (stateA === 'HIGH' ? 'MODERATE' : 'NORMAL');
            const lanesA = currentStates[tId]?.lanesA || { total: 3, open: 3 };
            const lanesB = currentStates[tId]?.lanesB || { total: 3, open: 3 };
            const totalLanes = lanesA.total + lanesB.total;
            const openLanes = lanesA.open + lanesB.open;
            
            const seed = plaza.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
            const r = (seed % 97) / 97;

            const vCountA = stateA === 'HIGH' ? Math.floor(45 + r * 60) : (stateA === 'MODERATE' ? Math.floor(18 + r * 25) : Math.floor(4 + r * 10));
            const vCountB = stateB === 'HIGH' ? Math.floor(40 + r * 55) : (stateB === 'MODERATE' ? Math.floor(15 + r * 20) : Math.floor(3 + r * 8));
            const waitA = stateA === 'HIGH' ? Math.floor(8 + r * 10) : (stateA === 'MODERATE' ? Math.floor(3 + r * 4) : 1);
            const waitB = stateB === 'HIGH' ? Math.floor(7 + r * 8) : (stateB === 'MODERATE' ? Math.floor(3 + r * 3) : 1);
            
            let base = plaza.baseRate || 85;
            const totalVehicles = vCountA + vCountB;
            const revenue = Math.floor(totalVehicles * base * 1.8);
            
            const congColors = { NORMAL: '#10b981', MODERATE: '#fcd34d', HIGH: '#ff5e5e' };
            const colorA = congColors[stateA];
            const colorB = congColors[stateB];
            const maxState = (stateA === 'HIGH' || stateB === 'HIGH') ? 'HIGH' : ((stateA === 'MODERATE' || stateB === 'MODERATE') ? 'MODERATE' : 'NORMAL');
            const overallColor = congColors[maxState];

            // Render modern bidirectional spotlight toll card
            html += `
                <div class="tc-card spotlight-card" style="
                    border-left: 4px solid ${overallColor};
                    background: rgba(18, 18, 23, 0.9);
                    border-radius: 14px;
                    padding: 16px;
                    margin-bottom: 16px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
                ">
                    <!-- Station Header -->
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 14px;">
                        <div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <h4 style="margin: 0; font-size: 15px; font-weight: 800; color: #fff; line-height: 1.2;">⛩️ ${plaza.name}</h4>
                                <span style="font-size: 9.5px; font-weight: 700; color: #38bdf8; background: rgba(56,189,248,0.12); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(56,189,248,0.25);">
                                    ${plaza.nhCorridor && plaza.nhCorridor !== 'N/A' ? 'NH-' + plaza.nhCorridor : 'National Highway'}
                                </span>
                            </div>
                            <div style="font-size: 11px; color: #a1a1aa; margin-top: 3px;">
                                ${tId} · <span style="text-transform: uppercase;">${plaza.state}</span> · Master Plaza Station
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: ${overallColor}; background: ${overallColor}15; padding: 3px 8px; border-radius: 6px; border: 1px solid ${overallColor}30; display: inline-flex; align-items: center; gap: 4px;">
                                <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${overallColor};"></span>
                                ${maxState} LOAD
                            </div>
                            <div style="font-size: 10px; color: #38bdf8; font-weight: 700; margin-top: 4px;">
                                Total Rev: ₹${revenue.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <!-- Bidirectional Carriageways Grid (Inbound vs Outbound) -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px;">
                        
                        <!-- Direction A: Inbound / Entry Side -->
                        <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                                <span style="font-size: 11px; font-weight: 700; color: #38bdf8; display:flex; align-items:center; gap:5px;">
                                    <i class="fa-solid fa-arrow-trend-up"></i> Inbound (Entry Side)
                                </span>
                                <span style="font-size: 9px; font-weight: 700; color: ${colorA};">${stateA}</span>
                            </div>
                            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 4px; text-align: center; margin-bottom: 8px; background: rgba(255,255,255,0.02); padding: 6px; border-radius: 6px;">
                                <div><span style="font-size:8px; color:#a1a1aa; display:block;">QUEUE</span><strong style="font-size:11.5px; color:#fff;">${vCountA}</strong></div>
                                <div><span style="font-size:8px; color:#a1a1aa; display:block;">WAIT</span><strong style="font-size:11.5px; color:#fff;">${waitA}m</strong></div>
                                <div><span style="font-size:8px; color:#a1a1aa; display:block;">LANES</span><strong style="font-size:11.5px; color:#fff;">${lanesA.open}/${lanesA.total}</strong></div>
                            </div>
                            <div style="display:flex; gap:3px;">
                                <button onclick="TrafficControl.setDirectionalCongestion('${tId}', 'A', 'NORMAL')" style="flex:1; padding:4px 0; font-size:9.5px; font-weight:600; border-radius:4px; cursor:pointer; border:1px solid ${stateA === 'NORMAL' ? '#10b981' : 'rgba(255,255,255,0.08)'}; background:${stateA === 'NORMAL' ? 'rgba(16,185,129,0.2)' : 'rgba(0,0,0,0.3)'}; color:${stateA === 'NORMAL' ? '#10b981' : '#a1a1aa'};">Normal</button>
                                <button onclick="TrafficControl.setDirectionalCongestion('${tId}', 'A', 'MODERATE')" style="flex:1; padding:4px 0; font-size:9.5px; font-weight:600; border-radius:4px; cursor:pointer; border:1px solid ${stateA === 'MODERATE' ? '#fcd34d' : 'rgba(255,255,255,0.08)'}; background:${stateA === 'MODERATE' ? 'rgba(252,211,77,0.2)' : 'rgba(0,0,0,0.3)'}; color:${stateA === 'MODERATE' ? '#fcd34d' : '#a1a1aa'};">Mod</button>
                                <button onclick="TrafficControl.setDirectionalCongestion('${tId}', 'A', 'HIGH')" style="flex:1; padding:4px 0; font-size:9.5px; font-weight:600; border-radius:4px; cursor:pointer; border:1px solid ${stateA === 'HIGH' ? '#ff5e5e' : 'rgba(255,255,255,0.08)'}; background:${stateA === 'HIGH' ? 'rgba(255,94,94,0.2)' : 'rgba(0,0,0,0.3)'}; color:${stateA === 'HIGH' ? '#ff5e5e' : '#a1a1aa'};">High</button>
                                <button onclick="TrafficControl.adjustDirectionLanes('${tId}', 'A', -1)" style="padding:4px 6px; font-size:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.3); color:#fff; cursor:pointer;" title="Close Inbound Lane">−</button>
                                <button onclick="TrafficControl.adjustDirectionLanes('${tId}', 'A', 1)" style="padding:4px 6px; font-size:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.3); color:#fff; cursor:pointer;" title="Open Inbound Lane">+</button>
                            </div>
                        </div>

                        <!-- Direction B: Outbound / Opposite Side -->
                        <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                                <span style="font-size: 11px; font-weight: 700; color: #38bdf8; display:flex; align-items:center; gap:5px;">
                                    <i class="fa-solid fa-arrow-trend-down"></i> Outbound (Opposite Side)
                                </span>
                                <span style="font-size: 9px; font-weight: 700; color: ${colorB};">${stateB}</span>
                            </div>
                            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 4px; text-align: center; margin-bottom: 8px; background: rgba(255,255,255,0.02); padding: 6px; border-radius: 6px;">
                                <div><span style="font-size:8px; color:#a1a1aa; display:block;">QUEUE</span><strong style="font-size:11.5px; color:#fff;">${vCountB}</strong></div>
                                <div><span style="font-size:8px; color:#a1a1aa; display:block;">WAIT</span><strong style="font-size:11.5px; color:#fff;">${waitB}m</strong></div>
                                <div><span style="font-size:8px; color:#a1a1aa; display:block;">LANES</span><strong style="font-size:11.5px; color:#fff;">${lanesB.open}/${lanesB.total}</strong></div>
                            </div>
                            <div style="display:flex; gap:3px;">
                                <button onclick="TrafficControl.setDirectionalCongestion('${tId}', 'B', 'NORMAL')" style="flex:1; padding:4px 0; font-size:9.5px; font-weight:600; border-radius:4px; cursor:pointer; border:1px solid ${stateB === 'NORMAL' ? '#10b981' : 'rgba(255,255,255,0.08)'}; background:${stateB === 'NORMAL' ? 'rgba(16,185,129,0.2)' : 'rgba(0,0,0,0.3)'}; color:${stateB === 'NORMAL' ? '#10b981' : '#a1a1aa'};">Normal</button>
                                <button onclick="TrafficControl.setDirectionalCongestion('${tId}', 'B', 'MODERATE')" style="flex:1; padding:4px 0; font-size:9.5px; font-weight:600; border-radius:4px; cursor:pointer; border:1px solid ${stateB === 'MODERATE' ? '#fcd34d' : 'rgba(255,255,255,0.08)'}; background:${stateB === 'MODERATE' ? 'rgba(252,211,77,0.2)' : 'rgba(0,0,0,0.3)'}; color:${stateB === 'MODERATE' ? '#fcd34d' : '#a1a1aa'};">Mod</button>
                                <button onclick="TrafficControl.setDirectionalCongestion('${tId}', 'B', 'HIGH')" style="flex:1; padding:4px 0; font-size:9.5px; font-weight:600; border-radius:4px; cursor:pointer; border:1px solid ${stateB === 'HIGH' ? '#ff5e5e' : 'rgba(255,255,255,0.08)'}; background:${stateB === 'HIGH' ? 'rgba(255,94,94,0.2)' : 'rgba(0,0,0,0.3)'}; color:${stateB === 'HIGH' ? '#ff5e5e' : '#a1a1aa'};">High</button>
                                <button onclick="TrafficControl.adjustDirectionLanes('${tId}', 'B', -1)" style="padding:4px 6px; font-size:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.3); color:#fff; cursor:pointer;" title="Close Outbound Lane">−</button>
                                <button onclick="TrafficControl.adjustDirectionLanes('${tId}', 'B', 1)" style="padding:4px 6px; font-size:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.3); color:#fff; cursor:pointer;" title="Open Outbound Lane">+</button>
                            </div>
                        </div>

                    </div>
                </div>
            `;
        });

        grid.innerHTML = html;
    },

    setDirectionalCongestion: (tollId, dir, level) => {
        const states = Storage.get(Storage.KEYS.TOLL_STATES, {});
        if (!states[tollId]) states[tollId] = {};
        if (dir === 'A') {
            states[tollId].congestionA = level;
            states[tollId].congestion = level;
        } else {
            states[tollId].congestionB = level;
        }
        Storage.set(Storage.KEYS.TOLL_STATES, states);
        Utils.showToast(`Updated ${dir === 'A' ? 'Inbound' : 'Outbound'} flow at ${tollId} to ${level}`, 'info');
        TrafficControl.applyFilters();
    },

    adjustDirectionLanes: (tollId, dir, delta) => {
        const states = Storage.get(Storage.KEYS.TOLL_STATES, {});
        if (!states[tollId]) states[tollId] = {};
        const key = dir === 'A' ? 'lanesA' : 'lanesB';
        const currentLanes = states[tollId][key] || { total: 3, open: 3 };
        
        let newOpen = currentLanes.open + delta;
        if (newOpen < 1) newOpen = 1;
        if (newOpen > currentLanes.total) newOpen = currentLanes.total;

        states[tollId][key] = { total: currentLanes.total, open: newOpen };
        Storage.set(Storage.KEYS.TOLL_STATES, states);
        Utils.showToast(`${dir === 'A' ? 'Inbound' : 'Outbound'} active lanes at ${tollId}: ${newOpen}/${currentLanes.total}`, 'info');
        TrafficControl.applyFilters();
    },

    setCongestion: (tollId, level) => {
        TrafficControl.setDirectionalCongestion(tollId, 'A', level);
    },

    adjustLanes: (tollId, delta) => {
        TrafficControl.adjustDirectionLanes(tollId, 'A', delta);
    }
};

window.TrafficControl = TrafficControl;
