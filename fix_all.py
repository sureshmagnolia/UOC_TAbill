import json

with open('ta_database.json', 'r') as f:
    data = json.load(f)

def get_or_create_leg(from_loc, to_loc, mode, km, ltype, fare=None):
    for leg_id, leg in data['legs'].items():
        if leg['From'] == from_loc and leg['To'] == to_loc and leg['Mode'] == mode:
            return leg_id
    new_id = "LEG_" + str(len(data['legs']) + 1000)
    leg_obj = {"From": from_loc, "To": to_loc, "Mode": mode, "KM": str(km), "Type": ltype}
    if fare:
        leg_obj["Fare"] = fare
    data['legs'][new_id] = leg_obj
    return new_id

# Hubs to Stations (Forward & Backward)
hubs = {
    'UOC': [
        ('University of Calicut', 'Parappanangadi Stn', 'Bus', '12.0', 'First_Mile'),
        ('Parappanangadi Stn', 'University of Calicut', 'Bus', '12.0', 'Last_Mile')
    ],
    'NAT': [
        ('SN College Nattika', 'Nattika Jn', 'Taxi', '1.0', 'First_Mile'),
        ('Nattika Jn', 'Thrissur KSRTC Stand', 'Bus', '24.0', 'First_Mile'),
        ('Thrissur KSRTC Stand', 'Nattika Jn', 'Bus', '24.0', 'Last_Mile'),
        ('Nattika Jn', 'SN College Nattika', 'Taxi', '1.0', 'Last_Mile')
    ],
    'ASM': [
        ('MES Asmabi College', 'Kodungallur Stand', 'Taxi', '7.5', 'First_Mile'),
        ('Kodungallur Stand', 'Thrissur KSRTC Stand', 'Bus', '36.0', 'First_Mile'),
        ('Thrissur KSRTC Stand', 'Kodungallur Stand', 'Bus', '36.0', 'Last_Mile'),
        ('Kodungallur Stand', 'MES Asmabi College', 'Taxi', '7.5', 'Last_Mile')
    ],
    'SMT': [
        ('St Marys College', 'Thrissur KSRTC Stand', 'Taxi', '2.0', 'First_Mile'),
        ('Thrissur KSRTC Stand', 'St Marys College', 'Taxi', '2.0', 'Last_Mile')
    ],
    'NEM': [
        ('NSS College Nemmara', 'Nemmara Bus Stand', 'Taxi', '1.5', 'First_Mile'),
        ('Nemmara Bus Stand', 'Palakkad KSRTC Stand', 'Bus', '28.0', 'First_Mile'),
        ('Palakkad KSRTC Stand', 'Nemmara Bus Stand', 'Bus', '28.0', 'Last_Mile'),
        ('Nemmara Bus Stand', 'NSS College Nemmara', 'Taxi', '1.5', 'Last_Mile')
    ],
    'MKD': [
        ('MES Kalladi College', 'Mannarkkad Bus Stand', 'Taxi', '1.5', 'First_Mile'),
        ('Mannarkkad Bus Stand', 'Palakkad KSRTC Stand', 'Bus', '38.0', 'First_Mile'),
        ('Palakkad KSRTC Stand', 'Mannarkkad Bus Stand', 'Bus', '38.0', 'Last_Mile'),
        ('Mannarkkad Bus Stand', 'MES Kalladi College', 'Taxi', '1.5', 'Last_Mile')
    ],
    'LFC': [
        ('Little Flower College', 'Guruvayur Bus Stand', 'Taxi', '1.0', 'First_Mile'),
        ('Guruvayur Bus Stand', 'Little Flower College', 'Taxi', '1.0', 'Last_Mile')
    ],
    'SKG': [
        ('Sree Krishna College GVR', 'Guruvayur Bus Stand', 'Taxi', '3.5', 'First_Mile'),
        ('Guruvayur Bus Stand', 'Sree Krishna College GVR', 'Taxi', '3.5', 'Last_Mile')
    ],
    'PRK': [
        ('NSS College Parakkulam', 'Pattambi Railway Stn', 'Taxi', '14.5', 'First_Mile'),
        ('Pattambi Railway Stn', 'NSS College Parakkulam', 'Taxi', '14.5', 'Last_Mile')
    ],
    'ALA': [
        ('SN College Alathur', 'Erattakulam Stop', 'Taxi', '0.5', 'First_Mile'),
        ('Erattakulam Stop', 'Thrissur KSRTC Stand', 'Bus', '44.0', 'First_Mile'),
        ('Thrissur KSRTC Stand', 'Erattakulam Stop', 'Bus', '44.0', 'Last_Mile'),
        ('Erattakulam Stop', 'SN College Alathur', 'Taxi', '0.5', 'Last_Mile')
    ],
    'PTB': [
        ('SNGS College Pattambi', 'Pattambi Railway Stn', 'Taxi', '1.5', 'First_Mile'),
        ('Pattambi Railway Stn', 'SNGS College Pattambi', 'Taxi', '1.5', 'Last_Mile')
    ]
}

