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
            const state = currentStates[tId]?.congestion || 'NORMAL';
            const lanes = currentStates[tId]?.lanes || { total: 6, open: 6 };
            
            const seed = plaza.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
            const r = (seed % 97) / 97;

            const vehicleCount = state === 'HIGH'     ? Math.floor(80  + r * 120) :
                                 state === 'MODERATE' ? Math.floor(30  + r * 50)  :
                                                         Math.floor(5   + r * 25);
            const waitTime     = state === 'HIGH'     ? Math.floor(12  + r * 20)  :
                                 state === 'MODERATE' ? Math.floor(5   + r * 8)   :
                                                         Math.floor(1   + r * 3);
            let base = plaza.baseRate || 50;
            if (base < 75) {
                const seed = tId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
                base = 90 + (seed % 191);
            }
            const revenue      = Math.floor(vehicleCount * base * (0.8 + r * 0.4));
            const congPct      = state === 'HIGH'     ? Math.floor(85  + r * 15)  :
                                 state === 'MODERATE' ? Math.floor(45  + r * 25)  :
                                                         Math.floor(10  + r * 20);
            
            const congColors = { NORMAL: '#10b981', MODERATE: '#fcd34d', HIGH: '#ff5e5e' };
            const congColor = congColors[state];

            // Render cool modern card layouts with glassmorphic elements (Kokonut UI Spotlight card)
            html += `
                <div class="tc-card spotlight-card" style="
                    border-left: 4px solid ${congColor};
                    margin-bottom: 12px;
                ">
                    
                    <!-- Header -->
                    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom: 12px;">
                        <div>
                            <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: #fff; line-height: 1.3;">${plaza.name}</h4>
                            <div style="font-size: 10px; color: var(--text-sec); margin-top: 3px; letter-spacing: 0.5px;">
                                ${tId} · <span style="text-transform: uppercase;">${plaza.state}</span>
                            </div>
                        </div>
                        <div style="
                            font-size: 9px; font-weight: 800; text-transform: uppercase;
                            color: ${congColor}; background: ${congColor}15;
                            padding: 3px 8px; border-radius: 6px; border: 1px solid ${congColor}30;
                            display: flex; align-items: center; gap: 4px;
                        ">
                            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${congColor};"></span>
                            ${state}
                        </div>
                    </div>

                    <!-- Live Stats Details -->
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 12px; background: rgba(0,0,0,0.25); padding: 8px; border-radius: 6px;">
                        <div style="text-align: center;">
                            <span style="display:block; font-size:8px; color:var(--text-sec); text-transform:uppercase;">Vehicles</span>
                            <span style="font-size:12px; font-weight:700; color:#fff;">${vehicleCount}</span>
                        </div>
                        <div style="text-align: center; border-left: 1px solid rgba(255,255,255,0.05);">
                            <span style="display:block; font-size:8px; color:var(--text-sec); text-transform:uppercase;">Wait</span>
                            <span style="font-size:12px; font-weight:700; color:#fff;">${waitTime}m</span>
                        </div>
                        <div style="text-align: center; border-left: 1px solid rgba(255,255,255,0.05);">
                            <span style="display:block; font-size:8px; color:var(--text-sec); text-transform:uppercase;">Revenue</span>
                            <span style="font-size:12px; font-weight:700; color:var(--primary);">₹${revenue}</span>
                        </div>
                        <div style="text-align: center; border-left: 1px solid rgba(255,255,255,0.05);">
                            <span style="display:block; font-size:8px; color:var(--text-sec); text-transform:uppercase;">Lanes</span>
                            <span style="font-size:12px; font-weight:700; color:#fff;">${lanes.open}/${lanes.total}</span>
                        </div>
                    </div>

                    <!-- Glowing Progress bar -->
                    <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden; margin-bottom: 14px;">
                        <div style="width: ${congPct}%; height: 100%; background: ${congColor}; box-shadow: 0 0 8px ${congColor}; transition: width 0.3s ease;"></div>
                    </div>

                    <!-- Control Actions -->
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                        <div style="display:flex; gap:4px; flex:1;">
                            <button onclick="setCongestion('${tId}', 'NORMAL')" style="
                                flex: 1; padding: 6px 0; font-size: 10px; font-weight: 600; border-radius: 6px; cursor: pointer; border: 1px solid ${state === 'NORMAL' ? '#10b981' : 'rgba(255,255,255,0.05)'};
                                background: ${state === 'NORMAL' ? 'rgba(16,185,129,0.15)' : 'rgba(0,0,0,0.2)'};
                                color: ${state === 'NORMAL' ? '#10b981' : 'var(--text-sec)'};
                            ">Normal</button>
                            
                            <button onclick="setCongestion('${tId}', 'MODERATE')" style="
                                flex: 1; padding: 6px 0; font-size: 10px; font-weight: 600; border-radius: 6px; cursor: pointer; border: 1px solid ${state === 'MODERATE' ? '#fcd34d' : 'rgba(255,255,255,0.05)'};
                                background: ${state === 'MODERATE' ? 'rgba(252,211,77,0.15)' : 'rgba(0,0,0,0.2)'};
                                color: ${state === 'MODERATE' ? '#fcd34d' : 'var(--text-sec)'};
                            ">Moderate</button>
                            
                            <button onclick="setCongestion('${tId}', 'HIGH')" style="
                                flex: 1; padding: 6px 0; font-size: 10px; font-weight: 600; border-radius: 6px; cursor: pointer; border: 1px solid ${state === 'HIGH' ? '#ff5e5e' : 'rgba(255,255,255,0.05)'};
                                background: ${state === 'HIGH' ? 'rgba(255,94,94,0.15)' : 'rgba(0,0,0,0.2)'};
                                color: ${state === 'HIGH' ? '#ff5e5e' : 'var(--text-sec)'};
                            ">High</button>
                        </div>
                        
                        <div style="display:flex; gap:4px;">
                            <button onclick="TrafficControl.adjustLanes('${tId}', -1)" style="
                                width: 28px; height: 24px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.2); color: #fff; font-size: 12px; cursor: pointer; display:flex; align-items:center; justify-content:center;
                            " title="Close Lane">−</button>
                            <button onclick="TrafficControl.adjustLanes('${tId}', 1)" style="
                                width: 28px; height: 24px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.2); color: #fff; font-size: 12px; cursor: pointer; display:flex; align-items:center; justify-content:center;
                            " title="Open Lane">+</button>
                        </div>
                    </div>
                </div>
            `;
        });

        grid.innerHTML = html;
    },

    setCongestion: (tollId, level) => {
        Storage.setTollCongestion(tollId, level);
        Utils.showToast(`Updated plaza ${tollId} load: ${level}`);
        TrafficControl.applyFilters();
    },

    adjustLanes: (tollId, delta) => {
        const states = Storage.get(Storage.KEYS.TOLL_STATES, {});
        if (!states[tollId]) states[tollId] = {};
        if (!states[tollId].lanes) states[tollId].lanes = { total: 6, open: 6 };
        
        states[tollId].lanes.open = Math.max(1, Math.min(states[tollId].lanes.total, states[tollId].lanes.open + delta));
        Storage.set(Storage.KEYS.TOLL_STATES, states);
        
        Utils.showToast(`Lane status updated: ${states[tollId].lanes.open}/${states[tollId].lanes.total} open.`);
        TrafficControl.renderGrid();
    }
};

window.TrafficControl = TrafficControl;
