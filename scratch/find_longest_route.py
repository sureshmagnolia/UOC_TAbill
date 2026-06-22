import os
import json

WORKSPACE = r"C:\Users\sures\.gemini\antigravity-ide\scratch\UOC_TAbill"
ROUTES_DIR = os.path.join(WORKSPACE, "routes")
LEGS_FILE = os.path.join(WORKSPACE, "legs.json")

# Load legs data
with open(LEGS_FILE, "r", encoding="utf-8") as f:
    legs_data = json.load(f)

# The new legs.json is compressed
stations = legs_data["stations"]
legs = legs_data["legs"]

def get_leg_km(leg_id):
    # legs[leg_id] = [from_idx, to_idx, mode_idx, km, type_idx, fare]
    if leg_id in legs:
        return legs[leg_id][3]
    return 0

max_distance = -1
longest_pair = None
longest_route_legs = []

# Iterate over all route files
for route_file in os.listdir(ROUTES_DIR):
    if route_file.endswith(".json"):
        with open(os.path.join(ROUTES_DIR, route_file), "r", encoding="utf-8") as f:
            routes = json.load(f)
            
            for pair, leg_ids in routes.items():
                total_km = sum(get_leg_km(leg_id) for leg_id in leg_ids)
                if total_km > max_distance:
                    max_distance = total_km
                    longest_pair = pair
                    longest_route_legs = leg_ids

print(f"Longest travel pair: {longest_pair}")
print(f"Total Distance: {max_distance} KM")
print(f"Legs involved: {longest_route_legs}")

# If we want to see the actual names:
abbrevs_file = os.path.join(WORKSPACE, "ta_abbrevs.json")
with open(abbrevs_file, "r", encoding="utf-8") as f:
    abbrevs = json.load(f)

abbrev_map = {item["Abbreviation"]: item["Full College Name & Location"] for item in abbrevs}

if longest_pair:
    parts = longest_pair.split('_')
    if len(parts) == 2:
        from_name = abbrev_map.get(parts[0], parts[0])
        to_name = abbrev_map.get(parts[1], parts[1])
        print(f"From: {from_name} ({parts[0]})")
        print(f"To: {to_name} ({parts[1]})")

    print("\nDetailed Route breakdown:")
    for leg_id in longest_route_legs:
        leg_info = legs.get(leg_id)
        if leg_info:
            from_stn = stations[leg_info[0]]
            to_stn = stations[leg_info[1]]
            km = leg_info[3]
            print(f"  - {leg_id}: {from_stn} -> {to_stn} ({km} KM)")
