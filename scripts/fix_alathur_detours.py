import os
import json

WORKSPACE = r"C:\Users\sures\.gemini\antigravity-ide\scratch\UOC_TAbill"
ROUTES_DIR = os.path.join(WORKSPACE, "routes")
ASSETS_DIR = os.path.join(WORKSPACE, "app", "src", "main", "assets", "routes")

def main():
    onward_file = os.path.join(ROUTES_DIR, "ALA.json")
    onward_assets = os.path.join(ASSETS_DIR, "ALA.json")
    
    # 1. Patch onward routes in ALA.json
    onward_patched = 0
    if os.path.exists(onward_file):
        with open(onward_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        for k, v in data.items():
            if len(v) == 3 and v[0] == 'LEG_4518' and v[1] == 'LEG_1677':
                data[k] = ['LEG_4453', 'LEG_4454', v[2]]
                onward_patched += 1
                
        if onward_patched > 0:
            with open(onward_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, separators=(',', ':'))
            with open(onward_assets, 'w', encoding='utf-8') as f:
                json.dump(data, f, separators=(',', ':'))
                
    # 2. Patch return routes in other files
    return_patched = 0
    files = [f for f in os.listdir(ROUTES_DIR) if f.endswith('.json') and f != "ALA.json"]
    
    for filename in files:
        filepath = os.path.join(ROUTES_DIR, filename)
        assets_filepath = os.path.join(ASSETS_DIR, filename)
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        file_modified = False
        for k, v in data.items():
            if k.endswith('_ALA') and len(v) == 3 and v[1] == 'LEG_1677' and v[2] in ['LEG_112', 'LEG_4518']:
                data[k] = [v[0], 'LEG_4454', 'LEG_4453']
                file_modified = True
                return_patched += 1
                
        if file_modified:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, separators=(',', ':'))
            with open(assets_filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, separators=(',', ':'))

    print(f"Patched {onward_patched} onward routes in ALA.json")
    print(f"Patched {return_patched} return routes in other files.")

if __name__ == '__main__':
    main()
