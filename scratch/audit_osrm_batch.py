import os
import json
import time
import urllib.request
import urllib.error
import argparse

WORKSPACE = r"C:\Users\sures\.gemini\antigravity-ide\scratch\UOC_TAbill"
LEGS_FILE = os.path.join(WORKSPACE, 'legs.json')
GEO_FILE = os.path.join(WORKSPACE, 'geocodes_osm.json')
ABBREV_FILE = os.path.join(WORKSPACE, 'ta_abbrevs.json')
STATE_FILE = os.path.join(WORKSPACE, 'scratch', 'audit_state.json')

def get_osrm_distance(lon1, lat1, lon2, lat2):
    url = f"http://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false"
    req = urllib.request.Request(url, headers={'User-Agent': 'UOC-TAbill-Audit/1.0'})
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            if data['code'] == 'Ok':
                return data['routes'][0]['distance'] / 1000.0
            return None
    except Exception as e:
        print(f"  [API Error] {e}")
        return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--batch', type=int, default=50)
    args = parser.parse_args()

    # Load data
    with open(LEGS_FILE, 'r', encoding='utf-8') as f:
        legs_data = json.load(f)
    with open(GEO_FILE, 'r', encoding='utf-8-sig') as f:
        geocodes_list = json.load(f)
    with open(ABBREV_FILE, 'r', encoding='utf-8') as f:
        abbrevs_list = json.load(f)

    # Build maps
    geocodes_map = {g['abbr']: g for g in geocodes_list}
    
    # In some cases, station names might be slightly different or hubs might be special
    # But usually ta_abbrevs maps Abbreviation -> Full College Name & Location
    name_to_abbr = {}
    for item in abbrevs_list:
        name_to_abbr[item['Full College Name & Location']] = item['Abbreviation']

    stations = legs_data['stations']
    legs = legs_data['legs']

    # Load state
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r', encoding='utf-8') as f:
            state = json.load(f)
    else:
        state = {'processed_pairs': [], 'anomalies': [], 'verified_ok': 0}

    processed_set = set(state['processed_pairs'])
    
    # Generate unique undirected pairs
    unique_pairs = {}
    for leg_id, info in legs.items():
        from_idx, to_idx, mode_idx, km = info[0], info[1], info[2], info[3]
        from_name = stations[from_idx]
        to_name = stations[to_idx]
        
        pair_key = tuple(sorted([from_name, to_name]))
        if pair_key not in unique_pairs:
            unique_pairs[pair_key] = {
                'from': from_name,
                'to': to_name,
                'db_km': km,
                'leg_id': leg_id
            }

    print(f"Total Unique Undirected Route Pairs in DB: {len(unique_pairs)}")
    print(f"Already Processed: {len(processed_set)}")
    
    pairs_to_process = [k for k in unique_pairs.keys() if f"{k[0]}||{k[1]}" not in processed_set]
    batch_to_run = pairs_to_process[:args.batch]
    
    if not batch_to_run:
        print("Audit Complete! All unique pairs have been processed.")
        return

    print(f"\nStarting audit batch of {len(batch_to_run)} routes via OSRM...")
    
    count = 0
    for pair_key in batch_to_run:
        data = unique_pairs[pair_key]
        from_name, to_name = data['from'], data['to']
        db_km = data['db_km']
        
        abbr_f = name_to_abbr.get(from_name)
        abbr_t = name_to_abbr.get(to_name)
        
        geo_f = geocodes_map.get(abbr_f) if abbr_f else None
        geo_t = geocodes_map.get(abbr_t) if abbr_t else None
        
        # Railway hubs might not be in ta_abbrevs, we could fall back or skip
        if not geo_f or not geo_t:
            print(f"  Skipping {from_name[:20]}... -> {to_name[:20]}... (Missing Geocode/Abbr)")
            state['processed_pairs'].append(f"{pair_key[0]}||{pair_key[1]}")
            continue
            
        lon1, lat1 = geo_f['lon'], geo_f['lat']
        lon2, lat2 = geo_t['lon'], geo_t['lat']
        
        osrm_km = get_osrm_distance(lon1, lat1, lon2, lat2)
        
        if osrm_km is not None:
            diff = abs(osrm_km - db_km)
            # Flag if difference is > 10 KM OR (>5 KM and > 25% difference)
            if diff > 10.0 or (diff > 5.0 and (diff / max(1, db_km)) > 0.25):
                print(f"[ANOMALY] {abbr_f} -> {abbr_t}")
                print(f"   DB: {db_km} KM | OSRM: {osrm_km:.1f} KM | Diff: {diff:.1f} KM")
                state['anomalies'].append({
                    'from_abbr': abbr_f,
                    'to_abbr': abbr_t,
                    'db_km': db_km,
                    'osrm_km': round(osrm_km, 1),
                    'diff': round(diff, 1)
                })
            else:
                state['verified_ok'] += 1
                
        state['processed_pairs'].append(f"{pair_key[0]}||{pair_key[1]}")
        count += 1
        
        if count % 10 == 0:
            with open(STATE_FILE, 'w', encoding='utf-8') as f:
                json.dump(state, f, indent=2)
                
        time.sleep(1.0)
        
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, indent=2)
        
    print(f"\nBatch finished! Processed {count} routes.")
    print(f"Total Anomalies Found So Far: {len(state['anomalies'])}")
    print(f"Total Verified OK So Far: {state['verified_ok']}")

if __name__ == '__main__':
    main()
