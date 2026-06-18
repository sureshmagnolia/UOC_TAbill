import os
import time
import subprocess

print("Waiting for geocode_osm.py to finish (waiting for geocodes_osm.json to be created)...")
while not os.path.exists('geocodes_osm.json'):
    time.sleep(10)

print("geocodes_osm.json found! Wait a few seconds to ensure file is fully written...")
time.sleep(10)

print("Running process_osrm.py with new OSM geocodes...")
# We need to temporarily modify process_osrm.py and retry_osrm.py to use geocodes_osm.json
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

print("All tasks completed successfully! Initiating system shutdown in 60 seconds...")
os.system("shutdown /s /t 60")
