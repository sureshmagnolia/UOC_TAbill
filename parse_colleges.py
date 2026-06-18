import re

with open(r'C:\Users\sures\.gemini\antigravity-ide\brain\d32a16ca-f19e-4d46-9d0e-de936543d7cb\.system_generated\steps\362\content.md', 'r', encoding='utf-8') as f:
    html = f.read()

# Try to find table rows
rows = re.findall(r'<tr>(.*?)</tr>', html, re.DOTALL)
print(f"Found {len(rows)} table rows.")

if len(rows) > 0:
    for row in rows[1:6]:  # Skip header
        cols = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
        clean_cols = [re.sub(r'<[^>]+>', '', c).strip() for c in cols]
        print(clean_cols)
else:
    # Maybe li elements
    lis = re.findall(r'<li class="mix[^>]*>(.*?)</li>', html, re.DOTALL)
    print(f"Found {len(lis)} mix items.")
    for li in lis[:5]:
        clean_li = re.sub(r'<[^>]+>', ' ', li).strip()
        print(' '.join(clean_li.split()))
