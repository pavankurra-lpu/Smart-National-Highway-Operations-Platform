import os
import json
import base64
import requests

API_URL = "https://api.sarvam.ai/text-to-speech"
API_KEY = os.getenv("SARVAM_API_KEY", "")

texts = {
    'en-IN': {
        'journey': 'Starting live journey...',
        'payment': 'Toll payment successful!'
    },
    'hi-IN': {
        'journey': 'लाइव यात्रा शुरू हो रही है...',
        'payment': 'टोल भुगतान सफल रहा!'
    },
    'te-IN': {
        'journey': 'లైవ్ ప్రయాణం ప్రారంభమవుతోంది...',
        'payment': 'టోల్ చెల్లింపు విజయవంతమైంది!'
    },
    'ta-IN': {
        'journey': 'நேரடி பயணம் தொடங்குகிறது...',
        'payment': 'சுங்கக் கட்டணம் செலுத்தப்பட்டது!'
    },
    'kn-IN': {
        'journey': 'ಲೈವ್ ಪ್ರಯಾಣ ಪ್ರಾರಂಭವಾಗುತ್ತಿದೆ...',
        'payment': 'ಟೋಲ್ ಪಾವತಿ ಯಶಸ್ವಿಯಾಗಿದೆ!'
    },
    'ml-IN': {
        'journey': 'യാത്ര ആരംഭിക്കുന്നു...',
        'payment': 'ടോൾ പേയ്മെന്റ് വിജയകരമായി!'
    }
}

def generate_speech(text, lang_code, output_filename):
    if not API_KEY:
        print("SARVAM_API_KEY environment variable is not set.")
        return

    headers = {
        "api-subscription-key": API_KEY,
        "Content-Type": "application/json"
    }
    
    payload = {
        "text": text,
        "language_code": lang_code,
        "speaker": "meera",
        "pace": 1.0,
        "pitch": 0
    }
    
    try:
        response = requests.post(API_URL, json=payload, headers=headers)
        if response.status_code == 200:
            data = response.json()
            if "audios" in data and len(data["audios"]) > 0:
                audio_bytes = base64.b64decode(data["audios"][0])
                with open(output_filename, "wb") as f:
                    f.write(audio_bytes)
                print(f"Saved {output_filename}")
            else:
                print(f"No audio in response: {data}")
        else:
            print(f"Error {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    os.makedirs("audio_output", exist_ok=True)
    for lang_code, phrases in texts.items():
        generate_speech(phrases['journey'], lang_code, f"audio_output/start_ride_{lang_code}.wav")
        generate_speech(phrases['payment'], lang_code, f"audio_output/wallet_payment_{lang_code}.wav")
