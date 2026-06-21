import json
import os

WORKSPACE = r"C:\Users\sures\.gemini\antigravity-ide\scratch\UOC_TAbill"
LEGS_PATH = os.path.join(WORKSPACE, "legs.json")

with open(LEGS_PATH, 'r', encoding='utf-8') as f:
    db = json.load(f)

# Hubs
irinjalakuda_hub = db['stations'].index("Irinjalakuda Railway Stn")
chalakudy_hub = db['stations'].index("Chalakudy Railway Station")
pattambi_hub = db['stations'].index("Pattambi Railway Stn")

colleges_to_add = [
    # Kodungallur -> Irinjalakuda
    ("COLLEGE OF APPLIED SCIENCE(IHRD), KODUNGALLUR", irinjalakuda_hub, 16.0),
    ("DR. PALPU MEMORIAL SNDP YOGAM COLLEGE OF EDUCATION, KODUNGALLUR", irinjalakuda_hub, 16.0),
    ("HINDI PRACHARA KENDRA COLLEGE OF TEACHER EDUCATION, KODUNGALLUR,THRISSUR", irinjalakuda_hub, 16.0),
    ("CENTRE FOR COMPUTER SCIENCE AND INFORMATION TECHNOLOGY. KODUNGALLUR (CCSIT)", irinjalakuda_hub, 16.0),
    ("Centre for Computer Science and Information Technology (CCSIT). Kodungallur", irinjalakuda_hub, 16.0),
    # Koratty/Kodakara -> Chalakudy
    ("NAIPUNNYA BUSINESS SCHOOL, KORATTY, THRISSUR", chalakudy_hub, 8.0),
    ("NAIPUNNYA INSTITUTE OF MANAGEMENT AND INFORMATION TECHNOLOGY, PONGAM, KORATTY", chalakudy_hub, 8.0),
    ("SAHRDAYA COLLEGE OF ADVANCED STUDIES, KODAKARA", chalakudy_hub, 8.0),
    # Pazhanji -> Pattambi
    ("MAR DIONYSIUS COLLEGE, PAZHANJI", pattambi_hub, 20.0),
]

mode_taxi = db['modes'].index("Taxi")
type_first_mile = db['types'].index("First_Mile")

max_id = max([int(lid.split('_')[1]) for lid in db['legs'].keys()])

added = 0
for c_name, hub_idx, km in colleges_to_add:
    if c_name not in db['stations']:
        print(f"Skipping {c_name}, not in stations")
        continue
    c_idx = db['stations'].index(c_name)
    
    # Check if exists
    exists = False
    for arr in db['legs'].values():
        if (arr[0] == c_idx and arr[1] == hub_idx) or (arr[0] == hub_idx and arr[1] == c_idx):
            exists = True
            break
            
    if not exists:
        max_id += 1
        new_lid = f"LEG_{max_id}"
        # In symmetric DB, hub is typically from or to, let's use [hub, college] as last_mile or [college, hub] as first_mile.
        # Let's just use [hub, college, mode, km, type]
        db['legs'][new_lid] = [hub_idx, c_idx, mode_taxi, km, type_first_mile]
        added += 1
        print(f"Added {c_name} to hub {db['stations'][hub_idx]} ({km} km)")

if added > 0:
    with open(LEGS_PATH, 'w', encoding='utf-8') as f:
        json.dump(db, f, separators=(',', ':'))
    print(f"Saved {added} new legs to legs.json")
else:
    print("No new legs to add.")
