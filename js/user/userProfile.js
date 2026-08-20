const UserProfile = {
    init: () => {
        const profile = Storage.get('nhai_user_profile');
        
        if (!profile) {
            // Show setup modal if no profile exists
            Utils.toggleVisibility('profile-setup-modal', true);
        } else {
            UserProfile.applyProfile(profile);
        }

        const btnSave = document.getElementById('btn-save-profile');
        if (btnSave) {
            btnSave.addEventListener('click', UserProfile.saveProfile);
        }

        const btnDemo = document.getElementById('btn-load-demo-data');
        if (btnDemo) {
            btnDemo.addEventListener('click', () => {
                if (window.Storage) Storage.seedDemoData();
                Utils.showToast("Demo Data Loaded Successfully! Refreshing UI...", "success");
                setTimeout(() => {
                    window.location.reload();
                }, 800);
            });
        }
    },

    saveProfile: () => {
        const name = document.getElementById('profile-name').value.trim();
        const regNum = document.getElementById('profile-reg').value.trim();
        const phone = document.getElementById('profile-phone').value.trim();
        const email = document.getElementById('profile-email').value.trim();
        const vehicleType = document.getElementById('profile-vtype').value;

        if (!name || !regNum || !phone || !email) {
            Utils.showToast('Please fill in all profile fields.', 'error');
            return;
        }

        const phoneRegex = /^[6-9]\d{9}$/;
        if (!phoneRegex.test(phone)) {
            Utils.showToast('Please enter a valid 10-digit Indian mobile number.', 'error');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            Utils.showToast('Please enter a valid email address.', 'error');
            return;
        }

        const profileData = {
            name: name,
            regNum: regNum,
            phone: phone,
            email: email,
            vehicleType: vehicleType,
            setupDate: new Date().toISOString()
        };

        Storage.set('nhai_user_profile', profileData);
        Utils.showToast('Profile configured successfully!', 'success');
        
        Utils.toggleVisibility('profile-setup-modal', false);
        UserProfile.applyProfile(profileData);
    },

    applyProfile: (profile) => {
        const nameEl = document.getElementById('profile-name');
        const regEl = document.getElementById('profile-reg');
        const phoneEl = document.getElementById('profile-phone');
        const emailEl = document.getElementById('profile-email');
        const vTypeEl = document.getElementById('profile-vtype');
        
        if (nameEl) nameEl.value = profile.name || '';
        if (regEl) regEl.value = profile.regNum || '';
        if (phoneEl) phoneEl.value = profile.phone || '';
        if (emailEl) emailEl.value = profile.email || '';
        if (vTypeEl && profile.vehicleType) vTypeEl.value = profile.vehicleType;

        // Sync main vehicle type if garage is empty
        const garageVehicles = window.VehicleGarage ? (typeof window.VehicleGarage.getAll === 'function' ? window.VehicleGarage.getAll() : []) : [];
        if (garageVehicles.length === 0 && profile.vehicleType) {
            const vTypeSelect = document.getElementById('vehicle-type');
            if (vTypeSelect) vTypeSelect.value = profile.vehicleType;
        }
    }
};

window.UserProfile = UserProfile;
