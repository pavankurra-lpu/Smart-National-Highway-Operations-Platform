import csv
import re

js_file = r'c:\Users\pavan\OneDrive\Desktop\highway(DSA)\js\user\indiaMapPlanner.js'
csv_file = r'c:\Users\pavan\OneDrive\Desktop\highway(DSA)\temp_data\archive2\Indian Cities Database.csv'

with open(js_file, 'r', encoding='utf-8') as f:
    js_content = f.read()

# Match the cities array
match = re.search(r'(cities:\s*\[)(.*?)(\],)', js_content, re.DOTALL)
if not match:
    print('Could not find cities array')
    exit(1)

pre = js_content[:match.start(2)]
post = js_content[match.end(2):]
old_cities_text = match.group(2)

# Extract existing cities
existing_names = set()
for m in re.finditer(r'name:\s*[\""\']([^\"\"\']+)[\""\']', old_cities_text):
    existing_names.add(m.group(1).lower())

new_cities = []
with open(csv_file, 'r', encoding='utf-8') as f:
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

if new_cities:
    updated_cities_text = old_cities_text.rstrip() + ',\n' + ',\n'.join(new_cities) + '\n    '
else:
    updated_cities_text = old_cities_text

new_js = pre + updated_cities_text + post

with open(js_file, 'w', encoding='utf-8') as f:
    f.write(new_js)

print(f'Added {len(new_cities)} cities.')
