import json
import urllib.request
import time
from collections import defaultdict
import math

print("Loading data...")
with open('ta_database.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

with open('hub_map.json', 'r', encoding='utf-8') as f:
    hub_map = json.load(f)

with open('geocodes_osm.json', 'r', encoding='utf-8') as f:
    geocodes = json.load(f)

name_to_abbr = {item['Full College Name & Location'].strip(): item['Abbreviation'] for item in db['abbreviations']}
abbr_to_name = {v: k for k, v in name_to_abbr.items()}
abbr_to_geo = {item['abbr']: (item['lon'], item['lat']) for item in geocodes}

hubs = defaultdict(list)
for c in hub_map:
    name = c['name'].strip()
    station = c['nearest_station']
    if name in name_to_abbr:
        abbr = name_to_abbr[name]
        if abbr in abbr_to_geo:
            hubs[station].append(abbr)

old_nodes = {
    'UOC': 'Parappanangadi', 'SMT': 'Thrissur', 'CTR': 'Palakkad',
    'LFC': 'Thrissur', 'SKG': 'Thrissur', 'VIC': 'Palakkad',
    'MCY': 'Palakkad', 'NEM': 'Palakkad', 'ALA': 'Palakkad',
    'PRK': 'Palakkad', 'OTP': 'Shornur', 'PTB': 'Shornur',
    'NAT': 'Thrissur', 'ASM': 'Thrissur', 'MKD': 'Palakkad'
}
for abbr, station in old_nodes.items():
    if abbr in abbr_to_geo and abbr not in hubs[station]:
        hubs[station].append(abbr)

target_hubs = ['Kozhikode', 'Shoranur']
success_count = 0

def fetch_table(src_abbrs, dst_abbrs):
    all_abbrs = src_abbrs + dst_abbrs
    # Build coordinates array
    coords = ";".join([f"{abbr_to_geo[a][0]},{abbr_to_geo[a][1]}" for a in all_abbrs])
    
    # sources are indices 0 to len(src)-1
    sources_idx = ";".join(str(i) for i in range(len(src_abbrs)))
    # destinations are indices len(src) to len(all)-1
    dest_idx = ";".join(str(i) for i in range(len(src_abbrs), len(all_abbrs)))
    
    url = f"http://router.project-osrm.org/table/v1/driving/{coords}?annotations=distance&sources={sources_idx}&destinations={dest_idx}"
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))
            return data.get('distances')
    except Exception as e:
        print(f"Error fetching chunk: {e}")
        return None

for station in target_hubs:
    abbrs = hubs[station]
    if not abbrs: continue
    
    print(f"Processing hub {station} with {len(abbrs)} colleges...")
    
    chunk_size = 45 # ensures src+dst <= 90 < 100 limit
    chunks = [abbrs[i:i + chunk_size] for i in range(0, len(abbrs), chunk_size)]
    
    for i, chunkA in enumerate(chunks):
        for j, chunkB in enumerate(chunks):
            print(f"  Fetching chunk {i} vs {j}...")
            distances = fetch_table(chunkA, chunkB)
            if not distances:
                print("  Failed! Sleeping and retrying...")
                time.sleep(5)
                distances = fetch_table(chunkA, chunkB)
                if not distances:
                    continue
            
            # Map distances to legs
            for src_idx, src_abbr in enumerate(chunkA):
                for dst_idx, dst_abbr in enumerate(chunkB):
                    if src_abbr == dst_abbr:
                        continue
                    
                    dist_meters = distances[src_idx][dst_idx]
                    if dist_meters is None:
                        continue
                        
                    dist_km = max(0.1, round(dist_meters / 1000.0, 1))
                    
                    leg_name = f"DIR_LEG_{src_abbr}_{dst_abbr}"
                    db['legs'][leg_name] = {
                        "From": abbr_to_name[src_abbr],
                        "To": abbr_to_name[dst_abbr],
                        "Mode": "Bus",
                        "KM": dist_km,
                        "Type": "Direct"
                    }
                    db['routes'][f"{src_abbr}_{dst_abbr}"] = [leg_name]
                    success_count += 1
            time.sleep(1)

with open('ta_database.json', 'w', encoding='utf-8') as f:
    json.dump(db, f, indent=2)

print(f"\nSuccessfully injected {success_count} retry routes into the database!")
