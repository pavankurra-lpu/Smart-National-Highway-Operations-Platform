const tollData = [
  {
    "state": "Uttar Pradesh",
    "routeName": "Kanpur - Ayodhya",
    "startPoint": "Kanpur",
    "endPoint": "Ayodhya",
    "tolls": ["Nawabganj Toll Plaza", "Ahmadpur Toll Plaza", "Ronahi Toll Plaza"]
  },
  {
    "state": "Uttar Pradesh",
    "routeName": "Kanpur Highway",
    "startPoint": "Kanpur",
    "endPoint": "Highway Stretch",
    "tolls": ["Aliyapur Toll Plaza", "Khanna Toll Plaza"]
  },
  {
    "state": "Rajasthan",
    "routeName": "Sikar - Bikaner",
    "startPoint": "Sikar",
    "endPoint": "Bikaner",
    "tolls": ["Rashidpura", "Tidiayasar", "Lakhasar", "Udairamsar"]
  },
  {
    "state": "Gujarat",
    "routeName": "Ahmedabad - Vadodara",
    "startPoint": "Ahmedabad",
    "endPoint": "Vadodara",
    "tolls": ["Ahmedabad Toll Plaza", "Ahmedabad (Ring Road) Toll Plaza", "Nadiad Toll Plaza", "Anand Toll Plaza", "Vadodara Toll Plaza", "Kheda", "Vasad"]
  },
  {
    "state": "Rajasthan",
    "routeName": "Jaipur - Kishangarh",
    "startPoint": "Jaipur",
    "endPoint": "Kishangarh",
    "tolls": ["Jaipur Plaza", "Kishangarh Plaza"]
  },
  {
    "state": "Rajasthan",
    "routeName": "Jaipur - Mahua",
    "startPoint": "Jaipur",
    "endPoint": "Mahua",
    "tolls": ["Sikandra Toll Plaza", "Rajadhok Toll Plaza"]
  },
  {
    "state": "Rajasthan",
    "routeName": "Jodhpur - Pali",
    "startPoint": "Jodhpur",
    "endPoint": "Pali",
    "tolls": ["Nimbali", "Gajangarh"]
  },
  {
    "state": "Uttar Pradesh",
    "routeName": "Ghaziabad - Aligarh",
    "startPoint": "Ghaziabad",
    "endPoint": "Aligarh",
    "tolls": ["LUHARLI Toll plaza", "GABHANA Tollplaza"]
  },
  {
    "state": "Uttar Pradesh",
    "routeName": "Moradabad - Bareilly",
    "startPoint": "Moradabad",
    "endPoint": "Bareilly",
    "tolls": ["Niyamatpur Ekrotiya Toll Plaza", "Thiriya Khetal Toll Plaza"]
  },
  {
    "state": "Uttar Pradesh",
    "routeName": "Lucknow - Sitapur",
    "startPoint": "Lucknow",
    "endPoint": "Sitapur",
    "tolls": ["Itaunja Toll Plaza", "Khairabad Toll Plaza"]
  },
  {
    "state": "Uttar Pradesh",
    "routeName": "Gorakhpur - Kasia",
    "startPoint": "Gorakhpur",
    "endPoint": "Kasia",
    "tolls": ["Salemgarh Toll Plaza", "Muzaina Hetim Toll Plaza", "Tendua Toll Plaza"]
  },
  {
    "state": "Uttar Pradesh",
    "routeName": "Ayodhya - Gorakhpur",
    "startPoint": "Ayodhya",
    "endPoint": "Gorakhpur",
    "tolls": ["Chaukadi Toll Plaza", "Mandawnagar Toll Plaza"]
  },
  {
    "state": "Uttar Pradesh",
    "routeName": "Raebareli - Allahabad",
    "startPoint": "Raebareli",
    "endPoint": "Allahabad",
    "tolls": ["Andiyari"]
  },
  {
    "state": "Madhya Pradesh",
    "routeName": "Agra - Gwalior",
    "startPoint": "Agra",
    "endPoint": "Gwalior",
    "tolls": ["Choundha", "Baretha or Jajau"]
  },
  {
    "state": "Madhya Pradesh",
    "routeName": "Jhansi - Baran",
    "startPoint": "Jhansi",
    "endPoint": "Baran",
    "tolls": ["Ramnagar", "Raksha", "Mundiyar"]
  },
  {
    "state": "Rajasthan",
    "routeName": "Bhilwara - Rajsamand",
    "startPoint": "Bhilwara",
    "endPoint": "Rajsamand",
    "tolls": ["Daffi Toll Plaza", "Rupakheda Toll Plaza", "Mujras Toll Plaza"]
  },
  {
    "state": "Tamil Nadu",
    "routeName": "Trichy Tollways Corridor",
    "startPoint": "Trichy",
    "endPoint": "Tamil Nadu Corridor",
    "tolls": ["SENGURICHI TOLL PLAZA", "THIRUMANDURAI TOLL PLAZA"]
  },
  {
    "state": "Andhra Pradesh",
    "routeName": "Swarna Tollway NH16 Corridor",
    "startPoint": "Sullurpet",
    "endPoint": "Nellore",
    "tolls": ["Sullurpet Plaza (NH-16), (old NH-5)", "Budhanam Plaza (NH-16),(old NH-5)", "Nellore Plaza (NH-16), (old NH-5)"]
  },
  {
    "state": "Andhra Pradesh",
    "routeName": "Swarna Tollway NH65 Corridor",
    "startPoint": "Keesara",
    "endPoint": "NH65 Stretch",
    "tolls": ["Keesara Plaza (NH-65), (old NH-9)"]
  },
  {
    "state": "Andhra Pradesh",
    "routeName": "MEP Infra Andhra Corridor",
    "startPoint": "Amakthadu",
    "endPoint": "Marur",
    "tolls": ["Amakthadu toll plaza", "Kasepalli toll plaza", "Marur toll plaza"]
  },
  {
    "state": "Andhra Pradesh",
    "routeName": "Saimbhapuri Expressway",
    "startPoint": "Bollapalli",
    "endPoint": "Musunur",
    "tolls": ["Bollapalli Toll Plaza", "Tangatur Toll Plaza", "Musunur Toll Plaza"]
  },
  {
    "state": "Bihar",
    "routeName": "SMS Bihar Corridor",
    "startPoint": "Hariabara",
    "endPoint": "Maithi",
    "tolls": ["Hariabara", "Asanpur Toll Plaza", "Maithi"]
  },
  {
    "state": "Bihar",
    "routeName": "Muzaffarpur - Barauni Corridor",
    "startPoint": "Mahant Maniyari",
    "endPoint": "Murlitol",
    "tolls": ["Mahant Maniyari", "Murlitol"]
  },
  {
    "state": "Punjab",
    "routeName": "Ambala - Chandigarh Corridor",
    "startPoint": "Ambala",
    "endPoint": "Chandigarh",
    "tolls": ["Ambala Chandigarh"]
  },
  {
    "state": "Punjab",
    "routeName": "Ludhiana - Talwandi Corridor",
    "startPoint": "Ludhiana",
    "endPoint": "Talwandi",
    "tolls": ["Chaukiman Toll plaza"]
  },
  {
    "state": "Haryana",
    "routeName": "Rohtak - Hissar",
    "startPoint": "Rohtak",
    "endPoint": "Hissar",
    "tolls": ["Madina Toll Plaza", "Mayar Toll Plaza"]
  },
  {
    "state": "Haryana",
    "routeName": "Kurukshetra Corridor",
    "startPoint": "Jat Gangaicha",
    "endPoint": "Dighal",
    "tolls": ["Jat Gangaicha Toll Plaza", "Dighal Toll Plaza"]
  },
  {
    "state": "Rajasthan",
    "routeName": "Salasar Highways Corridor",
    "startPoint": "Lasedi",
    "endPoint": "Sobhasar",
    "tolls": ["Lasedi", "Dhadhar", "Sobhasar"]
  },
  {
    "state": "Rajasthan",
    "routeName": "PNC Rajasthan Highways Corridor",
    "startPoint": "Titoli",
    "endPoint": "Rabawata",
    "tolls": ["Titoli", "Rabawata"]
  },
  {
    "state": "Karnataka",
    "routeName": "Navayuga Udupi Corridor",
    "startPoint": "Talapady",
    "endPoint": "Hejamadi",
    "tolls": ["Talapady Toll Plaza", "Hejamadi Toll Plaza"]
  },
  {
    "state": "Karnataka",
    "routeName": "IRB Westcoast Corridor",
    "startPoint": "Belekeri",
    "endPoint": "Shirur",
    "tolls": ["Belekeri", "Holgegadde", "Shirur"]
  },
  {
    "state": "Karnataka",
    "routeName": "Hampi Expressways Corridor",
    "startPoint": "Thimmalapura",
    "endPoint": "Kananakatte",
    "tolls": ["Thimmalapura", "Kananakatte"]
  },
  {
    "state": "Karnataka",
    "routeName": "Nandi Highway Developers Corridor",
    "startPoint": "Gabbur",
    "endPoint": "Goa Border",
    "tolls": ["Gabbur", "Karwar", "Tarihal", "Kalghatgi", "Goa", "Narendra"]
  },
  {
    "state": "Tamil Nadu",
    "routeName": "Reliance Tamil Nadu Corridor",
    "startPoint": "Ponnambalapatti",
    "endPoint": "Krishnagiri",
    "tolls": ["Ponnambalapatti Plaza", "Kozhinjiipatti Plaza", "Rasampalayam Plaza", "Mettupatti Plaza", "Nathakkarai Plaza", "Thiruparaithurai Plaza", "Manavasi Plaza", "Krishnagiri Plaza"]
  },
  {
    "state": "Tamil Nadu",
    "routeName": "L&T Tamil Nadu Corridor",
    "startPoint": "Trichy",
    "endPoint": "Cochin / Salem Corridor",
    "tolls": ["Trichy Salem", "Trichy Cochin", "Madukkarai", "Pollachi Cochin Toll Plaza", "Pollachi Salem Toll Plaza"]
  },
  {
    "state": "Tamil Nadu",
    "routeName": "TNRDC ECR Corridor",
    "startPoint": "Uthandi",
    "endPoint": "Mahabalipuram",
    "tolls": ["Uthandi", "Central Server plaza", "Anumandhai", "Mahabalipuram Plaza"]
  },
  {
    "state": "Tamil Nadu",
    "routeName": "Sri Balaji Tollways Corridor",
    "startPoint": "Vandiyur",
    "endPoint": "Valayangulam",
    "tolls": ["Vandiyur", "Chinthamani", "Valayangulam"]
  },
  {
    "state": "Maharashtra",
    "routeName": "TRIL Maharashtra Corridor",
    "startPoint": "Patas",
    "endPoint": "Sardewadi",
    "tolls": ["Patas Plaza", "Sardewadi Plaza"]
  },
  {
    "state": "Maharashtra",
    "routeName": "Solapur Tollways Corridor",
    "startPoint": "Phulwadi",
    "endPoint": "Talmod",
    "tolls": ["Phulwadi Toll Plaza", "Talmod Toll Plaza"]
  },
  {
    "state": "Maharashtra",
    "routeName": "IRB Maharashtra Corridor",
    "startPoint": "Moshi",
    "endPoint": "Rajgurunagar",
    "tolls": ["Moshi Toll Plaza", "Rajgurunagar Toll Plaza"]
  },
  {
    "state": "Gujarat",
    "routeName": "Patel Highway Management Corridor",
    "startPoint": "Varahi",
    "endPoint": "Bhalgam",
    "tolls": ["Varahi Toll Plaza", "Makhel Toll Plaza", "Bhiladi Toll Plaza", "Bhalgam Toll Plaza"]
  },
  {
    "state": "Gujarat",
    "routeName": "Ahmedabad - Maliya State Corridor",
    "startPoint": "Vasna-Iyava",
    "endPoint": "Aniyari",
    "tolls": ["AMTL-TP-01 Vasna-Iyava", "AMTL-TP02-Malvan", "AMTL-TP03-Soldi", "AMTL-TP04-Aniyari"]
  },
  {
    "state": "Gujarat",
    "routeName": "L&T Gujarat State Corridor",
    "startPoint": "Vanpari-Paddhari",
    "endPoint": "Vadinar",
    "tolls": ["Vanpari-Paddhari", "Soyal", "Jamnagar Bypass- Vadinar"]
  },
  {
    "state": "Telangana",
    "routeName": "Hyderabad ORR / IRB State Corridor",
    "startPoint": "Kokapet",
    "endPoint": "Nanakramguda",
    "tolls": ["Kokapet", "Edulanagulapally", "Patancheru", "Sultanpur", "Dundigal", "Medchal", "Shamirpet", "Keesara", "Ghatkesar", "Taramatipet", "Pedda Amberpet", "Bongulur", "Ravi Ryal", "Tukkuguda", "Peddagolconda", "Shamshabad", "Rajendra Nagar", "TSPA", "Nanakramguda"]
  }
];

