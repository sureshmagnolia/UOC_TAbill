import json
from collections import defaultdict

with open('hub_map.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Group by station
station_map = defaultdict(list)
for item in data:
    name = item['name'].upper()
    if "DEPARTMENT OF " in name and "UNIVERSITY OF CALICUT" in name:
        continue
    station_map[item['nearest_station']].append(item)

output_lines = []
total_pairs = 0
total_colleges = 0
stations_with_multiple = 0

for station, colleges in sorted(station_map.items()):
    if len(colleges) > 1:
        stations_with_multiple += 1
        total_colleges += len(colleges)
        pairs_in_station = len(colleges) * (len(colleges) - 1) // 2
        total_pairs += pairs_in_station
        
        output_lines.append(f'=== Station: {station} ({len(colleges)} colleges) ===')
        for i, c in enumerate(colleges):
            output_lines.append(f"{i+1}. {c['name']} (Distance to station: {c['km_to_station']} km)")
        output_lines.append('') # blank line

with open('same_station_colleges.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output_lines))

print(f'Found {stations_with_multiple} stations with multiple colleges.')
print(f'Total colleges involved: {total_colleges}')
print(f'Total possible direct pairs: {total_pairs}')
print('List saved to same_station_colleges.txt')
