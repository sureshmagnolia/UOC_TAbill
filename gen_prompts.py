import json
from collections import defaultdict

with open('hub_map.json', 'r', encoding='utf-8') as f:
    hub = json.load(f)

stations = defaultdict(list)
for c in hub:
    stations[c['nearest_station']].append(c['name'])

markdown = '# Google AI Studio Prompts\n\n'
markdown += 'Copy and paste each prompt into a new chat in **Google AI Studio** with the **Google Maps Plugin** or **Google Search Plugin** enabled.\n\n'
markdown += '---\n\n'

for i, (station, colleges) in enumerate(stations.items(), 1):
    markdown += f'### Prompt {i}: {station} Hub ({len(colleges)} Colleges)\n\n'
    markdown += '```text\n'
    markdown += f'You are an expert geocoding and routing assistant with access to Google Maps. I have a list of {len(colleges)} colleges located in Kerala, India, all of which are roughly in the same geographic zone near {station} Railway Station.\n\n'
    markdown += 'Your task is to calculate the direct shortest driving distance (in kilometers) between EVERY unique pair of colleges in this list.\n\n'
    
    # Calculate combinations
    combinations = len(colleges) * (len(colleges) - 1) // 2
    markdown += f'There are {combinations} unique pairs to calculate. '
    
    if len(colleges) > 40:
        markdown += 'Because the list is large, please write and execute a Python script using the Google Maps API (if available to you) or use your tools iteratively to process them. '
        markdown += 'If the output is too long, please provide the results in chunks.\n\n'
    else:
        markdown += '\n\n'
    
    markdown += 'Please return the final output STRICTLY as a JSON array of objects with this exact format. Do not include any other text in the final JSON block:\n'
    markdown += '[\n  {"from": "College A Name", "to": "College B Name", "km": 12.5},\n  ...\n]\n\n'
    markdown += 'Here is the list of colleges:\n'
    for c in colleges:
        markdown += f'- {c}\n'
    markdown += '```\n\n---\n\n'

with open(r'C:\Users\sures\.gemini\antigravity-ide\brain\d32a16ca-f19e-4d46-9d0e-de936543d7cb\ai_studio_prompts.md', 'w', encoding='utf-8') as f:
    f.write(markdown)
print('Prompts generated!')
