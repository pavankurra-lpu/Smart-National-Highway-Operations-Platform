const EntryScreen = {
    init: () => {
        const entryScreen = document.getElementById('entry-screen');
        const appContainer = document.getElementById('user-app');
        
        const stepPhone = document.getElementById('entry-step-phone');
        const stepVerify = document.getElementById('entry-step-verify');
        const stepAuth = document.getElementById('entry-step-authenticated');
        const badge = document.getElementById('entry-auth-badge');
        
        const phoneInput = document.getElementById('entry-phone-input');
        const otpInput = document.getElementById('entry-otp-input');
        const phoneTarget = document.getElementById('entry-phone-target');
        const userText = document.getElementById('entry-auth-user-text');
        
        const btnSendOtp = document.getElementById('btn-entry-send-otp');
        const btnVerifyOtp = document.getElementById('btn-entry-verify-otp');
        const btnChangePhone = document.getElementById('btn-entry-change-phone');
        const btnResendOtp = document.getElementById('btn-entry-resend-otp');
        const btnSwitchUser = document.getElementById('btn-entry-switch-user');
        const btnGuestMode = document.getElementById('btn-entry-guest-mode');
        const btnUnlock = document.getElementById('btn-unlock-portal');

        let pendingPhone = '';
        const backendUrl = window.NHAI_CONFIG?.backend?.url || 'https://smart-national-highway-operations.onrender.com';

        const unlockDashboard = () => {
            if (!entryScreen) return;
            entryScreen.classList.add('fade-out');

            try {
                if (window.VoiceAssistant) {
                    const profile = window.Storage ? Storage.get('nhai_user_profile') : null;
                    const name = profile && profile.name ? profile.name : "Traveller";
                    const hour = new Date().getHours();
                    let greeting = "Good day";
                    if (hour >= 5 && hour < 12) greeting = "Good morning";
                    else if (hour >= 12 && hour < 17) greeting = "Good afternoon";
                    else if (hour >= 17 && hour < 22) greeting = "Good evening";
                    else greeting = "Welcome";
                    window.VoiceAssistant.speak(`${greeting}, ${name}. Welcome to the NHAI Smart Highway Portal.`);
                }
            } catch (e) {}

            setTimeout(() => {
                entryScreen.style.display = 'none';
                if (appContainer) appContainer.classList.remove('hidden');

                if (window.IndiaMapPlanner && IndiaMapPlanner.map) {
                    IndiaMapPlanner.map.invalidateSize();
                    setTimeout(() => IndiaMapPlanner.map.invalidateSize(), 100);
                    setTimeout(() => IndiaMapPlanner.map.invalidateSize(), 400);
                    IndiaMapPlanner.askForLocationPermission();
                }

                if (window.FastagEngine && typeof FastagEngine.syncFromServer === 'function') {
                    FastagEngine.syncFromServer();
                }
                window.updateTravellerAuthUI();
            }, 450);
        };

        const updateAuthState = () => {
            const token = sessionStorage.getItem('nhai_traveller_auth');
            const savedPhone = sessionStorage.getItem('nhai_traveller_phone');

            if (token && savedPhone) {
                if (stepPhone) stepPhone.style.display = 'none';
                if (stepVerify) stepVerify.style.display = 'none';
                if (stepAuth) stepAuth.style.display = 'block';
                if (userText) userText.innerText = `Connected: +91-${savedPhone}`;
                if (badge) {
                    badge.innerText = 'Authenticated & Synced';
                    badge.style.color = '#10b981';
                    badge.style.borderColor = 'rgba(16,185,129,0.3)';
                    badge.style.background = 'rgba(16,185,129,0.1)';
                }
            } else {
                if (stepPhone) stepPhone.style.display = 'block';
                if (stepVerify) stepVerify.style.display = 'none';
                if (stepAuth) stepAuth.style.display = 'none';
                if (badge) {
                    badge.innerText = 'FASTag Secure Ledger';
                    badge.style.color = '#94a3b8';
                    badge.style.borderColor = 'rgba(255,255,255,0.1)';
                    badge.style.background = 'rgba(255,255,255,0.06)';
                }
            }
            window.updateTravellerAuthUI();
        };

        if (btnSendOtp) {
            btnSendOtp.addEventListener('click', async () => {
                const phone = (phoneInput.value || '').trim();
                if (!/^[6-9]\d{9}$/.test(phone)) {
                    if (window.Utils) Utils.showToast('Please enter a valid 10-digit Indian mobile number.', 'error');
                    return;
                }

                pendingPhone = phone;
                btnSendOtp.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Sending OTP...';
                btnSendOtp.disabled = true;

                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 15000);
                    const res = await fetch(`${backendUrl}/api/auth/traveller/send-otp`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone }),
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                    const data = await res.json();

                    if (res.ok && data.success) {
                        if (stepPhone) stepPhone.style.display = 'none';
                        if (stepVerify) stepVerify.style.display = 'block';
                        if (phoneTarget) phoneTarget.innerText = `+91-${phone}`;
                        if (otpInput) {
                            otpInput.value = '';
                            otpInput.focus();
                        }
                        if (data.devOtp !== undefined) {
                            otpInput.value = String(data.devOtp);
                            if (window.Utils) Utils.showToast(`Demo mode (no SMS gateway configured): your OTP is ${data.devOtp}`, 'success');
                        } else {
                            if (window.Utils) Utils.showToast(`6-Digit OTP sent to +91-${phone}`, 'success');
                        }
                    } else {
                        if (window.Utils) Utils.showToast(data.error || 'Failed to send OTP.', 'error');
                    }
                } catch (e) {
                    if (window.Utils) Utils.showToast('Unable to reach server. Please check internet connection.', 'error');
                } finally {
                    btnSendOtp.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send 6-Digit OTP Code';
                    btnSendOtp.disabled = false;
                }
            });
        }

        if (btnVerifyOtp) {
            btnVerifyOtp.addEventListener('click', async () => {
                const otp = (otpInput.value || '').trim();
                if (otp.length !== 6) {
                    if (window.Utils) Utils.showToast('Please enter the full 6-digit OTP code.', 'error');
                    return;
                }

                btnVerifyOtp.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Verifying...';
                btnVerifyOtp.disabled = true;

                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 15000);
                    const res = await fetch(`${backendUrl}/api/auth/traveller/verify-otp`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone: pendingPhone, otp }),
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                    const data = await res.json();

                    if (res.ok && data.success && data.token) {
                        sessionStorage.setItem('nhai_traveller_auth', data.token);
                        sessionStorage.setItem('nhai_traveller_phone', pendingPhone);
                        if (data.wallet && window.Storage) {
                            Storage.set(Storage.KEYS.FASTAG_BALANCE, data.wallet.balance);
                        }
                        if (window.Utils) Utils.showToast(`Verified! Welcome +91-${pendingPhone}`, 'success');
                        unlockDashboard();
                    } else {
                        if (window.Utils) Utils.showToast(data.error || 'Invalid OTP code. Please try again.', 'error');
                    }
                } catch (e) {
                    if (window.Utils) Utils.showToast('Server connection timeout. Please retry.', 'error');
                } finally {
                    btnVerifyOtp.innerHTML = '<i class="fa-solid fa-lock-open"></i> Verify & Launch Dashboard';
                    btnVerifyOtp.disabled = false;
                }
            });
        }

        if (btnChangePhone) {
            btnChangePhone.addEventListener('click', () => {
                if (stepVerify) stepVerify.style.display = 'none';
                if (stepPhone) stepPhone.style.display = 'block';
                if (phoneInput) phoneInput.focus();
            });
        }

        if (btnResendOtp) {
            btnResendOtp.addEventListener('click', () => {
                if (btnSendOtp) btnSendOtp.click();
            });
        }

        if (btnSwitchUser) {
            btnSwitchUser.addEventListener('click', () => {
                window.logoutTraveller();
            });
        }

        if (btnUnlock) {
            btnUnlock.addEventListener('click', unlockDashboard);
        }

        if (btnGuestMode) {
            btnGuestMode.addEventListener('click', () => {
                unlockDashboard();
            });
        }

        updateAuthState();
    }
};

