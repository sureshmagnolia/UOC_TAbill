import json
import os

with open('ta_database.json', 'r') as f:
    data = json.load(f)

data['abbreviations'] = [a for a in data.get('abbreviations', []) if a['Abbreviation'] != 'SMY']
colleges = [item['Abbreviation'] for item in data['abbreviations']]

existing_routes = set(r['Route_ID'] for r in data.get('routes', []))
new_routes = []
seen_legs = set()

for r in data.get('routes', []):
    rid = r['Route_ID']
    if 'SMY' in rid:
        new_rid = rid.replace('SMY', 'SMT')
        if new_rid in existing_routes and rid != new_rid:
            continue
        r['Route_ID'] = new_rid
    
    leg_key = json.dumps(r, sort_keys=True)
    if leg_key not in seen_legs:
        seen_legs.add(leg_key)
        new_routes.append(r)

data['routes'] = new_routes

with open('ta_database.json', 'w') as f:
    json.dump(data, f, indent=2)

routes = set(r['Route_ID'] for r in new_routes)
missing = []
for a in colleges:
    for b in colleges:
        if a != b:
            if f'{a}_{b}' not in routes:
                missing.append(f'{a}_{b}')

print(f'Missing after fix: {len(missing)}')
for m in missing:
    print(m)
