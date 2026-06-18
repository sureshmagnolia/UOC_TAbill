import json
import urllib.request
import time
from collections import defaultdict

print("Loading data...")
with open('ta_database.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

with open('hub_map.json', 'r', encoding='utf-8') as f:
    hub_map = json.load(f)

with open('geocodes_osm.json', 'r', encoding='utf-8') as f:
    geocodes = json.load(f)

# Build quick lookup maps
name_to_abbr = {item['Full College Name & Location'].strip(): item['Abbreviation'] for item in db['abbreviations']}
abbr_to_name = {v: k for k, v in name_to_abbr.items()}
abbr_to_geo = {item['abbr']: (item['lon'], item['lat']) for item in geocodes}

# Group colleges by hub
hubs = defaultdict(list)
for c in hub_map:
    name = c['name'].strip()
    station = c['nearest_station']
    if name in name_to_abbr:
        abbr = name_to_abbr[name]
        if abbr in abbr_to_geo:
            hubs[station].append(abbr)

old_nodes = {
    'UOC': 'Parappanangadi',
    'SMT': 'Thrissur',
    'CTR': 'Palakkad',
    'LFC': 'Thrissur',
    'SKG': 'Thrissur',
    'VIC': 'Palakkad',
    'MCY': 'Palakkad',
    'NEM': 'Palakkad',
    'ALA': 'Palakkad',
    'PRK': 'Palakkad',
    'OTP': 'Shornur',
    'PTB': 'Shornur',
    'NAT': 'Thrissur',
    'ASM': 'Thrissur',
    'MKD': 'Palakkad'
}
for abbr, station in old_nodes.items():
    if abbr in abbr_to_geo and abbr not in hubs[station]:
        hubs[station].append(abbr)

success_count = 0

for station, abbrs in hubs.items():
    if len(abbrs) < 2:
        continue
    
    print(f"Processing hub {station} with {len(abbrs)} colleges...")
    
    coords = ";".join([f"{abbr_to_geo[abbr][0]},{abbr_to_geo[abbr][1]}" for abbr in abbrs])
    url = f"http://router.project-osrm.org/table/v1/driving/{coords}?annotations=distance"
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Failed to fetch from OSRM for {station}: {e}")
        continue
        
    if data.get('code') != 'Ok':
        print(f"OSRM returned error for {station}: {data.get('message')}")
        continue
        
    distances = data['distances']
    
    for i in range(len(abbrs)):
        for j in range(len(abbrs)):
            if i == j:
                continue
            
            dist_meters = distances[i][j]
            if dist_meters is None:
                continue
                
            dist_km = round(dist_meters / 1000.0, 1)
            dist_km = max(0.1, dist_km)
            
            from_abbr = abbrs[i]
            to_abbr = abbrs[j]
            from_name = abbr_to_name[from_abbr]
            to_name = abbr_to_name[to_abbr]
            
            leg_name = f"DIR_LEG_{from_abbr}_{to_abbr}"
            db['legs'][leg_name] = {
                "From": from_name,
                "To": to_name,
                "Mode": "Bus",
                "KM": dist_km,
                "Type": "Direct"
            }
            db['routes'][f"{from_abbr}_{to_abbr}"] = [leg_name]
            success_count += 1

    time.sleep(1)

with open('ta_database.json', 'w', encoding='utf-8') as f:
    json.dump(db, f, indent=2)

print(f"\nSuccessfully injected {success_count} direct routes across {len(hubs)} hubs into the database!")
