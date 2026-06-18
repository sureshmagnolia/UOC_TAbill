import json

with open('ta_database.json', 'r') as f:
    data = json.load(f)

# Manually fix remaining routes that have duplicates because of alternate names

def get_leg_by_mode(from_loc, mode):
    for leg_id, leg in data['legs'].items():
        if (from_loc in leg['From'] or from_loc in leg['To']) and leg['Mode'] == mode:
            return leg_id
    return None

def find_leg(fr, to):
    for leg_id, leg in data['legs'].items():
        if leg['From'] == fr and leg['To'] == to:
            return leg_id
    return None

fixes = {
    'ALA_ASM': [find_leg('SN College Alathur', 'Erattakulam Stop'), find_leg('Erattakulam Stop', 'Thrissur KSRTC Stand'), find_leg('Thrissur KSRTC Stand', 'Kodungallur Stand'), find_leg('Kodungallur Stand', 'MES Asmabi College')],
    'ASM_ALA': [find_leg('MES Asmabi College', 'Kodungallur Stand'), find_leg('Kodungallur Stand', 'Thrissur KSRTC Stand'), find_leg('Thrissur KSRTC Stand', 'Erattakulam Stop'), find_leg('Erattakulam Stop', 'SN College Alathur')],
    'ALA_CTR': [find_leg('SN College Alathur', 'Erattakulam (Alathur)'), find_leg('Erattakulam (Alathur)', 'Palakkad Stadium Stand'), find_leg('Palakkad Stadium Stand', 'Chittur Bus Stand'), find_leg('Chittur Bus Stand', 'Govt College Chittur')],
    'CTR_ALA': [find_leg('Govt College Chittur', 'Chittur Bus Stand'), find_leg('Chittur Bus Stand', 'Palakkad Stadium Stand'), find_leg('Palakkad Stadium Stand', 'Erattakulam (Alathur)'), find_leg('Erattakulam (Alathur)', 'SN College Alathur')],
    'ALA_MKD': [find_leg('SN College Alathur', 'Erattakulam Stop'), find_leg('Erattakulam Stop', 'Palakkad KSRTC Stand'), find_leg('Palakkad KSRTC Stand', 'Mannarkkad Bus Stand'), find_leg('Mannarkkad Bus Stand', 'MES Kalladi College')],
    'MKD_ALA': [find_leg('MES Kalladi College', 'Mannarkkad Bus Stand'), find_leg('Mannarkkad Bus Stand', 'Palakkad KSRTC Stand'), find_leg('Palakkad KSRTC Stand', 'Erattakulam Stop'), find_leg('Erattakulam Stop', 'SN College Alathur')],
    'ALA_NAT': [find_leg('SN College Alathur', 'Erattakulam Stop'), find_leg('Erattakulam Stop', 'Thrissur KSRTC Stand'), find_leg('Thrissur KSRTC Stand', 'Nattika Jn'), find_leg('Nattika Jn', 'SN College Nattika')],
    'NAT_ALA': [find_leg('SN College Nattika', 'Nattika Jn'), find_leg('Nattika Jn', 'Thrissur KSRTC Stand'), find_leg('Thrissur KSRTC Stand', 'Erattakulam Stop'), find_leg('Erattakulam Stop', 'SN College Alathur')],
    'ASM_LFC': [find_leg('MES Asmabi College', 'Kodungallur Stand'), find_leg('Kodungallur Stand', 'Guruvayur Bus Stand'), find_leg('Guruvayur Bus Stand', 'Little Flower College')],
    'LFC_ASM': [find_leg('Little Flower College', 'Guruvayur Bus Stand'), find_leg('Guruvayur Bus Stand', 'Kodungallur Stand'), find_leg('Kodungallur Stand', 'MES Asmabi College')],
    'ASM_NAT': [find_leg('MES Asmabi College', 'Kodungallur Stand'), find_leg('Kodungallur Stand', 'Nattika Jn (NH 66)'), find_leg('Nattika Jn', 'SN College Nattika')],
    'NAT_ASM': [find_leg('SN College Nattika', 'Nattika Jn'), find_leg('Nattika Jn', 'Kodungallur Stand'), find_leg('Kodungallur Stand', 'MES Asmabi College')],
    'ASM_SKG': [find_leg('MES Asmabi College', 'Kodungallur Stand'), find_leg('Kodungallur Stand', 'Guruvayur Bus Stand'), find_leg('Guruvayur Bus Stand', 'Sree Krishna College GVR')],
    'SKG_ASM': [find_leg('Sree Krishna College GVR', 'Guruvayur Bus Stand'), find_leg('Guruvayur Bus Stand', 'Kodungallur Stand'), find_leg('Kodungallur Stand', 'MES Asmabi College')],
    'CTR_MKD': [find_leg('Govt College Chittur', 'Chittur Bus Stand'), find_leg('Chittur Bus Stand', 'Palakkad Stadium Stand'), find_leg('Palakkad KSRTC Stand', 'Mannarkkad Bus Stand'), find_leg('Mannarkkad Bus Stand', 'MES Kalladi College')],
    'MKD_CTR': [find_leg('MES Kalladi College', 'Mannarkkad Bus Stand'), find_leg('Mannarkkad Bus Stand', 'Palakkad KSRTC Stand'), find_leg('Palakkad Stadium Stand', 'Chittur Bus Stand'), find_leg('Chittur Bus Stand', 'Govt College Chittur')],
    'MKD_NEM': [find_leg('MES Kalladi College', 'Mannarkkad Bus Stand'), find_leg('Mannarkkad Bus Stand', 'Palakkad KSRTC Stand'), find_leg('Palakkad KSRTC Stand', 'Nemmara Bus Stand'), find_leg('Nemmara Bus Stand', 'NSS College Nemmara')],
    'NEM_MKD': [find_leg('NSS College Nemmara', 'Nemmara Bus Stand'), find_leg('Nemmara Bus Stand', 'Palakkad KSRTC Stand'), find_leg('Palakkad KSRTC Stand', 'Mannarkkad Bus Stand'), find_leg('Mannarkkad Bus Stand', 'MES Kalladi College')],
    'MKD_OTP': [find_leg('MES Kalladi College', 'Mannarkkad Bus Stand'), find_leg('Mannarkkad Bus Stand', 'Ottappalam Bus Stand'), find_leg('Ottappalam Bus Stand', 'NSS College Ottappalam')],
    'OTP_MKD': [find_leg('NSS College Ottappalam', 'Ottappalam Bus Stand'), find_leg('Ottappalam Stand', 'Mannarkkad (via Cherpulassery)'), find_leg('Mannarkkad Bus Stand', 'MES Kalladi College')]
}

for route_id, leg_sequence in fixes.items():
    if route_id in data['routes']:
        # Filter out Nones in case I got a name slightly wrong
        valid_legs = [l for l in leg_sequence if l is not None]
        data['routes'][route_id] = valid_legs

with open('ta_database.json', 'w') as f:
    json.dump(data, f, indent=2)

print("Duplicates cleaned.")