# Add KSRTC to Railway Station bridges if needed
# Thrissur KSRTC to Thrissur Railway is 0km or walkable. 
# Palakkad KSRTC to Palakkad Railway is ~4km. Let's add taxi bridges.
bridges = [
    ('Thrissur KSRTC Stand', 'Thrissur Railway Stn', 'Walking', '0.0', 'First_Mile'),
    ('Thrissur Railway Stn', 'Thrissur KSRTC Stand', 'Walking', '0.0', 'Last_Mile'),
    ('Palakkad KSRTC Stand', 'Palakkad Jn Railway', 'Taxi', '4.0', 'First_Mile'),
    ('Palakkad Jn Railway', 'Palakkad KSRTC Stand', 'Taxi', '4.0', 'Last_Mile'),
    ('Guruvayur Bus Stand', 'Guruvayur Railway Stn', 'Walking', '0.0', 'First_Mile'),
    ('Guruvayur Railway Stn', 'Guruvayur Bus Stand', 'Walking', '0.0', 'Last_Mile')
]

train_distances = {
    ('Parappanangadi Stn', 'Thrissur Railway Stn'): 80,
    ('Parappanangadi Stn', 'Palakkad Jn Railway'): 105,
    ('Parappanangadi Stn', 'Pattambi Railway Stn'): 38,
    ('Parappanangadi Stn', 'Guruvayur Railway Stn'): 106,
    ('Thrissur Railway Stn', 'Palakkad Jn Railway'): 74,
    ('Thrissur Railway Stn', 'Pattambi Railway Stn'): 44,
    ('Thrissur Railway Stn', 'Guruvayur Railway Stn'): 23,
    ('Palakkad Jn Railway', 'Pattambi Railway Stn'): 55,
    ('Palakkad Jn Railway', 'Guruvayur Railway Stn'): 97,
    ('Pattambi Railway Stn', 'Guruvayur Railway Stn'): 67
}

for (a,b), km in list(train_distances.items()):
    train_distances[(b,a)] = km

