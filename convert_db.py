import json

with open('ta_database.json', 'r') as f:
    data = json.load(f)

legs = {}
leg_str_to_id = {}
routes_dict = {}
leg_counter = 1

for r in data.get('routes', []):
    rid = r['Route_ID']
    step = r.get('Step', '1')
    
    leg_obj = {
        "From": r["From"],
        "To": r["To"],
        "Mode": r["Mode"],
        "KM": r["KM"],
        "Type": r["Type"]
    }
    if "Fare" in r:
        leg_obj["Fare"] = r["Fare"]
    
    # We want a reliable string representation to find duplicates
    leg_str = json.dumps(leg_obj, sort_keys=True)
    
    if leg_str not in leg_str_to_id:
        leg_id = f"LEG_{leg_counter}"
        leg_counter += 1
        leg_str_to_id[leg_str] = leg_id
        legs[leg_id] = leg_obj
    
    leg_id = leg_str_to_id[leg_str]
    
    if rid not in routes_dict:
        routes_dict[rid] = []
    routes_dict[rid].append(leg_id)

new_data = {
    "abbreviations": data.get("abbreviations", []),
    "legs": legs,
    "routes": routes_dict
}

with open('ta_database.json', 'w') as f:
    json.dump(new_data, f, indent=2)

print(f"Conversion complete. Created {len(legs)} unique legs for {len(routes_dict)} routes.")
