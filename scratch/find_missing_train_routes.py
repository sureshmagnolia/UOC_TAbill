import os
import json
import re

WORKSPACE = r"C:\Users\sures\.gemini\antigravity-ide\scratch\UOC_TAbill"
LEGS_PATH = os.path.join(WORKSPACE, "legs.json")
ROUTES_DIR = os.path.join(WORKSPACE, "routes")

def main():
    # Load data
    with open(LEGS_PATH, 'r', encoding='utf-8') as f:
        db = json.load(f)
    abbrevs = json.load(open(os.path.join(WORKSPACE, 'ta_abbrevs.json'), encoding='utf-8'))
    
    # Map abbreviation to name and index
    abbr_map = {item['Abbreviation']: item['Full College Name & Location'] for item in abbrevs if item.get('Abbreviation')}
    abbr_map['UOC'] = 'University of Calicut (Thenjipalam)'
    
    station_to_idx = {name.lower().strip(): idx for idx, name in enumerate(db['stations'])}
    
    # Find all First/Last Mile connections to railway stations
    college_to_rly_leg = {} # college_idx -> leg_id
    college_to_rly_stn = {} # college_idx -> rly_station_idx
    
    for lid, arr in db['legs'].items():
        f_idx, t_idx, mode_idx, km, type_idx = arr[0], arr[1], arr[2], arr[3], arr[4]
        ltype = db['types'][type_idx]
        
        if ltype in ["First_Mile", "Last_Mile"]:
            f_name = db['stations'][f_idx].lower()
            t_name = db['stations'][t_idx].lower()
            
            f_is_rly = any(w in f_name for w in ["railway", "rly", "stn", "station"]) and "college" not in f_name
            t_is_rly = any(w in t_name for w in ["railway", "rly", "stn", "station"]) and "college" not in t_name
            
            if f_is_rly and not t_is_rly:
                college_to_rly_leg[t_idx] = lid
                college_to_rly_stn[t_idx] = f_idx
            elif t_is_rly and not f_is_rly:
                college_to_rly_leg[f_idx] = lid
                college_to_rly_stn[f_idx] = t_idx
                
    # Find all train legs
    train_legs = {} # (from_rly_idx, to_rly_idx) -> leg_id
    for lid, arr in db['legs'].items():
        f_idx, t_idx, mode_idx = arr[0], arr[1], arr[2]
        if db['modes'][mode_idx] == "Train":
            train_legs[(f_idx, t_idx)] = lid
            train_legs[(t_idx, f_idx)] = lid
            
    # Scan routes
    files = [f for f in os.listdir(ROUTES_DIR) if f.endswith('.json')]
    missing_train_routes = []
    
    for file in files:
        filepath = os.path.join(ROUTES_DIR, file)
        with open(filepath, 'r', encoding='utf-8') as f:
            routes_data = json.load(f)
            
        for rkey, legs in routes_data.items():
            parts = rkey.split('_')
            if len(parts) != 2:
                continue
            from_abbr, to_abbr = parts
            
            # Check if this route is already using train legs
            uses_train = any(db['legs'][lid][2] == 1 for lid in legs if lid in db['legs'])
            if uses_train:
                continue
                
            from_name = abbr_map.get(from_abbr)
            to_name = abbr_map.get(to_abbr)
            
            if not from_name or not to_name:
                continue
                
            from_idx = station_to_idx.get(from_name.lower().strip())
            to_idx = station_to_idx.get(to_name.lower().strip())
            
            if from_idx is None or to_idx is None:
                continue
                
            # Both must connect to a railway station
            from_rly = college_to_rly_stn.get(from_idx)
            to_rly = college_to_rly_stn.get(to_idx)
            
            if from_rly is not None and to_rly is not None and from_rly != to_rly:
                # Check distance
                total_km = sum(db['legs'][lid][3] for lid in legs if lid in db['legs'])
                if total_km >= 50.0:
                    # Check if a train connection exists between their stations
                    train_leg = train_legs.get((from_rly, to_rly))
                    if train_leg:
                        missing_train_routes.append({
                            'route_key': rkey,
                            'from_abbr': from_abbr,
                            'to_abbr': to_abbr,
                            'from_rly': db['stations'][from_rly],
                            'to_rly': db['stations'][to_rly],
                            'current_km': total_km
                        })

    print(f"Total missing train routes found: {len(missing_train_routes)}")
    if missing_train_routes:
        print("\nSamples:")
        for r in missing_train_routes[:15]:
            print(f"- {r['route_key']}: {r['current_km']} KM (should be {r['from_rly']} -> {r['to_rly']} by train)")

if __name__ == '__main__':
    main()
