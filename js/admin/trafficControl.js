// Enhanced Traffic and Congestion Admin Control

const TrafficControl = {
    currentPage: 0,
    pageSize: 25,
    filteredData: [],

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

        const prevBtn = document.getElementById('tc-prev');
        const nextBtn = document.getElementById('tc-next');
        if (prevBtn) prevBtn.addEventListener('click', () => { if (TrafficControl.currentPage > 0) { TrafficControl.currentPage--; TrafficControl.renderGrid(); } });
        if (nextBtn) nextBtn.addEventListener('click', () => {
            const maxPage = Math.floor((TrafficControl.filteredData.length - 1) / TrafficControl.pageSize);
            if (TrafficControl.currentPage < maxPage) { TrafficControl.currentPage++; TrafficControl.renderGrid(); }
        });

        // Refresh stats periodically
        setInterval(() => TrafficControl.updateStats(), 5000);
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
            grid.innerHTML = '<div style="color:var(--text-sec); font-size:12px; padding:20px; text-align:center;">No Toll Plazas Match Criteria</div>';
            return;
        }

        let html = '';
        page.forEach(plaza => {
            const tId = plaza.id;
            const state = currentStates[tId]?.congestion || 'NORMAL';
            const lanes = currentStates[tId]?.lanes || { total: 6, open: 6 };
            
            // Simulated live data
            const vehicleCount = state === 'HIGH' ? Math.floor(80 + Math.random() * 120) : state === 'MODERATE' ? Math.floor(30 + Math.random() * 50) : Math.floor(5 + Math.random() * 25);
            const waitTime = state === 'HIGH' ? Math.floor(12 + Math.random() * 20) : state === 'MODERATE' ? Math.floor(5 + Math.random() * 8) : Math.floor(1 + Math.random() * 3);
            const revenue = Math.floor(vehicleCount * (plaza.baseRate || 50) * (0.8 + Math.random() * 0.4));
            
            const congColors = { NORMAL: '#64ffda', MODERATE: '#fcd34d', HIGH: '#ff5e5e' };
            const congColor = congColors[state];
            const congPct = state === 'HIGH' ? 85 + Math.floor(Math.random() * 15) : state === 'MODERATE' ? 45 + Math.floor(Math.random() * 25) : 10 + Math.floor(Math.random() * 20);

            html += `
                <div class="tc-card" style="border-left: 3px solid ${congColor};">
                    <div class="tc-card-header">
                        <div>
                            <h4 class="tc-plaza-name" title="${plaza.name}">${plaza.name}</h4>
                            <div class="tc-meta">${tId} · ${plaza.state} · ${plaza.type}</div>
                        </div>
                        <div class="tc-live-badge" style="color: ${congColor};">● ${state}</div>
                    </div>

                    <!-- Live Metrics -->
                    <div class="tc-metrics">
                        <div class="tc-metric">
                            <span class="tc-metric-label">Vehicles</span>
                            <span class="tc-metric-val">${vehicleCount}</span>
                        </div>
                        <div class="tc-metric">
                            <span class="tc-metric-label">Avg Wait</span>
                            <span class="tc-metric-val">${waitTime}m</span>
                        </div>
                        <div class="tc-metric">
                            <span class="tc-metric-label">Revenue</span>
                            <span class="tc-metric-val" style="color:var(--primary);">₹${revenue.toLocaleString()}</span>
                        </div>
                        <div class="tc-metric">
                            <span class="tc-metric-label">Lanes</span>
                            <span class="tc-metric-val">${lanes.open}/${lanes.total}</span>
                        </div>
                    </div>

                    <!-- Congestion Bar -->
                    <div class="tc-cong-bar-wrap">
                        <div class="tc-cong-bar" style="width: ${congPct}%; background: ${congColor};"></div>
                    </div>

                    <!-- Controls -->
                    <div class="tc-controls">
                        <div class="tc-btn-group">
                            <button onclick="setCongestion('${tId}', 'NORMAL')" class="tc-btn ${state === 'NORMAL' ? 'tc-btn-active-green' : ''}">Normal</button>
                            <button onclick="setCongestion('${tId}', 'MODERATE')" class="tc-btn ${state === 'MODERATE' ? 'tc-btn-active-yellow' : ''}">Moderate</button>
                            <button onclick="setCongestion('${tId}', 'HIGH')" class="tc-btn ${state === 'HIGH' ? 'tc-btn-active-red' : ''}">High</button>
                        </div>
                        <div class="tc-lane-controls">
                            <button onclick="TrafficControl.adjustLanes('${tId}', -1)" class="tc-btn" title="Close lane">− Lane</button>
                            <button onclick="TrafficControl.adjustLanes('${tId}', 1)" class="tc-btn" title="Open lane">+ Lane</button>
                        </div>
                    </div>
                </div>
            `;
        });

        grid.innerHTML = html;
    },

    setCongestion: (tollId, level) => {
        Storage.setTollCongestion(tollId, level);
        Utils.showToast(`${tollId} → ${level} traffic.`);
        TrafficControl.applyFilters();
    },

    adjustLanes: (tollId, delta) => {
        const states = Storage.get(Storage.KEYS.TOLL_STATES, {});
        if (!states[tollId]) states[tollId] = {};
        if (!states[tollId].lanes) states[tollId].lanes = { total: 6, open: 6 };
        
        states[tollId].lanes.open = Math.max(1, Math.min(states[tollId].lanes.total, states[tollId].lanes.open + delta));
        Storage.set(Storage.KEYS.TOLL_STATES, states);
        
        Utils.showToast(`${tollId}: ${states[tollId].lanes.open}/${states[tollId].lanes.total} lanes open.`);
        TrafficControl.renderGrid();
    }
};

window.TrafficControl = TrafficControl;
