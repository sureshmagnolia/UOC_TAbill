import sys

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

new_logic = '''
// GPS Editor Logic
function openGpsEditor() {
    document.getElementById('gps-modal').classList.remove('hidden');
    document.getElementById('gps-success-msg').classList.add('hidden');
    
    const searchInput = document.getElementById('gps-search');
    const dropdown = document.getElementById('gps-search-dropdown');
    
    // Quick populate if quick-from has a value
    const quickFrom = document.getElementById('quick-from');
    if (quickFrom && quickFrom.dataset.abbr && !searchInput.value) {
        searchInput.value = quickFrom.value;
        document.getElementById('gps-abbr').value = quickFrom.dataset.abbr;
        loadGpsForAbbr(quickFrom.dataset.abbr);
    }
    
    searchInput.addEventListener('input', () => {
        document.getElementById('gps-abbr').value = '';
        document.getElementById('gps-lat').value = '';
        document.getElementById('gps-lon').value = '';
        document.getElementById('gps-success-msg').classList.add('hidden');
        
        const val = searchInput.value.trim();
        if (val.length < 3) {
            dropdown.classList.add('hidden');
            dropdown.innerHTML = '';
            return;
        }
        
        const lower = val.toLowerCase();
        const matches = taDatabase.abbreviations.filter(a =>
            (a['Full College Name & Location'] || '').toLowerCase().includes(lower) ||
            (a.Abbreviation || '').toLowerCase().includes(lower)
        ).slice(0, 25);

        if (matches.length === 0) {
            dropdown.innerHTML = '<div class="px-3 py-2 text-xs text-gray-400">No matches found</div>';
        } else {
            dropdown.innerHTML = matches.map(m => {
                const abb = (m.Abbreviation || '').replace(/"/g, '&quot;');
                const full = (m['Full College Name & Location'] || '').replace(/"/g, '&quot;');
                return `<div class="px-3 py-2 cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-0 flex gap-2 items-start" data-abbr="${abb}" data-full="${full}">
                    <span class="font-semibold text-blue-800 text-xs shrink-0 mt-0.5">${m.Abbreviation}</span>
                    <span class="text-gray-600 text-[11px] leading-snug">${m['Full College Name & Location']}</span>
                </div>`;
            }).join('');
        }
        dropdown.classList.remove('hidden');
    });

    dropdown.addEventListener('mousedown', e => {
        const item = e.target.closest('[data-abbr]');
        if (!item) return;
        e.preventDefault();
        searchInput.value = item.dataset.full || item.dataset.abbr;
        document.getElementById('gps-abbr').value = item.dataset.abbr;
        dropdown.classList.add('hidden');
        loadGpsForAbbr(item.dataset.abbr);
    });

    document.addEventListener('click', e => {
        const wrap = document.getElementById('gps-search-wrap');
        if (wrap && !wrap.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
}

function loadGpsForAbbr(abbr) {
    let geo = customGeocodes[abbr];
    if (!geo) {
        geo = taDatabase.geocodes.find(g => g.abbr === abbr);
    }
    if (geo) {
        document.getElementById('gps-lat').value = geo.lat;
        document.getElementById('gps-lon').value = geo.lon;
    } else {
        document.getElementById('gps-lat').value = '';
        document.getElementById('gps-lon').value = '';
    }
}

function closeGpsEditor() {
    document.getElementById('gps-modal').classList.add('hidden');
}

function saveGpsOverride() {
    const abbr = document.getElementById('gps-abbr').value;
    const lat = document.getElementById('gps-lat').value;
    const lon = document.getElementById('gps-lon').value;
    
    if (!abbr) return alert("Select a college first");
    if (!lat || !lon) return alert("Enter valid latitude and longitude");
    
    customGeocodes[abbr] = { lat: parseFloat(lat), lon: parseFloat(lon) };
    localStorage.setItem('custom_geocodes', JSON.stringify(customGeocodes));
    
    const msg = document.getElementById('gps-success-msg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 3000);
}

function resetGps() {
    const abbr = document.getElementById('gps-abbr').value;
    if (!abbr) return;
    
    if (confirm("Reset GPS to system default for this college?")) {
        delete customGeocodes[abbr];
        localStorage.setItem('custom_geocodes', JSON.stringify(customGeocodes));
        loadGpsForAbbr(abbr);
        const msg = document.getElementById('gps-success-msg');
        msg.textContent = "Reset to default!";
        msg.classList.remove('text-green-600');
        msg.classList.add('text-blue-600');
        msg.classList.remove('hidden');
        setTimeout(() => {
            msg.classList.add('hidden');
            msg.textContent = "Saved successfully!";
            msg.classList.add('text-green-600');
            msg.classList.remove('text-blue-600');
        }, 3000);
    }
}
'''

with open('app.js', 'a', encoding='utf-8') as f:
    f.write(new_logic)

print("Successfully appended GPS Editor logic to app.js")
