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

        const genderEl = document.getElementById('pref-voice-gender');
        const targetGender = genderEl ? genderEl.value : (localStorage.getItem('nhai_voice_gender') || 'male');

        const voices = await VoiceAssistant._getVoicesAsync();

        let selectedVoice = null;
        if (targetGender === 'female') {
            selectedVoice = voices.find(v => {
                const name = (v.name || '').toLowerCase();
                const lang = (v.lang || '').toLowerCase();
                const isEnglish = lang.startsWith('en');
                const isFemale = name.includes('zira') || 
                                 name.includes('female') || 
                                 name.includes('samantha') || 
                                 name.includes('victoria') || 
                                 name.includes('karen') || 
                                 name.includes('hazel') || 
                                 name.includes('heera') || 
                                 name.includes('catherine') || 
                                 name.includes('susan') || 
                                 name.includes('jenny') || 
                                 name.includes('aria') || 
                                 (name.includes('google') && !name.includes('male'));
                return isEnglish && isFemale;
            });
        } else {
            selectedVoice = voices.find(v => {
                const name = (v.name || '').toLowerCase();
                const lang = (v.lang || '').toLowerCase();
                const isEnglish = lang.startsWith('en');
                const isMale = name.includes('david') || 
                               name.includes('mark') || 
                               name.includes('george') || 
                               name.includes('guy') || 
                               name.includes('male') || 
                               name.includes('ravi') ||
                               name.includes('james') ||
                               name.includes('richard');
                return isEnglish && isMale;
            });
        }

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
        utterance.onstart = () => { 
            VoiceAssistant.isSpeaking = true; 
            const vis = document.getElementById('voice-wave-visualizer');
            if (vis) vis.classList.add('speaking');
        };
        utterance.onend = () => { 
            VoiceAssistant.isSpeaking = false; 
            const vis = document.getElementById('voice-wave-visualizer');
            if (vis) vis.classList.remove('speaking');
        };
        utterance.onerror = () => { 
            VoiceAssistant.isSpeaking = false; 
            const vis = document.getElementById('voice-wave-visualizer');
            if (vis) vis.classList.remove('speaking');
        };

        window.speechSynthesis.speak(utterance);
    },

    // ═══════════════════════════════════════════════════════════════
    // SPEECH RECOGNITION (Voice Route Assistant)
    // ═══════════════════════════════════════════════════════════════
    _recognition: null,
    isListening: false,

    startListening: () => {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            Utils.showToast("Voice recognition not supported in this browser. Please use Chrome/Edge.", "warning");
            IndiaMapPlanner.openMobileSearch();
            return;
        }

        if (VoiceAssistant.isListening) {
            VoiceAssistant.stopListening();
            return;
        }

        const modal = document.getElementById('voice-search-modal');
        const transcriptEl = document.getElementById('voice-modal-transcript');
        const statusEl = document.getElementById('voice-modal-status');
        const micEl = document.getElementById('voice-modal-mic');

        if (modal) modal.classList.remove('hidden');
        if (statusEl) statusEl.textContent = 'Listening for Route...';
        if (transcriptEl) transcriptEl.textContent = '"Listening..."';
        if (micEl) micEl.classList.add('pulse-active');

        try {
            const rec = new SpeechRec();
            rec.lang = 'en-IN';
            rec.continuous = false;
            rec.interimResults = true;

            rec.onstart = () => {
                VoiceAssistant.isListening = true;
                VoiceAssistant._recognition = rec;
            };

            rec.onresult = (e) => {
                let spoken = '';
                for (let i = e.resultIndex; i < e.results.length; ++i) {
                    spoken += e.results[i][0].transcript;
                }
                if (transcriptEl) transcriptEl.textContent = `"${spoken}"`;

                if (e.results[0].isFinal) {
                    VoiceAssistant._handleVoiceRouteQuery(spoken);
                }
            };

            rec.onerror = (err) => {
                console.warn("Speech error:", err);
                if (statusEl) statusEl.textContent = 'Could not catch that. Tap below to retry.';
                VoiceAssistant.isListening = false;
                if (micEl) micEl.classList.remove('pulse-active');
            };

            rec.onend = () => {
                VoiceAssistant.isListening = false;
                if (micEl) micEl.classList.remove('pulse-active');
            };

            rec.start();
        } catch (e) {
            console.error("SpeechRec start failed:", e);
            Utils.showToast("Microphone permission required for voice search.", "error");
        }
    },

    stopListening: () => {
        if (VoiceAssistant._recognition) {
            try { VoiceAssistant._recognition.stop(); } catch (e) {}
            VoiceAssistant._recognition = null;
        }
        VoiceAssistant.isListening = false;
        const modal = document.getElementById('voice-search-modal');
        if (modal) modal.classList.add('hidden');
        const micEl = document.getElementById('voice-modal-mic');
        if (micEl) micEl.classList.remove('pulse-active');
    },

    _handleVoiceRouteQuery: async (query) => {
        const modal = document.getElementById('voice-search-modal');
        const statusEl = document.getElementById('voice-modal-status');
        if (statusEl) statusEl.textContent = 'Searching location & highways... 🚀';

        let clean = (query || '').trim().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');
        let cleanLower = clean.toLowerCase();

        // 1. Check if user specified a Route between two places: "Delhi to Jaipur", "From Chandigarh to Ludhiana", etc.
        const fromToMatch = cleanLower.match(/(?:route\s+|directions\s+)?(?:from\s+)?([a-z\s]+?)\s+to\s+([a-z\s]+)/i);
        const hasExplicitFromTo = fromToMatch && fromToMatch[1] && fromToMatch[2] && !cleanLower.startsWith('directions to') && !cleanLower.startsWith('navigate to') && !cleanLower.startsWith('go to');

        if (hasExplicitFromTo) {
            let origin = fromToMatch[1].replace(/^(from|take|show|find|route|get)\s+/i, '').trim();
            let dest = fromToMatch[2].replace(/\s+(route|highway|fastest|cheapest)$/i, '').trim();

            setTimeout(() => {
                if (modal) modal.classList.add('hidden');
                VoiceAssistant.stopListening();

                const origInput = document.getElementById('route-origin-input');
                const destInput = document.getElementById('route-dest-input');
                if (origInput) origInput.value = origin.charAt(0).toUpperCase() + origin.slice(1);
                if (destInput) destInput.value = dest.charAt(0).toUpperCase() + dest.slice(1);

                if (window.IndiaMapPlanner && typeof IndiaMapPlanner.processRoute === 'function') {
                    IndiaMapPlanner.processRoute();
                }
                Utils.showToast(`Voice Route: ${origin} ➔ ${dest} 🛣️`, 'success');
                VoiceAssistant.speak(`Calculating optimal route from ${origin} to ${dest}`);
            }, 600);
            return;
        }

        // 2. Single Place or "Directions to [Place]" / "Navigate to [Place]" / "[City Name]"
        let placeTarget = cleanLower
            .replace(/^(directions\s+to|navigate\s+to|drive\s+to|take\s+me\s+to|go\s+to|where\s+is|find|search|show\s+me|route\s+to|to)\s+/i, '')
            .replace(/\s+(highway|corridor|toll|toll\s+plaza|city|route)$/i, '')
            .trim();

        if (!placeTarget) placeTarget = cleanLower;

        // Resolve via unified place resolver
        let matchedPlace = null;
        if (window.IndiaMapPlanner && typeof IndiaMapPlanner.resolvePlaceQuery === 'function') {
            matchedPlace = await IndiaMapPlanner.resolvePlaceQuery(placeTarget);
        }

        setTimeout(() => {
            if (modal) modal.classList.add('hidden');
            VoiceAssistant.stopListening();

            if (matchedPlace && window.IndiaMapPlanner && typeof IndiaMapPlanner.showVoicePlaceResult === 'function') {
                IndiaMapPlanner.showVoicePlaceResult(matchedPlace);
                Utils.showToast(`Found: ${matchedPlace.name} 📍`, 'success');
            } else {
                const destInput = document.getElementById('route-dest-input');
                if (destInput) {
                    destInput.value = placeTarget.charAt(0).toUpperCase() + placeTarget.slice(1);
                    IndiaMapPlanner.openMobileSearch();
                }
                Utils.showToast(`Could not pinpoint "${clean}". Added to search.`, 'warning');
                VoiceAssistant.speak(`Could not find exact location for ${placeTarget}. Please select from list.`);
            }
        }, 500);
    }
};

window.VoiceAssistant = VoiceAssistant;

if (window.speechSynthesis) {
    VoiceAssistant._getVoicesAsync();
}
