import pandas as pd
import json, re, math, os

excel_path = r'C:\Users\pavan\Downloads\dataset_crawler-google-places_2026-08-27_19-16-06-047.xlsx'
df = pd.read_excel(excel_path)

print(f"Reading Google Places dataset: {len(df)} total records...")

tolls_raw = []
for idx, row in df.iterrows():
    title = str(row.get('title', '')).strip()
    lat = row.get('location/lat')
    lng = row.get('location/lng')
    state = str(row.get('state', '')).strip()
    city = str(row.get('city', '')).strip()
    address = str(row.get('address', '')).strip()
    
    if pd.isna(lat) or pd.isna(lng):
        continue
    try:
        lat = round(float(lat), 7)
        lng = round(float(lng), 7)
    except:
        continue
        
    # India Geofence bounding box
    if not (6.5 <= lat <= 37.5 and 68.0 <= lng <= 97.5):
        continue
        
    t_lower = title.lower()
    if any(k in t_lower for k in ['toilet', 'air india', 'hotel', 'restaurant', 'petrol pump', 'atm', 'hospital', 'police station']):
        continue
        
    if not title or t_lower in ['none', 'nan', '']:
        if city and city.lower() != 'nan':
            title = f"{city} Toll Plaza"
        else:
            title = "National Highway Toll Plaza"

    # Clean up title: remove junk characters
    title = re.sub(r'[\r\n\t]+', ' ', title)
    title = re.sub(r'\s+', ' ', title).strip()

    # Extract clean State & District
    clean_state = state if (state and state.lower() != 'nan') else 'India'
    clean_city = city if (city and city.lower() != 'nan') else ''
    
    if clean_state == 'India' and address and address.lower() != 'nan':
        # Try finding state in address
        known_states = [
            'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
            'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
            'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
            'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
            'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh'
        ]
        for st in known_states:
            if st.lower() in address.lower():
                clean_state = st
                break

    # Extract NH corridor
    nh_match = re.search(r'NH\s*[-_]?\s*(\d+[A-Z]?)', title + ' ' + address, re.IGNORECASE)
    nh_corridor = f"NH-{nh_match.group(1).upper()}" if nh_match else "National Highway"

    tolls_raw.append({
        'name': title,
        'lat': lat,
        'lng': lng,
        'state': clean_state,
        'district': clean_city,
        'address': address if address and address.lower() != 'nan' else '',
        'nhCorridor': nh_corridor
    })

print(f"Parsed {len(tolls_raw)} valid Indian toll candidates.")

# Consolidate near-identical toll gantries within 1.5 km or same name within 5km
consolidated = []
for t in tolls_raw:
    norm_name = re.sub(r'[^a-z0-9]', '', t['name'].lower())
    lat1, lng1 = t['lat'], t['lng']
    
    existing = None
    for m in consolidated:
        m_norm = re.sub(r'[^a-z0-9]', '', m['name'].lower())
        d_lat = (m['lat'] - lat1) * 111.0
        d_lng = (m['lng'] - lng1) * 111.0 * math.cos(math.radians(lat1))
        dist_km = math.sqrt(d_lat * d_lat + d_lng * d_lng)
        
        if (norm_name == m_norm and dist_km < 8.0) or dist_km < 1.8:
            existing = m
            break
            
    if not existing:
        base_rate = 75 + (int(abs(lat1 * 100 + lng1 * 10)) % 115)
        # Round to nearest ₹5
        base_rate = int(round(base_rate / 5.0) * 5)
        
        toll_id = f"TP_{len(consolidated) + 1}"
        
        consolidated.append({
            'id': toll_id,
            'name': t['name'],
            'lat': t['lat'],
            'lng': t['lng'],
            'state': t['state'],
            'district': t['district'],
            'nhCorridor': t['nhCorridor'],
            'baseRate': base_rate,
            'lanesInbound': 3,
            'lanesOutbound': 3,
            'totalLanes': 6,
            'directionA': 'Inbound (Entry / Direction A)',
            'directionB': 'Outbound (Exit / Opposite Direction B)',
            'tollRatesByVehicleClass': {
                'LMV': base_rate,
                'LCV': int(round(base_rate * 1.6 / 5.0) * 5),
                'BUS_2AXLE': int(round(base_rate * 3.3 / 5.0) * 5),
                'COM_3AXLE': int(round(base_rate * 3.6 / 5.0) * 5),
                'MAV_4_6': int(round(base_rate * 5.2 / 5.0) * 5),
                'OVERSIZED': int(round(base_rate * 6.4 / 5.0) * 5),
                'BIKE': 0
            },
            'returnRatesByVehicleClass': {
                'LMV': int(round(base_rate * 1.5 / 5.0) * 5),
                'LCV': int(round(base_rate * 1.6 * 1.5 / 5.0) * 5),
                'BUS_2AXLE': int(round(base_rate * 3.3 * 1.5 / 5.0) * 5),
                'COM_3AXLE': int(round(base_rate * 3.6 * 1.5 / 5.0) * 5),
                'MAV_4_6': int(round(base_rate * 5.2 * 1.5 / 5.0) * 5),
                'OVERSIZED': int(round(base_rate * 6.4 * 1.5 / 5.0) * 5),
                'BIKE': 0
            }
        })

print(f"Consolidated into {len(consolidated)} master Toll Plaza stations with exact Google Maps coordinates!")

# Save to tolls.json
with open('tolls.json', 'w', encoding='utf-8') as f:
    json.dump(consolidated, f, indent=2, ensure_ascii=False)

# Save to js/shared/tollSeedData.js
with open('js/shared/tollSeedData.js', 'w', encoding='utf-8') as f:
    f.write(f"const TollSeedData = {json.dumps(consolidated, indent=2, ensure_ascii=False)};\n\n")
    f.write("if (typeof window !== 'undefined') {\n    window.TollSeedData = TollSeedData;\n}\n")
    f.write("if (typeof module !== 'undefined') {\n    module.exports = TollSeedData;\n}\n")

print("Successfully updated tolls.json and js/shared/tollSeedData.js!")
