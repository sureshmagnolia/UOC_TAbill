// ta-bill-app/app.js

let taDatabase = { abbreviations: [], routes: [] };
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
    document.querySelectorAll('#journey-body tr').forEach(row => {
        if (row.dataset.type === "DA") {
            journeys.push({
                type: "DA",
                date: row.querySelector('input[type="date"]').value,
                fromDate: row.dataset.fromDate || row.querySelector('input[type="date"]').value,
                toDate: row.dataset.toDate || row.querySelector('input[type="date"]').value,
                daDays: row.dataset.days,
                daAmt: row.querySelector('input[placeholder="DA"]').value
            });
        } else {
            journeys.push({
                type: "journey",
                date: row.querySelector('input[type="date"]').value,
                ft: row.querySelector('input[placeholder="FT"]').value,
                tt: row.querySelector('input[placeholder="TT"]').value,
                from: row.querySelector('input[placeholder="From"]').value,
                to: row.querySelector('input[placeholder="To"]').value,
                mode: row.querySelector('select').value,
                km: row.querySelector('input[placeholder="KM"]').value,
                fare: row.querySelector('input[placeholder="Fare"]').value,
                fareAuto: row.querySelector('input[placeholder="Fare"]').dataset.auto,
                da: row.querySelector('input[placeholder="DA"]').value,
                isLimited: row.querySelector('.limit-check') ? row.querySelector('.limit-check').checked : false
            });
        }
    });
    state.journeys = journeys;

    localStorage.setItem('ta_form_state', JSON.stringify(state));
}

