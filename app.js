// ta-bill-app/app.js

let taDatabase = { abbreviations: [], legs: {} };
let loadedRoutes = {}; // Cache of loaded routes by college, e.g. { ALA: { ALA_ASM: [...] } }
let appSettings = {};
let _dbReadyResolve = null;
const dbReadyPromise = new Promise(resolve => { _dbReadyResolve = resolve; });

const persistIds = [
    'prof-name', 'prof-designation', 'prof-college', 'prof-address', 'prof-basic-pay', 'prof-acc-no', 'prof-bank-ifsc',
    'bill-month', 'bill-purpose', 'quick-from', 'quick-to', 'quick-date-onward', 'quick-time-onward', 'quick-date-return', 'quick-time-return'
];

function saveFormState() {
    const state = {};
    persistIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) state[id] = el.value;
    });
    // Also persist the abbreviations behind the college display names
    ['quick-from', 'quick-to', 'prof-college'].forEach(id => {
        const el = document.getElementById(id);
        if (el) state[id + '-abbr'] = el.dataset.abbr || '';
    });

    const journeys = [];
    document.querySelectorAll('#journey-body .journey-card').forEach(row => {
        const rowType = row.getAttribute('data-type') || row.dataset.type;
        const dateInput = row.querySelector('.journey-date-input') || row.querySelector('input[type="date"]');
        const dateVal = dateInput ? dateInput.value : '';
        if (rowType === "DA") {
            const daIn = row.querySelector('input[data-field="da"]');
            journeys.push({
                type: "DA",
                date: dateVal,
                fromDate: row.getAttribute('data-from-date') || row.dataset.fromDate || dateVal,
                toDate: row.getAttribute('data-to-date') || row.dataset.toDate || dateVal,
                daDays: row.getAttribute('data-days') || row.dataset.days,
                daAmt: daIn ? daIn.value : ''
            });
        } else {
            const kmIn = row.querySelector('input[data-field="km"]');
            const fareIn = row.querySelector('input[data-field="fare"]');
            const daIn = row.querySelector('input[data-field="da"]');
            const fromIn = row.querySelector('.from-station-input');
            const toIn = row.querySelector('.to-station-input');
            const depTimeIn = row.querySelector('.dep-time-input');
            const arrTimeIn = row.querySelector('.arr-time-input');
            journeys.push({
                type: "journey",
                date: dateVal,
                ft: depTimeIn ? depTimeIn.value : '',
                tt: arrTimeIn ? arrTimeIn.value : '',
                from: fromIn ? fromIn.value : '',
                to: toIn ? toIn.value : '',
                mode: row.querySelector('select') ? row.querySelector('select').value : 'Special',
                km: kmIn ? kmIn.value : '',
                fare: fareIn ? fareIn.value : '',
                fareAuto: fareIn ? (fareIn.getAttribute('data-auto') || fareIn.dataset.auto || 'true') : 'true',
                da: daIn ? daIn.value : '',
                isLimited: row.querySelector('.limit-check') ? row.querySelector('.limit-check').checked : false
            });
        }
    });
    state.journeys = journeys;

    state.schemaVersion = 4;
    localStorage.setItem('ta_form_state', JSON.stringify(state));
}

