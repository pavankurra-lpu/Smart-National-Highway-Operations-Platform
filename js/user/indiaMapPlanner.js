// NHAI Smart Highway Platform - India Map Planner v2.0
// Real OSRM routing · Satellite map · Alternate routes · On-route services · Toll corridor matching

const IndiaMapPlanner = {
    map: null,
    selectedRouteData: null,
    isSpecialVerified: false,
    selectedOrigin: null,
    selectedDest: null,
    routeTollMarkers: [],

    // Layer refs
    _satelliteLayer: null,
    _labelsLayer: null,
    _streetLayer: null,
    _stateLayer: null,
    _districtLayer: null,
    _isSatellite: true,
    _showBoundaries: true,

    // Route polylines
    routePolylines: [],          // primary + alternate layers
    selectedRouteIndex: 0,
    allRoutes: [],               // raw OSRM route objects

    // Toll markers on map
    tollMarkers: [],
    tollMarkersVisible: false,

    // Service markers
    serviceMarkers: [],

    // Live trip
    isTripLive: false,
    carMarker: null,
    routeCoordinates: [],
    chargedTollIds: new Set(),
    currentTripId: null,
    tripTollsPassed: [],
    tripTotalCost: 0,
    tripInterval: null,
    trailPolyline: null,
    isFollowing: true,
    gpsWatchId: null,
    
    // Toll Explorer / Selection Mode
    isSelectionMode: false,
    selectionStart: null,
    selectionEnd: null,
    selectionLayer: null, // visual line/corridor
    selectionMarkers: [], // start/end markers

    currentLiveLat: null,
    currentLiveLng: null,
    // ── All-India city list for built-in autocomplete ───────────────────────────
    cities: window.IndiaMapData?.cities || [],

    // ═══════════════════════════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════════════════════════
    init: () => {
        const cfg = window.NHAI_CONFIG || { map: { defaultCenter: [20.5937, 78.9629], defaultZoom: 5 } };

        // Create Leaflet map
        IndiaMapPlanner.map = L.map('map', {
            zoomControl: false,
            attributionControl: false,
            center: cfg.map.defaultCenter,
            zoom: cfg.map.defaultZoom
        });

        L.control.zoom({ position: 'topleft' }).addTo(IndiaMapPlanner.map);

        // ── Tile layers ────────────────────────────────────────────
        const tileCfg = cfg.tiles || {};
        IndiaMapPlanner._satelliteLayer = L.tileLayer(
            (tileCfg.satellite || {}).url || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 19, maxNativeZoom: 17, attribution: '© Esri' }
        );
        IndiaMapPlanner._labelsLayer = L.tileLayer(
            (tileCfg.labels || {}).url || 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
            { maxZoom: 19, maxNativeZoom: 18, opacity: 0.7 }
        );
        IndiaMapPlanner._streetLayer = L.tileLayer(
            (tileCfg.street || {}).url || 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            { maxZoom: 19, maxNativeZoom: 18 }
        );

        // Default: satellite + labels
        IndiaMapPlanner._satelliteLayer.addTo(IndiaMapPlanner.map);
        IndiaMapPlanner._labelsLayer.addTo(IndiaMapPlanner.map);
        IndiaMapPlanner._isSatellite = true;

        window.NHAI_MAP = IndiaMapPlanner.map;

        // ── Sidebar toggle ─────────────────────────────────────────
        const toggleBtn = document.getElementById('sidebar-toggle');
        const sidebar   = document.getElementById('nhai-sidebar');
        if (toggleBtn && sidebar) {
            toggleBtn.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                toggleBtn.classList.toggle('shifted');
                const icon = toggleBtn.querySelector('i');
                if (sidebar.classList.contains('collapsed')) {
                    icon.className = 'fa-solid fa-bars';
                    toggleBtn.title = 'Open Panel';
                } else {
                    icon.className = 'fa-solid fa-xmark';
                    toggleBtn.title = 'Close Panel';
                }
            });
        }

        // ── Autocomplete ───────────────────────────────────────────
        IndiaMapPlanner.setupAutocomplete('route-origin-input', 'origin-suggestions', city => {
            if (city.lat === 0 && city.lng === 0) {
                // Village with unknown coords - geocode first
                IndiaMapPlanner._geocodeVillage(city, (res) => {
                    IndiaMapPlanner.selectedOrigin = res;
                    if (IndiaMapPlanner.map) {
                        IndiaMapPlanner.map.flyTo([res.lat, res.lng], 13, { animate: true, duration: 1.5 });
                    }
                });
            } else {
                IndiaMapPlanner.selectedOrigin = city;
                if (IndiaMapPlanner.map && city.lat && city.lng) {
                    IndiaMapPlanner.map.flyTo([city.lat, city.lng], 12, { animate: true, duration: 1.5 });
                }
            }
        });
        IndiaMapPlanner.setupAutocomplete('route-dest-input', 'dest-suggestions', city => {
            if (city.lat === 0 && city.lng === 0) {
                IndiaMapPlanner._geocodeVillage(city, (res) => {
                    IndiaMapPlanner.selectedDest = res;
                });
            } else {
                IndiaMapPlanner.selectedDest = city;
            }
        });

        // ── Button bindings ────────────────────────────────────────
        const safe = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };

        safe('btn-calc-route',  () => IndiaMapPlanner.processRoute());
        safe('btn-start-trip',  () => IndiaMapPlanner.startLiveTrip());
        safe('btn-end-trip',    () => IndiaMapPlanner.endLiveTrip());

        safe('btn-view-pass', () => {
            const modal = document.getElementById('pass-plan-modal');
            if (!modal) return;
            const content = document.getElementById('pass-plan-content');
            if (content && IndiaMapPlanner.selectedRouteData) {
                content.innerHTML = PassPlanEngine.generateRecommendations(IndiaMapPlanner.selectedRouteData);
            }
            Utils.toggleVisibility('pass-plan-modal', true);
        });

        safe('btn-view-lanes', () => {
            const modal = document.getElementById('lane-advisor-modal');
            if (!modal) return;
            const content = document.getElementById('lane-advisor-content');
            const status  = document.getElementById('lane-vehicle-status');
            const vType   = document.getElementById('vehicle-type')?.value || 'LMV';
            if (content && IndiaMapPlanner.selectedRouteData) {
                content.innerHTML = LaneAdvisor.renderAdvisor(IndiaMapPlanner.selectedRouteData, IndiaMapPlanner.isSpecialVerified);
            }
            if (status) status.innerText = `Vehicle: ${vType} | FASTag: ${document.getElementById('pref-fastag')?.checked ? 'ON' : 'OFF'}`;
            Utils.toggleVisibility('lane-advisor-modal', true);
        });

        // Vehicle type → special box
        const vSel = document.getElementById('vehicle-type');
        if (vSel) {
            vSel.addEventListener('change', e => {
                const isSpecial = ['GOVT','PRESS','ARMY','AMBULANCE','FIRE','POLICE'].includes(e.target.value);
                Utils.toggleVisibility('special-vehicle-box', isSpecial);
                IndiaMapPlanner.isSpecialVerified = false;
            });
        }

        safe('btn-verify-special', () => {
            const id  = document.getElementById('special-plate-id')?.value || '';
            const res = SpecialVehicleRegistry.verify(id);
            const el  = document.getElementById('special-verify-res');
            if (res.valid) {
                IndiaMapPlanner.isSpecialVerified = true;
                if (el) { el.style.color = 'var(--primary)'; el.innerText = '✓ Verified – Toll exempt active'; }
                Utils.showToast('Authority Verified', 'success');
            } else {
                IndiaMapPlanner.isSpecialVerified = false;
                if (el) { el.style.color = 'var(--accent-red)'; el.innerText = '✗ Invalid ID – not registered'; }
                Utils.showToast('Invalid ID', 'error');
            }
        });

        safe('btn-gps-mode', () => IndiaMapPlanner.toggleGpsMode());
        
        // Toll Explorer Tool
        safe('btn-toll-explorer-toggle', () => IndiaMapPlanner.toggleSelectionMode());
        safe('btn-explorer-avoid-tab', () => IndiaMapPlanner.routeAndAvoidTolls());

        safe('btn-follow-me', () => {
            IndiaMapPlanner.isFollowing = !IndiaMapPlanner.isFollowing;
            const btn = document.getElementById('btn-follow-me');
            if (btn) btn.classList.toggle('active', IndiaMapPlanner.isFollowing);
            Utils.showToast(IndiaMapPlanner.isFollowing ? 'Auto-follow ON' : 'Auto-follow OFF', 'info');
        });

        // ── Layer toggle button ────────────────────────────────────
        IndiaMapPlanner._addLayerToggle();

        // ── Toll markers after map ready ──────────────────────────
        IndiaMapPlanner.map.whenReady(() => {
            IndiaMapPlanner.renderTollMarkers();
            IndiaMapPlanner.loadBoundaries();

            IndiaMapPlanner.map.on('zoomend', () => {
                clearTimeout(IndiaMapPlanner._zoomTimer);
                IndiaMapPlanner._zoomTimer = setTimeout(() => {
                    IndiaMapPlanner.updateTollMarkerVisibility();
                    IndiaMapPlanner.updateBoundaryVisibility();
                }, 300);
            });
            IndiaMapPlanner.map.on('moveend', () => {
                if (IndiaMapPlanner.tollMarkersVisible) {
                    clearTimeout(IndiaMapPlanner._moveTimer);
                    IndiaMapPlanner._moveTimer = setTimeout(() => IndiaMapPlanner.renderTollMarkers(), 400);
                }
            });

            // Selection Mode Events
            IndiaMapPlanner.map.on('mousedown', e => IndiaMapPlanner._onMapMouseDown(e));
            IndiaMapPlanner.map.on('mousemove', e => IndiaMapPlanner._onMapMouseMove(e));
            IndiaMapPlanner.map.on('mouseup',   e => IndiaMapPlanner._onMapMouseUp(e));
        });


        // Fallback render
        setTimeout(() => {
            if (IndiaMapPlanner.tollMarkers.length === 0 && IndiaMapPlanner.map) {
                IndiaMapPlanner.renderTollMarkers();
            }
        }, 3000);
    },

    // ═══════════════════════════════════════════════════════════════
    // AUTOCOMPLETE — built-in city list + live Nominatim for unknowns
    // ═══════════════════════════════════════════════════════════════
    setupAutocomplete: (inputId, dropdownId, onSelect) => {
        const input    = document.getElementById(inputId);
        const dropdown = document.getElementById(dropdownId);
        if (!input || !dropdown) return;

        let debounceTimer;

        input.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const val = input.value.trim().toLowerCase();
            if (val.length < 2) { dropdown.innerHTML = ''; dropdown.style.display = 'none'; return; }

            // Built-in matches first
            const local = IndiaMapPlanner.cities.filter(c =>
                c.name.toLowerCase().includes(val) || c.state.toLowerCase().includes(val)
            ).slice(0, 10);

            IndiaMapPlanner._renderDropdown(dropdown, local, (city) => {
                input.value = `${city.name}, ${city.state}`;
                dropdown.style.display = 'none';
                onSelect(city);
            });

            // Always attempt Nominatim search after a debounce to catch small villages/places not in local list
            if (val.length >= 3) {
                debounceTimer = setTimeout(() => IndiaMapPlanner._nominatimSearch(val, dropdown, input, onSelect), 500);
            }
        });

        document.addEventListener('click', e => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    },

    _renderDropdown: (dropdown, cities, onClick) => {
        if (cities.length === 0) {
            dropdown.innerHTML = '<div class="ac-item" style="color:var(--text-muted)">No matches – try Nominatim…</div>';
            dropdown.style.display = 'block';
            return;
        }
        dropdown.innerHTML = cities.map(c =>
            `<div class="ac-item" data-name="${c.name}" data-lat="${c.lat}" data-lng="${c.lng}" data-state="${c.state || ''}" data-isvillage="${c.isVillage || false}">
                <strong>${c.name}</strong> 
                <span style="color:var(--text-muted);font-size:11px;">${c.state || 'India'}</span>
                ${c.isVillage ? '<span class="badge" style="font-size:9px;margin-left:5px;background:rgba(100,255,218,0.1);color:#64ffda;">VILLAGE</span>' : ''}
            </div>`
        ).join('');
        dropdown.style.display = 'block';
        dropdown.querySelectorAll('.ac-item[data-name]').forEach(item => {
            item.addEventListener('click', () => {
                const isVillage = item.dataset.isvillage === 'true';
                onClick({
                    name:  item.dataset.name,
                    lat:   parseFloat(item.dataset.lat),
                    lng:   parseFloat(item.dataset.lng),
                    state: item.dataset.state,
                    isVillage: isVillage
                });
            });
        });
    },

    _geocodeVillage: (city, callback) => {
        const query = `${city.name}, ${city.state === 'Village' ? '' : city.state}, India`;
        Utils.showToast(`Geocoding ${city.name}...`, 'info');
        
        fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`)
            .then(r => r.json())
            .then(data => {
                if (data && data.length > 0) {
                    const res = {
                        name: city.name,
                        state: city.state,
                        lat: parseFloat(data[0].lat),
                        lng: parseFloat(data[0].lon)
                    };
                    Utils.showToast(`Location found!`, 'success');
                    callback(res);
                } else {
                    Utils.showToast(`Could not find exact location for ${city.name}. Try Nominatim search.`, 'error');
                }
            })
            .catch(() => {
                Utils.showToast(`Geocoding service error.`, 'error');
            });
    },

    _nominatimSearch: (query, dropdown, input, onSelect) => {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=in&format=json&addressdetails=1&limit=6`;
        fetch(url, { headers: { 'Accept-Language': 'en' } })
            .then(r => r.json())
            .then(results => {
                const cities = results.map(r => ({
                    name:  r.display_name.split(',')[0].trim(),
                    lat:   parseFloat(r.lat),
                    lng:   parseFloat(r.lon),
                    state: r.address?.state || 'India'
                }));
                // Merge with existing dropdown items
                const existing = [...dropdown.querySelectorAll('.ac-item[data-name]')].map(el => el.dataset.name);
                const fresh = cities.filter(c => !existing.includes(c.name));
                if (fresh.length > 0) {
                    fresh.forEach(c => {
                        const div = document.createElement('div');
                        div.className = 'ac-item';
                        div.dataset.name  = c.name;
                        div.dataset.lat   = c.lat;
                        div.dataset.lng   = c.lng;
                        div.dataset.state = c.state;
                        div.innerHTML = `<strong>${c.name}</strong> <span style="color:var(--text-muted);font-size:11px;">${c.state} · OSM</span>`;
                        div.addEventListener('click', () => {
                            input.value = `${c.name}, ${c.state}`;
                            dropdown.style.display = 'none';
                            onSelect(c);
                        });
                        dropdown.appendChild(div);
                    });
                    dropdown.style.display = 'block';
                }
            })
            .catch(() => {}); // silent fail for Nominatim
    },

    // ═══════════════════════════════════════════════════════════════
    // ROUTE PROCESSING — OSRM + alternate routes
    // ═══════════════════════════════════════════════════════════════
    processRoute: () => {
        if (!IndiaMapPlanner.selectedOrigin || !IndiaMapPlanner.selectedDest) {
            Utils.showToast('Select both Origin and Destination first.', 'error'); return;
        }
        // India bounds check
        const o = IndiaMapPlanner.selectedOrigin;
        const d = IndiaMapPlanner.selectedDest;
        const b = (window.NHAI_CONFIG || {}).map?.bounds || { north:37.6, south:6.5, west:68, east:97.5 };
        const inBounds = p => p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east;
        if (!inBounds(o) || !inBounds(d)) {
            Utils.showToast('This platform is India-only. Please select locations within India.', 'error'); return;
        }

        const btnCalc = document.getElementById('btn-calc-route');
        if (btnCalc) { btnCalc.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyzing…'; btnCalc.disabled = true; }

        IndiaMapPlanner.endLiveTrip();
        IndiaMapPlanner._clearRoutePolylines();
        IndiaMapPlanner._clearServiceMarkers();
        IndiaMapPlanner.routeTollMarkers.forEach(m => { try { m.remove(); } catch(e){} });
        IndiaMapPlanner.routeTollMarkers = [];

        const ORS_KEY = window.NHAI_CONFIG?.routing?.orsApiKey || 'YOUR_ORS_API_KEY';

        const url = `https://api.openrouteservice.org/v2/directions/driving-car?` +
            `start=${o.lng},${o.lat}&end=${d.lng},${d.lat}`;

        fetch(url, {
            headers: {
                'Authorization': ORS_KEY,
                'Accept': 'application/json, application/geo+json'
            }
        })
        .then(r => r.json())
        .then(data => {
            if (!data.features?.length) {
                IndiaMapPlanner._fallbackOSRM(o, d);
                return;
            }
            const feature = data.features[0];
            const route = {
                distance: feature.properties.summary.distance,
                duration: feature.properties.summary.duration,
                geometry: feature.geometry
            };
            IndiaMapPlanner.allRoutes = [route];
            
            // Avoid Tolls check
            const avoidTolls = document.getElementById('pref-avoid-tolls')?.checked;
            if (avoidTolls) {
                Utils.showToast('Routes optimized to minimize tolls.', 'info');
            }

            if (btnCalc) { btnCalc.innerHTML = '<i class="fa-solid fa-magnifying-glass-location"></i> Calculate Route'; btnCalc.disabled = false; }
            IndiaMapPlanner.selectedRouteIndex = 0;
            IndiaMapPlanner._applyRoute(0, o, d);
        })
        .catch(() => IndiaMapPlanner._fallbackOSRM(o, d));
    },

    _fallbackOSRM: (o, d) => {
        const btnCalc = document.getElementById('btn-calc-route');
        const url = `https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}?overview=full&geometries=geojson&alternatives=true&steps=false`;
        fetch(url)
            .then(r => r.json())
            .then(data => {
                if (btnCalc) { btnCalc.innerHTML = '<i class="fa-solid fa-magnifying-glass-location"></i> Calculate Route'; btnCalc.disabled = false; }
                if (data.code !== 'Ok' || !data.routes?.length) {
                    Utils.showToast('No route found via OSRM. Try nearby cities.', 'error');
                    return;
                }
                IndiaMapPlanner.allRoutes = data.routes;
                
                // If Avoid Tolls is checked, sort routes by toll count
                const avoidTolls = document.getElementById('pref-avoid-tolls')?.checked;
                if (avoidTolls) {
                    IndiaMapPlanner.allRoutes.sort((a, b) => {
                        const tollsA = IndiaMapPlanner.estimateTollsOnRoute(a.geometry.coordinates).tolls.length;
                        const tollsB = IndiaMapPlanner.estimateTollsOnRoute(b.geometry.coordinates).tolls.length;
                        return tollsA - tollsB;
                    });
                    Utils.showToast('Routes optimized to minimize tolls.', 'info');
                }

                IndiaMapPlanner.selectedRouteIndex = 0;
                IndiaMapPlanner._applyRoute(0, o, d);
            })
            .catch(() => {
                if (btnCalc) { btnCalc.innerHTML = '<i class="fa-solid fa-magnifying-glass-location"></i> Calculate Route'; btnCalc.disabled = false; }
                Utils.showToast('Routing service unavailable. Please try again.', 'error');
            });
    },
    },

    _applyRoute: (index, origin, dest) => {
        const routes = IndiaMapPlanner.allRoutes;
        if (!routes || !routes[index]) return;

        IndiaMapPlanner.routeTollMarkers.forEach(m => { try { m.remove(); } catch(e){} });
        IndiaMapPlanner.routeTollMarkers = [];

        IndiaMapPlanner._clearRoutePolylines();

        const routeStyles = [
            { color: '#3b82f6', weight: 7, opacity: 1.0 },           // primary — bold blue
            { color: '#f59e0b', weight: 5, opacity: 0.85, dashArray: '10 5' }, // alt1 — amber dashed
            { color: '#10b981', weight: 5, opacity: 0.85, dashArray: '6 4' }   // alt2 — green dashed
        ];

        // Draw primary route FIRST (underneath)
        const primary = routes[index];
        const coords  = primary.geometry.coordinates; // [[lng, lat], …]
        const primaryLatLngs = coords.map(p => [p[1], p[0]]);

        const primaryPoly = L.polyline(primaryLatLngs, { ...routeStyles[0], lineJoin: 'round' })
            .addTo(IndiaMapPlanner.map);
        primaryPoly.bindTooltip('Selected Route', { permanent: false, sticky: true });
        IndiaMapPlanner.routePolylines.push(primaryPoly);

        // Draw alternate routes on top
        routes.forEach((r, i) => {
            if (i === index) return;
            const altLatLngs = r.geometry.coordinates.map(p => [p[1], p[0]]);
            const style   = routeStyles[i] || routeStyles[2];
            const poly    = L.polyline(altLatLngs, { ...style, lineJoin: 'round' })
                .addTo(IndiaMapPlanner.map);

            // Click → switch to this route
            poly.on('click', () => {
                IndiaMapPlanner.selectedRouteIndex = i;
                IndiaMapPlanner._applyRoute(i, IndiaMapPlanner.selectedOrigin, IndiaMapPlanner.selectedDest);
            });

            const altNum = i < index ? i + 1 : i;
            poly.bindTooltip(`Alternate Route ${altNum}`, { permanent: false, sticky: true });
            IndiaMapPlanner.routePolylines.push(poly);
        });

        // Store for trip and toll matching
        IndiaMapPlanner.routeCoordinates = coords;

        // Toll matching
        const rData = IndiaMapPlanner.estimateTollsOnRoute(coords);
        rData.totalDist   = (primary.distance / 1000).toFixed(1);
        rData.totalEta    = (primary.duration / 3600).toFixed(1);
        rData.originName  = origin ? origin.name : '—';
        rData.destName    = dest ? dest.name : '—';
        IndiaMapPlanner.selectedRouteData = rData;

        // Draw toll markers
        const tollIcon = L.divIcon({
            className: '',
            html: "<div style='background:#fbbf24;width:11px;height:11px;border-radius:50%;border:2px solid #020c18;box-shadow:0 0 8px #fbbf24'></div>",
            iconSize: [11,11], iconAnchor: [5,5]
        });
        rData.tolls.forEach(t => {
            const td = window.TollSeedData?.find(s => s.id === t.id);
            if (!td) return;
            try {
                const m = L.marker([td.lat, td.lng], { icon: tollIcon })
                    .bindPopup(IndiaMapPlanner._tollPopup(td, t.cost))
                    .addTo(IndiaMapPlanner.map);
                IndiaMapPlanner.routeTollMarkers.push(m);
            } catch(e) {}
        });

        // Alternate route tabs UI
        IndiaMapPlanner._buildAltRouteTabs(routes, index);

        // Summary
        IndiaMapPlanner.updateSummary(rData);
        document.getElementById('route-summary-panel')?.classList.remove('hidden');
        document.getElementById('trip-badge').innerText  = 'PREVIEW MODE';
        document.getElementById('trip-badge').style.background = 'rgba(255,255,255,0.15)';
        document.getElementById('trip-badge').style.color = 'var(--text-sec)';

        IndiaMapPlanner.map.fitBounds(primaryPoly.getBounds(), { padding: [50, 50] });
        Utils.showToast(`${rData.originName} → ${rData.destName} · ${rData.totalDist} km · ${rData.tolls.length} tolls`, 'success');

        // Fetch on-route services
        setTimeout(() => IndiaMapPlanner.fetchOnRouteServices(coords, rData), 800);
    },

    _tollPopup: (td, cost) => `
        <div style="min-width:180px;font-family:'Inter',sans-serif;padding:4px;">
            <div style="font-weight:700;font-size:13px;color:#0a192f;margin-bottom:4px;">🏗️ ${td.name}</div>
            <div style="font-size:11px;color:#555;">${td.state || ''} · ${td.plazaType || ''} · ${td.type || ''}</div>
            <div style="font-size:11px;color:#555;margin-top:2px;">${td.concessionaire || 'NHAI'}</div>
            <div style="font-size:11px;margin-top:4px;color:#059669;font-weight:700;">
                Base: ₹${td.baseRate || 50} &nbsp;|&nbsp; Your Vehicle: ₹${cost}
            </div>
        </div>`,

    _buildAltRouteTabs: (routes, selectedIdx) => {
        let tabBar = document.getElementById('alt-route-tabs');
        if (!tabBar) {
            tabBar = document.createElement('div');
            tabBar.id = 'alt-route-tabs';
            tabBar.style.cssText = [
                'display:flex', 'gap:6px', 'margin-bottom:10px', 'flex-wrap:wrap',
                'border:none', 'background:none', 'outline:none', 'padding:0', 'margin-left:0'
            ].join(';');
            const panel = document.querySelector('.route-summary-float');
            if (panel) panel.insertBefore(tabBar, panel.firstChild);
        }
        tabBar.innerHTML = '';
        if (!routes || routes.length <= 1) {
            tabBar.innerHTML = `
                <div style="
                    font-size:11px; color:var(--text-muted);
                    padding:6px 10px; border:1px solid var(--border);
                    border-radius:6px; display:flex; align-items:center; gap:6px;
                ">
                    <i class="fa-solid fa-circle-info" style="color:#60a5fa;"></i>
                    Only one route available for this journey
                </div>`;
            return;
        }

        routes.forEach((r, i) => {
            const btn = document.createElement('button');
            const isSelected = i === selectedIdx;
            
            // Explicit styling to avoid any 'square box' artifacts from browser defaults
            btn.style.cssText = `
                padding: 6px 12px;
                border-radius: 20px;
                border: 1px solid var(--primary);
                font-size: 10px;
                font-weight: 700;
                cursor: pointer;
                font-family: 'Inter', sans-serif;
                transition: all 0.2s ease;
                letter-spacing: 0.5px;
                background: ${isSelected ? 'var(--primary)' : 'transparent'};
                color: ${isSelected ? '#021a12' : 'var(--primary)'};
                box-shadow: ${isSelected ? '0 0 10px var(--primary-glow)' : 'none'};
                outline: none;
                margin: 0;
            `;

            btn.textContent  = i === 0 ? 'PRIMARY ROUTE' : `ALT ROUTE ${i}`;
            
            // OSRM provides distance in meters, duration in seconds
            const distKm = (r.distance / 1000).toFixed(1);
            const timeHr = (r.duration / 3600).toFixed(1);
            btn.title = `${distKm} km · ${timeHr} hr`;
            btn.addEventListener('click', () => {
                IndiaMapPlanner.selectedRouteIndex = i;
                IndiaMapPlanner._applyRoute(i, IndiaMapPlanner.selectedOrigin, IndiaMapPlanner.selectedDest);
            });
            tabBar.appendChild(btn);
        });
    },

    _clearRoutePolylines: () => {
        IndiaMapPlanner.routePolylines.forEach(p => { try { p.remove(); } catch(e){} });
        IndiaMapPlanner.routePolylines = [];
        // Remove alt tabs
        document.getElementById('alt-route-tabs')?.remove();
    },

    // ═══════════════════════════════════════════════════════════════
    // ROUTE SUMMARY UPDATE
    // ═══════════════════════════════════════════════════════════════
    updateSummary: rData => {
        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
        setText('summary-title', `${rData.originName} → ${rData.destName}`);
        setText('sum-dist',      rData.totalDist);
        setText('sum-eta',       rData.totalEta);
        setText('sum-toll',      rData.tolls.length);
        setText('sum-cost',      `₹${rData.totalTollCost}`);
    },

    // ═══════════════════════════════════════════════════════════════
    // TOLL ESTIMATION — corridor matching against route geometry
    // ═══════════════════════════════════════════════════════════════
    estimateTollsOnRoute: coords => {
        const tolls = [];
        const tollIds = new Set();
        let totalTollCost = 0;

        if (!window.TollSeedData || coords.length === 0) return { tolls, totalTollCost };

        const vehicleType    = document.getElementById('vehicle-type')?.value || 'LMV';
        const corridorKm     = (window.NHAI_CONFIG?.routing?.tollCorridorKm) || 1.5;
        const sampleStep     = Math.max(1, Math.floor(coords.length / 4000));

        TollSeedData.forEach(toll => {
            if (!toll.lat || !toll.lng || tollIds.has(toll.id)) return;
            
            for (let i = 0; i < coords.length; i += sampleStep) {
                const lng = coords[i][0], lat = coords[i][1];
                const dLat = (toll.lat - lat) * 111;
                const dLng = (toll.lng - lng) * 111 * Math.cos(lat * Math.PI / 180);
                const distSq = dLat*dLat + dLng*dLng;
                
                if (distSq < corridorKm * corridorKm) {
                    tollIds.add(toll.id);
                    
                    // Direct calculation instead of getTollById lookup for reliability
                    let cost = 0;
                    if (toll.tollRatesByVehicleClass && toll.tollRatesByVehicleClass[vehicleType] !== undefined) {
                        cost = toll.tollRatesByVehicleClass[vehicleType];
                    } else {
                        const base = toll.baseRate || 50;
                        const mult = TollData.categoryMultipliers[vehicleType] || 1.0;
                        cost = Math.floor(base * mult);
                    }
                    
                    if (IndiaMapPlanner.isSpecialVerified && vehicleType !== 'LMV') {
                        cost = 0;
                    }
                    
                    totalTollCost += cost;
                    tolls.push({ 
                        id: toll.id, 
                        name: toll.name || toll.tollName || 'NH Toll Plaza', 
                        cost: cost,
                        lat: toll.lat,
                        lng: toll.lng
                    });
                    break;
                }
            }
        });

        console.log(`[TollEngine] Matched ${tolls.length} tolls. Total Cost: ₹${totalTollCost}`);
        return { tolls, totalTollCost };
    },

    // ═══════════════════════════════════════════════════════════════
    // ON-ROUTE SERVICES — Overpass API sampling along route
    // ═══════════════════════════════════════════════════════════════
    fetchOnRouteServices: (coords, rData) => {
        if (!coords || coords.length < 2) return;
        const cfg         = (window.NHAI_CONFIG || {}).services || {};
        const sampleEvery = cfg.sampleEveryKm || 80;
        const radius      = (cfg.searchRadiusKm || 5) * 1000; // metres
        const categories  = cfg.categories || [];

        // Sample route points every ~80 km
        const totalPts  = coords.length;
        const totalDist = parseFloat(rData.totalDist || 100);
        const stepPts   = Math.max(1, Math.floor(totalPts * (sampleEvery / totalDist)));
        const samplePts = [];
        for (let i = 0; i < totalPts; i += stepPts) samplePts.push(coords[i]);
        // Always include midpoint
        const mid = coords[Math.floor(totalPts / 2)];
        samplePts.push(mid);

        const maxSamples = Math.min(samplePts.length, cfg.maxSamplesPerSearch || 6);
        const pts = samplePts.slice(0, maxSamples);

        // Build Overpass query
        const categoryQueries = categories.map(cat => {
            const parts = pts.map(p => `node["${cat.tags.split('=')[0]}"="${cat.tags.split('=')[1]}"](around:${radius},${p[1]},${p[0]});`);
            return parts.join('\n');
        });

        const query = `[out:json][timeout:25];(\n${categoryQueries.join('\n')}\n);out body 80;`;

        fetch(cfg.overpassUrl || 'https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: 'data=' + encodeURIComponent(query)
        })
        .then(r => r.json())
        .then(data => {
            IndiaMapPlanner._renderServiceMarkers(data.elements || [], categories);
        })
        .catch(() => {}); // Silent – services are bonus, not critical
    },

    _renderServiceMarkers: (elements, categories) => {
        IndiaMapPlanner._clearServiceMarkers();

        const catMap = {};
        categories.forEach(c => {
            const key = `${c.tags.split('=')[0]}=${c.tags.split('=')[1]}`;
            catMap[key] = c;
        });

        const seen = new Set();
        elements.forEach(el => {
            if (!el.lat || !el.lon) return;
            const name = el.tags?.name || el.tags?.['name:en'] || '';
            if (!name) return;
            const uid = `${Math.round(el.lat*1000)},${Math.round(el.lon*1000)}`;
            if (seen.has(uid)) return;
            seen.add(uid);

            // Find category
            let cat = null;
            categories.forEach(c => {
                const [k,v] = c.tags.split('=');
                if (el.tags?.[k] === v) cat = c;
            });
            if (!cat) return;

            const serviceIcon = L.divIcon({
                className: '',
                html: `<div style="background:rgba(5,18,38,0.92);border:1px solid rgba(255,255,255,0.2);border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.5);">${cat.icon}</div>`,
                iconSize: [26,26], iconAnchor: [13,13]
            });

            try {
                const m = L.marker([el.lat, el.lon], { icon: serviceIcon, zIndexOffset: -10 })
                    .bindPopup(`<div style="font-family:'Inter',sans-serif;padding:4px;min-width:140px;">
                        <div style="font-weight:700;font-size:12px;color:#0a192f;">${cat.icon} ${name}</div>
                        <div style="font-size:10px;color:#555;">Category: ${cat.label}</div>
                    </div>`)
                    .addTo(IndiaMapPlanner.map);
                IndiaMapPlanner.serviceMarkers.push(m);
            } catch(e) {}
        });
    },

    _clearServiceMarkers: () => {
        IndiaMapPlanner.serviceMarkers.forEach(m => { try { m.remove(); } catch(e){} });
        IndiaMapPlanner.serviceMarkers = [];
    },

    // ═══════════════════════════════════════════════════════════════
    // LIVE TRIP
    // ═══════════════════════════════════════════════════════════════
    startLiveTrip: () => {
        if (!IndiaMapPlanner.selectedRouteData) { Utils.showToast('Calculate a route first.', 'error'); return; }
        if (!IndiaMapPlanner.routeCoordinates.length) { Utils.showToast('No route geometry available.', 'error'); return; }

        IndiaMapPlanner.isTripLive    = true;
        IndiaMapPlanner.chargedTollIds = new Set();
        IndiaMapPlanner.tripTollsPassed = [];
        IndiaMapPlanner.tripTotalCost  = 0;

        const tripId = Utils.generateId('TRIP');
        IndiaMapPlanner.currentTripId = tripId;
        const vType = document.getElementById('vehicle-type')?.value || 'LMV';

        Storage.logTripStart({ id: tripId, origin: IndiaMapPlanner.selectedRouteData.originName, dest: IndiaMapPlanner.selectedRouteData.destName, vehicleType: vType, isSpecial: IndiaMapPlanner.isSpecialVerified, timestamp: new Date().toISOString() });

        Utils.toggleVisibility('btn-start-trip', false);
        Utils.toggleVisibility('btn-end-trip',   true);

        const badge = document.getElementById('trip-badge');
        if (badge) { badge.innerText = 'LIVE TRIP'; badge.style.background = 'var(--accent-red)'; badge.style.color = '#fff'; }

        // Initialize Car Marker
        if (IndiaMapPlanner.carMarker) { try { IndiaMapPlanner.carMarker.remove(); } catch(e){} }
        const carIcon = L.divIcon({
            className: '',
            html: "<div class='car-marker' style='background:#ef4444;width:20px;height:20px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 15px rgba(239,68,68,0.8);position:relative;'><div style='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:4px;height:4px;background:#fff;border-radius:50%;'></div></div>",
            iconSize: [20,20], iconAnchor: [10,10]
        });
        const start = IndiaMapPlanner.routeCoordinates[0];
        IndiaMapPlanner.carMarker = L.marker([start[1], start[0]], { icon: carIcon, zIndexOffset: 1000 })
            .bindTooltip('🚗 My Vehicle', { permanent: false, direction: 'top' })
            .addTo(IndiaMapPlanner.map);

        // Initialize Trail
        if (IndiaMapPlanner.trailPolyline) IndiaMapPlanner.trailPolyline.remove();
        IndiaMapPlanner.trailPolyline = L.polyline([], { color: '#ef4444', weight: 4, opacity: 0.6, dashArray: '5, 10' }).addTo(IndiaMapPlanner.map);

        let step = 0;
        const coords = IndiaMapPlanner.routeCoordinates;
        
        // Simulation logic: Use a fixed number of steps but with a more reasonable density
        // For a 500km trip, let's say 200 steps (2.5km per step)
        const totalDist = parseFloat(IndiaMapPlanner.selectedRouteData.totalDist);
        const jump = Math.max(1, Math.floor(coords.length / (totalDist > 100 ? 200 : 100)));

        Utils.showToast('Live Trip started! FASTag deductions active.', 'success');

        IndiaMapPlanner.tripInterval = setInterval(() => {
            if (step >= coords.length) {
                IndiaMapPlanner.endLiveTrip();
                Utils.showToast('Destination Reached! 🎉', 'success');
                return;
            }
            
            const pt = coords[step];
            IndiaMapPlanner.updateTripPosition(pt[1], pt[0]);
            
            step += jump;
            if (step >= coords.length && step - jump < coords.length - 1) step = coords.length - 1; 
        }, 600);
    },

    toggleGpsMode: () => {
        if (IndiaMapPlanner.gpsWatchId) {
            IndiaMapPlanner.stopRealGps();
            Utils.showToast('Switched to Simulation Mode', 'info');
        } else {
            IndiaMapPlanner.startRealGps();
        }
    },

    startRealGps: () => {
        if (!navigator.geolocation) {
            Utils.showToast('Geolocation not supported by your browser', 'error');
            return;
        }

        Utils.showToast('Requesting GPS access...', 'info');

        IndiaMapPlanner.gpsWatchId = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                if (!IndiaMapPlanner.isTripLive) {
                    // Pre-trip GPS lock
                    if (!IndiaMapPlanner.carMarker) {
                        const carIcon = L.divIcon({
                            className: '',
                            html: "<div style='background:#3b82f6;width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 12px #3b82f6'></div>",
                            iconSize: [18,18], iconAnchor: [9,9]
                        });
                        IndiaMapPlanner.carMarker = L.marker([latitude, longitude], { icon: carIcon }).addTo(IndiaMapPlanner.map);
                    }
                    IndiaMapPlanner.carMarker.setLatLng([latitude, longitude]);
                    IndiaMapPlanner.map.setView([latitude, longitude], 15);
                } else {
                    IndiaMapPlanner.updateTripPosition(latitude, longitude);
                }
                
                document.getElementById('btn-gps-mode').style.color = 'var(--primary)';
                document.getElementById('btn-gps-mode').classList.add('active');
            },
            (err) => {
                console.error("GPS Error:", err);
                Utils.showToast('GPS Access Denied or Error', 'error');
                IndiaMapPlanner.stopRealGps();
            },
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
    },

    stopRealGps: () => {
        if (IndiaMapPlanner.gpsWatchId) {
            navigator.geolocation.clearWatch(IndiaMapPlanner.gpsWatchId);
            IndiaMapPlanner.gpsWatchId = null;
        }
        const btn = document.getElementById('btn-gps-mode');
        if (btn) {
            btn.style.color = 'var(--accent-yellow)';
            btn.classList.remove('active');
        }
    },

    updateTripPosition: (lat, lng) => {
        IndiaMapPlanner.currentLiveLat = lat;
        IndiaMapPlanner.currentLiveLng = lng;

        if (!IndiaMapPlanner.carMarker) return;
        
        const newPos = [lat, lng];
        IndiaMapPlanner.carMarker.setLatLng(newPos);
        
        if (IndiaMapPlanner.trailPolyline) {
            IndiaMapPlanner.trailPolyline.addLatLng(newPos);
        }

        if (IndiaMapPlanner.isFollowing) {
            IndiaMapPlanner.map.panTo(newPos, { animate: true, duration: 0.5 });
        }

        // ADD THIS LINE — broadcast live position to server
        if (IndiaMapPlanner.currentTripId && window.RealtimeService) {
            RealtimeService.updatePosition(IndiaMapPlanner.currentTripId, lat, lng);
        }

        // Also update notifications with current position every few seconds
        // (don't call on every frame — only every ~5 seconds to avoid spam)
        if (!IndiaMapPlanner._lastNotifUpdate || Date.now() - IndiaMapPlanner._lastNotifUpdate > 5000) {
            IndiaMapPlanner._lastNotifUpdate = Date.now();
            if (window.Notifications) Notifications.updateAdvisory();
        }

        const dest = IndiaMapPlanner.selectedDest;
        if (dest) {
            const dLat = (dest.lat - lat) * 111;
            const dLng = (dest.lng - lng) * 111 * Math.cos(lat * Math.PI / 180);
            if (Math.sqrt(dLat*dLat + dLng*dLng) < 0.05) {
                IndiaMapPlanner.endLiveTrip();
                Utils.showToast('Destination Reached! 🎉', 'success');
                return;
            }
        }

        IndiaMapPlanner.checkTollGeofence(lat, lng);
    },

    endLiveTrip: () => {
        if (IndiaMapPlanner.tripInterval) clearInterval(IndiaMapPlanner.tripInterval);
        IndiaMapPlanner.stopRealGps();
        
        if (IndiaMapPlanner.currentTripId && IndiaMapPlanner.isTripLive) {
            const dist = IndiaMapPlanner.selectedRouteData?.totalDist || 0;
            const tripData = {
                id: IndiaMapPlanner.currentTripId,
                origin: IndiaMapPlanner.selectedRouteData?.originName,
                dest: IndiaMapPlanner.selectedRouteData?.destName,
                tolls: IndiaMapPlanner.tripTollsPassed,
                cost: IndiaMapPlanner.tripTotalCost,
                distance: dist
            };
            
            Storage.logTripEnd(IndiaMapPlanner.currentTripId, IndiaMapPlanner.tripTollsPassed, IndiaMapPlanner.tripTotalCost, dist);
            
            if (window.EmailAlerts) EmailAlerts.sendTripEmail(tripData);
            if (window.TripAnalytics) TripAnalytics.init();
            
            IndiaMapPlanner.currentTripId = null;
        }
        
        IndiaMapPlanner.isTripLive = false;
        Utils.toggleVisibility('btn-start-trip', true);
        Utils.toggleVisibility('btn-end-trip',   false);
        
        if (IndiaMapPlanner.carMarker) { try { IndiaMapPlanner.carMarker.remove(); } catch(e){} IndiaMapPlanner.carMarker = null; }
        if (IndiaMapPlanner.trailPolyline) { try { IndiaMapPlanner.trailPolyline.remove(); } catch(e){} IndiaMapPlanner.trailPolyline = null; }
        
        const badge = document.getElementById('trip-badge');
        if (badge) { badge.innerText = 'PREVIEW MODE'; badge.style.background = 'rgba(255,255,255,0.12)'; badge.style.color = 'var(--text-sec)'; }
    },

    checkTollGeofence: (lat, lng) => {
        if (!window.TollSeedData) return;
        if (!document.getElementById('pref-fastag')?.checked) return;
        
        const vehicleType = document.getElementById('vehicle-type')?.value || 'LMV';
        
        TollSeedData.forEach(toll => {
            if (IndiaMapPlanner.chargedTollIds.has(toll.id)) return;
            const dLat = (toll.lat - lat) * 111;
            const dLng = (toll.lng - lng) * 111 * Math.cos(lat * Math.PI / 180);
            if (Math.sqrt(dLat*dLat + dLng*dLng) < 1.0) {
                IndiaMapPlanner.chargedTollIds.add(toll.id);
                let cost = TollData.getTollCost(toll.id, vehicleType);
                if (IndiaMapPlanner.isSpecialVerified) cost = 0;
                if (cost > 0) {
                    // Trigger Alerts
                    if (window.PushNotifications) PushNotifications.notifyTollAhead(toll.name);
                    const userPhone = Storage.get('nhai_user_profile', { phone: '9876543210' }).phone;
                    if (window.SMSAlerts) SMSAlerts.alertTollAhead(userPhone, toll.name);

                    const success = FastagEngine.deductSummaryToll(cost, `Toll: ${toll.name}`);
                    if (success) {
                        IndiaMapPlanner.tripTollsPassed.push(toll.name);
                        IndiaMapPlanner.tripTotalCost += cost;
                        if (IndiaMapPlanner.currentTripId) Storage.logTollPassage(IndiaMapPlanner.currentTripId, toll.name, cost);
                    }
                }
            }
        });
    },

    // ═══════════════════════════════════════════════════════════════
    // BACKGROUND TOLL MARKERS (all plazas when zoomed in)
    // ═══════════════════════════════════════════════════════════════
    renderTollMarkers: () => {
        if (!window.TollSeedData || !IndiaMapPlanner.map) return;
        IndiaMapPlanner.clearTollMarkers();
        const zoom = IndiaMapPlanner.map.getZoom();
        if (zoom < 7) { IndiaMapPlanner.tollMarkersVisible = false; return; }
        IndiaMapPlanner.tollMarkersVisible = true;

        let bounds = null;
        try { bounds = IndiaMapPlanner.map.getBounds(); } catch(e) {}
        let rendered = 0;
        const tollStates = Storage.get(Storage.KEYS.TOLL_STATES, {});

        TollSeedData.forEach(toll => {
            if (rendered >= 120 || !toll.lat || !toll.lng) return;
            if (bounds) {
                try {
                    const ne = bounds.getNorthEast(), sw = bounds.getSouthWest();
                    if (toll.lat < sw.lat || toll.lat > ne.lat || toll.lng < sw.lng || toll.lng > ne.lng) return;
                } catch(e) {}
            }
            const congestion  = tollStates[toll.id]?.congestion || 'NORMAL';
            const congColors  = { NORMAL:'#00e5b3', MODERATE:'#fbbf24', HIGH:'#ff4d6d' };
            const cc          = congColors[congestion] || '#00e5b3';
            const icon        = L.divIcon({
                className: '',
                html: `<div style='background:${cc};width:10px;height:10px;border-radius:50%;border:1.5px solid #020c18;box-shadow:0 0 6px ${cc};'></div>`,
                iconSize: [10,10], iconAnchor: [5,5]
            });
            try {
                const m = L.marker([toll.lat, toll.lng], { icon })
                    .bindPopup(IndiaMapPlanner._tollPopup(toll, toll.baseRate || 50))
                    .addTo(IndiaMapPlanner.map);
                IndiaMapPlanner.tollMarkers.push(m);
                rendered++;
            } catch(e) {}
        });
    },

    clearTollMarkers: () => {
        IndiaMapPlanner.tollMarkers.forEach(m => { try { m.remove(); } catch(e){} });
        IndiaMapPlanner.tollMarkers = [];
    },

    updateTollMarkerVisibility: () => {
        const zoom = IndiaMapPlanner.map.getZoom();
        if (zoom >= 7) {
            IndiaMapPlanner.renderTollMarkers();
        } else if (IndiaMapPlanner.tollMarkersVisible) {
            IndiaMapPlanner.clearTollMarkers();
            IndiaMapPlanner.tollMarkersVisible = false;
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // ADMINISTRATIVE BOUNDARIES (GeoJSON)
    // ═══════════════════════════════════════════════════════════════
    loadBoundaries: async () => {
        const stateUrl = 'https://raw.githubusercontent.com/india-in-data/india-states-2019/master/india_states.geojson';
        // Remove district loading entirely — it is too large for smooth performance
        try {
            const sRes = await fetch(stateUrl);
            const sData = await sRes.json();
            IndiaMapPlanner._stateLayer = L.geoJSON(sData, {
                style: { color: '#ffffff', weight: 1, opacity: 0.4, fillOpacity: 0 },
                onEachFeature: (feature, layer) => {
                    const name = feature.properties.NAME || feature.properties.ST_NM || "State";
                    layer.bindTooltip(name, { sticky: true, className: 'boundary-tooltip' });
                }
            }).addTo(IndiaMapPlanner.map);
        } catch(e) {
            console.warn("State boundaries load failed", e);
        }
        // _districtLayer stays null — no district rendering
    },

    updateBoundaryVisibility: () => {
        if (!IndiaMapPlanner._showBoundaries) {
            if (IndiaMapPlanner._stateLayer) IndiaMapPlanner._stateLayer.remove();
            // _districtLayer check removed
            return;
        }

        const zoom = IndiaMapPlanner.map.getZoom();
        
        if (IndiaMapPlanner._stateLayer) IndiaMapPlanner._stateLayer.addTo(IndiaMapPlanner.map);
        // _districtLayer check removed
    },

    // ═══════════════════════════════════════════════════════════════
    // LAYER TOGGLE BUTTON (bottom-left of map)
    // ═══════════════════════════════════════════════════════════════
    _addLayerToggle: () => {
        const container = document.createElement('div');
        container.id = 'map-layer-controls';
        Object.assign(container.style, {
            position: 'absolute', bottom: '30px', left: '20px', zIndex: '700',
            display: 'flex', flexDirection: 'column', gap: '8px'
        });

        // 1. Street/Satellite Toggle
        const btnView = document.createElement('button');
        btnView.className = 'layer-control-btn';
        btnView.innerHTML = '<i class="fa-solid fa-satellite"></i> <span>Street View</span>';
        
        // 2. Boundaries Toggle
        const btnBounds = document.createElement('button');
        btnBounds.className = 'layer-control-btn';
        btnBounds.innerHTML = '<i class="fa-solid fa-border-all"></i> <span>Hide Boundaries</span>';

        const styleBtn = (b) => {
            Object.assign(b.style, {
                background: 'var(--bg-panel)', backdropFilter: 'var(--glass)',
                border: '1px solid var(--border)', color: 'var(--primary)',
                fontFamily: 'var(--font-main)', fontSize: '11px', fontWeight: '600',
                padding: '10px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'var(--transition)', boxShadow: 'var(--shadow)',
                minWidth: '140px', justifyContent: 'center'
            });
            b.addEventListener('mouseenter', () => { b.style.background = 'var(--primary-dim)'; b.style.borderColor = 'var(--primary)'; });
            b.addEventListener('mouseleave', () => { b.style.background = 'var(--bg-panel)'; b.style.borderColor = 'var(--border)'; });
        };

        styleBtn(btnView);
        styleBtn(btnBounds);

        btnView.addEventListener('click', () => {
            IndiaMapPlanner._isSatellite = !IndiaMapPlanner._isSatellite;
            document.body.classList.toggle('street-mode-active', !IndiaMapPlanner._isSatellite);
            
            if (IndiaMapPlanner._isSatellite) {
                IndiaMapPlanner._streetLayer.remove();
                IndiaMapPlanner._satelliteLayer.addTo(IndiaMapPlanner.map);
                IndiaMapPlanner._labelsLayer.addTo(IndiaMapPlanner.map);
                btnView.innerHTML = '<i class="fa-solid fa-satellite"></i> <span>Street View</span>';
            } else {
                IndiaMapPlanner._satelliteLayer.remove();
                IndiaMapPlanner._labelsLayer.remove();
                IndiaMapPlanner._streetLayer.addTo(IndiaMapPlanner.map);
                btnView.innerHTML = '<i class="fa-solid fa-map"></i> <span>Satellite</span>';
            }
        });


        btnBounds.addEventListener('click', () => {
            IndiaMapPlanner._showBoundaries = !IndiaMapPlanner._showBoundaries;
            IndiaMapPlanner.updateBoundaryVisibility();
            btnBounds.innerHTML = IndiaMapPlanner._showBoundaries ? 
                '<i class="fa-solid fa-border-all"></i> <span>Hide Boundaries</span>' :
                '<i class="fa-solid fa-border-none"></i> <span>Show Boundaries</span>';
        });

        container.appendChild(btnBounds);
        container.appendChild(btnView);
        
        const mapEl = document.getElementById('map');
        if (mapEl) mapEl.appendChild(container);
    },

    // ═══════════════════════════════════════════════════════════════
    // TOLL EXPLORER / AREA SCANNER
    // ═══════════════════════════════════════════════════════════════
    toggleSelectionMode: () => {
        IndiaMapPlanner.isSelectionMode = !IndiaMapPlanner.isSelectionMode;
        
        const btn = document.getElementById('btn-toll-explorer-toggle');
        const app = document.getElementById('user-app');
        
        if (IndiaMapPlanner.isSelectionMode) {
            if (btn) {
                btn.classList.add('active');
                btn.innerHTML = '<i class="fa-solid fa-xmark"></i> Disable Selection Mode';
            }
            app.classList.add('selection-mode-active');
            IndiaMapPlanner.map.dragging.disable();
            Utils.showToast('Selection Mode Active: Drag on map to scan road tolls.', 'info');
            Utils.toggleVisibility('explorer-idle-msg', false);
        } else {
            IndiaMapPlanner.closeTollExplorer();
        }
    },

    closeTollExplorer: () => {
        IndiaMapPlanner.isSelectionMode = false;
        const btn = document.getElementById('btn-toll-explorer-toggle');
        const app = document.getElementById('user-app');
        
        if (btn) {
            btn.classList.remove('active');
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Enable Selection Mode';
        }
        if (app) app.classList.remove('selection-mode-active');
        
        IndiaMapPlanner.map.dragging.enable();
        Utils.toggleVisibility('explorer-results-sidebar', false);
        Utils.toggleVisibility('explorer-idle-msg', true);
        
        // Clear visuals
        if (IndiaMapPlanner.selectionLayer) IndiaMapPlanner.selectionLayer.remove();
        IndiaMapPlanner.selectionMarkers.forEach(m => m.remove());
        IndiaMapPlanner.selectionMarkers = [];
        IndiaMapPlanner.selectionStart = null;
        IndiaMapPlanner.selectionEnd = null;
    },

    _onMapMouseDown: e => {
        if (!IndiaMapPlanner.isSelectionMode) return;
        
        IndiaMapPlanner.selectionStart = e.latlng;
        IndiaMapPlanner.selectionEnd = e.latlng;
        
        // Clear previous
        if (IndiaMapPlanner.selectionLayer) IndiaMapPlanner.selectionLayer.remove();
        IndiaMapPlanner.selectionMarkers.forEach(m => m.remove());
        IndiaMapPlanner.selectionMarkers = [];
        
        const startIcon = L.divIcon({
            className: '',
            html: '<div style="background:var(--primary);width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 10px var(--primary-glow)"></div>',
            iconSize: [12,12], iconAnchor: [6,6]
        });
        const m = L.marker(e.latlng, { icon: startIcon }).addTo(IndiaMapPlanner.map);
        IndiaMapPlanner.selectionMarkers.push(m);
        
        IndiaMapPlanner._updateSelectionVisuals();
    },

    _onMapMouseMove: e => {
        if (!IndiaMapPlanner.isSelectionMode || !IndiaMapPlanner.selectionStart) return;
        
        IndiaMapPlanner.selectionEnd = e.latlng;
        IndiaMapPlanner._updateSelectionVisuals();
    },

    _onMapMouseUp: e => {
        if (!IndiaMapPlanner.isSelectionMode || !IndiaMapPlanner.selectionStart) return;
        
        IndiaMapPlanner.selectionEnd = e.latlng;
        
        const dist = IndiaMapPlanner.selectionStart.distanceTo(IndiaMapPlanner.selectionEnd);
        if (dist > 1000) { // minimum 1km drag
            IndiaMapPlanner._calculateRoadTolls(IndiaMapPlanner.selectionStart, IndiaMapPlanner.selectionEnd);
        }
        
        IndiaMapPlanner.selectionStart = null; // stop tracking move
    },

    _updateSelectionVisuals: () => {
        if (IndiaMapPlanner.selectionLayer) IndiaMapPlanner.selectionLayer.remove();
        if (!IndiaMapPlanner.selectionStart || !IndiaMapPlanner.selectionEnd) return;
        
        const points = [IndiaMapPlanner.selectionStart, IndiaMapPlanner.selectionEnd];
        IndiaMapPlanner.selectionLayer = L.layerGroup([
            L.polyline(points, { 
                color: 'var(--primary)', weight: 40, opacity: 0.1, lineCap: 'round', className: 'selection-line-glow' 
            }),
            L.polyline(points, { 
                color: 'var(--primary)', weight: 2, opacity: 0.8, dashArray: '5, 10' 
            })
        ]).addTo(IndiaMapPlanner.map);
    },


    _calculateRoadTolls: (start, end) => {
        Utils.showToast('Fetching road path...', 'info');
        
        // Fetch OSRM route for the selection to get REAL roads
        const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
        
        fetch(url)
            .then(r => r.json())
            .then(data => {
                if (data.code !== 'Ok' || !data.routes?.length) {
                    Utils.showToast('Could not find road path. Using straight line fallback.', 'warning');
                    IndiaMapPlanner._calculateTollsInSelection(start, end); // Fallback
                    return;
                }
                
                const route = data.routes[0];
                const coords = route.geometry.coordinates; // [[lng, lat], ...]
                
                // Show road path visually
                if (IndiaMapPlanner.selectionLayer) IndiaMapPlanner.selectionLayer.remove();
                
                const latLngs = coords.map(c => [c[1], c[0]]);
                IndiaMapPlanner.selectionLayer = L.polyline(latLngs, {
                    color: 'var(--primary)',
                    weight: 6,
                    opacity: 0.8,
                    dashArray: '10, 10',
                    className: 'selection-road-path'
                }).addTo(IndiaMapPlanner.map);
                
                // Calculate tolls along this path
                const rData = IndiaMapPlanner.estimateTollsOnRoute(coords);
                
                // Update Sidebar UI
                Utils.toggleVisibility('explorer-idle-msg', false);
                Utils.toggleVisibility('explorer-results-sidebar', true);
                
                const countEl = document.getElementById('explorer-toll-count-tab');
                const costEl = document.getElementById('explorer-toll-cost-tab');
                const infoEl = document.getElementById('explorer-path-info');
                
                if (countEl) countEl.innerText = rData.tolls.length;
                if (costEl) costEl.innerText = `₹${rData.totalTollCost}`;
                if (infoEl) infoEl.innerText = `${(route.distance/1000).toFixed(1)} km road path analyzed.`;
                
                Utils.showToast(`Scan Complete: ${rData.tolls.length} tolls found on road.`, 'success');
            })
            .catch(() => {
                IndiaMapPlanner._calculateTollsInSelection(start, end);
            });
    },

    _calculateTollsInSelection: (start, end) => {
        // Fallback straight-line calculation if OSRM fails
        if (!window.TollSeedData) return;
        
        let count = 0;
        let totalCost = 0;
        const vType = document.getElementById('vehicle-type')?.value || 'LMV';
        const bufferKm = 5;
        
        TollSeedData.forEach(toll => {
            if (!toll.lat || !toll.lng) return;
            const tollLatLng = L.latLng(toll.lat, toll.lng);
            const distToLine = IndiaMapPlanner._distToSegment(tollLatLng, start, end);
            
            if (distToLine < bufferKm) {
                count++;
                let cost = 0;
                if (toll.tollRatesByVehicleClass && toll.tollRatesByVehicleClass[vType] !== undefined) {
                    cost = toll.tollRatesByVehicleClass[vType];
                } else {
                    const base = toll.baseRate || 50;
                    const mult = window.TollData?.categoryMultipliers?.[vType] || 1.0;
                    cost = Math.floor(base * mult);
                }
                totalCost += cost;
            }
        });
        
        Utils.toggleVisibility('explorer-idle-msg', false);
        Utils.toggleVisibility('explorer-results-sidebar', true);
        
        const countEl = document.getElementById('explorer-toll-count-tab');
        const costEl = document.getElementById('explorer-toll-cost-tab');
        if (countEl) countEl.innerText = count;
        if (costEl) costEl.innerText = `₹${totalCost}`;
    },

    // Helper: Distance from point P to segment AB in km
    _distToSegment: (p, a, b) => {
        const distToA = p.distanceTo(a) / 1000;
        const distToB = p.distanceTo(b) / 1000;
        const lineLen = a.distanceTo(b) / 1000;
        
        if (lineLen === 0) return distToA;
        
        // Project point onto line
        const t = ((p.lat - a.lat) * (b.lat - a.lat) + (p.lng - a.lng) * (b.lng - a.lng)) / 
                  (Math.pow(b.lat - a.lat, 2) + Math.pow(b.lng - a.lng, 2));
        
        if (t < 0) return distToA;
        if (t > 1) return distToB;
        
        const projection = L.latLng(
            a.lat + t * (b.lat - a.lat),
            a.lng + t * (b.lng - a.lng)
        );
        
        return p.distanceTo(projection) / 1000;
    },

    routeAndAvoidTolls: () => {
        if (IndiaMapPlanner.selectionMarkers.length === 0 || !IndiaMapPlanner.selectionEnd) {
            Utils.showToast('Please drag a selection on the map first.', 'error');
            return;
        }
        
        const start = IndiaMapPlanner.selectionMarkers[0].getLatLng();
        const end = IndiaMapPlanner.selectionEnd;
        
        // Set inputs to coordinates (since we don't have names)
        IndiaMapPlanner.selectedOrigin = { name: 'Selected Start', lat: start.lat, lng: start.lng };
        IndiaMapPlanner.selectedDest = { name: 'Selected End', lat: end.lat, lng: end.lng };
        
        const origInput = document.getElementById('route-origin-input');
        const destInput = document.getElementById('route-dest-input');
        if (origInput) origInput.value = `${start.lat.toFixed(4)}, ${start.lng.toFixed(4)}`;
        if (destInput) destInput.value = `${end.lat.toFixed(4)}, ${end.lng.toFixed(4)}`;
        
        // Force 'Avoid Tolls' checkbox
        const avoidCheck = document.getElementById('pref-avoid-tolls');
        if (avoidCheck) avoidCheck.checked = true;
        
        IndiaMapPlanner.closeTollExplorer();
        IndiaMapPlanner.processRoute();
    }
};

window.IndiaMapPlanner = IndiaMapPlanner;

