import json

with open("tolls.json", "r", encoding="utf-8") as f:
    tolls = json.load(f)

# Central coords for states
stateCenters = {
    "Uttar Pradesh": [26.8467, 80.9462],
    "Rajasthan": [27.0238, 74.2179],
    "Gujarat": [22.2587, 71.1924],
    "Madhya Pradesh": [22.9734, 78.6569],
    "Tamil Nadu": [11.1271, 78.6569],
    "Andhra Pradesh": [15.9129, 79.7400],
    "Bihar": [25.0961, 85.3131],
    "Punjab": [31.1471, 75.3412],
    "Haryana": [29.0588, 76.0856],
    "Karnataka": [15.3173, 75.7139],
    "Maharashtra": [19.7515, 75.7139],
    "Telangana": [18.1124, 79.0193],
    "West Bengal": [22.9868, 87.8550],
    "Odisha": [20.9517, 85.0985],
    "Kerala": [10.8505, 76.2711],
    "Assam": [26.2006, 92.9376],
    "Jharkhand": [23.6102, 85.2799],
    "Chhattisgarh": [21.2787, 81.8661],
    "Uttarakhand": [30.0668, 79.0193],
    "Himachal Pradesh": [31.1048, 77.1734],
    "Jammu and Kashmir": [33.7782, 76.5762],
    "Goa": [15.2993, 74.1240],
    "Delhi": [28.7041, 77.1025]
}

def generate_pseudo_coord(seedStr, baseLat, baseLng, range_val=3):
    import math
    h = 0
    for c in seedStr:
        h = ord(c) + ((h << 5) - h)
    offsetLat = ((math.sin(h) * 10000) % range_val) - (range_val/2)
    offsetLng = ((math.cos(h) * 10000) % range_val) - (range_val/2)
    return [baseLat + offsetLat, baseLng + offsetLng]

js_out = "// All-India Toll Plazas (parsed from NHAI list)\n\n"
js_out += "const TollSeedData = [\n"

for t in tolls:
    st = t["state"].strip()
    center = stateCenters.get(st, [20.5937, 78.9629])
    
    coord = generate_pseudo_coord(t["name"]+t["state"], center[0], center[1])
    
    js_out += f"""    {{
        id: "{t['id']}",
        name: "{t['name']}",
        state: "{t['state']}",
        plazaType: "{t['plazaType']}",
        type: "{t['type']}",
        concessionaire: "{t['concessionaire']}",
        nhCorridor: "Inferred Corridor",
        lat: {round(coord[0], 4)},
        lng: {round(coord[1], 4)},
        baseRate: 50,
        status: "ACTIVE"
    }},\n"""

js_out += "];\n\nwindow.TollSeedData = TollSeedData;\n"

with open(r"c:\Users\pavan\OneDrive\Desktop\highway(DSA)\js\shared\tollSeedData.js", "w", encoding="utf-8") as f:
    f.write(js_out)
print("Updated js/shared/tollSeedData.js")
