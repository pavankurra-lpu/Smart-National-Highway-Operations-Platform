// NHAI Smart Highway Platform - Multi-Language Voice Assistant
const VoiceAssistant = {
    speak: async (text, forceLang) => {
        if (!window.speechSynthesis) return;

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const langSelect = document.getElementById('pref-voice-lang');
        let targetLang = forceLang || (langSelect ? langSelect.value : 'en-IN');
        
        if (!forceLang && window.Storage) {
            targetLang = Storage.get('nhai_voice_lang') || targetLang;
        }

        let targetGender = 'female';
        if (window.Storage) {
            targetGender = Storage.get('nhai_voice_gender') || 'female';
        }
        
        let finalText = text;
        
        // Translate if not English
        if (targetLang && !targetLang.startsWith('en')) {
            try {
                const tl = targetLang.split('-')[0]; // e.g., 'hi' from 'hi-IN'
                const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`);
                const data = await res.json();
                if (data && data[0]) {
                    // Combine translated parts if long text
                    finalText = data[0].map(part => part[0]).join(' ');
                }
            } catch (err) {
                console.error("Voice translation failed, falling back to original text.", err);
            }
        }

        const msg = new SpeechSynthesisUtterance(finalText);
        msg.lang = targetLang;
        msg.rate = 1.15;
        msg.pitch = 1.0;
        
        const voices = window.speechSynthesis.getVoices();
        
        // Filter by target language first
        let availableVoices = voices.filter(v => v.lang === targetLang || v.lang.replace('_', '-').startsWith(targetLang.split('-')[0]));
        
        // Try to match gender by looking at voice name and URI
        let selectedVoice = availableVoices.find(v => {
            const lowerName = v.name.toLowerCase();
            return targetGender === 'male' 
                ? (lowerName.includes('male') && !lowerName.includes('female'))
                : (lowerName.includes('female') || !lowerName.includes('male')); // default to female if not specified
        });

        if (!selectedVoice && availableVoices.length > 0) {
            selectedVoice = availableVoices[0];
        }
                             
        if (selectedVoice) {
            msg.voice = selectedVoice;
        }
        
        window.speechSynthesis.speak(msg);
    }
};

window.VoiceAssistant = VoiceAssistant;

// Trigger voice loading
if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}
