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
                setTimeout(() => {
                    entryScreen.classList.add('hidden');
                    appContainer.classList.remove('hidden');
                    
                    // Trigger map resize since it was hidden
                    if (window.NHAI_MAP) {
                        if (typeof window.NHAI_MAP.resize === 'function') {
                            window.NHAI_MAP.resize();
                        }
                        if (typeof window.NHAI_MAP.invalidateSize === 'function') {
                            window.NHAI_MAP.invalidateSize();
                        }
                    }
                }, 800);
            });
        }
    }
};

window.EntryScreen = EntryScreen;
