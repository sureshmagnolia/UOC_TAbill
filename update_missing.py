import json

manual_updates = [
{"abbr": "BVNC", "lat": 10.793741, "lon": 76.602652},
{"abbr": "BRIO", "lat": 11.171432, "lon": 75.871145},
{"abbr": "ECOA", "lat": 11.132584, "lon": 75.958123},
{"abbr": "IMAA", "lat": 10.963451, "lon": 76.071284},
{"abbr": "JWAC", "lat": 11.285872, "lon": 75.889741},
{"abbr": "KMCO", "lat": 11.238412, "lon": 75.986851},
{"abbr": "WPEP", "lat": 10.884528, "lon": 76.040656},
{"abbr": "UKSD", "lat": 10.735412, "lon": 76.102145},
{"abbr": "PCOT", "lat": 11.296488, "lon": 75.805684},
{"abbr": "SMAS", "lat": 10.907849, "lon": 76.017170},
{"abbr": "SODA", "lat": 10.506373, "lon": 76.190107},
{"abbr": "TECE", "lat": 10.602669, "lon": 76.641535},
{"abbr": "GOPO", "lat": 11.577378, "lon": 75.818337}
]

update_dict = {item['abbr']: item for item in manual_updates}

with open('geocodes_osm.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for item in data:
    if item['abbr'] in update_dict:
        item['lat'] = update_dict[item['abbr']]['lat']
        item['lon'] = update_dict[item['abbr']]['lon']

with open('geocodes_osm.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print("Updated geocodes_osm.json with manual coordinates.")
