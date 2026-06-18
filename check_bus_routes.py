import json

with open('ta_database.json', 'r') as f:
    data = json.load(f)

# Collect all routes
routes = data.get('routes', {})
legs = data.get('legs', {})

suspicious_routes = []

for route_id, leg_ids in routes.items():
    total_km = 0
    has_train = False
    
    # Calculate total KM and check for train
    for leg_id in leg_ids:
        leg = legs[leg_id]
        total_km += float(leg['KM'])
        if leg['Mode'] == 'Train':
            has_train = True
            
    # If the route is longer than 50km and has NO train, it's suspicious
    if total_km > 50 and not has_train:
        suspicious_routes.append({
            'route_id': route_id,
            'total_km': total_km,
            'legs': [f"{legs[lid]['From']} -> {legs[lid]['To']} ({legs[lid]['Mode']}, {legs[lid]['KM']} KM)" for lid in leg_ids]
        })

print(f"Found {len(suspicious_routes)} suspicious routes (>50km with no train):")
for sr in suspicious_routes:
    print(f"\nRoute: {sr['route_id']} (Total KM: {sr['total_km']})")
    for leg in sr['legs']:
        print(f"  - {leg}")
