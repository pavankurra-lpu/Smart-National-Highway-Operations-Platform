import xml.etree.ElementTree as ET
import json
import os

kml_file = r"C:\Users\pavan\Downloads\51bfe407-c1fe-4282-a86a-e0f8667cc106.kml"
output_file = r"c:\Users\pavan\OneDrive\Desktop\highway(DSA)\js\shared\tollSeedData.js"

tree = ET.parse(kml_file)
root = tree.getroot()

namespace = {'kml': 'http://www.opengis.net/kml/2.2'}

js_out = "// All-India Toll Plazas (parsed from NHAI list)\n\n"
js_out += "const TollSeedData = [\n"

for i, placemark in enumerate(root.findall('.//kml:Placemark', namespace)):
    schema_data = placemark.find('.//kml:SchemaData', namespace)
    if schema_data is None:
        continue
    
    data = {}
    for simple_data in schema_data.findall('kml:SimpleData', namespace):
        name = simple_data.attrib.get('name')
        value = simple_data.text
        data[name] = value
        
    point = placemark.find('.//kml:Point/kml:coordinates', namespace)
    if point is not None and point.text:
        coords = point.text.strip().split(',')
        lng = float(coords[0])
        lat = float(coords[1])
    else:
        lat = float(data.get('lat', 17.0))
        lng = float(data.get('long', 78.0))
        
    def safe_rate(val):
        try:
            return float(val) if val and val != 'NA' else 0
        except ValueError:
            return 0
            
    rates = {
        'LMV': safe_rate(data.get('carjeepvan_sj')),
        'LCV': safe_rate(data.get('lcv_sj')),
        'BUS_2AXLE': safe_rate(data.get('bustruck_sj')),
        'COM_3AXLE': safe_rate(data.get('threeaxle_sj')),
        'MAV_4_6': safe_rate(data.get('foursixaxle_sj')),
        'OVERSIZED': safe_rate(data.get('oversized_sj'))
    }
    
    # Clean strings
    name = str(data.get('plaza_name', 'Unknown')).replace('"', '\\"').replace('\n', ' ')
    state = str(data.get('state', 'Unknown')).replace('"', '\\"').replace('\n', ' ')
    plaza_type = str(data.get('plaza_sub_type', 'National')).replace('"', '\\"').replace('\n', ' ')
    type_code = str(data.get('concessionaire_type', 'Unknown')).replace('"', '\\"').replace('\n', ' ')
    conc = str(data.get('concessionaire_name', 'Unknown')).replace('"', '\\"').replace('\n', ' ')
    nh = str(data.get('nh_no', 'Unknown')).replace('"', '\\"').replace('\n', ' ')
    
    rates_json = json.dumps(rates)
    
    js_out += f"""    {{
        id: "TP_{i}",
        name: "{name}",
        state: "{state}",
        plazaType: "{plaza_type}",
        type: "{type_code}",
        concessionaire: "{conc}",
        nhCorridor: "{nh}",
        lat: {lat},
        lng: {lng},
        baseRate: {rates['LMV'] if rates['LMV'] else 50},
        tollRatesByVehicleClass: {rates_json},
        status: "ACTIVE"
    }},\n"""

js_out += "];\n\nwindow.TollSeedData = TollSeedData;\n"

with open(output_file, 'w', encoding='utf-8') as f:
    f.write(js_out)

print(f"Successfully processed KML and wrote to {output_file}")
