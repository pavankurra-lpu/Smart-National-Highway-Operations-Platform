import pandas as pd
import json
import re
import os

excel_path = r'C:\Users\pavan\Downloads\dataset_crawler-google-places_2026-08-27_19-16-06-047.xlsx'
df = pd.read_excel(excel_path)

def is_valid_toll(row):
    title = str(row.get('title', '')).lower()
    cat = str(row.get('categoryName', '')).lower()
    
    exclude_keywords = [
        'hardware', 'astrologer', 'clothes', 'shoe', 'mobile phone repair',
        'tire shop', 'used tire', 'grocery', 'mosque', 'domestic abuse',
        'apartment', 'housing complex', 'housing society', 'education center',
        'cell phone accessory', 'electronics store'
    ]
    if any(k in title or k in cat for k in exclude_keywords):
        return False
        
    toll_keywords = [
        'toll', 'plaza', 'booth', 'naka', 'fastag', 'check post',
        'barrier', 'tax point', 'tax gate', 'tollway', 'tollgate',
        'tollroad', 'toll road', 'expressway'
    ]
    has_toll_word = any(k in title for k in toll_keywords)
    is_toll_cat = cat in ['toll station', 'toll road rest stop', 'highway patrol', 'weigh station']
    
    return is_toll_cat or has_toll_word

valid_df = df[df.apply(is_valid_toll, axis=1)].copy()

def clean_state(row):
    st = row.get('state')
    if pd.notna(st) and str(st).strip() and str(st).strip().lower() != 'nan':
        return str(st).strip()
    addr = str(row.get('address', '')).lower()
    title = str(row.get('title', '')).lower()
    combined = addr + ' ' + title
    
    if any(w in combined for w in ['kashmir', 'jammu', 'chenani', 'nashri', 'jawahar']):
        return 'Jammu and Kashmir'
    if any(w in combined for w in ['ladakh', 'nubra']):
        return 'Ladakh'
    if 'madhya pradesh' in combined:
        return 'Madhya Pradesh'
    if 'rajasthan' in combined:
        return 'Rajasthan'
    if 'gujarat' in combined:
        return 'Gujarat'
    if 'maharashtra' in combined:
        return 'Maharashtra'
    if 'karnataka' in combined:
        return 'Karnataka'
    if 'tamil nadu' in combined:
        return 'Tamil Nadu'
    if 'uttar pradesh' in combined:
        return 'Uttar Pradesh'
    if 'haryana' in combined:
        return 'Haryana'
    if 'punjab' in combined:
        return 'Punjab'
    return 'National Highway Network'

def extract_nh_corridor(row):
    addr = str(row.get('address', ''))
    title = str(row.get('title', ''))
    search_str = str(row.get('searchString', ''))
    combined = title + ' ' + addr + ' ' + search_str
    
    m = re.search(r'\b(NE[- ]?\d+|NH[- ]?\d+[A-Za-z]?|SH[- ]?\d+[A-Za-z]?|Expressway|E-way)\b', combined, re.IGNORECASE)
    if m:
        val = m.group(1).upper()
        val = re.sub(r'\s+', '-', val)
        return val
    return 'National Corridor'

toll_records = []
for idx, (_, row) in enumerate(valid_df.iterrows()):
    title = str(row.get('title', f'Toll Plaza {idx+1}')).strip()
    state = clean_state(row)
    city = str(row.get('city', '')).strip() if pd.notna(row.get('city')) else ''
    address = str(row.get('address', '')).strip() if pd.notna(row.get('address')) else ''
    lat = round(float(row.get('location/lat', 20.5937)), 7)
    lng = round(float(row.get('location/lng', 78.9629)), 7)
    
    nh_corridor = extract_nh_corridor(row)
    url = str(row.get('url', '')) if pd.notna(row.get('url')) else ''
    place_id = str(row.get('placeId', '')) if pd.notna(row.get('placeId')) else ''
    
    base_rate = 55 + ((idx * 17 + int(abs(lat * 100))) % 23) * 5
    
    record = {
        'id': f'TP_{idx}',
        'name': title,
        'state': state,
        'city': city,
        'address': address,
        'lat': lat,
        'lng': lng,
        'nhCorridor': nh_corridor,
        'plazaType': 'National',
        'type': 'BOT (Toll)' if idx % 3 == 0 else 'Public Funded',
        'concessionaire': 'NHAI / Authorized Operator',
        'baseRate': base_rate,
        'tollRatesByVehicleClass': {
            'LMV': base_rate,
            'LCV': round(base_rate * 1.6),
            'BUS_2AXLE': round(base_rate * 3.4),
            'COM_3AXLE': round(base_rate * 3.7),
            'MAV_4_6': round(base_rate * 5.3),
            'OVERSIZED': round(base_rate * 6.5)
        },
        'status': 'ACTIVE',
        'returnRate': round(base_rate * 1.5),
        'returnRatesByVehicleClass': {
            'LMV': round(base_rate * 1.5),
            'LCV': round(base_rate * 1.6 * 1.5),
            'BUS_2AXLE': round(base_rate * 3.4 * 1.5),
            'COM_3AXLE': round(base_rate * 3.7 * 1.5),
            'MAV_4_6': round(base_rate * 5.3 * 1.5),
            'OVERSIZED': round(base_rate * 6.5 * 1.5)
        },
        'monthlyPassLocal': 360,
        'monthlyPassByVehicleClass': {
            'LMV': round(base_rate * 33.5),
            'LCV': round(base_rate * 1.6 * 33.5),
            'BUS_2AXLE': round(base_rate * 3.4 * 33.5),
            'COM_3AXLE': round(base_rate * 3.7 * 33.5),
            'MAV_4_6': round(base_rate * 5.3 * 33.5),
            'OVERSIZED': round(base_rate * 6.5 * 33.5)
        },
        'googleMapsUrl': url,
        'placeId': place_id
    }
    toll_records.append(record)

with open('tolls.json', 'w', encoding='utf-8') as f:
    json.dump(toll_records, f, indent=2, ensure_ascii=False)
print(f'Wrote {len(toll_records)} records to tolls.json')

js_code = f"const TollSeedData = {json.dumps(toll_records, indent=4, ensure_ascii=False)};\n\n"
js_code += "if (typeof window !== 'undefined') {\n    window.TollSeedData = TollSeedData;\n}\n\n"
js_code += "if (typeof module !== 'undefined' && module.exports) {\n    module.exports = TollSeedData;\n}\n"

with open('js/shared/tollSeedData.js', 'w', encoding='utf-8') as f:
    f.write(js_code)
print(f'Wrote {len(toll_records)} records to js/shared/tollSeedData.js')
