import os
import json

WORKSPACE = r"C:\Users\sures\.gemini\antigravity-ide\scratch\UOC_TAbill"
LEGS_PATH = os.path.join(WORKSPACE, "legs.json")
ROUTES_DIR = os.path.join(WORKSPACE, "routes")
ASSETS_ROUTES_DIR = os.path.join(WORKSPACE, "app", "src", "main", "assets", "routes")

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
    # We want both onward (First_Mile) and return (Last_Mile) connections
    college_first_mile = {}  # college_idx -> leg_id
    college_last_mile = {}   # college_idx -> leg_id
    college_rly_station = {} # college_idx -> rly_station_idx
    
    for lid, arr in db['legs'].items():
        f_idx, t_idx, mode_idx, km, type_idx = arr[0], arr[1], arr[2], arr[3], arr[4]
        ltype = db['types'][type_idx]
        
        if ltype in ["First_Mile", "Last_Mile"]:
            f_name = db['stations'][f_idx].lower()
            t_name = db['stations'][t_idx].lower()
            
            f_is_rly = any(w in f_name for w in ["railway", "rly", "stn", "station"]) and "college" not in f_name
            t_is_rly = any(w in t_name for w in ["railway", "rly", "stn", "station"]) and "college" not in t_name
            
            if f_is_rly and not t_is_rly:
                # rly -> college (Last_Mile)
                college_last_mile[t_idx] = lid
                college_rly_station[t_idx] = f_idx
            elif t_is_rly and not f_is_rly:
                # college -> rly (First_Mile)
                college_first_mile[f_idx] = lid
                college_rly_station[f_idx] = t_idx
                
    # Find all train legs
    train_legs = {} # (from_rly_idx, to_rly_idx) -> leg_id
    for lid, arr in db['legs'].items():
        f_idx, t_idx, mode_idx = arr[0], arr[1], arr[2]
        if db['modes'][mode_idx] == "Train":
            train_legs[(f_idx, t_idx)] = lid
            train_legs[(t_idx, f_idx)] = lid
            
    # Scan and patch routes
    files = [f for f in os.listdir(ROUTES_DIR) if f.endswith('.json')]
    total_patched = 0
    
    for file in files:
        filepath = os.path.join(ROUTES_DIR, file)
        with open(filepath, 'r', encoding='utf-8') as f:
            routes_data = json.load(f)
            
        file_modified = False
        
        for rkey, legs in list(routes_data.items()):
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
            from_rly = college_rly_station.get(from_idx)
            to_rly = college_rly_station.get(to_idx)
            
            if from_rly is not None and to_rly is not None and from_rly != to_rly:
                # Check distance
                total_km = sum(db['legs'][lid][3] for lid in legs if lid in db['legs'])
                if total_km >= 50.0:
                    # Check if a train connection exists between their stations
                    train_leg = train_legs.get((from_rly, to_rly))
                    if train_leg:
                        # Find the correct onward/return legs
                        # Onward: from_college -> from_rly (First_Mile), to_rly -> to_college (Last_Mile)
                        first_leg = college_first_mile.get(from_idx) or college_last_mile.get(from_idx)
                        last_leg = college_last_mile.get(to_idx) or college_first_mile.get(to_idx)
                        
                        if first_leg and last_leg:
                            new_legs = [first_leg, train_leg, last_leg]
                            routes_data[rkey] = new_legs
                            file_modified = True
                            total_patched += 1
                            print(f"Patched: {rkey} -> {new_legs}")
                            
        if file_modified:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(routes_data, f, separators=(',', ':'))
            assets_filepath = os.path.join(ASSETS_ROUTES_DIR, file)
            with open(assets_filepath, 'w', encoding='utf-8') as f:
                json.dump(routes_data, f, separators=(',', ':'))

    print(f"\nSuccessfully patched {total_patched} missing train routes in the database.")

if __name__ == '__main__':
    main()
