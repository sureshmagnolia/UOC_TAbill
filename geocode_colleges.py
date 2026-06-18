import re
import json
import time
import urllib.request

with open(r'C:\Users\sures\.gemini\antigravity-ide\brain\d32a16ca-f19e-4d46-9d0e-de936543d7cb\.system_generated\steps\362\content.md', 'r', encoding='utf-8') as f:
    html = f.read()

# Extract colleges
lis = re.findall(r'<li class="mix[^>]*>(.*?)</li>', html, re.DOTALL | re.IGNORECASE)
colleges = []

for li in lis:
    # Extract the name from the a tag text
    a_match = re.search(r'<a[^>]*>(.*?)<p', li, re.DOTALL)
    if a_match:
        full_name = a_match.group(1).strip()
        # The text inside 'mix' class also has info but a tag is cleaner
        # Get district
        district_match = re.search(r'<p style="[^"]*" class="pb-10">(.*?)</p>', li)
        district = district_match.group(1).strip() if district_match else ''
        
        # Get category
        cat_match = re.search(r'badge-info">(.*?)</p>', li)
        category = cat_match.group(1).strip() if cat_match else ''
        
        # Basic short abbreviation creation
        words = re.findall(r'[A-Z]', full_name)
        abbr = ''.join(words[:4]) # Just a rough unique ID
        
        colleges.append({
            'id': abbr,
            'name': full_name,
            'district': district,
            'category': category
        })

# Geocoding function
def geocode(query):
    url = "https://nominatim.openstreetmap.org/search?q=" + urllib.parse.quote(query) + "&format=json&limit=1"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'UOC-TA-App-Agent/1.0'})
        response = urllib.request.urlopen(req).read()
        data = json.loads(response)
        if data:
            return float(data[0]['lat']), float(data[0]['lon'])
    except Exception as e:
        pass
    return None, None

print(f"Extracted {len(colleges)} colleges. Starting Geocoding process...")

# We will only geocode the first 20 as a proof of concept because 474 will take 8+ minutes.
# We can run the rest in the background later if the user approves.
results = []
for i, c in enumerate(colleges[:20]):
    print(f"[{i+1}/20] Geocoding: {c['name']}")
    lat, lon = geocode(c['name'])
    
    # Fallback to district if not found
    if lat is None:
        print("  -> Not found, trying district fallback...")
        lat, lon = geocode(f"College, {c['district']}, Kerala")
        
    c['lat'] = lat
    c['lon'] = lon
    results.append(c)
    time.sleep(1.1) # Be nice to Nominatim

with open('colleges_gps_sample.json', 'w') as f:
    json.dump(results, f, indent=2)

print("Geocoding sample complete. Saved to colleges_gps_sample.json")
