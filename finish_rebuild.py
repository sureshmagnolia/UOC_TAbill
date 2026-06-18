import os
import time
import subprocess
import json

print("Waiting for geocode_osm.py to finish...")
while True:
    if os.path.exists('geocodes_osm.json'):
        with open('geocodes_osm.json', 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
                # Wait until all 424 (or close to it) are done.
                if len(data) >= 420:
                    break
            except:
                pass
    time.sleep(10)

print("geocodes_osm.json is fully generated! Wait a few seconds to ensure file lock is released...")
time.sleep(10)

print("Running process_osrm.py with new OSM geocodes...")
with open('process_osrm.py', 'r') as f:
    process_code = f.read()
process_code = process_code.replace("open('geocodes.json',", "open('geocodes_osm.json',")
with open('process_osrm_osm.py', 'w') as f:
    f.write(process_code)

with open('retry_osrm.py', 'r') as f:
    retry_code = f.read()
retry_code = retry_code.replace("open('geocodes.json',", "open('geocodes_osm.json',")
with open('retry_osrm_osm.py', 'w') as f:
    f.write(retry_code)

print("Executing process_osrm_osm.py...")
subprocess.run(["python", "process_osrm_osm.py"], check=True)

print("Executing retry_osrm_osm.py...")
subprocess.run(["python", "retry_osrm_osm.py"], check=True)

print("Executing full_regen.py to build the final routing graph...")
subprocess.run(["python", "full_regen.py"], check=True)

print("All tasks completed successfully! Database is ready.")
