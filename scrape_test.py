import urllib.request
import re

url = "https://cdc.uoc.ac.in/index.php/affiliated-colleges"
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    html = urllib.request.urlopen(req).read().decode('utf-8')
    
    # Very basic search to see if the page contains a table of colleges
    if "table" in html or "college" in html.lower():
        print("Successfully fetched the CDC affiliated colleges page.")
        # Let's extract some text just to see the structure
        print("Preview of HTML content:")
        # strip tags for a quick preview
        text = re.sub('<[^<]+>', '', html)
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        for i, line in enumerate(lines[:50]):
            if "College" in line or "Arts" in line or "Science" in line:
                print(f"[{i}] {line}")
    else:
        print("Page fetched but doesn't look like a list of colleges.")
except Exception as e:
    print(f"Failed to fetch: {e}")
