import re
with open(r'C:\Users\sures\.gemini\antigravity-ide\brain\d32a16ca-f19e-4d46-9d0e-de936543d7cb\.system_generated\steps\446\content.md', 'r', encoding='utf-8') as f:
    html = f.read()

# Look for maps
iframes = re.findall(r'<iframe[^>]*src=[\'\"]([^\'\"]+)[\'\"][^>]*>', html, re.IGNORECASE)
for src in iframes:
    if 'map' in src.lower() or 'google' in src.lower():
        print('Found Map Iframe:', src)
