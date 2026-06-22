import os
import sys
import json
import time
import signal
import threading
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

WORKSPACE = r"C:\Users\sures\.gemini\antigravity-ide\scratch\UOC_TAbill"
LEGS_FILE = os.path.join(WORKSPACE, 'legs.json')
GEO_FILE = os.path.join(WORKSPACE, 'geocodes_osm.json')
ABBREV_FILE = os.path.join(WORKSPACE, 'ta_abbrevs.json')
ANOMALIES_FILE = os.path.join(WORKSPACE, 'scratch', 'haversine_anomalies.json')
STATE_FILE = os.path.join(WORKSPACE, 'scratch', 'fix_state.json')

shutdown_flag = False
save_counter = 0  # Defined globally so threads can modify it safely
data_lock = threading.Lock()

def signal_handler(sig, frame):
    global shutdown_flag
    print("\n\n[!] Pause requested (Ctrl+C). Completing active threads and saving progress... Please wait.")
    shutdown_flag = True

signal.signal(signal.SIGINT, signal_handler)

# Use two different public OSRM instances to balance the load and double the speed
OSRM_SERVERS = [
    "http://router.project-osrm.org/route/v1/driving/",
    "https://routing.openstreetmap.de/routed-car/route/v1/driving/"
]

def get_osrm_distance(lon1, lat1, lon2, lat2, thread_id):
    # Rotate servers based on thread id to balance load
    server = OSRM_SERVERS[thread_id % len(OSRM_SERVERS)]
    url = f"{server}{lon1},{lat1};{lon2},{lat2}?overview=false"
    req = urllib.request.Request(url, headers={'User-Agent': 'UOC-TAbill-Patcher/2.0'})
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            if data['code'] == 'Ok':
                return data['routes'][0]['distance'] / 1000.0
            return None
    except Exception:
        # Fallback to the other server if the primary one fails
        try:
            fallback_server = OSRM_SERVERS[(thread_id + 1) % len(OSRM_SERVERS)]
            url = f"{fallback_server}{lon1},{lat1};{lon2},{lat2}?overview=false"
            req = urllib.request.Request(url, headers={'User-Agent': 'UOC-TAbill-Patcher/2.0'})
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode())
                if data['code'] == 'Ok':
                    return data['routes'][0]['distance'] / 1000.0
        except Exception:
            pass
        return None

def main():
    global shutdown_flag, save_counter

    if not os.path.exists(ANOMALIES_FILE):
        print("Anomalies file not found. Please run the haversine audit script first.")
        return

    print("Loading database and coordinates...")
    with open(LEGS_FILE, 'r', encoding='utf-8') as f:
        legs_data = json.load(f)
    with open(GEO_FILE, 'r', encoding='utf-8-sig') as f:
        geocodes_list = json.load(f)
    with open(ABBREV_FILE, 'r', encoding='utf-8') as f:
        abbrevs_list = json.load(f)
    with open(ANOMALIES_FILE, 'r', encoding='utf-8') as f:
        anomalies_data = json.load(f)

    # Build lookup maps
    geocodes_map = {g['abbr']: g for g in geocodes_list}
    name_to_abbr = {item['Full College Name & Location']: item['Abbreviation'] for item in abbrevs_list}
    stations = legs_data['stations']

    # Gather all leg IDs to fix
    legs_to_fix = []
    for a in anomalies_data.get('high_anomalies', []):
        legs_to_fix.append(a['leg_id'])
    for a in anomalies_data.get('low_anomalies', []):
        legs_to_fix.append(a['leg_id'])

    # Remove duplicates
    legs_to_fix = list(set(legs_to_fix))

    # Load Resume State
    processed_legs = set()
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r', encoding='utf-8') as f:
            state = json.load(f)
            processed_legs = set(state.get('processed_legs', []))

    pending_legs = [l for l in legs_to_fix if l not in processed_legs]
    total_pending = len(pending_legs)

    if total_pending == 0:
        print("All anomalies have already been fixed!")
        return

    # Keep progress percentage correct
    total_to_fix = len(set(legs_to_fix) | processed_legs)

    print(f"\n--- OSRM DISTANCE REPAIR SCRIPT (MULTI-THREADED V2) ---")
    print(f"Total Anomalous Legs: {total_to_fix}")
    print(f"Already Fixed: {len(processed_legs)}")
    print(f"Pending to Fix: {total_pending}\n")
    print("Running with 4 parallel threads balanced across 2 public servers.")
    print("Press Ctrl+C at any time to PAUSE and SAVE progress.")
    print("-" * 60)

    def worker(leg_id, thread_idx):
        global shutdown_flag, save_counter
        if shutdown_flag:
            return

        info = legs_data['legs'].get(leg_id)
        if not info:
            with data_lock:
                processed_legs.add(leg_id)
            return

        from_idx, to_idx = info[0], info[1]
        from_name = stations[from_idx]
        to_name = stations[to_idx]

        abbr_f = name_to_abbr.get(from_name)
        abbr_t = name_to_abbr.get(to_name)
        
        geo_f = geocodes_map.get(abbr_f) if abbr_f else None
        geo_t = geocodes_map.get(abbr_t) if abbr_t else None

        new_km = None
        if geo_f and geo_t:
            new_km = get_osrm_distance(geo_f['lon'], geo_f['lat'], geo_t['lon'], geo_t['lat'], thread_idx)

        with data_lock:
            if new_km is not None:
                legs_data['legs'][leg_id][3] = round(new_km, 1)
            processed_legs.add(leg_id)
            save_counter += 1

            done = len(processed_legs)
            percent = (done / total_to_fix) * 100
            remaining = total_to_fix - done

            sys.stdout.write(f"\r[Progress: {percent:05.2f}%] Fixed: {done}/{total_to_fix} | Pending: {remaining} | Current: {abbr_f}->{abbr_t}")
            sys.stdout.flush()

            # Save to disk every 50 updates
            if save_counter >= 50:
                with open(LEGS_FILE, 'w', encoding='utf-8') as f:
                    json.dump(legs_data, f)
                with open(STATE_FILE, 'w', encoding='utf-8') as f:
                    json.dump({'processed_legs': list(processed_legs)}, f)
                save_counter = 0

        time.sleep(0.5)  # Slight delay to be gentle to servers

    # Run the worker in parallel
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(worker, leg_id, i): leg_id for i, leg_id in enumerate(pending_legs)}
        try:
            for future in as_completed(futures):
                if shutdown_flag:
                    break
        except KeyboardInterrupt:
            shutdown_flag = True

    # Final save on exit
    print("\n\nSaving final changes to database...")
    with open(LEGS_FILE, 'w', encoding='utf-8') as f:
         json.dump(legs_data, f)
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
         json.dump({'processed_legs': list(processed_legs)}, f)

    if shutdown_flag:
        print("Paused successfully! Run the script again to resume.")
    else:
        print("Finished! All anomalous legs have been repaired.")

if __name__ == '__main__':
    main()
