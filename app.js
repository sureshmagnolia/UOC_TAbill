// ta-bill-app/app.js

let taDatabase = { abbreviations: [], routes: [] };
let appSettings = {};

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
    
    // Add first empty row
    addJourneyRow();
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
            let rowTotal = (mode === 'Rail') ? fare + (km * appSettings.misc.trainIncidentalRate) : fare;
            total += rowTotal + da;
        }
    });
    document.getElementById('total-amount').innerText = `₹ ${total.toFixed(2)}`;
}

// PDF & HTML Generation
async function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const getVal = (id) => document.getElementById(id).value;
    const formatDate = (d) => { if(!d) return ""; const p = d.split('-'); return `${p[2]}/${p[1]}/${p[0].slice(-2)}`; };

    const month = getVal('bill-month').toUpperCase();
    
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
            rDist = km; tFare = fare; iRate = appSettings.misc.trainIncidentalRate; iAmt = (km * iRate).toFixed(2); 
        } else { 
            rdDist = km; rdRate = appSettings.misc.specialConveyanceRate; rdAmt = fare.toFixed(2); 
        }
        
        let lineT = (mode === 'Rail' ? fare + parseFloat(iAmt) : fare) + da;
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
    doc.text("Signature of Officer: __________________________", pageWidth - 70, doc.lastAutoTable.finalY + 25);

    // Page 2: Instructions
    doc.addPage();
    doc.setFontSize(12); doc.text("UNIVERSITY OF CALICUT - TA RULES & INSTRUCTIONS", pageWidth / 2, 20, { align: "center" });
    doc.setFontSize(9);
    const inst = [
        "1. No TA/DA paid if distance is < 8 km.",
        "2. Road Mileage: Rs 2.50 per KM (Special Conveyance).",
        "3. Rail Fare: 2nd AC Fare + 90ps per KM incidental expenses.",
        "4. Daily Allowance: Rs 600 per business day.",
        "5. Claims must be submitted within 3 months of journey.",
        "6. Grade I: Pay > 50400 (II AC), Grade II(a): Pay > 42500 (I Class), Grade II(b): Pay > 27800 (III AC)."
    ];
    let iy = 40;
    inst.forEach(line => { doc.text(line, 20, iy); iy += 8; });

    window.open(doc.output('bloburl'), '_blank');
}

