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
    _isSatellite: false,
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
        window.addEventListener('offline', () => Utils.showToast('You are offline. Routing requires internet.', 'warning'));
        window.addEventListener('online',  () => Utils.showToast('Connection restored.', 'success'));

        const cfg = window.NHAI_CONFIG || { map: { defaultCenter: [20.5937, 78.9629], defaultZoom: 5 } };

        // Create Leaflet map
        IndiaMapPlanner.map = L.map('map', {
            zoomControl: false,
            attributionControl: false,
            center: cfg.map.defaultCenter,
            zoom: cfg.map.defaultZoom,
            worldCopyJump: true
        });

        // ── Tile layers ────────────────────────────────────────────
        const tileCfg = cfg.tiles || {};
        const satUrl = (tileCfg.satellite || {}).url || 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
        const satOpts = (tileCfg.satellite || {}).options || { maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], attribution: 'Tiles &copy; Google' };
        IndiaMapPlanner._satelliteLayer = L.tileLayer(satUrl, satOpts);

        const labelsUrl = (tileCfg.labels || {}).url || 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png';
        const labelsOpts = (tileCfg.labels || {}).options || { maxZoom: 19, pane: 'shadowPane', opacity: 0.8 };
        IndiaMapPlanner._labelsLayer = L.tileLayer(labelsUrl, labelsOpts);

        const streetUrl = (tileCfg.street || {}).url || 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        const streetOpts = (tileCfg.street || {}).options || { maxZoom: 20, subdomains: ['a', 'b', 'c', 'd'], attribution: '&copy; OSM &copy; CARTO' };
        IndiaMapPlanner._streetLayer = L.tileLayer(streetUrl, streetOpts);

        // Default: satellite & labels layer
        IndiaMapPlanner._satelliteLayer.addTo(IndiaMapPlanner.map);
        IndiaMapPlanner._labelsLayer.addTo(IndiaMapPlanner.map);
        IndiaMapPlanner._isSatellite = true;

        window.NHAI_MAP = IndiaMapPlanner.map;
        
        window.addEventListener('resize', () => {
            if (IndiaMapPlanner.map) {
                IndiaMapPlanner.map.invalidateSize();
            }
        });

        setTimeout(() => {
            if (IndiaMapPlanner.map) IndiaMapPlanner.map.invalidateSize();
        }, 200);

        // Fly to center on open
        setTimeout(() => {
            if (IndiaMapPlanner.map) {
                IndiaMapPlanner.map.flyTo(cfg.map.defaultCenter, 5, { animate: true, duration: 1.5 });
            }
        }, 400);


        // ── Sidebar toggle (handled via inline onclick in HTML now) ─────────────────────────────────────────

        // ── Autocomplete ───────────────────────────────────────────
        IndiaMapPlanner.setupAutocomplete('route-origin-input', 'origin-suggestions', city => {
            if (city.lat === 0 && city.lng === 0) {
                IndiaMapPlanner._geocodeVillage(city, (res) => {
                    IndiaMapPlanner.selectedOrigin = res;
                    IndiaMapPlanner.setOriginMarker(res);
                    IndiaMapPlanner.showWeatherPopup('origin', res.name, res.lat, res.lng);
                });
            } else {
                IndiaMapPlanner.selectedOrigin = city;
                IndiaMapPlanner.setOriginMarker(city);
                IndiaMapPlanner.showWeatherPopup('origin', city.name, city.lat, city.lng);
            }
        });
        IndiaMapPlanner.setupAutocomplete('route-dest-input', 'dest-suggestions', city => {
            if (city.lat === 0 && city.lng === 0) {
                IndiaMapPlanner._geocodeVillage(city, (res) => {
                    IndiaMapPlanner.selectedDest = res;
                    IndiaMapPlanner.setDestMarker(res);
                    IndiaMapPlanner.showWeatherPopup('destination', res.name, res.lat, res.lng);
                });
            } else {
                IndiaMapPlanner.selectedDest = city;
                IndiaMapPlanner.setDestMarker(city);
                IndiaMapPlanner.showWeatherPopup('destination', city.name, city.lat, city.lng);
            }
        });

        // ── Button bindings ────────────────────────────────────────
        const safe = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };

        safe('btn-locate-me', () => {
            if (IndiaMapPlanner.locateUser) {
                IndiaMapPlanner.locateUser();
            }
        });

        safe('btn-calc-route', () => {
            IndiaMapPlanner.processRoute();
        });
        safe('btn-swap-locations', () => {
            const oInput = document.getElementById('route-origin-input');
            const dInput = document.getElementById('route-dest-input');
            if (oInput && dInput) {
                const tempVal = oInput.value;
                oInput.value = dInput.value;
                dInput.value = tempVal;

                const tempObj = IndiaMapPlanner.selectedOrigin;
                IndiaMapPlanner.selectedOrigin = IndiaMapPlanner.selectedDest;
                IndiaMapPlanner.selectedDest = tempObj;

                Utils.showToast("Origin and Destination swapped! 🔄", "info");
            }
        });
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

        // Vehicle type → special box & dynamic route recalculation
        const vSel = document.getElementById('vehicle-type');
        const rVSel = document.getElementById('route-vehicle-selector');

        const onVehicleChanged = (newVal) => {
            if (vSel && vSel.value !== newVal) vSel.value = newVal;
            if (rVSel && rVSel.value !== newVal) rVSel.value = newVal;

            const isSpecial = ['GOVT','PRESS','ARMY','AMBULANCE','FIRE','POLICE'].includes(newVal);
            Utils.toggleVisibility('special-vehicle-box', isSpecial);
            IndiaMapPlanner.isSpecialVerified = false;

            // Dynamically recompute route toll cost for the new vehicle class
            if (IndiaMapPlanner.selectedRouteData && IndiaMapPlanner.routeCoordinates.length > 0) {
                const tollEstimate = IndiaMapPlanner.estimateTollsOnRoute(IndiaMapPlanner.routeCoordinates);
                IndiaMapPlanner.selectedRouteData.tolls = tollEstimate.tolls;
                IndiaMapPlanner.selectedRouteData.totalTollCost = tollEstimate.totalTollCost;
                IndiaMapPlanner.updateSummary(IndiaMapPlanner.selectedRouteData);
                Utils.showToast(`NHAI toll updated for ${newVal}: ₹${tollEstimate.totalTollCost}`, 'info');
            }
        };

        if (vSel) vSel.addEventListener('change', e => onVehicleChanged(e.target.value));
        if (rVSel) rVSel.addEventListener('change', e => onVehicleChanged(e.target.value));

        IndiaMapPlanner.journeyType = 'SINGLE';
        const btnSingle = document.getElementById('btn-trip-single');
        const btnReturn = document.getElementById('btn-trip-return');
        
        const setJourneyType = (type) => {
            IndiaMapPlanner.journeyType = type;
            if (btnSingle && btnReturn) {
                if (type === 'SINGLE') {
                    btnSingle.classList.add('active');
                    btnSingle.style.background = 'var(--primary)';
                    btnSingle.style.color = '#021a12';
                    btnReturn.classList.remove('active');
                    btnReturn.style.background = 'transparent';
                    btnReturn.style.color = '#94a3b8';
                } else {
                    btnReturn.classList.add('active');
                    btnReturn.style.background = '#34d399';
                    btnReturn.style.color = '#021a12';
                    btnSingle.classList.remove('active');
                    btnSingle.style.background = 'transparent';
                    btnSingle.style.color = '#94a3b8';
                }
            }
            if (IndiaMapPlanner.selectedRouteData && IndiaMapPlanner.routeCoordinates.length > 0) {
                const tollEstimate = IndiaMapPlanner.estimateTollsOnRoute(IndiaMapPlanner.routeCoordinates);
                IndiaMapPlanner.selectedRouteData.tolls = tollEstimate.tolls;
                IndiaMapPlanner.selectedRouteData.totalTollCost = tollEstimate.totalTollCost;
                IndiaMapPlanner.updateSummary(IndiaMapPlanner.selectedRouteData);
                Utils.showToast(`Trip mode: ${type === 'SINGLE' ? '1-Way Single' : '2-Way Return (24h)'} • Toll: ₹${tollEstimate.totalTollCost}`, 'info');
            }
        };

        if (btnSingle) btnSingle.addEventListener('click', () => setJourneyType('SINGLE'));
        if (btnReturn) btnReturn.addEventListener('click', () => setJourneyType('RETURN'));

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

        // Fetch active news updates
        IndiaMapPlanner.fetchLiveNewsAlerts();
    },

    askForLocationPermission: () => {
        const modal = document.getElementById('location-permission-modal');
        if (!modal) return;

        Utils.toggleVisibility('location-permission-modal', true);

        // Add event listeners
        const allowBtn = document.getElementById('btn-allow-loc');
        const denyBtn = document.getElementById('btn-deny-loc');

        if (allowBtn) {
            allowBtn.onclick = () => {
                Utils.toggleVisibility('location-permission-modal', false);
                IndiaMapPlanner.getUserLocation();
            };
        }

        if (denyBtn) {
            denyBtn.onclick = () => {
                Utils.toggleVisibility('location-permission-modal', false);
                IndiaMapPlanner.useDefaultLocation();
            };
        }
    },

    getUserLocation: () => {
        Utils.showToast("Detecting your location...", "info");
        IndiaMapPlanner.getReliableUserLocation(
            (loc) => {
                const lat = loc.lat;
                const lng = loc.lng;
                
                // Center Map at User Location
                if (IndiaMapPlanner.map) {
                    IndiaMapPlanner.map.flyTo([lat, lng], 13, { duration: 1.2 });
                }

                // Add glowing user location marker
                if (IndiaMapPlanner.userLocationMarker) {
                    IndiaMapPlanner.userLocationMarker.remove();
                }
                IndiaMapPlanner.userLocationMarker = L.marker([lat, lng], { icon: IndiaMapPlanner._getUserLocIcon() })
                    .bindTooltip("My Location 📍", { permanent: false, direction: 'top' })
                    .addTo(IndiaMapPlanner.map);

                Utils.showToast(`Location mapped via ${loc.source || 'GPS'}! 📍`, "success");

                // Reverse geocode to find state name for regional feed
                const state = IndiaMapPlanner._getLocalStateFromCoords(lat, lng) || loc.state;
                if (state) {
                    IndiaMapPlanner.fetchLiveNewsAlerts(state);
                }
            },
            () => {
                Utils.showToast("Could not retrieve GPS. Using default view.", "warning");
                IndiaMapPlanner.useDefaultLocation();
            }
        );
    },

    useDefaultLocation: () => {
        // Default to New Delhi coordinates: [28.6139, 77.2090]
        const defLat = 28.6139;
        const defLng = 77.2090;
        IndiaMapPlanner.map.setView([defLat, defLng], 12);
        IndiaMapPlanner.fetchLiveNewsAlerts();
    },

    _currentRegion: '',
    _liveNewsInterval: null,

    _startLiveNewsScheduler: () => {
        if (IndiaMapPlanner._liveNewsInterval) clearInterval(IndiaMapPlanner._liveNewsInterval);
        IndiaMapPlanner._liveNewsInterval = setInterval(() => {
            IndiaMapPlanner.fetchLiveNewsAlerts(IndiaMapPlanner._currentRegion || '', true);
        }, 75000); // Periodic live refresh every 75s (~1.25 minutes)
    },

    fetchLiveNewsAlerts: (region = '', isSilent = false) => {
        IndiaMapPlanner._currentRegion = region;
        if (!IndiaMapPlanner._liveNewsInterval) {
            IndiaMapPlanner._startLiveNewsScheduler();
        }

        const cleanRegion = (region || '').trim();
        const query = cleanRegion ? `${cleanRegion} highway traffic NHAI` : 'NHAI national highway traffic accident congestion';
        const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
        
        // Multi-tier proxy fallback pipeline
        const p1 = `https://api.allorigins.win/get?url=${encodeURIComponent(googleNewsUrl)}`;
        const p2 = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(googleNewsUrl)}`;
        
        const parseRssXml = (xmlString) => {
            const parser = new DOMParser();
            const xml = parser.parseFromString(xmlString, 'text/xml');
            const items = xml.querySelectorAll('item');
            const results = [];
            items.forEach((item, idx) => {
                if (idx < 8) {
                    let title = item.querySelector('title')?.textContent || '';
                    const srcIdx = title.lastIndexOf(' - ');
                    if (srcIdx !== -1) title = title.substring(0, srcIdx);
                    if (title.length > 15) results.push(title.trim());
                }
            });
            return results;
        };

        const tryTier1 = () => {
            return fetch(p1, { signal: AbortSignal.timeout(4500) })
                .then(r => r.json())
                .then(data => {
                    if (data && data.contents) {
                        const alerts = parseRssXml(data.contents);
                        if (alerts.length > 0) return alerts;
                    }
                    throw new Error('Tier 1 empty');
                });
        };

        const tryTier2 = () => {
            return fetch(p2, { signal: AbortSignal.timeout(4500) })
                .then(r => r.json())
                .then(data => {
                    if (data && data.status === 'ok' && data.items && data.items.length > 0) {
                        return data.items.map(item => {
                            let title = item.title;
                            const srcIdx = title.lastIndexOf(' - ');
                            if (srcIdx !== -1) title = title.substring(0, srcIdx);
                            return title.trim();
                        }).filter(t => t.length > 15);
                    }
                    throw new Error('Tier 2 empty');
                });
        };

        tryTier1()
            .catch(() => tryTier2())
            .then(alerts => {
                if (alerts && alerts.length > 0) {
                    IndiaMapPlanner.updateAlertsTickerUI(alerts.slice(0, 8), cleanRegion);
                } else {
                    IndiaMapPlanner.updateAlertsTickerUI(IndiaMapPlanner._getRegionalFallbackAlerts(cleanRegion), cleanRegion);
                }
            })
            .catch(() => {
                IndiaMapPlanner.updateAlertsTickerUI(IndiaMapPlanner._getRegionalFallbackAlerts(cleanRegion), cleanRegion);
            });
    },

    _getRegionalFallbackAlerts: (region) => {
        if (!region) {
            return [
                "NH-48: Traffic maintenance warnings near Mumbai-Pune expressway links",
                "NH-44: Reduced visibility alerts reported around NCR regions due to morning mist",
                "NH-19: Lane overlay works active near Kanpur-Varanasi bypass corridors",
                "NH-3: Dynamic safety alerts active near Kasara Ghat mountain highway crossings",
                "NH-44 (Punjab-Haryana): Shambhu & Ladhowal toll lanes operating smoothly under automated FASTag",
                "NE-1: High-speed corridor monitoring active on Ahmedabad-Vadodara Expressway",
                "NH-65 (Telangana-AP): Real-time electronic toll deduction active at Pantangi plaza"
            ];
        }
        const r = region.toLowerCase();
        if (r.includes('punjab') || r.includes('jalandhar') || r.includes('ludhiana') || r.includes('amritsar') || r.includes('phagwara')) {
            return [
                "NH-44 (Punjab): Free flow traffic reported along Jalandhar-Phagwara-Ludhiana corridor",
                "NH-44 (Punjab): Automated FASTag deduction operational at Ladhowal Toll Plaza",
                "NH-5 (Punjab): Minor road maintenance active near Kharar-Ludhiana highway stretch",
                "NH-3 (Punjab): High visibility conditions across Amritsar-Jalandhar expressway"
            ];
        } else if (r.includes('maharashtra') || r.includes('mumbai') || r.includes('pune')) {
            return [
                "NH-48 (Maharashtra): Heavy congestion reported near Mumbai-Pune Expressway exit",
                "NH-3 (Maharashtra): Landslide hazard warning issued for Kasara Ghat mountain pass",
                "Samruddhi Mahamarg (Maharashtra): Strict 120 km/h radar speed limit enforcement active",
                "NH-4 (Maharashtra): Toll plaza wait time under 2 mins at Khed-Shivapur plaza"
            ];
        } else if (r.includes('delhi') || r.includes('ncr') || r.includes('haryana') || r.includes('gurugram') || r.includes('ambala')) {
            return [
                "NH-44 (Delhi-NCR): High-density fog advisory near Ambala-Panipat highway stretch",
                "NH-48 (Delhi-Gurugram): Sirhol toll border corridor flowing smoothly with minor peak delays",
                "KMP Expressway (Haryana): Dynamic speed limits active (Heavy vehicles: 80 km/h, Cars: 120 km/h)",
                "NE-3 (Delhi-Meerut): Automated ANPR speed monitoring active across all 14 expressway lanes"
            ];
        } else if (r.includes('karnataka') || r.includes('bangalore') || r.includes('bengaluru')) {
            return [
                "NH-275 (Bengaluru-Mysuru): 10-lane expressway open with strict two-wheeler lane restrictions",
                "NH-48 (Karnataka): Waterlogging clearance completed near Tumakuru highway junctions",
                "NICE Road (Bengaluru): Electronic toll gates active with instant FASTag barrier clearance",
                "NH-44 (Karnataka): Automated radar speed checks active near Devanahalli Airport corridor"
            ];
        } else if (r.includes('telangana') || r.includes('hyderabad') || r.includes('andhra') || r.includes('vijayawada') || r.includes('guntur')) {
            return [
                "Hyderabad ORR (Telangana): 158 km Outer Ring Road toll lanes operating under 100% FASTag sync",
                "NH-65 (Telangana-AP): Dynamic traffic advisory active between Hyderabad and Vijayawada",
                "NH-44 (Telangana): Speed surveillance active along Shamshabad-Kurnool highway route",
                "NH-16 (Andhra Pradesh): Coastal highway corridor maintenance completed near Guntur bypass"
            ];
        } else if (r.includes('uttar pradesh') || r.includes('up') || r.includes('lucknow') || r.includes('varanasi') || r.includes('noida')) {
            return [
                "Yamuna Expressway (UP): Monitored speed limits active from Greater Noida to Agra (100 km/h)",
                "Purvanchal Expressway (UP): Emergency airstrip stretch clear for transit operations",
                "NH-19 (UP): Maintenance lane overlay active near Varanasi-Prayagraj bypass corridor",
                "NH-24 (UP): Commuter speed advisory in effect near Ghaziabad-Hapur border stretch"
            ];
        } else if (r.includes('tamil nadu') || r.includes('chennai') || r.includes('salem') || r.includes('coimbatore')) {
            return [
                "NH-45 (Tamil Nadu): Periodic weather advisory near Chengalpattu highway crossings",
                "NH-44 (Tamil Nadu): Smart highway speed cameras active near Salem-Namakkal toll gates",
                "NH-48 (Tamil Nadu): Traffic flow normal around Sriperumbudur-Kanchipuram industrial corridor",
                "Chennai Bypass (Tamil Nadu): Automated barrier clearance operating smoothly at Surapattu plaza"
            ];
        } else if (r.includes('rajasthan') || r.includes('jaipur')) {
            return [
                "NH-48 (Delhi-Jaipur): Shahjahanpur border toll corridor fully open for commercial transit",
                "NH-8 (Rajasthan): Sand reduction advisory active near Kishangarh-Ajmer highway stretch",
                "NH-52 (Rajasthan): Automated radar speed checks active around Jaipur-Kota corridor links",
                "NH-11 (Rajasthan): Toll collection operations smooth at Jaipur-Reengus plaza"
            ];
        } else if (r.includes('gujarat') || r.includes('ahmedabad') || r.includes('surat') || r.includes('vadodara')) {
            return [
                "NE-1 (Gujarat): Ahmedabad-Vadodara Expressway traffic moving at optimal 100 km/h speeds",
                "NH-48 (Gujarat): Minor bridge overlay active near Bharuch Golden Bridge approach",
                "NH-8D (Gujarat): Coastal Saurashtra highway stretch open with clear travel conditions"
            ];
        }
        
        const regTitle = region.charAt(0).toUpperCase() + region.slice(1);
        return [
            `NH-Alert (${regTitle}): Localized traffic advisory active along regional highway corridors`,
            `NH-Operations (${regTitle}): Emergency response teams deployed near major bypass routes`,
            `NH-Safety (${regTitle}): Real-time speed board monitoring active across primary toll links`,
            `NH-Tolls (${regTitle}): FASTag reader lanes operating under automatic detection`
        ];
    },

    getReliableUserLocation: (onSuccess, onError) => {
        let isDone = false;
        const done = (loc) => {
            if (!isDone) {
                isDone = true;
                onSuccess(loc);
            }
        };

        const tryIpFallback = () => {
            fetch('https://ipapi.co/json/')
                .then(r => r.json())
                .then(d => {
                    if (d && d.latitude && d.longitude) {
                        done({
                            lat: parseFloat(d.latitude),
                            lng: parseFloat(d.longitude),
                            city: d.city || 'My Location',
                            state: d.region || 'India',
                            source: 'Network'
                        });
                    } else {
                        throw new Error('ipapi invalid');
                    }
                })
                .catch(() => {
                    fetch('https://freeipapi.com/api/json')
                        .then(r => r.json())
                        .then(d => {
                            if (d && d.latitude && d.longitude) {
                                done({
                                    lat: parseFloat(d.latitude),
                                    lng: parseFloat(d.longitude),
                                    city: d.cityName || 'My Location',
                                    state: d.regionName || 'India',
                                    source: 'Network'
                                });
                            } else {
                                if (onError && !isDone) onError();
                            }
                        })
                        .catch(() => {
                            if (onError && !isDone) onError();
                        });
                });
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    done({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        accuracy: pos.coords.accuracy,
                        source: 'GPS'
                    });
                },
                () => {
                    // Try lower accuracy before network IP
                    navigator.geolocation.getCurrentPosition(
                        (pos2) => {
                            done({
                                lat: pos2.coords.latitude,
                                lng: pos2.coords.longitude,
                                accuracy: pos2.coords.accuracy,
                                source: 'GPS'
                            });
                        },
                        () => tryIpFallback(),
                        { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 }
                    );
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
            );
        } else {
            tryIpFallback();
        }
    },

    locateUser: () => {
        const btn = document.getElementById('btn-locate-me');
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        }

        IndiaMapPlanner.getReliableUserLocation(
            (loc) => {
                const lat = loc.lat;
                const lng = loc.lng;
                
                if (btn) btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';

                if (IndiaMapPlanner.map) {
                    IndiaMapPlanner.map.flyTo([lat, lng], 13, { duration: 1.2 });
                }
                
                if (IndiaMapPlanner.userLocationMarker) {
                    IndiaMapPlanner.userLocationMarker.remove();
                }
                
                IndiaMapPlanner.userLocationMarker = L.marker([lat, lng], { icon: IndiaMapPlanner._getUserLocIcon() })
                    .bindTooltip("My Location 📍", { permanent: false, direction: 'top' })
                    .addTo(IndiaMapPlanner.map);

                Utils.showToast(`Located successfully via ${loc.source || 'GPS'}! 📍`, "success");

                const state = IndiaMapPlanner._getLocalStateFromCoords(lat, lng) || loc.state;
                if (state) {
                    IndiaMapPlanner.fetchLiveNewsAlerts(state);
                }
            },
            () => {
                if (btn) btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
                Utils.showToast("Could not retrieve GPS or network location.", "error");
            }
        );
    },

    updateAlertsTickerUI: (alerts, region = '') => {
        const container = document.querySelector('.alerts-ticker-scroll');
        if (!container) return;
        
        const labelEl = document.querySelector('.alerts-ticker-label');
        if (labelEl) {
            const regText = region ? ` (${region.toUpperCase()})` : '';
            labelEl.innerHTML = `<span class="pulse-beacon"></span> LIVE FEED${regText}`;
        }

        const formatted = alerts.map((alert, i) => {
            const badgeTime = i === 0 ? 'LIVE' : `${(i * 2 + 1)}m ago`;
            return `<span><i class="fa-solid fa-triangle-exclamation" style="color: #fbbf24; margin-right: 4px;"></i> <strong style="color: #38bdf8; font-size: 9.5px; margin-right: 4px;">[${badgeTime}]</strong> ${alert}</span>`;
        });

        // Duplicate set for seamless continuous marquee loop (0% to -50%)
        const seamlessSet = [...formatted, ...formatted];
        container.innerHTML = seamlessSet.join('');
    },

    showWeatherPopup: (type, cityName, lat, lng) => {
        if (!lat || !lng) return;
        const API_KEY = 'a8f71ad22e0567bdce65cc749371ba90';
        fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${API_KEY}&units=metric`)
            .then(res => res.json())
            .then(data => {
                if (!data || !data.main) return;
                const temp = Math.round(data.main.temp);
                const code = data.weather[0].id;
                const desc = data.weather[0].main.toLowerCase();
                
                let condition = 'Clear Skies';
                let icon = 'fa-sun';
                let color = '#fcd34d';
                let advisory = 'Optimal travel conditions.';
                
                if (code >= 700 && code < 800) {
                    condition = 'Dense Fog / Haze';
                    icon = 'fa-smog';
                    color = '#a8a29e';
                    advisory = 'Low visibility. Use fog lights & hazard lamps.';
                } else if (code >= 300 && code < 600) {
                    condition = 'Heavy Rain';
                    icon = 'fa-cloud-showers-heavy';
                    color = '#3b82f6';
                    advisory = 'Slippery roads. Reduce speed by 20%.';
                } else if (code >= 200 && code < 300) {
                    condition = 'Thunderstorm';
                    icon = 'fa-cloud-bolt';
                    color = '#8b5cf6';
                    advisory = 'High winds and lightning hazard. Proceed with caution.';
                } else if (temp > 40) {
                    condition = 'Extreme Heat';
                    icon = 'fa-temperature-arrow-up';
                    color = '#ef4444';
                    advisory = 'Extreme heat risk. Carry extra water and check tyres.';
                }
                
                let popup = document.getElementById('floating-weather-popup');
                if (!popup) {
                    popup = document.createElement('div');
                    popup.id = 'floating-weather-popup';
                    document.body.appendChild(popup);
                }
                
                Object.assign(popup.style, {
                    position: 'fixed',
                    bottom: '30px',
                    right: '20px',
                    zIndex: '9999',
                    background: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(12px)',
                    border: `1px solid ${color}60`,
                    borderRadius: '12px',
                    padding: '14px 18px',
                    color: '#fff',
                    width: '280px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    transition: 'all 0.3s ease',
                    display: 'block'
                });
                
                popup.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-size:10px; font-weight:800; text-transform:uppercase; color:${color}; letter-spacing:0.5px;">
                            <i class="fa-solid fa-cloud-sun-rain"></i> Real-time Weather
                        </span>
                        <button onclick="document.getElementById('floating-weather-popup').style.display='none'" style="background:none; border:none; color:var(--text-sec); font-size:14px; cursor:pointer;">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div style="font-size:12px; font-weight:700; color:#fff; margin-bottom:4px;">${type === 'origin' ? 'Origin' : 'Destination'}: ${cityName}</div>
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
                        <div style="font-size:28px; font-weight:800; color:#fff;">${temp}°C</div>
                        <div>
                            <div style="font-size:12px; font-weight:600; color:${color}; display:flex; align-items:center; gap:4px;">
                                <i class="fa-solid ${icon}"></i> ${condition}
                            </div>
                            <div style="font-size:9px; color:var(--text-sec); margin-top:2px;">Live location tracking active</div>
                        </div>
                    </div>
                    <div style="font-size:10px; color:var(--text-sec); border-top:1px solid rgba(255,255,255,0.05); padding-top:6px; line-height:1.4;">
                        <strong>Alert:</strong> ${advisory}
                    </div>
                `;
                
                if (window.VoiceAssistant) {
                    window.VoiceAssistant.speak(`You have selected ${cityName} as ${type}. Current weather is ${temp} degrees with ${condition}.`);
                }
            })
            .catch(() => {
                if (window.VoiceAssistant) {
                    window.VoiceAssistant.speak(`You have selected ${cityName} as ${type}.`);
                }
            });
    },

    // ═══════════════════════════════════════════════════════════════
    // AUTOCOMPLETE — built-in city list + live Nominatim for unknowns
    // ═══════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════
    // AUTOCOMPLETE — Google Maps Grade High-Accuracy Search Engine
    // ═══════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════
    // AUTOCOMPLETE — Google Maps Grade Universal Search Engine
    // ═══════════════════════════════════════════════════════════════
    _searchCache: new Map(),

    _svgIcons: {
        current: `<svg viewBox="0 0 64 64" width="22" height="22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <circle cx="32" cy="32" r="28" fill="rgba(16,185,129,0.15)" stroke="#10b981" stroke-width="2" stroke-dasharray="4 3"/>
            <circle cx="32" cy="32" r="18" fill="rgba(16,185,129,0.25)" stroke="#34d399" stroke-width="2.5"/>
            <circle cx="32" cy="32" r="8" fill="#10b981" stroke="#ffffff" stroke-width="2.5"/>
            <line x1="32" y1="4" x2="32" y2="14" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
            <line x1="32" y1="50" x2="32" y2="60" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
            <line x1="4" y1="32" x2="14" y2="32" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
            <line x1="50" y1="32" x2="60" y2="32" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
        </svg>`,
        
        airport: `<svg viewBox="0 0 64 64" width="22" height="22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <path d="M32 6 L38 24 L58 36 L58 42 L38 34 L38 50 L44 54 L44 58 L32 54 L20 58 L20 54 L26 50 L26 34 L6 42 L6 36 L26 24 Z" fill="url(#g3dPlane)"/>
            <ellipse cx="32" cy="14" rx="2.5" ry="4" fill="#bae6fd"/>
            <defs>
                <linearGradient id="g3dPlane" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="60%" stop-color="#e0f2fe"/><stop offset="100%" stop-color="#38bdf8"/></linearGradient>
            </defs>
        </svg>`,
        
        station: `<svg viewBox="0 0 64 64" width="22" height="22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <path d="M16 10 C16 6 48 6 48 10 L52 42 C52 50 44 52 32 52 C20 52 12 50 12 42 Z" fill="url(#g3dTrain)"/>
            <path d="M18 16 L46 16 L44 30 L20 30 Z" fill="#0f172a"/>
            <path d="M22 18 L42 18 L40 28 L24 28 Z" fill="#38bdf8"/>
            <circle cx="20" cy="42" r="3.5" fill="#facc15"/><circle cx="44" cy="42" r="3.5" fill="#facc15"/>
            <line x1="20" y1="52" x2="14" y2="60" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
            <line x1="44" y1="52" x2="50" y2="60" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
            <defs>
                <linearGradient id="g3dTrain" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="50%" stop-color="#fda4af"/><stop offset="100%" stop-color="#e11d48"/></linearGradient>
            </defs>
        </svg>`,
        
        toll: `<svg viewBox="0 0 64 64" width="22" height="22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <rect x="8" y="10" width="48" height="10" rx="3" fill="#ffffff"/>
            <rect x="14" y="20" width="6" height="34" rx="1.5" fill="#fef3c7"/>
            <rect x="44" y="20" width="6" height="34" rx="1.5" fill="#fef3c7"/>
            <path d="M18 36 L52 28" stroke="#ef4444" stroke-width="4.5" stroke-linecap="round"/>
            <circle cx="20" cy="36" r="4" fill="#fbbf24"/>
            <circle cx="32" cy="15" r="3" fill="#10b981"/>
        </svg>`,
        
        shrine: `<svg viewBox="0 0 64 64" width="22" height="22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <path d="M32 4 L38 16 L48 24 L46 38 L18 38 L16 24 L26 16 Z" fill="url(#g3dTemple)"/>
            <circle cx="32" cy="4" r="2.5" fill="#fef08a"/>
            <rect x="12" y="38" width="40" height="8" rx="2" fill="#fed7aa"/>
            <rect x="8" y="46" width="48" height="8" rx="2" fill="#fdba74"/>
            <path d="M26 38 L26 28 C26 24 38 24 38 28 L38 38 Z" fill="#7c2d12"/>
            <defs>
                <linearGradient id="g3dTemple" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffedd5"/><stop offset="50%" stop-color="#fb923c"/><stop offset="100%" stop-color="#ea580c"/></linearGradient>
            </defs>
        </svg>`,
        
        beach: `<svg viewBox="0 0 64 64" width="22" height="22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <circle cx="46" cy="18" r="8" fill="#fde047"/>
            <path d="M12 50 C24 46 40 46 52 50 L52 56 L12 56 Z" fill="#fed7aa"/>
            <path d="M26 50 Q32 32 30 22" stroke="#92400e" stroke-width="4" stroke-linecap="round" fill="none"/>
            <path d="M30 22 Q18 18 14 26 M30 22 Q24 10 32 6 M30 22 Q42 16 46 24 M30 22 Q38 12 44 8" stroke="#22c55e" stroke-width="3.5" stroke-linecap="round" fill="none"/>
        </svg>`,
        
        landmark: `<svg viewBox="0 0 64 64" width="22" height="22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <polygon points="32,8 54,20 10,20" fill="url(#g3dMonument)"/>
            <rect x="14" y="24" width="6" height="24" rx="2" fill="#ffffff"/>
            <rect x="29" y="24" width="6" height="24" rx="2" fill="#ffffff"/>
            <rect x="44" y="24" width="6" height="24" rx="2" fill="#ffffff"/>
            <rect x="8" y="48" width="48" height="8" rx="2" fill="#fef08a"/>
            <defs>
                <linearGradient id="g3dMonument" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#fef08a"/></linearGradient>
            </defs>
        </svg>`,
        
        hospital: `<svg viewBox="0 0 64 64" width="22" height="22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <rect x="8" y="8" width="48" height="48" rx="12" fill="url(#g3dMedBg)"/>
            <path d="M26 18 L38 18 L38 26 L46 26 L46 38 L38 38 L38 46 L26 46 L26 38 L18 38 L18 26 L26 26 Z" fill="#ffffff"/>
            <defs>
                <linearGradient id="g3dMedBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f87171"/><stop offset="100%" stop-color="#dc2626"/></linearGradient>
            </defs>
        </svg>`,
        
        institute: `<svg viewBox="0 0 64 64" width="22" height="22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <polygon points="32,10 58,24 32,38 6,24" fill="url(#g3dCap)"/>
            <path d="M16 30 L16 46 C16 52 48 52 48 46 L48 30" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
            <line x1="52" y1="27" x2="52" y2="44" stroke="#facc15" stroke-width="3" stroke-linecap="round"/>
            <circle cx="52" cy="46" r="2.5" fill="#facc15"/>
            <defs>
                <linearGradient id="g3dCap" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#99f6e4"/></linearGradient>
            </defs>
        </svg>`,
        
        tech: `<svg viewBox="0 0 64 64" width="22" height="22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <rect x="10" y="12" width="44" height="30" rx="4" fill="#1e1b4b" stroke="#ffffff" stroke-width="2.5"/>
            <rect x="14" y="16" width="36" height="22" rx="2" fill="#0f172a"/>
            <path d="M20 22 L26 27 L20 32 M29 32 L36 32" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <path d="M6 44 L58 44 L52 50 L12 50 Z" fill="#ffffff"/>
        </svg>`,
        
        mall: `<svg viewBox="0 0 64 64" width="22" height="22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <path d="M12 20 L52 20 L48 54 L16 54 Z" fill="url(#g3dBag)"/>
            <path d="M22 24 C22 12 42 12 42 24" fill="none" stroke="#fef08a" stroke-width="4.5" stroke-linecap="round"/>
            <line x1="14" y1="28" x2="50" y2="28" stroke="#ffffff" stroke-width="2" opacity="0.6"/>
            <defs>
                <linearGradient id="g3dBag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c084fc"/><stop offset="100%" stop-color="#7e22ce"/></linearGradient>
            </defs>
        </svg>`,
        
        fuel: `<svg viewBox="0 0 64 64" width="22" height="22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <rect x="12" y="10" width="30" height="46" rx="4" fill="#ffffff"/>
            <rect x="16" y="16" width="22" height="16" rx="2" fill="#0f172a"/>
            <text x="27" y="28" fill="#facc15" font-size="10" font-weight="bold" text-anchor="middle" font-family="sans-serif">₹</text>
            <path d="M42 24 L48 24 L52 30 L52 46 L48 50 L44 46" fill="none" stroke="#fef08a" stroke-width="3" stroke-linecap="round"/>
        </svg>`,
        
        hotel: `<svg viewBox="0 0 64 64" width="22" height="22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <rect x="10" y="16" width="44" height="34" rx="4" fill="#ffffff"/>
            <rect x="14" y="20" width="16" height="12" rx="2" fill="#a3e635"/>
            <rect x="34" y="20" width="16" height="12" rx="2" fill="#a3e635"/>
            <rect x="10" y="34" width="44" height="16" rx="2" fill="#4d7c0f"/>
            <line x1="8" y1="50" x2="56" y2="50" stroke="#fef08a" stroke-width="3.5" stroke-linecap="round"/>
        </svg>`,
        
        city: `<svg viewBox="0 0 64 64" width="22" height="22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <rect x="8" y="24" width="18" height="32" rx="2" fill="#93c5fd"/>
            <rect x="24" y="10" width="20" height="46" rx="2" fill="#ffffff"/>
            <rect x="42" y="20" width="14" height="36" rx="2" fill="#bfdbfe"/>
            <circle cx="17" cy="30" r="1.5" fill="#1e3a8a"/><circle cx="17" cy="38" r="1.5" fill="#1e3a8a"/>
            <circle cx="34" cy="18" r="1.5" fill="#1e3a8a"/><circle cx="34" cy="26" r="1.5" fill="#1e3a8a"/><circle cx="34" cy="34" r="1.5" fill="#1e3a8a"/>
            <circle cx="49" cy="28" r="1.5" fill="#1e3a8a"/><circle cx="49" cy="36" r="1.5" fill="#1e3a8a"/>
        </svg>`,
        
        place: `<svg viewBox="0 0 64 64" width="22" height="22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <ellipse cx="32" cy="56" rx="14" ry="4" fill="rgba(0,0,0,0.35)"/>
            <path d="M32 6 C20 6 12 15 12 26 C12 40 32 56 32 56 C32 56 52 40 52 26 C52 15 44 6 32 6 Z" fill="url(#g3dPin)"/>
            <circle cx="32" cy="24" r="7" fill="#ffffff"/>
            <circle cx="32" cy="24" r="3.5" fill="#ef4444"/>
            <defs>
                <linearGradient id="g3dPin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f87171"/><stop offset="50%" stop-color="#ef4444"/><stop offset="100%" stop-color="#991b1b"/></linearGradient>
            </defs>
        </svg>`,

        food: `<svg viewBox="0 0 64 64" width="22" height="22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <ellipse cx="32" cy="46" rx="24" ry="8" fill="#fdba74"/>
            <path d="M16 42 C16 26 48 26 48 42 Z" fill="url(#g3dFood)"/>
            <circle cx="32" cy="22" r="3" fill="#fef08a"/>
            <defs>
                <linearGradient id="g3dFood" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffedd5"/><stop offset="100%" stop-color="#ea580c"/></linearGradient>
            </defs>
        </svg>`,
        
        village: `<svg viewBox="0 0 64 64" width="22" height="22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <polygon points="32,10 52,26 12,26" fill="#f97316"/>
            <rect x="16" y="26" width="32" height="26" fill="#fef3c7"/>
            <rect x="26" y="34" width="12" height="18" fill="#78350f"/>
            <circle cx="50" cy="38" r="10" fill="#22c55e"/>
            <rect x="48" y="44" width="4" height="12" fill="#78350f"/>
        </svg>`,

        building: `<svg viewBox="0 0 64 64" width="22" height="22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <rect x="14" y="8" width="36" height="48" rx="4" fill="url(#g3dBuild)"/>
            <rect x="20" y="14" width="8" height="6" rx="1" fill="#93c5fd"/>
            <rect x="36" y="14" width="8" height="6" rx="1" fill="#93c5fd"/>
            <rect x="20" y="26" width="8" height="6" rx="1" fill="#93c5fd"/>
            <rect x="36" y="26" width="8" height="6" rx="1" fill="#93c5fd"/>
            <rect x="26" y="42" width="12" height="14" rx="1" fill="#1e3a8a"/>
            <defs>
                <linearGradient id="g3dBuild" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#60a5fa"/></linearGradient>
            </defs>
        </svg>`,

        govt: `<svg viewBox="0 0 64 64" width="22" height="22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <polygon points="32,8 54,20 10,20" fill="#94a3b8"/>
            <rect x="14" y="24" width="6" height="24" rx="2" fill="#cbd5e1"/>
            <rect x="29" y="24" width="6" height="24" rx="2" fill="#cbd5e1"/>
            <rect x="44" y="24" width="6" height="24" rx="2" fill="#cbd5e1"/>
            <rect x="8" y="48" width="48" height="8" rx="2" fill="#e2e8f0"/>
        </svg>`
    },

    _getPlaceCategoryInfo: (item) => {
        if (item.isCurrentLoc) {
            return { svg: IndiaMapPlanner._svgIcons.current, cls: 'icon-current', badge: 'MY GPS' };
        }
        const str = ((item.name || '') + ' ' + (item.fullName || '') + ' ' + (item.subtitle || '') + ' ' + (item.type || '') + ' ' + (item.class || '')).toLowerCase();
        
        if (str.includes('restaurant') || str.includes('cafe') || str.includes('dhaba') || str.includes('bakery') || str.includes('food') || str.includes('bhojanalaya') || str.includes('canteen') || str.includes('sweet') || str.includes('biryani') || str.includes('pizza') || str.includes('burger') || str.includes('bar') || str.includes('pub') || str.includes('eatery') || str.includes('kitchen') || str.includes('dining')) {
            return { svg: IndiaMapPlanner._svgIcons.food, cls: 'icon-food', badge: 'FOOD / DINING' };
        }
        if (item.isVillage || str.includes('village') || str.includes('gram') || str.includes('panchayat') || str.includes('taluk') || str.includes('mandal') || str.includes('hamlet') || str.includes('basti') || str.includes('palle') || str.includes('kheda') || str.includes('dehat')) {
            return { svg: IndiaMapPlanner._svgIcons.village, cls: 'icon-village', badge: 'VILLAGE / RURAL' };
        }
        if (str.includes('apartment') || str.includes('society') || str.includes('residency') || str.includes('enclave') || str.includes('heights') || str.includes('villas') || str.includes('towers') || str.includes('flat') || str.includes('housing') || str.includes('residential')) {
            return { svg: IndiaMapPlanner._svgIcons.building, cls: 'icon-building', badge: 'RESIDENTIAL / BLDG' };
        }
        if (str.includes('police') || str.includes('court') || str.includes('secretariat') || str.includes('collectorate') || str.includes('post office') || str.includes('municipality') || str.includes('nagar nigam') || str.includes('rto') || str.includes('tehsil') || str.includes('govt')) {
            return { svg: IndiaMapPlanner._svgIcons.govt, cls: 'icon-govt', badge: 'GOVT / PUBLIC' };
        }
        if (str.includes('airport') || str.includes('aerodrome') || str.includes('airfield') || str.includes('helipad')) {
            return { svg: IndiaMapPlanner._svgIcons.airport, cls: 'icon-airport', badge: 'AIRPORT' };
        }
        if (str.includes('railway') || str.includes('station') || str.includes('junction') || str.includes('metro') || str.includes('terminus') || str.includes('bus stand') || str.includes('bus stop') || str.includes('isbt')) {
            return { svg: IndiaMapPlanner._svgIcons.station, cls: 'icon-station', badge: 'TRANSIT' };
        }
        if (str.includes('toll') || str.includes('plaza') || str.includes('expressway') || str.includes('highway') || str.includes('tollway')) {
            return { svg: IndiaMapPlanner._svgIcons.toll, cls: 'icon-toll', badge: 'TOLL PLAZA' };
        }
        if (str.includes('temple') || str.includes('mandir') || str.includes('tirumala') || str.includes('balaji') || str.includes('gurdwara') || str.includes('mosque') || str.includes('masjid') || str.includes('church') || str.includes('shrine') || str.includes('dargah') || str.includes('ashram') || str.includes('matha')) {
            return { svg: IndiaMapPlanner._svgIcons.shrine, cls: 'icon-shrine', badge: 'TEMPLE / SHRINE' };
        }
        if (str.includes('beach') || str.includes('lake') || str.includes('sea') || str.includes('waterfall') || str.includes('river') || str.includes('viewpoint') || str.includes('hill') || str.includes('peak') || str.includes('valley') || str.includes('forest') || str.includes('sanctuary') || str.includes('safari') || str.includes('park') || str.includes('garden')) {
            return { svg: IndiaMapPlanner._svgIcons.beach, cls: 'icon-beach', badge: 'TOURIST / NATURE' };
        }
        if (str.includes('fort') || str.includes('palace') || str.includes('monument') || str.includes('mahal') || str.includes('taj') || str.includes('charminar') || str.includes('ghat') || str.includes('museum') || str.includes('heritage') || str.includes('memorial') || str.includes('arch')) {
            return { svg: IndiaMapPlanner._svgIcons.landmark, cls: 'icon-landmark', badge: 'HERITAGE' };
        }
        if (str.includes('hospital') || str.includes('medical') || str.includes('aiims') || str.includes('clinic') || str.includes('care') || str.includes('doctor') || str.includes('nursing home') || str.includes('pharmacy') || str.includes('chemist') || str.includes('diagnostic')) {
            return { svg: IndiaMapPlanner._svgIcons.hospital, cls: 'icon-hospital', badge: 'HEALTHCARE' };
        }
        if (str.includes('university') || str.includes('college') || str.includes('campus') || str.includes('institute') || str.includes('iit') || str.includes('nit') || str.includes('lpu') || str.includes('school') || str.includes('academy') || str.includes('vidyalaya') || str.includes('polytechnic')) {
            return { svg: IndiaMapPlanner._svgIcons.institute, cls: 'icon-institute', badge: 'COLLEGE / CAMPUS' };
        }
        if (str.includes('tech park') || str.includes('cyber') || str.includes('hitec') || str.includes('it park') || str.includes('software') || str.includes('infosys') || str.includes('wipro') || str.includes('tcs') || str.includes('mindspace') || str.includes('ecospace') || str.includes('manyata')) {
            return { svg: IndiaMapPlanner._svgIcons.tech, cls: 'icon-tech', badge: 'TECH PARK / IT' };
        }
        if (str.includes('mall') || str.includes('market') || str.includes('bazaar') || str.includes('center') || str.includes('shopping') || str.includes('store') || str.includes('supermarket') || str.includes('mart') || str.includes('hypermarket') || str.includes('showroom')) {
            return { svg: IndiaMapPlanner._svgIcons.mall, cls: 'icon-mall', badge: 'MALL / MARKET' };
        }
        if (str.includes('fuel') || str.includes('petrol') || str.includes('diesel') || str.includes('cng') || str.includes('pump') || str.includes('charging') || str.includes('ev station') || str.includes('hp') || str.includes('ioc') || str.includes('bpcl') || str.includes('shell')) {
            return { svg: IndiaMapPlanner._svgIcons.fuel, cls: 'icon-fuel', badge: 'FUEL / EV' };
        }
        if (str.includes('hotel') || str.includes('resort') || str.includes('stay') || str.includes('inn') || str.includes('lodge') || str.includes('suites') || str.includes('homestay') || str.includes('dharamshala') || str.includes('oyo')) {
            return { svg: IndiaMapPlanner._svgIcons.hotel, cls: 'icon-hotel', badge: 'HOTEL / STAY' };
        }
        if (item.type === 'city' || item.type === 'administrative' || ['mumbai','delhi','bengaluru','bangalore','hyderabad','chennai','kolkata','pune','ahmedabad','jaipur','lucknow','chandigarh','guntur','vijayawada','patna','bhopal','surat','indore','varanasi','agra'].includes(item.name?.toLowerCase())) {
            return { svg: IndiaMapPlanner._svgIcons.city, cls: 'icon-city', badge: 'CITY' };
        }
        return { svg: IndiaMapPlanner._svgIcons.place, cls: 'icon-place', badge: 'PLACE' };
    },

    _highlightQuery: (text, query) => {
        if (!text || !query) return text || '';
        const q = query.trim();
        if (!q) return text;
        const regex = new RegExp(`(${q.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<span class="search-match">$1</span>');
    },

    setupAutocomplete: (inputId, dropdownId, onSelect) => {
        const input    = document.getElementById(inputId);
        const dropdown = document.getElementById(dropdownId);
        if (!input || !dropdown) return;

        const clearBtnId = inputId === 'route-origin-input' ? 'btn-clear-origin' : 'btn-clear-dest';
        const clearBtn = document.getElementById(clearBtnId);

        const updateClearBtn = () => {
            if (clearBtn) {
                clearBtn.style.display = input.value.trim().length > 0 ? 'block' : 'none';
            }
        };

        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                input.value = '';
                updateClearBtn();
                dropdown.innerHTML = '';
                dropdown.style.display = 'none';
                if (inputId === 'route-origin-input') {
                    IndiaMapPlanner.selectedOrigin = null;
                    if (IndiaMapPlanner.userLocationMarker) { try { IndiaMapPlanner.userLocationMarker.remove(); } catch(e){} IndiaMapPlanner.userLocationMarker = null; }
                    if (IndiaMapPlanner.originMarker) { try { IndiaMapPlanner.originMarker.remove(); } catch(e){} IndiaMapPlanner.originMarker = null; }
                }
                if (inputId === 'route-dest-input') {
                    IndiaMapPlanner.selectedDest = null;
                    if (IndiaMapPlanner.destMarker) { try { IndiaMapPlanner.destMarker.remove(); } catch(e){} IndiaMapPlanner.destMarker = null; }
                }
                input.focus();
            });
        }

        // Show Current GPS option for Origin on click if empty
        input.addEventListener('focus', () => {
            updateClearBtn();
            if (inputId === 'route-origin-input' && input.value.trim().length === 0) {
                const currentLocOption = [{
                    name: 'Current Location',
                    fullName: 'Your Current GPS Position',
                    subtitle: 'Auto-detect coordinates from device GPS',
                    lat: null,
                    lng: null,
                    isCurrentLoc: true
                }];
                IndiaMapPlanner._renderDropdown(dropdown, currentLocOption, '', onSelect, input);
            }
        });

        let debounceTimer;
        let focusedIndex = -1;

        // Keyboard arrow navigation
        input.addEventListener('keydown', (e) => {
            const items = dropdown.querySelectorAll('.google-ac-item');
            if (!items || items.length === 0 || dropdown.style.display === 'none') return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                focusedIndex = (focusedIndex + 1) % items.length;
                items.forEach((it, idx) => it.classList.toggle('focused', idx === focusedIndex));
                items[focusedIndex]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                focusedIndex = (focusedIndex - 1 + items.length) % items.length;
                items.forEach((it, idx) => it.classList.toggle('focused', idx === focusedIndex));
                items[focusedIndex]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter') {
                if (focusedIndex >= 0 && items[focusedIndex]) {
                    e.preventDefault();
                    items[focusedIndex].click();
                }
            } else if (e.key === 'Escape') {
                dropdown.style.display = 'none';
            }
        });

        input.addEventListener('input', () => {
            updateClearBtn();
            clearTimeout(debounceTimer);
            focusedIndex = -1;
            const val = input.value.trim();
            if (val.length < 2) { 
                if (inputId === 'route-origin-input' && val.length === 0) {
                    const currentLocOption = [{
                        name: 'Current Location',
                        fullName: 'Your Current GPS Position',
                        subtitle: 'Auto-detect coordinates from device GPS',
                        lat: null,
                        lng: null,
                        isCurrentLoc: true
                    }];
                    IndiaMapPlanner._renderDropdown(dropdown, currentLocOption, '', onSelect, input);
                } else {
                    dropdown.innerHTML = ''; 
                    dropdown.style.display = 'none'; 
                }
                return; 
            }

            const qLower = val.toLowerCase();

            // Check Instant Cache
            if (IndiaMapPlanner._searchCache.has(qLower)) {
                const cached = IndiaMapPlanner._searchCache.get(qLower);
                IndiaMapPlanner._renderDropdown(dropdown, cached, val, onSelect, input);
                return;
            }

            // 1. Instant local search from IndiaMapData & TollSeedData
            const localMatches = [];
            const addedKeys = new Set();

            // Search in TollSeedData for exact toll plazas
            if (window.TollSeedData) {
                TollSeedData.forEach(t => {
                    if (t.name && t.name.toLowerCase().includes(qLower)) {
                        const key = (t.name + '_' + (t.state || '')).toLowerCase();
                        localMatches.push({
                            name: t.name,
                            fullName: `${t.name}, ${t.state || 'India'}`,
                            subtitle: `${t.state || 'India'} • NH-${t.nhCorridor || 'National Highway'}`,
                            lat: t.lat,
                            lng: t.lng,
                            state: t.state || 'India',
                            type: 'toll',
                            importance: 0.98
                        });
                        addedKeys.add(key);
                    }
                });
            }

            // Search in IndiaMapData.cities
            if (IndiaMapPlanner.cities && IndiaMapPlanner.cities.length > 0) {
                IndiaMapPlanner.cities.forEach(c => {
                    if (c.name && (c.name.toLowerCase().includes(qLower) || (c.state && c.state.toLowerCase().includes(qLower)))) {
                        const key = (c.name + '_' + (c.state || '')).toLowerCase();
                        if (!addedKeys.has(key)) {
                            const isExactStart = c.name.toLowerCase().startsWith(qLower);
                            localMatches.push({
                                name: c.name,
                                fullName: `${c.name}, ${c.state || 'India'}`,
                                subtitle: `${c.state || 'India'}`,
                                lat: c.lat,
                                lng: c.lng,
                                state: c.state || 'India',
                                type: 'city',
                                isVillage: c.isVillage,
                                importance: isExactStart ? 0.92 : 0.75
                            });
                            addedKeys.add(key);
                        }
                    }
                });
            }

            // Sort local matches by relevance
            localMatches.sort((a, b) => (b.importance || 0) - (a.importance || 0));
            const topLocal = localMatches.slice(0, 6);

            if (topLocal.length > 0) {
                IndiaMapPlanner._renderDropdown(dropdown, topLocal, val, onSelect, input);
            }

            // 2. Dual-Engine Global & India POI Geocoding (Photon + Nominatim) with 120ms debounce
            debounceTimer = setTimeout(() => {
                IndiaMapPlanner._universalSearch(val, dropdown, input, onSelect, topLocal);
            }, 120);
        });

        document.addEventListener('click', e => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    },

    _renderDropdown: (dropdown, places, query, onSelect, input) => {
        if (!places || places.length === 0) {
            dropdown.innerHTML = '<div class="ac-item" style="color:var(--text-muted); font-size:11px; padding:12px;">🔍 Searching places across India…</div>';
            dropdown.style.display = 'block';
            return;
        }

        dropdown.innerHTML = places.map((p, idx) => {
            const cat = IndiaMapPlanner._getPlaceCategoryInfo(p);
            const highTitle = IndiaMapPlanner._highlightQuery(p.name, query);
            return `
                <div class="google-ac-item ${idx === 0 && !query ? 'focused' : ''}" data-idx="${idx}" data-name="${p.name}" data-lat="${p.lat || ''}" data-lng="${p.lng || ''}" data-state="${p.state || ''}" data-isvillage="${p.isVillage || false}" data-iscurrent="${p.isCurrentLoc || false}">
                    <div class="google-ac-icon-box ${cat.cls}">
                        ${cat.svg}
                    </div>
                    <div class="google-ac-content">
                        <div class="google-ac-title">
                            <span>${highTitle}</span>
                            <span class="google-ac-badge">${cat.badge}</span>
                        </div>
                        <div class="google-ac-subtitle">${p.subtitle || (p.state ? p.state + ', India' : 'India')}</div>
                    </div>
                </div>
            `;
        }).join('');

        dropdown.style.display = 'block';

        dropdown.querySelectorAll('.google-ac-item').forEach(item => {
            item.addEventListener('click', () => {
                const isCurrent = item.dataset.iscurrent === 'true';

                if (isCurrent) {
                    input.value = 'Locating position…';
                    dropdown.style.display = 'none';
                    IndiaMapPlanner.getReliableUserLocation(
                        (loc) => {
                            const currentObj = {
                                name: 'My Current Location',
                                state: loc.state || 'GPS',
                                lat: loc.lat,
                                lng: loc.lng,
                                isCurrentLoc: true
                            };
                            input.value = 'My Current Location 📍';
                            const clearBtn = document.getElementById(input.id === 'route-origin-input' ? 'btn-clear-origin' : 'btn-clear-dest');
                            if (clearBtn) clearBtn.style.display = 'block';
                            IndiaMapPlanner.setUserLocation(loc.lat, loc.lng, 'My Current Location');
                            onSelect(currentObj);
                        },
                        () => {
                            input.value = '';
                            Utils.showToast('Could not retrieve location.', 'error');
                        }
                    );
                    return;
                }

                const isVillage = item.dataset.isvillage === 'true';
                const selectedObj = {
                    name:  item.dataset.name,
                    lat:   parseFloat(item.dataset.lat),
                    lng:   parseFloat(item.dataset.lng),
                    state: item.dataset.state || 'India',
                    isVillage: isVillage
                };
                input.value = `${selectedObj.name}, ${selectedObj.state}`;
                const clearBtn = document.getElementById(input.id === 'route-origin-input' ? 'btn-clear-origin' : 'btn-clear-dest');
                if (clearBtn) clearBtn.style.display = 'block';
                dropdown.style.display = 'none';
                
                if (IndiaMapPlanner.map && selectedObj.lat && selectedObj.lng) {
                    IndiaMapPlanner.map.flyTo([selectedObj.lat, selectedObj.lng], 11, { duration: 1.2 });
                }

                onSelect(selectedObj);
            });
        });
    },

    _universalSearch: (query, dropdown, input, onSelect, existingList = []) => {
        const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=in&format=json&addressdetails=1&limit=15&dedupe=0`;
        const phoUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=15&lat=20.5937&lon=78.9629`;

        const seenKeys = new Set(existingList.map(p => (p.name + '_' + (p.state || '')).toLowerCase()));
        const livePlaces = [];

        Promise.all([
            fetch(nomUrl, { headers: { 'Accept-Language': 'en' } }).then(r => r.json()).catch(() => []),
            fetch(phoUrl).then(r => r.json()).catch(() => ({ features: [] }))
        ]).then(([nomResults, phoResults]) => {
            // 1. Parse Nominatim results (POI, Building, Restaurant, Village, Road)
            if (Array.isArray(nomResults)) {
                nomResults.forEach(r => {
                    const addr = r.address || {};
                    const primaryName = addr.amenity || addr.building || addr.shop || addr.tourism || addr.historic || addr.leisure || addr.aeroway || addr.village || addr.hamlet || addr.suburb || addr.neighbourhood || addr.city || addr.town || addr.road || r.display_name.split(',')[0].trim();
                    const state = addr.state || 'India';
                    const key = (primaryName + '_' + state + '_' + (r.lat || '')).toLowerCase();
                    
                    const subParts = [];
                    if (addr.suburb || addr.neighbourhood) subParts.push(addr.suburb || addr.neighbourhood);
                    if (addr.village && addr.village !== primaryName) subParts.push(addr.village);
                    if (addr.city && addr.city !== primaryName) subParts.push(addr.city);
                    if (addr.town && addr.town !== primaryName) subParts.push(addr.town);
                    if (addr.county || addr.state_district) subParts.push(addr.county || addr.state_district);
                    if (state && state !== primaryName) subParts.push(state);
                    if (addr.postcode) subParts.push(addr.postcode);
                    if (subParts.length === 0) subParts.push('India');

                    if (!seenKeys.has(key)) {
                        seenKeys.add(key);
                        livePlaces.push({
                            name: primaryName,
                            fullName: r.display_name,
                            subtitle: subParts.join(', '),
                            lat: parseFloat(r.lat),
                            lng: parseFloat(r.lon),
                            state: state,
                            type: r.type || r.class || 'place',
                            isVillage: r.type === 'village' || r.class === 'village' || !!addr.village,
                            importance: (r.importance || 0.5) + 0.1
                        });
                    }
                });
            }

            // 2. Parse Photon POI results (Restaurants, Buildings, Shops, Villages, Streets)
            if (phoResults && Array.isArray(phoResults.features)) {
                phoResults.features.forEach(f => {
                    const p = f.properties || {};
                    const name = p.name || p.street || p.city || p.district;
                    if (!name) return;
                    const state = p.state || 'India';
                    const key = (name + '_' + state + '_' + (f.geometry?.coordinates?.[0] || '')).toLowerCase();

                    if (!seenKeys.has(key)) {
                        seenKeys.add(key);
                        const subParts = [];
                        if (p.street && p.street !== name) subParts.push(p.street);
                        if (p.district && p.district !== name) subParts.push(p.district);
                        if (p.city && p.city !== name) subParts.push(p.city);
                        if (state) subParts.push(state);
                        if (p.postcode) subParts.push(p.postcode);
                        if (subParts.length === 0) subParts.push('India');

                        livePlaces.push({
                            name: name,
                            fullName: name + ', ' + subParts.join(', '),
                            subtitle: subParts.join(', '),
                            lat: f.geometry.coordinates[1],
                            lng: f.geometry.coordinates[0],
                            state: state,
                            type: p.osm_value || p.osm_key || 'poi',
                            isVillage: p.osm_value === 'village' || p.osm_key === 'village',
                            importance: 0.6
                        });
                    }
                });
            }

            if (livePlaces.length > 0 || existingList.length > 0) {
                const combined = [...existingList, ...livePlaces].slice(0, 18);
                IndiaMapPlanner._searchCache.set(query.toLowerCase(), combined);
                IndiaMapPlanner._renderDropdown(dropdown, combined, query, onSelect, input);
            }
        }).catch(() => {});
    },

    _geocodeVillage: (city, callback) => {
        const query = `${city.name}, ${city.state === 'Village' ? '' : city.state}, India`;
        Utils.showToast(`Geocoding ${city.name}...`, 'info');
        
        fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=in&format=json&limit=1`)
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
                    Utils.showToast(`Could not find exact location for ${city.name}.`, 'error');
                }
            })
            .catch(() => {
                Utils.showToast(`Geocoding service error.`, 'error');
            });
    },

    // ═══════════════════════════════════════════════════════════════
    // ROUTE PROCESSING — OSRM Single Optimal Path
    // ═══════════════════════════════════════════════════════════════
    processRoute: async () => {
        const origInput = document.getElementById('route-origin-input');
        const destInput = document.getElementById('route-dest-input');

        const resolveLocation = async (text, currentObj, type) => {
            if (currentObj && currentObj.lat && currentObj.lng) return currentObj;
            if (!text || !text.trim()) return null;
            const q = text.trim().toLowerCase();
            
            // 1. Check local toll seed data
            const matchedToll = (window.TollSeedData || []).find(t => t.name && (t.name.toLowerCase() === q || q.includes(t.name.toLowerCase())));
            if (matchedToll) {
                return { name: matchedToll.name, lat: matchedToll.lat, lng: matchedToll.lng, state: matchedToll.state || 'India' };
            }

            // 2. Check cities index
            const found = (IndiaMapPlanner.cities || []).find(c => 
                c.name.toLowerCase() === q || 
                q.includes(c.name.toLowerCase()) || 
                c.name.toLowerCase().includes(q)
            );
            if (found && found.lat && found.lng) {
                return found;
            }

            // 3. Dual-Engine Live Search (Photon + Nominatim)
            try {
                const [phoRes, nomRes] = await Promise.all([
                    fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=1&lat=20.5937&lon=78.9629`).then(r => r.json()).catch(() => null),
                    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text + ', India')}&countrycodes=in&format=json&limit=1`, { headers: { 'Accept-Language': 'en' } }).then(r => r.json()).catch(() => null)
                ]);

                if (phoRes && phoRes.features && phoRes.features.length > 0) {
                    const f = phoRes.features[0];
                    return {
                        name: f.properties.name || text.split(',')[0].trim(),
                        lat: f.geometry.coordinates[1],
                        lng: f.geometry.coordinates[0],
                        state: f.properties.state || 'India'
                    };
                }

                if (nomRes && nomRes.length > 0) {
                    return {
                        name: text.split(',')[0].trim(),
                        lat: parseFloat(nomRes[0].lat),
                        lng: parseFloat(nomRes[0].lon),
                        state: 'India'
                    };
                }
            } catch(e) {}
            return null;
        };

        if (!IndiaMapPlanner.selectedOrigin && origInput && origInput.value) {
            IndiaMapPlanner.selectedOrigin = await resolveLocation(origInput.value, IndiaMapPlanner.selectedOrigin, 'origin');
        }
        if (!IndiaMapPlanner.selectedDest && destInput && destInput.value) {
            IndiaMapPlanner.selectedDest = await resolveLocation(destInput.value, IndiaMapPlanner.selectedDest, 'destination');
        }

        if (!IndiaMapPlanner.selectedOrigin || !IndiaMapPlanner.selectedDest) {
            Utils.showToast('Please enter both Origin and Destination.', 'error');
            return;
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
        Utils.toggleVisibility('route-loader-overlay', true);

        IndiaMapPlanner.endLiveTrip();
        IndiaMapPlanner._clearRoutePolylines();
        IndiaMapPlanner._clearServiceMarkers();
        IndiaMapPlanner.routeTollMarkers.forEach(m => { try { m.remove(); } catch(e){} });
        IndiaMapPlanner.routeTollMarkers = [];

        IndiaMapPlanner._fallbackOSRM(o, d);
    },

    _fallbackOSRM: (o, d) => {
        const btnCalc = document.getElementById('btn-calc-route');
        const url = `https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}?overview=full&geometries=geojson&alternatives=false&steps=true`;
        fetch(url)
            .then(r => r.json())
            .then(data => {
                if (btnCalc) { btnCalc.innerHTML = '<i class="fa-solid fa-location-arrow"></i> Calculate Optimal Path'; btnCalc.disabled = false; }
                Utils.toggleVisibility('route-loader-overlay', false);
                if (data.code !== 'Ok' || !data.routes?.length) {
                    Utils.showToast('No route found via OSRM. Try nearby cities.', 'error');
                    return;
                }
                IndiaMapPlanner.allRoutes = data.routes;
                IndiaMapPlanner.selectedRouteIndex = 0;
                IndiaMapPlanner._applyRoute(0, o, d);
            })
            .catch(() => {
                if (btnCalc) { btnCalc.innerHTML = '<i class="fa-solid fa-location-arrow"></i> Calculate Optimal Path'; btnCalc.disabled = false; }
                Utils.toggleVisibility('route-loader-overlay', false);
                Utils.showToast('No internet or routing service offline. Check connection and retry.', 'error');
            });
    },

    _applyRoute: (index, origin, dest) => {
        const routes = IndiaMapPlanner.allRoutes;
        if (!routes || !routes[0]) return;

        IndiaMapPlanner.routeTollMarkers.forEach(m => { try { m.remove(); } catch(e){} });
        IndiaMapPlanner.routeTollMarkers = [];

        IndiaMapPlanner._clearRoutePolylines();

        // Selected single optimal primary route
        const primary = routes[0];
        const coords  = primary.geometry.coordinates; // [[lng, lat], …]
        const primaryLatLngs = coords.map(p => [p[1], p[0]]);

        const primaryPoly = L.polyline(primaryLatLngs, { color: '#3b82f6', weight: 7, opacity: 1.0, lineJoin: 'round' })
            .addTo(IndiaMapPlanner.map);
        primaryPoly.bindTooltip('Optimal National Highway Route', { permanent: false, sticky: true });
        IndiaMapPlanner.routePolylines.push(primaryPoly);

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

        // Ensure no alt-route tabs exist
        document.getElementById('alt-route-tabs')?.remove();

        // Summary
        IndiaMapPlanner.updateSummary(rData);
        document.getElementById('route-summary-panel')?.classList.remove('hidden');
        document.getElementById('trip-badge').innerText  = 'PREVIEW MODE';
        document.getElementById('trip-badge').style.background = 'rgba(255,255,255,0.15)';
        document.getElementById('trip-badge').style.color = 'var(--text-sec)';

        const pad = window.innerWidth <= 768 ? [30, 30] : [50, 50];
        const padBottom = window.innerWidth <= 768 ? [0, Math.round(window.innerHeight * 0.42)] : [0, 0];
        IndiaMapPlanner.map.fitBounds(primaryPoly.getBounds(), { padding: pad, paddingBottomRight: padBottom });
        Utils.showToast(`${rData.originName} → ${rData.destName} · ${rData.totalDist} km · ${rData.tolls.length} tolls`, 'success');

        // Update alerts ticker with regional feed for route origin state
        let routeState = '';
        if (origin && origin.state) {
            routeState = origin.state;
        } else if (coords && coords.length > 0) {
            routeState = IndiaMapPlanner._getLocalStateFromCoords(coords[0][1], coords[0][0]);
        }
        if (routeState) {
            IndiaMapPlanner.fetchLiveNewsAlerts(routeState);
        }

        // AI Voice Announcement
        IndiaMapPlanner._announceRoute(rData);

        // Fetch on-route services
        setTimeout(() => IndiaMapPlanner.fetchOnRouteServices(coords, rData), 800);
    },

    _announceRoute: async (rData) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();

        const etaVal = parseFloat(rData.totalEta);
        const mins = Math.round(etaVal * 60);
        const balance = window.Storage ? window.Storage.get('nhai_fastag_balance', 0) : 0;
        
        let weatherDesc = 'optimal';
        if (rData.destNodeId && window.IndiaMapData?.nodes[rData.destNodeId]) {
            try {
                const destNode = window.IndiaMapData.nodes[rData.destNodeId];
                const API_KEY = 'a8f71ad22e0567bdce65cc749371ba90';
                const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${destNode.lat}&lon=${destNode.lng}&appid=${API_KEY}&units=metric`);
                const wData = await res.json();
                if (wData && wData.weather && wData.weather.length > 0) {
                    weatherDesc = wData.weather[0].main.toLowerCase();
                }
            } catch (e) { console.error(e); }
        }

        let text = `Route mapped from ${rData.originName} to ${rData.destName}. `;
        if (etaVal < 1.0) {
            text += `The estimated travel time is ${mins} minutes. `;
        } else {
            text += `The estimated travel time is ${rData.totalEta} hours. `;
        }
        
        if (rData.tolls.length > 0) {
            text += `There are ${rData.tolls.length} tolls on this route. Total toll amount to be paid is ${rData.totalTollCost} rupees. `;
        }
        
        text += `Your current FASTag account balance is ${balance} rupees. `;
        
        if (weatherDesc === 'optimal') {
            text += `Weather and traffic conditions are currently optimal. `;
        } else {
            text += `Weather condition along the route is expected to be ${weatherDesc}. `;
        }
        
        if (window.VoiceAssistant) {
            window.VoiceAssistant.speak(text);
        }
    },

    _tollPopup: (td, cost) => {
        const vType = document.getElementById('route-vehicle-selector')?.value || document.getElementById('vehicle-type')?.value || 'LMV';
        const single = td.tollRatesByVehicleClass || {};
        const ret = td.returnRatesByVehicleClass || {};
        const isExempt = ['GOVT','PRESS','ARMY','AMBULANCE','FIRE','POLICE','BIKE'].includes(vType);
        
        const lmvSingle = single.LMV || td.baseRate || 50;
        const lmvReturn = ret.LMV || Math.round((lmvSingle * 1.5)/5)*5;

        const curSingle = isExempt ? 0 : (single[vType] || lmvSingle);
        const curReturn = isExempt ? 0 : (ret[vType] || Math.round((curSingle * 1.5)/5)*5);

        return `
        <div style="min-width:280px; font-family:var(--font-main, 'Inter', sans-serif); padding:6px 4px; color:#1e293b;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
                <div>
                    <div style="font-weight:800; font-size:13.5px; color:#0f172a; line-height:1.2;">🏗️ ${td.name}</div>
                    <div style="font-size:11px; color:#64748b; margin-top:2px;">${td.state || 'India'} · ${td.nhCorridor && td.nhCorridor !== 'N/A' ? '<strong>NH-' + td.nhCorridor + '</strong>' : 'National Highway'}</div>
                </div>
                <span style="font-size:8.5px; font-weight:700; padding:2px 6px; border-radius:4px; background:rgba(16,185,129,0.15); color:#059669; border:1px solid rgba(16,185,129,0.3);">FASTag ACTIVE</span>
            </div>

            <!-- Active Vehicle Highlight Card -->
            <div style="background:linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.95)); border-radius:8px; padding:8px 10px; margin:8px 0; color:#fff; display:flex; justify-content:space-between; align-items:center; box-shadow:0 4px 12px rgba(0,0,0,0.15);">
                <div>
                    <div style="font-size:9.5px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; font-weight:600;">Selected Vehicle (${vType})</div>
                    <div style="font-size:11px; font-weight:700; color:#38bdf8; margin-top:1px;">
                        ${isExempt ? '✨ 100% Toll Exempt' : 'Single: <span style="color:#fbbf24; font-size:13px;">₹' + curSingle + '</span>'}
                    </div>
                </div>
                ${!isExempt ? `
                <div style="text-align:right; border-left:1px solid rgba(255,255,255,0.1); padding-left:10px;">
                    <div style="font-size:9px; color:#94a3b8;">2-Way Return (24h)</div>
                    <div style="font-size:13px; font-weight:800; color:#34d399;">₹${curReturn}</div>
                </div>` : ''}
            </div>

            <!-- Full NHAI Tariff Schedule (Single vs 2-Way) -->
            <div style="font-size:10px; color:#334155; margin-top:6px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
                <div style="background:#e2e8f0; padding:4px 8px; font-weight:700; font-size:9.5px; color:#475569; display:grid; grid-template-columns: 2fr 1fr 1fr; text-transform:uppercase;">
                    <span>Vehicle Class</span>
                    <span style="text-align:center;">1-Way</span>
                    <span style="text-align:right;">2-Way (24h)</span>
                </div>
                <div style="padding:4px 8px; display:grid; grid-template-columns: 2fr 1fr 1fr; border-bottom:1px solid #f1f5f9; ${vType==='LMV'?'background:rgba(245,158,11,0.1); font-weight:700;':''}">
                    <span>🚗 Car / LMV</span>
                    <span style="text-align:center; color:#d97706; font-weight:700;">₹${single.LMV || lmvSingle}</span>
                    <span style="text-align:right; color:#059669; font-weight:700;">₹${ret.LMV || lmvReturn}</span>
                </div>
                <div style="padding:4px 8px; display:grid; grid-template-columns: 2fr 1fr 1fr; border-bottom:1px solid #f1f5f9; ${vType==='LCV'?'background:rgba(245,158,11,0.1); font-weight:700;':''}">
                    <span>🚐 LCV / Mini-Bus</span>
                    <span style="text-align:center; color:#d97706; font-weight:700;">₹${single.LCV || Math.round(lmvSingle*1.62/5)*5}</span>
                    <span style="text-align:right; color:#059669; font-weight:700;">₹${ret.LCV || Math.round(lmvSingle*1.62*1.5/5)*5}</span>
                </div>
                <div style="padding:4px 8px; display:grid; grid-template-columns: 2fr 1fr 1fr; border-bottom:1px solid #f1f5f9; ${vType==='BUS_2AXLE'?'background:rgba(245,158,11,0.1); font-weight:700;':''}">
                    <span>🚌 Bus / 2-Axle Truck</span>
                    <span style="text-align:center; color:#d97706; font-weight:700;">₹${single.BUS_2AXLE || Math.round(lmvSingle*3.39/5)*5}</span>
                    <span style="text-align:right; color:#059669; font-weight:700;">₹${ret.BUS_2AXLE || Math.round(lmvSingle*3.39*1.5/5)*5}</span>
                </div>
                <div style="padding:4px 8px; display:grid; grid-template-columns: 2fr 1fr 1fr; border-bottom:1px solid #f1f5f9; ${vType==='COM_3AXLE'?'background:rgba(245,158,11,0.1); font-weight:700;':''}">
                    <span>🚛 3-Axle Commercial</span>
                    <span style="text-align:center; color:#d97706; font-weight:700;">₹${single.COM_3AXLE || Math.round(lmvSingle*3.70/5)*5}</span>
                    <span style="text-align:right; color:#059669; font-weight:700;">₹${ret.COM_3AXLE || Math.round(lmvSingle*3.70*1.5/5)*5}</span>
                </div>
                <div style="padding:4px 8px; display:grid; grid-template-columns: 2fr 1fr 1fr; border-bottom:1px solid #f1f5f9; ${vType==='MAV_4_6'?'background:rgba(245,158,11,0.1); font-weight:700;':''}">
                    <span>🚜 MAV (4-6 Axle)</span>
                    <span style="text-align:center; color:#d97706; font-weight:700;">₹${single.MAV_4_6 || Math.round(lmvSingle*5.32/5)*5}</span>
                    <span style="text-align:right; color:#059669; font-weight:700;">₹${ret.MAV_4_6 || Math.round(lmvSingle*5.32*1.5/5)*5}</span>
                </div>
                <div style="padding:4px 8px; display:grid; grid-template-columns: 2fr 1fr 1fr; ${vType==='OVERSIZED'?'background:rgba(245,158,11,0.1); font-weight:700;':''}">
                    <span>🏗️ Oversized (7+ Axle)</span>
                    <span style="text-align:center; color:#d97706; font-weight:700;">₹${single.OVERSIZED || Math.round(lmvSingle*6.48/5)*5}</span>
                    <span style="text-align:right; color:#059669; font-weight:700;">₹${ret.OVERSIZED || Math.round(lmvSingle*6.48*1.5/5)*5}</span>
                </div>
            </div>

            <div style="margin-top:6px; display:flex; justify-content:space-between; align-items:center; font-size:9.5px; color:#64748b;">
                <span>🎟️ Local Monthly Pass: <strong style="color:#0f172a;">₹${td.monthlyPassLocal || 360}</strong></span>
                <span style="color:#94a3b8;">${td.concessionaire || 'NHAI Managed'}</span>
            </div>
        </div>`;
    },

    _clearRoutePolylines: () => {
        IndiaMapPlanner.routePolylines.forEach(p => { try { p.remove(); } catch(e){} });
        IndiaMapPlanner.routePolylines = [];
        // Remove alt tabs
        document.getElementById('alt-route-tabs')?.remove();
        document.getElementById('route-sidebar-summary')?.classList.add('hidden');
    },

    // ═══════════════════════════════════════════════════════════════
    // ROUTE SUMMARY UPDATE
    // ═══════════════════════════════════════════════════════════════
    updateSummary: rData => {
        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
        setText('summary-title', `${rData.originName} → ${rData.destName}`);
        let displayEta = rData.totalEta + 'h';
        if (parseFloat(rData.totalEta) < 1.0) {
            displayEta = Math.round(parseFloat(rData.totalEta) * 60) + ' min';
        }
        
        const jType = IndiaMapPlanner.journeyType === 'RETURN' ? '2-Way Return (24h)' : '1-Way Single';
        setText('sum-dist',      rData.totalDist);
        setText('sum-eta',       displayEta.replace('h',''));
        setText('sum-toll',      rData.tolls.length);
        setText('sum-cost',      `₹${rData.totalTollCost}`);

        // Read Live Backend Congestion States & Admin Alerts
        const currentStates = window.Storage ? Storage.get(Storage.KEYS.TOLL_STATES, {}) : {};
        const adminAlerts = window.Storage ? Storage.get(Storage.KEYS.ADMIN_ALERTS, []) : [];

        // Render dynamic toll timeline steps & Live Traffic Breakdown
        const timelineEl = document.getElementById('route-timeline-steps');
        const summaryPanel = document.getElementById('route-sidebar-summary');
        if (timelineEl && summaryPanel) {
            summaryPanel.classList.remove('hidden');
            let html = '';

            // Check if any active admin broadcast matches this route
            if (adminAlerts.length > 0) {
                const latestAlert = adminAlerts[0];
                html += `
                    <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 10px; padding: 8px 10px; margin-bottom: 12px; display: flex; align-items: flex-start; gap: 8px;">
                        <i class="fa-solid fa-bullhorn" style="color: #f43f5e; font-size: 13px; margin-top: 2px;"></i>
                        <div style="flex:1; min-width:0;">
                            <div style="font-size: 10.5px; font-weight: 700; color: #f87171;">LIVE NHAI ALERT: ${latestAlert.title}</div>
                            <div style="font-size: 9.5px; color: #fca5a5; line-height: 1.35; margin-top: 2px;">${latestAlert.message}</div>
                        </div>
                    </div>
                `;
            }

            html += `
                <div style="position: relative; margin-bottom: 12px; z-index: 2;">
                    <div style="position: absolute; left: -22.5px; top: 3.5px; width: 8px; height: 8px; border-radius: 50%; background: var(--primary); border: 2px solid #000; box-shadow: 0 0 8px var(--primary-glow);"></div>
                    <div style="font-size: 11px; font-weight: 700; color: #fff;">${rData.originName}</div>
                    <div style="font-size: 8.5px; color: var(--text-muted);">Start of Journey • <span style="color:#38bdf8; font-weight:600;">${jType}</span></div>
                </div>
            `;
            if (rData.tolls.length > 0) {
                rData.tolls.forEach((toll, idx) => {
                    const td = window.TollSeedData?.find(s => s.id === toll.id);
                    const name = td ? td.name : (toll.name || 'NH Toll Plaza');
                    const nhBadge = (td && td.nhCorridor && td.nhCorridor !== 'N/A') ? `<span style="font-size:8px; padding:1px 4px; border-radius:3px; background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3); margin-left:4px;">NH-${td.nhCorridor}</span>` : '';
                    
                    // Check Realtime Traffic Congestion set by Admin
                    const tState = currentStates[toll.id]?.congestion || 'NORMAL';
                    let trafficTag = `<span style="font-size:8px; padding:1px 5px; border-radius:3px; background:rgba(16,185,129,0.12); color:#10b981; border:1px solid rgba(16,185,129,0.3); margin-left:4px;"><i class="fa-solid fa-circle-check"></i> Normal Flow</span>`;
                    if (tState === 'HIGH') {
                        trafficTag = `<span style="font-size:8px; padding:1px 5px; border-radius:3px; background:rgba(239,68,68,0.2); color:#f43f5e; border:1px solid rgba(239,68,68,0.4); font-weight:700; margin-left:4px;"><i class="fa-solid fa-triangle-exclamation"></i> High Traffic (+15m)</span>`;
                    } else if (tState === 'MODERATE') {
                        trafficTag = `<span style="font-size:8px; padding:1px 5px; border-radius:3px; background:rgba(245,158,11,0.2); color:#fbbf24; border:1px solid rgba(245,158,11,0.4); font-weight:600; margin-left:4px;"><i class="fa-solid fa-clock"></i> Moderate Flow</span>`;
                    }

                    const subInfo = toll.singleCost !== undefined && toll.returnCost !== undefined
                        ? `<div style="font-size:8.5px; color:#94a3b8; margin-top:2px;">1-Way: ₹${toll.singleCost} · 2-Way: ₹${toll.returnCost}</div>`
                        : '';

                    html += `
                        <div style="position: relative; margin-bottom: 12px; z-index: 2;">
                            <div style="position: absolute; left: -22px; top: 4px; width: 7px; height: 7px; border-radius: 50%; background: ${tState === 'HIGH' ? '#f43f5e' : (tState === 'MODERATE' ? '#fbbf24' : '#10b981')}; border: 1.5px solid #000; box-shadow: 0 0 6px rgba(251, 191, 36, 0.4);"></div>
                            <div>
                                <div style="font-size: 10.5px; font-weight: 600; color: #f1f5f9; display: flex; justify-content: space-between; align-items:center;">
                                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:210px;" title="${name}">📍 ${name} ${nhBadge} ${trafficTag}</span>
                                    <span style="color: ${IndiaMapPlanner.journeyType==='RETURN'?'#34d399':'var(--accent-yellow)'}; font-weight: 800; font-family:var(--font-display); font-size:11.5px; margin-left:6px; flex-shrink:0;">₹${toll.cost}</span>
                                </div>
                                ${subInfo}
                            </div>
                        </div>
                    `;
                });
            } else {
                html += `
                    <div style="position: relative; margin-bottom: 12px; z-index: 2;">
                        <div style="position: absolute; left: -22px; top: 4px; width: 7px; height: 7px; border-radius: 50%; background: #10b981; border: 1.5px solid #000;"></div>
                        <div style="font-size: 10px; color: var(--primary); font-weight: 600;">
                            ✨ Direct Highway Corridor (No Toll Plazas detected)
                        </div>
                    </div>
                `;
            }
            html += `
                <div style="position: relative; z-index: 2;">
                    <div style="position: absolute; left: -22.5px; top: 3.5px; width: 8px; height: 8px; border-radius: 50%; background: var(--accent-red); border: 2px solid #000; box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);"></div>
                    <div style="font-size: 11px; font-weight: 700; color: #fff;">${rData.destName}</div>
                    <div style="font-size: 8.5px; color: var(--text-muted);">Destination reached • ${rData.totalDist} km • ${parseFloat(rData.totalEta) < 1.0 ? Math.round(parseFloat(rData.totalEta)*60) + ' min' : rData.totalEta + 'h'}</div>
                </div>
            `;
            timelineEl.innerHTML = html;
        }

        // Mobile UX: Close side panel so map is visible and show bottom floating route window
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('nhai-sidebar');
            if (sidebar) {
                sidebar.classList.add('collapsed');
                const toggle = document.getElementById('sidebar-toggle');
                if (toggle) {
                    toggle.classList.remove('shifted');
                    const icon = toggle.querySelector('i');
                    if (icon) icon.className = 'fa-solid fa-bars';
                }
            }
            const routePanel = document.getElementById('route-summary-panel');
            if (routePanel) {
                routePanel.classList.remove('hidden');
                routePanel.classList.remove('mobile-minimized');
            }
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // TOLL ESTIMATION — corridor matching against route geometry
    // ═══════════════════════════════════════════════════════════════
    estimateTollsOnRoute: coords => {
        const rawMatched = [];
        const tollIds = new Set();

        if (!window.TollSeedData || coords.length === 0) return { tolls: [], totalTollCost: 0 };

        const vehicleType    = document.getElementById('route-vehicle-selector')?.value || document.getElementById('vehicle-type')?.value || 'LMV';
        const journeyType    = IndiaMapPlanner.journeyType || 'SINGLE';
        const isExempt       = ['GOVT','PRESS','ARMY','AMBULANCE','FIRE','POLICE','BIKE'].includes(vehicleType);
        const corridorKm     = (window.NHAI_CONFIG?.routing?.tollCorridorKm) || 2.5;
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
                    
                    let cost = 0;
                    if (!isExempt && !(IndiaMapPlanner.isSpecialVerified && vehicleType !== 'LMV')) {
                        cost = (window.TollData && TollData.getTollCost) 
                            ? TollData.getTollCost(toll.id, vehicleType, journeyType) 
                            : (toll.tollRatesByVehicleClass?.[vehicleType] || toll.baseRate || 50);
                    }
                    
                    const singleCost = isExempt ? 0 : ((toll.tollRatesByVehicleClass && toll.tollRatesByVehicleClass[vehicleType]) || toll.baseRate || 50);
                    const returnCost = isExempt ? 0 : ((toll.returnRatesByVehicleClass && toll.returnRatesByVehicleClass[vehicleType]) || Math.round((singleCost * 1.5)/5)*5);

                    rawMatched.push({ 
                        id: toll.id, 
                        name: toll.name || toll.tollName || 'NH Toll Plaza', 
                        cost: cost,
                        singleCost: singleCost,
                        returnCost: returnCost,
                        baseRate: toll.baseRate || 50,
                        lat: toll.lat,
                        lng: toll.lng,
                        coordIndex: i
                    });
                    break;
                }
            }
        });

        // 1. Sort raw matched tolls sequentially by route progression (from Origin -> Destination)
        rawMatched.sort((a, b) => a.coordIndex - b.coordIndex);

        // 2. Intelligent NHAI spatial deduplication (merges duplicate slip lanes & ramp slips within 12km)
        const tolls = [];
        let totalTollCost = 0;
        
        rawMatched.forEach(t => {
            if (tolls.length === 0) {
                tolls.push(t);
                totalTollCost += t.cost;
            } else {
                const last = tolls[tolls.length - 1];
                const indexDiff = Math.abs(t.coordIndex - last.coordIndex);
                const approxDistKm = (indexDiff / coords.length) * (parseFloat(IndiaMapPlanner.selectedRouteData?.totalDist || 100));
                
                if (approxDistKm < 12.0) {
                    // Within 12km of previous toll on same highway: keep the mainline/higher tariff barrier
                    if (t.cost > last.cost) {
                        totalTollCost -= last.cost;
                        tolls[tolls.length - 1] = t;
                        totalTollCost += t.cost;
                    }
                } else {
                    tolls.push(t);
                    totalTollCost += t.cost;
                }
            }
        });

        console.log(`[TollEngine] Matched ${tolls.length} tolls in journey order for vehicle ${vehicleType}. Total Cost: ₹${totalTollCost}`);
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

        if (window.Gamification && elements.length > 0) {
            Gamification.unlockAchievement('fuel_stop', 'Eco-Drive', 150);
        }

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
    startLiveTrip: async () => {
        if (!IndiaMapPlanner.selectedRouteData) { Utils.showToast('Calculate a route first.', 'error'); return; }
        if (!IndiaMapPlanner.routeCoordinates.length) { Utils.showToast('No route geometry available.', 'error'); return; }

        // Enforce Face Recognition security check
        if (window.FaceAuth) {
            try {
                const verified = await FaceAuth.verify();
                if (!verified) return;
            } catch (e) {
                console.error('[FaceAuth] Verification failed:', e);
                return;
            }
        }

        const estimatedCost = IndiaMapPlanner.selectedRouteData?.totalTollCost || 0;
        const currentBalance = Storage.get(Storage.KEYS.FASTAG_BALANCE, 0);
        if (currentBalance < estimatedCost) {
            Utils.showToast(
                `Insufficient FASTag balance. Estimated cost: ₹${estimatedCost}, Balance: ₹${currentBalance}. Recharge before starting.`,
                'warning'
            );
            // Don't block — let user decide. Just warn.
        }

        IndiaMapPlanner.isTripLive    = true;
        IndiaMapPlanner.chargedTollIds = new Set();
        IndiaMapPlanner.tripTollsPassed = [];
        IndiaMapPlanner.tripTotalCost  = 0;

        const tripId = Utils.generateId('TRIP');
        IndiaMapPlanner.currentTripId = tripId;
        const vType = document.getElementById('vehicle-type')?.value || 'LMV';

        Storage.logTripStart({ id: tripId, origin: IndiaMapPlanner.selectedRouteData.originName, dest: IndiaMapPlanner.selectedRouteData.destName, vehicleType: vType, isSpecial: IndiaMapPlanner.isSpecialVerified, timestamp: new Date().toISOString() });

        if (window.Gamification) {
            Gamification.unlockAchievement('first_trip', 'FASTag Hero', 250);
        }

        Utils.toggleVisibility('btn-start-trip', false);
        Utils.toggleVisibility('btn-end-trip',   true);

        // Remove ALT ROUTE tabs and unselected polylines so only active route is visible
        document.getElementById('alt-route-tabs')?.remove();
        if (IndiaMapPlanner.routePolylines && IndiaMapPlanner.routePolylines.length > 0) {
            IndiaMapPlanner.routePolylines.forEach((p, idx) => {
                if (idx !== IndiaMapPlanner.selectedRouteIndex) {
                    try { IndiaMapPlanner.map.removeLayer(p); } catch(e){}
                }
            });
            const activeLine = IndiaMapPlanner.routePolylines[IndiaMapPlanner.selectedRouteIndex];
            IndiaMapPlanner.routePolylines = activeLine ? [activeLine] : [];
            IndiaMapPlanner.selectedRouteIndex = 0;
        }

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

        const speedMs = parseInt(document.getElementById('sim-speed')?.value || 600);
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
        }, speedMs);

        // Allow real-time speed adjustment via the slider
        const simSpeedInput = document.getElementById('sim-speed');
        if (simSpeedInput) {
            simSpeedInput.addEventListener('input', (e) => {
                if (IndiaMapPlanner.isTripLive && IndiaMapPlanner.tripInterval) {
                    clearInterval(IndiaMapPlanner.tripInterval);
                    const newSpeed = parseInt(e.target.value || 600);
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
                    }, newSpeed);
                }
            });
        }
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
            
            if (window.Gamification) {
                Gamification.addXP(Math.floor(dist * 0.5) + 50, 'Completed Trip');
            }

            if (window.EmailAlerts) EmailAlerts.sendTripEmail(tripData);
            if (window.TripAnalytics) TripAnalytics.init();

            const vType = document.getElementById('vehicle-type')?.value || 'LMV';
            // Populate and show Receipt Modal
            const receiptEl = document.getElementById('receipt-content');
            if (receiptEl) {
                receiptEl.innerHTML = `
                    <div style="margin-bottom: 10px;"><strong>Trip ID:</strong> ${IndiaMapPlanner.currentTripId}</div>
                    <div style="margin-bottom: 10px;"><strong>Date:</strong> ${new Date().toLocaleString()}</div>
                    <div style="margin-bottom: 10px;"><strong>Vehicle:</strong> ${vType}</div>
                    <hr style="border:0; border-top:1px dashed rgba(255,255,255,0.2); margin:10px 0;">
                    <div style="display:flex; justify-content:space-between;"><span>Route:</span> <span>${IndiaMapPlanner.selectedRouteData.originName} to ${IndiaMapPlanner.selectedRouteData.destName}</span></div>
                    <div style="display:flex; justify-content:space-between;"><span>Distance:</span> <span>${dist} km</span></div>
                    <div style="display:flex; justify-content:space-between;"><span>Tolls Passed:</span> <span>${IndiaMapPlanner.tripTollsPassed.length}</span></div>
                    <hr style="border:0; border-top:1px dashed rgba(255,255,255,0.2); margin:10px 0;">
                    <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:bold; color:var(--primary);">
                        <span>TOTAL DEDUCTED:</span> <span>₹${IndiaMapPlanner.tripTotalCost}</span>
                    </div>
                `;
                Utils.toggleVisibility('trip-receipt-modal', true);
            }
            
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
        if (!IndiaMapPlanner.selectedRouteData || !IndiaMapPlanner.selectedRouteData.tolls) return;
        if (!document.getElementById('pref-fastag')?.checked) return;
        
        const vehicleType = document.getElementById('route-vehicle-selector')?.value || document.getElementById('vehicle-type')?.value || 'LMV';
        
        IndiaMapPlanner.selectedRouteData.tolls.forEach(routeToll => {
            if (IndiaMapPlanner.chargedTollIds.has(routeToll.id)) return;
            const toll = window.TollSeedData?.find(s => s.id === routeToll.id);
            if (!toll) return;
            
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
                style: { color: '#8da672', weight: 0.8, opacity: 0.25, fillOpacity: 0 },
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
    _currentVehicleAvatar: 'default',
    _vehicleTypes: ['default', 'car_red', 'suv_blue', 'ev_green', 'camper', 'scooter', 'motorcycle', 'truck', 'bus'],
    _vehicleNames: {
        'default': 'Classic Dot',
        'car_red': 'Sports Car',
        'suv_blue': 'Cool SUV',
        'ev_green': 'Electric EV',
        'camper': 'Camper Van',
        'scooter': 'Scooter',
        'motorcycle': 'Super Bike',
        'truck': 'Heavy Truck',
        'bus': 'Highway Bus'
    },
    _vehicleIcons: {
        'default': '<div class="dock-radar-beacon"><div class="dock-radar-beacon-ring"></div><div class="dock-radar-beacon-crosshair"></div><div class="dock-radar-beacon-core"></div></div>',
        
        'car_red': `<svg viewBox="0 0 64 64" width="38" height="38" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
            <ellipse cx="32" cy="54" rx="24" ry="5" fill="rgba(0,0,0,0.3)"/>
            <path d="M12 40 L20 22 L44 22 L52 40 L56 46 L8 46 Z" fill="url(#gRedCar)"/>
            <path d="M22 24 L25 36 L39 36 L42 24 Z" fill="url(#gGlass)"/>
            <circle cx="18" cy="46" r="6" fill="#0f172a"/><circle cx="18" cy="46" r="3" fill="#94a3b8"/>
            <circle cx="46" cy="46" r="6" fill="#0f172a"/><circle cx="46" cy="46" r="3" fill="#94a3b8"/>
            <polygon points="46,20 54,20 52,23 48,23" fill="#1e293b"/>
            <rect x="7" y="41" width="4" height="3" rx="1" fill="#facc15"/>
            <rect x="53" y="41" width="4" height="3" rx="1" fill="#facc15"/>
            <defs>
                <linearGradient id="gRedCar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f87171"/><stop offset="50%" stop-color="#ef4444"/><stop offset="100%" stop-color="#991b1b"/></linearGradient>
                <linearGradient id="gGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7dd3fc"/><stop offset="100%" stop-color="#0284c7"/></linearGradient>
            </defs>
        </svg>`,
        
        'suv_blue': `<svg viewBox="0 0 64 64" width="38" height="38" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
            <ellipse cx="32" cy="54" rx="24" ry="5" fill="rgba(0,0,0,0.3)"/>
            <rect x="18" y="14" width="28" height="3" rx="1" fill="#475569"/>
            <path d="M10 42 L16 18 L48 18 L54 42 L56 46 L8 46 Z" fill="url(#gBlueSuv)"/>
            <path d="M18 20 L22 34 L32 34 L32 20 Z" fill="url(#gGlass)"/>
            <path d="M34 20 L34 34 L44 34 L46 20 Z" fill="url(#gGlass)"/>
            <circle cx="18" cy="46" r="7" fill="#0f172a"/><circle cx="18" cy="46" r="3.5" fill="#cbd5e1"/>
            <circle cx="46" cy="46" r="7" fill="#0f172a"/><circle cx="46" cy="46" r="3.5" fill="#cbd5e1"/>
            <defs>
                <linearGradient id="gBlueSuv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#38bdf8"/><stop offset="50%" stop-color="#0284c7"/><stop offset="100%" stop-color="#075985"/></linearGradient>
            </defs>
        </svg>`,
        
        'ev_green': `<svg viewBox="0 0 64 64" width="38" height="38" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
            <ellipse cx="32" cy="54" rx="24" ry="5" fill="rgba(16,185,129,0.35)"/>
            <path d="M12 40 Q20 18 32 18 Q44 18 52 40 L54 46 L10 46 Z" fill="url(#gEvGreen)"/>
            <path d="M20 23 Q32 21 44 23 L42 34 L22 34 Z" fill="url(#gGlass)"/>
            <circle cx="18" cy="46" r="6" fill="#0f172a"/><circle cx="18" cy="46" r="2.5" fill="#10b981"/>
            <circle cx="46" cy="46" r="6" fill="#0f172a"/><circle cx="46" cy="46" r="2.5" fill="#10b981"/>
            <polygon points="32,38 29,43 33,43 31,48 35,42 32,42" fill="#10b981"/>
            <defs>
                <linearGradient id="gEvGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#34d399"/><stop offset="50%" stop-color="#10b981"/><stop offset="100%" stop-color="#065f46"/></linearGradient>
            </defs>
        </svg>`,
        
        'camper': `<svg viewBox="0 0 64 64" width="38" height="38" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
            <ellipse cx="32" cy="54" rx="24" ry="5" fill="rgba(0,0,0,0.3)"/>
            <rect x="8" y="16" width="48" height="30" rx="6" fill="url(#gCamper)"/>
            <rect x="14" y="20" width="12" height="12" rx="2" fill="url(#gGlass)"/>
            <rect x="30" y="20" width="12" height="12" rx="2" fill="url(#gGlass)"/>
            <circle cx="18" cy="46" r="6" fill="#0f172a"/><circle cx="18" cy="46" r="3" fill="#e2e8f0"/>
            <circle cx="46" cy="46" r="6" fill="#0f172a"/><circle cx="46" cy="46" r="3" fill="#e2e8f0"/>
            <defs>
                <linearGradient id="gCamper" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fb923c"/><stop offset="50%" stop-color="#ea580c"/><stop offset="100%" stop-color="#9a3412"/></linearGradient>
            </defs>
        </svg>`,
        
        'scooter': `<svg viewBox="0 0 64 64" width="38" height="38" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
            <ellipse cx="32" cy="54" rx="20" ry="4" fill="rgba(0,0,0,0.3)"/>
            <circle cx="16" cy="46" r="6" fill="#0f172a"/><circle cx="16" cy="46" r="3" fill="#cbd5e1"/>
            <circle cx="48" cy="46" r="6" fill="#0f172a"/><circle cx="48" cy="46" r="3" fill="#cbd5e1"/>
            <path d="M16 46 L26 46 L34 38 L42 22 L46 22" stroke="#06b6d4" stroke-width="4" fill="none" stroke-linecap="round"/>
            <path d="M26 46 L30 32 L38 32 L34 46 Z" fill="#0891b2"/>
            <circle cx="46" cy="20" r="3" fill="#facc15"/>
        </svg>`,
        
        'motorcycle': `<svg viewBox="0 0 64 64" width="38" height="38" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
            <ellipse cx="32" cy="54" rx="22" ry="4" fill="rgba(0,0,0,0.3)"/>
            <circle cx="14" cy="44" r="7" fill="#0f172a"/><circle cx="14" cy="44" r="3.5" fill="#f59e0b"/>
            <circle cx="50" cy="44" r="7" fill="#0f172a"/><circle cx="50" cy="44" r="3.5" fill="#f59e0b"/>
            <path d="M14 44 L28 32 L40 32 L50 44" stroke="#e11d48" stroke-width="5" fill="none" stroke-linecap="round"/>
            <path d="M26 30 L36 24 L44 26 L42 34 Z" fill="#be123c"/>
            <path d="M42 26 L46 20 L48 20" stroke="#475569" stroke-width="3" fill="none" stroke-linecap="round"/>
        </svg>`,
        
        'truck': `<svg viewBox="0 0 64 64" width="38" height="38" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
            <ellipse cx="32" cy="54" rx="26" ry="5" fill="rgba(0,0,0,0.3)"/>
            <rect x="6" y="16" width="32" height="28" rx="2" fill="url(#gTruckTrailer)"/>
            <path d="M38 24 L46 24 L52 34 L52 44 L38 44 Z" fill="url(#gTruckCab)"/>
            <path d="M44 26 L48 26 L50 32 L44 32 Z" fill="url(#gGlass)"/>
            <circle cx="14" cy="46" r="6" fill="#0f172a"/><circle cx="14" cy="46" r="2.5" fill="#94a3b8"/>
            <circle cx="28" cy="46" r="6" fill="#0f172a"/><circle cx="28" cy="46" r="2.5" fill="#94a3b8"/>
            <circle cx="46" cy="46" r="6" fill="#0f172a"/><circle cx="46" cy="46" r="2.5" fill="#94a3b8"/>
            <defs>
                <linearGradient id="gTruckTrailer" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#94a3b8"/><stop offset="100%" stop-color="#475569"/></linearGradient>
                <linearGradient id="gTruckCab" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#b45309"/></linearGradient>
            </defs>
        </svg>`,
        
        'bus': `<svg viewBox="0 0 64 64" width="38" height="38" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
            <ellipse cx="32" cy="54" rx="26" ry="5" fill="rgba(0,0,0,0.3)"/>
            <rect x="6" y="16" width="52" height="28" rx="6" fill="url(#gBus)"/>
            <rect x="10" y="20" width="8" height="10" rx="1.5" fill="url(#gGlass)"/>
            <rect x="20" y="20" width="8" height="10" rx="1.5" fill="url(#gGlass)"/>
            <rect x="30" y="20" width="8" height="10" rx="1.5" fill="url(#gGlass)"/>
            <rect x="40" y="20" width="8" height="10" rx="1.5" fill="url(#gGlass)"/>
            <rect x="50" y="20" width="6" height="14" rx="1.5" fill="url(#gGlass)"/>
            <circle cx="16" cy="46" r="6" fill="#0f172a"/><circle cx="16" cy="46" r="2.5" fill="#e2e8f0"/>
            <circle cx="46" cy="46" r="6" fill="#0f172a"/><circle cx="46" cy="46" r="2.5" fill="#e2e8f0"/>
            <defs>
                <linearGradient id="gBus" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8b5cf6"/><stop offset="50%" stop-color="#6d28d9"/><stop offset="100%" stop-color="#4c1d95"/></linearGradient>
            </defs>
        </svg>`
    },

    _getOriginPinIcon: (name = 'Start') => {
        return L.divIcon({
            className: 'custom-pin-container',
            html: `
                <div style="position:relative; display:flex; flex-direction:column; align-items:center;">
                    <div style="background:rgba(15,23,42,0.95); color:#34d399; font-size:10px; font-weight:800; padding:3px 9px; border-radius:12px; border:1.5px solid #10b981; white-space:nowrap; box-shadow:0 4px 12px rgba(0,0,0,0.6); margin-bottom:2px;">📍 ${name}</div>
                    <svg viewBox="0 0 32 32" width="28" height="28" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,0.7));">
                        <circle cx="16" cy="14" r="10" fill="#10b981" stroke="#ffffff" stroke-width="2.5"/>
                        <circle cx="16" cy="14" r="4" fill="#ffffff"/>
                        <path d="M16 24 L16 30" stroke="#10b981" stroke-width="3.5" stroke-linecap="round"/>
                    </svg>
                </div>
            `,
            iconSize: [120, 52],
            iconAnchor: [60, 50]
        });
    },

    _getDestPinIcon: (name = 'Destination') => {
        return L.divIcon({
            className: 'custom-pin-container',
            html: `
                <div style="position:relative; display:flex; flex-direction:column; align-items:center;">
                    <div style="background:rgba(15,23,42,0.95); color:#f87171; font-size:10px; font-weight:800; padding:3px 9px; border-radius:12px; border:1.5px solid #ef4444; white-space:nowrap; box-shadow:0 4px 12px rgba(0,0,0,0.6); margin-bottom:2px;">🏁 ${name}</div>
                    <svg viewBox="0 0 32 32" width="28" height="28" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,0.7));">
                        <circle cx="16" cy="14" r="10" fill="#ef4444" stroke="#ffffff" stroke-width="2.5"/>
                        <circle cx="16" cy="14" r="4" fill="#ffffff"/>
                        <path d="M16 24 L16 30" stroke="#ef4444" stroke-width="3.5" stroke-linecap="round"/>
                    </svg>
                </div>
            `,
            iconSize: [120, 52],
            iconAnchor: [60, 50]
        });
    },

    setUserLocation: (lat, lng, locName = 'My Location') => {
        if (!lat || !lng) return;
        if (IndiaMapPlanner.userLocationMarker) {
            try { IndiaMapPlanner.userLocationMarker.remove(); } catch(e){}
        }
        IndiaMapPlanner.userLocationMarker = L.marker([lat, lng], { 
            icon: IndiaMapPlanner._getUserLocIcon(), 
            zIndexOffset: 2000 
        })
        .bindTooltip(`📍 ${locName}`, { permanent: false, direction: 'top' })
        .addTo(IndiaMapPlanner.map);

        if (IndiaMapPlanner.map) {
            IndiaMapPlanner.map.flyTo([lat, lng], 14, { duration: 1.2 });
        }
    },

    setOriginMarker: (place) => {
        if (!place || !place.lat || !place.lng) return;
        if (place.isCurrentLoc || place.name === 'My Current Location') {
            IndiaMapPlanner.setUserLocation(place.lat, place.lng, 'My Current Location');
            return;
        }
        if (IndiaMapPlanner.originMarker) {
            try { IndiaMapPlanner.originMarker.remove(); } catch(e){}
        }
        IndiaMapPlanner.originMarker = L.marker([place.lat, place.lng], {
            icon: IndiaMapPlanner._getOriginPinIcon(place.name),
            zIndexOffset: 1200
        }).addTo(IndiaMapPlanner.map);
        
        if (IndiaMapPlanner.map) {
            IndiaMapPlanner.map.flyTo([place.lat, place.lng], 13, { duration: 1.2 });
        }
    },

    setDestMarker: (place) => {
        if (!place || !place.lat || !place.lng) return;
        if (IndiaMapPlanner.destMarker) {
            try { IndiaMapPlanner.destMarker.remove(); } catch(e){}
        }
        IndiaMapPlanner.destMarker = L.marker([place.lat, place.lng], {
            icon: IndiaMapPlanner._getDestPinIcon(place.name),
            zIndexOffset: 1200
        }).addTo(IndiaMapPlanner.map);
        
        if (IndiaMapPlanner.map) {
            IndiaMapPlanner.map.flyTo([place.lat, place.lng], 13, { duration: 1.2 });
        }
    },

    _getUserLocIcon: () => {
        if (!IndiaMapPlanner._currentVehicleAvatar || IndiaMapPlanner._currentVehicleAvatar === 'default') {
            return L.divIcon({
                className: 'custom-user-loc-container',
                html: `
                    <div class="kokonut-dot">
                        <div class="kokonut-dot-badge">📍 MY LOCATION</div>
                        <div class="kokonut-dot-radar"></div>
                        <div class="kokonut-dot-ring"></div>
                        <div class="kokonut-dot-core"></div>
                    </div>
                `,
                iconSize: [60, 60],
                iconAnchor: [30, 30]
            });
        }
        const svgContent = IndiaMapPlanner._vehicleIcons[IndiaMapPlanner._currentVehicleAvatar] || '📍';
        const name = IndiaMapPlanner._vehicleNames[IndiaMapPlanner._currentVehicleAvatar] || 'My Vehicle';
        return L.divIcon({
            className: 'custom-user-loc-container',
            html: `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative; width:60px; height:60px;">
                    <div class="kokonut-dot-badge" style="top:-18px;">🚗 ${name.toUpperCase()}</div>
                    <div class="kokonut-dot-radar" style="position:absolute; top:0; left:0; width:60px; height:60px;"></div>
                    <div style="transform: perspective(120px) rotateX(15deg) translateY(-2px); filter: drop-shadow(0 10px 14px rgba(0,0,0,0.65)); transition: all 0.3s ease; position:relative; z-index:5;">
                        ${svgContent}
                    </div>
                </div>
            `,
            iconSize: [60, 60],
            iconAnchor: [30, 30]
        });
    },

    _addLayerToggle: () => {
        const container = document.createElement('div');
        container.className = 'reactbits-dock-container';
        container.id = 'map-layer-controls';

        const dock = document.createElement('div');
        dock.className = 'reactbits-dock';

        // 1. Locate Me Item
        const btnLocate = document.createElement('div');
        btnLocate.className = 'reactbits-dock-item';
        btnLocate.id = 'btn-locate-me-dynamic';
        btnLocate.innerHTML = `
            <i class="fa-solid fa-location-crosshairs"></i>
            <div class="reactbits-dock-label">Locate Me</div>
        `;
        
        btnLocate.addEventListener('click', () => {
            btnLocate.style.transform = 'scale(0.88)';
            setTimeout(() => btnLocate.style.transform = 'scale(1)', 150);

            const iconEl = btnLocate.querySelector('i');
            if (iconEl) iconEl.className = 'fa-solid fa-spinner fa-spin';
            btnLocate.classList.add('active');
            
            IndiaMapPlanner.getReliableUserLocation(
                (loc) => {
                    const lat = loc.lat;
                    const lng = loc.lng;
                    if (iconEl) iconEl.className = 'fa-solid fa-location-crosshairs';
                    btnLocate.classList.remove('active');
                    if (IndiaMapPlanner.map) IndiaMapPlanner.map.flyTo([lat, lng], 13, { duration: 1.2 });
                    
                    if (IndiaMapPlanner.userLocationMarker) IndiaMapPlanner.userLocationMarker.remove();
                    IndiaMapPlanner.userLocationMarker = L.marker([lat, lng], { icon: IndiaMapPlanner._getUserLocIcon() })
                        .bindTooltip("My Location 📍", { permanent: false, direction: 'top' })
                        .addTo(IndiaMapPlanner.map);
                    Utils.showToast(`Located successfully via ${loc.source || 'GPS'}! 📍`, "success");
                    const state = IndiaMapPlanner._getLocalStateFromCoords(lat, lng) || loc.state;
                    if (state) IndiaMapPlanner.fetchLiveNewsAlerts(state);
                },
                () => {
                    if (iconEl) iconEl.className = 'fa-solid fa-location-crosshairs';
                    btnLocate.classList.remove('active');
                    Utils.showToast("Could not retrieve GPS or network location.", "error");
                }
            );
        });

        // 2. Vehicle Avatar Switcher (Classic Dot / 3D Avatars Popup)
        const btnVehicle = document.createElement('div');
        btnVehicle.className = 'reactbits-dock-item has-active';
        btnVehicle.id = 'btn-avatar-dock';
        
        const updateAvatarItem = () => {
            const v = IndiaMapPlanner._currentVehicleAvatar || 'default';
            const label = IndiaMapPlanner._vehicleNames[v] || 'Classic Dot';
            const icon = IndiaMapPlanner._vehicleIcons[v] || '📍';
            btnVehicle.innerHTML = `
                <span style="display: flex; align-items: center; justify-content: center; font-size: 20px;">${icon}</span>
                <div class="reactbits-dock-label" id="dock-avatar-label">Avatar: ${label}</div>
            `;
        };
        updateAvatarItem();

        let avatarPopupEl = null;

        const closeAvatarPopup = () => {
            if (avatarPopupEl) {
                avatarPopupEl.remove();
                avatarPopupEl = null;
            }
        };

        const openAvatarPopup = () => {
            closeAvatarPopup();
            avatarPopupEl = document.createElement('div');
            avatarPopupEl.className = 'dock-avatar-popup';
            
            avatarPopupEl.innerHTML = `
                <div class="dock-avatar-header">
                    <span class="dock-avatar-title"><i class="fa-solid fa-car-side" style="color:var(--primary);"></i> Choose 3D Avatar</span>
                    <button class="dock-avatar-close" id="btn-close-avatar-popup"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="dock-avatar-grid">
                    ${IndiaMapPlanner._vehicleTypes.map(key => {
                        const isSelected = (IndiaMapPlanner._currentVehicleAvatar || 'default') === key;
                        const icon = IndiaMapPlanner._vehicleIcons[key] || '📍';
                        const name = IndiaMapPlanner._vehicleNames[key] || key;
                        return `
                            <div class="avatar-option-card ${isSelected ? 'selected' : ''}" data-avatar="${key}">
                                <div class="avatar-option-preview">${icon}</div>
                                <div class="avatar-option-name">${name}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;

            container.appendChild(avatarPopupEl);

            avatarPopupEl.querySelector('#btn-close-avatar-popup')?.addEventListener('click', (e) => {
                e.stopPropagation();
                closeAvatarPopup();
            });

            avatarPopupEl.querySelectorAll('.avatar-option-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const chosen = card.dataset.avatar;
                    IndiaMapPlanner._currentVehicleAvatar = chosen;
                    updateAvatarItem();
                    
                    if (IndiaMapPlanner.userLocationMarker) {
                        const latlng = IndiaMapPlanner.userLocationMarker.getLatLng();
                        IndiaMapPlanner.userLocationMarker.remove();
                        IndiaMapPlanner.userLocationMarker = L.marker(latlng, { icon: IndiaMapPlanner._getUserLocIcon() })
                            .bindTooltip("My Location", { permanent: false, direction: 'top' })
                            .addTo(IndiaMapPlanner.map);
                    }

                    const name = IndiaMapPlanner._vehicleNames[chosen] || chosen;
                    Utils.showToast(`${name} avatar selected! 🚗`, "success");
                    closeAvatarPopup();
                });
            });
        };

        btnVehicle.addEventListener('click', (e) => {
            e.stopPropagation();
            btnVehicle.style.transform = 'scale(0.88)';
            setTimeout(() => btnVehicle.style.transform = 'scale(1)', 150);

            if (avatarPopupEl) {
                closeAvatarPopup();
            } else {
                openAvatarPopup();
            }
        });

        document.addEventListener('click', (e) => {
            if (avatarPopupEl && !avatarPopupEl.contains(e.target) && !btnVehicle.contains(e.target)) {
                closeAvatarPopup();
            }
        });

        // 3. Satellite / Dark View Toggle (Seamless Map Tile Switcher)
        const btnLayer = document.createElement('div');
        btnLayer.className = 'reactbits-dock-item';
        btnLayer.id = 'btn-layer-dock';

        const updateLayerBtn = () => {
            if (IndiaMapPlanner._isSatellite) {
                btnLayer.innerHTML = `
                    <i class="fa-solid fa-moon"></i>
                    <div class="reactbits-dock-label" id="dock-layer-label">Dark Mode</div>
                `;
            } else {
                btnLayer.innerHTML = `
                    <i class="fa-solid fa-satellite"></i>
                    <div class="reactbits-dock-label" id="dock-layer-label">Satellite View</div>
                `;
            }
        };
        updateLayerBtn();

        btnLayer.addEventListener('click', () => {
            btnLayer.style.transform = 'scale(0.88)';
            setTimeout(() => btnLayer.style.transform = 'scale(1)', 150);

            if (IndiaMapPlanner._isSatellite) {
                // Switch from Satellite -> Dark Mode
                if (IndiaMapPlanner.map) {
                    if (IndiaMapPlanner._satelliteLayer) IndiaMapPlanner.map.removeLayer(IndiaMapPlanner._satelliteLayer);
                    if (IndiaMapPlanner._labelsLayer) IndiaMapPlanner.map.removeLayer(IndiaMapPlanner._labelsLayer);
                    if (IndiaMapPlanner._streetLayer) IndiaMapPlanner._streetLayer.addTo(IndiaMapPlanner.map);
                }
                IndiaMapPlanner._isSatellite = false;
                updateLayerBtn();
                Utils.showToast("Dark Mode enabled 🌙", "info");
            } else {
                // Switch from Dark Mode -> Satellite Mode
                if (IndiaMapPlanner.map) {
                    if (IndiaMapPlanner._streetLayer) IndiaMapPlanner.map.removeLayer(IndiaMapPlanner._streetLayer);
                    if (IndiaMapPlanner._satelliteLayer) IndiaMapPlanner._satelliteLayer.addTo(IndiaMapPlanner.map);
                    if (IndiaMapPlanner._labelsLayer) IndiaMapPlanner._labelsLayer.addTo(IndiaMapPlanner.map);
                }
                IndiaMapPlanner._isSatellite = true;
                updateLayerBtn();
                Utils.showToast("Satellite View enabled 🛰️", "info");
            }
        });

        dock.appendChild(btnLocate);
        dock.appendChild(btnVehicle);
        dock.appendChild(btnLayer);
        container.appendChild(dock);

        // React Bits Dock Proximity Magnification Engine
        const items = [btnLocate, btnVehicle, btnLayer];
        const maxDistance = 110; // Proximity threshold in pixels
        const maxScale = 0.38;   // Max scale boost (up to 1.38x)

        dock.addEventListener('mousemove', (e) => {
            const mouseX = e.clientX;
            items.forEach((item) => {
                const rect = item.getBoundingClientRect();
                const itemCenterX = rect.left + rect.width / 2;
                const distance = Math.abs(mouseX - itemCenterX);

                if (distance < maxDistance) {
                    const cosFactor = Math.cos((distance / maxDistance) * (Math.PI / 2));
                    const scale = 1 + cosFactor * maxScale;
                    const translateY = -(scale - 1) * 10;
                    item.style.transform = `scale(${scale.toFixed(3)}) translateY(${translateY.toFixed(1)}px)`;

                    if (distance < 38) {
                        item.classList.add('show-label');
                    } else {
                        item.classList.remove('show-label');
                    }
                } else {
                    item.style.transform = 'scale(1) translateY(0)';
                    item.classList.remove('show-label');
                }
            });
        });

        dock.addEventListener('mouseleave', () => {
            items.forEach((item) => {
                item.style.transform = 'scale(1) translateY(0)';
                item.classList.remove('show-label');
            });
        });

        const targetParent = document.getElementById('user-app') || document.getElementById('map') || document.body;
        if (targetParent) targetParent.appendChild(container);
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



    _getLocalStateFromCoords: (lat, lng) => {
        if (!window.IndiaMapData || !IndiaMapData.cities) return '';
        let minDist = Infinity;
        let closestCity = null;
        IndiaMapData.cities.forEach(c => {
            const dy = c.lat - lat;
            const dx = c.lng - lng;
            const dist = dy * dy + dx * dx;
            if (dist < minDist) {
                minDist = dist;
                closestCity = c;
            }
        });
        return closestCity ? closestCity.state : '';
    }
};

window.IndiaMapPlanner = IndiaMapPlanner;

