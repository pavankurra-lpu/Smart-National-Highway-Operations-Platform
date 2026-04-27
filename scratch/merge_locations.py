import csv
import re
import os
import json
import xml.etree.ElementTree as ET

# Paths
BASE_PATH = r'c:\Users\pavan\OneDrive\Desktop\highway(DSA)'
SHARED_DATA_JS = os.path.join(BASE_PATH, 'js', 'shared', 'indiaMapData.js')
TOLL_SEED_JS = os.path.join(BASE_PATH, 'js', 'shared', 'tollSeedData.js')
CITIES_CSV = os.path.join(BASE_PATH, 'temp_data', 'archive2', 'Indian Cities Database.csv')
VILLAGES_XML = os.path.join(BASE_PATH, 'temp_data', 'archive3', 'villages_extracted', 'content.xml')

def parse_cities_csv():
    cities = []
    if not os.path.exists(CITIES_CSV):
        return cities
    with open(CITIES_CSV, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            cities.append({
                'name': row['City'].strip(),
                'state': row['State'].strip(),
                'lat': float(row['Lat']),
                'lng': float(row['Long'])
            })
    return cities

def parse_villages_xml():
    # ODS content.xml parsing is complex, let's use a robust regex/discovery approach if XML structure is nested strongly
    # Usually it's <table:table-row><table:table-cell office:value-type="string"><text:p>VillageName</text:p>...</table:table-cell>
    villages = []
    if not os.path.exists(VILLAGES_XML):
        return villages
    
    try:
        # Since it's a huge content.xml, we'll use iterparse or simple regex for robustness
        # Assuming format: Village, State, Lat, Lng are in sequence
        with open(VILLAGES_XML, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Match cells: <text:p>Value</text:p>
        cells = re.findall(r'<text:p>(.*?)</text:p>', content)
        
        # Heuristic: Find header "Village" and then follow the pattern
        # This is a fallback if the XML structure is complex
        for i in range(len(cells) - 3):
            if cells[i].lower() == 'village' and cells[i+1].lower() == 'state':
                # Start parsing from i + columns_count
                for j in range(i + 4, len(cells), 4):
                    try:
                        name = cells[j]
                        state = cells[j+1]
                        lat = float(cells[j+2])
                        lng = float(cells[j+3])
                        villages.append({'name': name, 'state': state, 'lat': lat, 'lng': lng})
                    except (ValueError, IndexError):
                        continue
                break
    except Exception as e:
        print(f"Error parsing XML: {e}")
        
    return villages

def parse_tolls_js():
    tolls = []
    if not os.path.exists(TOLL_SEED_JS):
        return tolls
    with open(TOLL_SEED_JS, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract names and coordinates
    # { id: "...", name: "...", state: "...", lat: ..., lng: ... }
    matches = re.finditer(r'name:\s*\"(.*?)\",\s*state:\s*\"(.*?)\".*?lat:\s*([\d\.-]+),\s*lng:\s*([\d\.-]+)', content, re.DOTALL)
    for m in matches:
        tolls.append({
            'name': m.group(1),
            'state': m.group(2),
            'lat': float(m.group(3)),
            'lng': float(m.group(4))
        })
    return tolls

def merge():
    print("Parsing sources...")
    cities_data = parse_cities_csv()
    villages_data = parse_villages_xml()
    tolls_data = parse_tolls_js()
    
    print(f"Found: {len(cities_data)} cities, {len(villages_data)} villages, {len(tolls_data)} tolls.")
    
    # Existing data
    existing_data = []
    if os.path.exists(SHARED_DATA_JS):
        with open(SHARED_DATA_JS, 'r', encoding='utf-8') as f:
            content = f.read()
            match = re.search(r'cities:\s*\[(.*?)\]', content, re.DOTALL)
            if match:
                inner = match.group(1)
                existing_matches = re.finditer(r'name:\s*\"(.*?)\",\s*state:\s*\"(.*?)\".*?lat:\s*([\d\.-]+),\s*lng:\s*([\d\.-]+)', inner, re.DOTALL)
                for m in existing_matches:
                    existing_data.append({
                        'name': m.group(1),
                        'state': m.group(2),
                        'lat': float(m.group(3)),
                        'lng': float(m.group(4))
                    })

    # Merge all
    merged = {}
    
    # Helper to add/update
    def add_to_merged(data_list, source_name):
        for item in data_list:
            key = (item['name'].strip().lower(), item['state'].strip().lower())
            if key not in merged:
                merged[key] = item
    
    add_to_merged(existing_data, "Existing")
    add_to_merged(cities_data, "CSV Cities")
    add_to_merged(villages_data, "XML Villages")
    add_to_merged(tolls_data, "JS Tolls")
    
    print(f"Total unique locations after merge: {len(merged)}")
    
    # Sort by name
    sorted_locations = sorted(merged.values(), key=lambda x: x['name'])
    
    # Format output
    js_entries = []
    for loc in sorted_locations:
        # Escape quotes in names
        name = loc['name'].replace('"', '\\"')
        js_entries.append(f'        {{name:"{name}",state:"{loc["state"]}",lat:{loc["lat"]},lng:{loc["lng"]}}}')
    
    # Update SHARED_DATA_JS
    with open(SHARED_DATA_JS, 'r', encoding='utf-8') as f:
        shared_content = f.read()
    
    new_cities_text = ",\n".join(js_entries)
    updated_shared = re.sub(r'(cities:\s*\[)(.*?)(\],)', f'\\1\n{new_cities_text}\n    \\3', shared_content, flags=re.DOTALL)
    
    with open(SHARED_DATA_JS, 'w', encoding='utf-8') as f:
        f.write(updated_shared)
        
    print(f"Successfully updated {SHARED_DATA_JS}")

if __name__ == "__main__":
    merge()
