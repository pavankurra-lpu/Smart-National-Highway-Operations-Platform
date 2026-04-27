import fitz
import json
import re

doc = fitz.open(r"C:\Users\pavan\Downloads\NHAI-toll-list.pdf")

states = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", 
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", 
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", 
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir"
]
states_lower = [s.lower() for s in states]

all_tolls = []

for page_num in range(len(doc)):
    page = doc.load_page(page_num)
    text = page.get_text()
    lines = [L.strip() for L in text.split('\n') if L.strip()]
    
    i = 0
    while i < len(lines):
        line = lines[i]
        # Match "1 Narayanpura Toll Plaza"
        m = re.match(r'^(\d+)\s+(.+)$', line)
        if m:
            sno = m.group(1)
            name = m.group(2).strip()
            
            i += 1
            if i >= len(lines): break
            plaza_type = lines[i]
            
            i += 1
            if i >= len(lines): break
            pf_type = lines[i]
            
            # Now accumulate concessionaire until we hit a state
            conc = ""
            state = ""
            i += 1
            while i < len(lines):
                potential_state = lines[i]
                if potential_state.lower() in states_lower or "pradesh" in potential_state.lower():
                    state = potential_state
                    break
                else:
                    conc += potential_state + " "
                i += 1
            
            conc = conc.strip()
            if not conc:
                conc = "NHAI"
            
            all_tolls.append({
                "name": name,
                "state": state,
                "plazaType": plaza_type,
                "type": pf_type,
                "concessionaire": conc,
                "nhCorridor": "Unknown",
                "baseRate": 50
            })
        i += 1

all_tolls.sort(key=lambda x: x['state'])
for idx, toll in enumerate(all_tolls):
    toll["id"] = f"TP_{idx}"

with open(r"c:\Users\pavan\OneDrive\Desktop\highway(DSA)\tolls.json", "w", encoding="utf-8") as f:
    json.dump(all_tolls, f, indent=2)

print(f"Extracted {len(all_tolls)} tolls via heuristic text parsing")