function loadFormState() {
    const SCHEMA_V = 4; // increment when journey data structure changes
    const stateStr = localStorage.getItem('ta_form_state');
    let loadedJourneys = false;
    if (stateStr) {
        try {
            const state = JSON.parse(stateStr);
            // If old schema (no schemaVersion), keep profile fields but drop journeys
            if ((state.schemaVersion || 0) < SCHEMA_V) {
                // Re-save with version so we don't loop
                state.schemaVersion = SCHEMA_V;
                state.journeys = [];
                localStorage.setItem('ta_form_state', JSON.stringify(state));
            }
            persistIds.forEach(id => {
                const el = document.getElementById(id);
                if (el && state[id] !== undefined) el.value = state[id];
            });
            // Restore abbreviations for college autocomplete fields
            ['quick-from', 'quick-to', 'prof-college'].forEach(id => {
                const el = document.getElementById(id);
                const abbr = state[id + '-abbr'];
                if (el && abbr) el.dataset.abbr = abbr;
            });
            calculateGrade();
            
            if (state.journeys && state.journeys.length > 0) {
                const container = document.getElementById('journey-body');
                container.innerHTML = '';
                state.journeys.forEach(j => {
                    addJourneyRow();
                    const row = container.lastElementChild;
                    if (j.type === "DA") {
                        row.dataset.type = "DA";
                        row.classList.add("da-card");
                        const fromDate = j.fromDate || j.date || '';
                        const toDate   = j.toDate   || j.date || '';
                        row.querySelector('input[type="date"]').value = fromDate;
                        row.dataset.fromDate = fromDate;
                        row.dataset.toDate   = toDate;
                        const fmtS = (iso) => { if (!iso) return ''; const p = iso.split('-'); return `${p[2]}/${p[1]}/${p[0].slice(-2)}`; };
                        const days = j.daDays || 1;
                        const rangeStr = toDate && toDate !== fromDate
                            ? `${fmtS(fromDate)} → ${fmtS(toDate)}`
                            : fmtS(fromDate);
                        const fromIn = row.querySelector('.from-station-input') || row.querySelectorAll('input[type="text"][list="stations"]')[0];
                        if (fromIn) fromIn.value = `DA: ${rangeStr} · ${days} Day${days > 1 ? 's' : ''}`;
                        const toIn = row.querySelector('.to-station-input') || row.querySelectorAll('input[type="text"][list="stations"]')[1];
                        if (toIn) toIn.closest('div').style.display = 'none';
                        row.querySelector('select') && (row.querySelector('select').style.display = 'none');
                        const timesRow = row.querySelector('.times-row');
                        if (timesRow) timesRow.style.display = 'none';
                        const kmIn = row.querySelector('input[data-field="km"]');
                        const fareIn = row.querySelector('input[data-field="fare"]');
                        const daIn = row.querySelector('input[data-field="da"]');
                        if (kmIn) kmIn.style.display = 'none'; // KM
                        if (fareIn) fareIn.style.display = 'none'; // Fare
                        if (daIn) daIn.value = j.daAmt || '';  // DA
                        row.setAttribute('data-days', days);
                        row.dataset.days = days;
                    } else {
                        const dateInput = row.querySelector('.journey-date-input') || row.querySelector('input[type="date"]');
                        if (dateInput) dateInput.value = j.date || '';
                        const depTimeIn = row.querySelector('.dep-time-input') || row.querySelectorAll('input[type="time"]')[0];
                        const arrTimeIn = row.querySelector('.arr-time-input') || row.querySelectorAll('input[type="time"]')[1];
                        if (depTimeIn) depTimeIn.value = j.ft || '';
                        if (arrTimeIn) arrTimeIn.value = j.tt || '';
                        const fromIn = row.querySelector('.from-station-input') || row.querySelectorAll('input[type="text"][list="stations"]')[0];
                        const toIn = row.querySelector('.to-station-input') || row.querySelectorAll('input[type="text"][list="stations"]')[1];
                        if (fromIn) fromIn.value = j.from || '';
                        if (toIn) toIn.value = j.to || '';
                        if (row.querySelector('select')) row.querySelector('select').value = j.mode || 'Special';
                        const kmIn = row.querySelector('input[data-field="km"]');
                        const fareIn = row.querySelector('input[data-field="fare"]');
                        const daIn = row.querySelector('input[data-field="da"]');
                        if (kmIn) kmIn.value = j.km || '';
                        if (fareIn) {
                            fareIn.value = j.fare || '';
                            fareIn.setAttribute('data-auto', j.fareAuto || 'true');
                            fareIn.dataset.auto = j.fareAuto || 'true';
                        }
                        if (daIn) daIn.value = j.da || '';
                        if (j.isLimited && row.querySelector('.limit-check')) row.querySelector('.limit-check').checked = true;
                    }
                });
                loadedJourneys = true;
                updateCalculations();
            }
        } catch(e) {
            console.error("Failed to load state", e);
        }
    }
    return loadedJourneys;
}

const DEFAULT_SETTINGS = {
    grades: [
        { id: "I", minPay: 50400, roadRate: 2.50, trainClass: "II AC", daInside: 600, daOutside: 600 },
        { id: "II(a)", minPay: 42500, roadRate: 2.00, trainClass: "I Class", daInside: 600, daOutside: 600 },
        { id: "II(b)", minPay: 27800, roadRate: 1.50, trainClass: "III AC", daInside: 600, daOutside: 600 },
        { id: "III", minPay: 18000, roadRate: 1.00, trainClass: "II Class", daInside: 600, daOutside: 600 },
        { id: "IV", minPay: 0, roadRate: 1.00, trainClass: "II Class", daInside: 600, daOutside: 600 }
    ],
    misc: {
        specialConveyanceRate: 2.50,
        trainIncidentalRate: 0.80, // per KM
        minDistanceForTA: 8, // km
        trainClasses: {
            "II AC":     { minDist: 300, base: 300, perKm: 1.50 },
            "I Class":   { minDist: 100, base: 150, perKm: 1.50 },
            "III AC":    { minDist: 300, base: 200, perKm: 1.00 },
            "II Class":  { minDist: 50,  base: 30,  perKm: 0.40 }
        }
    }
};

function getSelectedGrade() {
    const gradeSelect = document.getElementById('prof-grade');
    const gradeId = gradeSelect ? gradeSelect.value : "IV";
    return appSettings.grades.find(g => g.id === gradeId) || appSettings.grades[appSettings.grades.length - 1];
}

// Initialize App
async function init() {
    try {
        const files = ['ta_abbrevs.json', 'legs.json'];
        const responses = await Promise.all(files.map(f => fetch(f + '?v=' + Date.now()).then(r => r.json())));
        taDatabase.abbreviations = responses[0];
        
        const rawLegsData = responses[1];
        const decompressedLegs = {};
        if (rawLegsData && rawLegsData.legs && rawLegsData.stations) {
            const { stations, modes, types, legs } = rawLegsData;
            for (const [id, arr] of Object.entries(legs)) {
                decompressedLegs[id] = {
                    From: stations[arr[0]],
                    To: stations[arr[1]],
                    Mode: modes[arr[2]],
                    KM: arr[3],
                    Type: types[arr[4]],
                    ...(arr[5] !== undefined && arr[5] !== null ? { Fare: arr[5] } : {})
                };
            }
            taDatabase.legs = decompressedLegs;
        } else {
            taDatabase.legs = rawLegsData;
        }
        
        populateCollegeDropdowns();
    } catch (e) {
        console.error("Failed to load databases", e);
    }
    
    if (_dbReadyResolve) { _dbReadyResolve(); _dbReadyResolve = null; }

    loadSettings();
    setupEventListeners();

    setupCollegeAutocomplete('quick-from');
    setupCollegeAutocomplete('quick-to');
    setupCollegeAutocomplete('prof-college');

    const loaded = loadFormState();

    const quickFrom = document.getElementById('quick-from');
    const profCollege = document.getElementById('prof-college');
    if (quickFrom && profCollege && !quickFrom.value && profCollege.value) {
        const abbr = profCollege.dataset.abbr || resolveAbbreviation(profCollege.value);
        const match = taDatabase.abbreviations.find(a => a.Abbreviation === abbr);
        quickFrom.value = match ? match['Full College Name & Location'] : profCollege.value;
        quickFrom.dataset.abbr = abbr;
    }

    ['quick-from', 'quick-to', 'prof-college'].forEach(id => {
        const inp = document.getElementById(id);
        const btn = document.getElementById(id + '-clear');
        if (inp && btn && inp.value) btn.classList.remove('hidden');
    });

    if (!loaded) {
        addJourneyRow();
    }
}

