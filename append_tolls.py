import json
import re

with open('parsed_tolls.json', 'r', encoding='utf-8') as f:
    new_tolls = json.load(f)

# Format the new tolls as JS objects string
js_str = ''
for t in new_tolls:
    js_str += f'''    {{
        id: "{t['id']}",
        name: "{t['name']}",
        state: "{t['state']}",
        plazaType: "National",
        type: "PF",
        concessionaire: "NHAI",
        nhCorridor: "N/A",
        lat: 0,
        lng: 0,
        baseRate: 50.0,
        tollRatesByVehicleClass: {{"LMV": 50.0, "LCV": 80.0, "BUS_2AXLE": 160.0, "COM_3AXLE": 180.0, "MAV_4_6": 250.0, "OVERSIZED": 300.0}},
        status: "ACTIVE"
    }},
'''

# Remove the trailing comma of the last item to be clean
js_str = js_str.rstrip(',\n')

file_path = r'js\shared\tollSeedData.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace `];` with `, \n` + js_str + `\n];`
content = re.sub(r'\];\s*(window\.TollSeedData = TollSeedData;)?\s*$', r',\n' + js_str.replace('\\', '\\\\') + r'\n];\n\1\n', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Tolls appended successfully.')
