import csv
import re
import os

js_file = r'c:\Users\pavan\OneDrive\Desktop\highway(DSA)\js\shared\indiaMapData.js'
csv_cities = r'c:\Users\pavan\OneDrive\Desktop\highway(DSA)\temp_data\archive2\Indian Cities Database.csv'
csv_villages = r'c:\Users\pavan\OneDrive\Desktop\highway(DSA)\temp_data\villages.csv'

with open(js_file, 'r', encoding='utf-8') as f:
    js_content = f.read()

# Match the cities array (handle optional comma after closing bracket)
match = re.search(r'(cities:\s*\[)(.*?)(\]\s*[;,]?)', js_content, re.DOTALL)
if not match:
    print('Could not find cities array in indiaMapData.js')
    exit(1)

pre = js_content[:match.start(2)]
post = js_content[match.end(2):]
old_cities_text = match.group(2)

# Extract existing cities
existing_names = set()
for m in re.finditer(r'name:\s*[\"\']([^\"\']+)[\"\']', old_cities_text):
    existing_names.add(m.group(1).lower())

new_cities = []

# 1. Add Cities from Archive 2
if os.path.exists(csv_cities):
    with open(csv_cities, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader) # skip header
        for row in reader:
            if len(row) < 6: continue
            name = row[0].strip()
            lat = row[1].strip()
            lng = row[2].strip()
            state = row[5].strip()
            if not lat or not lng: continue
            
            if name.lower() not in existing_names:
                existing_names.add(name.lower())
                new_cities.append(f'        {{name:"{name}",state:"{state}",lat:{lat},lng:{lng}}}')

# 2. Add Villages (Top 1000 for performance)
# Since we don't have lat/lng for villages, we'll mark them for geocoding
if os.path.exists(csv_villages):
    with open(csv_villages, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader) # skip header
        count = 0
        for row in reader:
            if count >= 1000: break
            name = row[0].strip()
            if name.lower() not in existing_names:
                existing_names.add(name.lower())
                # Assign 0,0 - the UI will handle this by geocoding on select
                new_cities.append(f'        {{name:"{name}",state:"Village",lat:0,lng:0,isVillage:true}}')
                count += 1

if new_cities:
    updated_cities_text = old_cities_text.rstrip()
    if not updated_cities_text.endswith(','):
        updated_cities_text += ','
    updated_cities_text += '\n' + ',\n'.join(new_cities) + '\n    '
else:
    updated_cities_text = old_cities_text

new_js = pre + updated_cities_text + post

with open(js_file, 'w', encoding='utf-8') as f:
    f.write(new_js)

print(f'Added {len(new_cities)} locations to indiaMapData.js.')
