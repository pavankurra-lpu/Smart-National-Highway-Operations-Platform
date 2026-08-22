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

    // 2. Extract Unique States and Districts
    const stateMap = {};
    allTolls.forEach(toll => {
        const s = toll.state || 'Other';
        const d = toll.district || toll.location || 'General';
        if (!stateMap[s]) stateMap[s] = new Set();
        if (d) stateMap[s].add(d);
    });

    const statesList = Object.keys(stateMap).sort();

    // Populate State Select
    if (stateSelect) {
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
                const opt = document.createElement('option');
                opt.value = dist;
                opt.textContent = dist;
                districtSelect.appendChild(opt);
            });
        }
    };

    // Function to Render Plazas into Select Dropdown
    const renderPlazas = () => {
        if (!plazaSelect) return;
        const selectedState = stateSelect ? stateSelect.value : 'ALL';
        const selectedDistrict = districtSelect ? districtSelect.value : 'ALL';
        const query = (searchInput ? searchInput.value : '').trim().toLowerCase();

        let filtered = allTolls.filter(toll => {
            const tState = (toll.state || '').toLowerCase();
            const tDist = (toll.district || toll.location || '').toLowerCase();
            const tName = (toll.name || toll.plazaName || '').toLowerCase();
            const tCorr = (toll.nhCorridor || toll.highway || '').toLowerCase();

            // State match
            if (selectedState !== 'ALL' && (toll.state || 'Other') !== selectedState) return false;

            // District match
            if (selectedDistrict !== 'ALL' && (toll.district || toll.location || '') !== selectedDistrict) return false;

            // Search query match (search by state, district, plaza name, or NH corridor)
            if (query) {
                const matches = tName.includes(query) || tState.includes(query) || tDist.includes(query) || tCorr.includes(query);
                if (!matches) return false;
            }

            return true;
        });

        // Update badge
        if (countBadge) {
            countBadge.textContent = `${filtered.length} Plazas Found`;
            countBadge.style.color = filtered.length > 0 ? '#38bdf8' : '#f43f5e';
        }

        plazaSelect.innerHTML = '';

        // Default super-admin option
        const superOpt = document.createElement('option');
        superOpt.value = 'ALL';
        superOpt.textContent = `⭐ All Plazas (Super Admin - All India)`;
        plazaSelect.appendChild(superOpt);

        if (filtered.length === 0) {
            const noOpt = document.createElement('option');
            noOpt.value = '';
            noOpt.textContent = `No plazas match query "${query}"`;
            noOpt.disabled = true;
            plazaSelect.appendChild(noOpt);
            return;
        }

        filtered.slice(0, 300).forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.name || t.id;
            const corr = t.nhCorridor && t.nhCorridor !== 'N/A' ? ` [NH-${t.nhCorridor}]` : '';
            const loc = t.district ? ` (${t.district}, ${t.state})` : (t.state ? ` (${t.state})` : '');
            opt.textContent = `🏗️ ${t.name}${corr}${loc}`;
            opt.dataset.tollJson = JSON.stringify(t);
            plazaSelect.appendChild(opt);
        });

        if (filtered.length > 300) {
            const moreOpt = document.createElement('option');
            moreOpt.disabled = true;
            moreOpt.textContent = `... and ${filtered.length - 300} more (refine search or district)`;
            plazaSelect.appendChild(moreOpt);
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

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            // Auto-detect if user typed a known state name (e.g. "Punjab")
            const q = searchInput.value.trim().toLowerCase();
            const matchedState = statesList.find(s => s.toLowerCase() === q);
            if (matchedState && stateSelect) {
                stateSelect.value = matchedState;
                populateDistricts(matchedState);
            }
            renderPlazas();
        });
    }

    // Initial render
    renderPlazas();

    // 3. Form Submit Handler
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const id = document.getElementById('admin-id').value.trim();
            const pass = document.getElementById('admin-pass').value.trim();

            const btn = form.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> AUTHENTICATING...';
            btn.disabled = true;

            setTimeout(async () => {
                const success = await Auth.login(id, pass);
                if (success) {
                    sessionStorage.setItem('nhai_admin_auth', 'token-admin-session-2026');
                    
                    // Store the selected plaza details
                    const selectedVal = plazaSelect ? plazaSelect.value : 'ALL';
                    sessionStorage.setItem('admin_plaza', selectedVal);

                    // If a specific plaza was chosen, store its full data
                    const selectedOpt = plazaSelect ? plazaSelect.options[plazaSelect.selectedIndex] : null;
                    if (selectedOpt && selectedOpt.dataset.tollJson) {
                        sessionStorage.setItem('admin_plaza_data', selectedOpt.dataset.tollJson);
                    } else {
                        sessionStorage.removeItem('admin_plaza_data');
                    }

                    window.location.href = 'index.html';
                } else {
                    if (errorEl) errorEl.innerText = "ACCESS DENIED. Invalid Credentials.";
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            }, 600);
        });
    }
});
