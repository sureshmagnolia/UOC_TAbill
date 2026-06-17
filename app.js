// ta-bill-app/app.js

let taDatabase = { abbreviations: [], routes: [] };
let appSettings = {};

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
    
    const journeys = [];
    document.querySelectorAll('#journey-body tr').forEach(row => {
        if (row.dataset.type === "DA") {
            journeys.push({
                type: "DA",
                date: row.querySelector('input[type="date"]').value,
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
                da: row.querySelector('input[placeholder="DA"]').value
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
                        row.querySelector('input[type="date"]').value = j.date || '';
                        row.querySelector('input[placeholder="From"]').value = 'DA for ' + j.daDays + ' Days';
                        row.querySelector('input[placeholder="To"]').classList.add("hidden");
                        row.querySelector('input[placeholder="KM"]').classList.add("hidden");
                        row.querySelector('select').classList.add("hidden");
                        row.querySelector('input[placeholder="Fare"]').classList.add("hidden");
                        row.querySelector('input[placeholder="DA"]').value = j.daAmt || '';
                        row.dataset.days = j.daDays;
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
        { id: "I", minPay: 50400, roadRate: 0.80, trainClass: "II AC", daInside: 600, daOutside: 600 },
        { id: "II(a)", minPay: 42500, roadRate: 0.60, trainClass: "I Class", daInside: 600, daOutside: 600 },
        { id: "II(b)", minPay: 27800, roadRate: 0.50, trainClass: "III AC", daInside: 600, daOutside: 600 },
        { id: "III", minPay: 18000, roadRate: 0.50, trainClass: "II Class", daInside: 600, daOutside: 600 },
        { id: "IV", minPay: 0, roadRate: 0.50, trainClass: "II Class", daInside: 600, daOutside: 600 }
    ],
    misc: {
        specialConveyanceRate: 2.50,
        trainIncidentalRate: 0.90, // per KM
        railFarePerKM: 1.60, // Estimated 2nd AC rate
        minDistanceForTA: 8, // km
    }
};

// Initialize App
async function init() {
    try {
        const response = await fetch('ta_database.json');
        taDatabase = await response.json();
        populateCollegeDropdowns();
    } catch (e) {
        console.error("Failed to load database", e);
    }

    loadSettings();
    setupEventListeners();
    
    // Load state, if no journeys were loaded, add first empty row
    if (!loadFormState()) {
        addJourneyRow();
    }
}

function populateCollegeDropdowns() {
    const dl = document.getElementById('colleges-list');
    if (!dl) return;
    
    dl.innerHTML = '';
    taDatabase.abbreviations.forEach(abbr => {
        const opt = document.createElement('option');
        opt.value = abbr.Abbreviation;
        opt.innerText = abbr['Full College Name & Location'];
        dl.appendChild(opt);
    });
}

function generateQuickJourney() {
    const fromAbbr = document.getElementById('quick-from').value;
    const toAbbr = document.getElementById('quick-to').value;
    const onwardDate = document.getElementById('quick-date-onward').value;
    const returnDate = document.getElementById('quick-date-return').value;
    const onwardStartTime = document.getElementById('quick-time-onward').value;
    const returnStartTime = document.getElementById('quick-time-return').value;
    
    if (!fromAbbr || !toAbbr || !onwardDate || !onwardStartTime) {
        alert("Please select colleges, onward date and start time.");
        return;
    }
    
    const tbody = document.getElementById('journey-body');
    tbody.innerHTML = ""; // Clear existing
    
    const addTimedSteps = (steps, date, startTime) => {
        let currentTime = new Date(`${date}T${startTime}`);
        
        steps.forEach((step, idx) => {
            addJourneyRow();
            const row = tbody.lastElementChild;
            const km = parseFloat(step.KM) || 0;
            const mode = step.Mode === 'Taxi' || step.Mode === 'Special' ? 'Special' : (step.Mode === 'Train' ? 'Rail' : step.Mode);
            
            const speed = (mode === 'Rail') ? 60 : 40;
            const durationMin = Math.max(15, Math.round((km / speed) * 60));
            
            const fromTime = currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            currentTime.setMinutes(currentTime.getMinutes() + durationMin);
            const toTime = currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            
            row.querySelector('input[type="date"]').value = date;
            row.querySelector('input[placeholder="FT"]').value = fromTime;
            row.querySelector('input[placeholder="TT"]').value = toTime;
            row.querySelector('input[placeholder="From"]').value = step.From;
            row.querySelector('input[placeholder="To"]').value = step.To;
            row.querySelector('select').value = mode;
            row.querySelector('input[placeholder="KM"]').value = step.KM;
            
            if (step.Fare) {
                row.querySelector('input[placeholder="Fare"]').value = step.Fare;
                row.querySelector('input[placeholder="Fare"]').dataset.auto = "false";
            } else {
                row.querySelector('input[placeholder="Fare"]').dataset.auto = "true";
            }

            calculateRowFare(row);

            // Add buffer for next segment
            currentTime.setMinutes(currentTime.getMinutes() + (idx < steps.length - 1 ? 10 : 0));
        });
    };

    // 1. Onward
    const onwardRouteId = `${fromAbbr}_${toAbbr}`;
    const onwardSteps = taDatabase.routes.filter(r => r.Route_ID === onwardRouteId);
    if (onwardSteps.length > 0) {
        addTimedSteps(onwardSteps, onwardDate, onwardStartTime);
    }

    // 2. Return
    if (returnDate && returnStartTime) {
        const returnRouteId = `${toAbbr}_${fromAbbr}`;
        let returnSteps = taDatabase.routes.filter(r => r.Route_ID === returnRouteId);
        if (returnSteps.length === 0 && onwardSteps.length > 0) {
            returnSteps = [...onwardSteps].reverse().map(s => ({...s, From: s.To, To: s.From}));
        }
        if (returnSteps.length > 0) {
            addTimedSteps(returnSteps, returnDate, returnStartTime);
        }
    }

    // 3. Auto-Calculate DA
    const d1 = new Date(onwardDate);
    const d2 = returnDate ? new Date(returnDate) : d1;
    const days = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
    
    if (days > 0) {
        addJourneyRow();
        const daRow = tbody.lastElementChild;
        daRow.dataset.type = "DA";
        daRow.classList.add("bg-blue-50", "font-bold");
        daRow.querySelector('input[type="date"]').value = returnDate || onwardDate;
        daRow.querySelector('input[placeholder="From"]').value = `DA for ${days} Days`;
        daRow.querySelector('input[placeholder="To"]').classList.add("hidden");
        daRow.querySelector('input[placeholder="KM"]').classList.add("hidden");
        daRow.querySelector('select').classList.add("hidden");
        daRow.querySelector('input[placeholder="Fare"]').classList.add("hidden");
        daRow.querySelector('input[placeholder="DA"]').value = days * 600;
        daRow.dataset.days = days;
    }
    
    updateCalculations();
}

function loadSettings() {
    const saved = localStorage.getItem('ta_bill_settings');
    appSettings = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    renderSettings();
}

function setupEventListeners() {
    document.getElementById('prof-basic-pay').addEventListener('input', () => {
        calculateGrade();
        updateCalculations();
    });

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
            <div class="flex gap-1 mt-1">
                <input type="text" placeholder="FT" class="form-input text-[9px] p-0 w-8 border-none bg-transparent opacity-50" oninput="updateCalculations()">
                <input type="text" placeholder="TT" class="form-input text-[9px] p-0 w-8 border-none bg-transparent opacity-50" oninput="updateCalculations()">
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
            <input type="number" class="form-input w-10 text-right text-xs p-1 border-none bg-transparent" placeholder="KM" oninput="calculateRowFare(this.closest('tr'))">
        </td>
        <td class="p-1">
            <input type="number" class="form-input w-16 text-right text-xs p-1 border-none bg-transparent" placeholder="Fare" oninput="handleFareManual(this)">
        </td>
        <td class="p-1">
            <input type="number" class="form-input w-16 text-right text-xs p-1 border-none bg-transparent" placeholder="DA" oninput="updateCalculations()">
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
    const km = parseFloat(row.querySelector('input[placeholder="KM"]').value) || 0;
    const mode = row.querySelector('select').value;
    const fareInput = row.querySelector('input[placeholder="Fare"]');
    
    if (fareInput.dataset.auto !== "false") {
        if (mode === 'Rail') {
            fareInput.value = Math.round(km * appSettings.misc.railFarePerKM);
        } else if (mode === 'Special' || mode === 'Bus') {
            fareInput.value = (km * appSettings.misc.specialConveyanceRate).toFixed(2);
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
            const km = parseFloat(row.querySelector('input[placeholder="KM"]').value) || 0;
            const fare = parseFloat(row.querySelector('input[placeholder="Fare"]').value) || 0;
            const da = parseFloat(row.querySelector('input[placeholder="DA"]').value) || 0;
            const mode = row.querySelector('select').value;
            let rowTotal = (mode === 'Rail') ? (fare + (km * appSettings.misc.trainIncidentalRate)) : fare;
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
async function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const getVal = (id) => document.getElementById(id).value;
    const formatDate = (d) => { if(!d) return ""; const p = d.split('-'); return `${p[2]}/${p[1]}/${p[0].slice(-2)}`; };

    let autoMonth = "";
    const firstDateInput = document.querySelector('#journey-body tr input[type="date"]');
    if (firstDateInput && firstDateInput.value) {
        const d = new Date(firstDateInput.value);
        autoMonth = d.toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase();
    }
    const month = autoMonth || getVal('bill-month').toUpperCase();
    
    // Page 1: Bill
    doc.setFontSize(14); doc.text("UNIVERSITY OF CALICUT (PAREEKSHA BHAVAN)", pageWidth / 2, 12, { align: "center" });
    doc.setFontSize(10); doc.text(`TRAVELLING ALLOWANCE BILL FOR THE MONTH OF ${month}`, pageWidth / 2, 18, { align: "center" });

    doc.setFontSize(8);
    doc.text(`1) Name: ${getVal('prof-name')}`, 10, 25);
    doc.text(`5) Basic Pay: ${getVal('prof-basic-pay')}`, pageWidth/2 + 20, 25);
    doc.text(`2) Designation: ${getVal('prof-designation')}`, 10, 29);
    doc.text(`6) SB A/c: ${getVal('prof-acc-no')}`, pageWidth/2 + 20, 29);
    doc.text(`3) College: ${getVal('prof-college')}`, 10, 33);
    doc.text(`7) Bank & IFSC: ${getVal('prof-bank-ifsc')}`, pageWidth/2 + 20, 33);
    doc.text(`4) Address: ${getVal('prof-address')}`, 10, 37);

    const tableData = [];
    let totalClaim = 0;
    document.querySelectorAll('#journey-body tr').forEach((row, idx) => {
        if (row.dataset.type === "DA") {
            const da = parseFloat(row.querySelector('input[placeholder="DA"]').value) || 0;
            totalClaim += da;
            tableData.push([{ content: `DA for ${row.dataset.days} Days`, colSpan: 11, styles: { halign: 'center', fontStyle: 'bold' } }, "", "", "", "", "", "", "", "", "", "", row.dataset.days, da.toFixed(2), da.toFixed(2), ""]);
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
        const km = parseFloat(row.querySelector('input[placeholder="KM"]').value) || 0;
        const fare = parseFloat(row.querySelector('input[placeholder="Fare"]').value) || 0;
        const da = parseFloat(row.querySelector('input[placeholder="DA"]').value) || 0;
        
        let rDist = "", rdDist = "", tFare = "", iRate = "", iAmt = "", rdRate = "", rdAmt = "";
        if (mode === 'Rail') { 
            rDist = km || ""; tFare = fare || ""; iRate = appSettings.misc.trainIncidentalRate; iAmt = km ? (km * iRate).toFixed(2) : ""; 
        } else { 
            rdDist = km || ""; rdRate = appSettings.misc.specialConveyanceRate; rdAmt = fare ? fare.toFixed(2) : ""; 
        }
        
        let lineT = (mode === 'Rail' ? (fare + (parseFloat(iAmt) || 0)) : fare) + da;
        totalClaim += lineT;
        
        tableData.push([dateTime, from, to, mode, rDist, rdDist, tFare, iRate, iAmt, rdRate, rdAmt, (da>0?"1":""), da||"", lineT.toFixed(2), idx===0?getVal('bill-purpose'):""]);
    });

    doc.autoTable({
        startY: 42,
        head: [
            [{ content: 'Date & Time', rowSpan: 2 }, { content: 'Place', colSpan: 2 }, { content: 'Mode', rowSpan: 2 }, { content: 'Dist', colSpan: 2 }, { content: 'Rail (2nd AC)', colSpan: 3 }, { content: 'Road', colSpan: 2 }, { content: 'DA', colSpan: 2 }, { content: 'Total', rowSpan: 2 }, { content: 'Purpose', rowSpan: 2 }],
            ['From', 'To', 'Rail', 'Road', 'Fare', 'Rate', 'Amt', 'Rate', 'Amt', 'Days', 'Amt'],
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15']
        ],
        body: tableData,
        theme: 'grid', styles: { fontSize: 6.5, cellPadding: 1 }, headStyles: { fillColor: 240, textColor: 0, halign: 'center' }
    });

    doc.setFontSize(9);
    doc.text(`Grand Total: Rs. ${totalClaim.toFixed(2)}`, pageWidth - 50, doc.lastAutoTable.finalY + 10);
    doc.setFontSize(8);
    doc.text(`(${numberToWords(totalClaim)} Only)`, 10, doc.lastAutoTable.finalY + 10);

    // Page 2: Instructions
    doc.addPage();
    doc.setFontSize(12); doc.text("UNIVERSITY OF CALICUT - TA RULES & INSTRUCTIONS", pageWidth / 2, 20, { align: "center" });
    doc.setFontSize(9);
    const inst = [
        "1. No TA/DA will be paid if the journey distance is not more than Eight Kilometres.",
        "2. Road Mileage: Rs 2.50 per KM (Special Conveyance).",
        "3. Rail Fare: 2nd AC Fare + 90ps per KM incidental expenses for Grade I officers.",
        "4. Daily Allowance: Rs 600 per day for actual day of University business.",
        "5. Classification of Grades based on Basic Pay:",
        "   Grade I: Rs. 50,400/- and above",
        "   Grade II (a): Rs. 42,500/- and above, but below Rs. 50,400/-",
        "   Grade II (b): Rs. 27,800/- and above, but below Rs. 42,500/-",
        "   Grade III: Rs. 18,000/- and above, but below Rs. 27,800/-",
        "   Grade IV: Below Rs. 18,000/-"
    ];
    let iy = 40;
    inst.forEach(line => { doc.text(line, 20, iy); iy += 8; });

    window.open(doc.output('bloburl'), '_blank');
}

function generateHTMLBill() {
    const getVal = (id) => document.getElementById(id).value;
    const fixDate = (d) => { if(!d) return ""; const p = d.split('-'); return `${p[2]}/${p[1]}/${p[0].slice(-2)}`; };
    
    let autoMonth = "";
    const firstDateInput = document.querySelector('#journey-body tr input[type="date"]');
    if (firstDateInput && firstDateInput.value) {
        const d = new Date(firstDateInput.value);
        autoMonth = d.toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase();
    }
    const month = autoMonth || getVal('bill-month').toUpperCase();

    let tableHtml = ""; let totalClaim = 0;
    const rows = document.querySelectorAll('#journey-body tr');
    rows.forEach((row, idx) => {
        if (row.dataset.type === "DA") {
            const da = parseFloat(row.querySelector('input[placeholder="DA"]').value) || 0;
            totalClaim += da;
            tableHtml += `<tr><td></td><td colspan="2">(DA for ${row.dataset.days} Days )</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td class="text-center">${row.dataset.days}</td><td class="text-right">${da.toFixed(2)}</td><td class="text-right">${da.toFixed(2)}</td></tr>`;
            return;
        }
        const dateRaw = row.querySelector('input[type="date"]').value;
        const date = fixDate(dateRaw);
        const from = row.querySelector('input[placeholder="From"]').value;
        const to = row.querySelector('input[placeholder="To"]').value;
        const mode = row.querySelector('select').value;
        const km = parseFloat(row.querySelector('input[placeholder="KM"]').value) || 0;
        const fare = parseFloat(row.querySelector('input[placeholder="Fare"]').value) || 0;
        const da = parseFloat(row.querySelector('input[placeholder="DA"]').value) || 0;
        
        let col5="", col6="", col7="", col8="", col9="", col10="", col11="", col14="";
        if (mode === 'Rail') { 
            col5=km||""; 
            col7=fare||""; 
            col8=appSettings.misc.trainIncidentalRate; 
            col9=km ? (km*col8).toFixed(2) : ""; 
        } else { 
            col6=km||""; 
            col10=appSettings.misc.specialConveyanceRate; 
            col11=fare ? fare.toFixed(2) : ""; 
        }
        
        let lineT = (mode === 'Rail' ? (fare + (parseFloat(col9) || 0)) : fare) + da;
        totalClaim += lineT;
        col14 = lineT.toFixed(2);
        
        tableHtml += `<tr><td class="text-center">${date}</td><td>${from}</td><td>${to}</td><td>${mode}</td><td class="text-right">${col5}</td><td class="text-right">${col6}</td><td class="text-right">${col7}</td><td class="text-right">${col8}</td><td class="text-right">${col9}</td><td class="text-right">${col10}</td><td class="text-right">${col11}</td><td class="text-center"></td><td class="text-right"></td><td class="text-right">${col14}</td>${idx===0?`<td rowspan="${rows.length+1}" style="font-size:10px;text-align:center;vertical-align:middle;writing-mode:vertical-rl;transform:rotate(180deg);">${getVal('bill-purpose')}</td>`:""}</tr>`;
    });

    tableHtml += `<tr><td colspan="13" class="text-right font-bold" style="padding-right:10px;">Total</td><td class="text-right font-bold">${totalClaim.toFixed(2)}</td>${rows.length===0?'<td></td>':''}</tr>`;
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
                <td>3) Name of the College: ${getVal('prof-college')}</td>
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
                    <th rowspan="3" width="5%">Purpose of Journey<br>and Halt with<br>authority (No. &<br>Date of<br>communication )<br>(Copy to be<br>attached)</th>
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
                Place: ${getVal('prof-college').split(',')[1] ? getVal('prof-college').split(',')[1].trim() : '.........................'}<br>
                Date: ${new Date().toLocaleDateString('en-GB')}
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
        <div id="page-instructions" class="page-container" style="font-size: 11px; line-height: 1.4; padding: 10mm;">
            <h3 class="text-center" style="text-decoration: underline; font-size: 13px; margin-bottom: 15px;">
                RATES OF T. A. AND D. A. TO EXAMINERS, QUESTION PAPER SETTERS, SYNDICATE MEMBERS, PRINCIPALS OR<br>
                THOSE WHO TRAVEL ON CALICUT UNIVERSITY EXAMINATION BUSINESS
            </h3>
            
            <table style="width: 100%; border: none; font-size: 11px;">
                <tr><td style="width: 40px; vertical-align: top;">Note:</td><td style="width: 20px; vertical-align: top;">i)</td><td>No. T. A./D. A. will be paid if the journey distance is not more than Eight Kilometres unless otherwise specified in the rules.</td></tr>
                <tr><td></td><td style="vertical-align: top;">ii)</td><td>For calculating T. A./D. A. Head quarters alone will be considered. Vacation address will not be considered.</td></tr>
                <tr><td></td><td style="vertical-align: top;">iii)</td><td>The Vice-Chancellor may, for special reasons to be recorded, allow a particular examiner/question paper setter, mileage allowance at a higher rate than is prescribed in rule 1 below.</td></tr>
                <tr><td></td><td style="vertical-align: top;">iv)</td><td>The provisions under these rules are independent of the provisions in Part II, KSR.</td></tr>
            </table>

            <div style="margin-top: 10px;"><b>Rule 1. Travelling Allowance for journey by Road/Rail</b></div>
            <div style="margin-left: 20px;">Road Mileage @ Rs.2 per kilometer (special conveyance) OR II A/C Railway fare + incidental expense at the rate of 80 paise per kilometre for Grade I officers</div>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 10px; text-align: center; border: 1px solid #000;" border="1">
                <tr>
                    <th style="padding: 4px; text-align: left;">Classification</th>
                    <th style="padding: 4px;">Rate</th>
                    <th style="padding: 4px;">Eligible class of<br>journey by train</th>
                </tr>
                <tr><td style="padding: 4px; text-align: left;">Grade I - All employees who draw an actual basic pay of Rs. 50,400/- and above</td><td>0.80</td><td>II AC</td></tr>
                <tr><td style="padding: 4px; text-align: left;">Grade II (a) - Employees with actual basic pay of Rs. 42,500/- and above, but below Rs.50,400/-</td><td>0.60</td><td>I Class</td></tr>
                <tr><td style="padding: 4px; text-align: left;">Grade II (b) - Employees with actual basic pay of Rs.27,800/- and above, but below Rs.42,500/-</td><td>0.50</td><td>III AC</td></tr>
                <tr><td style="padding: 4px; text-align: left;">Grade III - Employees with actual basic pay of Rs.18,000/- and above, but below Rs.27,800/-</td><td>0.50</td><td>II Class</td></tr>
                <tr><td style="padding: 4px; text-align: left;">Grade IV - Employees with actual basic pay below Rs.18,000/-</td><td>0.50</td><td>II Class</td></tr>
            </table>

            <div style="margin-left: 20px; margin-bottom: 10px;">General - If one travels more than 200 kilometres a day by Road, the rate of mileage allowance for the excess over 200 kilometres will be reduced to &frac34; of the normal rate per kilometre.</div>

            <table style="width: 100%; border: none; font-size: 11px;">
                <tr><td style="width: 20px; vertical-align: top;">2.</td><td><b>Mileage for journey by Air :</b> (i) Prior Sanction from the Vice-Chancellor has to be obtained for performing journey by Air.<br>(ii) Actual Air fare + D.A as Incidental Expenses each way (Air tickets should be produced along with the T.A./D.A claims) + Boarding pass / Ticket Jacket.</td></tr>
                <tr><td style="vertical-align: top;">3.</td><td><b>Mileage for Journey by Ship</b><br>Actual Ship fare + D.A. outside rate OR 1&frac34; of Fare whichever is higher will be paid (Cash Receipt should be produced for claiming ship fare)</td></tr>
                <tr><td style="vertical-align: top;">4.</td><td><b>Daily Allowance</b>
                    <table style="width: 100%; border: none; font-size: 11px;">
                        <tr><td style="width: 20px; vertical-align: top;">i)</td><td>Rupees 400/- (Rupees Four hundred only) per day for actual day of University business irrespective of duration of hours of halt. For inter-state travel Rs.550/- per day (Grade I).</td></tr>
                    </table>
                </td></tr>
            </table>

            <table style="width: 60%; border-collapse: collapse; margin: 10px auto; text-align: center; border: 1px solid #000;" border="1">
                <tr><th style="padding: 4px;">Grade</th><th style="padding: 4px;">Inside State</th><th style="padding: 4px;">Outside State</th></tr>
                <tr><td style="padding: 4px;">I</td><td>400/-</td><td>550/-</td></tr>
                <tr><td style="padding: 4px;">II (a)</td><td>320/-</td><td>450/-</td></tr>
                <tr><td style="padding: 4px;">II (b)</td><td>320/-</td><td>450/-</td></tr>
                <tr><td style="padding: 4px;">III</td><td>250/-</td><td>350/-</td></tr>
                <tr><td style="padding: 4px;">IV</td><td>250/-</td><td>350/-</td></tr>
            </table>

            <table style="width: 100%; border: none; font-size: 11px; margin-left: 20px;">
                <tr><td style="width: 20px; vertical-align: top;">ii)</td><td>Rs. 550/- per day will be paid as D.A. for duty at Lakshadweep.</td></tr>
                <tr><td style="vertical-align: top;">iii)</td><td>For Chemistry Practical Examination one D.A. will be paid for the previous day of the examination for preparation work provided a certificate to that effect is furnished on the T.A. bill.</td></tr>
                <tr><td style="vertical-align: top;">iv)</td><td>For meetings of Board of Examiners, Question Paper Setters, D.A. for the actual day of University business will be paid to the members in addition to the eligible T.A. All Officers are eligible for T.A./D.A. only if the distance travelled exceeds 8 kilometres, as per rules.</td></tr>
                <tr><td style="vertical-align: top;">v)</td><td>No T.A./D.A. will be paid to the Examiners for Practical/Viva-Voce Examinations etc. unless the distance travelled exceeds 8 kilometres. If the distance travelled is below 8 kilometres but more than 2 kilometres conveyance allowance @ Rs. 5/- per day will be paid for the actual number of days of duty.</td></tr>
                <tr><td style="vertical-align: top;">vi)</td><td>For intervening Holidays or Off days between days of Duty T.A. or D.A. whichever is less will only be paid.</td></tr>
            </table>

            <table style="width: 100%; border: none; font-size: 11px; margin-top: 10px;">
                <tr><td style="width: 20px; vertical-align: top;">5.</td><td><b>T.A. and D.A. to Syndicate Members / Senate Members</b>
                    <table style="width: 100%; border: none; font-size: 11px;">
                        <tr><td style="width: 20px; vertical-align: top;">i)</td><td>Road mileage @ Rs.12/- per kilometres will be paid (Special conveyance) irrespective of the distance travelled in a day.</td></tr>
                        <tr><td style="vertical-align: top;">ii)</td><td>D.A. will be Rs. 900/-</td></tr>
                    </table>
                </td></tr>
            </table>

            <div style="text-align: right; margin-top: 30px; margin-right: 20px; font-weight: bold;">Controller of Examinations</div>
            <div style="font-size: 9px; margin-top: 20px;">CUP/307/18/50,000</div>
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
        <div class="grid grid-cols-3 gap-4">
            <div><label class="text-[10px] uppercase font-bold">Road Mileage</label><input type="number" step="0.01" value="${appSettings.misc.specialConveyanceRate}" class="form-input" onchange="updateSetting('misc', 'specialConveyanceRate', null, this.value)"></div>
            <div><label class="text-[10px] uppercase font-bold">Incidental</label><input type="number" step="0.01" value="${appSettings.misc.trainIncidentalRate}" class="form-input" onchange="updateSetting('misc', 'trainIncidentalRate', null, this.value)"></div>
            <div><label class="text-[10px] uppercase font-bold">Rail Fare/KM</label><input type="number" step="0.01" value="${appSettings.misc.railFarePerKM}" class="form-input" onchange="updateSetting('misc', 'railFarePerKM', null, this.value)"></div>
        </div></div>`;
    c.innerHTML = h;
}
function updateSetting(s, i, k, v) { if (s === 'grades') appSettings.grades[i][k] = k === 'trainClass' ? v : parseFloat(v); else appSettings.misc[i] = parseFloat(v); }
function saveSettings() { localStorage.setItem('ta_bill_settings', JSON.stringify(appSettings)); closeSettings(); calculateGrade(); updateCalculations(); }
function resetRates() { if (confirm("Reset to defaults?")) { appSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); renderSettings(); saveSettings(); } }

init();