function loadFormState() {
    const stateStr = localStorage.getItem('ta_form_state');
    let loadedJourneys = false;
    if (stateStr) {
        try {
            const state = JSON.parse(stateStr);
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
                const tbody = document.getElementById('journey-body');
                tbody.innerHTML = '';
                state.journeys.forEach(j => {
                    addJourneyRow();
                    const row = tbody.lastElementChild;
                    if (j.type === "DA") {
                        row.dataset.type = "DA";
                        row.classList.add("bg-blue-50", "font-bold");
                        const fromDate = j.fromDate || j.date || '';
                        const toDate   = j.toDate   || j.date || '';
                        row.querySelector('input[type="date"]').value = fromDate;
                        row.dataset.fromDate = fromDate;
                        row.dataset.toDate   = toDate;
                        // Rebuild date-range label
                        const fmtS = (iso) => { if (!iso) return ''; const p = iso.split('-'); return `${p[2]}/${p[1]}/${p[0].slice(-2)}`; };
                        const days = j.daDays || 1;
                        const rangeStr = toDate && toDate !== fromDate
                            ? `${fmtS(fromDate)} → ${fmtS(toDate)}`
                            : fmtS(fromDate);
                        row.querySelector('input[placeholder="From"]').value =
                            `DA: ${rangeStr} · ${days} Day${days > 1 ? 's' : ''}`;
                        row.querySelector('input[placeholder="To"]').classList.add("hidden");
                        row.querySelector('input[placeholder="KM"]').classList.add("hidden");
                        row.querySelector('select').classList.add("hidden");
                        row.querySelector('input[placeholder="Fare"]').classList.add("hidden");
                        row.querySelector('input[placeholder="DA"]').value = j.daAmt || '';
                        row.dataset.days = days;
                    } else {
                        row.querySelector('input[type="date"]').value = j.date || '';
                        row.querySelector('input[placeholder="FT"]').value = j.ft || '';
                        row.querySelector('input[placeholder="TT"]').value = j.tt || '';
                        row.querySelector('input[placeholder="From"]').value = j.from || '';
                        row.querySelector('input[placeholder="To"]').value = j.to || '';
                        row.querySelector('select').value = j.mode || 'Special';
                        row.querySelector('input[placeholder="KM"]').value = j.km || '';
                        row.querySelector('input[placeholder="Fare"]').value = j.fare || '';
                        row.querySelector('input[placeholder="Fare"]').dataset.auto = j.fareAuto || 'true';
                        row.querySelector('input[placeholder="DA"]').value = j.da || '';
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
        trainBaseFare: 120, // Default base/reservation/surcharge
        railFarePerKM: 1.60, // Estimated 2nd AC rate
        minRailFare: 750, // Minimum 2nd AC rail fare
        minDistanceForTA: 8, // km
    }
};

function getSelectedGrade() {
    const gradeSelect = document.getElementById('prof-grade');
    const gradeId = gradeSelect ? gradeSelect.value : "IV";
    return appSettings.grades.find(g => g.id === gradeId) || appSettings.grades[appSettings.grades.length - 1];
}

// Route cache: stores pre-flattened { routeId: [legObj,...] } per source college
const _routeCache = {};

/**
 * Lazy-loads routes for a given source college abbreviation.
 * Returns an array of flat route objects: { Route_ID, From, To, Mode, KM, ... }
 * Caches results so the file is only fetched once per session.
 */
async function loadRoutesFor(fromAbbr) {
    if (_routeCache[fromAbbr]) return _routeCache[fromAbbr];
    try {
        const routeMap = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', `routes/${fromAbbr}.json`, true);
            xhr.onload = function() {
                if (xhr.status === 200 || xhr.status === 0) {
                    try { resolve(JSON.parse(xhr.responseText)); }
                    catch(e) { reject(e); }
                } else { reject(new Error('XHR ' + xhr.status)); }
            };
            xhr.onerror = () => reject(new Error('XHR network error'));
            xhr.send();
        });
        // Flatten into array for compatibility with existing generateQuickJourney
        const flat = [];
        Object.keys(routeMap).forEach(routeId => {
            routeMap[routeId].forEach((leg, idx) => {
                flat.push({ Route_ID: routeId, Step: String(idx + 1), ...leg });
            });
        });
        _routeCache[fromAbbr] = flat;
        return flat;
    } catch(e) {
        console.error('Failed to load routes for', fromAbbr, e);
        return [];
    }
}

// Initialize App
async function init() {
    try {
        // Load abbreviations only (~60KB) — routes are lazy-loaded per college
        const abbrevs = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', 'ta_abbrevs.json', true);
            xhr.onload = function() {
                if (xhr.status === 200 || xhr.status === 0) {
                    try { resolve(JSON.parse(xhr.responseText)); }
                    catch(e) { reject(e); }
                } else { reject(new Error('XHR ' + xhr.status)); }
            };
            xhr.onerror = () => reject(new Error('XHR network error'));
            xhr.send();
        });
        taDatabase.abbreviations = abbrevs;
        populateCollegeDropdowns();
    } catch (e) {
        console.error("Failed to load abbreviations", e);
    }
    // Signal ready — routes are loaded on demand
    if (_dbReadyResolve) { _dbReadyResolve(); _dbReadyResolve = null; }

    loadSettings();
    setupEventListeners();

    // Set up custom autocomplete for college fields (web only)
    setupCollegeAutocomplete('quick-from');
    setupCollegeAutocomplete('quick-to');
    setupCollegeAutocomplete('prof-college');

    const loaded = loadFormState();

    // Default Quick From on startup if empty — show full college name
    const quickFrom = document.getElementById('quick-from');
    const profCollege = document.getElementById('prof-college');
    if (quickFrom && profCollege && !quickFrom.value && profCollege.value) {
        const abbr = profCollege.value;
        const match = taDatabase.abbreviations.find(a => a.Abbreviation === abbr);
        quickFrom.value = match ? match['Full College Name & Location'] : abbr;
        quickFrom.dataset.abbr = abbr;
    }

    // Sync clear-button visibility after state is restored
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

/**
 * Custom autocomplete for college search fields.
 * Dropdown appears only after 3+ characters are typed.
 */
function setupCollegeAutocomplete(inputId) {
    const input = document.getElementById(inputId);
    const clearBtn = document.getElementById(inputId + '-clear');
    const dropdown = document.getElementById(inputId + '-dropdown');
    if (!input || !dropdown) return;

    // Sync clear-button visibility with current value
    const syncClear = () => {
        if (clearBtn) clearBtn.classList.toggle('hidden', !input.value);
    };
    syncClear();

    input.addEventListener('input', () => {
        // When user types, clear any previously selected abbreviation
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

    // Select item from dropdown — show full name, store abbreviation in data-abbr
    dropdown.addEventListener('mousedown', e => {
        const item = e.target.closest('[data-abbr]');
        if (!item) return;
        e.preventDefault(); // prevent blur before click fires
        input.value = item.dataset.full || item.dataset.abbr; // display full name
        input.dataset.abbr = item.dataset.abbr;               // store abbr for routing
        syncClear();
        dropdown.classList.add('hidden');
        saveFormState();
    });

    // Clear button
    if (clearBtn) {
        clearBtn.addEventListener('click', () => clearCollegeField(inputId));
    }

    // Close on outside click
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

async function generateQuickJourney() {
    const fromEl = document.getElementById('quick-from');
    const toEl   = document.getElementById('quick-to');
    // Use stored abbreviation if available (custom autocomplete), else fall back to raw value
    const fromAbbr = (fromEl.dataset.abbr || fromEl.value).trim();
    const toAbbr   = (toEl.dataset.abbr   || toEl.value).trim();
    const onwardDate = document.getElementById('quick-date-onward').value;
    const returnDate = document.getElementById('quick-date-return').value;
    const onwardStartTime = document.getElementById('quick-time-onward').value;
    const returnStartTime = document.getElementById('quick-time-return').value;
    
    if (!fromAbbr || !toAbbr || !onwardDate || !onwardStartTime) {
        throw new Error(`[From:${fromAbbr}][To:${toAbbr}][Date:${onwardDate}][Time:${onwardStartTime}] missing.`);
    }
    
    const tbody = document.getElementById('journey-body');
    tbody.innerHTML = ""; // Clear existing
    
    const addTimedSteps = (steps, date, startTime, isLimitedTrip = false) => {
        let currentTime = new Date(`${date}T${startTime}`);
        
        steps.forEach((step, idx) => {
            addJourneyRow();
            const row = tbody.lastElementChild;
            const km = parseFloat(step.KM) || 0;
            const mode = step.Mode === 'Taxi' || step.Mode === 'Special' ? 'Special' : (step.Mode === 'Train' ? 'Rail' : step.Mode);
            
            const speed = (mode === 'Rail') ? 60 : 40;
            const durationMin = Math.max(15, Math.round((km / speed) * 60));
            
            const fromTime = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            currentTime.setMinutes(currentTime.getMinutes() + durationMin);
            const toTime = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            
            const abridgeName = (name) => {
                if (!name || name.length <= 45) return name;
                const words = name.split(' ');
                if (words.length <= 4) return name.substring(0, 42) + '...';
                return words.slice(0, 2).join(' ') + ' ... ' + words.slice(-2).join(' ');
            };
            
            row.querySelector('input[type="date"]').value = date;
            row.querySelector('input[placeholder="FT"]').value = fromTime;
            row.querySelector('input[placeholder="TT"]').value = toTime;
            row.querySelector('input[placeholder="From"]').value = abridgeName(step.From);
            row.querySelector('input[placeholder="To"]').value = abridgeName(step.To);
            row.querySelector('select').value = mode;
            row.querySelector('input[placeholder="KM"]').value = step.KM;
            
            if (step.Fare) {
                row.querySelector('input[placeholder="Fare"]').value = step.Fare;
                row.querySelector('input[placeholder="Fare"]').dataset.auto = "false";
            } else {
                row.querySelector('input[placeholder="Fare"]').dataset.auto = "true";
            }
            if (isLimitedTrip && row.querySelector('.limit-check')) {
                row.querySelector('.limit-check').checked = true;
            }

            calculateRowFare(row);

            // Add buffer for next segment
            currentTime.setMinutes(currentTime.getMinutes() + (idx < steps.length - 1 ? 10 : 0));
        });
    };

    // 1. If From and To are the same college, skip route lookup — generate DA only
    //    (prevents self-route entries like CTR_CTR from appearing as journey legs)
    const sameCollege = fromAbbr === toAbbr;

    // 2. Load routes for source college (lazy, cached) — only if needed
    const fromRoutes = sameCollege ? [] : await loadRoutesFor(fromAbbr);

    // 3. Onward
    const onwardRouteId = `${fromAbbr}_${toAbbr}`;
    const onwardSteps = sameCollege ? [] : fromRoutes.filter(r => r.Route_ID === onwardRouteId);
    let totalKm = onwardSteps.reduce((sum, step) => sum + parseFloat(step.KM || 0), 0);
    let isLimitedTrip = totalKm > 0 && totalKm <= 8;

    if (onwardSteps.length > 0) {
        addTimedSteps(onwardSteps, onwardDate, onwardStartTime, isLimitedTrip);
    }

    // 4. Return — simply reverse the onward steps to guarantee exact symmetry
    if (returnDate && returnStartTime && onwardSteps.length > 0) {
        const returnSteps = [...onwardSteps].reverse().map(s => ({
            ...s,
            From: s.To,
            To: s.From
        }));
        addTimedSteps(returnSteps, returnDate, returnStartTime, isLimitedTrip);
    }

    // 5. Auto-Calculate DA
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
        const daRow = tbody.lastElementChild;
        daRow.dataset.type = "DA";
        daRow.classList.add("bg-blue-50", "font-bold");
        // Date column → onward date (start of duty)
        daRow.querySelector('input[type="date"]').value = onwardDate;
        // Store return date for save/load and PDF
        daRow.dataset.fromDate = onwardDate;
        daRow.dataset.toDate   = returnDate || onwardDate;
        // Show full date range in the From field
        const dateRange = returnDate && returnDate !== onwardDate
            ? `${fmtShort(onwardDate)} → ${fmtShort(returnDate)}`
            : fmtShort(onwardDate);
        daRow.querySelector('input[placeholder="From"]').value =
            `DA: ${dateRange} · ${days} Day${days > 1 ? 's' : ''}`;
        daRow.querySelector('input[placeholder="To"]').classList.add("hidden");
        daRow.querySelector('input[placeholder="KM"]').classList.add("hidden");
        daRow.querySelector('select').classList.add("hidden");
        daRow.querySelector('input[placeholder="Fare"]').classList.add("hidden");
        const grade = getSelectedGrade();
        const daRate = grade ? grade.daInside : 600;
        daRow.querySelector('input[placeholder="DA"]').value = days * daRate;
        daRow.dataset.days = days;
    }
    
    updateCalculations();
}

function loadSettings() {
    const saved = localStorage.getItem('ta_bill_settings');
    appSettings = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
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
                // Use stored abbreviation if available, otherwise raw value
                const abbr = profCollege.dataset.abbr || profCollege.value;
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
        // Also fire when autocomplete selects (mousedown triggers saveFormState,
        // but we still need quick-from updated — use a MutationObserver-free trick:
        // setupCollegeAutocomplete fires saveFormState; we hook via the dropdown blur)
        document.getElementById('prof-college-dropdown') &&
            document.getElementById('prof-college-dropdown').addEventListener('mousedown', () => {
                // defer until after the mousedown handler in setupCollegeAutocomplete sets the value
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
    const tbody = document.getElementById('journey-body');
    const rowId = Date.now() + Math.random();
    const tr = document.createElement('tr');
    tr.id = `row-${rowId}`;
    tr.className = "hover:bg-gray-50 transition border-b";
    
    tr.innerHTML = `
        <td class="p-1">
            <input type="date" class="form-input text-[10px] p-1 border-none bg-transparent">
            <div class="flex gap-1 mt-1 justify-center">
                <input type="text" placeholder="FT" class="form-input text-[9px] p-0 w-12 border-none bg-transparent opacity-50 text-center" oninput="updateCalculations()">
                <input type="text" placeholder="TT" class="form-input text-[9px] p-0 w-12 border-none bg-transparent opacity-50 text-center" oninput="updateCalculations()">
            </div>
        </td>
        <td class="p-1">
            <input type="text" list="stations" class="form-input text-xs p-1 border-none bg-transparent" placeholder="From" oninput="handleStationInput(this)">
        </td>
        <td class="p-1">
            <input type="text" list="stations" class="form-input text-xs p-1 border-none bg-transparent" placeholder="To" oninput="handleStationInput(this)">
        </td>
        <td class="p-1">
            <select class="form-input text-xs p-1 border-none bg-transparent appearance-none" onchange="calculateRowFare(this.closest('tr'))">
                <option value="Special">Special</option>
                <option value="Rail">Rail</option>
                <option value="Bus">Bus</option>
                <option value="Air">Air</option>
            </select>
        </td>
        <td class="p-1">
            <div class="flex items-center justify-end bg-transparent">
                <input type="number" class="form-input w-12 text-right text-xs p-1 border-none bg-transparent" placeholder="KM" oninput="calculateRowFare(this.closest('tr'))">
                <span class="text-[9px] text-gray-500 font-medium px-1">Km</span>
            </div>
            <div class="text-[8px] text-gray-400 text-center mt-1 leading-tight"><input type="checkbox" class="limit-check align-middle" onchange="calculateRowFare(this.closest('tr'))"> ≤8km</div>
        </td>
        <td class="p-1">
            <div class="flex items-center justify-end bg-transparent">
                <span class="text-[9px] text-gray-500 font-medium px-1">Rs</span>
                <input type="number" class="form-input w-16 text-right text-xs p-1 border-none bg-transparent" placeholder="Fare" oninput="handleFareManual(this)">
            </div>
        </td>
        <td class="p-1">
            <div class="flex items-center justify-end bg-transparent">
                <span class="text-[9px] text-gray-500 font-medium px-1">Rs</span>
                <input type="number" class="form-input w-16 text-right text-xs p-1 border-none bg-transparent" placeholder="DA" oninput="updateCalculations()">
            </div>
        </td>
        <td class="p-1 text-center">
            <button onclick="removeRow('${rowId}')" class="text-red-300 hover:text-red-500">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        </td>
    `;
    
    tbody.appendChild(tr);
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
    taDatabase.routes.forEach(r => { stations.add(r.From); stations.add(r.To); });
    stations.forEach(s => { const opt = document.createElement('option'); opt.value = s; dl.appendChild(opt); });
    document.body.appendChild(dl);
}

function handleStationInput(input) {
    const row = input.closest('tr');
    const from = row.querySelector('input[placeholder="From"]').value;
    const to = row.querySelector('input[placeholder="To"]').value;
    if (from && to) {
        const route = taDatabase.routes.find(r => (r.From === from && r.To === to) || (r.From === to && r.To === from));
        if (route) {
            row.querySelector('input[placeholder="KM"]').value = route.KM;
            row.querySelector('select').value = route.Mode === 'Taxi' || route.Mode === 'Special' ? 'Special' : (route.Mode === 'Train' ? 'Rail' : route.Mode);
            
            if (route.Fare) {
                row.querySelector('input[placeholder="Fare"]').value = route.Fare;
                row.querySelector('input[placeholder="Fare"]').dataset.auto = "false";
            } else {
                row.querySelector('input[placeholder="Fare"]').dataset.auto = "true";
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
    if (row.dataset.type === "DA") return;
    const kmText = row.querySelector('input[placeholder="KM"]').value;
    const km = parseFloat(kmText) || 0;
    const mode = row.querySelector('select').value;
    const fareInput = row.querySelector('input[placeholder="Fare"]');
    
    if (fareInput.dataset.auto !== "false") {
        let isLimited = row.querySelector('.limit-check') && row.querySelector('.limit-check').checked;
        if (isLimited) {
            fareInput.value = "0.00";
        } else if (mode === 'Rail') {
            const baseFare = appSettings.misc.trainBaseFare !== undefined ? appSettings.misc.trainBaseFare : 120;
            const perKmRate = appSettings.misc.railFarePerKM || 0;
            fareInput.value = Math.round(baseFare + (km * perKmRate));
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
    let total = 0;
    document.querySelectorAll('#journey-body tr').forEach(row => {
        if (row.dataset.type === "DA") {
            total += parseFloat(row.querySelector('input[placeholder="DA"]').value) || 0;
        } else {
            const kmText = row.querySelector('input[placeholder="KM"]').value;
            const km = parseFloat(kmText) || 0;
            const fare = parseFloat(row.querySelector('input[placeholder="Fare"]').value) || 0;
            const da = parseFloat(row.querySelector('input[placeholder="DA"]').value) || 0;
            const mode = row.querySelector('select').value;
            let isLimited = row.querySelector('.limit-check') && row.querySelector('.limit-check').checked;
            let rowTotal = 0;
            if (!isLimited) {
                rowTotal = (mode === 'Rail') ? (fare + (km * appSettings.misc.trainIncidentalRate)) : fare;
            }
            total += rowTotal + da;
        }
    });
    document.getElementById('total-amount').innerText = `₹ ${total.toFixed(2)}`;
    
    // Defer save to avoid blocking if called frequently
    if (typeof saveFormState === 'function') {
        clearTimeout(window._saveTimeout);
        window._saveTimeout = setTimeout(saveFormState, 500);
    }
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

// PDF & HTML Generation
function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    const getVal = (id) => document.getElementById(id).value;
    const formatDate = (d) => { if(!d) return ""; const p = d.split('-'); return `${p[2]}/${p[1]}/${p[0].slice(-2)}`; };
    
    let autoMonth = "";
    const firstDateInput = document.querySelector('#journey-body tr input[type="date"]');
    if (firstDateInput && firstDateInput.value) {
        const d = new Date(firstDateInput.value);
        autoMonth = d.toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase();
    }
    const month = autoMonth || "";

    doc.setFontSize(14); doc.text("UNIVERSITY OF CALICUT", pageWidth / 2, 40, { align: "center" });
    doc.setFontSize(12); doc.text("(PAREEKSHA BHAVAN)", pageWidth / 2, 55, { align: "center" });
    doc.setFontSize(10); doc.text(`TRAVELLING ALLOWANCE BILL FOR THE MONTH OF ${month}`, pageWidth / 2, 70, { align: "center" });

    doc.setFontSize(9);
    doc.text(`1) Name: ${getVal('prof-name')}`, 40, 90);
    doc.text(`5) Basic Pay: Rs ${getVal('prof-basic-pay')}/-`, 350, 90);
    doc.text(`2) Designation: ${getVal('prof-designation')}`, 40, 105);
    doc.text(`6) SB A/c No: ${getVal('prof-acc-no')}`, 350, 105);
    doc.text(`3) College: ${getFullCollegeName(getVal('prof-college'))}`, 40, 120);
    doc.text(`7) Bank & IFSC: ${getVal('prof-bank-ifsc')}`, 350, 120);
    doc.text(`4) Address: ${getVal('prof-address').substring(0, 40)}`, 40, 135);

    const tableData = [];
    let totalClaim = 0;
    
    let limBuf = null;
    const flushLim = (isFirst) => {
        if (!limBuf) return;
        totalClaim += limBuf.da;
        let days = (limBuf.da > 0 && limBuf.da % 600 === 0) ? limBuf.da / 600 : (limBuf.da > 0 && limBuf.da % 400 === 0 ? limBuf.da / 400 : 1);
        let rate = limBuf.da > 0 ? limBuf.da / days : 0;
        let daStr = limBuf.da > 0 ? ` for ${days} Days ${rate} X ${days} = ${limBuf.da}` : "";
        tableData.push(["", { content: `TA Limited to DA${daStr}`, colSpan: 10, styles: { halign: 'left', fontStyle: 'bold' } }, limBuf.da>0?days:"", limBuf.da||"", limBuf.da.toFixed(2), isFirst ? getVal('bill-purpose') : ""]);
        limBuf = null;
    };

    const rows = document.querySelectorAll('#journey-body tr');
    rows.forEach((row, idx) => {
        const isFirst = (idx === 0);
        if (row.dataset.type === "DA") {
            flushLim(isFirst);
            const da = parseFloat(row.querySelector('input[placeholder="DA"]').value) || 0;
            totalClaim += da;
            const days = row.dataset.days;
            const rate = da > 0 ? da / days : 0;
            const fromDate = row.dataset.fromDate || '';
            const toDate   = row.dataset.toDate   || '';
            const fmtD = (iso) => { if (!iso) return ''; const p = iso.split('-'); return `${p[2]}/${p[1]}/${p[0].slice(-2)}`; };
            const dateRangeLabel = (fromDate && toDate && fromDate !== toDate)
                ? `${fmtD(fromDate)} to ${fmtD(toDate)}`
                : fmtD(fromDate);
            const daStr = da > 0
                ? ` (${dateRangeLabel}) for ${days} Days @ ${rate} X ${days} = ${da}`
                : "";
            tableData.push(["", { content: `DA${daStr}`, colSpan: 10, styles: { halign: 'left', fontStyle: 'bold' } }, days, da.toFixed(2), da.toFixed(2), isFirst?getVal('bill-purpose'):""]);
            return;
        }
        const dateRaw = row.querySelector('input[type="date"]').value;
        const date = formatDate(dateRaw);
        const fTime = row.querySelector('input[placeholder="FT"]').value || "";
        const tTime = row.querySelector('input[placeholder="TT"]').value || "";
        const dateTime = `${date}\n${fTime}-${tTime}`;

        const from = row.querySelector('input[placeholder="From"]').value;
        const to = row.querySelector('input[placeholder="To"]').value;
        const mode = row.querySelector('select').value;
        const kmText = row.querySelector('input[placeholder="KM"]').value;
        const km = parseFloat(kmText) || 0;
        let fare = parseFloat(row.querySelector('input[placeholder="Fare"]').value) || 0;
        const da = parseFloat(row.querySelector('input[placeholder="DA"]').value) || 0;
        
        let isLimited = row.querySelector('.limit-check') && row.querySelector('.limit-check').checked;
        
        if (isLimited) {
            if (!limBuf) {
                limBuf = { dateTime: dateTime, date: date, da: da, isFirst: isFirst };
            } else {
                limBuf.da += da;
                if (!limBuf.date.includes(date)) {
                    limBuf.date += `\n${date}`;
                    limBuf.dateTime += `\n${dateTime}`;
                }
            }
        } else {
            flushLim(limBuf && limBuf.isFirst);
            let rDist = "", rdDist = "", tFare = "", iRate = "", iAmt = "", rdRate = "", rdAmt = "";
            if (mode === 'Rail') { 
                rDist = kmText || ""; 
                tFare = fare || ""; 
                iRate = appSettings.misc.trainIncidentalRate; 
                iAmt = (km ? (km * iRate).toFixed(2) : ""); 
            } else { 
                rdDist = kmText || ""; 
                rdRate = appSettings.misc.specialConveyanceRate; 
                rdAmt = (fare ? fare.toFixed(2) : ""); 
            }
            
            let lineT = (mode === 'Rail' ? (fare + (parseFloat(iAmt) || 0)) : fare) + da;
            totalClaim += lineT;
            
            tableData.push([dateTime, from, to, mode, rDist, rdDist, tFare, iRate, iAmt, rdRate, rdAmt, (da>0?"1":""), da||"", lineT.toFixed(2), isFirst?getVal('bill-purpose'):""]);
        }
    });
    flushLim(limBuf && limBuf.isFirst);

    if (tableData.length > 0) {
        tableData[0][tableData[0].length - 1] = { 
            content: "", 
            rowSpan: tableData.length 
        };
        for (let i = 1; i < tableData.length; i++) {
            tableData[i].pop();
        }
    }

    let tRows = tableData.length;
    let globalScale = 1;
    if (tRows > 7) {
        globalScale = 7 / tRows;
        if (globalScale < 0.4) globalScale = 0.4;
    }
    
    let tFontSize = Math.max(4, 6.5 * globalScale);
    let tPad = Math.max(0.5, 1 * globalScale);

    doc.autoTable({
        startY: 150 - (20 * (1 - globalScale)),
        head: [
            [{ content: 'Date & Time', rowSpan: 2 }, { content: 'Place', colSpan: 2 }, { content: 'Mode', rowSpan: 2 }, { content: 'Dist', colSpan: 2 }, { content: 'Rail (2nd AC)', colSpan: 3 }, { content: 'Road', colSpan: 2 }, { content: 'DA', colSpan: 2 }, { content: 'Total', rowSpan: 2 }, { content: 'Purpose', rowSpan: 2 }],
            ['From', 'To', 'Rail', 'Road', 'Fare', 'Rate', 'Amt', 'Rate', 'Amt', 'Days', 'Amt'],
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15']
        ],
        body: tableData,
        theme: 'grid', styles: { fontSize: tFontSize, cellPadding: tPad, textColor: 0, lineColor: 0, lineWidth: 0.5, overflow: 'hidden' }, headStyles: { fillColor: false, halign: 'center', fontStyle: 'bold' },
        didDrawCell: function(data) {
            if (data.section === 'body' && data.column.index === 14 && data.row.index === 0) {
                var text = getVal('bill-purpose');
                var fontSize = 8;
                doc.setFontSize(fontSize);
                doc.setTextColor(0);
                
                var textLines = doc.splitTextToSize(text, data.cell.height - 4);
                while (textLines.length * (fontSize * 1.2) > data.cell.width - 4 && fontSize > 4) {
                    fontSize -= 0.5;
                    doc.setFontSize(fontSize);
                    textLines = doc.splitTextToSize(text, data.cell.height - 4);
                }
                
                var lineHt = fontSize * 1.2;
                var totalBlockWidth = textLines.length * lineHt;
                var startX = data.cell.x + data.cell.width / 2 - totalBlockWidth / 2 + lineHt / 3;
                
                for (var i = 0; i < textLines.length; i++) {
                    var tw = doc.getTextWidth(textLines[i]);
                    var lx = startX + i * lineHt;
                    var ly = data.cell.y + data.cell.height / 2 + tw / 2;
                    doc.text(textLines[i], lx, ly, { angle: 90 });
                }
            }
        }
    });

    let finalY = doc.lastAutoTable.finalY;
    let spaceLeft = doc.internal.pageSize.getHeight() - finalY - 20;
    let requiredSpace = 360;
    let scale = spaceLeft / requiredSpace;
    if (scale > 1) scale = 1;
    if (scale < 0.2) scale = 0.2; // absolute minimum

    let s15 = 15 * scale;
    let s20 = 20 * scale;
    let s10 = 10 * scale;
    let s12 = 12 * scale;
    let s30 = 30 * scale;
    let s25 = 25 * scale;
    let fBase = Math.max(6, 10 * scale);
    let fSmall = Math.max(5, 8 * scale);
    let fTiny = Math.max(4, 7 * scale);
    let pPad = Math.max(1, 5 * scale);
    
    finalY += s15;

    doc.setFontSize(Math.max(6, 9 * scale));
    doc.text(`Grand Total: Rs. ${totalClaim.toFixed(2)}`, pageWidth - 40, finalY, { align: "right" });
    doc.text(`Total Amount in Words: ${numberToWords(totalClaim)} Only`, 40, finalY);

    finalY += s20;
    doc.setFontSize(fBase);
    doc.text("CERTIFICATE", pageWidth / 2, finalY, { align: "center" });
    finalY += s10;

    doc.autoTable({
        startY: finalY,
        body: [
            ['General*', '1)', 'I Certify that the amount claimed in this bill or any part thereof has not been claimed previously OR drawn from any other source.'],
            ['', '2)', 'I Certify that the road journey on .............................. for which mileage expense has been claimed at the higher rates was performed in my own car Reg. No. ..............................'],
            ['', '3)', 'I Certify that i was actually present on the previous day of the practical examination for the preparation work\n*Necessary certificate should be attested with dated signature']
        ],
        theme: 'plain',
        styles: { fontSize: fSmall, cellPadding: Math.max(0.5, 2 * scale) },
        columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 15 } }
    });
    finalY = doc.lastAutoTable.finalY;

    let returnDate = '';
    const journeyRows = document.querySelectorAll('#journey-body tr');
    for (let i = journeyRows.length - 1; i >= 0; i--) {
        const row = journeyRows[i];
        if (row.dataset.type !== "DA") {
            const dateInput = row.querySelector('input[type="date"]');
            if (dateInput && dateInput.value) {
                const p = dateInput.value.split('-');
                if (p.length === 3) {
                    returnDate = `${p[2]}/${p[1]}/${p[0]}`;
                    break;
                }
            }
        }
    }
    if (!returnDate) {
        returnDate = new Date().toLocaleDateString('en-GB');
    }

    let collegeName = getFullCollegeName(getVal('prof-college')) || '';
    let placeText = '';
    if (collegeName.includes(',')) {
        placeText = collegeName.split(',').pop().trim();
    } else {
        placeText = collegeName.trim();
    }
    if (!placeText) {
        let address = getVal('prof-address') || '';
        let addressParts = address.split(',').map(s => s.trim()).filter(Boolean);
        if (addressParts.length > 0) {
            if (addressParts.length >= 2) {
                placeText = addressParts[addressParts.length - 2];
            } else {
                placeText = addressParts[0];
            }
        }
    }

    doc.text(`Place: ${placeText || '.........................'}`, 40, finalY);
    doc.text("Signature..........................................................", pageWidth - 40, finalY, { align: "right" });
    finalY += s15;
    doc.text(`Date: ${returnDate}`, 40, finalY);
    
    finalY += s15;
    doc.line(40, finalY, pageWidth - 40, finalY);
    finalY += s15;

    doc.autoTable({
        startY: finalY,
        body: [
            [
                'Memo of Budget Allotment\n\nfor the year.......................\n\nExpenditure including\n\nthis bill..........................\n\nBalance.............................',
                'Passed and Countersigned for\n\nRs. .........................................\n\nDate. ......................................',
                'Advance Drawn................................\n\nBalance Claimed................................\n\n\n\nSignature of the Officer Who Travelled'
            ]
        ],
        theme: 'plain',
        styles: { fontSize: fSmall, cellPadding: pPad, valign: 'top' }
    });
    finalY = doc.lastAutoTable.finalY + s15;

    doc.text("Countersigned and certified that the days for which halting allowance is claimed were necessarily", pageWidth / 2, finalY, { align: "center" });
    finalY += s12;
    doc.text("spent for conduct of university business. The Claim may be admitted", pageWidth / 2, finalY, { align: "center" });
    
    finalY += s30;
    doc.text("Signature...........................................................", 40, finalY);
    doc.text("Chairman/Board of Examiners/Question Paper Setters in ......................", pageWidth - 40, finalY, { align: "right" });
    
    finalY += s25;
    doc.text("Asst.", 100, finalY);
    doc.text("S.O.", pageWidth / 2, finalY, { align: "center" });
    doc.text("A.R./D.R.", pageWidth - 100, finalY, { align: "right" });

    finalY += s15;

    doc.autoTable({
        startY: finalY,
        body: [
            [
                'Pre-Audit By Finance Branch\n\nRs...................................................................................\n\n(Rupees. ..............................................................................\n\n.................................................................................Only)\n\nfound admissible and passed for payment.\n\n\n\nAsst.                   S. O.                   A.R/D.R/J.R./FO',
                'Payement by Pareeksha Bhavan\n\nThe Amount paid by Cheque\n\nNo...................................................................................\n\nDate.................................................................................\n\n\n\n\nAsst.                   S. O.                   A.R/D.R/J.R./FO'
            ]
        ],
        theme: 'grid',
        styles: { fontSize: fTiny, cellPadding: pPad, valign: 'top', textColor: 0, lineColor: 0, lineWidth: 0.5 },
        columnStyles: { 0: { cellWidth: '50%' }, 1: { cellWidth: '50%' } }
    });

    doc.addPage();
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("RATES OF T. A. AND D. A. TO EXAMINERS, QUESTION PAPER SETTERS, SYNDICATE MEMBERS,", pageWidth / 2, 40, { align: "center" });
    doc.text("PRINCIPALS OR", pageWidth / 2, 52, { align: "center" });
    doc.text("THOSE WHO TRAVEL ON CALICUT UNIVERSITY EXAMINATION BUSINESS", pageWidth / 2, 64, { align: "center" });
    
    doc.setLineWidth(0.5);
    doc.line(pageWidth / 2 - 240, 42, pageWidth / 2 + 240, 42);
    doc.line(pageWidth / 2 - 40, 54, pageWidth / 2 + 40, 54);
    doc.line(pageWidth / 2 - 210, 66, pageWidth / 2 + 210, 66);

    doc.autoTable({
        startY: 75,
        body: [
            ['Note:', 'i)', 'No. T.A./D.A. will be paid if the journey distance is not more than Eight Kilometres unless otherwise specified in the rules.'],
            ['', 'ii)', 'For calculating T.A./D.A. Head quarters alone will be considered. Vacation address will not be considered.'],
            ['', 'iii)', 'The Vice-Chancellor may, for special reasons to be recorded, allow a particular examiner/question paper setter, mileage allowance at a higher rate than is prescribed in rule 1 below.'],
            ['', 'iv)', 'The provisions under these rules are independent of the provisions in Part II, KSR.']
        ],
        theme: 'plain', styles: { fontSize: 8, cellPadding: 2, textColor: 0 },
        columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 15 } },
        margin: { left: 40, right: 40 }
    });

    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 5,
        body: [
            ['Rule 1. Travelling Allowance for journey by Road/Rail'],
            [`Road Mileage @ Rs.${appSettings.misc.specialConveyanceRate.toFixed(2)} per kilometer (special conveyance) OR II A/C Railway fare + incidental expense at the rate of 80 paise per kilometre for Grade I officers`]
        ],
        theme: 'plain', styles: { fontSize: 8, cellPadding: 2, textColor: 0 },
        margin: { left: 40, right: 40 },
        didParseCell: function(data) {
            if (data.row.index === 0) data.cell.styles.fontStyle = 'bold';
            else data.cell.styles.cellPadding = { left: 15, top: 2, bottom: 2, right: 2 };
        }
    });

    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 5,
        head: [['Classification', 'Rate', 'Eligible class of\njourney by train']],
        body: [
            ['Grade I - All employees who draw an actual basic pay of Rs. 50,400/- and above', '0.80', 'II AC'],
            ['Grade II (a) - Employees with actual basic pay of Rs. 42,500/- and above, but below Rs.50,400/-', '0.60', 'I Class'],
            ['Grade II (b) - Employees with actual basic pay of Rs.27,800/- and above, but below Rs.42,500/-', '0.50', 'III AC'],
            ['Grade III - Employees with actual basic pay of Rs.18,000/- and above, but below Rs.27,800/-', '0.50', 'II Class'],
            ['Grade IV - Employees with actual basic pay below Rs.18,000/-', '0.50', 'II Class']
        ],
        theme: 'grid', styles: { fontSize: 8, cellPadding: 4, textColor: 0, lineColor: 0, lineWidth: 0.5 },
        headStyles: { fillColor: false, fontStyle: 'bold', halign: 'center' },
        columnStyles: { 0: { cellWidth: 380 }, 1: { halign: 'center', cellWidth: 40 }, 2: { halign: 'center', cellWidth: 80 } },
        margin: { left: 40, right: 40 }
    });

    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 5,
        body: [['General - If one travels more than 200 kilometres a day by Road, the rate of mileage allowance for the excess over 200 kilometres will be reduced to 3/4 of the normal rate per kilometre.']],
        theme: 'plain', styles: { fontSize: 8, cellPadding: {left: 15, top: 2, bottom: 2, right: 2}, textColor: 0 },
        margin: { left: 40, right: 40 }
    });

    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 5,
        body: [
            [{ content: '2.', styles: { fontStyle: 'bold' } }, { content: 'Mileage for journey by Air :', colSpan: 2, styles: { fontStyle: 'bold' } }],
            ['', { content: '(i) Prior Sanction from the Vice-Chancellor has to be obtained for performing journey by Air.\n(ii) Actual Air fare + D.A as Incidental Expenses each way (Air tickets should be produced along with the T.A./D.A claims) + Boarding pass / Ticket Jacket.', colSpan: 2 }],
            [{ content: '3.', styles: { fontStyle: 'bold' } }, { content: 'Mileage for Journey by Ship', colSpan: 2, styles: { fontStyle: 'bold' } }],
            ['', { content: 'Actual Ship fare + D.A. outside rate OR 1 3/4 of Fare whichever is higher will be paid (Cash Receipt should be produced for claiming ship fare)', colSpan: 2 }],
            [{ content: '4.', styles: { fontStyle: 'bold' } }, { content: 'Daily Allowance', colSpan: 2, styles: { fontStyle: 'bold' } }],
            ['', 'i)', 'Rupees 400/- (Rupees Four hundred only) per day for actual day of University business irrespective of duration of hours of halt.\nFor inter-state travel Rs.550/- per day (Grade I).']
        ],
        theme: 'plain', styles: { fontSize: 8, cellPadding: 2, textColor: 0 },
        columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 15 } },
        margin: { left: 40, right: 40 }
    });

    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 5,
        head: [['Grade', 'Inside State', 'Outside State']],
        body: [
            ['I', '400/-', '550/-'],
            ['II (a)', '320/-', '450/-'],
            ['II (b)', '320/-', '450/-'],
            ['III', '250/-', '350/-'],
            ['IV', '250/-', '350/-']
        ],
        theme: 'grid', styles: { fontSize: 8, cellPadding: 4, textColor: 0, lineColor: 0, lineWidth: 0.5, halign: 'center' },
        headStyles: { fillColor: false, fontStyle: 'bold' },
        margin: { left: 120, right: 120 }
    });

    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 5,
        body: [
            ['', 'ii)', 'Rs. 550/- per day will be paid as D.A. for duty at Lakshadweep.'],
            ['', 'iii)', 'For Chemistry Practical Examination one D.A. will be paid for the previous day of the examination for preparation work provided a certificate to that effect is furnished on the T.A. bill.'],
            ['', 'iv)', 'For meetings of Board of Examiners, Question Paper Setters, D.A. for the actual day of University business will be paid to the members in addition to the eligible T.A. All Officers are eligible for T.A./D.A. only if the distance travelled exceeds 8 kilometres, as per rules.'],
            ['', 'v)', 'No T.A./D.A. will be paid to the Examiners for Practical/Viva-Voce Examinations etc. unless the distance travelled exceeds 8 kilometres. If the distance travelled is below 8 kilometres but more than 2 kilometres conveyance allowance @ Rs. 5/- per day will be paid for the actual number of days of duty.'],
            ['', 'vi)', 'For intervening Holidays or Off days between days of Duty T.A. or D.A. whichever is less will only be paid.']
        ],
        theme: 'plain', styles: { fontSize: 8, cellPadding: 2, textColor: 0 },
        columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 15 } },
        margin: { left: 40, right: 40 }
    });

    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 5,
        body: [
            [{ content: '5.', styles: { fontStyle: 'bold' } }, { content: 'T.A. and D.A. to Syndicate Members / Senate Members', colSpan: 2, styles: { fontStyle: 'bold' } }],
            ['', 'i)', 'Road mileage @ Rs.12/- per kilometres will be paid (Special conveyance) irrespective of the distance travelled in a day.'],
            ['', 'ii)', 'D.A. will be Rs. 900/-']
        ],
        theme: 'plain', styles: { fontSize: 8, cellPadding: 2, textColor: 0 },
        columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 15 } },
        margin: { left: 40, right: 40 }
    });

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Controller of Examinations", pageWidth - 40, doc.lastAutoTable.finalY + 30, { align: "right" });

    // Download instantly instead of opening blob window
    if (window.AndroidBridge) {
        return doc.output('datauristring');
    }
    doc.save('TA_Bill_University_of_Calicut.pdf');
}

