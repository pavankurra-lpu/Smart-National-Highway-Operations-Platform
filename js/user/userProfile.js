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
        // Pre-select vehicle type if present in the route planner dropdown
        const vTypeSelect = document.getElementById('vehicle-type');
        if (vTypeSelect && profile.vehicleType) {
            vTypeSelect.value = profile.vehicleType;
        }
    }
};

window.UserProfile = UserProfile;
