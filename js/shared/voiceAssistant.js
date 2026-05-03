// NHAI Smart Highway Platform - Universal Local Voice Assistant
const VoiceAssistant = {
    isSpeaking: false,
    
    _getVoicesAsync: () => {
        return new Promise((resolve) => {
            let voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                resolve(voices);
                return;
            }
            // VOICE LOADING FIX: Wait for voices to load asynchronously
            window.speechSynthesis.onvoiceschanged = () => {
                voices = window.speechSynthesis.getVoices();
                resolve(voices);
            };
            // Safety timeout
            setTimeout(() => {
                resolve(window.speechSynthesis.getVoices());
            }, 1000);
        });
    },

    speak: async (text, forceLang) => {
        if (!window.speechSynthesis) return;

        // SAFE SPEECH EXECUTION: Cancel previous speech immediately
        window.speechSynthesis.cancel();
        VoiceAssistant.isSpeaking = false;

        const langSelect = document.getElementById('pref-voice-lang');
        let targetLang = forceLang || (langSelect ? langSelect.value : 'en-IN');
        
        if (!forceLang && window.Storage) {
            targetLang = Storage.get('nhai_voice_lang') || targetLang;
        }

        let targetGender = 'female';
        if (window.Storage) {
            targetGender = Storage.get('nhai_voice_gender') || 'female';
        }
        
        // LANGUAGE OUTPUT RULE: No cloud translation, text remains exactly as provided
        let finalText = text;

        // Wait for voices
        const voices = await VoiceAssistant._getVoicesAsync();

        if (voices.length === 0) {
            console.warn("No TTS voices available on this device.");
            return;
        }

        // DEBUG LOGGING
        console.log("Available voices:", voices.map(v => ({
            name: v.name,
            lang: v.lang
        })));

        // VOICE SELECTION ENGINE
        // 1. Try exact or partial language match
        let availableVoices = voices.filter(v => 
            v.lang.toLowerCase() === targetLang.toLowerCase() || 
            v.lang.toLowerCase().replace('_', '-').startsWith(targetLang.split('-')[0].toLowerCase())
        );

        // 2. If NOT found, fallback to ANY available voice
        if (availableVoices.length === 0) {
            console.warn(`${targetLang} voice not available, using fallback`);
            availableVoices = voices; 
        }

        // 3. MALE VOICE HANDLING (OPTIONAL)
        let selectedVoice = null;
        if (targetGender === 'male') {
            selectedVoice = availableVoices.find(v => v.name.toLowerCase().includes('male'));
            if (!selectedVoice) {
                console.warn("Male voice not available, using fallback");
            }
        } 
        
        // Try female if male not found or not requested
        if (!selectedVoice) {
            selectedVoice = availableVoices.find(v => v.name.toLowerCase().includes('female'));
        }

        // ABSOLUTE RULE: System MUST ALWAYS select a voice
        if (!selectedVoice) {
            selectedVoice = availableVoices[0];
        }

        // SAFE SPEECH EXECUTION: Create utterance and speak
        const utterance = new SpeechSynthesisUtterance(finalText);
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
        utterance.rate = 1;
        utterance.pitch = 1;

        utterance.onstart = () => { VoiceAssistant.isSpeaking = true; };
        utterance.onend = () => { VoiceAssistant.isSpeaking = false; };
        utterance.onerror = (e) => { 
            console.warn("Speech synthesis error:", e);
            VoiceAssistant.isSpeaking = false; 
        };
        
        window.speechSynthesis.speak(utterance);
    }
};

window.VoiceAssistant = VoiceAssistant;

// Ensure voices are loaded early
if (window.speechSynthesis) {
    VoiceAssistant._getVoicesAsync();
}
