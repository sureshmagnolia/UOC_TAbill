import json

with open('ta_database.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

markdown = '# Geocoding Prompt for AI Studio\n\n'
markdown += 'Copy and paste this single prompt into Google AI Studio (with Google Maps/Search plugins enabled).\n\n'
markdown += '---\n\n'
markdown += '```text\n'
markdown += 'You are an expert geocoding assistant with access to Google Maps. Below is a list of colleges in Kerala, India, along with their unique abbreviation codes.\n\n'
markdown += 'Please find the exact GPS coordinates (Latitude and Longitude) for each college.\n'
markdown += 'Because there are 400+ colleges, please write a Python script using your tools to geocode them and output the result in chunks if necessary.\n\n'
markdown += 'Return the final output STRICTLY as a single JSON array of objects in this exact format:\n'
markdown += '[\n  {"abbr": "ABC", "lat": 11.2345, "lon": 75.6789},\n  ...\n]\n\n'
markdown += 'Here is the list of colleges:\n'

for item in db['abbreviations']:
    abbr = item['Abbreviation']
    name = item['Full College Name & Location']
    markdown += f'{abbr}: {name}\n'

markdown += '```\n'

with open(r'C:\Users\sures\.gemini\antigravity-ide\brain\d32a16ca-f19e-4d46-9d0e-de936543d7cb\geocoding_prompt.md', 'w', encoding='utf-8') as f:
    f.write(markdown)
print('Geocoding prompt generated!')
