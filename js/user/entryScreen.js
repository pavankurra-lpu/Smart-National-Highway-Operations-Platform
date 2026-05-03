// Entry Screen Animation Logic

const EntryScreen = {
    init: () => {
        const btnUnlock = document.getElementById('btn-unlock-portal');
        const entryScreen = document.getElementById('entry-screen');
        const appContainer = document.getElementById('user-app');

        if (btnUnlock) {
            btnUnlock.addEventListener('click', () => {
                // Play animation
                entryScreen.classList.add('fade-out');
                
                // Greeting Voice
                if (window.speechSynthesis && window.Storage) {
                    const profile = Storage.get('nhai_user_profile');
                    const name = profile && profile.name ? profile.name : "Traveller";
                    const hour = new Date().getHours();
                    let greeting = "Good evening";
                    if (hour >= 5 && hour < 12) greeting = "Good morning";
                    else if (hour >= 12 && hour < 17) greeting = "Good afternoon";
                    else if (hour >= 17 && hour < 22) greeting = "Good evening";
                    else greeting = "Wow a night owl came to travel";
                    
                    // Fallback English if translating is not ready yet, but VoiceAssistant handles it
                    if (window.VoiceAssistant) {
                        window.VoiceAssistant.speak(`${greeting}, ${name}. Welcome to the NHAI Smart Highway Portal.`);
                    } else if (window.speechSynthesis) {
                        const msg = new SpeechSynthesisUtterance(`${greeting}, ${name}. Welcome to the NHAI Smart Highway Portal.`);
                        const voices = window.speechSynthesis.getVoices();
                        const inVoice = voices.find(v => v.lang.includes('en-IN'));
                        if (inVoice) msg.voice = inVoice;
                        window.speechSynthesis.speak(msg);
                    }
                }


                setTimeout(() => {
                    entryScreen.classList.add('hidden');
                    appContainer.classList.remove('hidden');
                    
                    // Trigger map resize since it was hidden
                    if (window.IndiaMapPlanner && IndiaMapPlanner.map) {
                        IndiaMapPlanner.map.invalidateSize();
                        setTimeout(() => IndiaMapPlanner.map.invalidateSize(), 100);
                        setTimeout(() => IndiaMapPlanner.map.invalidateSize(), 500);
                    }
                }, 800);
            });
        }
    }
};

window.EntryScreen = EntryScreen;