let map;
let routeLayerGroup;

// Center points for pseudo-random coordinates generation
const stateCenters = {
    "Uttar Pradesh": [26.8467, 80.9462],
    "Rajasthan": [27.0238, 74.2179],
    "Gujarat": [22.2587, 71.1924],
    "Madhya Pradesh": [22.9734, 78.6569],
    "Tamil Nadu": [11.1271, 78.6569],
    "Andhra Pradesh": [15.9129, 79.7400],
    "Bihar": [25.0961, 85.3131],
    "Punjab": [31.1471, 75.3412],
    "Haryana": [29.0588, 76.0856],
    "Karnataka": [15.3173, 75.7139],
    "Maharashtra": [19.7515, 75.7139],
    "Telangana": [18.1124, 79.0193]
};

document.addEventListener("DOMContentLoaded", () => {
    initMap();
    setupAutocomplete("start-input", "start-suggestions", (loc) => {
        window.selectedStart = loc;
        checkAndPlot();
    });
    setupAutocomplete("end-input", "end-suggestions", (loc) => {
        window.selectedEnd = loc;
        checkAndPlot();
    });
});

function initMap() {
    map = L.map('map', { zoomControl: false }).setView([20.5937, 78.9629], 5);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OSM contributors &copy; CARTO',
        subdomains: 'abcd', maxZoom: 20
    }).addTo(map);
    routeLayerGroup = L.layerGroup().addTo(map);
}