function generateHTMLBill() {
    const getVal = (id) => document.getElementById(id).value;
    const fixDate = (d) => { if(!d) return ""; const p = d.split('-'); return `${p[2]}/${p[1]}/${p[0].slice(-2)}`; };
    
    let tableHtml = ""; let totalClaim = 0;
    const rows = document.querySelectorAll('#journey-body tr');
    rows.forEach((row, idx) => {
        if (row.dataset.type === "DA") {
            const da = parseFloat(row.querySelector('input[placeholder="DA"]').value) || 0;
            totalClaim += da;
            tableHtml += `<tr style="font-weight:bold;background:#fafafa;"><td colspan="11" style="text-align:center;">DA for ${row.dataset.days} Days</td><td>${row.dataset.days}</td><td>${da.toFixed(2)}</td><td>${da.toFixed(2)}</td><td></td></tr>`;
            return;
        }
        const date = fixDate(row.querySelector('input[type="date"]').value);
        const fTime = row.querySelector('input[placeholder="FT"]').value || "";
        const tTime = row.querySelector('input[placeholder="TT"]').value || "";
        const from = row.querySelector('input[placeholder="From"]').value;
        const to = row.querySelector('input[placeholder="To"]').value;
        const mode = row.querySelector('select').value;
        const km = parseFloat(row.querySelector('input[placeholder="KM"]').value) || 0;
        const fare = parseFloat(row.querySelector('input[placeholder="Fare"]').value) || 0;
        const da = parseFloat(row.querySelector('input[placeholder="DA"]').value) || 0;
        
        let rD="", rdD="", tF="", iR="", iA="", rdR="", rdA="";
        if (mode === 'Rail') { rD=km; tF=fare; iR=appSettings.misc.trainIncidentalRate; iA=(km*iR).toFixed(2); }
        else { rdD=km; rdR=appSettings.misc.specialConveyanceRate; rdA=fare.toFixed(2); }
        
        let lineT = (mode === 'Rail' ? fare + parseFloat(iA||0) : fare) + da;
        totalClaim += lineT;
        
        tableHtml += `<tr><td>${date}<br><small>${fTime}-${tTime}</small></td><td>${from}</td><td>${to}</td><td>${mode}</td><td>${rD}</td><td>${rdD}</td><td>${tF}</td><td>${iR}</td><td>${iA}</td><td>${rdR}</td><td>${rdA}</td><td>${da>0?"1":""}</td><td>${da||""}</td><td>${lineT.toFixed(2)}</td>${idx===0?`<td rowspan="${rows.length}" style="font-size:8px;text-align:left;">${getVal('bill-purpose')}</td>`:""}</tr>`;
    });

    const html = `
    <!DOCTYPE html><html><head><style>
        @page { size: A4 landscape; margin: 5mm; }
        body { font-family: 'Times New Roman', serif; padding: 20px; font-size: 11px; }
        .bill-table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1px solid #000; }
        .bill-table th, .bill-table td { border: 1px solid #000; padding: 2px; text-align: center; font-size: 8px; word-wrap: break-word; }
        .bill-table th { background: #f2f2f2; font-weight: bold; }
        .num-row td { background: #f9f9f9; font-weight: bold; font-size: 7px; }
        .signature-row { display: flex; justify-content: space-between; margin-top: 30px; }
        @media print { .no-print { display: none; } }
    </style></head><body>
        <div class="no-print"><button onclick="window.print()" style="padding:10px;background:#2563eb;color:#fff;border:none;cursor:pointer;">Print 2-Sided Bill</button></div>
        <div style="text-align:center;"><h1>UNIVERSITY OF CALICUT</h1><p>TRAVELLING ALLOWANCE BILL FOR THE MONTH OF ${getVal('bill-month').toUpperCase()}</p></div>
        <table style="width:100%;font-size:12px;margin-bottom:10px;">
            <tr><td width="55%">1) Name: <strong>${getVal('prof-name')}</strong></td><td>5) Basic Pay: <strong>${getVal('prof-basic-pay')}</strong></td></tr>
            <tr><td>2) Designation: <strong>${getVal('prof-designation')}</strong></td><td>6) A/c No: <strong>${getVal('prof-acc-no')}</strong></td></tr>
            <tr><td>3) College: <strong>${getVal('prof-college')}</strong></td><td>7) Bank & IFSC: <strong>${getVal('prof-bank-ifsc')}</strong></td></tr>
        </table>
        <table class="bill-table">
            <thead>
                <tr><th rowspan="2" width="10%">Date & Time</th><th colspan="2">Place</th><th rowspan="2" width="6%">Mode</th><th colspan="2">Dist</th><th colspan="3">Rail (2nd AC)</th><th colspan="2">Road</th><th colspan="2">DA</th><th rowspan="2" width="7%">Total</th><th rowspan="2" width="15%">Purpose</th></tr>
                <tr><th>From</th><th>To</th><th>Rail</th><th>Road</th><th>Fare</th><th>Rate</th><th>Amt</th><th>Rate</th><th>Amt</th><th>Days</th><th>Amt</th></tr>
                <tr class="num-row"><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td><td>8</td><td>9</td><td>10</td><td>11</td><td>12</td><td>13</td><td>14</td><td>15</td></tr>
            </thead>
            <tbody>${tableHtml}<tr style="font-weight:bold;background:#eee;"><td colspan="13" style="text-align:right;padding-right:10px;">GRAND TOTAL</td><td>${totalClaim.toFixed(2)}</td><td></td></tr></tbody>
        </table>
        <div class="signature-row"><div>Place: .............<br>Date: ${new Date().toLocaleDateString('en-GB')}</div><div style="text-align:center;border:1px solid #000;width:50px;height:60px;display:flex;align-items:center;">Stamp</div><div style="text-align:center;">__________________________<br>Signature of Officer</div></div>
        <div style="page-break-before:always;margin-top:50px;border-top:1px dashed #000;padding-top:20px;">
            <h3 style="text-align:center;">RATES OF T.A. AND D.A. (UNIVERSITY RULES)</h3>
            <p>1. Road Mileage: Rs 2.50 per KM (Special Conveyance).<br>2. Rail Fare: 2nd AC + 90ps/km incidental.<br>3. DA: Rs 600 per day.</p>
        </div>
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