function populateCollegeDropdowns() {
    const dl = document.getElementById('colleges-list');
    if (!dl) return;
    
    dl.innerHTML = '';
    const seenNames = new Set();
    taDatabase.abbreviations.forEach(abbr => {
        if (!abbr || !abbr['Full College Name & Location']) return;
        const nameNorm = abbr['Full College Name & Location'].toLowerCase()
            .replace(/govt\./g, 'government')
            .replace(/[^a-z0-9]/g, '');
            
        if (!seenNames.has(nameNorm)) {
            seenNames.add(nameNorm);
            const opt = document.createElement('option');
            opt.value = abbr.Abbreviation;
            opt.innerText = abbr['Full College Name & Location'];
            dl.appendChild(opt);
        }
    });
}

function setupCollegeAutocomplete(inputId) {
    const input = document.getElementById(inputId);
    const clearBtn = document.getElementById(inputId + '-clear');
    const dropdown = document.getElementById(inputId + '-dropdown');
    if (!input || !dropdown) return;

    const syncClear = () => {
        if (clearBtn) clearBtn.classList.toggle('hidden', !input.value);
    };
    syncClear();

    input.addEventListener('input', () => {
        delete input.dataset.abbr;
        syncClear();
        const val = input.value.trim();
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
        input.value = item.dataset.full || item.dataset.abbr;
        input.dataset.abbr = item.dataset.abbr;
        syncClear();
        dropdown.classList.add('hidden');
        saveFormState();
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => clearCollegeField(inputId));
    }

    document.addEventListener('click', e => {
        const wrap = document.getElementById(inputId + '-wrap');
        if (wrap && !wrap.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
}

function clearCollegeField(inputId) {
    const input = document.getElementById(inputId);
    const clearBtn = document.getElementById(inputId + '-clear');
    const dropdown = document.getElementById(inputId + '-dropdown');
    if (input) { input.value = ''; delete input.dataset.abbr; }
    if (clearBtn) clearBtn.classList.add('hidden');
    if (dropdown) { dropdown.classList.add('hidden'); dropdown.innerHTML = ''; }
    saveFormState();
}

function getFullCollegeName(abbr) {
    if (!taDatabase || !taDatabase.abbreviations) return abbr;
    const match = taDatabase.abbreviations.find(c => c.Abbreviation === abbr);
    return match ? match['Full College Name & Location'] : abbr;
}

function resolveAbbreviation(val) {
    if (!val || !taDatabase || !taDatabase.abbreviations) return val || '';
    const cleanVal = val.trim().toLowerCase();
    const match = taDatabase.abbreviations.find(a => 
        (a.Abbreviation || '').toLowerCase() === cleanVal || 
        (a['Full College Name & Location'] || '').toLowerCase() === cleanVal
    );
    return match ? match.Abbreviation : val.trim();
}

async function generateQuickJourney() {
    const fromEl = document.getElementById('quick-from');
    const toEl   = document.getElementById('quick-to');
    const fromAbbr = (fromEl.dataset.abbr || resolveAbbreviation(fromEl.value)).trim();
    const toAbbr   = (toEl.dataset.abbr   || resolveAbbreviation(toEl.value)).trim();
    const onwardDate = document.getElementById('quick-date-onward').value;
    const returnDate = document.getElementById('quick-date-return').value;
    const onwardStartTime = document.getElementById('quick-time-onward').value;
    const returnStartTime = document.getElementById('quick-time-return').value;
    
    if (!fromAbbr || !toAbbr || !onwardDate || !onwardStartTime) {
        throw new Error(`[From:${fromAbbr}][To:${toAbbr}][Date:${onwardDate}][Time:${onwardStartTime}] missing.`);
    }
    
    const tbody = document.getElementById('journey-body');
    tbody.innerHTML = "";
    
    // Show loading text
    const loadingRow = document.createElement('tr');
    loadingRow.innerHTML = `<td colspan="6" class="p-4 text-center text-gray-500">Loading route data...</td>`;
    tbody.appendChild(loadingRow);
    
    const addTimedSteps = (steps, date, startTime, isLimitedTrip = false) => {
        let currentTime = new Date(`${date}T${startTime}`);
        steps.forEach((step, idx) => {
            addJourneyRow();
            const row = tbody.lastElementChild;
            const km = parseFloat(step.KM) || 0;
            const mode = step.Mode === 'Taxi' || step.Mode === 'Special' ? 'Special' : (step.Mode === 'Train' ? 'Rail' : step.Mode);
            const speed = (mode === 'Rail') ? 60 : 40;
            const durationMin = Math.max(15, Math.round((km / speed) * 60));
            
            const format24 = (dt) => {
                const h = String(dt.getHours()).padStart(2, '0');
                const m = String(dt.getMinutes()).padStart(2, '0');
                return `${h}:${m}`;
            };
            const fromTime = format24(currentTime);
            currentTime.setMinutes(currentTime.getMinutes() + durationMin);
            const toTime = format24(currentTime);
            
            const abridgeName = (name) => {
                if (!name || name.length <= 45) return name;
                const words = name.split(/[\s,]+/).filter(Boolean);
                if (words.length <= 4) return name.substring(0, 42) + '...';
                return words.slice(0, 2).join(' ') + ' ... ' + words[words.length - 1];
            };
            
            const dateInput = row.querySelector('.journey-date-input') || row.querySelector('input[type="date"]');
            if (dateInput) dateInput.value = date;
            const depTimeIn = row.querySelector('.dep-time-input') || row.querySelectorAll('input[type="time"]')[0];
            const arrTimeIn = row.querySelector('.arr-time-input') || row.querySelectorAll('input[type="time"]')[1];
            if (depTimeIn) depTimeIn.value = fromTime;
            if (arrTimeIn) arrTimeIn.value = toTime;
            const fromIn = row.querySelector('.from-station-input') || row.querySelectorAll('input[type="text"][list="stations"]')[0];
            const toIn = row.querySelector('.to-station-input') || row.querySelectorAll('input[type="text"][list="stations"]')[1];
            if (fromIn) fromIn.value = abridgeName(step.From);
            if (toIn) toIn.value = abridgeName(step.To);
            if (row.querySelector('select')) row.querySelector('select').value = mode;
            const numInputs = row.querySelectorAll('input[type="number"]');
            if (numInputs[0]) numInputs[0].value = step.KM;
            if (numInputs[1]) {
                if (step.Fare) {
                    numInputs[1].value = step.Fare;
                    numInputs[1].dataset.auto = "false";
                } else {
                    numInputs[1].dataset.auto = "true";
                }
            }
            if (isLimitedTrip && row.querySelector('.limit-check')) {
                row.querySelector('.limit-check').checked = true;
            }
            calculateRowFare(row);
            currentTime.setMinutes(currentTime.getMinutes() + (idx < steps.length - 1 ? 10 : 0));
        });
    };

    let onwardSteps = [];
    let isLimitedTrip = false;
    
    if (fromAbbr !== toAbbr) {
        // Ensure routes for fromAbbr are loaded
        if (!loadedRoutes[fromAbbr]) {
            try {
                const res = await fetch(`routes/${fromAbbr}.json?v=` + Date.now());
                if (!res.ok) throw new Error(`HTTP error ${res.status}`);
                loadedRoutes[fromAbbr] = await res.json();
            } catch (e) {
                console.error(`Failed to load routes for ${fromAbbr}`, e);
                tbody.innerHTML = "";
                alert(`Error loading routes for college ${fromAbbr}. Please make sure database exists.`);
                return;
            }
        }
        
        const routeKey = `${fromAbbr}_${toAbbr}`;
        const legIds = loadedRoutes[fromAbbr][routeKey];
        if (legIds && legIds.length > 0) {
            let totalKm = 0;
            onwardSteps = legIds.map(legId => {
                const leg = taDatabase.legs[legId];
                if (!leg) {
                    throw new Error(`Leg ID ${legId} not found in legs database.`);
                }
                totalKm += parseFloat(leg.KM) || 0;
                return leg;
            });
            isLimitedTrip = totalKm > 0 && totalKm <= 8;
        } else {
            tbody.innerHTML = "";
            alert(`No pre-calculated route found between ${fromAbbr} and ${toAbbr}.`);
            return;
        }
    }
    
    tbody.innerHTML = "";
    
    if (onwardSteps.length > 0) {
        addTimedSteps(onwardSteps, onwardDate, onwardStartTime, isLimitedTrip);
    }
    
    if (returnDate && returnStartTime && onwardSteps.length > 0) {
        const returnSteps = [...onwardSteps].reverse().map(s => {
            return {
                ...s,
                From: s.To,
                To: s.From
            };
        });
        addTimedSteps(returnSteps, returnDate, returnStartTime, isLimitedTrip);
    }
    
    const d1 = new Date(onwardDate);
    const d2 = returnDate ? new Date(returnDate) : d1;
    const days = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;

    const fmtShort = (iso) => {
        if (!iso) return '';
        const p = iso.split('-');
        return `${p[2]}/${p[1]}/${p[0].slice(-2)}`;
    };

    if (days > 0) {
        addJourneyRow();
        const container = document.getElementById('journey-body');
        const daRow = container.lastElementChild;
        daRow.dataset.type = "DA";
        daRow.classList.add("da-card");
        daRow.querySelector('input[type="date"]').value = onwardDate;
        daRow.dataset.fromDate = onwardDate;
        daRow.dataset.toDate   = returnDate || onwardDate;
        const dateRange = returnDate && returnDate !== onwardDate
            ? `${fmtShort(onwardDate)} → ${fmtShort(returnDate)}`
            : fmtShort(onwardDate);
        const fromIn = daRow.querySelector('.from-station-input') || daRow.querySelectorAll('input[type="text"][list="stations"]')[0];
        if (fromIn) fromIn.value = `DA: ${dateRange} · ${days} Day${days > 1 ? 's' : ''}`;
        const toIn = daRow.querySelector('.to-station-input') || daRow.querySelectorAll('input[type="text"][list="stations"]')[1];
        if (toIn) toIn.closest('div') && (toIn.closest('div').style.display = 'none');
        daRow.querySelector('select') && (daRow.querySelector('select').style.display = 'none');
        const timesRow = daRow.querySelector('.times-row');
        if (timesRow) timesRow.style.display = 'none';
        const kmIn = daRow.querySelector('input[data-field="km"]');
        const fareIn = daRow.querySelector('input[data-field="fare"]');
        const daIn = daRow.querySelector('input[data-field="da"]');
        if (kmIn) kmIn.style.display = 'none';
        if (fareIn) fareIn.style.display = 'none';
        const grade = getSelectedGrade();
        const daRate = grade ? grade.daInside : 600;
        if (daIn) daIn.value = days * daRate;
        daRow.dataset.days = days;
    }
    
    updateCalculations();
}

function loadSettings() {
    const saved = localStorage.getItem('ta_bill_settings');
    appSettings = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    
    // Auto-migrate: If loaded settings are using the old model or missing minDist, force reset/merge
    if (!appSettings.misc.trainClasses || !appSettings.misc.trainClasses["II AC"] || appSettings.misc.trainClasses["II AC"].minDist === undefined) {
        appSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        localStorage.setItem('ta_bill_settings', JSON.stringify(appSettings));
    }
    
    populateGradeDropdown();
    renderSettings();
}

function populateGradeDropdown() {
    const select = document.getElementById('prof-grade');
    if (!select) return;
    select.innerHTML = '';
    appSettings.grades.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = `Grade ${g.id}`;
        select.appendChild(opt);
    });
}

function setupEventListeners() {
    document.getElementById('prof-basic-pay').addEventListener('input', () => {
        calculateGrade();
        updateCalculations();
    });

    // When prof-college changes, mirror it to quick-from (full name + abbr)
    const profCollege = document.getElementById('prof-college');
    if (profCollege) {
        const handler = () => {
            const quickFrom = document.getElementById('quick-from');
            if (quickFrom) {
                // Use stored abbreviation if available, otherwise resolve from name
                const abbr = profCollege.dataset.abbr || resolveAbbreviation(profCollege.value);
                const match = taDatabase.abbreviations.find(a => a.Abbreviation === abbr);
                quickFrom.value = match ? match['Full College Name & Location'] : profCollege.value;
                quickFrom.dataset.abbr = abbr;
                // Sync quick-from clear button
                const qfClear = document.getElementById('quick-from-clear');
                if (qfClear) qfClear.classList.toggle('hidden', !quickFrom.value);
                saveFormState();
            }
        };
        profCollege.addEventListener('change', handler);
        document.getElementById('prof-college-dropdown') &&
            document.getElementById('prof-college-dropdown').addEventListener('mousedown', () => {
                setTimeout(handler, 0);
            });
    }

    persistIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', saveFormState);
            el.addEventListener('change', saveFormState);
        }
    });

    const journeyBody = document.getElementById('journey-body');
    if (journeyBody) {
        journeyBody.addEventListener('input', saveFormState);
        journeyBody.addEventListener('change', saveFormState);
    }
}

