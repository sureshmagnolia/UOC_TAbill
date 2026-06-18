import json

print("Loading data...")
with open('ta_database.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

with open('hub_map.json', 'r', encoding='utf-8') as f:
    hub_data = json.load(f)

# Step 1: Clean DB of all generated legs and routes
original_legs = {k: v for k, v in db['legs'].items() if not (k.startswith('NEW_LEG_') or k.startswith('X_LEG_') or k.startswith('REV_LEG_') or k.startswith('GEN_LEG_'))}
db['legs'] = original_legs

original_routes = {}
for k, v in db['routes'].items():
    # Only keep routes where all legs are in original_legs
    if all(leg in original_legs for leg in v):
        original_routes[k] = v
db['routes'] = original_routes

print(f"Cleaned DB. Kept {len(original_legs)} original legs and {len(original_routes)} original routes.")

old_nodes = {
    'ALA': {'name': 'SN College, Alathur', 'station': 'Palakkad', 'km': 24.0},
    'ASM': {'name': 'MES Asmabi College, Vemballur/Kodungallur', 'station': 'Thrissur', 'km': 36.0},
    'CTR': {'name': 'Govt. College, Chittur', 'station': 'Palakkad', 'km': 15.0},
    'LFC': {'name': 'Little Flower College, Guruvayur', 'station': 'Thrissur', 'km': 26.0},
    'MCY': {'name': 'Mercy College, Palakkad', 'station': 'Palakkad', 'km': 3.5},
    'MKD': {'name': 'MES Kalladi College, Mannarkkad', 'station': 'Palakkad', 'km': 38.0},
    'NAT': {'name': 'SN College, Nattika', 'station': 'Thrissur', 'km': 24.0},
    'NEM': {'name': 'NSS College, Nemmara', 'station': 'Palakkad', 'km': 28.0},
    'OTP': {'name': 'NSS College, Ottappalam', 'station': 'Shoranur', 'km': 14.0},
    'PRK': {'name': 'NSS College, Parakkulam (Akathethara)', 'station': 'Palakkad', 'km': 6.0},
    'PTB': {'name': 'SNGS College, Pattambi', 'station': 'Shoranur', 'km': 10.0},
    'SKG': {'name': 'Sree Krishna College, Guruvayur', 'station': 'Thrissur', 'km': 26.0},
    'SMT': {'name': 'St. Marys College, Thrissur', 'station': 'Thrissur', 'km': 1.5},
    'UOC': {'name': 'University of Calicut (Thenjipalam)', 'station': 'Parappanangadi', 'km': 12.0},
    'VIC': {'name': 'Govt. Victoria College, Palakkad', 'station': 'Palakkad', 'km': 2.0}
}

train_line = [
    ("Palakkad", 0), ("Shoranur", 45), ("Kuttippuram", 81), 
    ("Tirur", 96), ("Parappanangadi", 112), ("Kozhikode", 137), 
    ("Vadakara", 183), ("Thalassery", 205), ("Kannur", 226) 
]
station_km = {s: km for s, km in train_line}
station_km["Thrissur"] = 78 

def get_train_dist(s1, s2):
    if s1 == s2: return 0
    if s1 == "Thrissur": return 33 + abs(station_km.get(s2, 45) - 45)
    if s2 == "Thrissur": return 33 + abs(station_km.get(s1, 45) - 45)
    return abs(station_km.get(s1, 0) - station_km.get(s2, 0))

node_dict = {}
for item in db['abbreviations']:
    abbr = item['Abbreviation']
    if abbr in old_nodes:
        node_dict[abbr] = old_nodes[abbr]
    else:
        name = item['Full College Name & Location']
        for c in hub_data:
            if c['name'] == name:
                node_dict[abbr] = {'name': name, 'station': c['nearest_station'], 'km': float(c['km_to_station'])}
                break

all_nodes = list(node_dict.keys())
leg_counter = 200000

print(f"Generating full matrix for {len(all_nodes)} nodes...")
for i in range(len(all_nodes)):
    for j in range(i+1, len(all_nodes)):
        a = all_nodes[i]
        b = all_nodes[j]
        
        ca = node_dict[a]
        cb = node_dict[b]
        sa, sb = ca['station'], cb['station']
        train_d = get_train_dist(sa, sb)
        
        # Forward Route A -> B
        route_ab = f"{a}_{b}"
        if route_ab not in db['routes']:
            legs_ab = []
            if train_d > 50:
                l1 = f"GEN_LEG_{leg_counter}"; leg_counter += 1
                l2 = f"GEN_LEG_{leg_counter}"; leg_counter += 1
                l3 = f"GEN_LEG_{leg_counter}"; leg_counter += 1
                sa_name = sa + " Railway Station"
                sb_name = sb + " Railway Station"
                db['legs'][l1] = {"From": ca['name'], "To": sa_name, "Mode": "Bus", "KM": ca['km'], "Type": "First_Mile"}
                db['legs'][l2] = {"From": sa_name, "To": sb_name, "Mode": "Train", "KM": train_d, "Type": "Main_Haul"}
                db['legs'][l3] = {"From": sb_name, "To": cb['name'], "Mode": "Bus", "KM": cb['km'], "Type": "Last_Mile"}
                legs_ab = [l for l in [l1, l2, l3] if db['legs'][l]['KM'] > 0]
            else:
                l1 = f"GEN_LEG_{leg_counter}"; leg_counter += 1
                db['legs'][l1] = {"From": ca['name'], "To": cb['name'], "Mode": "Bus", "KM": round(ca['km'] + train_d + cb['km'], 1), "Type": "Main_Haul"}
                legs_ab = [l1] if db['legs'][l1]['KM'] > 0 else []
            if legs_ab: db['routes'][route_ab] = legs_ab
        
        # Backward Route B -> A
        route_ba = f"{b}_{a}"
        if route_ba not in db['routes']:
            legs_ba = []
            if train_d > 50:
                l1 = f"GEN_LEG_{leg_counter}"; leg_counter += 1
                l2 = f"GEN_LEG_{leg_counter}"; leg_counter += 1
                l3 = f"GEN_LEG_{leg_counter}"; leg_counter += 1
                sa_name = sa + " Railway Station"
                sb_name = sb + " Railway Station"
                db['legs'][l1] = {"From": cb['name'], "To": sb_name, "Mode": "Bus", "KM": cb['km'], "Type": "First_Mile"}
                db['legs'][l2] = {"From": sb_name, "To": sa_name, "Mode": "Train", "KM": train_d, "Type": "Main_Haul"}
                db['legs'][l3] = {"From": sa_name, "To": ca['name'], "Mode": "Bus", "KM": ca['km'], "Type": "Last_Mile"}
                legs_ba = [l for l in [l1, l2, l3] if db['legs'][l]['KM'] > 0]
            else:
                l1 = f"GEN_LEG_{leg_counter}"; leg_counter += 1
                db['legs'][l1] = {"From": cb['name'], "To": ca['name'], "Mode": "Bus", "KM": round(cb['km'] + train_d + ca['km'], 1), "Type": "Main_Haul"}
                legs_ba = [l1] if db['legs'][l1]['KM'] > 0 else []
            if legs_ba: db['routes'][route_ba] = legs_ba

with open('ta_database.json', 'w', encoding='utf-8') as f:
    json.dump(db, f, indent=2)

print(f"Done! DB has {len(db['routes'])} routes and {len(db['legs'])} legs.")
