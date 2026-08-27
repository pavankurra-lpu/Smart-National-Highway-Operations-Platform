// Admin Alert Broadcaster & 10km Toll Gate Geofence Engine

const AlertBroadcaster = {
    selectedTollObj: null,

    init: () => {
        AlertBroadcaster.populatePlazas();
        AlertBroadcaster.bindEvents();
        AlertBroadcaster.renderActiveAlerts();

        // Listen for storage changes
        window.addEventListener('local-storage-update', () => {
            AlertBroadcaster.renderActiveAlerts();
            if (window.AdminApp && typeof AdminApp.renderBroadcastCircles === 'function') {
                AdminApp.renderBroadcastCircles();
            }
        });
    },

    populatePlazas: () => {
        const sel = document.getElementById('bc-plaza');
        if (!sel) return;

        const allTolls = window.TollData ? TollData.getAllTolls() : (window.TollSeedData || []);
        const loggedInPlaza = sessionStorage.getItem('admin_plaza') || 'ALL';
        
        let loggedInPlazaData = null;
        try {
            const raw = sessionStorage.getItem('admin_plaza_data');
            if (raw) loggedInPlazaData = JSON.parse(raw);
        } catch (e) {}

        sel.innerHTML = '';

        // Option 1: All Plazas (National Broadcast)
        const allOpt = document.createElement('option');
        allOpt.value = 'ALL';
        allOpt.textContent = '⭐ All India (National Highway Network)';
        sel.appendChild(allOpt);

        // Group toll plazas by State
        const stateGroups = {};
        allTolls.forEach(toll => {
            const st = toll.state || 'National Highway';
            if (!stateGroups[st]) stateGroups[st] = [];
            stateGroups[st].push(toll);
        });

        Object.keys(stateGroups).sort().forEach(st => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = `📍 ${st}`;
            stateGroups[st].forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id || t.name;
                const corr = t.nhCorridor && t.nhCorridor !== 'N/A' ? ` [NH-${t.nhCorridor}]` : '';
                opt.textContent = `🏗️ ${t.name}${corr}`;
                opt.dataset.tollJson = JSON.stringify(t);
                optgroup.appendChild(opt);
            });
            sel.appendChild(optgroup);
        });

        // If logged in as specific plaza, auto-select it!
        if (loggedInPlaza !== 'ALL') {
            const matchedOpt = Array.from(sel.options).find(o => o.value === loggedInPlaza || (o.dataset.tollJson && o.dataset.tollJson.includes(loggedInPlaza)));
            if (matchedOpt) {
                sel.value = matchedOpt.value;
            }
        }

        AlertBroadcaster.updateConnectedCard();
    },

    updateConnectedCard: () => {
        const sel = document.getElementById('bc-plaza');
        const nameEl = document.getElementById('bc-toll-name');
        const metaEl = document.getElementById('bc-toll-meta');
        const coordsEl = document.getElementById('bc-toll-coords');
        const badgeEl = document.getElementById('bc-status-badge');

        if (!sel) return;

        const val = sel.value;
        const allTolls = window.TollData ? TollData.getAllTolls() : (window.TollSeedData || []);

        if (val === 'ALL') {
            AlertBroadcaster.selectedTollObj = null;
            if (nameEl) nameEl.textContent = 'All India National Highway Network';
            if (metaEl) metaEl.textContent = 'National Corridors • Multi-State Geofence (1,232+ Plazas)';
            if (coordsEl) coordsEl.textContent = 'Lat: 20.5937, Lng: 78.9629 (Pan-India)';
            if (badgeEl) {
                badgeEl.innerHTML = '<span class="live-status-dot" style="background:#38bdf8;"></span> ALL-INDIA NETWORK';
                badgeEl.style.background = 'rgba(56,189,248,0.15)';
                badgeEl.style.color = '#38bdf8';
                badgeEl.style.borderColor = 'rgba(56,189,248,0.3)';
            }
        } else {
            let tollObj = null;
            const selectedOpt = sel.options[sel.selectedIndex];
            if (selectedOpt && selectedOpt.dataset.tollJson) {
                try {
                    tollObj = JSON.parse(selectedOpt.dataset.tollJson);
                } catch(e){}
            }
            if (!tollObj) {
                tollObj = allTolls.find(t => t.id === val || t.name === val);
            }

            AlertBroadcaster.selectedTollObj = tollObj;

            if (tollObj) {
                const corr = tollObj.nhCorridor && tollObj.nhCorridor !== 'N/A' ? `NH-${tollObj.nhCorridor} Corridor • ` : '';
                const loc = tollObj.district ? `${tollObj.district}, ${tollObj.state}` : (tollObj.state || 'India');
                
                if (nameEl) nameEl.textContent = `🏗️ ${tollObj.name}`;
                if (metaEl) metaEl.textContent = `${corr}${loc} • 10km Geofence Area`;
                if (coordsEl) coordsEl.textContent = `Lat: ${parseFloat(tollObj.lat).toFixed(4)}, Lng: ${parseFloat(tollObj.lng).toFixed(4)}`;
                if (badgeEl) {
                    badgeEl.innerHTML = '<span class="live-status-dot" style="background:#10b981;"></span> AUTO-CONNECTED';
                    badgeEl.style.background = 'rgba(16,185,129,0.15)';
                    badgeEl.style.color = '#10b981';
                    badgeEl.style.borderColor = 'rgba(16,185,129,0.3)';
                }
            }
        }
    },

    applyPreset: (presetKey) => {
        const titleInput = document.getElementById('bc-title');
        const msgInput = document.getElementById('bc-msg');
        const typeSelect = document.getElementById('bc-type');
        const tollName = AlertBroadcaster.selectedTollObj ? AlertBroadcaster.selectedTollObj.name : 'Toll Gate';

        const presets = {
            'congestion': {
                type: 'TRAFFIC',
                title: `Heavy Congestion (+20m delay) near ${tollName}`,
                msg: `High vehicle volume approaching ${tollName}. Additional FASTag clearance lanes activated. Expect 15-20 min transit delay.`
            },
            'fog': {
                type: 'WEATHER',
                title: `Dense Fog / Low Visibility Warning near ${tollName}`,
                msg: `Visibility reduced under 50m within 10km radius of ${tollName}. Maintain safe distance and switch on fog lamps.`
            },
            'accident': {
                type: 'EMERGENCY',
                title: `Accident Reported — Lane Diverted near ${tollName}`,
                msg: `Emergency response active 3km ahead of ${tollName}. Right lane blocked. Merge left cautiously and obey marshal signals.`
            },
            'maintenance': {
                type: 'INFO',
                title: `Highway Maintenance Ahead of ${tollName}`,
                msg: `Surface resurfacing work underway within 10km of ${tollName}. Speed limit restricted to 40 km/h.`
            },
            'vip': {
                type: 'INFO',
                title: `Special Access Convoy Clearing ${tollName}`,
                msg: `Authorized priority movement in progress at ${tollName}. Center express lane designated for emergency fast-track.`
            }
        };

        const p = presets[presetKey];
        if (p) {
            if (typeSelect) typeSelect.value = p.type;
            if (titleInput) titleInput.value = p.title;
            if (msgInput) msgInput.value = p.msg;
            Utils.showToast(`Preset loaded for ${tollName} ⚡`, 'info');
        }
    },

    bindEvents: () => {
        const plazaSelect = document.getElementById('bc-plaza');
        if (plazaSelect) {
            plazaSelect.addEventListener('change', () => {
                AlertBroadcaster.updateConnectedCard();
            });
        }

        const btn = document.getElementById('btn-broadcast');
        if (btn) {
            btn.addEventListener('click', () => {
                const type = document.getElementById('bc-type').value;
                const title = document.getElementById('bc-title').value.trim();
                const msg = document.getElementById('bc-msg').value.trim();

                if (!title || !msg) {
                    Utils.showToast("Please enter both a Headline and Description for the broadcast.", "error");
                    return;
                }

                const toll = AlertBroadcaster.selectedTollObj;
                const plazaName = toll ? toll.name : 'ALL';
                const plazaId = toll ? (toll.id || toll.name) : 'ALL';
                const lat = toll && toll.lat ? parseFloat(toll.lat) : 20.5937;
                const lng = toll && toll.lng ? parseFloat(toll.lng) : 78.9629;

                const alertPayload = {
                    id: Utils.generateId('ALT'),
                    type,
                    title,
                    message: msg,
                    plaza: plazaName,
                    plazaId: plazaId,
                    lat: lat,
                    lng: lng,
                    radiusKm: 10, // 10km Geofenced Coverage
                    timestamp: new Date().toISOString()
                };

                // Write to localStorage (same-device & multi-tab sync)
                Storage.addAdminAlert(alertPayload);

                // Emit over WebSocket so travellers on OTHER devices receive it in real time
                if (window.RealtimeService && RealtimeService.socket?.connected) {
                    RealtimeService.socket.emit('admin-broadcast', {
                        token: sessionStorage.getItem('nhai_admin_auth'),
                        alertData: alertPayload
                    });
                    Utils.showToast(`Broadcast active: 10km geofenced alert deployed around ${plazaName === 'ALL' ? 'all corridors' : plazaName + ' Toll Gate'} 📡`, 'success');
                } else {
                    Utils.showToast(`10km Broadcast deployed locally to ${plazaName === 'ALL' ? 'all corridors' : plazaName + ' Toll Gate'} 📡`, 'success');
                }

                // Render in active alerts & map radar
                AlertBroadcaster.renderActiveAlerts();
                if (window.AdminApp && typeof AdminApp.renderBroadcastCircles === 'function') {
                    AdminApp.renderBroadcastCircles();
                }

                document.getElementById('bc-title').value = '';
                document.getElementById('bc-msg').value = '';
            });
        }
    },

    renderActiveAlerts: () => {
        const listEl = document.getElementById('active-broadcasts-list');
        const countEl = document.getElementById('active-broadcast-count');
        if (!listEl) return;

        const alerts = Storage.get(Storage.KEYS.ADMIN_ALERTS, []);
        if (countEl) countEl.textContent = `${alerts.length} Active`;

        if (alerts.length === 0) {
            listEl.innerHTML = `
                <div style="text-align:center; padding:40px 20px; color:var(--text-sec); font-size:12px;">
                    <i class="fa-solid fa-satellite-dish" style="font-size:24px; color:rgba(255,255,255,0.15); margin-bottom:10px; display:block;"></i>
                    No active 10km geofence broadcasts.<br>
                    <span style="font-size:11px; color:#64748b;">Push an alert above to notify travellers within 10km of a toll gate.</span>
                </div>
            `;
            return;
        }

        const typeColors = {
            'EMERGENCY': '#ef4444',
            'TRAFFIC': '#f59e0b',
            'WEATHER': '#38bdf8',
            'INFO': '#10b981'
        };
        const typeIcons = {
            'EMERGENCY': 'fa-triangle-exclamation',
            'TRAFFIC': 'fa-car-burst',
            'WEATHER': 'fa-cloud-showers-heavy',
            'INFO': 'fa-circle-info'
        };

        let html = '';
        alerts.forEach(alert => {
            const color = typeColors[alert.type] || '#38bdf8';
            const icon = typeIcons[alert.type] || 'fa-bullhorn';
            const radius = alert.radiusKm || 10;
            const timeStr = Utils.formatDateTime ? Utils.formatDateTime(alert.timestamp) : new Date(alert.timestamp).toLocaleTimeString();

            html += `
                <div style="background:rgba(15,23,42,0.65); border:1px solid var(--border); border-left:4px solid ${color}; border-radius:8px; padding:12px; position:relative;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                        <div style="flex:1; min-width:0;">
                            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                                <span style="font-size:9px; font-weight:800; text-transform:uppercase; color:${color}; background:${color}18; border:1px solid ${color}35; padding:2px 6px; border-radius:4px;">
                                    <i class="fa-solid ${icon}"></i> ${alert.type}
                                </span>
                                <span style="font-size:9px; font-weight:700; color:#38bdf8; background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.25); padding:2px 6px; border-radius:4px;">
                                    📡 ${radius}km Geofence
                                </span>
                            </div>
                            <h4 style="margin:0 0 4px 0; font-size:12.5px; font-weight:700; color:#fff; line-height:1.3;">${alert.title}</h4>
                            <p style="margin:0; font-size:11px; color:#cbd5e1; line-height:1.4;">${alert.message}</p>
                            <div style="margin-top:6px; font-size:9.5px; color:#94a3b8; display:flex; align-items:center; gap:8px;">
                                <span><i class="fa-solid fa-archway" style="color:#38bdf8;"></i> ${alert.plaza || 'All Plazas'}</span>
                                <span>•</span>
                                <span><i class="fa-regular fa-clock"></i> ${timeStr}</span>
                            </div>
                        </div>
                        <button type="button" onclick="AlertBroadcaster.revokeAlert('${alert.id}')" style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); color:#f87171; border-radius:6px; padding:4px 8px; font-size:10.5px; cursor:pointer; font-weight:600; white-space:nowrap; transition:all 0.2s ease;" title="Revoke and cancel broadcast">
                            <i class="fa-solid fa-trash-can"></i> Revoke
                        </button>
                    </div>
                </div>
            `;
        });

        listEl.innerHTML = html;
    },

    revokeAlert: (id) => {
        if (confirm("Revoke this 10km geofenced highway broadcast?")) {
            Storage.removeAdminAlert(id);
            Utils.showToast("Broadcast revoked and removed from traveller radar.", "info");
            AlertBroadcaster.renderActiveAlerts();
            if (window.AdminApp && typeof AdminApp.renderBroadcastCircles === 'function') {
                AdminApp.renderBroadcastCircles();
            }
        }
    }
};

window.AlertBroadcaster = AlertBroadcaster;
