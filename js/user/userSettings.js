// User Settings Tab Logic

const UserSettings = {
    init: () => {
        const langSelect = document.getElementById('pref-voice-lang');
        const genderSelect = document.getElementById('pref-voice-gender');
        const picUpload = document.getElementById('profile-pic-upload');
        const picPreview = document.getElementById('profile-pic-preview');

        // Load saved preferences
        if (window.Storage) {
            const savedLang = Storage.get('nhai_voice_lang');
            if (savedLang && langSelect) langSelect.value = savedLang;

            const savedGender = Storage.get('nhai_voice_gender');
            if (savedGender && genderSelect) genderSelect.value = savedGender;

            const savedPic = Storage.get('nhai_profile_pic');
            if (savedPic && picPreview) {
                picPreview.innerHTML = `<img src="${savedPic}" style="width:100%; height:100%; object-fit:cover;">`;
            }
        }

        // Event listeners
        if (langSelect) {
            langSelect.addEventListener('change', (e) => {
                if (window.Storage) Storage.set('nhai_voice_lang', e.target.value);
                if (window.Utils) Utils.showToast('Voice language saved as primary.', 'success');
            });
        }

        if (genderSelect) {
            genderSelect.addEventListener('change', (e) => {
                if (window.Storage) Storage.set('nhai_voice_gender', e.target.value);
                if (window.Utils) Utils.showToast('Voice type saved as primary.', 'success');
            });
        }

        if (picUpload) {
            picUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 2 * 1024 * 1024) {
                        if (window.Utils) Utils.showToast('File too large. Max 2MB allowed.', 'error');
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const base64 = ev.target.result;
                        if (window.Storage) Storage.set('nhai_profile_pic', base64);
                        if (picPreview) {
                            picPreview.innerHTML = `<img src="${base64}" style="width:100%; height:100%; object-fit:cover;">`;
                        }
                        if (window.Utils) Utils.showToast('Profile picture updated.', 'success');
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                if (window.Storage) {
                    Storage.remove('nhai_user_profile');
                }
                window.location.href = '../index.html';
            });
        }

        const btnSwitchAccount = document.getElementById('btn-switch-account');
        if (btnSwitchAccount) {
            btnSwitchAccount.addEventListener('click', () => {
                if (window.Utils) Utils.showToast('Redirecting to login portal...', 'info');
                setTimeout(() => {
                    window.location.href = '../index.html';
                }, 1000);
            });
        }
    }
};

window.UserSettings = UserSettings;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Small timeout to ensure DOM elements are fully accessible
    setTimeout(() => {
        UserSettings.init();
    }, 50);
});
