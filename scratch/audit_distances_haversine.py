import os
import json
import math

WORKSPACE = r"C:\Users\sures\.gemini\antigravity-ide\scratch\UOC_TAbill"

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def main():
    # Load data
    with open(os.path.join(WORKSPACE, 'legs.json'), 'r', encoding='utf-8') as f:
        legs_data = json.load(f)
    with open(os.path.join(WORKSPACE, 'geocodes_osm.json'), 'r', encoding='utf-8-sig') as f:
        geocodes_list = json.load(f)
    with open(os.path.join(WORKSPACE, 'ta_abbrevs.json'), 'r', encoding='utf-8') as f:
        abbrevs_list = json.load(f)

    geocodes_map = {g['abbr']: g for g in geocodes_list}
    name_to_abbr = {item['Full College Name & Location']: item['Abbreviation'] for item in abbrevs_list}

    stations = legs_data['stations']
    legs = legs_data['legs']

    anomalies_high = []
    anomalies_low = []
    missing_coords = set()
    processed_pairs = set()

    for leg_id, info in legs.items():
        from_idx, to_idx, mode_idx, km = info[0], info[1], info[2], info[3]
        from_name = stations[from_idx]
        to_name = stations[to_idx]
        
        pair_key = tuple(sorted([from_name, to_name]))
        if pair_key in processed_pairs:
            continue
        processed_pairs.add(pair_key)
        
        abbr_f = name_to_abbr.get(from_name)
        abbr_t = name_to_abbr.get(to_name)
        
        geo_f = geocodes_map.get(abbr_f) if abbr_f else None
        geo_t = geocodes_map.get(abbr_t) if abbr_t else None
        
        if not geo_f or not geo_t:
            missing_coords.add(from_name if not geo_f else to_name)
            continue
            
        lat1, lon1 = float(geo_f['lat']), float(geo_f['lon'])
        lat2, lon2 = float(geo_t['lat']), float(geo_t['lon'])
        
        straight_km = haversine(lat1, lon1, lat2, lon2)
        
        if straight_km < 1.0:
            if km > 15: # Highly anomalous if straight is <1km but routed is >15km
                 ratio = km
                 anomalies_high.append({
                     'leg_id': leg_id, 'from_abbr': abbr_f, 'to_abbr': abbr_t,
                     'db_km': km, 'straight_km': round(straight_km, 2), 'ratio': round(ratio, 2)
                 })
            continue
            
        ratio = km / straight_km
        
        if ratio > 2.0 and (km - straight_km) > 15:
            anomalies_high.append({
                'leg_id': leg_id, 'from_abbr': abbr_f, 'to_abbr': abbr_t,
                'db_km': km, 'straight_km': round(straight_km, 2), 'ratio': round(ratio, 2)
            })
            
        elif ratio < 0.9 and (straight_km - km) > 2:
            anomalies_low.append({
                'leg_id': leg_id, 'from_abbr': abbr_f, 'to_abbr': abbr_t,
                'db_km': km, 'straight_km': round(straight_km, 2), 'ratio': round(ratio, 2)
            })

    anomalies_high.sort(key=lambda x: x['ratio'], reverse=True)
    anomalies_low.sort(key=lambda x: x['ratio'])

    print(f"Total Unique Pairs Analyzed: {len(processed_pairs)}")
    print(f"Total Geocodes Missing: {len(missing_coords)}")
    print(f"High Anomalies (>2x & >15km diff): {len(anomalies_high)}")
    print(f"Low Anomalies (<0.9x & >2km diff): {len(anomalies_low)}")

    print("\n--- TOP 10 SUSPECT OVERESTIMATED (ROUTED WAY TOO LONG) ---")
    for a in anomalies_high[:10]:
        print(f"{a['from_abbr']} -> {a['to_abbr']}: {a['db_km']} KM (Straight: {a['straight_km']} KM, Ratio: {a['ratio']}x)")

    print("\n--- TOP 10 PHYSICALLY IMPOSSIBLE (SHORTER THAN STRAIGHT LINE) ---")
    for a in anomalies_low[:10]:
        print(f"{a['from_abbr']} -> {a['to_abbr']}: {a['db_km']} KM (Straight: {a['straight_km']} KM, Ratio: {a['ratio']}x)")

    with open(os.path.join(WORKSPACE, "scratch", "haversine_anomalies.json"), "w", encoding="utf-8") as f:
        json.dump({
            "high_anomalies": anomalies_high,
            "low_anomalies": anomalies_low,
            "missing_coords": list(missing_coords)
        }, f, indent=2)

if __name__ == '__main__':
    main()