function calculateGrade() {
    const pay = parseFloat(document.getElementById('prof-basic-pay').value) || 0;
    const grade = appSettings.grades.find(g => pay >= g.minPay);
    document.getElementById('prof-grade').value = grade ? grade.id : "IV";
}

function addJourneyRow() {
    const container = document.getElementById('journey-body');
    const rowId = Date.now() + Math.random();

    // Use a div card instead of a table row
    const card = document.createElement('div');
    card.id = `row-${rowId}`;
    card.className = 'journey-card';
    card.dataset.type = 'journey';

    card.innerHTML = `
        <!-- Top row: Date & Delete -->
        <div class="flex justify-between items-center mb-2.5">
            <div class="w-1/2">
                <div class="field-label">Journey Date</div>
                <input type="date" class="journey-date-input w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:border-blue-400 outline-none">
            </div>
            <button onclick="removeRow('${rowId}')" class="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition self-end">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        </div>

        <!-- Stations Row (From / To) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-2.5">
            <div>
                <div class="field-label">From Station / College</div>
                <input type="text" list="stations" placeholder="From station" class="from-station-input w-full mt-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:border-blue-400 outline-none" oninput="handleStationInput(this)">
            </div>
            <div>
                <div class="field-label">To Station / College</div>
                <input type="text" list="stations" placeholder="To station" class="to-station-input w-full mt-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:border-blue-400 outline-none" oninput="handleStationInput(this)">
            </div>
        </div>

        <!-- Times Row (From Time / To Time) -->
        <div class="grid grid-cols-2 gap-2.5 mb-2.5 times-row">
            <div>
                <div class="field-label">Departure Time (From)</div>
                <input type="time" class="dep-time-input w-full mt-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:border-blue-400 outline-none" oninput="updateCalculations()">
            </div>
            <div>
                <div class="field-label">Arrival Time (To)</div>
                <input type="time" class="arr-time-input w-full mt-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:border-blue-400 outline-none" oninput="updateCalculations()">
            </div>
        </div>

        <!-- Fare & Details Row -->
        <div class="grid grid-cols-4 gap-2 mb-1">
            <div>
                <div class="field-label">Mode</div>
                <select class="w-full mt-1 border border-gray-200 rounded-lg px-1.5 py-1.5 text-xs bg-white focus:border-blue-400 outline-none" onchange="calculateRowFare(this.closest('.journey-card'))">
                    <option value="Special">Special</option>
                    <option value="Rail">Rail</option>
                    <option value="Bus">Bus</option>
                    <option value="Air">Air</option>
                </select>
            </div>
            <div>
                <div class="field-label">KM</div>
                <input type="number" data-field="km" placeholder="0" class="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:border-blue-400 outline-none text-right" oninput="calculateRowFare(this.closest('.journey-card'))">
            </div>
            <div>
                <div class="field-label">Fare ₹</div>
                <input type="number" data-field="fare" placeholder="0" class="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:border-blue-400 outline-none text-right" oninput="handleFareManual(this)">
            </div>
            <div>
                <div class="field-label">DA ₹</div>
                <input type="number" data-field="da" placeholder="0" class="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:border-blue-400 outline-none text-right" oninput="updateCalculations()">
            </div>
        </div>
        <!-- Validation Error Message -->
        <div class="error-msg text-[10px] text-red-500 mt-2 hidden font-semibold bg-red-50 px-2 py-1.5 rounded-lg border border-red-200"></div>
        <!-- Hidden limit-check (set programmatically by Quick Journey for ≤8km trips) -->
        <input type="checkbox" class="limit-check hidden" onchange="calculateRowFare(this.closest('.journey-card'))">
    `;

    container.appendChild(card);
    ensureDatalist();
}