function generateHTMLBill(autoPrint = false) {
    const getVal = (id) => document.getElementById(id).value;
    const fixDate = (d) => { if(!d) return ""; const p = d.split('-'); return `${p[2]}/${p[1]}/${p[0].slice(-2)}`; };
    
    let autoMonth = "";
    const firstDateInput = document.querySelector('#journey-body tr input[type="date"]');
    if (firstDateInput && firstDateInput.value) {
        const d = new Date(firstDateInput.value);
        autoMonth = d.toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase();
    }
    const month = autoMonth || new Date().toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase();

    let returnDate = '';
    const journeyRows = document.querySelectorAll('#journey-body tr');
    for (let i = journeyRows.length - 1; i >= 0; i--) {
        const row = journeyRows[i];
        if (row.dataset.type !== "DA") {
            const dateInput = row.querySelector('input[type="date"]');
            if (dateInput && dateInput.value) {
                const p = dateInput.value.split('-');
                if (p.length === 3) {
                    returnDate = `${p[2]}/${p[1]}/${p[0]}`;
                    break;
                }
            }
        }
    }
    if (!returnDate) {
        returnDate = new Date().toLocaleDateString('en-GB');
    }

    let collegeName = getFullCollegeName(getVal('prof-college')) || '';
    let placeText = '';
    if (collegeName.includes(',')) {
        placeText = collegeName.split(',').pop().trim();
    } else {
        placeText = collegeName.trim();
    }
    if (!placeText) {
        let address = getVal('prof-address') || '';
        let addressParts = address.split(',').map(s => s.trim()).filter(Boolean);
        if (addressParts.length > 0) {
            if (addressParts.length >= 2) {
                placeText = addressParts[addressParts.length - 2];
            } else {
                placeText = addressParts[0];
            }
        }
    }

    let htmlRows = []; 
    let totalClaim = 0;
    let limBufHtml = null;

    const flushLimHtml = (isFirst) => {
        if (!limBufHtml) return;
        totalClaim += limBufHtml.da;
        let days = (limBufHtml.da > 0 && limBufHtml.da % 600 === 0) ? limBufHtml.da / 600 : (limBufHtml.da > 0 && limBufHtml.da % 400 === 0 ? limBufHtml.da / 400 : 1);
        let rate = limBufHtml.da > 0 ? limBufHtml.da / days : 0;
        let daStr = limBufHtml.da > 0 ? ` <span class="font-normal" style="font-size:9px">for ${days} Days ${rate} X ${days} = ${limBufHtml.da}</span>` : "";
        htmlRows.push(`<tr><td class="text-center" style="white-space:pre-wrap; line-height:1.2;">${limBufHtml.date}</td><td colspan="10" class="text-left font-bold" style="padding-left:5px;">TA Limited to DA${daStr}</td><td class="text-center">${limBufHtml.da>0?days:""}</td><td class="text-right">${limBufHtml.da?limBufHtml.da.toFixed(2):""}</td><td class="text-right font-bold">${limBufHtml.da.toFixed(2)}</td>${isFirst?`<td rowspan="@@ROWSPAN@@" style="position:relative;padding:0;"><div id="html-purpose-container" style="position:absolute;top:2px;bottom:2px;left:2px;right:2px;overflow:hidden;display:flex;align-items:center;justify-content:center;"><div id="html-purpose-text" style="font-size:10px;writing-mode:vertical-rl;transform:rotate(180deg);text-align:center;max-height:100%;word-wrap:break-word;">${getVal('bill-purpose')}</div></div></td>`:""}</tr>`);
        limBufHtml = null;
    };

    const rows = document.querySelectorAll('#journey-body tr');
    rows.forEach((row, idx) => {
        const isFirst = (idx === 0);
        if (row.dataset.type === "DA") {
            flushLimHtml(isFirst);
            const da = parseFloat(row.querySelector('input[placeholder="DA"]').value) || 0;
            totalClaim += da;
            const days = row.dataset.days;
            const rate = da > 0 ? da / days : 0;
            const fromDate = row.dataset.fromDate || '';
            const toDate   = row.dataset.toDate   || '';
            const fmtD = (iso) => { if (!iso) return ''; const p = iso.split('-'); return `${p[2]}/${p[1]}/${p[0].slice(-2)}`; };
            const dateRangeLabel = (fromDate && toDate && fromDate !== toDate)
                ? `(${fmtD(fromDate)} to ${fmtD(toDate)})`
                : `(${fmtD(fromDate)})`;
            const daStr = da > 0 ? ` <span class="font-normal" style="font-size:9px">${dateRangeLabel} for ${days} Days @ ${rate} X ${days} = ${da}</span>` : "";
            htmlRows.push(`<tr><td></td><td colspan="10" class="text-left font-bold" style="padding-left:5px;">DA${daStr}</td><td class="text-center">${days}</td><td class="text-right">${da.toFixed(2)}</td><td class="text-right font-bold">${da.toFixed(2)}</td>${isFirst?`<td rowspan="@@ROWSPAN@@" style="position:relative;padding:0;"><div id="html-purpose-container" style="position:absolute;top:2px;bottom:2px;left:2px;right:2px;overflow:hidden;display:flex;align-items:center;justify-content:center;"><div id="html-purpose-text" style="font-size:10px;writing-mode:vertical-rl;transform:rotate(180deg);text-align:center;max-height:100%;word-wrap:break-word;">${getVal('bill-purpose')}</div></div></td>`:""}</tr>`);
            return;
        }
        const dateRaw = row.querySelector('input[type="date"]').value;
        const date = fixDate(dateRaw);
        const fTime = row.querySelector('input[placeholder="FT"]').value || "";
        const tTime = row.querySelector('input[placeholder="TT"]').value || "";
        const dateTime = (fTime || tTime) ? `${date}<br><span style="font-size:8px">${fTime} - ${tTime}</span>` : date;
        const from = row.querySelector('input[placeholder="From"]').value;
        const to = row.querySelector('input[placeholder="To"]').value;
        const mode = row.querySelector('select').value;
        const kmText = row.querySelector('input[placeholder="KM"]').value;
        const km = parseFloat(kmText) || 0;
        let fare = parseFloat(row.querySelector('input[placeholder="Fare"]').value) || 0;
        const da = parseFloat(row.querySelector('input[placeholder="DA"]').value) || 0;
        
        let isLimited = row.querySelector('.limit-check') && row.querySelector('.limit-check').checked;
        
        if (isLimited) {
            if (!limBufHtml) {
                limBufHtml = { date: dateTime, dateOnly: date, da: da, isFirst: isFirst };
            } else {
                limBufHtml.da += da;
                if (!limBufHtml.dateOnly.includes(date)) {
                    limBufHtml.dateOnly += `<br>${date}`;
                    limBufHtml.date += `<br>${dateTime}`;
                }
            }
        } else {
            flushLimHtml(limBufHtml && limBufHtml.isFirst);
            let col5="", col6="", col7="", col8="", col9="", col10="", col11="", col14="";
            if (mode === 'Rail') { 
                col5=kmText||""; 
                col7=fare||""; 
                col8=appSettings.misc.trainIncidentalRate; 
                col9=(km ? (km*col8).toFixed(2) : ""); 
            } else { 
                col6=kmText||""; 
                col10=appSettings.misc.specialConveyanceRate; 
                col11=(fare ? fare.toFixed(2) : ""); 
            }
            
            let lineT = (mode === 'Rail' ? (fare + (parseFloat(col9) || 0)) : fare) + da;
            totalClaim += lineT;
            col14 = lineT.toFixed(2);
            
            htmlRows.push(`<tr><td class="text-center" style="white-space:pre-wrap; line-height:1.2;">${dateTime}</td><td class="text-left">${from}</td><td class="text-left">${to}</td><td class="text-center">${mode}</td><td class="text-center">${col5}</td><td class="text-center">${col6}</td><td class="text-right">${col7}</td><td class="text-right">${col8}</td><td class="text-right">${col9}</td><td class="text-right">${col10}</td><td class="text-right">${col11}</td><td class="text-center">${da>0?"1":""}</td><td class="text-right">${da||""}</td><td class="text-right">${col14}</td>${isFirst?`<td rowspan="@@ROWSPAN@@" style="position:relative;padding:0;"><div id="html-purpose-container" style="position:absolute;top:2px;bottom:2px;left:2px;right:2px;overflow:hidden;display:flex;align-items:center;justify-content:center;"><div id="html-purpose-text" style="font-size:10px;writing-mode:vertical-rl;transform:rotate(180deg);text-align:center;max-height:100%;word-wrap:break-word;">${getVal('bill-purpose')}</div></div></td>`:""}</tr>`);
        }
    });
    flushLimHtml(limBufHtml && limBufHtml.isFirst);

    htmlRows.push(`<tr><td colspan="13" class="text-right font-bold" style="padding-right:10px;">Total</td><td class="text-right font-bold">${totalClaim.toFixed(2)}</td>${htmlRows.length===0?'<td></td>':''}</tr>`);
    
    let tableHtml = htmlRows.join('').replace(/@@ROWSPAN@@/g, htmlRows.length);
    tableHtml += `<tr><td colspan="15" class="text-left font-bold" style="padding-left:10px;">Total Amount in Words: ${numberToWords(totalClaim)} Only</td></tr>`;

    const html = `
    <!DOCTYPE html><html><head><style>
        @page { size: A4 portrait; margin: 10mm; }
        :root {
            --f-base: 10px;
            --f-table: 9px;
            --f-head1: 14px;
            --f-head2: 12px;
            --f-head3: 13px;
            --pad-table: 3px 2px;
            --margin-block: 10px;
            --box-size: 50px;
        }
        @page { size: A4 portrait; margin: 0; }
        body { font-family: Arial, sans-serif; padding: 0; font-size: var(--f-base); line-height: 1.2; margin: 0; background: #ccc; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .header h1 { font-size: var(--f-head1); margin: 0 0 2px 0; font-weight: normal; }
        .header h2 { font-size: var(--f-head2); margin: 0 0 5px 0; font-weight: normal; }
        .header h3 { font-size: var(--f-head3); margin: 0 0 var(--margin-block) 0; text-transform: uppercase; font-weight: normal; }
        .top-info { width: 100%; margin-bottom: 5px; font-size: var(--f-base); border-collapse: collapse; }
        .top-info td { padding: 2px 0; vertical-align: top; }
        .bill-table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1px solid #000; margin-bottom: calc(var(--margin-block) / 2); }
        .bill-table th, .bill-table td { border: 1px solid #000; padding: var(--pad-table); text-align: left; font-size: var(--f-table); word-wrap: break-word; }
        .bill-table th { background: #fff; text-align: center; font-weight: normal; }
        .num-row td { text-align: center; font-size: var(--f-table); border-bottom: 1px solid #000; }
        .signature-box { border: 1px solid #000; width: calc(var(--box-size) * 1.2); height: var(--box-size); display: inline-block; background: #fff; }
        .office-use { width: 100%; border-collapse: collapse; font-size: var(--f-base); margin-top: var(--margin-block); }
        .office-use td { vertical-align: top; padding: 0; }
        .bottom-table { width: 100%; border-collapse: collapse; font-size: var(--f-base); margin-top: var(--margin-block); border: 1px solid #000; }
        .bottom-table th, .bottom-table td { border: 1px solid #000; padding: calc(var(--margin-block) / 2); vertical-align: top; overflow-wrap: anywhere; }
        .page-container { 
            box-sizing: border-box; 
            position: relative;
            height: 285mm;
            width: 200mm;
            padding: 5mm;
            margin: 5mm auto;
            background: #fff;
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
        }
        @media print { 
            .no-print { display: none; }
            body { background: #fff; }
            .page-container { margin: 0; box-shadow: none; border: none; outline: none; }
            #page-content { page-break-after: always; }
        }
        #content-bottom {
            position: absolute;
            bottom: 5mm;
            left: 5mm;
            right: 5mm;
        }
    </style></head><body>
        <div class="no-print" style="margin-bottom:10px;"><button onclick="window.print()" style="padding:8px 16px;background:#2563eb;color:#fff;border:none;cursor:pointer;border-radius:4px;">Print Bill</button></div>
        <div id="page-content" class="page-container">
            <div id="content-top">
        <div class="header text-center">
            <h1>UNIVERSITY OF CALICUT</h1>
            <h2>(PAREEKSHA BHAVAN)</h2>
            <h3>TRAVELLING ALLOWANCE FOR THE MONTH OF ${month}</h3>
        </div>
        <table class="top-info">
            <tr>
                <td width="60%">1) Name (In Block Letters): ${getVal('prof-name')}</td>
                <td width="40%">5) Basic Pay or Consolidated Amount: ${getVal('prof-basic-pay')}/-</td>
            </tr>
            <tr>
                <td>2) Designation: ${getVal('prof-designation')}</td>
                <td>6) Savings Bank A/c No: ${getVal('prof-acc-no')}</td>
            </tr>
            <tr>
                <td>3) Name of the College: ${getFullCollegeName(getVal('prof-college'))}</td>
                <td>7) Name of the Bank with IFSC code: ${getVal('prof-bank-ifsc')}</td>
            </tr>
            <tr>
                <td>4) Permanent Address: ${getVal('prof-address')}</td>
                <td>
                    Voucher No. .................................................................<br>
                    Month of .................................................................<br>
                    Debit Head .................................................................
                </td>
            </tr>
        </table>
        
        <table class="bill-table">
            <thead>
                <tr>
                    <th rowspan="3" width="8%">Date</th>
                    <th colspan="2" width="22%">Place</th>
                    <th rowspan="3" width="7%">Mode of<br>Conveyance<br>used<br>(Special/Air/<br>Rail)</th>
                    <th colspan="2" width="9%">Distance</th>
                    <th colspan="3" width="18%">Mileage allowance for Rail/Air<br>Journeys</th>
                    <th colspan="2" width="10%">Mileage allowance<br>for Road Journeys</th>
                    <th colspan="2" width="14%">Daily Allowance for<br>Halts/Special Allowance</th>
                    <th rowspan="3" width="7%">Total in<br>Each Line</th>
                    <th rowspan="3" width="5%">Purpose</th>
                </tr>
                <tr>
                    <th rowspan="2">From<br><br>Station</th>
                    <th rowspan="2">To<br><br>Station</th>
                    <th rowspan="2">By Rail<br><br>Air</th>
                    <th rowspan="2">By Road</th>
                    <th rowspan="2">Train<br><br>Plane Fare at<br>2nd AC<br>Class</th>
                    <th colspan="2">Incident Expenses for<br>Train Travel Only</th>
                    <th rowspan="2">Rate</th>
                    <th rowspan="2">Amount</th>
                    <th rowspan="2">Days of<br>Buisiness</th>
                    <th rowspan="2">Amount of<br>DA/Special<br>Allowance</th>
                </tr>
                <tr>
                    <th>Rate</th>
                    <th>Amount</th>
                </tr>
                <tr class="num-row">
                    <td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td><td>8</td><td>9</td><td>10</td><td>11</td><td>12</td><td>13</td><td>14</td><td>15</td>
                </tr>
            </thead>
            <tbody>
                ${tableHtml}
            </tbody>
        </table>
        </div> <!-- End of content-top -->

        <div id="content-bottom">
        <div class="text-center" style="margin: 5px 0; font-size:var(--f-base);">CERTIFICATE</div>
        <table style="width:100%; font-size:var(--f-table); margin-bottom: 5px; border-collapse: collapse;">
            <tr>
                <td width="8%" style="vertical-align:top;">General*</td>
                <td width="3%" style="vertical-align:top;">1)</td>
                <td>I Certify that the amount claimed in this bill or any pat1thereof has not been claimed previously OR drawn from any other source.</td>
            </tr>
            <tr>
                <td></td>
                <td style="vertical-align:top;">2)</td>
                <td>I Certify that the road journey on .............................. for which mileage expense has been claimed at the higher rates was performed in my own car Reg. No. ..............................</td>
            </tr>
            <tr>
                <td></td>
                <td style="vertical-align:top;">3)</td>
                <td>I Certify that i was actually present on the previous day of the practical examination for the preparation work<br>*Necessary certificate should be attested with dated signature</td>
            </tr>
        </table>

        <div style="display:flex; justify-content:space-between; margin-bottom: 5px; font-size:var(--f-base);">
            <div>
                Place: ${placeText || '.........................'}<br>
                Date: ${returnDate}
            </div>
            <div style="text-align:right; margin-top:10px;">
                Signature..........................................................
            </div>
        </div>

        <div style="border-top:1px solid #000; margin:5px 0;"></div>

        <table class="office-use">
            <tr>
                <td width="33%">
                    Memo of Budget Allotment<br><br>
                    for the year.......................<br><br>
                    Expenditure including<br><br>
                    this bill..........................<br><br>
                    Balance.............................
                </td>
                <td width="33%">
                    Passed and Countersigned for<br><br>
                    Rs. .........................................<br><br>
                    Date. ......................................
                </td>
                <td width="34%">
                    Advance Drawn................................<br><br>
                    Balance Claimed................................<br><br>
                    <div style="display:flex; align-items:flex-end; gap:10px; margin-top:5px;">
                        <div class="signature-box"></div>
                        <span>Signature of the Officer Who Travelled</span>
                    </div>
                </td>
            </tr>
        </table>

        <div style="text-align:center; font-size:var(--f-table); margin:10px 0;">
            Countersigned and certified that the days for whcih halting allowance is claimed were necessarily<br><br>
            spent for conduct of university buisiness. The Calim may be admitted<br><br>
            <div style="display:flex; justify-content:space-between; margin-top:10px; padding:0 10px;">
                <span>Signature...........................................................</span>
                <span>Chairman/Board of Examiners/Question Paper Setters in ......................</span>
            </div>
            <div style="display:flex; justify-content:space-around; margin-top:15px;">
                <span>Asst.</span>
                <span>S.O.</span>
                <span>A.R./D.R.</span>
            </div>
        </div>

        <table class="bottom-table">
            <tr>
                <td width="50%">
                    <div class="text-center" style="margin-bottom:10px;">Pre-Audit By Finance Branch</div>
                    Rs...................................................................................<br><br>
                    (Rupees. ..............................................................................<br><br>
                    .................................................................................Only)<br><br>
                    found admissible and passed for payment.<br><br><br>
                    <div style="display:flex; justify-content:space-between; margin-top:10px;">
                        <span>Asst.</span>
                        <span>S. O.</span>
                        <span>A.R/D.R/J.R./FO</span>
                    </div>
                </td>
                <td width="50%">
                    <div class="text-center" style="margin-bottom:10px;">Payement by Pareeksha Bhavan</div>
                    The Amount paid by Cheque<br><br>
                    No...................................................................................<br><br>
                    Date.................................................................................<br><br><br><br>
                    <div style="display:flex; justify-content:space-between; margin-top:10px;">
                        <span>Asst.</span>
                        <span>S. O.</span>
                        <span>A.R/D.R/J.R./FO</span>
                    </div>
                </td>
            </tr>
        </table>
        </div> <!-- End of content-bottom -->
        </div> <!-- End of page-content -->
        <div id="page-instructions" class="page-container" style="font-size: 10px; line-height: 1.35; padding: 10mm 15mm; margin-top: 0; box-sizing: border-box;">
            <h3 class="text-center" style="text-decoration: underline; font-size: 12px; margin-bottom: 10px;">
                RATES OF T. A. AND D. A. TO EXAMINERS, QUESTION PAPER SETTERS, SYNDICATE MEMBERS, PRINCIPALS OR<br>
                THOSE WHO TRAVEL ON CALICUT UNIVERSITY EXAMINATION BUSINESS
            </h3>
            
            <table style="width: 100%; border: none; font-size: 10px;">
                <tr><td style="width: 40px; vertical-align: top;">Note:</td><td style="width: 20px; vertical-align: top;">i)</td><td>No. T. A./D. A. will be paid if the journey distance is not more than Eight Kilometres unless otherwise specified in the rules.</td></tr>
                <tr><td></td><td style="vertical-align: top;">ii)</td><td>For calculating T. A./D. A. Head quarters alone will be considered. Vacation address will not be considered.</td></tr>
                <tr><td></td><td style="vertical-align: top;">iii)</td><td>The Vice-Chancellor may, for special reasons to be recorded, allow a particular examiner/question paper setter, mileage allowance at a higher rate than is prescribed in rule 1 below.</td></tr>
                <tr><td></td><td style="vertical-align: top;">iv)</td><td>The provisions under these rules are independent of the provisions in Part II, KSR.</td></tr>
            </table>

            <div style="margin-top: 8px;"><b>Rule 1. Travelling Allowance for journey by Road/Rail</b></div>
            <div style="margin-left: 20px;">Road Mileage @ Rs.${appSettings.misc.specialConveyanceRate.toFixed(2)} per kilometer (special conveyance) OR II A/C Railway fare + incidental expense at the rate of 80 paise per kilometre for Grade I officers</div>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 8px; text-align: center; border: 1px solid #000;" border="1">
                <tr>
                    <th style="padding: 3px; text-align: left;">Classification</th>
                    <th style="padding: 3px;">Rate</th>
                    <th style="padding: 3px;">Eligible class of<br>journey by train</th>
                </tr>
                <tr><td style="padding: 3px; text-align: left;">Grade I - All employees who draw an actual basic pay of Rs. 50,400/- and above</td><td>0.80</td><td>II AC</td></tr>
                <tr><td style="padding: 3px; text-align: left;">Grade II (a) - Employees with actual basic pay of Rs. 42,500/- and above, but below Rs.50,400/-</td><td>0.60</td><td>I Class</td></tr>
                <tr><td style="padding: 3px; text-align: left;">Grade II (b) - Employees with actual basic pay of Rs.27,800/- and above, but below Rs.42,500/-</td><td>0.50</td><td>III AC</td></tr>
                <tr><td style="padding: 3px; text-align: left;">Grade III - Employees with actual basic pay of Rs.18,000/- and above, but below Rs.27,800/-</td><td>0.50</td><td>II Class</td></tr>
                <tr><td style="padding: 3px; text-align: left;">Grade IV - Employees with actual basic pay below Rs.18,000/-</td><td>0.50</td><td>II Class</td></tr>
            </table>

            <div style="margin-left: 20px; margin-bottom: 8px;">General - If one travels more than 200 kilometres a day by Road, the rate of mileage allowance for the excess over 200 kilometres will be reduced to &frac34; of the normal rate per kilometre.</div>

            <table style="width: 100%; border: none; font-size: 10px;">
                <tr><td style="width: 20px; vertical-align: top;">2.</td><td><b>Mileage for journey by Air :</b> (i) Prior Sanction from the Vice-Chancellor has to be obtained for performing journey by Air.<br>(ii) Actual Air fare + D.A as Incidental Expenses each way (Air tickets should be produced along with the T.A./D.A claims) + Boarding pass / Ticket Jacket.</td></tr>
                <tr><td style="vertical-align: top;">3.</td><td><b>Mileage for Journey by Ship</b><br>Actual Ship fare + D.A. outside rate OR 1&frac34; of Fare whichever is higher will be paid (Cash Receipt should be produced for claiming ship fare)</td></tr>
                <tr><td style="vertical-align: top;">4.</td><td><b>Daily Allowance</b>
                    <table style="width: 100%; border: none; font-size: 10px;">
                        <tr><td style="width: 20px; vertical-align: top;">i)</td><td>Rupees 400/- (Rupees Four hundred only) per day for actual day of University business irrespective of duration of hours of halt. For inter-state travel Rs.550/- per day (Grade I).</td></tr>
                    </table>
                </td></tr>
            </table>

            <table style="width: 60%; border-collapse: collapse; margin: 8px auto; text-align: center; border: 1px solid #000;" border="1">
                <tr><th style="padding: 3px;">Grade</th><th style="padding: 3px;">Inside State</th><th style="padding: 3px;">Outside State</th></tr>
                <tr><td style="padding: 3px;">I</td><td>400/-</td><td>550/-</td></tr>
                <tr><td style="padding: 3px;">II (a)</td><td>320/-</td><td>450/-</td></tr>
                <tr><td style="padding: 3px;">II (b)</td><td>320/-</td><td>450/-</td></tr>
                <tr><td style="padding: 3px;">III</td><td>250/-</td><td>350/-</td></tr>
                <tr><td style="padding: 3px;">IV</td><td>250/-</td><td>350/-</td></tr>
            </table>

            <table style="width: 100%; border: none; font-size: 10px; margin-left: 20px;">
                <tr><td style="width: 20px; vertical-align: top;">ii)</td><td>Rs. 550/- per day will be paid as D.A. for duty at Lakshadweep.</td></tr>
                <tr><td style="vertical-align: top;">iii)</td><td>For Chemistry Practical Examination one D.A. will be paid for the previous day of the examination for preparation work provided a certificate to that effect is furnished on the T.A. bill.</td></tr>
                <tr><td style="vertical-align: top;">iv)</td><td>For meetings of Board of Examiners, Question Paper Setters, D.A. for the actual day of University business will be paid to the members in addition to the eligible T.A. All Officers are eligible for T.A./D.A. only if the distance travelled exceeds 8 kilometres, as per rules.</td></tr>
                <tr><td style="vertical-align: top;">v)</td><td>No T.A./D.A. will be paid to the Examiners for Practical/Viva-Voce Examinations etc. unless the distance travelled exceeds 8 kilometres. If the distance travelled is below 8 kilometres but more than 2 kilometres conveyance allowance @ Rs. 5/- per day will be paid for the actual number of days of duty.</td></tr>
                <tr><td style="vertical-align: top;">vi)</td><td>For intervening Holidays or Off days between days of Duty T.A. or D.A. whichever is less will only be paid.</td></tr>
            </table>

            <table style="width: 100%; border: none; font-size: 10px; margin-top: 8px;">
                <tr><td style="width: 20px; vertical-align: top;">5.</td><td><b>T.A. and D.A. to Syndicate Members / Senate Members</b>
                    <table style="width: 100%; border: none; font-size: 10px;">
                        <tr><td style="width: 20px; vertical-align: top;">i)</td><td>Road mileage @ Rs.12/- per kilometres will be paid (Special conveyance) irrespective of the distance travelled in a day.</td></tr>
                        <tr><td style="vertical-align: top;">ii)</td><td>D.A. will be Rs. 900/-</td></tr>
                    </table>
                </td></tr>
            </table>

            <div style="text-align: right; margin-top: 15px; margin-right: 20px; font-weight: bold;">Controller of Examinations</div>
        </div>
        <script>
            window.onload = function() {
                setTimeout(() => {
                    const content = document.getElementById('page-content');
                    const topDiv = document.getElementById('content-top');
                    const bottomDiv = document.getElementById('content-bottom');
                    
                    const hasOverflow = () => {
                        const topRect = topDiv.getBoundingClientRect();
                        const bottomRect = bottomDiv.getBoundingClientRect();
                        return (topRect.bottom > bottomRect.top - 2) || content.scrollWidth > content.clientWidth;
                    };
                    
                    if (hasOverflow()) {
                        let minF = 0.4; let maxF = 1.0; let bestF = 1.0;
                        for(let i=0; i<15; i++) {
                            let f = (minF + maxF) / 2;
                            document.documentElement.style.setProperty('--f-base', (10 * f) + 'px');
                            document.documentElement.style.setProperty('--f-table', (9 * f) + 'px');
                            document.documentElement.style.setProperty('--f-head1', (14 * f) + 'px');
                            document.documentElement.style.setProperty('--f-head2', (12 * f) + 'px');
                            document.documentElement.style.setProperty('--f-head3', (13 * f) + 'px');
                            document.documentElement.style.setProperty('--pad-table', (3 * f) + 'px ' + (2 * f) + 'px');
                            document.documentElement.style.setProperty('--margin-block', (10 * f) + 'px');
                            document.documentElement.style.setProperty('--box-size', (50 * f) + 'px');
                            
                            if (hasOverflow()) {
                                maxF = f;
                            } else {
                                minF = f;
                                bestF = f;
                            }
                        }
                        document.documentElement.style.setProperty('--f-base', (10 * bestF) + 'px');
                        document.documentElement.style.setProperty('--f-table', (9 * bestF) + 'px');
                        document.documentElement.style.setProperty('--f-head1', (14 * bestF) + 'px');
                        document.documentElement.style.setProperty('--f-head2', (12 * bestF) + 'px');
                        document.documentElement.style.setProperty('--f-head3', (13 * bestF) + 'px');
                        document.documentElement.style.setProperty('--pad-table', (3 * bestF) + 'px ' + (2 * bestF) + 'px');
                        document.documentElement.style.setProperty('--margin-block', (10 * bestF) + 'px');
                        document.documentElement.style.setProperty('--box-size', (50 * bestF) + 'px');
                    }
                    
                    const purposeText = document.getElementById('html-purpose-text');
                    const purposeContainer = document.getElementById('html-purpose-container');
                    if (purposeText && purposeContainer) {
                        let pFontSize = 10;
                        while ((purposeText.scrollWidth > purposeContainer.clientWidth || purposeText.scrollHeight > purposeContainer.clientHeight) && pFontSize > 4) {
                            pFontSize -= 0.5;
                            purposeText.style.fontSize = pFontSize + 'px';
                        }
                    }
                }, 100);
            };
        </script>
    </body></html>`;
    const w = window.open('', '_blank'); w.document.write(html); w.document.close();
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
    h += `<h3 class="font-bold text-sm text-gray-500 uppercase border-b pb-2 mt-6">Misc Rates</h3>
        <div class="grid grid-cols-4 gap-4">
            <div><label class="text-[10px] uppercase font-bold">Road Mileage</label><input type="number" step="0.01" value="${appSettings.misc.specialConveyanceRate}" class="form-input" onchange="updateSetting('misc', 'specialConveyanceRate', null, this.value)"></div>
            <div><label class="text-[10px] uppercase font-bold">Incidental</label><input type="number" step="0.01" value="${appSettings.misc.trainIncidentalRate}" class="form-input" onchange="updateSetting('misc', 'trainIncidentalRate', null, this.value)"></div>
            <div><label class="text-[10px] uppercase font-bold">Train Base Fare</label><input type="number" step="0.01" value="${appSettings.misc.trainBaseFare !== undefined ? appSettings.misc.trainBaseFare : 120}" class="form-input" onchange="updateSetting('misc', 'trainBaseFare', null, this.value)"></div>
            <div><label class="text-[10px] uppercase font-bold">Rail Fare/KM</label><input type="number" step="0.01" value="${appSettings.misc.railFarePerKM}" class="form-input" onchange="updateSetting('misc', 'railFarePerKM', null, this.value)"></div>
        </div></div>`;
    c.innerHTML = h;
}
function updateSetting(s, i, k, v) { if (s === 'grades') appSettings.grades[i][k] = k === 'trainClass' ? v : parseFloat(v); else appSettings.misc[i] = parseFloat(v); }
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
        // Wait for ta_database.json to be fetched & parsed before generating
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
                // If there's no base64, but it's a data URI, fallback
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
