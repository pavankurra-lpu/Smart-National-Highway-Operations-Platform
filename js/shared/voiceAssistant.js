// NHAI Smart Highway Platform - Universal Indian Languages Female Voice Assistant

const VOICE_TRANSLATIONS = {
    'hi-IN': {
        'Demo biometric scan in progress.': 'डेमो बायोमेट्रिक स्कैन चल रहा है।',
        'Demo biometric check complete.': 'डेमो बायोमेट्रिक जांच पूरी हुई।',
        'Starting live journey...': 'लाइव यात्रा शुरू हो रही है...',
        'Toll payment successful!': 'टोल भुगतान सफल रहा!',
        'Optimal travel conditions.': 'यात्रा के लिए अनुकूल परिस्थितियां।',
        'Slippery roads. Reduce speed by 20%.': 'फिसलन भरी सड़कें। गति २०% कम करें।',
        'Low visibility. Use fog lights & hazard lamps.': 'कम दृश्यता। फॉग लाइट और हेज़र्ड लाइट का उपयोग करें।',
        'High winds and lightning hazard. Proceed with caution.': 'तेज हवाएं और बिजली का खतरा। सावधानी से आगे बढ़ें।',
        'Extreme heat risk. Check tyres, coolant, and carry extra water. Rest every 2 hours.': 'अत्यधिक गर्मी का खतरा। अतिरिक्त पानी रखें और टायरों की जांच करें।',
        'Extreme heat risk. Carry extra water and check tyres.': 'अत्यधिक गर्मी का खतरा। अतिरिक्त पानी रखें और टायरों की जांच करें।',
        'Please look directly at the scanner.': 'कृपया सीधे स्कैनर की ओर देखें।',
        'Biometric check complete. Driver identity verified.': 'बायोमेट्रिक जांच पूरी हुई। चालक की पहचान सत्यापित की गई।',
        'Real-time weather': 'वास्तविक समय मौसम',
        'Live location tracking active': 'लाइव स्थान ट्रैकिंग सक्रिय',
        'Alert:': 'चेतावनी:',
        'Security verification completed successfully.': 'सुरक्षा सत्यापन सफलतापूर्वक पूरा हुआ।',
        'Verification successful! Processing route...': 'सत्यापन सफल! मार्ग की प्रक्रिया की जा रही है...',
        'Clear Skies': 'साफ मौसम',
        'Heavy Rain': 'भारी बारिश',
        'Dense Fog': 'घना कोहरा',
        'Thunderstorm': 'गरज के साथ तूफान',
        'Extreme Heat': 'अत्यधिक गर्मी'
    },
    'te-IN': {
        'Demo biometric scan in progress.': 'డెమో బయోమెట్రిక్ స్కాన్ జరుగుతోంది.',
        'Demo biometric check complete.': 'డెమో బయోమెట్రిక్ తనిఖీ పూర్తయింది.',
        'Starting live journey...': 'లైవ్ ప్రయాణం ప్రారంభమవుతోంది...',
        'Toll payment successful!': 'టోల్ చెల్లింపు విజయవంతమైంది!',
        'Optimal travel conditions.': 'అనుకూల ప్రయాణ పరిస్థితులు.',
        'Slippery roads. Reduce speed by 20%.': 'జారే రోడ్లు. వేగాన్ని 20% తగ్గించండి.',
        'Low visibility. Use fog lights & hazard lamps.': 'తక్కువ దృశ్యమానత. ఫాగ్ లైట్లు మరియు హజార్డ్ లైట్లు ఉపయోగించండి.',
        'High winds and lightning hazard. Proceed with caution.': 'ఈదురు గాలులు మరియు మెరుపుల ప్రమాదం. జాగ్రత్తగా కొనసాగండి.',
        'Extreme heat risk. Check tyres, coolant, and carry extra water. Rest every 2 hours.': 'తీవ్రమైన ఎండ ప్రమాదం. అదనపు నీటిని తీసుకెళ్లండి మరియు టైర్లను తనిఖీ చేయండి.',
        'Extreme heat risk. Carry extra water and check tyres.': 'తీవ్రమైన ఎండ ప్రమాదం. అదనపు నీటిని తీసుకెళ్లండి మరియు టైర్లను తనిఖీ చేయండి.',
        'Clear Skies': 'నిర్మలమైన ఆకాశం',
        'Heavy Rain': 'భారీ వర్షం',
        'Dense Fog': 'దట్టమైన పొగమంచు',
        'Thunderstorm': 'పిడుగులతో కూడిన వర్షం',
        'Extreme Heat': 'తీవ్రమైన వేడి'
    },
    'ta-IN': {
        'Demo biometric scan in progress.': 'டெமோ பயோமெட்ரிக் ஸ்கேன் செயலில் உள்ளது.',
        'Demo biometric check complete.': 'டெமோ பயோமெட்ரிக் சரிபார்ப்பு முடிந்தது.',
        'Starting live journey...': 'நேரடி பயணம் தொடங்குகிறது...',
        'Toll payment successful!': 'சுங்கக் கட்டணம் செலுத்தப்பட்டது!',
        'Optimal travel conditions.': 'சாதகமான பயண நிலைமைகள்.',
        'Slippery roads. Reduce speed by 20%.': 'வழுக்கும் சாலைகள். வேகத்தை 20% குறைக்கவும்.',
        'Low visibility. Use fog lights & hazard lamps.': 'குறைந்த தெரிவுநிலை. பனி விளக்குகள் மற்றும் அபாய விளக்குகளைப் பயன்படுத்தவும்.',
        'High winds and lightning hazard. Proceed with caution.': 'அதிவேக காற்று மற்றும் மின்னல் ஆபத்து. எச்சரிக்கையுடன் தொடரவும்.',
        'Extreme heat risk. Check tyres, coolant, and carry extra water. Rest every 2 hours.': 'அதிக வெப்ப அபாயம். கூடுதல் தண்ணீர் எடுத்துச் சென்று டயர்களைச் சரிபார்க்கவும்.',
        'Extreme heat risk. Carry extra water and check tyres.': 'அதிக வெப்ப அபாயம். கூடுதல் தண்ணீர் எடுத்துச் சென்று டயர்களைச் சரிபார்க்கவும்.',
        'Clear Skies': 'தெளிவான வானம்',
        'Heavy Rain': 'கனமழை',
        'Dense Fog': 'அடர்ந்த பனிமூட்டம்',
        'Thunderstorm': 'இடிமின்னல்',
        'Extreme Heat': 'கடும் வெப்பம்'
    },
    'kn-IN': {
        'Demo biometric scan in progress.': 'ಡೆಮೊ ಬಯೋಮೆಟ್ರಿಕ್ ಸ್ಕ್ಯಾನ್ ಪ್ರಗತಿಯಲ್ಲಿದೆ.',
        'Demo biometric check complete.': 'ಡೆಮೊ ಬಯೋಮೆಟ್ರಿಕ್ ಪರಿಶೀಲನೆ ಪೂರ್ಣಗೊಂಡಿದೆ.',
        'Starting live journey...': 'ಲೈವ್ ಪ್ರಯಾಣ ಪ್ರಾರಂಭವಾಗುತ್ತಿದೆ...',
        'Toll payment successful!': 'ಟೋಲ್ ಪಾವತಿ ಯಶಸ್ವಿಯಾಗಿದೆ!',
        'Optimal travel conditions.': 'ಅನುಕೂಲಕರ ಪ್ರಯಾಣದ ಪರಿಸ್ಥಿತಿಗಳು.',
        'Slippery roads. Reduce speed by 20%.': 'ಜಾರುವ ರಸ್ತೆಗಳು. ವೇಗವನ್ನು 20% ರಷ್ಟು ಕಡಿಮೆ ಮಾಡಿ.',
        'Low visibility. Use fog lights & hazard lamps.': 'ಕಡಿಮೆ ಗೋಚರತೆ. ಫಾಗ್ ಲೈಟ್‌ಗಳು ಮತ್ತು ಅಪಾಯದ ದೀಪಗಳನ್ನು ಬಳಸಿ.',
        'High winds and lightning hazard. Proceed with caution.': 'ಬಲವಾದ ಗಾಳಿ ಮತ್ತು ಮಿಂಚಿನ ಅಪಾಯ. ಎಚ್ಚರಿಕೆಯಿಂದ ಮುಂದುವರಿಯಿರಿ.',
        'Extreme heat risk. Check tyres, coolant, and carry extra water. Rest every 2 hours.': 'ವಿಪರೀತ ಶಾಖದ ಅಪಾಯ. ಹೆಚ್ಚುವರಿ ನೀರನ್ನು ಒಯ್ಯಿರಿ ಮತ್ತು ಟೈರ್‌ಗಳನ್ನು ಪರೀಕ್ಷಿಸಿ.',
        'Extreme heat risk. Carry extra water and check tyres.': 'ವಿಪರೀತ ಶಾಖದ ಅಪಾಯ. ಹೆಚ್ಚುವರಿ ನೀರನ್ನು ಒಯ್ಯಿರಿ ಮತ್ತು ಟೈರ್‌ಗಳನ್ನು ಪರೀಕ್ಷಿಸಿ.',
        'Clear Skies': 'ಸ್ವಚ್ಛ ಆಕಾಶ',
        'Heavy Rain': 'ಭಾರೀ ಮಳೆ',
        'Dense Fog': 'ದಟ್ಟವಾದ ಮಂಜು',
        'Thunderstorm': 'ಗುಡುಗು ಸಹಿತ ಮಳೆ',
        'Extreme Heat': 'ಅತಿಯಾದ ತಾಪಮಾನ'
    },
    'ml-IN': {
        'Demo biometric scan in progress.': 'ഡെമോ ബയോമെട്രിക് സ്കാൻ പുരോഗമിക്കുന്നു.',
        'Demo biometric check complete.': 'ഡെമോ ബയോമെട്രിക് പരിശോധന പൂർത്തിയായി.',
        'Starting live journey...': 'യാത്ര ആരംഭിക്കുന്നു...',
        'Toll payment successful!': 'ടോൾ പേയ്മെന്റ് വിജയകരമായി!',
        'Optimal travel conditions.': 'അനുകൂല യാത്രാ സാഹചര്യങ്ങൾ.',
        'Slippery roads. Reduce speed by 20%.': 'വഴുക്കലുള്ള റോഡുകൾ. വേഗത 20% കുറയ്ക്കുക.',
        'Low visibility. Use fog lights & hazard lamps.': 'കുറഞ്ഞ കാഴ്ചാ പരിധി. ഫോഗ് ലൈറ്റുകളും ഹസാർഡ് ലൈറ്റുകളും ഉപയോഗിക്കുക.',
        'High winds and lightning hazard. Proceed with caution.': 'ശക്തമായ കാറ്റും മിന്നൽ ഭയവും. ശ്രദ്ധയോടെ മുന്നോട്ട് പോവുക.',
        'Extreme heat risk. Check tyres, coolant, and carry extra water. Rest every 2 hours.': 'കടുത്ത ചൂട് ഭീഷണി. കൂടുതൽ വെള്ളം കരുതുക, ടയറുകൾ പരിശോധിക്കുക.',
        'Extreme heat risk. Carry extra water and check tyres.': 'കടുത്ത ചൂട് ഭീഷണി. കൂടുതൽ വെള്ളം കരുതുക, ടയറുകൾ പരിശോധിക്കുക.',
        'Clear Skies': 'തെളിഞ്ഞ ആകാശം',
        'Heavy Rain': 'ശക്തമായ മഴ',
        'Dense Fog': 'കനത്ത മൂടൽമഞ്ഞ്',
        'Thunderstorm': 'ഇടിമിന്നൽ',
        'Extreme Heat': 'കഠിനമായ ചൂട്'
    }
};

