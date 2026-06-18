import json

with open('ta_database.json', 'r') as f:
    db = json.load(f)

existing_names = [item['Full College Name & Location'].lower() for item in db.get('abbreviations', [])]

with open('colleges_list_for_studio.txt', 'r', encoding='utf-8') as f:
    all_colleges = [line.strip() for line in f if line.strip()]

filtered = []
for c in all_colleges:
    c_lower = c.lower()
    is_existing = False
    for ex in existing_names:
        if ex in c_lower or c_lower in ex:
            is_existing = True
            break
            
    if not is_existing:
        filtered.append(c)

print('Filtered down to', len(filtered), 'colleges.')
print('---')
for c in filtered[:50]:
    print(c)