function removeRow(id) {
    const row = document.getElementById(`row-${id}`);
    if (row) row.remove();
    updateCalculations();
}

function ensureDatalist() {
    if (document.getElementById('stations')) return;
    const dl = document.createElement('datalist');
    dl.id = 'stations';
    const stations = new Set();
    if (taDatabase.legs) {
        Object.values(taDatabase.legs).forEach(leg => {
            if (leg.From) stations.add(leg.From);
            if (leg.To) stations.add(leg.To);
        });
    }
    stations.forEach(s => { const opt = document.createElement('option'); opt.value = s; dl.appendChild(opt); });
    document.body.appendChild(dl);
}

function handleStationInput(input) {
    const row = input.closest('.journey-card');
    if (!row) return;
    const fromInput = row.querySelector('.from-station-input') || row.querySelectorAll('input[type="text"][list="stations"]')[0];
    const toInput = row.querySelector('.to-station-input') || row.querySelectorAll('input[type="text"][list="stations"]')[1];
    const from = fromInput ? fromInput.value : '';
    const to = toInput ? toInput.value : '';
    if (from && to) {
        let leg = null;
        if (taDatabase.legs) {
            leg = Object.values(taDatabase.legs).find(l => 
                (l.From === from && l.To === to) || (l.From === to && l.To === from)
            );
        }
        if (leg) {
            const kmInput = row.querySelector('input[placeholder="KM"], input[placeholder="0"][oninput*="calculateRowFare"]');
            if (kmInput) kmInput.value = leg.KM;
            const sel = row.querySelector('select');
            if (sel) sel.value = leg.Mode === 'Taxi' || leg.Mode === 'Special' ? 'Special' : (leg.Mode === 'Train' ? 'Rail' : leg.Mode);
            const fareInput = row.querySelector('input[data-field="fare"]');
            if (fareInput) {
                if (leg.Fare) {
                    fareInput.value = leg.Fare;
                    fareInput.dataset.auto = "false";
                } else {
                    fareInput.dataset.auto = "true";
                }
            }
            calculateRowFare(row);
        }
    }
}

