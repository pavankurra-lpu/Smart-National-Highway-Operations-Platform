// Vehicle Garage — Multi-vehicle registration and quick switching

const VehicleGarage = {

    STORAGE_KEY: 'nhai_user_vehicles',
    ACTIVE_KEY:  'nhai_active_vehicle',

    getAll: () => {
        try {
            return JSON.parse(localStorage.getItem(VehicleGarage.STORAGE_KEY) || '[]');
        } catch(e) { return []; }
    },

    getActive: () => {
        const id = localStorage.getItem(VehicleGarage.ACTIVE_KEY);
        if (!id) return null;
        return VehicleGarage.getAll().find(v => v.id === id) || null;
    },

    add: (nickname, regNumber, vehicleType) => {
        const vehicles = VehicleGarage.getAll();
        if (vehicles.length >= 5) {
            Utils.showToast('Maximum 5 vehicles allowed per account.', 'error');
            return false;
        }
        // Check for duplicate registration number
        if (vehicles.some(v => v.regNumber === regNumber.trim().toUpperCase())) {
            Utils.showToast('This registration number is already saved.', 'error');
            return false;
        }
        const newVehicle = {
            id:          'VEH_' + Date.now(),
            nickname:    nickname.trim(),
            regNumber:   regNumber.trim().toUpperCase(),
            vehicleType: vehicleType,
            addedAt:     new Date().toISOString()
        };
        vehicles.push(newVehicle);
        localStorage.setItem(VehicleGarage.STORAGE_KEY, JSON.stringify(vehicles));
        // Auto-select if this is the first vehicle
        if (vehicles.length === 1) VehicleGarage.setActive(newVehicle.id);
        return true;
    },

    remove: (vehicleId) => {
        let vehicles = VehicleGarage.getAll();
        const removing = vehicles.find(v => v.id === vehicleId);
        if (!removing) return;
        vehicles = vehicles.filter(v => v.id !== vehicleId);
        localStorage.setItem(VehicleGarage.STORAGE_KEY, JSON.stringify(vehicles));
        // If removed was active, switch to first available
        if (localStorage.getItem(VehicleGarage.ACTIVE_KEY) === vehicleId) {
            if (vehicles.length > 0) {
                VehicleGarage.setActive(vehicles[0].id);
            } else {
                localStorage.removeItem(VehicleGarage.ACTIVE_KEY);
                // Reset dropdown to default
                const sel = document.getElementById('vehicle-type');
                if (sel) sel.value = 'LMV';
            }
        }
        VehicleGarage.render();
        Utils.showToast(`${removing.nickname} removed from garage.`, 'info');
    },

    setActive: (vehicleId) => {
        localStorage.setItem(VehicleGarage.ACTIVE_KEY, vehicleId);
        const vehicle = VehicleGarage.getAll().find(v => v.id === vehicleId);
        if (vehicle) {
            // Sync to the vehicle-type dropdown — all toll and route logic reads this
            const sel = document.getElementById('vehicle-type');
            if (sel) sel.value = vehicle.vehicleType;
            // Trigger the special vehicle box logic
            sel?.dispatchEvent(new Event('change'));
            Utils.showToast(`Now using: ${vehicle.nickname} (${vehicle.regNumber})`, 'success');
        }
        VehicleGarage.render();
    },

    handleAdd: () => {
        const nickname    = (document.getElementById('garage-nickname')?.value || '').trim();
        const regNumber   = (document.getElementById('garage-reg')?.value || '').trim();
        const vehicleType = document.getElementById('garage-type')?.value || 'LMV';

        if (!nickname) {
            Utils.showToast('Enter a nickname, e.g. "My Swift" or "Papa\'s Car".', 'error');
            return;
        }
        if (!regNumber) {
            Utils.showToast('Enter the vehicle registration number.', 'error');
            return;
        }
        // Basic Indian registration format check (loose)
        const regRegex = /^[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{4}$/i;
        if (!regRegex.test(regNumber.replace(/\s/g, ''))) {
            Utils.showToast('Enter a valid registration number (e.g. DL01AB1234).', 'error');
            return;
        }
        const success = VehicleGarage.add(nickname, regNumber, vehicleType);
        if (success) {
            document.getElementById('garage-nickname').value = '';
            document.getElementById('garage-reg').value = '';
            VehicleGarage.render();
            // Collapse the add form
            const form = document.getElementById('garage-add-form');
            if (form) form.classList.add('hidden');
        }
    },

    render: () => {
        const container = document.getElementById('vehicle-garage-list');
        if (!container) return;

        const vehicles = VehicleGarage.getAll();
        const activeId  = localStorage.getItem(VehicleGarage.ACTIVE_KEY);

        const typeLabels = {
            LMV: 'Car / Jeep / Van', LCV: 'Light Commercial',
            BUS_2AXLE: 'Bus / Truck 2A', COM_3AXLE: 'Commercial 3A',
            MAV_4_6: 'MAV 4-6A', OVERSIZED: 'Oversized 7+A',
            GOVT: 'Government', PRESS: 'Press/Media', ARMY: 'Army/Defense',
            AMBULANCE: 'Ambulance', FIRE: 'Fire & Rescue', POLICE: 'Police'
        };

        const typeIcons = {
            LMV: 'fa-car', LCV: 'fa-van-shuttle', BUS_2AXLE: 'fa-bus',
            COM_3AXLE: 'fa-truck', MAV_4_6: 'fa-truck-moving', OVERSIZED: 'fa-truck-monster',
            GOVT: 'fa-landmark', PRESS: 'fa-camera', ARMY: 'fa-shield-halved',
            AMBULANCE: 'fa-truck-medical', FIRE: 'fa-fire-extinguisher', POLICE: 'fa-shield-halved'
        };

        if (vehicles.length === 0) {
            container.innerHTML = `
                <div style="
                    text-align:center; padding:18px 12px;
                    border:1px dashed var(--border);
                    border-radius:8px; color:var(--text-muted); font-size:12px;
                ">
                    <i class="fa-solid fa-garage" style="font-size:22px;margin-bottom:8px;display:block;"></i>
                    Your garage is empty. Add your first vehicle below.
                </div>`;
            return;
        }

        container.innerHTML = vehicles.map(v => {
            const isActive = v.id === activeId;
            const icon = typeIcons[v.vehicleType] || 'fa-car';
            return `
            <div onclick="VehicleGarage.setActive('${v.id}')" style="
                display:flex; align-items:center; gap:10px; padding:10px 12px;
                border-radius:8px; margin-bottom:6px; cursor:pointer;
                background:${isActive ? 'rgba(100,255,218,0.07)' : 'rgba(255,255,255,0.02)'};
                border:1px solid ${isActive ? 'var(--primary)' : 'var(--border)'};
                transition:all 0.2s;
            ">
                <div style="
                    width:34px; height:34px; border-radius:50%; flex-shrink:0;
                    background:${isActive ? 'var(--primary)' : 'var(--border)'};
                    display:flex; align-items:center; justify-content:center;
                ">
                    <i class="fa-solid ${icon}" style="
                        color:${isActive ? '#021a12' : 'var(--text-muted)'};
                        font-size:13px;
                    "></i>
                </div>
                <div style="flex:1; overflow:hidden; min-width:0;">
                    <div style="
                        font-weight:700; font-size:13px;
                        color:${isActive ? 'var(--primary)' : 'var(--text-main)'};
                        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
                        display:flex; align-items:center; gap:6px;
                    ">
                        ${v.nickname}
                        ${isActive ? '<span style="font-size:8px;background:var(--primary);color:#021a12;padding:2px 5px;border-radius:3px;font-weight:800;letter-spacing:0.5px;">ACTIVE</span>' : ''}
                    </div>
                    <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">
                        ${v.regNumber} &nbsp;·&nbsp; ${typeLabels[v.vehicleType] || v.vehicleType}
                    </div>
                </div>
                <button onclick="event.stopPropagation(); VehicleGarage.remove('${v.id}')"
                    title="Remove vehicle"
                    style="
                        background:none; border:none; cursor:pointer;
                        color:var(--text-muted); font-size:12px; padding:6px;
                        border-radius:4px; transition:color 0.2s;
                    "
                    onmouseover="this.style.color='var(--accent-red)'"
                    onmouseout="this.style.color='var(--text-muted)'">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>`;
        }).join('');
    },

    init: () => {
        VehicleGarage.render();

        // Sync active vehicle type to dropdown on page load
        const active = VehicleGarage.getActive();
        if (active) {
            const sel = document.getElementById('vehicle-type');
            if (sel) sel.value = active.vehicleType;
        }

        // Add vehicle button — toggles the add form
        const showAddBtn = document.getElementById('btn-show-add-vehicle');
        if (showAddBtn) {
            showAddBtn.addEventListener('click', () => {
                const form = document.getElementById('garage-add-form');
                if (form) form.classList.toggle('hidden');
            });
        }

        // Confirm add button
        const addBtn = document.getElementById('btn-add-vehicle');
        if (addBtn) addBtn.addEventListener('click', VehicleGarage.handleAdd);
    }
};

window.VehicleGarage = VehicleGarage;
