import json
from difflib import SequenceMatcher

def similar(a, b):
    return SequenceMatcher(None, a, b).ratio()

print("Loading databases...")
with open('ta_database.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

with open('ai_direct_legs.json', 'r', encoding='utf-8') as f:
    direct_legs = json.load(f)

# Build map
name_to_abbr = {}
for item in db['abbreviations']:
    name_to_abbr[item['Full College Name & Location'].strip().upper()] = item['Abbreviation']

def get_abbr(query_name):
    query_name = query_name.strip().upper()
    if query_name in name_to_abbr:
        return name_to_abbr[query_name]
    
    # Fuzzy match
    best_match = None
    best_score = 0
    for name, abbr in name_to_abbr.items():
        score = similar(query_name, name)
        if score > best_score:
            best_score = score
            best_match = abbr
    
    if best_score > 0.8:
        return best_match
    return None

success_count = 0
for pair in direct_legs:
    from_abbr = get_abbr(pair['from'])
    to_abbr = get_abbr(pair['to'])
    
    if from_abbr and to_abbr:
        dist = float(pair['km'])
        
        # Create new legs
        leg_fwd = f"DIR_LEG_{from_abbr}_{to_abbr}"
        leg_rev = f"DIR_LEG_{to_abbr}_{from_abbr}"
        
        from_name = next(i['Full College Name & Location'] for i in db['abbreviations'] if i['Abbreviation'] == from_abbr)
        to_name = next(i['Full College Name & Location'] for i in db['abbreviations'] if i['Abbreviation'] == to_abbr)
        
        db['legs'][leg_fwd] = {"From": from_name, "To": to_name, "Mode": "Bus", "KM": dist, "Type": "Direct"}
        db['legs'][leg_rev] = {"From": to_name, "To": from_name, "Mode": "Bus", "KM": dist, "Type": "Direct"}
        
        # Override routes
        db['routes'][f"{from_abbr}_{to_abbr}"] = [leg_fwd]
        db['routes'][f"{to_abbr}_{from_abbr}"] = [leg_rev]
        success_count += 1
    else:
        print(f"Could not map: {pair['from']} -> {pair['to']}")

with open('ta_database.json', 'w', encoding='utf-8') as f:
    json.dump(db, f, indent=2)

print(f"\nSuccessfully injected {success_count} direct routes (forward + reverse) into the database!")