window.logoutTraveller = () => {
    sessionStorage.removeItem('nhai_traveller_auth');
    sessionStorage.removeItem('nhai_traveller_phone');
    if (window.Storage) {
        Storage.set(Storage.KEYS.FASTAG_BALANCE, 0);
    }
    if (window.FastagEngine && typeof window.FastagEngine.updateUI === 'function') {
        window.FastagEngine.updateUI();
    }
    window.updateTravellerAuthUI();
    if (window.Utils) {
        Utils.showToast('Logged out. Switched to Guest Mode. Click Sign In to connect.', 'info');
    }
    const entryScreen = document.getElementById('entry-screen');
    if (entryScreen && !entryScreen.classList.contains('fade-out')) {
        if (window.EntryScreen && typeof window.EntryScreen.init === 'function') {
            window.EntryScreen.init();
        }
    }
};

window.updateTravellerAuthUI = () => {
    const token = sessionStorage.getItem('nhai_traveller_auth');
    const phone = sessionStorage.getItem('nhai_traveller_phone');
    const authText = document.getElementById('sidebar-auth-text');
    const authIcon = document.getElementById('sidebar-auth-icon');
    const authBtn = document.getElementById('btn-sidebar-auth');
    const userName = document.getElementById('sidebar-user-name');
    const userSub = document.getElementById('sidebar-user-sub');
    const userAvatar = document.getElementById('sidebar-user-avatar');

    const tabFastag = document.getElementById('tab-btn-fastag');
    const tabAnalytics = document.getElementById('tab-btn-analytics');
    const tabSettings = document.getElementById('tab-btn-settings');
    const tabPlan = document.getElementById('tab-btn-plan');

    if (token && phone) {
        if (userName) userName.innerText = `+91-${phone.substring(0, 5)} ${phone.substring(5)}`;
        if (userSub) userSub.innerHTML = '<span class="user-status-dot live"></span> Server Wallet Active';
        if (userAvatar) userAvatar.innerHTML = '<i class="fa-solid fa-shield-check" style="color:#10b981;"></i>';
        if (authText) authText.innerText = 'Log Out';
        if (authIcon) authIcon.className = 'fa-solid fa-right-from-bracket';
        if (authBtn) {
            authBtn.className = 'sidebar-auth-action-btn logged-in';
            authBtn.title = 'Click to Log Out / Switch Mobile Number';
        }

        // Full access when authenticated
        if (tabFastag) tabFastag.style.display = '';
        if (tabAnalytics) tabAnalytics.style.display = '';
        if (tabSettings) tabSettings.style.display = '';
    } else {
        if (userName) userName.innerText = 'Guest Traveller';
        if (userSub) userSub.innerHTML = '<span class="user-status-dot"></span> Offline / Guest Mode';
        if (userAvatar) userAvatar.innerHTML = '<i class="fa-solid fa-user"></i>';
        if (authText) authText.innerText = 'Sign In';
        if (authIcon) authIcon.className = 'fa-solid fa-mobile-screen-button';
        if (authBtn) {
            authBtn.className = 'sidebar-auth-action-btn';
            authBtn.title = 'Phone Login & Wallet Sync';
        }

        // Guest mode: only Route and Emergency SOS allowed
        if (tabFastag) tabFastag.style.display = 'none';
        if (tabAnalytics) tabAnalytics.style.display = 'none';
        if (tabSettings) tabSettings.style.display = 'none';

        // Auto redirect to Route tab if on restricted tab
        const activeTabBtn = document.querySelector('.tab-btn.active');
        if (activeTabBtn && ['tab-btn-fastag', 'tab-btn-analytics', 'tab-btn-settings'].includes(activeTabBtn.id)) {
            if (tabPlan) tabPlan.click();
        }
    }
};

window.handleSidebarAuthClick = () => {
    const token = sessionStorage.getItem('nhai_traveller_auth');
    if (token) {
        window.logoutTraveller();
    } else {
        Utils.toggleVisibility('traveller-otp-modal', true);
        const modalPhone = document.getElementById('traveller-phone-input');
        if (modalPhone) modalPhone.focus();
    }
};

window.EntryScreen = EntryScreen;
