import json

with open('ta_database.json', 'r') as f:
    data = json.load(f)

for leg_id, leg in data['legs'].items():
    if 'Parappanangadi' in leg['From'] or 'Parappanangadi' in leg['To']:
        print(f"{leg_id}: {leg['From']} -> {leg['To']} ({leg['Mode']}, {leg['KM']} KM)")
    elif 'Pattambi' in leg['From'] or 'Pattambi' in leg['To']:
        print(f"{leg_id}: {leg['From']} -> {leg['To']} ({leg['Mode']}, {leg['KM']} KM)")

