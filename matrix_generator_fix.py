import json
import random
import string

print("Loading data...")
with open('ta_database.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

with open('hub_map.json', 'r', encoding='utf-8') as f:
    hub_data = json.load(f)

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
    ("Palakkad", 0),
    ("Shoranur", 45),
    ("Kuttippuram", 81), 
    ("Tirur", 96), 
    ("Parappanangadi", 112), 
    ("Kozhikode", 137), 
    ("Vadakara", 183), 
    ("Thalassery", 205), 
    ("Kannur", 226) 
]
station_km = {s: km for s, km in train_line}
station_km["Thrissur"] = 78 

def get_train_dist(s1, s2):
    if s1 == s2: return 0
    if s1 == "Thrissur":
        return 33 + abs(station_km.get(s2, 45) - 45)
    if s2 == "Thrissur":
        return 33 + abs(station_km.get(s1, 45) - 45)
    return abs(station_km.get(s1, 0) - station_km.get(s2, 0))

node_dict = {}

# Map old nodes
for item in db['abbreviations']:
    abbr = item['Abbreviation']
    if abbr in old_nodes:
        node_dict[abbr] = old_nodes[abbr]
    else:
        # Match from hub_data
        name = item['Full College Name & Location']
        matched = False
        for c in hub_data:
            if c['name'] == name:
                node_dict[abbr] = {
                    'name': name,
                    'station': c['nearest_station'],
                    'km': float(c['km_to_station'])
                }
                matched = True
                break
        if not matched:
            print(f"WARNING: Could not find station for {abbr} ({name})")

all_nodes = list(node_dict.keys())
leg_counter = len(db.get('legs', {})) + 50000

print("Generating missing cross-matrix...")
for i in range(len(all_nodes)):
    for j in range(i+1, len(all_nodes)):
        a = all_nodes[i]
        b = all_nodes[j]
        
        # Check if route already exists
        route_key = f"{a}_{b}"
        if route_key in db['routes']:
            # Already handled (e.g. old<->old or new<->new)
            continue
            
        ca = node_dict[a]
        cb = node_dict[b]
        
        sa, sb = ca['station'], cb['station']
        train_d = get_train_dist(sa, sb)
        
        legs = []
        if train_d > 50:
            leg1_id = f"X_LEG_{leg_counter}"; leg_counter += 1
            leg2_id = f"X_LEG_{leg_counter}"; leg_counter += 1
            leg3_id = f"X_LEG_{leg_counter}"; leg_counter += 1
            
            db['legs'][leg1_id] = {"From": ca['name'], "To": sa, "Mode": "Bus", "KM": ca['km'], "Type": "First_Mile"}
            db['legs'][leg2_id] = {"From": sa, "To": sb, "Mode": "Train", "KM": train_d, "Type": "Main_Haul"}
            db['legs'][leg3_id] = {"From": sb, "To": cb['name'], "Mode": "Bus", "KM": cb['km'], "Type": "Last_Mile"}
            legs = [leg1_id, leg2_id, leg3_id]
        else:
            total_bus = ca['km'] + train_d + cb['km']
            leg_id = f"X_LEG_{leg_counter}"; leg_counter += 1
            db['legs'][leg_id] = {"From": ca['name'], "To": cb['name'], "Mode": "Bus", "KM": round(total_bus, 1), "Type": "Main_Haul"}
            legs = [leg_id]
            
        legs_filtered = []
        for l in legs:
            if db['legs'][l]['KM'] > 0:
                legs_filtered.append(l)
        
        if legs_filtered:
            db['routes'][f"{a}_{b}"] = list(legs_filtered)
            db['routes'][f"{b}_{a}"] = list(reversed(legs_filtered))

with open('ta_database.json', 'w', encoding='utf-8') as f:
    json.dump(db, f, indent=2)

print("Missing cross-routes fully generated!")
