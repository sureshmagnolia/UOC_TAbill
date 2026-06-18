import json
import uuid

with open('ta_database.json', 'r') as f:
    data = json.load(f)

def get_or_create_leg(from_loc, to_loc, mode, km, ltype, fare=None):
    # Find existing
    for leg_id, leg in data['legs'].items():
        if leg['From'] == from_loc and leg['To'] == to_loc and leg['Mode'] == mode:
            return leg_id
    # Create new
    new_id = "LEG_" + str(len(data['legs']) + 1000) # prevent collision
    leg_obj = {
        "From": from_loc,
        "To": to_loc,
        "Mode": mode,
        "KM": str(km),
        "Type": ltype
    }
    if fare:
        leg_obj["Fare"] = fare
    data['legs'][new_id] = leg_obj
    return new_id

# 1. UOC to Parappanangadi (Bus)
leg_uoc_pgi = get_or_create_leg("University of Calicut", "Parappanangadi Stn", "Bus", "12.0", "First_Mile")
# 2. Parappanangadi to Pattambi (Train)
leg_pgi_ptb = get_or_create_leg("Parappanangadi Stn", "Pattambi Railway Stn", "Train", "38.0", "Main_Haul", 750)
# 3. Pattambi to SNGS College (Taxi)
leg_ptb_col = get_or_create_leg("Pattambi Railway Stn", "SNGS College Pattambi", "Taxi", "1.5", "Last_Mile")

data['routes']['UOC_PTB'] = [leg_uoc_pgi, leg_pgi_ptb, leg_ptb_col]

# 1. SNGS College to Pattambi (Taxi)
leg_col_ptb = get_or_create_leg("SNGS College Pattambi", "Pattambi Railway Stn", "Taxi", "1.5", "First_Mile")
# 2. Pattambi to Parappanangadi (Train)
leg_ptb_pgi = get_or_create_leg("Pattambi Railway Stn", "Parappanangadi Stn", "Train", "38.0", "Main_Haul", 750)
# 3. Parappanangadi to UOC (Bus)
leg_pgi_uoc = get_or_create_leg("Parappanangadi Stn", "University of Calicut", "Bus", "12.0", "Last_Mile")

data['routes']['PTB_UOC'] = [leg_col_ptb, leg_ptb_pgi, leg_pgi_uoc]

with open('ta_database.json', 'w') as f:
    json.dump(data, f, indent=2)

print("Updated UOC_PTB and PTB_UOC successfully to use train via Parappanangadi.")
