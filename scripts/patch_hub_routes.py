import os
import json
import re

WORKSPACE = r"C:\Users\sures\.gemini\antigravity-ide\scratch\UOC_TAbill"
LEGS_PATH = os.path.join(WORKSPACE, "legs.json")
ROUTES_DIR = os.path.join(WORKSPACE, "routes")
ASSETS_ROUTES_DIR = os.path.join(WORKSPACE, "app", "src", "main", "assets", "routes")

with open(LEGS_PATH, 'r', encoding='utf-8') as f:
    db = json.load(f)

# Load abbrevs to map Abbr -> Full Name
abbrevs = json.load(open(os.path.join(WORKSPACE, 'ta_abbrevs.json'), encoding='utf-8'))
abbr_map = {}
for item in abbrevs:
    if item.get('Abbreviation'):
        name = item.get('Full College Name & Location') or item.get('Full Name & Location')
        if name:
            abbr_map[item['Abbreviation']] = name
abbr_map['UOC'] = 'University of Calicut (Thenjipalam)'

def normalize(name):
    return re.sub(r'[^a-z0-9]', '', name.lower())

# College to Hub Mapping
college_hub_map = {
    # Kodungallur
    "COLLEGE OF APPLIED SCIENCE(IHRD), KODUNGALLUR": "Irinjalakuda Railway Stn",
    "DR. PALPU MEMORIAL SNDP YOGAM COLLEGE OF EDUCATION, KODUNGALLUR": "Irinjalakuda Railway Stn",
    "HINDI PRACHARA KENDRA COLLEGE OF TEACHER EDUCATION, KODUNGALLUR,THRISSUR": "Irinjalakuda Railway Stn",
    "CENTRE FOR COMPUTER SCIENCE AND INFORMATION TECHNOLOGY. KODUNGALLUR (CCSIT)": "Irinjalakuda Railway Stn",
    "Centre for Computer Science and Information Technology (CCSIT). Kodungallur": "Irinjalakuda Railway Stn",
    # Koratty/Kodakara
    "NAIPUNNYA BUSINESS SCHOOL, KORATTY, THRISSUR": "Chalakudy Railway Station",
    "NAIPUNYA INSTITUTE OF MANAGEMENT AND INFORMATION TECHNOLOGY, PONGAM, KORATTY": "Chalakudy Railway Station",
    "SAHRDAYA COLLEGE OF ADVANCED STUDIES, KODAKARA": "Chalakudy Railway Station",
    # Pazhanji
    "MAR DIONYSIUS COLLEGE, PAZHANJI": "Pattambi Railway Stn",
}

# Build lookups
station_to_idx = {normalize(name): idx for idx, name in enumerate(db['stations'])}

# Map college indices to hub indices
college_idx_to_hub_idx = {}
for c_name, h_name in college_hub_map.items():
    if normalize(c_name) in station_to_idx and normalize(h_name) in station_to_idx:
        c_idx = station_to_idx[normalize(c_name)]
        h_idx = station_to_idx[normalize(h_name)]
        college_idx_to_hub_idx[c_idx] = h_idx

# Find legs connecting colleges to hubs
college_to_hub_leg = {}
hub_train_legs = {}  # hub_idx -> {dest_rly_idx: leg_id}

# Also find all First_Mile / Last_Mile legs for ANY college to its nearest railway station
all_college_to_rly_leg = {}
all_college_to_rly_stn = {}