function handleFareManual(input) {
    input.dataset.auto = "false";
    updateCalculations();
}

function calculateRowFare(row) {
    if (!row || row.dataset.type === "DA") return;
    const kmInput  = row.querySelector('input[data-field="km"]');
    const fareInput = row.querySelector('input[data-field="fare"]');
    const daInput  = row.querySelector('input[data-field="da"]');
    const km = parseFloat(kmInput ? kmInput.value : 0) || 0;
    const mode = row.querySelector('select') ? row.querySelector('select').value : 'Special';
    
    if (!fareInput) return;
    if (fareInput.dataset.auto !== "false") {
        let isLimited = row.querySelector('.limit-check') && row.querySelector('.limit-check').checked;
        if (isLimited) {
            fareInput.value = "0.00";
        } else if (mode === 'Rail') {
            const grade = getSelectedGrade();
            const trainClass = grade ? grade.trainClass : "II Class";
            const rates = (appSettings.misc.trainClasses && appSettings.misc.trainClasses[trainClass])
                ? appSettings.misc.trainClasses[trainClass]
                : { minDist: 50, base: 30, perKm: 0.40 };
            const minDist = rates.minDist !== undefined ? rates.minDist : 50;
            const baseFare = rates.base || 0;
            const perKmRate = rates.perKm || 0;
            const chargeableDist = Math.max(minDist, km);
            fareInput.value = Math.round(baseFare + (chargeableDist * perKmRate));
        } else if (mode === 'Special' || mode === 'Bus') {
            const grade = getSelectedGrade();
            const roadRate = (grade && grade.roadRate !== undefined) ? grade.roadRate : appSettings.misc.specialConveyanceRate;
            fareInput.value = (km * roadRate).toFixed(2);
        }
        fareInput.dataset.auto = "true";
    }
    updateCalculations();
}

