import os
import json
import math

WORKSPACE = r"C:\Users\sures\.gemini\antigravity-ide\scratch\UOC_TAbill"

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0 # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# Load data
with open(os.path.join(WORKSPACE, 'legs.json'), 'r', encoding='utf-8') as f:
    legs_data = json.load(f)

with open(os.path.join(WORKSPACE, 'geocodes_osm.json'), 'r', encoding='utf-8') as f:
    geocodes = json.load(f)

stations = legs_data['stations']
legs = legs_data['legs']

anomalies_high = []
anomalies_low = []
missing_coords = set()

# Process all legs
for leg_id, leg_info in legs.items():
    from_idx, to_idx, mode_idx, km, type_idx = leg_info[:5]
    from_name = stations[from_idx]
    to_name = stations[to_idx]
    
    # Try to find coords
    from_geo = geocodes.get(from_name)
    to_geo = geocodes.get(to_name)
    
    if not from_geo:
        missing_coords.add(from_name)
    if not to_geo:
        missing_coords.add(to_name)
        
    if from_geo and to_geo:
        # Coords are usually [lat, lon]
        lat1, lon1 = float(from_geo['lat']), float(from_geo['lon'])
        lat2, lon2 = float(to_geo['lat']), float(to_geo['lon'])
        
        straight_km = haversine(lat1, lon1, lat2, lon2)
        
        # If straight_km is very small (e.g., < 1km), skip ratio to avoid div by zero
        if straight_km < 1 and km > 15:
             ratio = km
             anomalies_high.append({
                 'leg_id': leg_id, 'from': from_name, 'to': to_name,
                 'routed_km': km, 'straight_km': round(straight_km, 2), 'ratio': round(ratio, 2)
             })
             continue
        elif straight_km < 1:
             continue
             
        ratio = km / straight_km
        
        # Flag highly anomalous > 2.5x
        # But give a buffer: if straight_km is 10km, 2.5x is 25km. That's fine. 
        # Only flag if absolute difference > 15km AND ratio > 2.5
        if ratio > 2.5 and (km - straight_km) > 15:
            anomalies_high.append({
                'leg_id': leg_id, 'from': from_name, 'to': to_name,
                'routed_km': km, 'straight_km': round(straight_km, 2), 'ratio': round(ratio, 2)
            })
            
        # Flag physically impossible < 0.9x
        elif ratio < 0.9 and (straight_km - km) > 5:
            anomalies_low.append({
                'leg_id': leg_id, 'from': from_name, 'to': to_name,
                'routed_km': km, 'straight_km': round(straight_km, 2), 'ratio': round(ratio, 2)
            })

anomalies_high.sort(key=lambda x: x['ratio'], reverse=True)
anomalies_low.sort(key=lambda x: x['ratio'])

print(f"Total Legs Analyzed: {len(legs)}")
print(f"Total Geocodes Missing: {len(missing_coords)}")
print(f"High Anomalies (>2.5x & >15km diff): {len(anomalies_high)}")
print(f"Low Anomalies (<0.9x & >5km diff): {len(anomalies_low)}")

print("\n--- TOP 15 OVERESTIMATED DISTANCES (ROUTED WAY TOO LONG) ---")
for a in anomalies_high[:15]:
    print(f"[{a['leg_id']}] {a['from']} -> {a['to']}: {a['routed_km']} KM (Straight: {a['straight_km']} KM, Ratio: {a['ratio']}x)")

print("\n--- TOP 15 UNDERESTIMATED DISTANCES (PHYSICALLY IMPOSSIBLE) ---")
for a in anomalies_low[:15]:
    print(f"[{a['leg_id']}] {a['from']} -> {a['to']}: {a['routed_km']} KM (Straight: {a['straight_km']} KM, Ratio: {a['ratio']}x)")

# Save full results to an artifact file for agent/user review
with open(os.path.join(WORKSPACE, "distance_audit_results.json"), "w", encoding="utf-8") as f:
    json.dump({
        "high_anomalies": anomalies_high,
        "low_anomalies": anomalies_low,
        "missing_coords": list(missing_coords)
    }, f, indent=2)
