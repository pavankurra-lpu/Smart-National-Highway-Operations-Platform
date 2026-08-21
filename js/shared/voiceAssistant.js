// NHAI Smart Highway Platform - High-Clarity Pure English Male Voice Assistant

// Clear any legacy language storage to guarantee pure English everywhere
try {
    localStorage.removeItem('nhai_voice_lang');
    localStorage.removeItem('voice_lang');
} catch (e) {}

const VoiceAssistant = {
    isSpeaking: false,
    _currentAbortController: null,
    
    _getVoicesAsync: () => {
        return new Promise((resolve) => {
            let voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
            if (voices && voices.length > 0) {
                resolve(voices);
                return;
            }
            if (window.speechSynthesis) {
                window.speechSynthesis.onvoiceschanged = () => {
                    voices = window.speechSynthesis.getVoices();
                    resolve(voices || []);
                };
            }
            setTimeout(() => {
                resolve((window.speechSynthesis ? window.speechSynthesis.getVoices() : []) || []);
            }, 500);
        });
    },

    // Convert numeric digits into natural English words so every TTS reads it in pure English
    _numberToEnglishWords: (num) => {
        const a = ['','one ','two ','three ','four ', 'five ','six ','seven ','eight ','nine ','ten ','eleven ','twelve ','thirteen ','fourteen ','fifteen ','sixteen ','seventeen ','eighteen ','nineteen '];
        const b = ['', '', 'twenty','thirty','forty','fifty', 'sixty','seventy','eighty','ninety'];
        const val = parseInt(num, 10);
        if (isNaN(val)) return num;
        if (val === 0) return 'zero';
        if (val.toString().length > 9) return val.toString();
        const n = ('000000000' + val).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!n) return val.toString();
        let str = '';
        str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
        str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
        str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
        str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
        str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
        return str.trim();
    },

    speak: async (text) => {
        if (!text) return;
        const enableCheckbox = document.getElementById('pref-voice-enable');
        if (enableCheckbox && !enableCheckbox.checked) return;

        if (!window.speechSynthesis) return;

        // Cancel previous speech
        window.speechSynthesis.cancel();
        VoiceAssistant.isSpeaking = false;

        // Clean text: format currency symbols and replace raw digits with English words
        let cleanText = text
            .replace(/₹\s*(\d+)/g, '$1 rupees')
            .replace(/INR\s*(\d+)/gi, '$1 rupees')
            .replace(/\b(\d+)\s*rupees\b/gi, (match, p1) => {
                return `${VoiceAssistant._numberToEnglishWords(p1)} rupees`;
            })
            .replace(/\b(\d+)\s*mins?\b/gi, (match, p1) => {
                return `${VoiceAssistant._numberToEnglishWords(p1)} minutes`;
            })
            .replace(/\b(\d+)\s*minutes\b/gi, (match, p1) => {
                return `${VoiceAssistant._numberToEnglishWords(p1)} minutes`;
            })
            .replace(/\b(\d+)\s*hours?\b/gi, (match, p1) => {
                return `${VoiceAssistant._numberToEnglishWords(p1)} hours`;
            })
            .replace(/\b(\d+)\s*tolls?\b/gi, (match, p1) => {
                return `${VoiceAssistant._numberToEnglishWords(p1)} tolls`;
            })
            .replace(/\b\d+\b/g, (match) => {
                return VoiceAssistant._numberToEnglishWords(match);
            });

        const voices = await VoiceAssistant._getVoicesAsync();

        // Strictly pick English Male voice
        let selectedVoice = voices.find(v => {
            const name = (v.name || '').toLowerCase();
            const lang = (v.lang || '').toLowerCase();
            const isEnglish = lang.startsWith('en');
            const isMale = name.includes('david') || 
                           name.includes('mark') || 
                           name.includes('george') || 
                           name.includes('guy') || 
                           name.includes('male') || 
                           name.includes('ravi') ||
                           name.includes('james');
            return isEnglish && isMale;
        });

        // Fallback to any English voice
        if (!selectedVoice) {
            selectedVoice = voices.find(v => (v.lang || '').toLowerCase().startsWith('en'));
        }
        if (!selectedVoice && voices.length > 0) {
            selectedVoice = voices[0];
        }

        const utterance = new SpeechSynthesisUtterance(cleanText);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
        utterance.lang = 'en-US';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        utterance.onstart = () => { VoiceAssistant.isSpeaking = true; };
        utterance.onend = () => { VoiceAssistant.isSpeaking = false; };
        utterance.onerror = () => { VoiceAssistant.isSpeaking = false; };

        window.speechSynthesis.speak(utterance);
    }
};

window.VoiceAssistant = VoiceAssistant;

if (window.speechSynthesis) {
    VoiceAssistant._getVoicesAsync();
}
