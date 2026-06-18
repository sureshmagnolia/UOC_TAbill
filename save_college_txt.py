import re

with open(r'C:\Users\sures\.gemini\antigravity-ide\brain\d32a16ca-f19e-4d46-9d0e-de936543d7cb\.system_generated\steps\362\content.md', 'r', encoding='utf-8') as f:
    html = f.read()

lis = re.findall(r'<li class="mix[^>]*>(.*?)</li>', html, re.DOTALL | re.IGNORECASE)
colleges = []
for li in lis:
    a_match = re.search(r'<a[^>]*>(.*?)<p', li, re.DOTALL)
    if a_match:
        colleges.append(a_match.group(1).strip().replace('\n', ' '))

with open('colleges_list_for_studio.txt', 'w', encoding='utf-8') as f:
    for c in colleges:
        f.write(c + '\n')
print(f'Saved {len(colleges)} colleges to colleges_list_for_studio.txt')