for lid, arr in db['legs'].items():
    f_idx = arr[0]
    t_idx = arr[1]
    mode = db['modes'][arr[2]]
    km = arr[3]
    ltype = db['types'][arr[4]]
    
    if mode == "Train":
        if f_idx not in hub_train_legs:
            hub_train_legs[f_idx] = {}
        if t_idx not in hub_train_legs:
            hub_train_legs[t_idx] = {}
        hub_train_legs[f_idx][t_idx] = lid
        hub_train_legs[t_idx][f_idx] = lid
        
    elif ltype in ["First_Mile", "Last_Mile"]:
        f_name = db['stations'][f_idx].lower()
        t_name = db['stations'][t_idx].lower()
        
        f_is_rly = any(w in f_name for w in ["railway", "rly", "stn", "station"]) and "college" not in f_name
        t_is_rly = any(w in t_name for w in ["railway", "rly", "stn", "station"]) and "college" not in t_name
        
        if f_is_rly and not t_is_rly:
            all_college_to_rly_leg[t_idx] = lid
            all_college_to_rly_stn[t_idx] = f_idx
            if t_idx in college_idx_to_hub_idx and college_idx_to_hub_idx[t_idx] == f_idx:
                college_to_hub_leg[t_idx] = lid
        elif t_is_rly and not f_is_rly:
            all_college_to_rly_leg[f_idx] = lid
            all_college_to_rly_stn[f_idx] = t_idx
            if f_idx in college_idx_to_hub_idx and college_idx_to_hub_idx[f_idx] == t_idx:
                college_to_hub_leg[f_idx] = lid

print(f"Found connections for {len(college_to_hub_leg)} targeted colleges.")

# Now patch routes
files = [f for f in os.listdir(ROUTES_DIR) if f.endswith('.json')]
total_patched = 0

for file in files:
    filepath = os.path.join(ROUTES_DIR, file)
    with open(filepath, 'r', encoding='utf-8') as f:
        routes_data = json.load(f)
        
    file_modified = False
    
    for rkey, legs in routes_data.items():
        parts = rkey.split('_')
        if len(parts) != 2:
            continue
        from_abbr, to_abbr = parts
        
        # Determine target college and other college
        target_abbr = None
        other_abbr = None
        target_c_idx = None
        
        from_name = abbr_map.get(from_abbr)
        to_name = abbr_map.get(to_abbr)
        
        if from_name and normalize(from_name) in station_to_idx:
            f_idx = station_to_idx[normalize(from_name)]
            if f_idx in college_to_hub_leg:
                target_abbr, other_abbr = from_abbr, to_abbr
                target_c_idx = f_idx
        
        if to_name and normalize(to_name) in station_to_idx:
            t_idx = station_to_idx[normalize(to_name)]
            if t_idx in college_to_hub_leg:
                target_abbr, other_abbr = to_abbr, from_abbr
                target_c_idx = t_idx
                
        if not target_abbr:
            continue
            
        # Calculate distance
        total_km = sum(db['legs'][lid][3] for lid in legs if lid in db['legs'])
        
        if total_km >= 50.0:
            # We want to route it via train!
            other_name = abbr_map.get(other_abbr)
            if not other_name:
                continue
            other_idx = station_to_idx.get(normalize(other_name))
            if other_idx is None:
                continue
                
            dest_rly_idx = all_college_to_rly_stn.get(other_idx)
            if not dest_rly_idx:
                continue
                
            target_hub_idx = college_idx_to_hub_idx[target_c_idx]
            
            # Check if there is a train leg between target_hub and dest_rly
            train_leg = hub_train_legs.get(target_hub_idx, {}).get(dest_rly_idx)
            
            if train_leg:
                c_conn_leg = college_to_hub_leg[target_c_idx]
                dest_conn_leg = all_college_to_rly_leg[other_idx]
                
                # Rebuild route
                if rkey.startswith(target_abbr):
                    new_legs = [c_conn_leg, train_leg, dest_conn_leg]
                else:
                    new_legs = [dest_conn_leg, train_leg, c_conn_leg]
                    
                if routes_data[rkey] != new_legs:
                    routes_data[rkey] = new_legs
                    file_modified = True
                    total_patched += 1

    if file_modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(routes_data, f, separators=(',', ':'))
        assets_filepath = os.path.join(ASSETS_ROUTES_DIR, file)
        with open(assets_filepath, 'w', encoding='utf-8') as f:
            json.dump(routes_data, f, separators=(',', ':'))

print(f"Successfully patched {total_patched} routes for newly mapped colleges.")
