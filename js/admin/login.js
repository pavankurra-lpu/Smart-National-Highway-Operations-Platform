// SNHOP Admin Login & Toll Plaza Cascade Selection Engine

document.addEventListener('DOMContentLoaded', () => {
    // If already logged in, redirect to index
    if (window.Auth && Auth.isAuthenticated()) {
        window.location.href = 'index.html';
    }

    const stateSelect = document.getElementById('toll-state-select');
    const districtSelect = document.getElementById('toll-district-select');
    const plazaSelect = document.getElementById('admin-plaza');
    const searchInput = document.getElementById('toll-search-input');
    const countBadge = document.getElementById('plaza-count-badge');
    const form = document.getElementById('login-form');
    const errorEl = document.getElementById('login-error');

    // 1. Load All Toll Plazas from TollData
    if (window.TollData && TollData.init) {
        TollData.init();
    }
    const allTolls = window.TollData ? TollData.getAllTolls() : (window.TollSeedData || []);

    // Comprehensive Indian State -> Districts Center Mapping
    const INDIA_DISTRICT_COORDS = {
        'Punjab': [
            { name: 'Amritsar', lat: 31.6340, lng: 74.8723 },
            { name: 'Barnala', lat: 30.3819, lng: 75.5470 },
            { name: 'Bathinda', lat: 30.2110, lng: 74.9455 },
            { name: 'Faridkot', lat: 30.6769, lng: 74.7583 },
            { name: 'Fatehgarh Sahib', lat: 30.6433, lng: 76.3980 },
            { name: 'Fazilka', lat: 30.4036, lng: 74.0254 },
            { name: 'Ferozepur', lat: 30.9237, lng: 74.6065 },
            { name: 'Gurdaspur', lat: 32.0419, lng: 75.4053 },
            { name: 'Hoshiarpur', lat: 31.5273, lng: 75.9149 },
            { name: 'Jalandhar', lat: 31.3260, lng: 75.5762 },
            { name: 'Kapurthala', lat: 31.3802, lng: 75.3819 },
            { name: 'Ludhiana', lat: 30.9010, lng: 75.8573 },
            { name: 'Mansa', lat: 29.9880, lng: 75.3942 },
            { name: 'Moga', lat: 30.8165, lng: 75.1717 },
            { name: 'Sri Muktsar Sahib', lat: 30.4762, lng: 74.5161 },
            { name: 'Pathankot', lat: 32.2689, lng: 75.6496 },
            { name: 'Patiala', lat: 30.3398, lng: 76.3869 },
            { name: 'Rupnagar', lat: 30.9664, lng: 76.5331 },
            { name: 'SAS Nagar (Mohali)', lat: 30.6942, lng: 76.7146 },
            { name: 'SBS Nagar (Nawanshahr)', lat: 31.1256, lng: 76.1186 },
            { name: 'Sangrur', lat: 30.2458, lng: 75.8421 },
            { name: 'Tarn Taran', lat: 31.4518, lng: 74.9281 },
            { name: 'Malerkotla', lat: 30.5283, lng: 75.8856 }
        ],
        'Maharashtra': [
            { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
            { name: 'Pune', lat: 18.5204, lng: 73.8567 },
            { name: 'Nagpur', lat: 21.1458, lng: 79.0882 },
            { name: 'Thane', lat: 19.2183, lng: 72.9781 },
            { name: 'Nashik', lat: 19.9975, lng: 73.7898 },
            { name: 'Chhatrapati Sambhajinagar', lat: 19.8762, lng: 75.3433 },
            { name: 'Solapur', lat: 17.6599, lng: 75.9064 },
            { name: 'Kolhapur', lat: 16.7050, lng: 74.2433 },
            { name: 'Satara', lat: 17.6805, lng: 73.9936 },
            { name: 'Ahmednagar', lat: 19.0948, lng: 74.7480 },
            { name: 'Jalgaon', lat: 21.0077, lng: 75.5626 },
            { name: 'Amravati', lat: 20.9320, lng: 77.7523 },
            { name: 'Nanded', lat: 19.1383, lng: 77.3210 },
            { name: 'Raigad', lat: 18.5158, lng: 73.1812 },
            { name: 'Ratnagiri', lat: 16.9902, lng: 73.3120 },
            { name: 'Sindhudurg', lat: 16.1264, lng: 73.7126 },
            { name: 'Chandrapur', lat: 19.9615, lng: 79.2961 },
            { name: 'Dhule', lat: 20.9042, lng: 74.7749 },
            { name: 'Yavatmal', lat: 20.3888, lng: 78.1204 }
        ],
        'Uttar Pradesh': [
            { name: 'Lucknow', lat: 26.8467, lng: 80.9462 },
            { name: 'Kanpur', lat: 26.4499, lng: 80.3319 },
            { name: 'Agra', lat: 27.1767, lng: 78.0081 },
            { name: 'Varanasi', lat: 25.3176, lng: 82.9739 },
            { name: 'Prayagraj', lat: 25.4358, lng: 81.8463 },
            { name: 'Gautam Buddha Nagar (Noida)', lat: 28.5355, lng: 77.3910 },
            { name: 'Ghaziabad', lat: 28.6692, lng: 77.4538 },
            { name: 'Meerut', lat: 28.9845, lng: 77.7064 },
            { name: 'Mathura', lat: 27.4924, lng: 77.6737 },
            { name: 'Aligarh', lat: 27.8974, lng: 78.0880 },
            { name: 'Bareilly', lat: 28.3670, lng: 79.4304 },
            { name: 'Moradabad', lat: 28.8386, lng: 78.7733 },
            { name: 'Gorakhpur', lat: 26.7606, lng: 83.3732 },
            { name: 'Jhansi', lat: 25.4484, lng: 78.5685 },
            { name: 'Ayodhya', lat: 26.7922, lng: 82.1998 },
            { name: 'Saharanpur', lat: 29.9671, lng: 77.5510 },
            { name: 'Muzaffarnagar', lat: 29.4727, lng: 77.7085 },
            { name: 'Etawah', lat: 26.7769, lng: 79.0305 },
            { name: 'Sitapur', lat: 27.5684, lng: 80.6829 },
            { name: 'Jaunpur', lat: 25.7464, lng: 82.6837 }
        ],
        'Rajasthan': [
            { name: 'Jaipur', lat: 26.9124, lng: 75.7873 },
            { name: 'Jodhpur', lat: 26.2389, lng: 73.0243 },
            { name: 'Udaipur', lat: 24.5854, lng: 73.7125 },
            { name: 'Kota', lat: 25.2138, lng: 75.8648 },
            { name: 'Bikaner', lat: 28.0229, lng: 73.3119 },
            { name: 'Ajmer', lat: 26.4499, lng: 74.6399 },
            { name: 'Alwar', lat: 27.5530, lng: 76.6346 },
            { name: 'Bhilwara', lat: 25.3407, lng: 74.6313 },
            { name: 'Sikar', lat: 27.6094, lng: 75.1398 },
            { name: 'Bharatpur', lat: 27.2152, lng: 77.5030 },
            { name: 'Pali', lat: 25.7711, lng: 73.3234 },
            { name: 'Sri Ganganagar', lat: 29.9038, lng: 73.8772 },
            { name: 'Chittorgarh', lat: 24.8887, lng: 74.6269 }
        ],
        'Haryana': [
            { name: 'Gurugram', lat: 28.4595, lng: 77.0266 },
            { name: 'Faridabad', lat: 28.4089, lng: 77.3178 },
            { name: 'Panipat', lat: 29.3909, lng: 76.9635 },
            { name: 'Ambala', lat: 30.3782, lng: 76.7767 },
            { name: 'Karnal', lat: 29.6857, lng: 76.9905 },
            { name: 'Sonipat', lat: 28.9931, lng: 77.0151 },
            { name: 'Hisar', lat: 29.1492, lng: 75.7217 },
            { name: 'Rohtak', lat: 28.8955, lng: 76.6066 },
            { name: 'Panchkula', lat: 30.6942, lng: 76.8606 },
            { name: 'Kurukshetra', lat: 29.9695, lng: 76.8783 },
            { name: 'Rewari', lat: 28.1828, lng: 76.6186 },
            { name: 'Yamunanagar', lat: 30.1290, lng: 77.2674 }
        ],
        'Karnataka': [
            { name: 'Bengaluru Urban', lat: 12.9716, lng: 77.5946 },
            { name: 'Bengaluru Rural', lat: 13.2285, lng: 77.5816 },
            { name: 'Mysuru', lat: 12.2958, lng: 76.6394 },
            { name: 'Dharwad (Hubballi)', lat: 15.3647, lng: 75.1240 },
            { name: 'Dakshina Kannada (Mangaluru)', lat: 12.9141, lng: 74.8560 },
            { name: 'Belagavi', lat: 15.8497, lng: 74.4977 },
            { name: 'Kalaburagi', lat: 17.3297, lng: 76.8343 },
            { name: 'Ballari', lat: 15.1394, lng: 76.9214 },
            { name: 'Tumakuru', lat: 13.3379, lng: 77.1006 },
            { name: 'Shivamogga', lat: 13.9299, lng: 75.5681 },
            { name: 'Hassan', lat: 13.0072, lng: 76.1032 },
            { name: 'Udupi', lat: 13.3409, lng: 74.7421 }
        ],
        'Tamil Nadu': [
            { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
            { name: 'Coimbatore', lat: 11.0168, lng: 76.9558 },
            { name: 'Madurai', lat: 9.9252, lng: 78.1198 },
            { name: 'Tiruchirappalli', lat: 10.7905, lng: 78.7047 },
            { name: 'Salem', lat: 11.6643, lng: 78.1460 },
            { name: 'Tirunelveli', lat: 8.7139, lng: 77.7567 },
            { name: 'Tiruppur', lat: 11.1085, lng: 77.3411 },
            { name: 'Vellore', lat: 12.9165, lng: 79.1325 },
            { name: 'Erode', lat: 11.3410, lng: 77.7172 },
            { name: 'Kanchipuram', lat: 12.8342, lng: 79.7036 },
            { name: 'Chengalpattu', lat: 12.6819, lng: 79.9830 },
            { name: 'Krishnagiri', lat: 12.5186, lng: 78.2137 }
        ],
        'Gujarat': [
            { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
            { name: 'Surat', lat: 21.1702, lng: 72.8311 },
            { name: 'Vadodara', lat: 22.3072, lng: 73.1812 },
            { name: 'Rajkot', lat: 22.3039, lng: 70.8022 },
            { name: 'Gandhinagar', lat: 23.2156, lng: 72.6369 },
            { name: 'Bhavnagar', lat: 21.7645, lng: 72.1519 },
            { name: 'Jamnagar', lat: 22.4707, lng: 70.0577 },
            { name: 'Junagadh', lat: 21.5222, lng: 70.4579 },
            { name: 'Anand', lat: 22.5645, lng: 72.9289 },
            { name: 'Bharuch', lat: 21.7051, lng: 72.9959 },
            { name: 'Mehsana', lat: 23.5880, lng: 72.3693 },
            { name: 'Kutch (Bhuj)', lat: 23.2420, lng: 69.6669 }
        ],
        'Andhra Pradesh': [
            { name: 'Visakhapatnam', lat: 17.6868, lng: 83.2185 },
            { name: 'Vijayawada (NTR)', lat: 16.5062, lng: 80.6480 },
            { name: 'Guntur', lat: 16.3067, lng: 80.4365 },
            { name: 'Nellore', lat: 14.4426, lng: 79.9865 },
            { name: 'Kurnool', lat: 15.8281, lng: 78.0373 },
            { name: 'Tirupati', lat: 13.6288, lng: 79.4192 },
            { name: 'Kadapa (YSR)', lat: 14.4673, lng: 78.8242 },
            { name: 'Anantapur', lat: 14.6819, lng: 77.6006 },
            { name: 'East Godavari (Rajahmundry)', lat: 17.0005, lng: 81.8040 },
            { name: 'Kakinada', lat: 16.9891, lng: 82.2475 },
            { name: 'Prakasam (Ongole)', lat: 15.5057, lng: 80.0499 }
        ],
        'Telangana': [
            { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
            { name: 'Warangal', lat: 17.9689, lng: 79.5941 },
            { name: 'Nizamabad', lat: 18.6725, lng: 78.0941 },
            { name: 'Karimnagar', lat: 18.4386, lng: 79.1288 },
            { name: 'Khammam', lat: 17.2473, lng: 80.1514 },
            { name: 'Mahbubnagar', lat: 16.7488, lng: 77.9856 },
            { name: 'Nalgonda', lat: 17.0577, lng: 79.2684 },
            { name: 'Sangareddy', lat: 17.6190, lng: 78.0814 }
        ],
        'West Bengal': [
            { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
            { name: 'Howrah', lat: 22.5958, lng: 88.2636 },
            { name: 'Purba Bardhaman', lat: 23.2324, lng: 87.8615 },
            { name: 'Paschim Bardhaman (Durgapur)', lat: 23.5204, lng: 87.3119 },
            { name: 'Darjeeling (Siliguri)', lat: 26.7271, lng: 88.3953 },
            { name: 'Malda', lat: 25.0108, lng: 88.1411 },
            { name: 'Paschim Medinipur', lat: 22.4257, lng: 87.3199 },
            { name: 'Murshidabad', lat: 24.1759, lng: 88.2802 },
            { name: 'Nadia', lat: 23.4710, lng: 88.5565 },
            { name: 'Hooghly', lat: 22.9034, lng: 88.3968 }
        ],
        'Bihar': [
            { name: 'Patna', lat: 25.5941, lng: 85.1376 },
            { name: 'Gaya', lat: 24.7914, lng: 85.0002 },
            { name: 'Bhagalpur', lat: 25.2425, lng: 86.9842 },
            { name: 'Muzaffarpur', lat: 26.1209, lng: 85.3647 },
            { name: 'Purnia', lat: 25.7771, lng: 87.4753 },
            { name: 'Darbhanga', lat: 26.1542, lng: 85.8918 },
            { name: 'Begusarai', lat: 25.4182, lng: 86.1272 },
            { name: 'Rohtas (Sasaram)', lat: 24.9525, lng: 84.0315 }
        ],
        'Madhya Pradesh': [
            { name: 'Indore', lat: 22.7196, lng: 75.8577 },
            { name: 'Bhopal', lat: 23.2599, lng: 77.4126 },
            { name: 'Jabalpur', lat: 23.1815, lng: 79.9864 },
            { name: 'Gwalior', lat: 26.2183, lng: 78.1828 },
            { name: 'Ujjain', lat: 23.1765, lng: 75.7885 },
            { name: 'Sagar', lat: 23.8388, lng: 78.7378 },
            { name: 'Dewas', lat: 22.9676, lng: 76.0534 },
            { name: 'Satna', lat: 24.5805, lng: 80.8293 }
        ],
        'Kerala': [
            { name: 'Thiruvananthapuram', lat: 8.5241, lng: 76.9366 },
            { name: 'Ernakulam (Kochi)', lat: 9.9816, lng: 76.2999 },
            { name: 'Kozhikode', lat: 11.2588, lng: 75.7804 },
            { name: 'Thrissur', lat: 10.5276, lng: 76.2144 },
            { name: 'Kollam', lat: 8.8932, lng: 76.6141 },
            { name: 'Palakkad', lat: 10.7867, lng: 76.6548 },
            { name: 'Kannur', lat: 11.8745, lng: 75.3704 }
        ],
        'Delhi': [
            { name: 'New Delhi', lat: 28.6139, lng: 77.2090 },
            { name: 'South Delhi', lat: 28.4817, lng: 77.1873 },
            { name: 'North Delhi', lat: 28.7041, lng: 77.1025 },
            { name: 'West Delhi', lat: 28.6663, lng: 77.0674 },
            { name: 'East Delhi', lat: 28.6279, lng: 77.2784 }
        ]
    };

    // Helper: Assign accurate District to every Toll Plaza
    allTolls.forEach(toll => {
        if (!toll.district || toll.district === 'General') {
            const st = toll.state;
            const distList = INDIA_DISTRICT_COORDS[st];
            if (distList && distList.length > 0) {
                // Check name keyword match first
                const nameLow = (toll.name || '').toLowerCase();
                const matchedByName = distList.find(d => nameLow.includes(d.name.toLowerCase()));
                if (matchedByName) {
                    toll.district = matchedByName.name;
                } else if (toll.lat && toll.lng) {
                    // Match nearest district center by coordinate proximity
                    let bestD = distList[0].name;
                    let minDistance = Infinity;
                    distList.forEach(d => {
                        const dist = Math.hypot(toll.lat - d.lat, toll.lng - d.lng);
                        if (dist < minDistance) {
                            minDistance = dist;
                            bestD = d.name;
                        }
                    });
                    toll.district = bestD;
                } else {
                    toll.district = distList[0].name;
                }
            } else {
                toll.district = toll.state || 'General';
            }
        }
    });

    // 2. Extract Complete State and District Map
    const stateMap = {};
    allTolls.forEach(toll => {
        const s = toll.state || 'Other';
        const d = toll.district || 'General';
        if (!stateMap[s]) stateMap[s] = new Set();
        stateMap[s].add(d);
    });

    // Also inject any official districts that didn't have a toll yet
    for (const [st, dList] of Object.entries(INDIA_DISTRICT_COORDS)) {
        if (!stateMap[st]) stateMap[st] = new Set();
        dList.forEach(d => stateMap[st].add(d.name));
    }

    const statesList = Object.keys(stateMap).sort();

    // Populate State Select
    if (stateSelect) {
        stateSelect.innerHTML = '<option value="ALL">⭐ All States (National Network)</option>';
        statesList.forEach(st => {
            const count = allTolls.filter(t => (t.state || 'Other') === st).length;
            const opt = document.createElement('option');
            opt.value = st;
            opt.textContent = `${st} (${count} Plazas)`;
            stateSelect.appendChild(opt);
        });
    }

    // Function to Populate District Dropdown
    const populateDistricts = (selectedState) => {
        if (!districtSelect) return;
        districtSelect.innerHTML = '<option value="ALL">All Districts</option>';
        if (selectedState && selectedState !== 'ALL' && stateMap[selectedState]) {
            const districts = Array.from(stateMap[selectedState]).sort();
            districts.forEach(dist => {
                const count = allTolls.filter(t => (t.state || 'Other') === selectedState && t.district === dist).length;
                const opt = document.createElement('option');
                opt.value = dist;
                opt.textContent = `${dist}${count > 0 ? ` (${count} Tolls)` : ''}`;
                districtSelect.appendChild(opt);
            });
        }
    };

    // Function to Render Plazas into Select Dropdown and Interactive Cards
    const renderPlazas = () => {
        if (!plazaSelect) return;
        const selectedState = stateSelect ? stateSelect.value : 'ALL';
        const selectedDistrict = districtSelect ? districtSelect.value : 'ALL';
        const cardListEl = document.getElementById('district-tolls-card-list');

        let filtered = allTolls.filter(toll => {
            const tState = (toll.state || '').toLowerCase();
            const tDist = (toll.district || '').toLowerCase();

            // State match
            if (selectedState !== 'ALL' && (toll.state || 'Other') !== selectedState) return false;

            // District match
            if (selectedDistrict !== 'ALL' && (toll.district || '') !== selectedDistrict) return false;

            return true;
        });

        // Update badge with clear feedback
        if (countBadge) {
            if (selectedDistrict !== 'ALL') {
                countBadge.textContent = `${filtered.length} Tolls in ${selectedDistrict}`;
            } else if (selectedState !== 'ALL') {
                countBadge.textContent = `${filtered.length} Tolls in ${selectedState}`;
            } else {
                countBadge.textContent = `${allTolls.length}+ Plazas (All India)`;
            }
            countBadge.style.color = filtered.length > 0 ? '#10b981' : '#f43f5e';
        }

        plazaSelect.innerHTML = '';

        // Default super-admin option if All States / All Districts
        if (selectedState === 'ALL' || selectedDistrict === 'ALL') {
            const superOpt = document.createElement('option');
            superOpt.value = 'ALL';
            superOpt.textContent = `⭐ All Plazas (${selectedState === 'ALL' ? 'Super Admin - All India' : `All ${selectedState}`})`;
            plazaSelect.appendChild(superOpt);
        }

        if (filtered.length === 0) {
            const noOpt = document.createElement('option');
            noOpt.value = '';
            noOpt.textContent = `No toll plazas found in this district`;
            noOpt.disabled = true;
            plazaSelect.appendChild(noOpt);
            if (cardListEl) {
                cardListEl.innerHTML = '<div style="font-size:11px; color:#94a3b8; padding:12px; text-align:center;">No toll plazas registered for this district.</div>';
            }
            return;
        }

        // Populate Plaza Dropdown
        filtered.slice(0, 300).forEach((t, idx) => {
            const opt = document.createElement('option');
            opt.value = t.name || t.id;
            const corr = t.nhCorridor && t.nhCorridor !== 'N/A' ? ` [NH-${t.nhCorridor}]` : '';
            const loc = t.district ? ` (${t.district}, ${t.state})` : (t.state ? ` (${t.state})` : '');
            opt.textContent = `🏗️ ${t.name}${corr}${loc}`;
            opt.dataset.tollJson = JSON.stringify(t);
            plazaSelect.appendChild(opt);
        });

        // Auto-select first plaza if a specific district is picked
        if (selectedDistrict !== 'ALL' && filtered.length > 0) {
            plazaSelect.value = filtered[0].name || filtered[0].id;
        }

        // Populate Interactive Quick-Click Toll Cards
        if (cardListEl) {
            cardListEl.innerHTML = '';
            
            // Header for district tolls
            if (selectedDistrict !== 'ALL' || selectedState !== 'ALL') {
                const head = document.createElement('div');
                head.style.cssText = 'font-size: 9.5px; color: #94a3b8; font-weight: 700; margin-bottom: 2px; display: flex; justify-content: space-between; align-items: center;';
                head.innerHTML = `<span><i class="fa-solid fa-hand-pointer" style="color:#10b981;"></i> Click any toll to select directly:</span> <span style="color:#10b981;">${filtered.length} Plazas</span>`;
                cardListEl.appendChild(head);
            }

            filtered.slice(0, 40).forEach((t, idx) => {
                const card = document.createElement('div');
                const isSelected = (selectedDistrict !== 'ALL' && idx === 0) || (plazaSelect.value === (t.name || t.id));
                card.className = `toll-card-item ${isSelected ? 'selected' : ''}`;
                const corr = t.nhCorridor && t.nhCorridor !== 'N/A' ? `NH-${t.nhCorridor}` : 'National Hwy';
                
                card.innerHTML = `
                    <div style="flex:1; min-width:0; padding-right:8px;">
                        <div class="toll-card-name"><i class="fa-solid fa-archway" style="color:#10b981; font-size:10px;"></i> <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${t.name}</span></div>
                        <div class="toll-card-location"><i class="fa-solid fa-location-dot" style="font-size:8px; color:#10b981;"></i> ${t.district || ''}, ${t.state || 'India'}</div>
                    </div>
                    <span class="toll-card-corridor">${corr}</span>
                `;

                card.addEventListener('click', () => {
                    cardListEl.querySelectorAll('.toll-card-item').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    plazaSelect.value = t.name || t.id;
                });

                cardListEl.appendChild(card);
            });
        }
    };

    // Event Listeners for Filters
    if (stateSelect) {
        stateSelect.addEventListener('change', () => {
            populateDistricts(stateSelect.value);
            renderPlazas();
        });
    }

    if (districtSelect) {
        districtSelect.addEventListener('change', () => {
            renderPlazas();
        });
    }

    if (plazaSelect) {
        plazaSelect.addEventListener('change', () => {
            const cardListEl = document.getElementById('district-tolls-card-list');
            if (cardListEl) {
                cardListEl.querySelectorAll('.toll-card-item').forEach(card => {
                    const name = card.querySelector('.toll-card-name span')?.textContent;
                    if (name && (plazaSelect.value.includes(name) || name.includes(plazaSelect.value))) {
                        card.classList.add('selected');
                    } else {
                        card.classList.remove('selected');
                    }
                });
            }
        });
    }

    // Default to Punjab to showcase instant segregation out of the box
    if (stateSelect) {
        stateSelect.value = 'Punjab';
        populateDistricts('Punjab');
    }

    // Initial render
    renderPlazas();

    // 3. Form Submit Handler
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const id = document.getElementById('admin-id').value.trim();
            const pass = document.getElementById('admin-pass').value.trim();

            if (errorEl) errorEl.innerText = "";

            const btn = form.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> AUTHENTICATING...';
            btn.disabled = true;

            try {
                const res = await Auth.login(id, pass);
                if (res && res.success) {
                    // Store the selected plaza details
                    const selectedVal = plazaSelect ? plazaSelect.value : 'ALL';
                    sessionStorage.setItem('admin_plaza', selectedVal);

                    // If a specific plaza was chosen, store its full data
                    const selectedOpt = plazaSelect ? plazaSelect.options[plazaSelect.selectedIndex] : null;
                    if (selectedOpt && selectedOpt.dataset.tollJson) {
                        sessionStorage.setItem('admin_plaza_data', selectedOpt.dataset.tollJson);
                    } else {
                        // Find matching toll in allTolls if value is plaza name
                        const matchedToll = allTolls.find(t => t.name === selectedVal || t.id === selectedVal);
                        if (matchedToll) {
                            sessionStorage.setItem('admin_plaza_data', JSON.stringify(matchedToll));
                        } else {
                            sessionStorage.removeItem('admin_plaza_data');
                        }
                    }

                    window.location.href = 'index.html';
                } else {
                    const errMsg = (res && res.error) ? res.error : "ACCESS DENIED: Invalid Credentials.";
                    if (errorEl) {
                        errorEl.innerText = errMsg;
                        errorEl.style.display = 'block';
                    }
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            } catch (err) {
                if (errorEl) errorEl.innerText = "Authentication error. Please check network connection.";
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }
});
