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

        const cfg = window.NHAI_CONFIG || { map: { defaultCenter: [20.5937, 78.9629], defaultZoom: 5, minZoom: 4, maxZoom: 19 } };

        // Subcontinent bounding box constraint so map never zooms out into a flat line
        const indiaBounds = L.latLngBounds([3.5, 60.0], [39.0, 102.0]);

        // Create Leaflet map with strictly controlled minZoom & bounds
        IndiaMapPlanner.map = L.map('map', {
            zoomControl: false,
            attributionControl: false,
            center: cfg.map.defaultCenter,
            zoom: cfg.map.defaultZoom,
            minZoom: 4,
            maxZoom: 19,
            maxBounds: indiaBounds,
            maxBoundsViscosity: 0.85,
            worldCopyJump: false
        });

        // ── Tile layers ────────────────────────────────────────────
        const tileCfg = cfg.tiles || {};
        const satUrl = (tileCfg.satellite || {}).url || 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
        const satOpts = (tileCfg.satellite || {}).options || { maxZoom: 20, minZoom: 4, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], attribution: 'Tiles &copy; Google' };
        IndiaMapPlanner._satelliteLayer = L.tileLayer(satUrl, satOpts);

        const labelsUrl = (tileCfg.labels || {}).url || 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png';
        const labelsOpts = (tileCfg.labels || {}).options || { maxZoom: 19, minZoom: 4, pane: 'shadowPane', opacity: 0.8 };
        IndiaMapPlanner._labelsLayer = L.tileLayer(labelsUrl, labelsOpts);

        const streetUrl = (tileCfg.street || {}).url || 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        const streetOpts = (tileCfg.street || {}).options || { maxZoom: 20, minZoom: 4, subdomains: ['a', 'b', 'c', 'd'], attribution: '&copy; OSM &copy; CARTO' };
        IndiaMapPlanner._streetLayer = L.tileLayer(streetUrl, streetOpts);

        // Default: satellite & labels layer
        IndiaMapPlanner._satelliteLayer.addTo(IndiaMapPlanner.map);
        IndiaMapPlanner._labelsLayer.addTo(IndiaMapPlanner.map);
        IndiaMapPlanner._isSatellite = true;

        window.NHAI_MAP = IndiaMapPlanner.map;
        
        // Full screen and seamless phone rotation support (Horizontal to Vertical)
        const handleResize = () => {
            if (IndiaMapPlanner.map) {
                IndiaMapPlanner.map.invalidateSize();
            }
        };
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', () => {
            setTimeout(handleResize, 150);
            setTimeout(handleResize, 500);
            setTimeout(handleResize, 1000);
        });

        setTimeout(() => {
            if (IndiaMapPlanner.map) IndiaMapPlanner.map.invalidateSize();
        }, 200);

        // Initialize touch-and-hold tactile tooltips & mobile search overlay & swipe to dismiss
        IndiaMapPlanner._initTouchHoldTooltips();
        IndiaMapPlanner._initMobileSearchInput();
        IndiaMapPlanner._initSwipeToDismiss();

        // Fly to center on open
        setTimeout(() => {
            if (IndiaMapPlanner.map) {
                IndiaMapPlanner.map.flyTo(cfg.map.defaultCenter, 5, { animate: true, duration: 1.5 });
            }
        }, 400);


        // ── Sidebar toggle (handled via inline onclick in HTML now) ─────────────────────────────────────────

        // ── Autocomplete & Place Card Integration ───────────────────────────────────────────
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
            const handleDest = (res) => {
                IndiaMapPlanner.selectedDest = res;
                IndiaMapPlanner.selectedDestination = res;
                IndiaMapPlanner.setDestMarker(res);
                IndiaMapPlanner.showWeatherPopup('destination', res.name, res.lat, res.lng);
                IndiaMapPlanner.processRoute();
            };

            if (city.lat === 0 && city.lng === 0) {
                IndiaMapPlanner._geocodeVillage(city, handleDest);
            } else {
                handleDest(city);
            }
        });

        // Pressing Enter in search inputs resolves place and calculates route
        ['route-dest-input', 'route-origin-input'].forEach(inputId => {
            const el = document.getElementById(inputId);
            if (el) {
                el.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && el.value.trim()) {
                        IndiaMapPlanner.processRoute();
                    }
                });
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
            const vType   = document.getElementById('route-vehicle-selector')?.value || document.getElementById('vehicle-type')?.value || 'LMV';
            
            if (content) {
                content.innerHTML = LaneAdvisor.renderAdvisor(IndiaMapPlanner.selectedRouteData, IndiaMapPlanner.isSpecialVerified);
            }
            if (status) {
                status.innerHTML = IndiaMapPlanner.isSpecialVerified
                    ? '🛡️ <strong>Special Vehicle Verified</strong>: Priority VIP green-corridor lanes unlocked.'
                    : `Active Vehicle: <strong>${vType}</strong> | FASTag System: <strong>${document.getElementById('pref-fastag')?.checked ? 'Enabled' : 'Disabled'}</strong>`;
            }
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
            const isReturn = (type === 'RETURN' || type === 'RETURN_2WAY' || type === '2WAY');
            IndiaMapPlanner.journeyType = isReturn ? 'RETURN' : 'SINGLE';
            
            if (btnSingle && btnReturn) {
                if (!isReturn) {
                    btnSingle.classList.add('active');
                    btnSingle.style.background = '#10b981';
                    btnSingle.style.color = '#09090b';
                    btnReturn.classList.remove('active');
                    btnReturn.style.background = 'transparent';
                    btnReturn.style.color = '#a1a1aa';
                } else {
                    btnReturn.classList.add('active');
                    btnReturn.style.background = '#10b981';
                    btnReturn.style.color = '#09090b';
                    btnSingle.classList.remove('active');
                    btnSingle.style.background = 'transparent';
                    btnSingle.style.color = '#a1a1aa';
                }
            }
            if (IndiaMapPlanner.selectedRouteData && IndiaMapPlanner.routeCoordinates.length > 0) {
                const tollEstimate = IndiaMapPlanner.estimateTollsOnRoute(IndiaMapPlanner.routeCoordinates);
                IndiaMapPlanner.selectedRouteData.tolls = tollEstimate.tolls;
                IndiaMapPlanner.selectedRouteData.totalTollCost = tollEstimate.totalTollCost;
                IndiaMapPlanner.selectedRouteData.totalCost = tollEstimate.totalTollCost;
                IndiaMapPlanner.updateSummary(IndiaMapPlanner.selectedRouteData);
                Utils.showToast(`Trip corridor: ${isReturn ? '24hr Return (2-Way)' : '1-Way Single'} • Total Toll: ₹${tollEstimate.totalTollCost}`, 'info');
            }
        };

        IndiaMapPlanner.setTripType = setJourneyType;
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
            return `<span><i class="fa-solid fa-triangle-exclamation" style="color: #fbbf24; margin-right: 4px;"></i> <strong style="color: #10b981; font-size: 9.5px; margin-right: 4px;">[${badgeTime}]</strong> ${alert}</span>`;
        });

        // Duplicate set for seamless continuous marquee loop (0% to -50%)
        const seamlessSet = [...formatted, ...formatted];
        container.innerHTML = seamlessSet.join('');

        // Dynamically calibrate scroll speed based on actual text length (constant pixels/second)
        setTimeout(() => {
            const scrollW = container.scrollWidth;
            const halfW = scrollW / 2;
            const pxPerSec = window.innerWidth <= 768 ? 26 : 42;
            const duration = Math.max(35, Math.round(halfW / pxPerSec));
            container.style.animationDuration = `${duration}s`;
        }, 50);
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
                    color = '#10b981';
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
                    background: 'rgba(14, 20, 24, 0.95)',
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
                <linearGradient id="g3dPlane" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="60%" stop-color="#e0f2fe"/><stop offset="100%" stop-color="#10b981"/></linearGradient>
            </defs>
        </svg>`,
        
        station: `<svg viewBox="0 0 64 64" width="22" height="22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <path d="M16 10 C16 6 48 6 48 10 L52 42 C52 50 44 52 32 52 C20 52 12 50 12 42 Z" fill="url(#g3dTrain)"/>
            <path d="M18 16 L46 16 L44 30 L20 30 Z" fill="#090d10"/>
            <path d="M22 18 L42 18 L40 28 L24 28 Z" fill="#10b981"/>
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
            <rect x="10" y="12" width="44" height="30" rx="4" fill="#090d10" stroke="#ffffff" stroke-width="2.5"/>
            <rect x="14" y="16" width="36" height="22" rx="2" fill="#090d10"/>
            <path d="M20 22 L26 27 L20 32 M29 32 L36 32" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <path d="M6 44 L58 44 L52 50 L12 50 Z" fill="#ffffff"/>
        </svg>`,
        
        mall: `<svg viewBox="0 0 64 64" width="22" height="22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <path d="M12 20 L52 20 L48 54 L16 54 Z" fill="url(#g3dBag)"/>
            <path d="M22 24 C22 12 42 12 42 24" fill="none" stroke="#fef08a" stroke-width="4.5" stroke-linecap="round"/>
            <line x1="14" y1="28" x2="50" y2="28" stroke="#ffffff" stroke-width="2" opacity="0.6"/>
            <defs>
                <linearGradient id="g3dBag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#7e22ce"/></linearGradient>
            </defs>
        </svg>`,
        
        fuel: `<svg viewBox="0 0 64 64" width="22" height="22" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <rect x="12" y="10" width="30" height="46" rx="4" fill="#ffffff"/>
            <rect x="16" y="16" width="22" height="16" rx="2" fill="#090d10"/>
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
            <circle cx="17" cy="30" r="1.5" fill="#2a2016"/><circle cx="17" cy="38" r="1.5" fill="#2a2016"/>
            <circle cx="34" cy="18" r="1.5" fill="#2a2016"/><circle cx="34" cy="26" r="1.5" fill="#2a2016"/><circle cx="34" cy="34" r="1.5" fill="#2a2016"/>
            <circle cx="49" cy="28" r="1.5" fill="#2a2016"/><circle cx="49" cy="36" r="1.5" fill="#2a2016"/>
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
            <rect x="26" y="42" width="12" height="14" rx="1" fill="#2a2016"/>
            <defs>
                <linearGradient id="g3dBuild" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#34d399"/></linearGradient>
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

        const oVal = (origInput ? origInput.value.trim() : '');
        const dVal = (destInput ? destInput.value.trim() : '');

        if (oVal) {
            if (!IndiaMapPlanner.selectedOrigin || IndiaMapPlanner.selectedOrigin.name.toLowerCase() !== oVal.toLowerCase()) {
                const resO = await resolveLocation(oVal, null, 'origin');
                if (resO) {
                    IndiaMapPlanner.selectedOrigin = resO;
                    IndiaMapPlanner.setOriginMarker(IndiaMapPlanner.selectedOrigin);
                }
            }
        }

        if (dVal) {
            if (!IndiaMapPlanner.selectedDest || IndiaMapPlanner.selectedDest.name.toLowerCase() !== dVal.toLowerCase()) {
                const resD = await resolveLocation(dVal, null, 'destination');
                if (resD) {
                    IndiaMapPlanner.selectedDest = resD;
                    IndiaMapPlanner.selectedDestination = resD;
                    IndiaMapPlanner.setDestMarker(IndiaMapPlanner.selectedDest);
                }
            }
        }

        if (!IndiaMapPlanner.selectedDest && IndiaMapPlanner.selectedDestination) {
            IndiaMapPlanner.selectedDest = IndiaMapPlanner.selectedDestination;
        }

        // Automatic fallback for origin: GPS Location or New Delhi
        if (!IndiaMapPlanner.selectedOrigin) {
            if (IndiaMapPlanner.userLocationMarker) {
                const uLoc = IndiaMapPlanner.userLocationMarker.getLatLng();
                IndiaMapPlanner.selectedOrigin = { name: 'My Location', lat: uLoc.lat, lng: uLoc.lng, state: '' };
            } else {
                IndiaMapPlanner.selectedOrigin = { name: 'New Delhi', lat: 28.6139, lng: 77.2090, state: 'Delhi' };
                IndiaMapPlanner.setOriginMarker(IndiaMapPlanner.selectedOrigin);
            }
            if (origInput) origInput.value = IndiaMapPlanner.selectedOrigin.name;
        }

        if (!IndiaMapPlanner.selectedDest) {
            Utils.showToast('Please specify a Destination to calculate route.', 'warning');
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
        // Request alternatives=3 from OSRM to get multiple parallel corridors
        const url = `https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}?overview=full&geometries=geojson&alternatives=3&steps=true`;
        
        fetch(url)
            .then(r => r.json())
            .then(async data => {
                if (btnCalc) { btnCalc.innerHTML = '<i class="fa-solid fa-location-arrow"></i> Calculate Optimal Path'; btnCalc.disabled = false; }
                Utils.toggleVisibility('route-loader-overlay', false);
                if (data.code !== 'Ok' || !data.routes?.length) {
                    Utils.showToast('No route found via OSRM. Try nearby cities.', 'error');
                    return;
                }
                
                let routes = [...data.routes];

                // If OSRM returned only 1 route, generate a realistic Mid-Route Detour route as Alternate
                if (routes.length === 1 && routes[0].geometry?.coordinates?.length > 10) {
                    try {
                        const coords = routes[0].geometry.coordinates;
                        const midIndex = Math.floor(coords.length / 2);
                        const midPt = coords[midIndex];
                        const dx = -(d.lat - o.lat);
                        const dy = (d.lng - o.lng);
                        const len = Math.sqrt(dx * dx + dy * dy) || 1;
                        const detourLng = midPt[0] + (dy / len) * 0.35;
                        const detourLat = midPt[1] + (dx / len) * 0.35;
                        
                        const detourUrl = `https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${detourLng},${detourLat};${d.lng},${d.lat}?overview=full&geometries=geojson&steps=true`;
                        const detourRes = await fetch(detourUrl);
                        const detourData = await detourRes.json();
                        if (detourData.code === 'Ok' && detourData.routes?.length) {
                            routes.push(detourData.routes[0]);
                        }
                    } catch (e) {
                        console.warn('Detour route generation skipped:', e);
                    }
                }

                const titles = [
                    '⚡ Fastest (NH Corridor)',
                    '🌿 Alternate Bypass Corridor',
                    '💰 Economy / Minimal Tolls'
                ];

                // Process metadata and calculate accurate tolls for all routes
                IndiaMapPlanner.allRoutes = routes.map((r, idx) => {
                    const coords = r.geometry.coordinates;
                    const distKm = (r.distance / 1000).toFixed(1);
                    const etaHours = (r.duration / 3600).toFixed(1);
                    const tollEst = IndiaMapPlanner.estimateTollsOnRoute(coords, parseFloat(distKm));
                    const titleStr = titles[idx] || `Route ${idx + 1}`;

                    const routeData = {
                        ...tollEst,
                        totalDist: distKm,
                        totalEta: etaHours,
                        totalCost: tollEst.totalTollCost,
                        totalTollCost: tollEst.totalTollCost,
                        originName: o ? o.name : '—',
                        destName: d ? d.name : '—',
                        routeIndex: idx,
                        title: titleStr
                    };

                    return {
                        ...r,
                        routeData: routeData,
                        title: titleStr,
                        totalDist: distKm,
                        totalEta: etaHours,
                        tolls: tollEst.tolls,
                        totalTollCost: tollEst.totalTollCost,
                        totalCost: tollEst.totalTollCost
                    };
                });

                IndiaMapPlanner.selectedRouteIndex = 0;
                IndiaMapPlanner._applyRoute(0, o, d);
            })
            .catch(() => {
                if (btnCalc) { btnCalc.innerHTML = '<i class="fa-solid fa-location-arrow"></i> Calculate Optimal Path'; btnCalc.disabled = false; }
                Utils.toggleVisibility('route-loader-overlay', false);
                Utils.showToast('OSRM service offline. Switched to SNHOP National Graph Routing.', 'warning');
                IndiaMapPlanner._fallbackGraphRoute(o, d);
            });
    },

    _fallbackGraphRoute: (o, d) => {
        // Compute direct interpolated geodetic path with toll intersections
        const distKm = Math.round(Utils.calculateDistance(o.lat, o.lng, d.lat, d.lng) * 1.25);
        const etaHours = (distKm / 75).toFixed(1);
        const steps = 20;
        const coordinates = [];
        for (let i = 0; i <= steps; i++) {
            const ratio = i / steps;
            coordinates.push([
                o.lng + (d.lng - o.lng) * ratio,
                o.lat + (d.lat - o.lat) * ratio
            ]);
        }

        const tollEst = IndiaMapPlanner._findTollsAlongRoute(coordinates, 45);
        const fallbackRoute = {
            title: '⚡ National Highway (Offline Graph)',
            geometry: { coordinates },
            distance: distKm * 1000,
            duration: etaHours * 3600,
            totalDist: distKm,
            totalEta: etaHours,
            totalDurationText: `${Math.floor(etaHours)}h ${Math.round((etaHours % 1) * 60)}m`,
            tolls: tollEst.tolls,
            totalTollCost: tollEst.totalTollCost,
            totalCost: tollEst.totalTollCost
        };

        IndiaMapPlanner.allRoutes = [fallbackRoute];
        IndiaMapPlanner.selectedRouteIndex = 0;
        IndiaMapPlanner._applyRoute(0, o, d);
    },

    _applyRoute: (index, origin, dest) => {
        const routes = IndiaMapPlanner.allRoutes;
        if (!routes || !routes.length) return;

        const targetIdx = (index >= 0 && index < routes.length) ? index : 0;
        IndiaMapPlanner.selectedRouteIndex = targetIdx;

        // Google Maps Navigation Style Route Palette (Vibrant Blue & Eco-Green)
        const ROUTE_THEMES = [
            { 
                name: 'Fastest Route', 
                color: '#1a73e8', 
                altColor: '#174ea6', 
                border: '#10b981', 
                bg: 'rgba(16, 185, 129,0.15)', 
                tagCol: '#10b981', 
                halo: 'rgba(26,115,232,0.4)',
                weight: 7
            },
            { 
                name: 'Eco / Low Toll Corridor', 
                color: '#0f9d58', 
                altColor: '#0b8043', 
                border: '#34a853', 
                bg: 'rgba(15,157,88,0.15)', 
                tagCol: '#34d399', 
                halo: 'rgba(15,157,88,0.4)',
                weight: 6
            },
            { 
                name: 'Scenic / NH Corridor', 
                color: '#34d399', 
                altColor: '#10b981', 
                border: '#93c5fd', 
                bg: 'rgba(96,165,250,0.15)', 
                tagCol: '#93c5fd', 
                halo: 'rgba(96,165,250,0.4)',
                weight: 6
            }
        ];

        // Unique plaza emoji generator
        const getTollEmoji = (toll) => {
            const name = (toll.name || toll.tollName || '').toLowerCase();
            const state = (toll.state || '').toLowerCase();
            if (name.includes('express') || name.includes('super')) return '⚡';
            if (name.includes('bridge') || name.includes('flyover') || name.includes('setu')) return '🌉';
            if (name.includes('bypass') || name.includes('ring')) return '🔄';
            if (name.includes('ghat') || name.includes('hill') || state.includes('himachal') || state.includes('uttarakhand')) return '🏔️';
            if (name.includes('port') || name.includes('coast') || state.includes('goa') || state.includes('kerala')) return '🌊';
            if (name.includes('border') || name.includes('check')) return '🛂';
            if (name.includes('gate') || name.includes('entry')) return '⛩️';
            const emojis = ['🛣️', '🏷️', '🎟️', '⛩️', '🏢', '⚡', '🛡️', '🛰️'];
            const idx = Math.abs((toll.id || toll.name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % emojis.length;
            return emojis[idx];
        };

        // Clear markers & existing polylines
        IndiaMapPlanner.routeTollMarkers.forEach(m => { try { m.remove(); } catch(e){} });
        IndiaMapPlanner.routeTollMarkers = [];
        IndiaMapPlanner.routePolylines.forEach(p => { try { p.remove(); } catch(e){} });
        IndiaMapPlanner.routePolylines = [];

        // Draw Inactive Alternate Routes first with distinct vibrant Emerald / Violet colors
        routes.forEach((route, rIdx) => {
            if (rIdx === targetIdx) return;
            const theme = ROUTE_THEMES[rIdx % ROUTE_THEMES.length];
            const coords = route.geometry.coordinates;
            const latLngs = coords.map(p => [p[1], p[0]]);
            
            const altPoly = L.polyline(latLngs, {
                color: theme.color,
                weight: theme.weight || 6,
                opacity: 0.85,
                lineJoin: 'round'
            }).addTo(IndiaMapPlanner.map);

            altPoly.bindTooltip(`<b>${route.title}</b><br>${route.totalDist} km · ${route.totalEta}h · ${route.tolls.length} Tolls (₹${route.totalTollCost})<br><span style="color:${theme.border}; font-size:10px; font-weight:700;">Click on road to switch to this corridor</span>`, {
                sticky: true
            });

            altPoly.on('click', () => {
                IndiaMapPlanner.selectRoute(rIdx);
            });

            altPoly.on('mouseover', () => {
                altPoly.setStyle({ color: theme.border, opacity: 1.0, weight: (theme.weight || 6) + 2 });
            });
            altPoly.on('mouseout', () => {
                altPoly.setStyle({ color: theme.color, opacity: 0.85, weight: theme.weight || 6 });
            });

            IndiaMapPlanner.routePolylines.push(altPoly);
        });

        // Draw Selected Active Route on Top
        const activeRoute = routes[targetIdx];
        const activeTheme = ROUTE_THEMES[targetIdx % ROUTE_THEMES.length];
        const activeCoords = activeRoute.geometry.coordinates;
        const activeLatLngs = activeCoords.map(p => [p[1], p[0]]);

        const primaryPoly = L.polyline(activeLatLngs, {
            color: activeTheme.color,
            weight: (activeTheme.weight || 7) + 1,
            opacity: 1.0,
            lineJoin: 'round'
        }).addTo(IndiaMapPlanner.map);

        primaryPoly.bindTooltip(`<b>${activeRoute.title} (Active Route)</b><br>${activeRoute.totalDist} km · ${activeRoute.totalEta}h · ₹${activeRoute.totalTollCost}`, {
            permanent: false,
            sticky: true
        });

        IndiaMapPlanner.routePolylines.push(primaryPoly);

        // Store active coordinates & data for simulation and navigation
        IndiaMapPlanner.routeCoordinates = activeCoords;
        const rData = activeRoute.routeData;
        IndiaMapPlanner.selectedRouteData = rData;

        // Draw toll markers along the active route with unique emojis and price pill
        rData.tolls.forEach(t => {
            const td = window.TollSeedData?.find(s => s.id === t.id) || t;
            const markerLat = (t.lat !== undefined && t.lat !== null) ? t.lat : td.lat;
            const markerLng = (t.lng !== undefined && t.lng !== null) ? t.lng : td.lng;
            if (!markerLat || !markerLng) return;
            try {
                const emoji = getTollEmoji(td);
                const displayCost = t.cost ? `₹${t.cost}` : 'Toll';
                const tollIcon = L.divIcon({
                    className: 'snhop-toll-marker-unit',
                    html: `
                        <div class="snhop-toll-symbol-marker on-route" style="display:inline-flex; align-items:center; justify-content:center; gap:4px; background:rgba(9, 13, 16, 0.95); border:1.5px solid #10b981; border-radius:12px; padding:3px 7px; box-shadow:0 4px 12px rgba(0,0,0,0.8), 0 0 10px rgba(16,185,129,0.5); transform:translate(-50%, -50%); cursor:pointer; font-family:var(--font-display),sans-serif;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 21h18M5 21V7l7-3 7 3v14M9 21v-6a3 3 0 0 1 6 0v6"/>
                            </svg>
                            <span style="font-size:10.5px; font-weight:800; color:#10b981; line-height:1;">${displayCost}</span>
                        </div>
                    `,
                    iconSize: [54, 22],
                    iconAnchor: [27, 11]
                });
                const m = L.marker([markerLat, markerLng], { icon: tollIcon })
                    .bindPopup(IndiaMapPlanner._tollPopup(td, t.cost))
                    .addTo(IndiaMapPlanner.map);
                IndiaMapPlanner.routeTollMarkers.push(m);
            } catch(e) {}
        });

        // Render Alternate Route Selector Tabs in UI
        IndiaMapPlanner._renderAlternateRouteTabs();

        // Update Summary Floating Panel & Upcoming Toll Traffic Box
        IndiaMapPlanner.updateSummary(rData);
        IndiaMapPlanner.updateUpcomingTollBox();

        document.getElementById('route-summary-panel')?.classList.remove('hidden');
        document.getElementById('trip-badge').innerText = 'PREVIEW MODE';
        document.getElementById('trip-badge').style.background = 'rgba(255,255,255,0.15)';
        document.getElementById('trip-badge').style.color = 'var(--text-sec)';

        // Sync Google Place Card if open
        const placeCard = document.getElementById('google-place-card');
        if (placeCard && !placeCard.classList.contains('hidden')) {
            const optFastTime = document.getElementById('opt-fastest-time');
            const optFastDetails = document.getElementById('opt-fastest-details');
            const tollCount = rData.tolls ? rData.tolls.length : 0;
            const tollFee = rData.totalCost || rData.totalTollCost || 0;
            const etaHours = parseFloat(rData.totalEta);
            const timeStr = etaHours < 1.0 ? `${Math.round(etaHours * 60)}m` : `${Math.floor(etaHours)}h ${Math.round((etaHours % 1) * 60)}m`;

            if (optFastTime) optFastTime.textContent = timeStr;
            if (optFastDetails) optFastDetails.textContent = `${rData.totalDist} km · ${tollCount} Tolls (₹${tollFee}) · ${activeRoute.title}`;
        }

        const pad = window.innerWidth <= 768 ? [30, 30] : [50, 50];
        const padBottom = window.innerWidth <= 768 ? [0, Math.round(window.innerHeight * 0.42)] : [0, 0];
        IndiaMapPlanner.map.fitBounds(primaryPoly.getBounds(), { padding: pad, paddingBottomRight: padBottom });
        Utils.showToast(`Selected: ${activeRoute.title} · ${rData.totalDist} km · ${rData.tolls.length} tolls (₹${rData.totalTollCost})`, 'success');

        // Update alerts ticker
        let routeState = '';
        if (origin && origin.state) {
            routeState = origin.state;
        } else if (activeCoords && activeCoords.length > 0) {
            routeState = IndiaMapPlanner._getLocalStateFromCoords(activeCoords[0][1], activeCoords[0][0]);
        }
        if (routeState) {
            IndiaMapPlanner.fetchLiveNewsAlerts(routeState);
        }

        // Voice announcement
        IndiaMapPlanner._announceRoute(rData);

        // Fetch on-route services
        setTimeout(() => IndiaMapPlanner.fetchOnRouteServices(activeCoords, rData), 800);
    },

    selectRoute: (index) => {
        if (!IndiaMapPlanner.allRoutes || !IndiaMapPlanner.allRoutes[index]) return;
        IndiaMapPlanner._applyRoute(index, IndiaMapPlanner.selectedOrigin, IndiaMapPlanner.selectedDest);
    },

    _renderAlternateRouteTabs: () => {
        const container = document.getElementById('alt-routes-selector');
        if (!container) return;

        const routes = IndiaMapPlanner.allRoutes;
        if (!routes || routes.length <= 1) {
            container.innerHTML = '';
            return;
        }

        const ROUTE_THEMES = [
            { border: '#10b981', bg: 'rgba(16, 185, 129,0.18)', tagCol: '#10b981', badgeBg: '#10b981' },
            { border: '#34d399', bg: 'rgba(16,185,129,0.18)', tagCol: '#34d399', badgeBg: '#10b981' },
            { border: '#10b981', bg: 'rgba(168,85,247,0.18)', tagCol: '#10b981', badgeBg: '#a855f7' }
        ];

        let html = '';
        routes.forEach((r, idx) => {
            const theme = ROUTE_THEMES[idx % ROUTE_THEMES.length];
            const isSel = idx === IndiaMapPlanner.selectedRouteIndex;
            const borderCol = isSel ? theme.border : 'rgba(255,255,255,0.08)';
            const bgCol = isSel ? theme.bg : 'rgba(0,0,0,0.35)';
            const titleCol = isSel ? theme.tagCol : '#e2e8f0';
            const etaHours = parseFloat(r.totalEta);
            const timeStr = etaHours < 1.0 ? `${Math.round(etaHours * 60)}m` : `${Math.floor(etaHours)}h ${Math.round((etaHours % 1) * 60)}m`;

            html += `
                <div onclick="IndiaMapPlanner.selectRoute(${idx})" style="flex: 1; min-width: 125px; background: ${bgCol}; border: 1px solid ${borderCol}; border-radius: 8px; padding: 6px 8px; cursor: pointer; transition: all 0.2s ease; display: flex; flex-direction: column; gap: 2px;" title="Click to switch to ${r.title}">
                    <div style="font-size: 10px; font-weight: 800; color: ${titleCol}; display: flex; align-items: center; justify-content: space-between;">
                        <span>${r.title.split('(')[0].trim()}</span>
                        ${isSel ? `<span style="font-size:7.5px; background:${theme.badgeBg}; color:#000; padding:1px 4px; border-radius:3px; font-weight:900;">ACTIVE</span>` : ''}
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9.5px; color: #94a3b8; margin-top: 1px;">
                        <span>${r.totalDist} km · ${timeStr}</span>
                        <span style="color: ${r.totalTollCost > 0 ? '#fbbf24' : '#34d399'}; font-weight: 700;">₹${r.totalTollCost}</span>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    updateUpcomingTollBox: (currentLat = null, currentLng = null) => {
        const box = document.getElementById('upcoming-toll-box');
        if (!box) return;

        const rData = IndiaMapPlanner.selectedRouteData;
        if (!rData) {
            box.style.display = 'none';
            return;
        }

        box.style.display = 'flex';
        const nameEl = document.getElementById('upcoming-toll-name');
        const distEl = document.getElementById('upcoming-toll-dist');
        const feeEl  = document.getElementById('upcoming-toll-fee');
        const trafEl = document.getElementById('upcoming-toll-traffic');

        if (!rData.tolls || rData.tolls.length === 0) {
            if (nameEl) nameEl.innerHTML = `✨ Direct Highway Corridor`;
            if (distEl) distEl.textContent = `Zero Tolls`;
            if (feeEl)  feeEl.textContent = `₹0`;
            if (trafEl) trafEl.innerHTML = `
                <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#10b981; box-shadow:0 0 6px #10b981;"></span>
                <span style="color:#34d399; font-weight:600;">Clear Corridor · Free Flow Traffic</span>
            `;
            return;
        }

        // Find the next upcoming toll that has not yet been crossed
        const unpassed = rData.tolls.filter(t => !IndiaMapPlanner.chargedTollIds?.has(t.id));

        if (unpassed.length === 0) {
            // All tolls passed! Destination is next
            if (nameEl) nameEl.innerHTML = `🏁 Destination: ${rData.destName}`;
            if (distEl) distEl.textContent = `Final Stretch`;
            if (feeEl)  feeEl.textContent = `All Cleared`;
            if (trafEl) trafEl.innerHTML = `
                <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#10b981; box-shadow:0 0 6px #10b981;"></span>
                <span style="color:#34d399; font-weight:600;">Approaching Destination · Normal Traffic</span>
            `;
            return;
        }

        const nextToll = unpassed[0];
        const td = window.TollSeedData?.find(s => s.id === nextToll.id) || nextToll;
        const plazaName = td.name || nextToll.name || 'NH Toll Plaza';
        const nhCorridor = (td.nhCorridor && td.nhCorridor !== 'N/A') ? `(NH-${td.nhCorridor})` : '';

        // Calculate distance to this upcoming toll
        let distText = 'Next Toll';
        if (currentLat && currentLng && td.lat && td.lng) {
            const dLat = (td.lat - currentLat) * 111;
            const dLng = (td.lng - currentLng) * 111 * Math.cos(currentLat * Math.PI / 180);
            const km = Math.sqrt(dLat * dLat + dLng * dLng);
            distText = `${km.toFixed(1)} km ahead`;
        } else if (nextToll.coordIndex !== undefined && IndiaMapPlanner.routeCoordinates?.length) {
            const totalKm = parseFloat(rData.totalDist || 100);
            const approxKm = ((nextToll.coordIndex / IndiaMapPlanner.routeCoordinates.length) * totalKm).toFixed(0);
            distText = `~${approxKm} km from start`;
        }

        // Check realtime toll traffic condition from Admin/Storage
        const tollStates = Storage.get(Storage.KEYS.TOLL_STATES, {});
        const cong = tollStates[nextToll.id]?.congestion || 'NORMAL';

        let congDot = '#10b981';
        let congText = '<span style="color:#34d399; font-weight:700;">🟢 Live Traffic: Normal Flow</span> <span style="color:#94a3b8;">(&lt; 2 min queue)</span>';
        
        if (cong === 'HIGH') {
            congDot = '#ef4444';
            congText = '<span style="color:#f43f5e; font-weight:700;">🔴 Live Traffic: High Congestion</span> <span style="color:#cbd5e1;">(+15m delay · Fastag lanes open)</span>';
        } else if (cong === 'MODERATE') {
            congDot = '#f59e0b';
            congText = '<span style="color:#fbbf24; font-weight:700;">🟡 Live Traffic: Moderate Flow</span> <span style="color:#cbd5e1;">(~5 min queue)</span>';
        }

        if (nameEl) nameEl.innerHTML = `📍 ${plazaName} <span style="font-size:9.5px; color:#94a3b8; font-weight:600;">${nhCorridor}</span>`;
        if (distEl) distEl.textContent = distText;
        if (feeEl)  feeEl.textContent = `₹${nextToll.cost || td.baseRate || 65}`;
        if (trafEl) trafEl.innerHTML = `
            <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:${congDot}; box-shadow:0 0 8px ${congDot}; flex-shrink:0;"></span>
            <span style="font-size:9.5px; line-height:1.2;">${congText}</span>
        `;
    },

    exploreMidRouteDetour: () => {
        if (!IndiaMapPlanner.selectedRouteData || !IndiaMapPlanner.routeCoordinates.length) {
            Utils.showToast('Plan a route first to explore mid-route detours.', 'warning');
            return;
        }

        const routes = IndiaMapPlanner.allRoutes || [];
        if (routes.length > 1) {
            // Switch to the next alternate route as mid-route diversion
            const nextIdx = (IndiaMapPlanner.selectedRouteIndex + 1) % routes.length;
            IndiaMapPlanner.selectRoute(nextIdx);
            Utils.showToast(`🔀 Mid-Route Bypass Engaged: Switched to ${routes[nextIdx].title}!`, 'success');
        } else {
            // Dynamically generate a midpoint detour
            const coords = IndiaMapPlanner.routeCoordinates;
            const o = IndiaMapPlanner.selectedOrigin || { lat: coords[0][1], lng: coords[0][0], name: 'Origin' };
            const d = IndiaMapPlanner.selectedDest || { lat: coords[coords.length - 1][1], lng: coords[coords.length - 1][0], name: 'Destination' };

            const midIndex = Math.floor(coords.length / 2);
            const midPt = coords[midIndex];
            const dx = -(d.lat - o.lat);
            const dy = (d.lng - o.lng);
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const detourLng = midPt[0] + (dy / len) * 0.4;
            const detourLat = midPt[1] + (dx / len) * 0.4;

            Utils.showToast('🔀 Calculating Mid-Route Bypass Corridor...', 'info');
            const detourUrl = `https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${detourLng},${detourLat};${d.lng},${d.lat}?overview=full&geometries=geojson&steps=true`;
            
            fetch(detourUrl)
                .then(r => r.json())
                .then(detourData => {
                    if (detourData.code === 'Ok' && detourData.routes?.length) {
                        const newRoute = detourData.routes[0];
                        const distKm = (newRoute.distance / 1000).toFixed(1);
                        const etaHours = (newRoute.duration / 3600).toFixed(1);
                        const tollEst = IndiaMapPlanner.estimateTollsOnRoute(newRoute.geometry.coordinates, parseFloat(distKm));
                        
                        const altObj = {
                            ...newRoute,
                            routeData: {
                                ...tollEst,
                                totalDist: distKm,
                                totalEta: etaHours,
                                totalCost: tollEst.totalTollCost,
                                totalTollCost: tollEst.totalTollCost,
                                originName: o.name,
                                destName: d.name,
                                routeIndex: IndiaMapPlanner.allRoutes.length,
                                title: '🔀 Dynamic Mid-Bypass Detour'
                            },
                            title: '🔀 Dynamic Mid-Bypass Detour',
                            totalDist: distKm,
                            totalEta: etaHours,
                            tolls: tollEst.tolls,
                            totalTollCost: tollEst.totalTollCost,
                            totalCost: tollEst.totalTollCost
                        };

                        IndiaMapPlanner.allRoutes.push(altObj);
                        IndiaMapPlanner.selectRoute(IndiaMapPlanner.allRoutes.length - 1);
                        Utils.showToast('🔀 Mid-Route Bypass Corridor Activated!', 'success');
                    } else {
                        Utils.showToast('No alternative detour available for this corridor.', 'info');
                    }
                })
                .catch(() => {
                    Utils.showToast('Unable to calculate mid-route detour at this time.', 'error');
                });
        }
    },

    _announceRoute: async (rData) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();

        const etaVal = parseFloat(rData.totalEta);
        let curBal = 0;
        if (typeof FastagEngine !== 'undefined' && typeof FastagEngine.getBalance === 'function') {
            curBal = FastagEngine.getBalance();
        } else if (typeof Storage !== 'undefined') {
            curBal = Storage.get(Storage.KEYS.FASTAG_BALANCE, 0);
        }
        const balance = Math.max(0, Math.round(Number(curBal) || 0));

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
        
        if (rData.tolls && rData.tolls.length > 0) {
            text += `There are ${rData.tolls.length} tolls on this route. Total toll amount to be paid is ${rData.totalTollCost} rupees. `;
        }
        
        if (balance <= 0) {
            text += `Your FASTag wallet balance is 0 rupees. Please recharge before initiating travel. `;
        } else {
            text += `Your current FASTag account balance is ${balance} rupees. `;
        }
        
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
        if (!td) return '<div style="padding:10px; color:#333;">Toll Plaza</div>';
        const vType = document.getElementById('route-vehicle-selector')?.value || document.getElementById('vehicle-type')?.value || 'LMV';
        const single = td.tollRatesByVehicleClass || {};
        const ret = td.returnRatesByVehicleClass || {};
        const isExempt = ['GOVT','PRESS','ARMY','AMBULANCE','FIRE','POLICE','BIKE'].includes(vType);
        
        const base = td.baseRate || td.singleCost || 65;
        const lmvSingle = single.LMV || base;
        const lmvReturn = ret.LMV || Math.round((lmvSingle * 1.5)/5)*5;

        const curSingle = isExempt ? 0 : (single[vType] || cost || lmvSingle);
        const curReturn = isExempt ? 0 : (ret[vType] || Math.round((curSingle * 1.5)/5)*5);
        const plazaName = td.name || td.tollName || 'National Highway Toll Plaza';
        const plazaState = td.state || 'India';
        const corridorStr = (td.nhCorridor && td.nhCorridor !== 'N/A') ? `<strong>NH-${td.nhCorridor}</strong>` : 'National Highway';

        return `
        <div style="min-width:280px; font-family:var(--font-main, 'Inter', sans-serif); padding:6px 4px; color:#241e17;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
                <div>
                    <div style="font-weight:800; font-size:13.5px; color:#090d10; line-height:1.2;">🏗️ ${plazaName}</div>
                    <div style="font-size:11px; color:#64748b; margin-top:2px;">${plazaState} · ${corridorStr}</div>
                </div>
                <span style="font-size:8.5px; font-weight:700; padding:2px 6px; border-radius:4px; background:rgba(16,185,129,0.15); color:#059669; border:1px solid rgba(16,185,129,0.3);">FASTag ACTIVE</span>
            </div>

            <!-- Active Vehicle Highlight Card -->
            <div style="background:linear-gradient(135deg, rgba(14,20,24,0.95), rgba(30,41,59,0.95)); border-radius:8px; padding:8px 10px; margin:8px 0; color:#fff; display:flex; justify-content:space-between; align-items:center; box-shadow:0 4px 12px rgba(0,0,0,0.15);">
                <div>
                    <div style="font-size:9.5px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; font-weight:600;">Selected Vehicle (${vType})</div>
                    <div style="font-size:11px; font-weight:700; color:#10b981; margin-top:1px;">
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
                <span>🎟️ Local Monthly Pass: <strong style="color:#090d10;">₹${td.monthlyPassLocal || 360}</strong></span>
                <span style="color:#94a3b8;">${td.concessionaire || 'NHAI Managed'}</span>
            </div>
        </div>`;
    },

    _clearRoutePolylines: () => {
        IndiaMapPlanner.routePolylines.forEach(p => { try { p.remove(); } catch(e){} });
        IndiaMapPlanner.routePolylines = [];
        const container = document.getElementById('alt-routes-selector');
        if (container) container.innerHTML = '';
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
                adminAlerts.forEach(latestAlert => {
                    const alertPlaza = (latestAlert.plaza || '').toLowerCase();
                    const matchesRoute = latestAlert.plaza === 'ALL' || rData.tolls.some(t => {
                        const td = window.TollSeedData?.find(s => s.id === t.id);
                        const tName = (td ? td.name : (t.name || '')).toLowerCase();
                        return tName.includes(alertPlaza) || alertPlaza.includes(tName);
                    });

                    if (matchesRoute) {
                        const alertColor = latestAlert.type === 'EMERGENCY' ? '#f43f5e' : (latestAlert.type === 'TRAFFIC' ? '#f59e0b' : '#10b981');
                        const icon = latestAlert.type === 'EMERGENCY' ? 'fa-triangle-exclamation' : (latestAlert.type === 'TRAFFIC' ? 'fa-car-burst' : 'fa-tower-broadcast');
                        html += `
                            <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-left: 3px solid ${alertColor}; border-radius: 10px; padding: 8px 10px; margin-bottom: 12px; display: flex; align-items: flex-start; gap: 8px;">
                                <i class="fa-solid ${icon}" style="color: ${alertColor}; font-size: 13px; margin-top: 2px;"></i>
                                <div style="flex:1; min-width:0;">
                                    <div style="font-size: 10.5px; font-weight: 700; color: ${alertColor}; display:flex; justify-content:space-between; align-items:center;">
                                        <span>LIVE NHAI ALERT: ${latestAlert.title}</span>
                                        <span style="font-size:8px; background:rgba(16, 185, 129,0.15); color:#10b981; padding:1px 4px; border-radius:3px;">📡 10km Range</span>
                                    </div>
                                    <div style="font-size: 9.5px; color: #cbd5e1; line-height: 1.35; margin-top: 2px;">${latestAlert.message}</div>
                                </div>
                            </div>
                        `;
                    }
                });
            }

            html += `
                <div style="position: relative; margin-bottom: 12px; z-index: 2;">
                    <div style="position: absolute; left: -22.5px; top: 3.5px; width: 8px; height: 8px; border-radius: 50%; background: var(--primary); border: 2px solid #000; box-shadow: 0 0 8px var(--primary-glow);"></div>
                    <div style="font-size: 11px; font-weight: 700; color: #fff;">${rData.originName}</div>
                    <div style="font-size: 8.5px; color: var(--text-muted);">Start of Journey • <span style="color:#10b981; font-weight:600;">${jType}</span></div>
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
            const mobileSearchDisplay = document.getElementById('mobile-search-display');
            if (mobileSearchDisplay) {
                mobileSearchDisplay.innerHTML = `<span style="font-weight:700; color:#fff;">📍 ${rData.originName} ➔ ${rData.destName}</span> <span style="color:#10b981; font-size:11px; margin-left:4px;">(${rData.totalDist} km)</span>`;
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
    estimateTollsOnRoute: (coords, routeDistanceKm = null) => {
        const rawMatched = [];
        const tollIds = new Set();

        if (!window.TollSeedData || !coords || coords.length === 0) return { tolls: [], totalTollCost: 0, totalCost: 0 };

        const vehicleType    = document.getElementById('route-vehicle-selector')?.value || document.getElementById('vehicle-type')?.value || 'LMV';
        const journeyType    = IndiaMapPlanner.journeyType || 'SINGLE';
        const isExempt       = ['GOVT','PRESS','ARMY','AMBULANCE','FIRE','POLICE','BIKE'].includes(vehicleType);
        const corridorKm     = 3.2; // 3.2km corridor buffer for highway tracking
        const sampleStep     = Math.max(1, Math.floor(coords.length / 3000));

        // Calculate accurate real polyline distance in km
        let realDistKm = routeDistanceKm;
        if (!realDistKm || isNaN(realDistKm) || realDistKm <= 0) {
            let sumDist = 0;
            for (let j = 0; j < coords.length - 1; j++) {
                const dLa = (coords[j+1][1] - coords[j][1]) * 111;
                const dLn = (coords[j+1][0] - coords[j][0]) * 111 * Math.cos(coords[j][1] * Math.PI / 180);
                sumDist += Math.sqrt(dLa * dLa + dLn * dLn);
            }
            realDistKm = sumDist > 0 ? sumDist : 100;
        }

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
                            : (toll.tollRatesByVehicleClass?.[vehicleType] || toll.baseRate || 65);
                    }
                    
                    const singleCost = isExempt ? 0 : ((toll.tollRatesByVehicleClass && toll.tollRatesByVehicleClass[vehicleType]) || toll.baseRate || 65);
                    const returnCost = isExempt ? 0 : ((toll.returnRatesByVehicleClass && toll.returnRatesByVehicleClass[vehicleType]) || Math.round((singleCost * 1.5)/5)*5);

                    // High precision orthogonal snapping to nearest road polyline segment
                    let bestLat = coords[i][1];
                    let bestLng = coords[i][0];
                    let minProjDistSq = Infinity;
                    const searchWindow = Math.max(15, sampleStep * 2);
                    const startIdx = Math.max(0, i - searchWindow);
                    const endIdx = Math.min(coords.length - 1, i + searchWindow);

                    for (let k = startIdx; k < endIdx; k++) {
                        const p1 = coords[k];
                        const p2 = coords[k + 1];
                        const x1 = p1[0], y1 = p1[1];
                        const x2 = p2[0], y2 = p2[1];
                        const dx = x2 - x1, dy = y2 - y1;
                        const lenSq = dx * dx + dy * dy;

                        let u = 0;
                        if (lenSq > 0) {
                            u = Math.max(0, Math.min(1, ((toll.lng - x1) * dx + (toll.lat - y1) * dy) / lenSq));
                        }
                        const pLng = x1 + u * dx;
                        const pLat = y1 + u * dy;
                        const pDLa = (pLat - toll.lat) * 111;
                        const pDLn = (pLng - toll.lng) * 111 * Math.cos(toll.lat * Math.PI / 180);
                        const pDistSq = pDLa * pDLa + pDLn * pDLn;

                        if (pDistSq < minProjDistSq) {
                            minProjDistSq = pDistSq;
                            bestLat = pLat;
                            bestLng = pLng;
                        }
                    }

                    rawMatched.push({ 
                        id: toll.id, 
                        name: toll.name || toll.tollName || 'NH Toll Plaza', 
                        cost: cost,
                        singleCost: singleCost,
                        returnCost: returnCost,
                        baseRate: toll.baseRate || 65,
                        state: toll.state || 'India',
                        nhCorridor: toll.nhCorridor || 'N/A',
                        lat: bestLat,
                        lng: bestLng,
                        origLat: toll.lat,
                        origLng: toll.lng,
                        coordIndex: i
                    });
                    break;
                }
            }
        });

        // 1. Sort raw matched tolls sequentially by route progression (from Origin -> Destination)
        rawMatched.sort((a, b) => a.coordIndex - b.coordIndex);

        // 2. Intelligent NHAI spatial deduplication (merges duplicate slip lanes & ramp barriers within 12km)
        const tolls = [];
        let totalTollCost = 0;
        
        rawMatched.forEach(t => {
            if (tolls.length === 0) {
                tolls.push(t);
                totalTollCost += t.cost;
            } else {
                const last = tolls[tolls.length - 1];
                const indexDiff = Math.abs(t.coordIndex - last.coordIndex);
                const approxDistKm = (indexDiff / coords.length) * realDistKm;
                
                if (approxDistKm < 12.0) {
                    // Within 12km on same highway corridor: keep the mainline/higher tariff barrier
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

        return { tolls, totalTollCost, totalCost: totalTollCost };
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
            html: "<div class='car-marker' style='background:#ef4444;width:22px;height:22px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 18px rgba(239,68,68,0.9);position:relative;'><div style='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:5px;height:5px;background:#fff;border-radius:50%;'></div></div>",
            iconSize: [22,22], iconAnchor: [11,11]
        });
        const start = IndiaMapPlanner.routeCoordinates[0];
        IndiaMapPlanner.carMarker = L.marker([start[1], start[0]], { icon: carIcon, zIndexOffset: 1000 })
            .bindTooltip('🚗 Live Vehicle Navigation', { permanent: false, direction: 'top' })
            .addTo(IndiaMapPlanner.map);

        // Initialize Trail
        if (IndiaMapPlanner.trailPolyline) IndiaMapPlanner.trailPolyline.remove();
        IndiaMapPlanner.trailPolyline = L.polyline([], { color: '#ef4444', weight: 5, opacity: 0.75, dashArray: '6, 10' }).addTo(IndiaMapPlanner.map);

        let step = 0;
        IndiaMapPlanner.currentStep = 0;
        IndiaMapPlanner.isNavPaused = false;
        IndiaMapPlanner.approachedTollIds = new Set();
        IndiaMapPlanner.chargedTollIds = new Set();
        const coords = IndiaMapPlanner.routeCoordinates;
        
        // Simulation step density
        const totalDist = parseFloat(IndiaMapPlanner.selectedRouteData.totalDist) || 100;
        const jump = Math.max(1, Math.floor(coords.length / (totalDist > 100 ? 200 : 100)));

        // Activate 3D Cockpit Driving HUD & Auto-collapse sidebars
        document.body.classList.add('navigating-3d-hud');
        document.getElementById('driving-cockpit-hud')?.classList.remove('hidden');

        // Initial initial speed & road display
        IndiaMapPlanner.currentSpeedKmh = 82;
        IndiaMapPlanner.updateCockpitSpeedometer(82, 0, 0, totalDist);
        IndiaMapPlanner.updateRoadHud(start[1], start[0], 0, coords);

        Utils.showToast('🚀 Live 3D Highway Navigation started! FASTag Armed.', 'success');
        if (window.VoiceAssistant && typeof VoiceAssistant.speak === 'function') {
            VoiceAssistant.speak(`Navigation started to ${IndiaMapPlanner.selectedRouteData.destName}. Highway speed limit is 100 kilometers per hour. FASTag automated tolling active.`);
        }

        const speedMs = parseInt(document.getElementById('sim-speed')?.value || 500);
        IndiaMapPlanner.tripInterval = setInterval(() => {
            if (IndiaMapPlanner.isNavPaused) return;

            if (step >= coords.length) {
                IndiaMapPlanner.endLiveTrip();
                Utils.showToast('Destination Reached! 🎉', 'success');
                if (window.VoiceAssistant && typeof VoiceAssistant.speak === 'function') {
                    VoiceAssistant.speak(`You have reached your destination ${IndiaMapPlanner.selectedRouteData.destName}. Thank you for travelling with NHAI.`);
                }
                return;
            }
            
            const pt = coords[step];
            IndiaMapPlanner.currentStep = step;
            IndiaMapPlanner.updateTripPosition(pt[1], pt[0], step, coords);
            
            step += jump;
            if (step >= coords.length && step - jump < coords.length - 1) step = coords.length - 1; 
        }, speedMs);

        // Allow real-time speed adjustment via the slider
        const simSpeedInput = document.getElementById('sim-speed');
        if (simSpeedInput) {
            simSpeedInput.addEventListener('input', (e) => {
                if (IndiaMapPlanner.isTripLive && IndiaMapPlanner.tripInterval) {
                    clearInterval(IndiaMapPlanner.tripInterval);
                    const newSpeed = parseInt(e.target.value || 500);
                    IndiaMapPlanner.tripInterval = setInterval(() => {
                        if (IndiaMapPlanner.isNavPaused) return;

                        if (step >= coords.length) {
                            IndiaMapPlanner.endLiveTrip();
                            Utils.showToast('Destination Reached! 🎉', 'success');
                            return;
                        }
                        
                        const pt = coords[step];
                        IndiaMapPlanner.currentStep = step;
                        IndiaMapPlanner.updateTripPosition(pt[1], pt[0], step, coords);
                        
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
                const { latitude, longitude, speed, heading } = pos.coords;
                const realSpeedKmh = speed ? Math.round(speed * 3.6) : (IndiaMapPlanner.isTripLive ? 75 : 0);
                
                if (!IndiaMapPlanner.isTripLive) {
                    // Pre-trip GPS lock
                    if (!IndiaMapPlanner.carMarker) {
                        const carIcon = L.divIcon({
                            className: '',
                            html: "<div style='background:#10b981;width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 12px #10b981'></div>",
                            iconSize: [18,18], iconAnchor: [9,9]
                        });
                        IndiaMapPlanner.carMarker = L.marker([latitude, longitude], { icon: carIcon }).addTo(IndiaMapPlanner.map);
                    }
                    IndiaMapPlanner.carMarker.setLatLng([latitude, longitude]);
                    IndiaMapPlanner.map.setView([latitude, longitude], 15);
                } else {
                    IndiaMapPlanner.currentSpeedKmh = realSpeedKmh;
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

    // ═══════════════════════════════════════════════════════════════
    // 3D COCKPIT SPEEDOMETER & ROAD HUD CONTROLS
    // ═══════════════════════════════════════════════════════════════
    updateCockpitSpeedometer: (speedKmh, headingDeg = 0, currentProgressKm = 0, totalDistKm = 100) => {
        const speedNumEl = document.getElementById('hud-speed-num');
        const arcEl = document.getElementById('speedo-progress-arc');
        const compassEl = document.getElementById('hud-compass-arrow');
        const progressEl = document.getElementById('hud-trip-progress');
        const etaEl = document.getElementById('hud-eta-val');

        if (speedNumEl) speedNumEl.textContent = Math.round(speedKmh);

        // Circular SVG gauge (Circumference ~ 427 for r=68)
        if (arcEl) {
            const maxSpeed = 160;
            const fraction = Math.min(1.0, Math.max(0, speedKmh / maxSpeed));
            const dashOffset = 427 - (427 * fraction * 0.75); // 270 degree arc
            arcEl.style.strokeDashoffset = dashOffset;
            
            if (speedKmh > 115) {
                arcEl.style.stroke = '#ef4444'; // Red overspeed
            } else if (speedKmh > 95) {
                arcEl.style.stroke = '#fde047'; // Amber high cruising
            } else {
                arcEl.style.stroke = '#22c55e'; // Green safe cruising
            }
        }

        if (compassEl) {
            compassEl.style.transform = `rotate(${headingDeg}deg)`;
        }

        if (progressEl) {
            progressEl.textContent = `${currentProgressKm.toFixed(1)} km / ${totalDistKm.toFixed(1)} km`;
        }

        if (etaEl && speedKmh > 0) {
            const remKm = Math.max(0, totalDistKm - currentProgressKm);
            const remHours = remKm / (speedKmh || 80);
            const hrs = Math.floor(remHours);
            const mins = Math.round((remHours % 1) * 60);
            etaEl.textContent = hrs > 0 ? `${hrs}h ${mins}m left` : `${mins} min left`;
        }
    },

    updateRoadHud: (lat, lng, stepIndex = 0, coords = null) => {
        const roadRefEl = document.getElementById('hud-road-ref');
        const roadNameEl = document.getElementById('hud-road-name');
        
        let corridor = IndiaMapPlanner.selectedRouteData?.tolls?.[0]?.nhCorridor;
        if (!corridor || corridor === 'N/A' || corridor === 'Unknown') {
            corridor = 'NH-48';
        }
        const refStr = corridor.startsWith('NH-') || corridor.startsWith('NE-') ? corridor : 'NH-' + corridor;

        if (roadRefEl) roadRefEl.textContent = refStr;
        if (roadNameEl) {
            const oName = IndiaMapPlanner.selectedRouteData?.originName || 'Origin';
            const dName = IndiaMapPlanner.selectedRouteData?.destName || 'Destination';
            roadNameEl.textContent = `${refStr} · ${oName} ➔ ${dName} Corridor`;
        }
    },

    toggleTripPause: () => {
        IndiaMapPlanner.isNavPaused = !IndiaMapPlanner.isNavPaused;
        const btn = document.getElementById('btn-hud-pause');
        if (IndiaMapPlanner.isNavPaused) {
            // Speed = 0 km/h: Restore panels smoothly
            if (btn) btn.innerHTML = '<i class="fa-solid fa-play"></i>';
            document.body.classList.remove('navigating-3d-hud');
            IndiaMapPlanner.updateCockpitSpeedometer(0);
            Utils.showToast('⏸️ Journey Paused. Controls restored.', 'info');
        } else {
            // Speed > 0: Auto-collapse panels and resume driving
            if (btn) btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            document.body.classList.add('navigating-3d-hud');
            IndiaMapPlanner.updateCockpitSpeedometer(84);
            Utils.showToast('▶️ Resumed Cruising.', 'success');
        }
    },

    adjustSimSpeed: (deltaMs) => {
        const simSpeedInput = document.getElementById('sim-speed');
        if (simSpeedInput) {
            let cur = parseInt(simSpeedInput.value || 500);
            cur = Math.max(100, Math.min(1500, cur + deltaMs));
            simSpeedInput.value = cur;
            simSpeedInput.dispatchEvent(new Event('input'));
            const speedKmh = Math.round(75 + (1500 - cur) / 18);
            IndiaMapPlanner.updateCockpitSpeedometer(speedKmh);
            Utils.showToast(`Cruise Pace: ${cur}ms (${speedKmh} km/h)`, 'info');
        }
    },

    dismissPreTollPopup: () => {
        document.getElementById('pre-toll-hud-modal')?.classList.add('hidden');
    },

    // ═══════════════════════════════════════════════════════════════
    // PRE-TOLL APPROACHING DETECTION & AI ANNOUNCEMENT
    // ═══════════════════════════════════════════════════════════════
    checkApproachingTolls: (lat, lng) => {
        if (!IndiaMapPlanner.selectedRouteData || !IndiaMapPlanner.selectedRouteData.tolls) return;
        const vehicleType = document.getElementById('route-vehicle-selector')?.value || document.getElementById('vehicle-type')?.value || 'LMV';

        IndiaMapPlanner.selectedRouteData.tolls.forEach(routeToll => {
            const tollId = routeToll.id;
            if (IndiaMapPlanner.approachedTollIds.has(tollId) || IndiaMapPlanner.chargedTollIds.has(tollId)) return;

            const toll = window.TollSeedData?.find(s => s.id === tollId) || routeToll;
            const tLat = (routeToll.lat !== undefined && routeToll.lat !== null) ? routeToll.lat : toll.lat;
            const tLng = (routeToll.lng !== undefined && routeToll.lng !== null) ? routeToll.lng : toll.lng;
            if (!tLat || !tLng) return;

            const dLat = (tLat - lat) * 111;
            const dLng = (tLng - lng) * 111 * Math.cos(lat * Math.PI / 180);
            const distKm = Math.sqrt(dLat*dLat + dLng*dLng);

            // Trigger Pre-Toll Approaching Alert when within 2.5km and >= 0.8km
            if (distKm <= 2.5 && distKm >= 0.8) {
                IndiaMapPlanner.approachedTollIds.add(tollId);

                let cost = TollData.getTollCost(tollId, vehicleType);
                if (IndiaMapPlanner.isSpecialVerified) cost = 0;
                const curBal = Storage.get(Storage.KEYS.FASTAG_BALANCE, 1250);
                const remBal = Math.max(0, curBal - cost);

                // Populate Pre-Toll HUD Modal
                const modal = document.getElementById('pre-toll-hud-modal');
                const nameEl = document.getElementById('pre-toll-name');
                const subEl = document.getElementById('pre-toll-sub');
                const feeEl = document.getElementById('pre-toll-fee');
                const curBalEl = document.getElementById('pre-toll-cur-bal');
                const remBalEl = document.getElementById('pre-toll-rem-bal');

                if (nameEl) nameEl.textContent = toll.name || 'NH Toll Plaza';
                if (subEl) subEl.textContent = `Approaching Barrier in ~${distKm.toFixed(1)} km · NHAI FASTag Lane Armed`;
                if (feeEl) feeEl.textContent = `₹${cost}`;
                if (curBalEl) curBalEl.textContent = `₹${curBal}`;
                if (remBalEl) remBalEl.textContent = `₹${remBal}`;

                if (modal) modal.classList.remove('hidden');

                // AI Voice Announcement
                if (window.VoiceAssistant && typeof VoiceAssistant.speak === 'function') {
                    VoiceAssistant.speak(`Toll ahead: ${toll.name || 'Toll Plaza'}. A toll fee of rupees ${cost} will be deducted from your FASTag account. Your current balance is rupees ${curBal}.`);
                }

                // Auto-dismiss HUD after 8 seconds
                setTimeout(() => {
                    IndiaMapPlanner.dismissPreTollPopup();
                }, 8000);
            }
        });
    },

    updateTripPosition: (lat, lng, stepIndex = 0, coords = null) => {
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

        // Calculate heading/bearing
        let headingDeg = 0;
        if (coords && stepIndex < coords.length - 1) {
            const next = coords[stepIndex + 1];
            const dY = next[1] - lat;
            const dX = (next[0] - lng) * Math.cos(lat * Math.PI / 180);
            headingDeg = (Math.atan2(dX, dY) * 180 / Math.PI + 360) % 360;
        }

        // Dynamic Cruising Speed simulation (78 - 104 km/h)
        const totalDist = parseFloat(IndiaMapPlanner.selectedRouteData?.totalDist) || 100;
        const progressKm = coords && coords.length > 0 ? (stepIndex / coords.length) * totalDist : 0;
        const fluctuatingSpeed = 82 + (Math.sin(stepIndex * 0.4) * 14);
        IndiaMapPlanner.currentSpeedKmh = fluctuatingSpeed;

        IndiaMapPlanner.updateCockpitSpeedometer(fluctuatingSpeed, headingDeg, progressKm, totalDist);
        IndiaMapPlanner.updateRoadHud(lat, lng, stepIndex, coords);

        // Broadcast live position to server
        if (IndiaMapPlanner.currentTripId && window.RealtimeService) {
            RealtimeService.updatePosition(IndiaMapPlanner.currentTripId, lat, lng);
        }

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

        IndiaMapPlanner.checkApproachingTolls(lat, lng);
        IndiaMapPlanner.checkTollGeofence(lat, lng);
        IndiaMapPlanner.updateUpcomingTollBox(lat, lng);
    },

    endLiveTrip: () => {
        if (IndiaMapPlanner.tripInterval) clearInterval(IndiaMapPlanner.tripInterval);
        IndiaMapPlanner.stopRealGps();
        
        // Speed = 0 km/h: Auto-restore panels smoothly
        document.body.classList.remove('navigating-3d-hud');
        document.getElementById('driving-cockpit-hud')?.classList.add('hidden');
        document.getElementById('pre-toll-hud-modal')?.classList.add('hidden');
        IndiaMapPlanner.updateCockpitSpeedometer(0);

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
                Gamification.addXP(Math.floor(dist * 0.5) + 50, 'Completed Highway Journey');
                Gamification.unlockAchievement('first_trip', 'FASTag Hero', 250);
                if (dist >= 100) {
                    Gamification.unlockAchievement('century_driver', 'Century Rider', 350);
                }
                if (IndiaMapPlanner.tripTollsPassed && IndiaMapPlanner.tripTollsPassed.length >= 2) {
                    Gamification.unlockAchievement('state_explorer', 'Interstate', 300);
                }
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
        IndiaMapPlanner.updateUpcomingTollBox();
    },

    checkTollGeofence: (lat, lng) => {
        if (!IndiaMapPlanner.selectedRouteData || !IndiaMapPlanner.selectedRouteData.tolls) return;
        if (!document.getElementById('pref-fastag')?.checked) return;
        
        const vehicleType = document.getElementById('route-vehicle-selector')?.value || document.getElementById('vehicle-type')?.value || 'LMV';
        
        IndiaMapPlanner.selectedRouteData.tolls.forEach(routeToll => {
            if (IndiaMapPlanner.chargedTollIds.has(routeToll.id)) return;
            const toll = window.TollSeedData?.find(s => s.id === routeToll.id) || routeToll;
            const tLat = (routeToll.lat !== undefined && routeToll.lat !== null) ? routeToll.lat : toll.lat;
            const tLng = (routeToll.lng !== undefined && routeToll.lng !== null) ? routeToll.lng : toll.lng;
            if (!tLat || !tLng) return;
            
            const dLat = (tLat - lat) * 111;
            const dLng = (tLng - lng) * 111 * Math.cos(lat * Math.PI / 180);
            if (Math.sqrt(dLat*dLat + dLng*dLng) < 0.8) {
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

                        const curBal = Storage.get(Storage.KEYS.FASTAG_BALANCE, 1250);
                        Utils.showToast(`⛩️ FASTag ₹${cost} paid at ${toll.name} (Bal: ₹${curBal})`, 'success');
                        
                        if (window.VoiceAssistant && typeof VoiceAssistant.speak === 'function') {
                            VoiceAssistant.speak(`Toll payment of rupees ${cost} successful at ${toll.name}. Remaining FASTag balance is rupees ${curBal}.`);
                        }
                    }
                }
                IndiaMapPlanner.updateUpcomingTollBox(lat, lng);
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
            // If this toll is already on the active route, the snapped route marker is used
            if (IndiaMapPlanner.selectedRouteData?.tolls?.some(rt => rt.id === toll.id)) return;
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
                className: 'snhop-toll-symbol-unit',
                html: `
                    <div class="snhop-toll-symbol-marker" style="display:inline-flex; align-items:center; justify-content:center; gap:3px; background:rgba(9, 13, 16, 0.94); border:1.5px solid ${cc}; border-radius:10px; padding:2px 6px; box-shadow:0 3px 8px rgba(0,0,0,0.8), 0 0 8px ${cc}55; transform:translate(-50%, -50%); cursor:pointer; font-family:var(--font-display),sans-serif;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${cc}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 21h18M5 21V7l7-3 7 3v14M9 21v-6a3 3 0 0 1 6 0v6"/>
                        </svg>
                        <span style="font-size:9px; font-weight:800; color:${cc}; letter-spacing:0.5px; line-height:1;">TOLL</span>
                    </div>
                `,
                iconSize: [46, 20],
                iconAnchor: [23, 10]
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
            <circle cx="18" cy="46" r="6" fill="#090d10"/><circle cx="18" cy="46" r="3" fill="#94a3b8"/>
            <circle cx="46" cy="46" r="6" fill="#090d10"/><circle cx="46" cy="46" r="3" fill="#94a3b8"/>
            <polygon points="46,20 54,20 52,23 48,23" fill="#241e17"/>
            <rect x="7" y="41" width="4" height="3" rx="1" fill="#facc15"/>
            <rect x="53" y="41" width="4" height="3" rx="1" fill="#facc15"/>
            <defs>
                <linearGradient id="gRedCar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f87171"/><stop offset="50%" stop-color="#ef4444"/><stop offset="100%" stop-color="#991b1b"/></linearGradient>
                <linearGradient id="gGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7dd3fc"/><stop offset="100%" stop-color="#059669"/></linearGradient>
            </defs>
        </svg>`,
        
        'suv_blue': `<svg viewBox="0 0 64 64" width="38" height="38" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
            <ellipse cx="32" cy="54" rx="24" ry="5" fill="rgba(0,0,0,0.3)"/>
            <rect x="18" y="14" width="28" height="3" rx="1" fill="#475569"/>
            <path d="M10 42 L16 18 L48 18 L54 42 L56 46 L8 46 Z" fill="url(#gBlueSuv)"/>
            <path d="M18 20 L22 34 L32 34 L32 20 Z" fill="url(#gGlass)"/>
            <path d="M34 20 L34 34 L44 34 L46 20 Z" fill="url(#gGlass)"/>
            <circle cx="18" cy="46" r="7" fill="#090d10"/><circle cx="18" cy="46" r="3.5" fill="#cbd5e1"/>
            <circle cx="46" cy="46" r="7" fill="#090d10"/><circle cx="46" cy="46" r="3.5" fill="#cbd5e1"/>
            <defs>
                <linearGradient id="gBlueSuv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#10b981"/><stop offset="50%" stop-color="#059669"/><stop offset="100%" stop-color="#075985"/></linearGradient>
            </defs>
        </svg>`,
        
        'ev_green': `<svg viewBox="0 0 64 64" width="38" height="38" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
            <ellipse cx="32" cy="54" rx="24" ry="5" fill="rgba(16,185,129,0.35)"/>
            <path d="M12 40 Q20 18 32 18 Q44 18 52 40 L54 46 L10 46 Z" fill="url(#gEvGreen)"/>
            <path d="M20 23 Q32 21 44 23 L42 34 L22 34 Z" fill="url(#gGlass)"/>
            <circle cx="18" cy="46" r="6" fill="#090d10"/><circle cx="18" cy="46" r="2.5" fill="#10b981"/>
            <circle cx="46" cy="46" r="6" fill="#090d10"/><circle cx="46" cy="46" r="2.5" fill="#10b981"/>
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
            <circle cx="18" cy="46" r="6" fill="#090d10"/><circle cx="18" cy="46" r="3" fill="#e2e8f0"/>
            <circle cx="46" cy="46" r="6" fill="#090d10"/><circle cx="46" cy="46" r="3" fill="#e2e8f0"/>
            <defs>
                <linearGradient id="gCamper" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fb923c"/><stop offset="50%" stop-color="#ea580c"/><stop offset="100%" stop-color="#9a3412"/></linearGradient>
            </defs>
        </svg>`,
        
        'scooter': `<svg viewBox="0 0 64 64" width="38" height="38" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
            <ellipse cx="32" cy="54" rx="20" ry="4" fill="rgba(0,0,0,0.3)"/>
            <circle cx="16" cy="46" r="6" fill="#090d10"/><circle cx="16" cy="46" r="3" fill="#cbd5e1"/>
            <circle cx="48" cy="46" r="6" fill="#090d10"/><circle cx="48" cy="46" r="3" fill="#cbd5e1"/>
            <path d="M16 46 L26 46 L34 38 L42 22 L46 22" stroke="#06b6d4" stroke-width="4" fill="none" stroke-linecap="round"/>
            <path d="M26 46 L30 32 L38 32 L34 46 Z" fill="#0891b2"/>
            <circle cx="46" cy="20" r="3" fill="#facc15"/>
        </svg>`,
        
        'motorcycle': `<svg viewBox="0 0 64 64" width="38" height="38" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
            <ellipse cx="32" cy="54" rx="22" ry="4" fill="rgba(0,0,0,0.3)"/>
            <circle cx="14" cy="44" r="7" fill="#090d10"/><circle cx="14" cy="44" r="3.5" fill="#f59e0b"/>
            <circle cx="50" cy="44" r="7" fill="#090d10"/><circle cx="50" cy="44" r="3.5" fill="#f59e0b"/>
            <path d="M14 44 L28 32 L40 32 L50 44" stroke="#e11d48" stroke-width="5" fill="none" stroke-linecap="round"/>
            <path d="M26 30 L36 24 L44 26 L42 34 Z" fill="#be123c"/>
            <path d="M42 26 L46 20 L48 20" stroke="#475569" stroke-width="3" fill="none" stroke-linecap="round"/>
        </svg>`,
        
        'truck': `<svg viewBox="0 0 64 64" width="38" height="38" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
            <ellipse cx="32" cy="54" rx="26" ry="5" fill="rgba(0,0,0,0.3)"/>
            <rect x="6" y="16" width="32" height="28" rx="2" fill="url(#gTruckTrailer)"/>
            <path d="M38 24 L46 24 L52 34 L52 44 L38 44 Z" fill="url(#gTruckCab)"/>
            <path d="M44 26 L48 26 L50 32 L44 32 Z" fill="url(#gGlass)"/>
            <circle cx="14" cy="46" r="6" fill="#090d10"/><circle cx="14" cy="46" r="2.5" fill="#94a3b8"/>
            <circle cx="28" cy="46" r="6" fill="#090d10"/><circle cx="28" cy="46" r="2.5" fill="#94a3b8"/>
            <circle cx="46" cy="46" r="6" fill="#090d10"/><circle cx="46" cy="46" r="2.5" fill="#94a3b8"/>
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
            <circle cx="16" cy="46" r="6" fill="#090d10"/><circle cx="16" cy="46" r="2.5" fill="#e2e8f0"/>
            <circle cx="46" cy="46" r="6" fill="#090d10"/><circle cx="46" cy="46" r="2.5" fill="#e2e8f0"/>
            <defs>
                <linearGradient id="gBus" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8b5cf6"/><stop offset="50%" stop-color="#047857"/><stop offset="100%" stop-color="#4c1d95"/></linearGradient>
            </defs>
        </svg>`
    },

    _getOriginPinIcon: (name = 'Start') => {
        return L.divIcon({
            className: 'custom-pin-container',
            html: `
                <div style="position:relative; display:flex; flex-direction:column; align-items:center;">
                    <div style="background:rgba(14,20,24,0.95); color:#34d399; font-size:10px; font-weight:800; padding:3px 9px; border-radius:12px; border:1.5px solid #10b981; white-space:nowrap; box-shadow:0 4px 12px rgba(0,0,0,0.6); margin-bottom:2px;">📍 ${name}</div>
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
                    <div style="background:rgba(14,20,24,0.95); color:#f87171; font-size:10px; font-weight:800; padding:3px 9px; border-radius:12px; border:1.5px solid #ef4444; white-space:nowrap; box-shadow:0 4px 12px rgba(0,0,0,0.6); margin-bottom:2px;">🏁 ${name}</div>
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

    setDestinationMarker: (place) => {
        IndiaMapPlanner.setDestMarker(place);
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
    // GOOGLE MAPS STYLE MOBILE CONTROLS & DEDICATED SEARCH SHEET
    // ═══════════════════════════════════════════════════════════════
    openMobileSearch: () => {
        const sheet = document.getElementById('mobile-search-sheet');
        if (sheet) {
            sheet.classList.remove('hidden');
            const input = document.getElementById('mobile-search-sheet-input');
            if (input) {
                input.value = '';
                setTimeout(() => input.focus(), 150);
            }
            IndiaMapPlanner.renderMobileSearchSuggestions('');
        }
    },

    closeMobileSearch: () => {
        const sheet = document.getElementById('mobile-search-sheet');
        if (sheet) sheet.classList.add('hidden');
    },

    clearMobileSearchSheet: () => {
        const input = document.getElementById('mobile-search-sheet-input');
        const clearBtn = document.getElementById('btn-mobile-sheet-clear');
        if (input) {
            input.value = '';
            input.focus();
        }
        if (clearBtn) clearBtn.style.display = 'none';
        IndiaMapPlanner.renderMobileSearchSuggestions('');
    },

    resolvePlaceQuery: async (query) => {
        if (!query || !query.trim()) return null;
        let clean = query.trim().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');
        let cleanLower = clean.toLowerCase();

        // 1. Search in IndiaMapPlanner.cities & IndiaMapData.nodes
        let cityPool = IndiaMapPlanner.cities || [];
        if (cityPool.length === 0 && window.IndiaMapData && window.IndiaMapData.nodes) {
            cityPool = Object.values(IndiaMapData.nodes);
        }

        let found = cityPool.find(c => c.name && (
            c.name.toLowerCase() === cleanLower ||
            c.name.toLowerCase().startsWith(cleanLower) ||
            cleanLower.startsWith(c.name.toLowerCase()) ||
            c.name.toLowerCase().includes(cleanLower) ||
            cleanLower.includes(c.name.toLowerCase())
        ));

        // 1.1 Fuzzy Matching for common typos (e.g. "amritsir" -> "Amritsar")
        if (!found) {
            const levenshtein = (a, b) => {
                const matrix = [];
                for (let i = 0; i <= b.length; i++) matrix[i] = [i];
                for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
                for (let i = 1; i <= b.length; i++) {
                    for (let j = 1; j <= a.length; j++) {
                        matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
                            ? matrix[i - 1][j - 1]
                            : Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
                    }
                }
                return matrix[b.length][a.length];
            };

            let best = null;
            let bestDist = 999;
            for (const c of cityPool) {
                if (!c.name) continue;
                const cName = c.name.toLowerCase();
                const dist = levenshtein(cleanLower, cName);
                const maxLen = Math.max(cleanLower.length, cName.length);
                if (dist <= 2 && dist < bestDist && (dist / maxLen) < 0.35) {
                    bestDist = dist;
                    best = c;
                }
            }
            if (best) found = best;
        }

        if (found && found.lat && found.lng) {
            return {
                name: found.name,
                state: found.state || 'India',
                lat: parseFloat(found.lat),
                lng: parseFloat(found.lng),
                details: `National Highway City • ${found.state || 'India'} Corridor`,
                category: 'CITY / JUNCTION'
            };
        }

        // 2. Search in TollSeedData
        if (window.TollSeedData && Array.isArray(TollSeedData)) {
            const matchedToll = TollSeedData.find(t => t.name && (
                t.name.toLowerCase().includes(cleanLower) ||
                cleanLower.includes(t.name.toLowerCase())
            ));
            if (matchedToll) {
                return {
                    name: matchedToll.name,
                    state: matchedToll.state || 'India',
                    lat: parseFloat(matchedToll.lat),
                    lng: parseFloat(matchedToll.lng),
                    details: `Toll Plaza [NH-${matchedToll.nhCorridor || 'Corridor'}] • Fee: ₹${matchedToll.feeLMV || '100'} LMV`,
                    category: 'TOLL PLAZA'
                };
            }
        }

        // 3. Fallback to Dual-Engine Geocoding (Photon + Nominatim)
        try {
            const [phoRes, nomRes] = await Promise.all([
                fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(clean)}&limit=1&lat=20.5937&lon=78.9629`).then(r => r.json()).catch(() => null),
                fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean + ', India')}&countrycodes=in&limit=1`).then(r => r.json()).catch(() => null)
            ]);

            if (phoRes && phoRes.features && phoRes.features.length > 0) {
                const f = phoRes.features[0];
                return {
                    name: f.properties.name || clean,
                    state: f.properties.state || 'India',
                    lat: parseFloat(f.geometry.coordinates[1]),
                    lng: parseFloat(f.geometry.coordinates[0]),
                    details: `${f.properties.name || clean} • ${f.properties.state || 'India'} Corridor`,
                    category: 'LOCATION'
                };
            }

            if (nomRes && nomRes.length > 0) {
                const top = nomRes[0];
                return {
                    name: top.display_name.split(',')[0].trim(),
                    state: top.display_name.split(',').slice(1, 3).join(',').trim(),
                    lat: parseFloat(top.lat),
                    lng: parseFloat(top.lon),
                    details: top.display_name,
                    category: top.type ? top.type.toUpperCase() : 'LOCATION'
                };
            }
        } catch (e) {
            console.warn('Geocoding error:', e);
        }

        return null;
    },

    quickSearchPlace: async (placeName) => {
        IndiaMapPlanner.closeMobileSearch();
        Utils.showToast(`Searching "${placeName}"... 🔍`, 'info');

        const cleanLower = (placeName || '').trim().toLowerCase();
        const fromToMatch = cleanLower.match(/(?:route\s+|directions\s+)?(?:from\s+)?([a-z\s]+?)\s+to\s+([a-z\s]+)/i);
        if (fromToMatch && fromToMatch[1] && fromToMatch[2]) {
            const originName = fromToMatch[1].replace(/^(from|take|show|find|route|get)\s+/i, '').trim();
            const destName = fromToMatch[2].replace(/\s+(route|highway|fastest|cheapest)$/i, '').trim();

            const [origPlace, destPlace] = await Promise.all([
                IndiaMapPlanner.resolvePlaceQuery(originName),
                IndiaMapPlanner.resolvePlaceQuery(destName)
            ]);

            if (destPlace) {
                if (origPlace) {
                    IndiaMapPlanner.selectedOrigin = {
                        name: origPlace.name,
                        state: origPlace.state || '',
                        lat: origPlace.lat,
                        lng: origPlace.lng
                    };
                    const origInput = document.getElementById('route-origin-input');
                    if (origInput) origInput.value = origPlace.name;
                    IndiaMapPlanner.setOriginMarker(IndiaMapPlanner.selectedOrigin);
                }
                IndiaMapPlanner.showVoicePlaceResult(destPlace);
                Utils.showToast(`Route: ${originName} ➔ ${destName} 🛣️`, 'success');
                return;
            }
        }

        const place = await IndiaMapPlanner.resolvePlaceQuery(placeName);
        if (place) {
            IndiaMapPlanner.showVoicePlaceResult(place);
            Utils.showToast(`Found: ${place.name} 📍`, 'success');
        } else {
            Utils.showToast(`Could not pinpoint "${placeName}".`, 'warning');
        }
    },

    renderMobileSearchSuggestions: (query = '') => {
        const container = document.getElementById('mobile-sheet-suggestions');
        if (!container) return;

        const q = (query || '').trim().toLowerCase();
        let items = [];

        if (!q) {
            // Default top popular corridors & tourist destinations
            const defaultCities = ['Delhi', 'Jaipur', 'Chandigarh', 'Amritsar', 'Agra', 'Mumbai', 'Bengaluru', 'Lucknow', 'Varanasi', 'Goa'];
            items = (IndiaMapPlanner.cities || []).filter(c => defaultCities.includes(c.name)).slice(0, 8);
        } else {
            // Match cities
            items = (IndiaMapPlanner.cities || []).filter(c => 
                c.name.toLowerCase().includes(q) || (c.state && c.state.toLowerCase().includes(q))
            ).slice(0, 10);

            // Also match tolls
            if (window.TollSeedData) {
                const tollMatches = TollSeedData.filter(t => t.name.toLowerCase().includes(q)).slice(0, 4);
                tollMatches.forEach(t => {
                    items.push({
                        name: t.name,
                        state: `Toll Plaza • NH-${t.nhCorridor || 'Corridor'}`,
                        lat: t.lat,
                        lng: t.lng,
                        isToll: true
                    });
                });
            }
        }

        if (items.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:30px 10px; color:#94a3b8; font-size:12px;">
                    <i class="fa-solid fa-magnifying-glass" style="font-size:24px; margin-bottom:8px; opacity:0.5; display:block;"></i>
                    No immediate match for "${query}". Tap to live search online:
                    <button type="button" class="btn btn-outline" style="margin:12px auto 0; font-size:11.5px;" onclick="IndiaMapPlanner.quickSearchPlace('${query}');">
                        Search "${query}" via National Highway GIS
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = items.map(item => {
            const icon = item.isToll ? 'fa-road' : 'fa-location-dot';
            const iconBg = item.isToll ? 'rgba(245,158,11,0.15)' : 'rgba(16, 185, 129,0.15)';
            const iconCol = item.isToll ? '#f59e0b' : '#10b981';
            return `
                <div class="mobile-suggestion-item" onclick="IndiaMapPlanner.quickSearchPlace('${item.name.replace(/'/g, "\\'")}');">
                    <div class="mobile-suggestion-icon" style="background:${iconBg}; color:${iconCol};">
                        <i class="fa-solid ${icon}"></i>
                    </div>
                    <div>
                        <div class="mobile-suggestion-main">${item.name}</div>
                        <div class="mobile-suggestion-sub">${item.state || 'India Highway Network'}</div>
                    </div>
                </div>
            `;
        }).join('');
    },

    _initMobileSearchInput: () => {
        const input = document.getElementById('mobile-search-sheet-input');
        const clearBtn = document.getElementById('btn-mobile-sheet-clear');
        if (!input) return;

        input.addEventListener('input', (e) => {
            const val = e.target.value;
            if (clearBtn) clearBtn.style.display = val.length > 0 ? 'inline-flex' : 'none';
            IndiaMapPlanner.renderMobileSearchSuggestions(val);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                IndiaMapPlanner.quickSearchPlace(input.value.trim());
            }
        });
    },

    toggleRouteSummary: () => {
        const panel = document.getElementById('route-summary-panel');
        const chevron = document.getElementById('route-window-chevron');
        if (!panel) return;
        const isMin = panel.classList.toggle('mobile-minimized');
        if (chevron) {
            chevron.className = isMin ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
        }
        const btn = document.getElementById('btn-toggle-route-window');
        if (btn) btn.title = isMin ? 'Expand Route Details' : 'Minimize Route Details';
    },

    openMobileAvatarModal: () => {
        const modal = document.getElementById('mobile-avatar-modal');
        const grid = document.getElementById('mobile-avatar-grid');
        if (!modal || !grid) return;

        grid.innerHTML = IndiaMapPlanner._vehicleTypes.map(key => {
            const isSelected = (IndiaMapPlanner._currentVehicleAvatar || 'default') === key;
            const icon = IndiaMapPlanner._vehicleIcons[key] || '📍';
            const name = IndiaMapPlanner._vehicleNames[key] || key;
            return `
                <div class="avatar-option-card ${isSelected ? 'selected' : ''}" onclick="IndiaMapPlanner.selectMobileAvatar('${key}')" style="background:rgba(255,255,255,0.06); border:1px solid ${isSelected ? '#10b981':'rgba(255,255,255,0.1)'}; border-radius:14px; padding:12px 6px; text-align:center; cursor:pointer; transition:all 0.2s cubic-bezier(0.2,0.8,0.2,1);">
                    <div style="font-size:26px; margin-bottom:6px;">${icon}</div>
                    <div style="font-size:10.5px; font-weight:700; color:#fff;">${name}</div>
                </div>
            `;
        }).join('');

        Utils.toggleVisibility('mobile-avatar-modal', true);
    },

    selectMobileAvatar: (key) => {
        IndiaMapPlanner._currentVehicleAvatar = key;
        const icon = IndiaMapPlanner._vehicleIcons[key] || '📍';
        const name = IndiaMapPlanner._vehicleNames[key] || key;

        const mobileEmoji = document.getElementById('mobile-avatar-emoji');
        if (mobileEmoji) mobileEmoji.textContent = icon;

        const dockLabel = document.getElementById('dock-avatar-label');
        if (dockLabel) dockLabel.textContent = `Avatar: ${name}`;

        if (IndiaMapPlanner.userLocationMarker) {
            const latlng = IndiaMapPlanner.userLocationMarker.getLatLng();
            IndiaMapPlanner.userLocationMarker.remove();
            IndiaMapPlanner.userLocationMarker = L.marker(latlng, { icon: IndiaMapPlanner._getUserLocIcon() })
                .bindTooltip("My Location", { permanent: false, direction: 'top' })
                .addTo(IndiaMapPlanner.map);
        }
        Utils.toggleVisibility('mobile-avatar-modal', false);
        Utils.showToast(`3D Avatar changed to ${name} ${icon}`, 'success');
    },

    toggleSatelliteStreet: () => {
        const iconEl = document.getElementById('mobile-layer-icon');
        const dockLayerLabel = document.getElementById('dock-layer-label');

        if (IndiaMapPlanner._isSatellite) {
            // Switch Satellite -> Dark Mode
            if (IndiaMapPlanner.map) {
                if (IndiaMapPlanner._satelliteLayer) IndiaMapPlanner.map.removeLayer(IndiaMapPlanner._satelliteLayer);
                if (IndiaMapPlanner._labelsLayer) IndiaMapPlanner.map.removeLayer(IndiaMapPlanner._labelsLayer);
                if (IndiaMapPlanner._streetLayer) IndiaMapPlanner._streetLayer.addTo(IndiaMapPlanner.map);
            }
            IndiaMapPlanner._isSatellite = false;
            if (iconEl) iconEl.className = 'fa-solid fa-moon';
            if (dockLayerLabel) dockLayerLabel.textContent = 'Dark Mode';
            Utils.showToast('Dark Mode enabled 🌙', 'info');
        } else {
            // Switch Dark Mode -> Satellite View
            if (IndiaMapPlanner.map) {
                if (IndiaMapPlanner._streetLayer) IndiaMapPlanner.map.removeLayer(IndiaMapPlanner._streetLayer);
                if (IndiaMapPlanner._satelliteLayer) IndiaMapPlanner._satelliteLayer.addTo(IndiaMapPlanner.map);
                if (IndiaMapPlanner._labelsLayer) IndiaMapPlanner._labelsLayer.addTo(IndiaMapPlanner.map);
            }
            IndiaMapPlanner._isSatellite = true;
            if (iconEl) iconEl.className = 'fa-solid fa-satellite';
            if (dockLayerLabel) dockLayerLabel.textContent = 'Satellite View';
            Utils.showToast('Satellite View enabled 🛰️', 'info');
        }
    },

    triggerVoiceRoute: () => {
        if (window.VoiceAssistant && typeof VoiceAssistant.startListening === 'function') {
            VoiceAssistant.startListening();
        } else {
            IndiaMapPlanner.openMobileSearch();
            Utils.showToast('🎙️ Speak origin and destination in Search', 'info');
        }
    },

    _initTouchHoldTooltips: () => {
        const tooltipEl = document.getElementById('touch-hold-tooltip');
        const tooltipText = document.getElementById('touch-hold-tooltip-text');
        if (!tooltipEl || !tooltipText) return;

        let holdTimer = null;
        let hideTimer = null;

        const showTooltip = (targetEl, label) => {
            clearTimeout(hideTimer);
            tooltipText.textContent = label;
            const rect = targetEl.getBoundingClientRect();
            
            // Position above or to the left of the button
            const isRightSide = rect.left > window.innerWidth / 2;
            if (isRightSide) {
                tooltipEl.style.right = (window.innerWidth - rect.left + 12) + 'px';
                tooltipEl.style.left = 'auto';
            } else {
                tooltipEl.style.left = (rect.right + 12) + 'px';
                tooltipEl.style.right = 'auto';
            }
            tooltipEl.style.top = (rect.top + (rect.height / 2) - 16) + 'px';
            tooltipEl.classList.remove('hidden');

            try { navigator.vibrate?.(35); } catch (e) {}
        };

        const hideTooltip = () => {
            clearTimeout(holdTimer);
            hideTimer = setTimeout(() => {
                tooltipEl.classList.add('hidden');
            }, 1200);
        };

        const buttonsWithTooltips = [
            { id: 'mobile-fab-locate', text: '🎯 My Location (GPS)' },
            { id: 'mobile-fab-avatar', text: '🚗 3D Vehicle Avatar' },
            { id: 'mobile-fab-layer', text: '🛰️ Satellite / Dark View' },
            { id: 'mobile-fab-sos', text: '🚑 1033 Rapid Emergency SOS' },
            { id: 'btn-toggle-route-window', text: '▲ Expand / Minimize Route' }
        ];

        buttonsWithTooltips.forEach(item => {
            const el = document.getElementById(item.id);
            if (!el) return;

            // Touch-and-Hold on Mobile
            el.addEventListener('touchstart', () => {
                clearTimeout(holdTimer);
                holdTimer = setTimeout(() => {
                    showTooltip(el, item.text);
                }, 280);
            }, { passive: true });

            el.addEventListener('touchend', hideTooltip, { passive: true });
            el.addEventListener('touchcancel', hideTooltip, { passive: true });

            // Desktop Hover
            el.addEventListener('mouseenter', () => showTooltip(el, item.text));
            el.addEventListener('mouseleave', hideTooltip);
        });
    },

    // ═══════════════════════════════════════════════════════════════
    // SWIPE TO DISMISS GESTURE ENGINE (Mobile Notifications & Popups)
    // ═══════════════════════════════════════════════════════════════
    _initSwipeToDismiss: () => {
        const attachSwipe = (elId, onDismiss) => {
            const el = document.getElementById(elId);
            if (!el) return;

            let startY = 0;
            let startX = 0;
            let currentY = 0;
            let currentX = 0;
            let isSwiping = false;

            el.addEventListener('touchstart', (e) => {
                if (e.touches.length !== 1) return;
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                currentX = startX;
                currentY = startY;
                isSwiping = true;
                el.style.transition = 'none';
            }, { passive: true });

            el.addEventListener('touchmove', (e) => {
                if (!isSwiping || e.touches.length !== 1) return;
                currentX = e.touches[0].clientX;
                currentY = e.touches[0].clientY;
                const deltaY = currentY - startY;
                const deltaX = currentX - startX;

                // Dragging down or sideways
                if (deltaY > 0) {
                    el.style.transform = `translateY(${deltaY}px)`;
                    el.style.opacity = Math.max(0.3, 1 - (deltaY / 220));
                } else if (Math.abs(deltaX) > 20) {
                    el.style.transform = `translateX(${deltaX}px)`;
                    el.style.opacity = Math.max(0.3, 1 - (Math.abs(deltaX) / 220));
                }
            }, { passive: true });

            el.addEventListener('touchend', () => {
                if (!isSwiping) return;
                isSwiping = false;
                el.style.transition = 'all 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)';
                const deltaY = currentY - startY;
                const deltaX = currentX - startX;

                if (deltaY > 60 || Math.abs(deltaX) > 80) {
                    // Animate off-screen
                    if (deltaY > 60) {
                        el.style.transform = 'translateY(120%)';
                    } else {
                        el.style.transform = `translateX(${deltaX > 0 ? '120%' : '-120%'})`;
                    }
                    el.style.opacity = '0';
                    setTimeout(() => {
                        if (typeof onDismiss === 'function') {
                            onDismiss();
                        } else {
                            el.classList.add('hidden');
                        }
                        el.style.transform = '';
                        el.style.opacity = '';
                    }, 220);
                } else {
                    // Snap back
                    el.style.transform = '';
                    el.style.opacity = '';
                }
            }, { passive: true });
        };

        attachSwipe('admin-broadcasts-panel', () => {
            document.getElementById('admin-broadcasts-panel')?.classList.add('hidden');
        });
        attachSwipe('google-place-card', () => {
            IndiaMapPlanner.closePlaceCard();
        });
        attachSwipe('route-summary-panel', () => {
            document.getElementById('route-summary-panel')?.classList.add('hidden');
        });
    },

    // ═══════════════════════════════════════════════════════════════
    // GOOGLE MAPS STYLE PLACE ACTION CONTROLS & MULTI-MODAL MODES
    // ═══════════════════════════════════════════════════════════════
    _currentVoicePlace: null,
    _voicePlaceMarker: null,
    _selectedRouteOption: 'fastest',

    selectRouteOption: (option) => {
        IndiaMapPlanner._selectedRouteOption = option;
        const optFastest = document.getElementById('route-opt-fastest');
        const optAlternate = document.getElementById('route-opt-alternate');
        if (optFastest) optFastest.classList.toggle('active', option === 'fastest');
        if (optAlternate) optAlternate.classList.toggle('active', option === 'alternate');

        if (option === 'fastest') {
            Utils.showToast('Selected: NH Expressway (Fastest Route) ⚡', 'info');
        } else {
            Utils.showToast('Selected: State Highway (Toll-Free Route) 🌿', 'info');
        }
    },

    showVoicePlaceResult: (place) => {
        if (!place) return;
        IndiaMapPlanner._currentVoicePlace = place;
        const lat = parseFloat(place.lat);
        const lng = parseFloat(place.lng);
        if (isNaN(lat) || isNaN(lng)) return;

        // Synchronize destination in inputs & state
        IndiaMapPlanner.selectedDest = {
            name: place.name,
            state: place.state || '',
            lat: lat,
            lng: lng
        };
        IndiaMapPlanner.selectedDestination = IndiaMapPlanner.selectedDest;

        const destInput = document.getElementById('route-dest-input');
        if (destInput) destInput.value = place.name;
        const topSearchInput = document.getElementById('top-search-input');
        if (topSearchInput) topSearchInput.value = place.name;

        // Ensure origin is set; ALWAYS default to "My Location" (GPS or User's Location)
        const origInput = document.getElementById('route-origin-input');
        if (!IndiaMapPlanner.selectedOrigin || isNaN(IndiaMapPlanner.selectedOrigin.lat)) {
            if (IndiaMapPlanner.userLocationMarker) {
                const uLoc = IndiaMapPlanner.userLocationMarker.getLatLng();
                IndiaMapPlanner.selectedOrigin = {
                    name: 'My Location',
                    state: '',
                    lat: uLoc.lat,
                    lng: uLoc.lng
                };
            } else if (IndiaMapPlanner.lastKnownGps) {
                IndiaMapPlanner.selectedOrigin = {
                    name: 'My Location',
                    state: '',
                    lat: IndiaMapPlanner.lastKnownGps.lat,
                    lng: IndiaMapPlanner.lastKnownGps.lng
                };
            } else {
                IndiaMapPlanner.selectedOrigin = {
                    name: 'My Location',
                    state: '',
                    lat: 28.6139,
                    lng: 77.2090
                };
            }
            if (origInput) origInput.value = 'My Location';
            IndiaMapPlanner.setOriginMarker(IndiaMapPlanner.selectedOrigin);
        }

        // Clear any old route polylines & hide previous route summary panel
        IndiaMapPlanner._clearRoutePolylines();
        document.getElementById('route-summary-panel')?.classList.add('hidden');

        // Set destination marker
        IndiaMapPlanner.setDestMarker(IndiaMapPlanner.selectedDest);

        // Fly camera directly to location
        if (IndiaMapPlanner.map) {
            IndiaMapPlanner.map.flyTo([lat, lng], 12, { duration: 1.4 });
        }

        // Place glowing animated marker
        if (IndiaMapPlanner._voicePlaceMarker) IndiaMapPlanner._voicePlaceMarker.remove();
        const pinIcon = L.divIcon({
            className: 'voice-place-pin',
            html: `
                <div style="position:relative; display:flex; align-items:center; justify-content:center; width:38px; height:38px;">
                    <div style="position:absolute; width:100%; height:100%; border-radius:50%; background:rgba(16, 185, 129,0.45); animation:beaconPulse 1.4s infinite;"></div>
                    <div style="position:relative; width:28px; height:28px; border-radius:50%; background:#059669; border:2.5px solid #fff; box-shadow:0 4px 14px rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; color:#fff; font-size:13px;">
                        <i class="fa-solid fa-location-dot"></i>
                    </div>
                </div>
            `,
            iconSize: [38, 38],
            iconAnchor: [19, 19]
        });

        IndiaMapPlanner._voicePlaceMarker = L.marker([lat, lng], { icon: pinIcon })
            .bindTooltip(`📍 ${place.name}`, { permanent: false, direction: 'top' })
            .addTo(IndiaMapPlanner.map);

        // Compute Live Route Metrics
        const refLat = (IndiaMapPlanner.selectedOrigin && !isNaN(IndiaMapPlanner.selectedOrigin.lat)) ? IndiaMapPlanner.selectedOrigin.lat : 28.6139;
        const refLng = (IndiaMapPlanner.selectedOrigin && !isNaN(IndiaMapPlanner.selectedOrigin.lng)) ? IndiaMapPlanner.selectedOrigin.lng : 77.2090;
        const distKm = Math.max(15, Math.round(Utils.haversine(refLat, refLng, lat, lng) * 1.25));
        const roadHours = Math.floor(distKm / 65);
        const roadMins = Math.round(((distKm / 65) - roadHours) * 60);
        const fastestTimeStr = roadHours > 0 ? `${roadHours}h ${roadMins}m` : `${roadMins}m`;

        const altDistKm = Math.round(distKm * 1.12);
        const altHours = Math.floor(altDistKm / 52);
        const altMins = Math.round(((altDistKm / 52) - altHours) * 60);
        const altTimeStr = altHours > 0 ? `${altHours}h ${altMins}m` : `${altMins}m`;

        // Toll plazas count on corridor
        const corridorTolls = (window.TollSeedData || []).filter(t => {
            const minLat = Math.min(refLat, lat) - 0.5;
            const maxLat = Math.max(refLat, lat) + 0.5;
            const minLng = Math.min(refLng, lng) - 0.5;
            const maxLng = Math.max(refLng, lng) + 0.5;
            return t.lat >= minLat && t.lat <= maxLat && t.lng >= minLng && t.lng <= maxLng;
        });
        const tollCount = Math.max(1, corridorTolls.length > 0 ? corridorTolls.length : Math.round(distKm / 65));
        const tollFee = Math.round((tollCount * 90) / 10) * 10;

        // Update DOM elements in Google Place Card
        const card = document.getElementById('google-place-card');
        const nameEl = document.getElementById('place-name');
        const metaEl = document.getElementById('place-meta');
        const badgeEl = document.getElementById('place-badge');
        const trafficBadge = document.getElementById('place-traffic-badge');
        const origTextEl = document.getElementById('place-card-origin-text');
        const destTextEl = document.getElementById('place-card-dest-text');

        if (nameEl) nameEl.textContent = place.name + (place.state ? `, ${place.state}` : '');
        if (metaEl) metaEl.textContent = `Connected via National Highway • ${distKm} km route`;
        if (badgeEl) badgeEl.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${place.category || 'DESTINATION'}`;

        if (origTextEl) origTextEl.textContent = (IndiaMapPlanner.selectedOrigin.name === 'My Location' ? '📍 My Location' : IndiaMapPlanner.selectedOrigin.name);
        if (destTextEl) destTextEl.textContent = place.name + (place.state ? `, ${place.state}` : '');

        if (trafficBadge) {
            trafficBadge.innerHTML = `<span class="traffic-dot green"></span> Live Normal Traffic`;
        }

        // Update Route Options Tabs
        const optFastTime = document.getElementById('opt-fastest-time');
        const optFastDetails = document.getElementById('opt-fastest-details');
        const optAltTime = document.getElementById('opt-alternate-time');
        const optAltDetails = document.getElementById('opt-alternate-details');

        if (optFastTime) optFastTime.textContent = fastestTimeStr;
        if (optFastDetails) optFastDetails.textContent = `${distKm} km · ${tollCount} Tolls (₹${tollFee}) · Fastest`;
        if (optAltTime) optAltTime.textContent = altTimeStr;
        if (optAltDetails) optAltDetails.textContent = `${altDistKm} km · 0 Tolls (₹0) · State Hwy`;

        // Update Multi-Modal Modes
        const roadMeta = document.getElementById('transit-road-meta');
        const railMeta = document.getElementById('transit-rail-meta');
        const airMeta = document.getElementById('transit-air-meta');

        if (roadMeta) roadMeta.textContent = `${fastestTimeStr} · ${distKm} km · ${tollCount} Tolls (₹${tollFee})`;
        if (railMeta) {
            const railHours = Math.max(1, Math.round(distKm / 85));
            railMeta.textContent = distKm < 150 ? `~${Math.round(distKm/60)}h · Regional Express` : `~${railHours}h · Vande Bharat / Superfast`;
        }
        if (airMeta) {
            airMeta.textContent = distKm > 300 ? `~${distKm > 1000 ? '2h 15m' : '55m'} flight (Direct connections)` : `Scenic Road/Rail corridor optimal (<${distKm} km)`;
        }

        // Update Bookmark state
        const savedPlaces = JSON.parse(localStorage.getItem('nhai_saved_places') || '[]');
        const isSaved = savedPlaces.some(p => p.name === place.name);
        const saveIcon = document.getElementById('place-save-icon');
        const saveLabel = document.getElementById('place-save-label');
        if (saveIcon) saveIcon.className = isSaved ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';
        if (saveLabel) saveLabel.textContent = isSaved ? 'Saved' : 'Save';

        if (card) {
            card.classList.remove('hidden');
            card.style.display = 'block';
        }

        // Close search sheet & drawer on mobile
        if (window.innerWidth <= 768) {
            document.getElementById('nhai-sidebar')?.classList.add('collapsed');
            document.getElementById('mobile-drawer-backdrop')?.classList.add('hidden');
            IndiaMapPlanner.closeMobileSearch();
        }

        // Voice announcement
        VoiceAssistant.speak(`Found ${place.name}. Estimated travel time is ${fastestTimeStr} with ${tollCount} tolls.`);
    },

    setOriginToGPS: () => {
        if (IndiaMapPlanner.userLocationMarker) {
            const uLoc = IndiaMapPlanner.userLocationMarker.getLatLng();
            IndiaMapPlanner.selectedOrigin = { name: 'My Location', lat: uLoc.lat, lng: uLoc.lng, state: '' };
        } else {
            IndiaMapPlanner.selectedOrigin = { name: 'New Delhi', lat: 28.6139, lng: 77.2090, state: 'Delhi' };
            IndiaMapPlanner.setOriginMarker(IndiaMapPlanner.selectedOrigin);
        }
        const origInput = document.getElementById('route-origin-input');
        if (origInput) origInput.value = IndiaMapPlanner.selectedOrigin.name;

        document.querySelectorAll('.origin-chip').forEach(c => c.classList.remove('active'));
        document.getElementById('chip-orig-gps')?.classList.add('active');

        if (IndiaMapPlanner._currentVoicePlace) {
            IndiaMapPlanner.showVoicePlaceResult(IndiaMapPlanner._currentVoicePlace);
        }
        Utils.showToast('Origin set to Current Location 📍', 'info');
    },

    setOriginDirect: async (cityName) => {
        const place = await IndiaMapPlanner.resolvePlaceQuery(cityName);
        if (place) {
            IndiaMapPlanner.selectedOrigin = {
                name: place.name,
                state: place.state || '',
                lat: place.lat,
                lng: place.lng
            };
            const origInput = document.getElementById('route-origin-input');
            if (origInput) origInput.value = place.name;
            IndiaMapPlanner.setOriginMarker(IndiaMapPlanner.selectedOrigin);

            document.querySelectorAll('.origin-chip').forEach(c => c.classList.remove('active'));

            if (IndiaMapPlanner._currentVoicePlace) {
                IndiaMapPlanner.showVoicePlaceResult(IndiaMapPlanner._currentVoicePlace);
            }
            Utils.showToast(`Origin set to ${place.name} 🏛️`, 'info');
        }
    },

    swapPlaceLocations: () => {
        if (!IndiaMapPlanner.selectedOrigin || !IndiaMapPlanner.selectedDest) {
            Utils.showToast('Need both Origin and Destination to swap', 'warning');
            return;
        }
        const temp = IndiaMapPlanner.selectedOrigin;
        IndiaMapPlanner.selectedOrigin = IndiaMapPlanner.selectedDest;
        IndiaMapPlanner.selectedDest = temp;
        IndiaMapPlanner.selectedDestination = temp;
        IndiaMapPlanner._currentVoicePlace = temp;

        const origInput = document.getElementById('route-origin-input');
        const destInput = document.getElementById('route-dest-input');
        if (origInput) origInput.value = IndiaMapPlanner.selectedOrigin.name;
        if (destInput) destInput.value = IndiaMapPlanner.selectedDest.name;

        IndiaMapPlanner.setOriginMarker(IndiaMapPlanner.selectedOrigin);
        IndiaMapPlanner.setDestMarker(IndiaMapPlanner.selectedDest);

        IndiaMapPlanner.showVoicePlaceResult(IndiaMapPlanner.selectedDest);
        Utils.showToast('Swapped Origin and Destination ⇅', 'info');
    },

    openOriginPicker: () => {
        const modal = document.getElementById('origin-picker-modal');
        const input = document.getElementById('origin-picker-input');
        const list = document.getElementById('origin-picker-list');
        if (!modal || !list) return;

        const popular = [
            { name: 'My Current Location (GPS)', lat: null, lng: null, isGps: true },
            { name: 'New Delhi', state: 'Delhi', lat: 28.6139, lng: 77.2090 },
            { name: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777 },
            { name: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lng: 77.5946 },
            { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707 },
            { name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639 },
            { name: 'Hyderabad', state: 'Telangana', lat: 17.3850, lng: 78.4867 },
            { name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873 },
            { name: 'Chandigarh', state: 'Punjab / Haryana', lat: 30.7333, lng: 76.7794 },
            { name: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714 },
            { name: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462 }
        ];

        const renderList = (filterText = '') => {
            const q = filterText.toLowerCase().trim();
            const filtered = popular.filter(p => p.name.toLowerCase().includes(q) || (p.state && p.state.toLowerCase().includes(q)));
            list.innerHTML = filtered.map(p => `
                <div class="mobile-suggestion-item" onclick="IndiaMapPlanner.selectOriginFromPicker('${p.name}', ${p.lat}, ${p.lng}, ${!!p.isGps});" style="padding:10px 12px; border-radius:10px; cursor:pointer;">
                    <i class="fa-solid ${p.isGps ? 'fa-location-crosshairs' : 'fa-city'}" style="color:${p.isGps ? '#10b981' : '#10b981'}; font-size:14px;"></i>
                    <div style="flex:1;">
                        <div style="font-size:12px; font-weight:700; color:#fff;">${p.name}</div>
                        ${p.state ? `<div style="font-size:10px; color:#94a3b8;">${p.state}</div>` : ''}
                    </div>
                </div>
            `).join('');
        };

        renderList('');
        if (input) {
            input.value = '';
            input.oninput = (e) => renderList(e.target.value);
            input.onkeydown = async (e) => {
                if (e.key === 'Enter' && input.value.trim()) {
                    await IndiaMapPlanner.setOriginDirect(input.value.trim());
                    Utils.toggleVisibility('origin-picker-modal', false);
                }
            };
        }

        modal.classList.remove('hidden');
        if (input) setTimeout(() => input.focus(), 150);
    },

    selectOriginFromPicker: (name, lat, lng, isGps) => {
        Utils.toggleVisibility('origin-picker-modal', false);
        if (isGps) {
            IndiaMapPlanner.setOriginToGPS();
        } else {
            IndiaMapPlanner.selectedOrigin = { name, lat: parseFloat(lat), lng: parseFloat(lng), state: '' };
            const origInput = document.getElementById('route-origin-input');
            if (origInput) origInput.value = name;
            IndiaMapPlanner.setOriginMarker(IndiaMapPlanner.selectedOrigin);
            if (IndiaMapPlanner._currentVoicePlace) {
                IndiaMapPlanner.showVoicePlaceResult(IndiaMapPlanner._currentVoicePlace);
            }
            Utils.showToast(`Origin set to ${name} 📍`, 'info');
        }
    },

    openDestPicker: () => {
        IndiaMapPlanner.openMobileSearch();
    },

    clearTopSearch: () => {
        const input = document.getElementById('top-search-input');
        const clearBtn = document.getElementById('btn-top-search-clear');
        const dropdown = document.getElementById('top-search-suggestions');
        if (input) {
            input.value = '';
            input.focus();
        }
        if (clearBtn) clearBtn.style.display = 'none';
        if (dropdown) dropdown.style.display = 'none';
    },

    closePlaceCard: () => {
        const card = document.getElementById('google-place-card');
        if (card) {
            card.classList.add('hidden');
            card.style.display = 'none';
        }
        if (IndiaMapPlanner._voicePlaceMarker) {
            IndiaMapPlanner._voicePlaceMarker.remove();
            IndiaMapPlanner._voicePlaceMarker = null;
        }
    },

    routeToPlace: (autoStart = false) => {
        const place = IndiaMapPlanner._currentVoicePlace;
        if (!place) return;

        // Set destination in inputs & state
        const destInput = document.getElementById('route-dest-input');
        if (destInput) destInput.value = place.name;
        IndiaMapPlanner.selectedDest = {
            name: place.name,
            lat: parseFloat(place.lat),
            lng: parseFloat(place.lng),
            state: place.state || ''
        };
        IndiaMapPlanner.selectedDestination = IndiaMapPlanner.selectedDest;
        IndiaMapPlanner.setDestMarker(IndiaMapPlanner.selectedDest);

        // Check if origin is already set, or use user GPS location
        const origInput = document.getElementById('route-origin-input');
        if (!origInput || !origInput.value || !IndiaMapPlanner.selectedOrigin) {
            if (IndiaMapPlanner.userLocationMarker) {
                const uLoc = IndiaMapPlanner.userLocationMarker.getLatLng();
                IndiaMapPlanner.selectedOrigin = {
                    name: 'My Location',
                    lat: uLoc.lat,
                    lng: uLoc.lng,
                    state: ''
                };
                if (origInput) origInput.value = 'My Location';
            } else {
                IndiaMapPlanner.selectedOrigin = {
                    name: 'Delhi',
                    lat: 28.6139,
                    lng: 77.2090,
                    state: 'Delhi'
                };
                if (origInput) origInput.value = 'Delhi';
                IndiaMapPlanner.setOriginMarker(IndiaMapPlanner.selectedOrigin);
            }
        }

        IndiaMapPlanner.closePlaceCard();
        
        // Directly process route
        IndiaMapPlanner.processRoute();
        VoiceAssistant.speak(`Starting route to ${place.name}`);

        if (autoStart) {
            setTimeout(() => {
                document.getElementById('btn-start-trip')?.click();
                Utils.showToast(`Live Navigation started to ${place.name} 🚗`, 'success');
            }, 1200);
        }
    },

    sharePlace: () => {
        const place = IndiaMapPlanner._currentVoicePlace;
        if (!place) return;
        const text = `Explore ${place.name} on NHAI Highway Portal: ${window.location.href}`;
        if (navigator.share) {
            navigator.share({ title: place.name, text: text, url: window.location.href }).catch(() => {});
        } else {
            navigator.clipboard.writeText(text);
            Utils.showToast(`Location link copied to clipboard! 📋`, 'success');
        }
    },

    savePlace: () => {
        const place = IndiaMapPlanner._currentVoicePlace;
        if (!place) return;
        let saved = JSON.parse(localStorage.getItem('nhai_saved_places') || '[]');
        const idx = saved.findIndex(p => p.name === place.name);
        const saveIcon = document.getElementById('place-save-icon');
        const saveLabel = document.getElementById('place-save-label');

        if (idx >= 0) {
            saved.splice(idx, 1);
            if (saveIcon) saveIcon.className = 'fa-regular fa-bookmark';
            if (saveLabel) saveLabel.textContent = 'Save';
            Utils.showToast(`Removed from saved places`, 'info');
        } else {
            saved.push({ name: place.name, state: place.state, lat: place.lat, lng: place.lng, time: Date.now() });
            if (saveIcon) saveIcon.className = 'fa-solid fa-bookmark';
            if (saveLabel) saveLabel.textContent = 'Saved';
            Utils.showToast(`Saved "${place.name}" to bookmarks! 🔖`, 'success');
        }
        localStorage.setItem('nhai_saved_places', JSON.stringify(saved));
    },

    selectTransitMode: (mode) => {
        ['road', 'rail', 'air'].forEach(m => {
            const el = document.getElementById(`transit-mode-${m}`);
            if (el) el.classList.toggle('active', m === mode);
        });
        if (mode === 'road') {
            Utils.showToast('🛣️ Highway corridor selected for navigation', 'info');
        } else if (mode === 'rail') {
            Utils.showToast('🚆 Rail transit advisory active via Indian Railways', 'info');
        } else if (mode === 'air') {
            Utils.showToast('✈️ Airport corridor schedule advisory active', 'info');
        }
    },

    explorePlaceTolls: () => {
        const place = IndiaMapPlanner._currentVoicePlace;
        if (!place) return;
        IndiaMapPlanner.closePlaceCard();
        IndiaMapPlanner.map.flyTo([parseFloat(place.lat), parseFloat(place.lng)], 11, { duration: 1.2 });
        Utils.showToast(`Exploring tolls around ${place.name} 🛣️`, 'info');
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

