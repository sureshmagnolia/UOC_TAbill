import json
import os

WORKSPACE = r"C:\Users\sures\.gemini\antigravity-ide\scratch\UOC_TAbill"
LEGS_PATH = os.path.join(WORKSPACE, "legs.json")

with open(LEGS_PATH, 'r', encoding='utf-8') as f:
    db = json.load(f)

# Find station indices
dims_name = "DIVINE INSTITUTE OF MEDIA SCIENCE(DIMS) CHALAKKUDY"
chal_name = "Chalakudy Railway Station"

if dims_name not in db['stations']:
    print(f"Station {dims_name} not found!")
    exit(1)

dims_idx = db['stations'].index(dims_name)
chal_idx = db['stations'].index(chal_name)

# Modes and Types
# Mode: Auto (index 1), Type: Last_Mile (index 3) - let's check what type 3 is
mode_auto = db['modes'].index("Auto")
type_last_mile = db['types'].index("Last_Mile")

# Check if leg exists
leg_exists = False
for lid, arr in db['legs'].items():
    if (arr[0] == chal_idx and arr[1] == dims_idx) or (arr[0] == dims_idx and arr[1] == chal_idx):
        leg_exists = True
        print(f"Leg already exists: {lid} {arr}")
        break

if not leg_exists:
    # Find max leg id
    max_id = 0
    for lid in db['legs'].keys():
        num = int(lid.split('_')[1])
        if num > max_id:
            max_id = num
    
    new_lid = f"LEG_{max_id + 1}"
    # arr: [from_idx, to_idx, mode_idx, km, type_idx]
    # In symmetric approach, from RLY to College is Last_Mile
    new_leg = [chal_idx, dims_idx, mode_auto, 2.0, type_last_mile]
    db['legs'][new_lid] = new_leg
    print(f"Added new leg: {new_lid} {new_leg}")
    
    with open(LEGS_PATH, 'w', encoding='utf-8') as f:
        json.dump(db, f, separators=(',', ':'))
    print("Saved legs.json")
