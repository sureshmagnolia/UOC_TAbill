import json

with open('ta_database.json', 'r') as f:
    data = json.load(f)

# Collect IDs of all walking/0 KM legs
legs_to_remove = set()
for leg_id, leg in data['legs'].items():
    if float(leg['KM']) == 0.0 or leg['Mode'].lower() == 'walking':
        legs_to_remove.add(leg_id)

# Remove them from all routes
for route_id, route_legs in data['routes'].items():
    new_route_legs = [lid for lid in route_legs if lid not in legs_to_remove]
    data['routes'][route_id] = new_route_legs

with open('ta_database.json', 'w') as f:
    json.dump(data, f, indent=2)

print(f"Removed {len(legs_to_remove)} 0.0 KM / Walking legs from all routes.")
