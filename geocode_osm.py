import json
import urllib.request
import urllib.parse
import time
import os

with open('ta_database.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

def geocode(query):
    url = 'https://nominatim.openstreetmap.org/search?q=' + urllib.parse.quote(query) + '&format=json&limit=1'
    req = urllib.request.Request(url, headers={'User-Agent': 'Antigravity IDE - Kerala University TA Project'})
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data:
                return round(float(data[0]['lat']), 5), round(float(data[0]['lon']), 5)
    except Exception as e:
        print(f"Error for {query}: {e}")
    return None, None

# Load existing progress if any
results = []
if os.path.exists('geocodes_osm.json'):
    with open('geocodes_osm.json', 'r', encoding='utf-8') as f:
        results = json.load(f)

processed_abbrs = {item['abbr'] for item in results}

BATCH_SIZE = 1000
processed_in_this_batch = 0

for idx, item in enumerate(db['abbreviations']):
    if processed_in_this_batch >= BATCH_SIZE:
        print(f"Batch limit of {BATCH_SIZE} reached. Stopping.")
        break

    abbr = item['Abbreviation']
    if abbr in processed_abbrs:
        continue
        
    processed_in_this_batch += 1
    name = item['Full College Name & Location'].strip()
    
    print(f"[{idx+1}/{len(db['abbreviations'])}] Geocoding: {name}")
    
    # Attempt 1: Exact Name
    lat, lon = geocode(name + ', Kerala, India')
    time.sleep(1.1)
    
    # Attempt 2: Last comma separated part (usually Town/District)
    if lat is None and ',' in name:
        parts = [p.strip() for p in name.split(',')]
        
        # Try last two parts (e.g., THOZHIYUR, THRISSUR)
        if len(parts) >= 2:
            fallback_2 = f"{parts[-2]}, {parts[-1]}, Kerala, India"
            print(f"  Fallback 1: {fallback_2}")
            lat, lon = geocode(fallback_2)
            time.sleep(1.1)
            
        # Try just the last part (e.g., THRISSUR)
        if lat is None:
            fallback_1 = f"{parts[-1]}, Kerala, India"
            print(f"  Fallback 2: {fallback_1}")
            lat, lon = geocode(fallback_1)
            time.sleep(1.1)

    # Attempt 3: Just grab the last word
    if lat is None:
        last_word = name.split()[-1]
        fallback_3 = f"{last_word}, Kerala, India"
        print(f"  Fallback 3: {fallback_3}")
        lat, lon = geocode(fallback_3)
        time.sleep(1.1)
        
    if lat is not None:
        results.append({"abbr": abbr, "lat": lat, "lon": lon})
        print(f"  Success: {lat}, {lon}")
    else:
        print(f"  FAILED to geocode {abbr}")
        results.append({"abbr": abbr, "lat": None, "lon": None}) # prevent re-checking

    # Save incrementally
    with open('geocodes_osm.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)

print(f"Successfully geocoded {len(results)}/{len(db['abbreviations'])} colleges using OSM!")
