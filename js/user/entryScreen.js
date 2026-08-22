// Entry Screen Animation Logic

const EntryScreen = {
    init: () => {
        const btnUnlock = document.getElementById('btn-unlock-portal');
        const entryScreen = document.getElementById('entry-screen');
        const appContainer = document.getElementById('user-app');

        if (btnUnlock && entryScreen) {
            btnUnlock.addEventListener('click', () => {
                entryScreen.classList.add('fade-out');
                
                // Greeting Voice (non-blocking)
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
                } catch (e) { console.warn('Voice greeting error:', e); }

                setTimeout(() => {
                    entryScreen.style.display = 'none';
                    if (appContainer) appContainer.classList.remove('hidden');
                    
                    // Trigger map resize since it is now revealed
                    if (window.IndiaMapPlanner && IndiaMapPlanner.map) {
                        IndiaMapPlanner.map.invalidateSize();
                        setTimeout(() => IndiaMapPlanner.map.invalidateSize(), 100);
                        setTimeout(() => IndiaMapPlanner.map.invalidateSize(), 400);
                        IndiaMapPlanner.askForLocationPermission();
                    }
                }, 450);
            });
        }
    }
};

window.EntryScreen = EntryScreen;
