import re

with open(r'C:\Users\sures\.gemini\antigravity-ide\brain\d32a16ca-f19e-4d46-9d0e-de936543d7cb\.system_generated\steps\362\content.md', 'r', encoding='utf-8') as f:
    html = f.read()

lis = re.findall(r'<li class="mix.*?</li>', html, re.DOTALL | re.IGNORECASE)
if lis:
    print('Found', len(lis), 'colleges.')
    print('First college HTML:')
    print(lis[0][:1000])
else:
    print('No li class="mix..." found.')