const VoiceAssistant = {
    isSpeaking: false,
    
    _getVoicesAsync: () => {
        return new Promise((resolve) => {
            let voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                resolve(voices);
                return;
            }
            window.speechSynthesis.onvoiceschanged = () => {
                voices = window.speechSynthesis.getVoices();
                resolve(voices);
            };
            setTimeout(() => {
                resolve(window.speechSynthesis.getVoices());
            }, 1000);
        });
    },

    _getSarvamLangCode: (targetLang) => {
        const langMap = {
            'en-IN': 'english',
            'hi-IN': 'hindi',
            'te-IN': 'telugu',
            'ta-IN': 'tamil',
            'ml-IN': 'malayalam',
            'kn-IN': 'kannada'
        };
        return langMap[targetLang] || null;
    },

    speak: async (text, forceLang) => {
        if (!window.speechSynthesis) return;

        // Cancel previous native speech and any pending backend fetch
        window.speechSynthesis.cancel();
        if (VoiceAssistant._currentAbortController) {
            VoiceAssistant._currentAbortController.abort();
        }
        VoiceAssistant._currentAbortController = new AbortController();
        const signal = VoiceAssistant._currentAbortController.signal;

        VoiceAssistant.isSpeaking = false;

        let targetLang = 'en-IN';
        if (window.Storage) {
            targetLang = Storage.get('nhai_voice_lang') || 'en-IN';
        }
        if (forceLang) targetLang = forceLang;

        let finalText = text;

        // Apply translations for regional Indian languages (always translate text for targetLang)
        if (targetLang !== 'en-IN' && VOICE_TRANSLATIONS[targetLang]) {
            const dict = VOICE_TRANSLATIONS[targetLang];
            if (dict[text]) {
                finalText = dict[text];
            } else {
                // Dynamic translation matcher: "The current weather at your origin is X degrees with Y. Z"
                const weatherMatch = text.match(/The current weather at your (origin|destination) is (\d+) degrees with ([^.]+)\.\s*(.+)/i);
                if (weatherMatch) {
                    const placeType = weatherMatch[1];
                    const temp = weatherMatch[2];
                    const condition = weatherMatch[3].trim();
                    const advisory = weatherMatch[4].trim();
                    
                    const placeTrans = targetLang === 'hi-IN' ? (placeType === 'origin' ? 'प्रस्थान स्थान' : 'गंतव्य स्थान') : 
                                      targetLang === 'te-IN' ? (placeType === 'origin' ? 'ప్రారంభ స్థానం' : 'గమ్యస్థానం') :
                                      targetLang === 'ta-IN' ? (placeType === 'origin' ? 'தொடக்க இடம்' : 'சேருமிடம்') :
                                      targetLang === 'kn-IN' ? (placeType === 'origin' ? 'ಪ್ರಾರಂಭದ ಸ್ಥಳ' : 'ಗಮ್ಯಸ್ಥಾನ') :
                                      targetLang === 'ml-IN' ? (placeType === 'origin' ? 'തുടങ്ങുന്ന സ്ഥലം' : 'ലക്ഷ്യസ്ഥാനം') : placeType;
                    
                    const condTrans = dict[condition] || condition;
                    const advTrans = dict[advisory] || advisory;
                    
                    if (targetLang === 'hi-IN') {
                        finalText = `आपके ${placeTrans} पर वर्तमान मौसम ${temp} डिग्री के साथ ${condTrans} है। ${advTrans}`;
                    } else if (targetLang === 'te-IN') {
                        finalText = `మీ ${placeTrans} వద్ద ప్రస్తుత వాతావరణం ${temp} డిగ్రీలు మరియు ${condTrans}. ${advTrans}`;
                    } else if (targetLang === 'ta-IN') {
                        finalText = `உங்கள் ${placeTrans}ல் தற்போதைய வானிலை ${temp} டிகிரி மற்றும் ${condTrans}. ${advTrans}`;
                    } else if (targetLang === 'kn-IN') {
                        finalText = `ನಿಮ್ಮ ${placeTrans}ದಲ್ಲಿ ಈಗಿನ ವಾತಾವರಣ ${temp} ಡಿಗ್ರಿ ಮತ್ತು ${condTrans}. ${advTrans}`;
                    } else if (targetLang === 'ml-IN') {
                        finalText = `നിങ്ങളുടെ ${placeTrans}ലെ ഇപ്പോഴത്തെ കാലാവസ്ഥ ${temp} ഡിഗ്രിയും ${condTrans} ആണ്. ${advTrans}`;
                    }
                }
                
                // Dynamic selection matcher: "You have selected origin place as Delhi."
                const selectionMatch = text.match(/You have selected (origin|destination) place as ([^.]+)/i);
                if (selectionMatch) {
                    const placeType = selectionMatch[1];
                    const cityName = selectionMatch[2];
                    const placeTrans = targetLang === 'hi-IN' ? (placeType === 'origin' ? 'प्रस्थान स्थान' : 'गंतव्य स्थान') : 
                                      targetLang === 'te-IN' ? (placeType === 'origin' ? 'ప్రారంభ స్థానం' : 'గమ్యస్థానం') :
                                      targetLang === 'ta-IN' ? (placeType === 'origin' ? 'தொடக்க இடம்' : 'சேருமிடம்') :
                                      targetLang === 'kn-IN' ? (placeType === 'origin' ? 'ಪ್ರಾರಂಭದ ಸ್ಥಳ' : 'ಗಮ್ಯಸ್ಥಾನ') :
                                      targetLang === 'ml-IN' ? (placeType === 'origin' ? 'തുടങ്ങുന്ന സ്ഥലം' : 'ലക്ഷ്യസ്ഥാനം') : placeType;
                    if (targetLang === 'hi-IN') {
                        finalText = `आपने ${placeTrans} के रूप में ${cityName} को चुना है।`;
                    } else if (targetLang === 'te-IN') {
                        finalText = `మీరు ${placeTrans}గా ${cityName}ని ఎంచుకున్నారు.`;
                    } else if (targetLang === 'ta-IN') {
                        finalText = `நீங்கள் ${placeTrans}ஆக ${cityName}ஐத் தேர்ந்தெடுத்துள்ளீர்கள்.`;
                    } else if (targetLang === 'kn-IN') {
                        finalText = `ನೀವು ${placeTrans}ವಾಗಿ ${cityName} ಆಯ್ಕೆ ಮಾಡಿದ್ದೀರಿ.`;
                    } else if (targetLang === 'ml-IN') {
                        finalText = `നിങ്ങൾ ${placeTrans} ആയി ${cityName} തിരഞ്ഞെടുത്തിരിക്കുന്നു.`;
                    }
                }
            }
        }

        const voices = await VoiceAssistant._getVoicesAsync();

        // Voice selector matching lang code
        let availableVoices = voices.filter(v => 
            v.lang.toLowerCase() === targetLang.toLowerCase() || 
            v.lang.toLowerCase().replace('_', '-').startsWith(targetLang.split('-')[0].toLowerCase())
        );

        // Fallback to any Indian voice pack if exact language match is not loaded locally
        if (availableVoices.length === 0) {
            availableVoices = voices.filter(v => v.lang.toLowerCase().includes('in'));
        }
        if (availableVoices.length === 0) {
            availableVoices = voices;
        }

        // Target high-quality female speakers
        let selectedVoice = availableVoices.find(v => 
            v.name.toLowerCase().includes('female') || 
            v.name.toLowerCase().includes('zira') || 
            v.name.toLowerCase().includes('heera') || 
            v.name.toLowerCase().includes('swara') ||
            v.name.toLowerCase().includes('google')
        );
        if (!selectedVoice) {
            selectedVoice = availableVoices[0];
        }

        const utterance = new SpeechSynthesisUtterance(finalText);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
        utterance.lang = targetLang; // Forces browser online TTS to fetch/render correct accent
        utterance.rate = 1.0;
        utterance.pitch = 1.05;

        // Try calling Sarvam AI API backend first
        const callSarvamBackend = async () => {
            try {
                VoiceAssistant.isSpeaking = true;
                // Voice API (Python) runs on port 5000 by default, bypassing Node backend config
                const voiceApiUrl = 'http://127.0.0.1:5000';
                
                // Map local language code to Sarvam mapped string
                const langMap = {
                    'en-IN': 'english',
                    'hi-IN': 'hindi',
                    'te-IN': 'telugu',
                    'ta-IN': 'tamil',
                    'ml-IN': 'malayalam',
                    'kn-IN': 'kannada'
                };
                const sarvamLang = langMap[targetLang] || 'english';

                const response = await fetch(`${voiceApiUrl}/api/voice/tts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: finalText,
                        language: sarvamLang,
                        speaker: "shubh"
                    })
                });

                const result = await response.json();
                console.log("🗣️ [DEBUG] Sarvam API Result:", result);
                
                if (result.success && result.data) {
                    // Try to aggressively find the base64 audio string in the Sarvam response
                    let base64Audio = null;
                    if (result.data.audios && result.data.audios.length > 0) base64Audio = result.data.audios[0];
                    else if (result.data.audio) base64Audio = result.data.audio;
                    else if (result.data.base64) base64Audio = result.data.base64;
                    else if (typeof result.data === 'string') base64Audio = result.data;
                    
                    if (base64Audio) {
                        console.log("🎵 [DEBUG] Found audio data, attempting playback...");
                        
                        // Ensure correct format
                        let audioSrc = base64Audio;
                        if (!base64Audio.startsWith("data:audio")) {
                            audioSrc = "data:audio/wav;base64," + base64Audio; 
                        }
                        
                        const audio = new Audio(audioSrc);
                        audio.onended = () => { VoiceAssistant.isSpeaking = false; };
                        
                        // audio.play() returns a Promise. Catch autoplay blocks.
                        try {
                            await audio.play();
                            return true;
                        } catch (playError) {
                            console.error("❌ [DEBUG] Browser blocked audio playback (autoplay restriction):", playError);
                            return false;
                        }
                    } else {
                        console.warn("⚠️ [DEBUG] Could not find base64 audio in result.data:", result.data);
                    }
                } else {
                    console.error("❌ [DEBUG] Sarvam API returned an error:", result.error || result);
                }
                
                return false;
            } catch (error) {
                console.warn("⚠️ [DEBUG] Sarvam API Unreachable (Is python voice_backend.py running?):", error.message);
                return false;
            }
        };

        // Execute API call, fallback to browser synthesis if it fails
        callSarvamBackend().then(success => {
            if (!success) {
                utterance.onstart = () => { VoiceAssistant.isSpeaking = true; };
                utterance.onend = () => { VoiceAssistant.isSpeaking = false; };
                utterance.onerror = (e) => { 
                    console.warn("Speech synthesis error:", e);
                    VoiceAssistant.isSpeaking = false; 
                };
                window.speechSynthesis.speak(utterance);
            }
        });
    }
};

window.VoiceAssistant = VoiceAssistant;

if (window.speechSynthesis) {
    VoiceAssistant._getVoicesAsync();
}
