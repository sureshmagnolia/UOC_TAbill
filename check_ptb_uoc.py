import json

with open('ta_database.json', 'r') as f:
    data = json.load(f)

for route_id in ['UOC_PTB', 'PTB_UOC']:
    print(f'Route: {route_id}')
    if route_id in data.get('routes', {}):
        legs = data['routes'][route_id]
        for leg_id in legs:
            leg = data['legs'][leg_id]
            print(f"  {leg['From']} -> {leg['To']} ({leg['Mode']}, {leg['KM']} KM)")
    else:
        print('  Not found')
