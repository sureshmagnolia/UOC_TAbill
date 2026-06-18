import json

print('Starting Audit...')
with open('ta_database.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

print(f"Loaded database with {len(db.get('abbreviations', []))} nodes, {len(db.get('routes', {}))} routes, and {len(db.get('legs', {}))} legs.")

errors = []

# Check abbreviations
abbrs = {}
for item in db.get('abbreviations', []):
    abbr = item.get('Abbreviation')
    if not abbr:
        errors.append('Missing Abbreviation in item: ' + str(item))
    elif abbr in abbrs:
        errors.append(f'Duplicate Abbreviation: {abbr}')
    else:
        abbrs[abbr] = item

# Check legs
valid_legs = set()
for leg_id, leg in db.get('legs', {}).items():
    valid_legs.add(leg_id)
    is_new_format = 'type' in leg and 'start' in leg and 'end' in leg and 'km' in leg
    is_old_format = 'From' in leg and 'To' in leg and 'Mode' in leg and 'KM' in leg
    if not (is_new_format or is_old_format):
        errors.append(f'Invalid leg format in {leg_id}: {leg}')

# Check routes
nodes_with_routes = set()
for route_code, leg_list in db.get('routes', {}).items():
    parts = route_code.split('_')
    if len(parts) != 2:
        errors.append(f'Invalid route code format: {route_code}')
        continue
    a, b = parts
    if a not in abbrs:
        errors.append(f'Route {route_code} uses unknown abbreviation {a}')
    if b not in abbrs:
        errors.append(f'Route {route_code} uses unknown abbreviation {b}')
    
    nodes_with_routes.add(a)
    nodes_with_routes.add(b)

    for leg_id in leg_list:
        if leg_id not in valid_legs:
            errors.append(f'Route {route_code} references unknown leg {leg_id}')

missing_routes = set(abbrs.keys()) - nodes_with_routes
if missing_routes:
    # Only report count if it's large
    if len(missing_routes) > 10:
        errors.append(f'{len(missing_routes)} nodes have NO routes.')
    else:
        errors.append(f'Nodes with NO routes: {missing_routes}')

if errors:
    print(f'Found {len(errors)} errors!')
    for e in errors[:20]:
        print(e)
    if len(errors) > 20:
        print('... and more')
else:
    print('Audit passed successfully! Structure is 100% sound.')