function updateCalculations() {
    if (typeof validateTimeStream === 'function') {
        validateTimeStream();
    }
    let total = 0;
    document.querySelectorAll('#journey-body .journey-card').forEach(row => {
        const daIn = row.querySelector('input[data-field="da"]');
        if (row.dataset.type === "DA") {
            total += parseFloat(daIn ? daIn.value : 0) || 0;
        } else {
            const kmIn = row.querySelector('input[data-field="km"]');
            const fareIn = row.querySelector('input[data-field="fare"]');
            const km = parseFloat(kmIn ? kmIn.value : 0) || 0;
            const fare = parseFloat(fareIn ? fareIn.value : 0) || 0;
            const da = parseFloat(daIn ? daIn.value : 0) || 0;
            const mode = row.querySelector('select') ? row.querySelector('select').value : 'Special';
            let isLimited = row.querySelector('.limit-check') && row.querySelector('.limit-check').checked;
            let rowTotal = 0;
            if (!isLimited) {
                rowTotal = (mode === 'Rail') ? (fare + (km * appSettings.misc.trainIncidentalRate)) : fare;
            }
            total += rowTotal + da;
        }
    });
    document.getElementById('total-amount').innerText = `₹ ${total.toFixed(2)}`;
    
    if (typeof saveFormState === 'function') {
        clearTimeout(window._saveTimeout);
        window._saveTimeout = setTimeout(saveFormState, 500);
    }
}

function validateTimeStream() {
    const rows = document.querySelectorAll('#journey-body .journey-card');
    let prevEndDateTime = null;
    
    rows.forEach(row => {
        // Clear previous error styles
        row.classList.remove('border-red-400', 'bg-red-50/30');
        const errDiv = row.querySelector('.error-msg');
        if (errDiv) {
            errDiv.classList.add('hidden');
            errDiv.innerText = '';
        }
        
        if (row.dataset.type === "DA") return; // Skip DA rows for order check
        
        const dateVal = row.querySelector('input[type="date"]').value;
        const timeInputs = row.querySelectorAll('input[type="time"]');
        const fromTimeVal = timeInputs[0] ? timeInputs[0].value : "";
        const toTimeVal = timeInputs[1] ? timeInputs[1].value : "";
        
        if (!dateVal || !fromTimeVal || !toTimeVal) return;
        
        const start = new Date(`${dateVal}T${fromTimeVal}`);
        const end = new Date(`${dateVal}T${toTimeVal}`);
        
        let hasError = false;
        let errMsg = "";
        
        if (end < start) {
            hasError = true;
            errMsg = "To Time must be after From Time.";
        } else if (prevEndDateTime && start < prevEndDateTime) {
            hasError = true;
            errMsg = `Time conflict: Starts at ${fromTimeVal} but previous leg ended at ${prevEndDateTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}.`;
        }
        
        if (hasError) {
            row.classList.add('border-red-400', 'bg-red-50/30');
            if (errDiv) {
                errDiv.innerText = errMsg;
                errDiv.classList.remove('hidden');
            }
        }
        
        if (!hasError) {
            prevEndDateTime = end;
        }
    });
}

function numberToWords(num) {
    if (num === 0) return 'Zero';
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const inWords = (n) => {
        if ((n = n.toString()).length > 9) return 'overflow';
        n = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!n) return ''; var str = '';
        str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
        str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
        str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
        str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
        str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
        return str.trim();
    };
    let whole = Math.floor(num);
    let decimal = Math.round((num - whole) * 100);
    let res = inWords(whole) + ' Rupees';
    if (decimal > 0) { res += ' and ' + inWords(decimal) + ' Paise'; }
    return res;
}