function setupAutocomplete(inputId, dropdownId, onSelect) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if (!input || !dropdown) return;

    let debounceTimer;

    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const val = input.value.trim().toLowerCase();
        if (val.length < 2) { dropdown.innerHTML = ''; dropdown.style.display = 'none'; return; }

        const cities = window.IndiaMapData?.cities || [];
        const local = cities.filter(c => 
            c.name.toLowerCase().includes(val) || (c.state && c.state.toLowerCase().includes(val))
        ).slice(0, 10);

        renderDropdown(dropdown, local, (item) => {
            input.value = item.name;
            dropdown.style.display = 'none';
            onSelect(item);
        });

        if (val.length >= 3) {
            debounceTimer = setTimeout(() => nominatimSearch(val, dropdown, input, onSelect), 500);
        }
    });

    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

function renderDropdown(dropdown, items, onClick) {
    if (items.length === 0) {
        dropdown.innerHTML = '<div class="ac-item" style="color:#8892b0; font-size: 12px;">Searching...</div>';
        dropdown.style.display = 'block';
        return;
    }
    dropdown.innerHTML = items.map(c => `
        <div class="ac-item" data-name="${c.name}" data-lat="${c.lat}" data-lng="${c.lng}" data-state="${c.state || ''}">
            <strong>${c.name}</strong>
            <span>${c.state || 'India'}</span>
        </div>
    `).join('');
    dropdown.style.display = 'block';
    dropdown.querySelectorAll('.ac-item').forEach(el => {
        el.addEventListener('click', () => onClick({
            name: el.dataset.name,
            lat: parseFloat(el.dataset.lat),
            lng: parseFloat(el.dataset.lng),
            state: el.dataset.state
        }));
    });
}

