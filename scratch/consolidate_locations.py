import re
import os
import json

base_path = r'c:\Users\pavan\OneDrive\Desktop\highway(DSA)'
toll_route_js = os.path.join(base_path, 'js', 'toll-route.js')
toll_seed_js = os.path.join(base_path, 'js', 'shared', 'tollSeedData.js')
india_planner_js = os.path.join(base_path, 'js', 'user', 'indiaMapPlanner.js')

# 1. Extract points from toll-route.js
with open(toll_route_js, 'r', encoding='utf-8') as f:
    tr_data = f.read()
tr_points = set(re.findall(r'\"startPoint\":\s*\"([^\"]+)\"', tr_data) + re.findall(r'\"endPoint\":\s*\"([^\"]+)\"', tr_data))
print(f"Found {len(tr_points)} points in toll-route.js")

# 2. Extract toll plazas from tollSeedData.js
with open(toll_seed_js, 'r', encoding='utf-8') as f:
    ts_data = f.read()

# Using regex to find toll plaza data
# { id: "...", name: "...", state: "...", ..., lat: ..., lng: ... }
plazas = []
# Match blocks of objects
# This is a bit tricky due to format, but let's try to find name, state, lat, lng
matches = re.finditer(r'name:\s*\"([^\"]+)\",\s*state:\s*\"([^\"]+)\",.*?lat:\s*([0-9\.-]+),\s*lng:\s*([0-9\.-]+)', ts_data, re.DOTALL)
for m in matches:
    plazas.append({
        'name': m.group(1),
        'state': m.group(2),
        'lat': float(m.group(3)),
        'lng': float(m.group(4))
    })
print(f"Found {len(plazas)} toll plazas in tollSeedData.js")

# 3. Load existing cities from indiaMapPlanner.js
with open(india_planner_js, 'r', encoding='utf-8') as f:
    planner_content = f.read()

# Match the cities array
array_match = re.search(r'(cities:\s*\[)(.*?)(\],)', planner_content, re.DOTALL)
if not array_match:
    print("Could not find cities array in indiaMapPlanner.js")
    exit(1)

pre = planner_content[:array_match.start(2)]
post = planner_content[array_match.end(2):]
old_cities_text = array_match.group(2)

# Get existing names to avoid duplicates
existing_names = set()
for m in re.finditer(r'name:\s*[\""\']([^\"\"\']+)[\""\']', old_cities_text):
    existing_names.add(m.group(1).lower())

# 4. Add points from toll-route.js (if we had coordinates... but we don't for all of them)
# Actually, many points in toll-route.js are already in IndiaMapPlanner.cities OR they are toll plazas.
# For simplicity, we will skip adding them if we don't have coords, OR we try to find them in the toll plazas.

# 5. Add plazas
new_entries = []
for p in plazas:
    if p['name'].lower() not in existing_names:
        existing_names.add(p['name'].lower())
        new_entries.append(f'        {{name:"{p["name"]}",state:"{p["state"]}",lat:{p["lat"]},lng:{p["lng"]}}}')

# 6. Format and update
if new_entries:
    updated_cities_text = old_cities_text.rstrip()
    if not updated_cities_text.endswith(','):
        updated_cities_text += ','
    updated_cities_text += '\n' + ',\n'.join(new_entries) + '\n    '
    
    new_js = pre + updated_cities_text + post
    with open(india_planner_js, 'w', encoding='utf-8') as f:
        f.write(new_js)
    print(f"Added {len(new_entries)} new locations to indiaMapPlanner.js")
else:
    print("No new locations to add.")