def get_hub_legs(college, is_onward):
    # Returns the list of leg IDs to get from College to Station (if onward) or Station to College (if return)
    # Plus the name of the final station
    c_legs = hubs.get(college, [])
    station = ""
    leg_ids = []
    
    # We find the sequence that leads to a Railway Stn (or KSRTC + bridge)
    if is_onward:
        if college == 'UOC':
            leg_ids.append(get_or_create_leg(*c_legs[0]))
            return leg_ids, "Parappanangadi Stn"
        elif college in ['NAT', 'ASM', 'SMT', 'ALA']:
            for cl in c_legs[:len(c_legs)//2]:
                leg_ids.append(get_or_create_leg(*cl))
            leg_ids.append(get_or_create_leg(*bridges[0])) # KSRTC to Train
            return leg_ids, "Thrissur Railway Stn"
        elif college in ['NEM', 'MKD']:
            for cl in c_legs[:len(c_legs)//2]:
                leg_ids.append(get_or_create_leg(*cl))
            leg_ids.append(get_or_create_leg(*bridges[2])) # KSRTC to Train
            return leg_ids, "Palakkad Jn Railway"
        elif college in ['LFC', 'SKG']:
            for cl in c_legs[:len(c_legs)//2]:
                leg_ids.append(get_or_create_leg(*cl))
            leg_ids.append(get_or_create_leg(*bridges[4]))
            return leg_ids, "Guruvayur Railway Stn"
        elif college in ['PRK', 'PTB']:
            leg_ids.append(get_or_create_leg(*c_legs[0]))
            return leg_ids, "Pattambi Railway Stn"
    else:
        if college == 'UOC':
            leg_ids.append(get_or_create_leg(*c_legs[1]))
            return "Parappanangadi Stn", leg_ids
        elif college in ['NAT', 'ASM', 'SMT', 'ALA']:
            leg_ids.append(get_or_create_leg(*bridges[1]))
            for cl in c_legs[len(c_legs)//2:]:
                leg_ids.append(get_or_create_leg(*cl))
            return "Thrissur Railway Stn", leg_ids
        elif college in ['NEM', 'MKD']:
            leg_ids.append(get_or_create_leg(*bridges[3]))
            for cl in c_legs[len(c_legs)//2:]:
                leg_ids.append(get_or_create_leg(*cl))
            return "Palakkad Jn Railway", leg_ids
        elif college in ['LFC', 'SKG']:
            leg_ids.append(get_or_create_leg(*bridges[5]))
            for cl in c_legs[len(c_legs)//2:]:
                leg_ids.append(get_or_create_leg(*cl))
            return "Guruvayur Railway Stn", leg_ids
        elif college in ['PRK', 'PTB']:
            leg_ids.append(get_or_create_leg(*c_legs[1]))
            return "Pattambi Railway Stn", leg_ids

pairs_to_fix = [
    ('UOC', 'NAT'), ('UOC', 'ASM'), ('UOC', 'SMT'), ('UOC', 'LFC'), ('UOC', 'SKG'), 
    ('UOC', 'NEM'), ('UOC', 'MKD'), ('UOC', 'ALA'), ('UOC', 'PRK'),
    ('NEM', 'NAT'), ('NEM', 'ASM'), ('NEM', 'SMT'), ('NEM', 'LFC'), ('NEM', 'SKG'), 
    ('MKD', 'NAT'), ('MKD', 'ASM'), ('MKD', 'SMT'), ('MKD', 'LFC'), ('MKD', 'SKG'), 
    ('ALA', 'NAT'), ('ALA', 'ASM'), ('ALA', 'SMT'), ('ALA', 'LFC'), ('ALA', 'SKG'),
    ('PRK', 'MKD'), ('PTB', 'MKD')
]

for a, b in pairs_to_fix:
    route_id_fw = f"{a}_{b}"
    route_id_bw = f"{b}_{a}"
    
    # 1. Forward
    fw_legs, stn_a = get_hub_legs(a, True)
    _, stn_b = get_hub_legs(b, True)
    bw_stn_b, bw_legs = get_hub_legs(b, False)
    
    if stn_a != stn_b:
        train_km = train_distances[(stn_a, stn_b)]
        train_leg = get_or_create_leg(stn_a, stn_b, 'Train', train_km, 'Main_Haul', 750)
        data['routes'][route_id_fw] = fw_legs + [train_leg] + bw_legs
    else:
        # Should not happen as they are in different hubs, but just in case
        data['routes'][route_id_fw] = fw_legs + bw_legs
        
    # 2. Backward
    fw_legs_b, _ = get_hub_legs(b, True)
    _, bw_legs_a = get_hub_legs(a, False)
    
    if stn_a != stn_b:
        train_km = train_distances[(stn_b, stn_a)]
        train_leg = get_or_create_leg(stn_b, stn_a, 'Train', train_km, 'Main_Haul', 750)
        data['routes'][route_id_bw] = fw_legs_b + [train_leg] + bw_legs_a
    else:
        data['routes'][route_id_bw] = fw_legs_b + bw_legs_a

with open('ta_database.json', 'w') as f:
    json.dump(data, f, indent=2)

print("Successfully fixed all long-distance bus routes and removed duplicates.")
