import json
with open('geocodes_osm.json', 'r', encoding='utf-8') as f:
    geocodes = json.load(f)
missing_abbrs = {item['abbr'] for item in geocodes if item.get('lat') is None}

with open('ta_database.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

for item in db['abbreviations']:
    if item['Abbreviation'] in missing_abbrs:
        print(f"- [{item['Abbreviation']}] {item['Full College Name & Location'].strip()}")
