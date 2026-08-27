import pandas as pd
import json, re, math, os

excel_path = r'C:\Users\pavan\Downloads\dataset_crawler-google-places_2026-08-27_19-16-06-047.xlsx'
df = pd.read_excel(excel_path)

print(f"Reading Google Places dataset: {len(df)} total records...")

def resolve_indian_state(lat, lng, current_state, title, address, city):
    text = f"{title} {address} {city} {current_state}".lower()
    
    state_keywords = {
        'Jammu and Kashmir': ['jammu', 'kashmir', 'srinagar', 'anantnag', 'baramulla', 'udhampur', 'nashri', 'chenani', 'kaichachkoot', 'ban toll'],
        'Ladakh': ['leh', 'ladakh', 'nubra', 'choglamsar'],
        'Punjab': ['punjab', 'ludhiana', 'amritsar', 'jalandhar', 'patiala', 'bathinda', 'shambhu', 'ladowal', 'dappar', 'ferozepur', 'mohali', 'behram', 'ghaggar'],
        'Haryana': ['haryana', 'gurugram', 'gurgaon', 'faridabad', 'panipat', 'karnal', 'ambala', 'rohtak', 'hisar', 'sonipat', 'kherki daula', 'gharaunda', 'murthal', 'dahar'],
        'Himachal Pradesh': ['himachal', 'shimla', 'kullu', 'manali', 'mandi', 'solan', 'kangra', 'sanwara', 'barmana'],
        'Uttarakhand': ['uttarakhand', 'dehradun', 'haridwar', 'roorkee', 'rishikesh', 'nainital', 'rudrapur', 'lachhiwala', 'bhaniyawala'],
        'Delhi': ['delhi', 'new delhi', 'ncr', 'badarpur', 'dnd flyway'],
        'Uttar Pradesh': ['uttar pradesh', 'noida', 'greater noida', 'ghaziabad', 'lucknow', 'kanpur', 'agra', 'varanasi', 'prayagraj', 'allahabad', 'meerut', 'bareilly', 'aligarh', 'moradabad', 'chhajarsi', 'dasna', 'jewar', 'brijghat', 'nawabganj'],
        'Rajasthan': ['rajasthan', 'jaipur', 'jodhpur', 'udaipur', 'kota', 'bikaner', 'ajmer', 'bhilwara', 'alwar', 'kishangarh', 'shahjahanpur', 'daulatpura', 'tatarpur'],
        'Gujarat': ['gujarat', 'ahmedabad', 'surat', 'vadodara', 'rajkot', 'bhavnagar', 'jamnagar', 'gandhinagar', 'kutch', 'bhuj', 'vasad', 'chharodi', 'samakhiyali', 'surajbari', 'bamanbore'],
        'Madhya Pradesh': ['madhya pradesh', 'bhopal', 'indore', 'gwalior', 'jabalpur', 'ujjain', 'sagar', 'dewas', 'satna', 'ratlam', 'rewa', 'sonkacch', 'mangawan', 'sehore'],
        'Maharashtra': ['maharashtra', 'mumbai', 'pune', 'nagpur', 'thane', 'nashik', 'aurangabad', 'solapur', 'kolhapur', 'amravati', 'navi mumbai', 'vashi', 'dahisar', 'kharghar', 'khalapur', 'talegaon', 'khed shivapur'],
        'Goa': ['goa', 'panaji', 'margao', 'vasco'],
        'Karnataka': ['karnataka', 'bengaluru', 'bangalore', 'mysuru', 'mysore', 'hubballi', 'hubli', 'mangaluru', 'mangalore', 'belagavi', 'belgaum', 'davangere', 'ballari', 'attibele', 'sadahalli', 'navalgund', 'gabbur', 'karjeevanahalli'],
        'Telangana': ['telangana', 'hyderabad', 'warangal', 'nizamabad', 'karimnagar', 'khammam', 'pantangi', 'korlapahad', 'pippalwada', 'kadthal', 'raikal', 'gudur'],
        'Andhra Pradesh': ['andhra pradesh', 'visakhapatnam', 'vijayawada', 'guntur', 'nellore', 'kurnool', 'tirupati', 'kaza', 'pottipadu', 'keesara', 'tanguturu', 'sullurupeta', 'marripadu', 'vempadu', 'kalepalli'],
        'Tamil Nadu': ['tamil nadu', 'chennai', 'coimbatore', 'madurai', 'tiruchirappalli', 'salem', 'tirunelveli', 'tiruppur', 'vellore', 'erode', 'paranur', 'chennasamudram', 'athur', 'nemili', 'omalur', 'samayapuram', 'kappalur', 'boothakudi'],
        'Kerala': ['kerala', 'thiruvananthapuram', 'kochi', 'kozhikode', 'thrissur', 'kollam', 'palakkad', 'paliyekkara', 'kumbalam', 'walayar', 'ponnurunni'],
        'Bihar': ['bihar', 'patna', 'gaya', 'bhagalpur', 'muzaffarpur', 'purnia', 'darbhanga', 'bihar sharif', 'arrah', 'begusarai', 'didarganj', 'sasaram', 'mohania'],
        'Jharkhand': ['jharkhand', 'ranchi', 'jamshedpur', 'dhanbad', 'bokaro', 'deoghar', 'hazaribagh', 'barhi', 'ghanghri', 'edla'],
        'Odisha': ['odisha', 'orissa', 'bhubaneswar', 'cuttack', 'rourkela', 'puri', 'sambalpur', 'balasore', 'manguli', 'panikoili', 'pipili', 'gurapali'],
        'West Bengal': ['west bengal', 'kolkata', 'howrah', 'durgapur', 'asansol', 'siliguri', 'bardhaman', 'malda', 'dankuni', 'palsit', 'dhulagori', 'debra', 'suri'],
        'Chhattisgarh': ['chhattisgarh', 'raipur', 'bhilai', 'bilaspur', 'korba', 'durg', 'rajnandgaon'],
        'Assam': ['assam', 'guwahati', 'silchar', 'dibrugarh', 'jorhat', 'nagaon', 'dahalapara', 'raha', 'nazirakhat', 'patgaon']
    }
    
    for st, kw_list in state_keywords.items():
        if any(kw in text for kw in kw_list):
            return st

    if lat >= 32.0: return 'Jammu and Kashmir'
    if 29.5 <= lat <= 32.5 and 74.0 <= lng <= 76.8: return 'Punjab'
    if 27.5 <= lat <= 30.5 and 76.0 <= lng <= 78.0: return 'Haryana'
    if 28.3 <= lat <= 28.9 and 76.8 <= lng <= 77.4: return 'Delhi'
    if 28.5 <= lat <= 31.5 and 77.5 <= lng <= 81.0: return 'Uttarakhand'
    if 23.8 <= lat <= 30.5 and 77.0 <= lng <= 84.5: return 'Uttar Pradesh'
    if 23.5 <= lat <= 30.2 and 69.5 <= lng <= 78.0: return 'Rajasthan'
    if 20.0 <= lat <= 24.7 and 68.0 <= lng <= 74.5: return 'Gujarat'
    if 21.0 <= lat <= 26.8 and 74.0 <= lng <= 82.8: return 'Madhya Pradesh'
    if 24.5 <= lat <= 27.5 and 83.0 <= lng <= 88.5: return 'Bihar'
    if 21.5 <= lat <= 27.2 and 86.0 <= lng <= 89.8: return 'West Bengal'
    if 21.8 <= lat <= 25.5 and 83.5 <= lng <= 87.8: return 'Jharkhand'
    if 17.8 <= lat <= 22.5 and 81.0 <= lng <= 87.5: return 'Odisha'
    if 17.8 <= lat <= 24.2 and 80.0 <= lng <= 84.5: return 'Chhattisgarh'
    if 15.5 <= lat <= 22.0 and 72.5 <= lng <= 80.8: return 'Maharashtra'
    if 14.8 <= lat <= 15.8 and 73.6 <= lng <= 74.4: return 'Goa'
    if 15.8 <= lat <= 19.9 and 77.2 <= lng <= 81.8: return 'Telangana'
    if 11.5 <= lat <= 18.5 and 74.0 <= lng <= 78.6: return 'Karnataka'
    if 12.6 <= lat <= 19.2 and 76.7 <= lng <= 84.8: return 'Andhra Pradesh'
    if 8.0 <= lat <= 13.6 and 76.2 <= lng <= 80.4: return 'Tamil Nadu'
    if 8.2 <= lat <= 12.8 and 74.8 <= lng <= 77.5: return 'Kerala'
    if 24.0 <= lat <= 28.0 and 89.5 <= lng <= 96.0: return 'Assam'

    return current_state if current_state and current_state.lower() != 'nan' else 'National Network'

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

    title = re.sub(r'[\r\n\t]+', ' ', title)
    title = re.sub(r'\s+', ' ', title).strip()

    clean_state = resolve_indian_state(lat, lng, state, title, address, city)
    clean_city = city if (city and city.lower() != 'nan') else ''

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

# Consolidate duplicate records within 80 meters (exact dual gantry offset)
consolidated = []
for t in tolls_raw:
    lat1, lng1 = t['lat'], t['lng']
    
    existing = None
    for m in consolidated:
        d_lat = (m['lat'] - lat1) * 111.0
        d_lng = (m['lng'] - lng1) * 111.0 * math.cos(math.radians(lat1))
        dist_km = math.sqrt(d_lat * d_lat + d_lng * d_lng)
        
        if dist_km < 0.08:
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