function nominatimSearch(query, dropdown, input, onSelect) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=in&format=json&addressdetails=1&limit=5`;
    fetch(url, { headers: { 'Accept-Language': 'en' } })
        .then(r => r.json())
        .then(results => {
            const fresh = results.map(r => ({
                name: r.display_name.split(',')[0].trim(),
                lat: parseFloat(r.lat),
                lng: parseFloat(r.lon),
                state: r.address?.state || 'India'
            }));
            const existing = [...dropdown.querySelectorAll('.ac-item')].map(el => el.dataset.name);
            const unique = fresh.filter(f => !existing.includes(f.name));
            
            unique.forEach(c => {
                const div = document.createElement('div');
                div.className = 'ac-item';
                div.innerHTML = `<strong>${c.name}</strong><span>${c.state} · OSM</span>`;
                div.addEventListener('click', () => {
                    input.value = c.name;
                    dropdown.style.display = 'none';
                    onSelect(c);
                });
                dropdown.appendChild(div);
            });
        }).catch(() => {});
}

function checkAndPlot() {
    if (window.selectedStart && window.selectedEnd) {
        plotRealRoute(window.selectedStart, window.selectedEnd);
    }
}

function plotRealRoute(start, end) {
    routeLayerGroup.clearLayers();
    hideRouteDetails();

    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    
    fetch(url)
        .then(r => r.json())
        .then(data => {
            if (data.code !== 'Ok') throw new Error('Route not found');
            const route = data.routes[0];
            const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);

            // Draw line
            const polyline = L.polyline(coords, {
                color: '#64ffda',
                weight: 4,
                opacity: 0.8,
                lineJoin: 'round',
                dashArray: '8, 12'
            }).addTo(routeLayerGroup);

            // Bounds
            map.fitBounds(polyline.getBounds(), { padding: [50, 50] });

            // Icons
            const startIcon = L.divIcon({ className: 'custom-div-icon', html: "<div style='background:#10b981;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 10px #10b981'></div>", iconSize:[14,14], iconAnchor:[7,10] });
            const endIcon = L.divIcon({ className: 'custom-div-icon', html: "<div style='background:#ef4444;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 10px #ef4444'></div>", iconSize:[14,14], iconAnchor:[7,10] });
            
            L.marker([start.lat, start.lng], {icon: startIcon}).addTo(routeLayerGroup).bindPopup(`<strong>Start:</strong> ${start.name}`);
            L.marker([end.lat, end.lng], {icon: endIcon}).addTo(routeLayerGroup).bindPopup(`<strong>End:</strong> ${end.name}`);

            // Find tolls along this route
            findTollsOnRoute(coords, start.name, end.name, route.distance, route.duration);
        })
        .catch(err => {
            console.error(err);
            alert("Could not calculate route. Please try different points.");
        });
}

function findTollsOnRoute(routeCoords, startName, endName, distanceM, durationS) {
    if (!window.TollSeedData) return;
    
    const tollsOnRoute = [];
    TollSeedData.forEach(toll => {
        // Simple distance check to route points (cheap geofencing)
        for (let i = 0; i < routeCoords.length; i += 10) { // Sample every 10th point for speed
            const pt = routeCoords[i];
            const dist = Math.sqrt(Math.pow(toll.lat - pt[0], 2) + Math.pow(toll.lng - pt[1], 2));
            if (dist < 0.015) { // Approx 1.5km
                tollsOnRoute.push(toll);
                break;
            }
        }
    });

    displayRouteDetails(startName, endName, distanceM, durationS, tollsOnRoute);
}

function displayRouteDetails(start, end, distM, durS, tolls) {
    document.getElementById("route-details").classList.remove("hidden");
    document.getElementById("route-name").textContent = `${start} to ${end}`;
    document.getElementById("stat-state").textContent = (distM / 1000).toFixed(1) + " km";
    document.getElementById("stat-tolls-count").textContent = tolls.length;

    const tollListUl = document.getElementById("toll-list");
    tollListUl.innerHTML = "";
    
    tolls.forEach((toll, idx) => {
        const li = document.createElement("li");
        li.className = "toll-item";
        li.innerHTML = `<span>${idx + 1}. ${toll.name} (${toll.state})</span>`;
        tollListUl.appendChild(li);

        // Marker for toll
        const tollIcon = L.divIcon({ className: 'custom-div-icon', html: "<div style='background:#64ffda;width:10px;height:10px;border-radius:50%;border:1.5px solid #0a192f;box-shadow:0 0 8px #64ffda'></div>", iconSize:[10,10], iconAnchor:[5,5] });
        L.marker([toll.lat, toll.lng], {icon: tollIcon}).addTo(routeLayerGroup).bindPopup(`<strong>${toll.name}</strong><br>State: ${toll.state}`);
    });
}

function hideRouteDetails() {
    document.getElementById("route-details").classList.add("hidden");
}

function generatePseudoCoord(seedStr, baseLat, baseLng, range = 2) {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
        hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Create deterministic offset between -range and +range
    const offsetLat = ((Math.sin(hash) * 10000) % range);
    const offsetLng = ((Math.cos(hash) * 10000) % range);
    
    return [baseLat + offsetLat, baseLng + offsetLng];
}

function plotRoute(state, start, end) {
    routeLayerGroup.clearLayers();

    // Find the specific route data
    const route = tollData.find(item => item.state === state && item.startPoint === start && item.endPoint === end);
    if (!route) return;

    // Show Details Panel
    document.getElementById("route-details").classList.remove("hidden");
    document.getElementById("route-name").textContent = route.routeName;
    document.getElementById("stat-state").textContent = route.state;
    document.getElementById("stat-tolls-count").textContent = route.tolls.length;

    // Populate Sidebar Toll list
    const tollListUl = document.getElementById("toll-list");
    tollListUl.innerHTML = "";
    route.tolls.forEach((toll, idx) => {
        const li = document.createElement("li");
        li.className = "toll-item";
        li.innerHTML = `<span>${idx + 1}. ${toll}</span>`;
        tollListUl.appendChild(li);
    });

    // Determine baseline coordinates for the state
    const center = stateCenters[state] || [20.5937, 78.9629];
    
    // Generate Start and End Markers deterministically
    const startCoord = generatePseudoCoord(state + start, center[0], center[1], 2);
    const endCoord = generatePseudoCoord(state + end, center[0], center[1], 2);

    // Make sure start and end aren't too close if they hash similarly
    if (Math.abs(startCoord[0] - endCoord[0]) < 0.2 && Math.abs(startCoord[1] - endCoord[1]) < 0.2) {
        endCoord[0] += 0.5;
        endCoord[1] -= 0.5;
    }

    // Custom Icons
    const startIcon = L.divIcon({
        className: 'custom-div-icon',
        html: "<div style='background-color:#10b981; width:16px; height:16px; border-radius:50%; border:2px solid #fff; box-shadow: 0 0 10px #10b981'></div>",
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });

    const endIcon = L.divIcon({
        className: 'custom-div-icon',
        html: "<div style='background-color:#ef4444; width:16px; height:16px; border-radius:50%; border:2px solid #fff; box-shadow: 0 0 10px #ef4444'></div>",
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });

    const tollIcon = L.divIcon({
        className: 'custom-div-icon',
        html: "<div style='background-color:#64ffda; width:12px; height:12px; border-radius:50%; border:2px solid #0a192f; box-shadow: 0 0 8px #64ffda'></div>",
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });

    // Add Start and End
    L.marker(startCoord, {icon: startIcon}).addTo(routeLayerGroup)
        .bindPopup(`<div class="custom-popup-title">Start Point</div><div class="custom-popup-desc">${start}</div>`);
    L.marker(endCoord, {icon: endIcon}).addTo(routeLayerGroup)
        .bindPopup(`<div class="custom-popup-title">End Point</div><div class="custom-popup-desc">${end}</div>`);

    // Interpolate Tolls along the line
    const numTolls = route.tolls.length;
    const tollCoords = [];
    
    for (let i = 0; i < numTolls; i++) {
        // Find fraction along the line, add some jitter so it's not a perfectly straight line, but still ordered
        const fraction = (i + 1) / (numTolls + 1); 
        
        let tLat = startCoord[0] + (endCoord[0] - startCoord[0]) * fraction;
        let tLng = startCoord[1] + (endCoord[1] - startCoord[1]) * fraction;

        // Deterministic Jitter
        const jitterLat = ((Math.sin(i * 10) * 0.1) % 0.1);
        const jitterLng = ((Math.cos(i * 10) * 0.1) % 0.1);
        
        tLat += jitterLat;
        tLng += jitterLng;

        const c = [tLat, tLng];
        tollCoords.push(c);

        L.marker(c, {icon: tollIcon}).addTo(routeLayerGroup)
            .bindPopup(`<div class="custom-popup-title">Toll Plaza ${i+1}</div><div class="custom-popup-desc">${route.tolls[i]}</div>`);
    }

    // Draw Polyline
    const lineCoords = [startCoord, ...tollCoords, endCoord];
    const polyline = L.polyline(lineCoords, {
        color: '#64ffda',
        weight: 4,
        opacity: 0.8,
        dashArray: '10, 10',
        lineJoin: 'round'
    }).addTo(routeLayerGroup);

    // Fit Bounds with padding for UI panel
    map.fitBounds(polyline.getBounds(), {
        paddingTopLeft: [420, 50], // Avoid panel
        paddingBottomRight: [50, 50],
        maxZoom: 9
    });
}
