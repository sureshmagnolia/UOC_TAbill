import json
import itertools
import os
import random
import string

# Load existing DB
with open('ta_database.json', 'r') as f:
    db = json.load(f)

# Load combined batches
with open('hub_map.json', 'r', encoding='utf-8') as f:
    colleges = json.load(f)

existing_abbrs = set(item['Abbreviation'] for item in db.get('abbreviations', []))
existing_names = set(item['Full College Name & Location'] for item in db.get('abbreviations', []))

new_abbrs = []
def generate_abbr(name):
    words = [w for w in name.split() if w and w[0].isalpha()]
    abbr = "".join([w[0].upper() for w in words[:4]])
    if len(abbr) < 3: abbr += "X" * (3-len(abbr))
    # ensure uniqueness
    while abbr in existing_abbrs:
        abbr = "".join(random.choices(string.ascii_uppercase, k=4))
    existing_abbrs.add(abbr)
    return abbr

processed_new_colleges = {}
for c in colleges:
    if c['name'] in existing_names: continue
    abbr = generate_abbr(c['name'])
    processed_new_colleges[abbr] = {
        "name": c['name'],
        "station": c['nearest_station'],
        "km": float(c['km_to_station'])
    }
    
    db['abbreviations'].append({
        "Abbreviation": abbr,
        "Full College Name & Location": c['name'],
        "Hub Category": "General" 
    })
    existing_names.add(c['name'])

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

uoc_station = "Parappanangadi"
uoc_km = 12.0
processed_new_colleges['UOC'] = {
    "name": "University of Calicut",
    "station": uoc_station,
    "km": uoc_km
}

leg_counter = len(db.get('legs', {})) + 1000
all_nodes = list(processed_new_colleges.keys())

for i in range(len(all_nodes)):
    for j in range(i+1, len(all_nodes)):
        a = all_nodes[i]
        b = all_nodes[j]
        
        ca = processed_new_colleges[a]
        cb = processed_new_colleges[b]
        
        sa, sb = ca['station'], cb['station']
        train_d = get_train_dist(sa, sb)
        
        legs = []
        if train_d > 50:
            leg1_id = f"NEW_LEG_{leg_counter}"; leg_counter += 1
            leg2_id = f"NEW_LEG_{leg_counter}"; leg_counter += 1
            leg3_id = f"NEW_LEG_{leg_counter}"; leg_counter += 1
            
            db['legs'][leg1_id] = {"type": "Bus", "start": ca['name'], "end": sa, "km": ca['km']}
            db['legs'][leg2_id] = {"type": "Train", "start": sa, "end": sb, "km": train_d}
            db['legs'][leg3_id] = {"type": "Bus", "start": sb, "end": cb['name'], "km": cb['km']}
            legs = [leg1_id, leg2_id, leg3_id]
        else:
            total_bus = ca['km'] + train_d + cb['km']
            leg_id = f"NEW_LEG_{leg_counter}"; leg_counter += 1
            db['legs'][leg_id] = {"type": "Bus", "start": ca['name'], "end": cb['name'], "km": round(total_bus, 1)}
            legs = [leg_id]
            
        legs_filtered = []
        for l in legs:
            if db['legs'][l]['km'] > 0:
                legs_filtered.append(l)
        
        if legs_filtered:
            db['routes'][f"{a}_{b}"] = list(legs_filtered)
            db['routes'][f"{b}_{a}"] = list(reversed(legs_filtered))

with open('ta_database.json', 'w') as f:
    json.dump(db, f, indent=2)

print(f"Final Matrix updated! Total abbreviations: {len(db['abbreviations'])}")
print(f"Total routes: {len(db['routes'])}")
print(f"Total legs: {len(db['legs'])}")
