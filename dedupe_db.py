import json

# Define the exact names as they appear in the database to be purged/merged
to_purge = [
    # Calicut University Campus redundancies (UOC already covers this)
    "CALICUT UNIVERSITY CENTRE FOR COSTUME AND FASHION DESIGNING, CALICUT",
    "CENTRE FOR COMPUTER SCIENCE AND INFORMATION TECHNOLOGY CALICUT UNIVERSITY CAMPUS(CCSIT).",
    "Centre for Computer Science and Information Technology(CCSIT), CALICUT UNIVERSITY",
    "CENTRE FOR PHYSICAL EDUCATION, UNIVERSITY OF CALICUT CAMPUS",
    "SCHOOL OF FOLKLORE STUDIES, UNIVERSITY OF CALICUT",
    "School of Health Science, Calicut University Campus, Malappuram",
    
    # Redundant variants to remove
    "SCHOOL OF MANAGEMENT STUDIES, DR. JOHN MATTHAI CENTRE, ARANATTUKARA, THRISSUR",
    "ISHA ATHUL ISLAM ARABIC COLLEGE UNAIDED, PARAPPANGADI",
    "KMMMO ARABIC COLLEGE (UNAIDED) SOUDABAD, THIRURANGADI, MPM",
    "AL HIDAYATH ARABIC COLLEGE, (UNAIDED), HIDAYATH NAGAR,KONDOTTY",
    "EMEA TRAINING COLLEGE KONDOTTY MALAPPURAM",
    "SREE NARAYANA GURU COLLEGE OF ADVANCED STUDIES ALATHUR",
    "SREE NARAYANA GURU COLLEGE OF ADVANCED STUDIES, NATTIKA",
    "BAFAKHY YATHEEMKHANA B.ED TRAINING COLLEGE, KALPAKANCHERY",
    "SAQUAFATHUL ISLAM ARABIC COLLEGE, UMMATHUR, PARAKKADAVU P.O.,KOZHIKODE",
    "ANWARUL ISLAM ARABIC COLLEGE, (UNAIDED) TIRURKAD, MALAPPURAM",
    "ILAHIYA ARABIC COLLEGE (UNAIDED), TIRURKAD, MALAPPURAM"
]

to_rename = {
    "SCHOOL OF DRAMA AND FINE ARTS, Dr. JOHN MATTHAI CENTRE, ARANATTUKARA, THRISSUR": "DR. JOHN MATTHAI CENTRE, ARANATTUKARA (ALL DEPARTMENTS)",
    "ISHA-ATHUL ISLAM ARABIC COLLEGE, PUTHARIKKAL, PARAPPANAGADI": "ISHA-ATHUL ISLAM ARABIC COLLEGE, PARAPPANAGADI",
    "K.M.M.M.O ARABIC COLLEGE, TIRURANGADI, MALAPPURAM": "K.M.M.M.O ARABIC COLLEGE, TIRURANGADI",
    "AL-HIDAYATH ARABIC COLLEGE, THURAKKAL , KONDOTTY": "AL-HIDAYATH ARABIC COLLEGE, KONDOTTY",
    "E.M.E.A COLLEGE OF ARTS AND SCIENCE, KONDOTTY": "E.M.E.A COLLEGE, KONDOTTY (ALL DEPARTMENTS)",
    "BAFAKHY YATHEEMKHANA ARTS AND SCIENCE COLLEGE FOR WOMEN, KALPAKANCHERY": "BAFAKHY YATHEEMKHANA COLLEGE, KALPAKANCHERY"
}

print("Loading ta_database.json...")
with open('ta_database.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

print("Loading hub_map.json...")
with open('hub_map.json', 'r', encoding='utf-8') as f:
    hub = json.load(f)

# 1. Clean hub_map.json
# Also remove exact duplicates
seen_hub = set()
new_hub = []
for c in hub:
    if c['name'] in to_purge:
        continue
    if c['name'] in to_rename:
        c['name'] = to_rename[c['name']]
    if c['name'] not in seen_hub:
        seen_hub.add(c['name'])
        new_hub.append(c)

with open('hub_map.json', 'w', encoding='utf-8') as f:
    json.dump(new_hub, f, indent=2)

print(f"hub_map.json updated. Reduced from {len(hub)} to {len(new_hub)} entries.")

# 2. Find abbreviations to purge
abbrs_to_purge = set()
new_abbreviations = []
# We also want to remove exact duplicates from ta_database if any exist
seen_abbr_names = set()

for item in db['abbreviations']:
    name = item['Full College Name & Location']
    if name in to_purge:
        abbrs_to_purge.add(item['Abbreviation'])
        continue
        
    if name in to_rename:
        item['Full College Name & Location'] = to_rename[name]
        
    if item['Full College Name & Location'] in seen_abbr_names:
        # It's an exact duplicate name! Remove it to avoid UI bloat
        abbrs_to_purge.add(item['Abbreviation'])
    else:
        seen_abbr_names.add(item['Full College Name & Location'])
        new_abbreviations.append(item)

db['abbreviations'] = new_abbreviations
print(f"Found {len(abbrs_to_purge)} redundant abbreviations to purge.")

# 3. Purge routes
new_routes = {}
for k, v in db['routes'].items():
    parts = k.split('_')
    if len(parts) == 2 and parts[0] not in abbrs_to_purge and parts[1] not in abbrs_to_purge:
        new_routes[k] = v
db['routes'] = new_routes

# 4. Purge unreferenced legs
used_legs = set()
for legs in db['routes'].values():
    used_legs.update(legs)

new_legs = {k: v for k, v in db['legs'].items() if k in used_legs}
db['legs'] = new_legs

with open('ta_database.json', 'w', encoding='utf-8') as f:
    json.dump(db, f, indent=2)

print(f"ta_database.json updated! Routes: {len(db['routes'])}, Legs: {len(db['legs'])}")
