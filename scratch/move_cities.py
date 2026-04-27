import re
import os

base_path = r'c:\Users\pavan\OneDrive\Desktop\highway(DSA)'
shared_js = os.path.join(base_path, 'js', 'shared', 'indiaMapData.js')
planner_js = os.path.join(base_path, 'js', 'user', 'indiaMapPlanner.js')

# 1. Read cities from planner_js
with open(planner_js, 'r', encoding='utf-8') as f:
    planner_content = f.read()

match = re.search(r'(cities:\s*\[)(.*?)(\],)', planner_content, re.DOTALL)
if not match:
    print("Cities not found in planner")
    exit(1)

cities_text = match.group(2).strip()

# 2. Update shared_js
with open(shared_js, 'r', encoding='utf-8') as f:
    shared_content = f.read()

# Add cities to IndiaMapData object
# We want: const IndiaMapData = { nodes: {...}, cities: [...] };
if 'cities: [' not in shared_content:
    new_shared = shared_content.replace('    }\n};', f'    }},\n    cities: [\n{cities_text}\n    ]\n}};')
else:
    # Update existing cities array
    new_shared = re.sub(r'(cities:\s*\[)(.*?)(\],)', f'\\1\n{cities_text}\n    \\3', shared_content, flags=re.DOTALL)

with open(shared_js, 'w', encoding='utf-8') as f:
    f.write(new_shared)

# 3. Update planner_js to use IndiaMapData.cities
new_planner = re.sub(r'cities:\s*\[.*?\],', 'cities: window.IndiaMapData?.cities || [],', planner_content, flags=re.DOTALL)

with open(planner_js, 'w', encoding='utf-8') as f:
    f.write(new_planner)

print("Successfully moved cities to shared indiaMapData.js and updated planner.")
