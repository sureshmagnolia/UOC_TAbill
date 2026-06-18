import json

print("Fixing ta_database.json keys...")
with open('ta_database.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

for leg_id, leg in db['legs'].items():
    if leg_id.startswith('NEW_LEG_'):
        if 'start' in leg:
            leg['From'] = leg.pop('start')
        if 'end' in leg:
            leg['To'] = leg.pop('end')
        if 'type' in leg:
            leg['Mode'] = leg.pop('type')
        if 'km' in leg:
            leg['KM'] = leg.pop('km')
            
        if 'Type' not in leg:
            # We can guess Type based on Mode
            if leg['Mode'] == 'Train':
                leg['Type'] = 'Main_Haul'
            else:
                leg['Type'] = 'First_Mile' # Just defaulting to First_Mile

with open('ta_database.json', 'w', encoding='utf-8') as f:
    json.dump(db, f, indent=2)

print("Fix complete.")