function openSettings() { document.getElementById('settings-modal').classList.remove('hidden'); }
function closeSettings() { document.getElementById('settings-modal').classList.add('hidden'); }
function renderSettings() {
    const c = document.getElementById('settings-content');
    let h = `<div class="space-y-4"><h3 class="font-bold text-sm text-gray-500 uppercase border-b pb-2">Grade Rules</h3>`;
    appSettings.grades.forEach((g, i) => {
        h += `<div class="grid grid-cols-6 gap-2 items-center bg-gray-50 p-3 rounded border">
            <div class="font-bold text-blue-800">${g.id}</div>
            <div><label class="text-[9px] uppercase font-bold">Min Pay</label><input type="number" value="${g.minPay}" class="form-input p-1 text-xs" onchange="updateSetting('grades', ${i}, 'minPay', this.value)"></div>
            <div><label class="text-[9px] uppercase font-bold">Road/KM</label><input type="number" step="0.01" value="${g.roadRate}" class="form-input p-1 text-xs" onchange="updateSetting('grades', ${i}, 'roadRate', this.value)"></div>
            <div><label class="text-[9px] uppercase font-bold">Train</label><input type="text" value="${g.trainClass}" class="form-input p-1 text-xs" onchange="updateSetting('grades', ${i}, 'trainClass', this.value)"></div>
            <div><label class="text-[9px] uppercase font-bold">DA In</label><input type="number" value="${g.daInside}" class="form-input p-1 text-xs" onchange="updateSetting('grades', ${i}, 'daInside', this.value)"></div>
            <div><label class="text-[9px] uppercase font-bold">DA Out</label><input type="number" value="${g.daOutside}" class="form-input p-1 text-xs" onchange="updateSetting('grades', ${i}, 'daOutside', this.value)"></div>
        </div>`;
    });
    h += `<h3 class="font-bold text-sm text-gray-500 uppercase border-b pb-2 mt-6">Train Class Fares</h3>
        <div class="space-y-2">`;
    if (appSettings.misc.trainClasses) {
        Object.keys(appSettings.misc.trainClasses).forEach(cls => {
            const rates = appSettings.misc.trainClasses[cls];
            h += `<div class="grid grid-cols-4 gap-2 items-center bg-gray-50 p-2 rounded border">
                <div class="font-bold text-gray-700 text-xs">${cls}</div>
                <div><label class="text-[9px] uppercase font-bold">Min Dist (Km)</label><input type="number" value="${rates.minDist !== undefined ? rates.minDist : 50}" class="form-input p-1 text-xs" onchange="updateSetting('trainClasses', '${cls}', 'minDist', this.value)"></div>
                <div><label class="text-[9px] uppercase font-bold">Base Fare</label><input type="number" value="${rates.base}" class="form-input p-1 text-xs" onchange="updateSetting('trainClasses', '${cls}', 'base', this.value)"></div>
                <div><label class="text-[9px] uppercase font-bold">Per KM Rate</label><input type="number" step="0.01" value="${rates.perKm}" class="form-input p-1 text-xs" onchange="updateSetting('trainClasses', '${cls}', 'perKm', this.value)"></div>
            </div>`;
        });
    }
    h += `</div>`;
    
    h += `<h3 class="font-bold text-sm text-gray-500 uppercase border-b pb-2 mt-6">Misc Rates</h3>
        <div class="grid grid-cols-3 gap-4">
            <div><label class="text-[10px] uppercase font-bold">Road Mileage</label><input type="number" step="0.01" value="${appSettings.misc.specialConveyanceRate}" class="form-input" onchange="updateSetting('misc', 'specialConveyanceRate', null, this.value)"></div>
            <div><label class="text-[10px] uppercase font-bold">Incidental</label><input type="number" step="0.01" value="${appSettings.misc.trainIncidentalRate}" class="form-input" onchange="updateSetting('misc', 'trainIncidentalRate', null, this.value)"></div>
        </div></div>`;
    c.innerHTML = h;
}
function updateSetting(s, i, k, v) { 
    if (s === 'grades') {
        appSettings.grades[i][k] = k === 'trainClass' ? v : parseFloat(v); 
    } else if (s === 'trainClasses') {
        if (!appSettings.misc.trainClasses) appSettings.misc.trainClasses = {};
        if (!appSettings.misc.trainClasses[i]) appSettings.misc.trainClasses[i] = {};
        appSettings.misc.trainClasses[i][k] = k === 'minDist' ? parseInt(v) : parseFloat(v);
    } else {
        appSettings.misc[i] = parseFloat(v); 
    }
}
function saveSettings() { localStorage.setItem('ta_bill_settings', JSON.stringify(appSettings)); closeSettings(); populateGradeDropdown(); calculateGrade(); updateCalculations(); }
function resetRates() { if (confirm("Reset to defaults?")) { appSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); populateGradeDropdown(); renderSettings(); saveSettings(); } }
function clearQuickFields() {
    clearCollegeField('quick-from');
    clearCollegeField('quick-to');
    const od = document.getElementById('quick-date-onward'); if (od) od.value = '';
    const rd = document.getElementById('quick-date-return'); if (rd) rd.value = '';
    const ot = document.getElementById('quick-time-onward'); if (ot) ot.value = '08:00';
    const rt = document.getElementById('quick-time-return'); if (rt) rt.value = '16:00';
    saveFormState();
}

init();

window.generatePdfFromAndroid = async function(profileJson, journeyJson) {
    try {
        await dbReadyPromise;

        const profile = JSON.parse(profileJson);
        const journey = JSON.parse(journeyJson);
        
        document.getElementById('prof-name').value = profile.name || '';
        document.getElementById('prof-designation').value = profile.designation || '';
        document.getElementById('prof-basic-pay').value = profile.basicPay || '';
        document.getElementById('prof-acc-no').value = profile.acNo || '';
        document.getElementById('prof-bank-ifsc').value = profile.ifsc || '';
        document.getElementById('prof-address').value = profile.address || '';
        document.getElementById('prof-college').value = profile.baseCollege || '';
        document.getElementById('bill-purpose').value = journey.purpose || '';

        document.getElementById('quick-from').value = journey.fromCollege || '';
        document.getElementById('quick-to').value = journey.toCollege || '';
        document.getElementById('quick-date-onward').value = journey.dateOnward || '';
        document.getElementById('quick-time-onward').value = journey.timeOnward || '';
        document.getElementById('quick-date-return').value = journey.dateReturn || '';
        document.getElementById('quick-time-return').value = journey.timeReturn || '';
        
        calculateGrade();
        await generateQuickJourney();

        let base64Result = await Promise.resolve(generatePDF());
        
        if (base64Result) {
            if (base64Result.includes("base64,")) {
                base64Result = base64Result.split("base64,")[1];
            } else if (base64Result.startsWith("data:")) {
                const commaIdx = base64Result.indexOf(",");
                if (commaIdx !== -1) {
                    base64Result = base64Result.substring(commaIdx + 1);
                }
            }
        } else {
            base64Result = "ERROR: generatePDF returned nothing.";
        }
        if (window.AndroidBridge) {
            window.AndroidBridge.onPdfGenerated(base64Result);
        }
    } catch (e) {
        if (window.AndroidBridge) {
            window.AndroidBridge.onPdfGenerated('ERROR: ' + e.message);
        }
    }
};
