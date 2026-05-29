// ta-bill-app/app.js

let taDatabase = { abbreviations: [], routes: [] };
let appSettings = {};

const DEFAULT_SETTINGS = {
    grades: [
        { id: "I", minPay: 50400, roadRate: 0.80, trainClass: "II AC", daInside: 400, daOutside: 550 },
        { id: "II(a)", minPay: 42500, roadRate: 0.60, trainClass: "I Class", daInside: 320, daOutside: 450 },
        { id: "II(b)", minPay: 27800, roadRate: 0.50, trainClass: "III AC", daInside: 320, daOutside: 450 },
        { id: "III", minPay: 18000, roadRate: 0.50, trainClass: "II Class", daInside: 250, daOutside: 350 },
        { id: "IV", minPay: 0, roadRate: 0.50, trainClass: "II Class", daInside: 250, daOutside: 350 }
    ],
    misc: {
        specialConveyanceRate: 2.50, // Updated from sample
        trainIncidentalRate: 0.90, // Updated from sample
        minDistanceForTA: 8, // km
    }
};

// Initialize App
async function init() {
    try {
        const response = await fetch('ta_database.json');
        taDatabase = await response.json();
        console.log("Database loaded:", taDatabase);
        populateCollegeDropdowns();
    } catch (e) {
        console.error("Failed to load database", e);
    }

    loadSettings();
    setupEventListeners();
    
    // Add first 2 rows by default
    addJourneyRow();
    addJourneyRow();
}

function populateCollegeDropdowns() {
    const fromSelect = document.getElementById('quick-from');
    const toSelect = document.getElementById('quick-to');
    
    if (!fromSelect || !toSelect) return;
    
    fromSelect.innerHTML = '<option value="">Select College</option>';
    toSelect.innerHTML = '<option value="">Select College</option>';
    
    taDatabase.abbreviations.forEach(abbr => {
        const opt1 = document.createElement('option');
        opt1.value = abbr.Abbreviation;
        opt1.innerText = `${abbr.Abbreviation} - ${abbr['Full College Name & Location']}`;
        fromSelect.appendChild(opt1);
        
        const opt2 = document.createElement('option');
        opt2.value = abbr.Abbreviation;
        opt2.innerText = `${abbr.Abbreviation} - ${abbr['Full College Name & Location']}`;
        toSelect.appendChild(opt2);
    });
}

function generateQuickJourney() {
    const fromAbbr = document.getElementById('quick-from').value;
    const toAbbr = document.getElementById('quick-to').value;
    const onwardDate = document.getElementById('quick-date-onward').value;
    const returnDate = document.getElementById('quick-date-return').value;
    
    if (!fromAbbr || !toAbbr || !onwardDate) {
        alert("Please select colleges and onward date.");
        return;
    }
    
    const tbody = document.getElementById('journey-body');
    tbody.innerHTML = ""; // Clear existing
    
    // 1. Find Onward Route
    const onwardRouteId = `${fromAbbr}_${toAbbr}`;
    const onwardSteps = taDatabase.routes.filter(r => r.Route_ID === onwardRouteId);
    
    if (onwardSteps.length === 0) {
        alert(`No predefined route found for ${onwardRouteId} in database.`);
        return;
    }
    
    onwardSteps.forEach(step => {
        addJourneyRow();
        const row = tbody.lastElementChild;
        row.querySelector('input[type="date"]').value = onwardDate;
        row.querySelector('input[placeholder="From"]').value = step.From;
        row.querySelector('input[placeholder="To"]').value = step.To;
        row.querySelector('select').value = step.Mode === 'Taxi' ? 'Special' : step.Mode;
        row.querySelector('input[placeholder="KM"]').value = step.KM;
    });
    
    // 2. Find Return Route
    if (returnDate) {
        const returnRouteId = `${toAbbr}_${fromAbbr}`;
        const returnSteps = taDatabase.routes.filter(r => r.Route_ID === returnRouteId);
        
        if (returnSteps.length > 0) {
            returnSteps.forEach(step => {
                addJourneyRow();
                const row = tbody.lastElementChild;
                row.querySelector('input[type="date"]').value = returnDate;
                row.querySelector('input[placeholder="From"]').value = step.From;
                row.querySelector('input[placeholder="To"]').value = step.To;
                row.querySelector('select').value = step.Mode === 'Taxi' ? 'Special' : step.Mode;
                row.querySelector('input[placeholder="KM"]').value = step.KM;
            });
        } else {
            // If reverse ID not found, try to reverse onward steps manually
            [...onwardSteps].reverse().forEach(step => {
                addJourneyRow();
                const row = tbody.lastElementChild;
                row.querySelector('input[type="date"]').value = returnDate;
                row.querySelector('input[placeholder="From"]').value = step.To;
                row.querySelector('input[placeholder="To"]').value = step.From;
                row.querySelector('select').value = step.Mode === 'Taxi' ? 'Special' : step.Mode;
                row.querySelector('input[placeholder="KM"]').value = step.KM;
            });
        }
    }
    
    updateCalculations();
}

function loadSettings() {
    const saved = localStorage.getItem('ta_bill_settings');
    appSettings = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    renderSettings();
}

function setupEventListeners() {
    document.getElementById('prof-basic-pay').addEventListener('input', calculateGrade);
}

function calculateGrade() {
    const pay = parseFloat(document.getElementById('prof-basic-pay').value) || 0;
    const grade = appSettings.grades.find(g => pay >= g.minPay);
    document.getElementById('prof-grade').value = grade ? grade.id : "IV";
    updateCalculations();
}

// Journey Row Management
function addJourneyRow() {
    const tbody = document.getElementById('journey-body');
    const rowId = Date.now() + Math.random();
    const tr = document.createElement('tr');
    tr.id = `row-${rowId}`;
    tr.className = "hover:bg-gray-50 transition border-b";
    
    tr.innerHTML = `
        <td class="p-1"><input type="date" class="form-input text-[10px] p-1 border-none bg-transparent"></td>
        <td class="p-1">
            <input type="text" list="stations" class="form-input text-xs p-1 border-none bg-transparent" placeholder="From" oninput="handleStationInput(this)">
        </td>
        <td class="p-1">
            <input type="text" list="stations" class="form-input text-xs p-1 border-none bg-transparent" placeholder="To" oninput="handleStationInput(this)">
        </td>
        <td class="p-1">
            <select class="form-input text-xs p-1 border-none bg-transparent appearance-none" onchange="updateCalculations()">
                <option value="Special">Special</option>
                <option value="Rail">Rail</option>
                <option value="Bus">Bus</option>
                <option value="Air">Air</option>
            </select>
        </td>
        <td class="p-1">
            <input type="number" class="form-input w-12 text-right text-xs p-1 border-none bg-transparent" placeholder="KM" oninput="updateCalculations()">
        </td>
        <td class="p-1">
            <input type="number" class="form-input w-16 text-right text-xs p-1 border-none bg-transparent" placeholder="Fare" oninput="updateCalculations()">
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
    taDatabase.routes.forEach(r => {
        stations.add(r.From);
        stations.add(r.To);
    });
    
    stations.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        dl.appendChild(opt);
    });
    document.body.appendChild(dl);
}

function handleStationInput(input) {
    const row = input.closest('tr');
    const from = row.querySelector('input[placeholder="From"]').value;
    const to = row.querySelector('input[placeholder="To"]').value;
    
    if (from && to) {
        const route = taDatabase.routes.find(r => 
            (r.From === from && r.To === to) || (r.From === to && r.To === from)
        );
        
        if (route) {
            row.querySelector('input[placeholder="KM"]').value = route.KM;
            row.querySelector('select').value = route.Mode === 'Taxi' ? 'Special' : route.Mode;
        }
    }
    updateCalculations();
}

function updateCalculations() {
    let total = 0;
    const rows = document.querySelectorAll('#journey-body tr');
    
    rows.forEach(row => {
        const km = parseFloat(row.querySelector('input[placeholder="KM"]').value) || 0;
        const fare = parseFloat(row.querySelector('input[placeholder="Fare"]').value) || 0;
        const da = parseFloat(row.querySelector('input[placeholder="DA"]').value) || 0;
        const mode = row.querySelector('select').value;
        
        let rowTotal = 0;
        if (mode === 'Special') {
            rowTotal = km * appSettings.misc.specialConveyanceRate;
        } else if (mode === 'Rail') {
            rowTotal = fare + (km * appSettings.misc.trainIncidentalRate);
        } else if (mode === 'Bus' || mode === 'Air') {
            rowTotal = fare;
        }
        
        rowTotal += da;
        total += rowTotal;
    });
    
    document.getElementById('total-amount').innerText = `₹ ${total.toFixed(2)}`;
}

// Settings UI
function openSettings() {
    document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettings() {
    document.getElementById('settings-modal').classList.add('hidden');
}

function renderSettings() {
    const container = document.getElementById('settings-content');
    let html = `<div class="space-y-4">`;
    
    html += `<h3 class="font-bold text-sm text-gray-500 uppercase border-b pb-2">Grade Rules</h3>`;
    appSettings.grades.forEach((g, idx) => {
        html += `
            <div class="grid grid-cols-6 gap-2 items-center bg-gray-50 p-3 rounded border">
                <div class="font-bold text-blue-800">${g.id}</div>
                <div>
                    <label class="text-[9px] uppercase font-bold text-gray-400">Min Pay</label>
                    <input type="number" value="${g.minPay}" class="form-input p-1 text-xs" onchange="updateSetting('grades', ${idx}, 'minPay', this.value)">
                </div>
                <div>
                    <label class="text-[9px] uppercase font-bold text-gray-400">Road/KM</label>
                    <input type="number" step="0.01" value="${g.roadRate}" class="form-input p-1 text-xs" onchange="updateSetting('grades', ${idx}, 'roadRate', this.value)">
                </div>
                <div>
                    <label class="text-[9px] uppercase font-bold text-gray-400">Train</label>
                    <input type="text" value="${g.trainClass}" class="form-input p-1 text-xs" onchange="updateSetting('grades', ${idx}, 'trainClass', this.value)">
                </div>
                <div>
                    <label class="text-[9px] uppercase font-bold text-gray-400">DA In</label>
                    <input type="number" value="${g.daInside}" class="form-input p-1 text-xs" onchange="updateSetting('grades', ${idx}, 'daInside', this.value)">
                </div>
                <div>
                    <label class="text-[9px] uppercase font-bold text-gray-400">DA Out</label>
                    <input type="number" value="${g.daOutside}" class="form-input p-1 text-xs" onchange="updateSetting('grades', ${idx}, 'daOutside', this.value)">
                </div>
            </div>
        `;
    });
    
    html += `<h3 class="font-bold text-sm text-gray-500 uppercase border-b pb-2 mt-6">Misc Rates</h3>`;
    html += `
        <div class="grid grid-cols-3 gap-4">
            <div>
                <label class="text-[10px] uppercase font-bold text-gray-400">Special Conveyance (Road)</label>
                <input type="number" step="0.01" value="${appSettings.misc.specialConveyanceRate}" class="form-input" onchange="updateSetting('misc', 'specialConveyanceRate', null, this.value)">
            </div>
            <div>
                <label class="text-[10px] uppercase font-bold text-gray-400">Train Incidental (per KM)</label>
                <input type="number" step="0.01" value="${appSettings.misc.trainIncidentalRate}" class="form-input" onchange="updateSetting('misc', 'trainIncidentalRate', null, this.value)">
            </div>
            <div>
                <label class="text-[10px] uppercase font-bold text-gray-400">Min Distance (TA)</label>
                <input type="number" value="${appSettings.misc.minDistanceForTA}" class="form-input" onchange="updateSetting('misc', 'minDistanceForTA', null, this.value)">
            </div>
        </div>
    `;
    
    html += `</div>`;
    container.innerHTML = html;
}

function updateSetting(section, indexOrKey, key, value) {
    if (section === 'grades') {
        appSettings.grades[indexOrKey][key] = key === 'trainClass' ? value : parseFloat(value);
    } else {
        appSettings.misc[indexOrKey] = parseFloat(value);
    }
}

function saveSettings() {
    localStorage.setItem('ta_bill_settings', JSON.stringify(appSettings));
    closeSettings();
    calculateGrade();
    updateCalculations();
}

function resetRates() {
    if (confirm("Reset all rates to University defaults?")) {
        appSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        renderSettings();
        saveSettings();
    }
}

function loadSampleData() {
    // Profile
    document.getElementById('prof-name').value = "SURESH V";
    document.getElementById('prof-designation').value = "Assistant Professor";
    document.getElementById('prof-college').value = "Govt. Victoria College, Palakkad";
    document.getElementById('prof-address').value = "Nedumani, Nenmeni PO, Kollengode, Palakkad -1";
    document.getElementById('prof-basic-pay').value = "87300";
    document.getElementById('prof-acc-no').value = "30003630389";
    document.getElementById('prof-bank-ifsc').value = "SBI, Victoria College Road, SBIN0012886";
    document.getElementById('bill-month').value = "JANUARY 2022";
    document.getElementById('bill-purpose').value = "For Attending M.Sc 2nd Semester Practical ExaminationAs per Order No. 49334/PG-X-ASST-II/2016/PB Dated 31/01/22";

    calculateGrade();

    // Journey
    const tbody = document.getElementById('journey-body');
    tbody.innerHTML = "";
    
    const sampleJourneys = [
        { date: "2022-02-04", from: "GVC", to: "Palakkad Junction", mode: "Special", km: 3, fare: 0, da: 0 },
        { date: "2022-02-04", from: "Palakkad Junction", to: "Thrissur Junction", mode: "Rail", km: 75, fare: 750, da: 0 },
        { date: "2022-02-04", from: "Thrissur Junction", to: "St. Mary's College", mode: "Special", km: 3, fare: 0, da: 0 },
        { date: "2022-02-04", from: "St. Mary's College", to: "Thrissur Junction", mode: "Special", km: 3, fare: 0, da: 0 },
        { date: "2022-02-04", from: "Thrissur Junction", to: "Palakkad Junction", mode: "Rail", km: 75, fare: 750, da: 0 },
        { date: "2022-02-04", from: "Palakkad Junction", to: "GVC", mode: "Special", km: 3, fare: 0, da: 0 },
        { date: "", from: "", to: "", mode: "Special", km: 0, fare: 0, da: 600 } // DA row
    ];

    sampleJourneys.forEach(j => {
        addJourneyRow();
        const row = tbody.lastElementChild;
        row.querySelector('input[type="date"]').value = j.date;
        row.querySelector('input[placeholder="From"]').value = j.from;
        row.querySelector('input[placeholder="To"]').value = j.to;
        row.querySelector('select').value = j.mode;
        row.querySelector('input[placeholder="KM"]').value = j.km;
        row.querySelector('input[placeholder="Fare"]').value = j.fare;
        row.querySelector('input[placeholder="DA"]').value = j.da;
    });

    updateCalculations();
}

// PDF Generation
async function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(14);
    doc.text("UNIVERSITY OF CALICUT", pageWidth / 2, 15, { align: "center" });
    doc.setFontSize(10);
    doc.text("(PAREEKSHA BHAVAN)", pageWidth / 2, 20, { align: "center" });
    
    const month = document.getElementById('bill-month').value || "..................";
    doc.setFontSize(11);
    doc.text(`TRAVELLING ALLOWANCE FOR THE MONTH OF ${month}`, pageWidth / 2, 27, { align: "center" });

    // Top Right Fields
    doc.setFontSize(8);
    doc.text("Voucher No. ..........................", pageWidth - 15, 33, { align: "right" });
    doc.text("Month of ..........................", pageWidth - 15, 38, { align: "right" });
    doc.text("Debit Head ..........................", pageWidth - 15, 43, { align: "right" });

    // Personal Details
    doc.setFontSize(9);
    let y = 35;
    const leftX = 15;
    const rightX = pageWidth / 2 + 5;
    
    const getVal = (id) => document.getElementById(id).value;
    
    doc.text(`1) Name (In Block Letters): ${getVal('prof-name')}`, leftX, y);
    doc.text(`5) Basic Pay: ${getVal('prof-basic-pay')}`, rightX, y); y += 6;
    
    doc.text(`2) Designation: ${getVal('prof-designation')}`, leftX, y);
    doc.text(`6) Savings Bank A/c No: ${getVal('prof-acc-no')}`, rightX, y); y += 6;
    
    doc.text(`3) Name of the College: ${getVal('prof-college')}`, leftX, y);
    doc.text(`7) Bank & IFSC: ${getVal('prof-bank-ifsc')}`, rightX, y); y += 6;
    
    doc.text(`4) Permanent Address: ${getVal('prof-address')}`, leftX, y);
    
    // Table Headers
    const tableData = [];
    const rows = document.querySelectorAll('#journey-body tr');
    let totalClaim = 0;
    
    const pay = parseFloat(getVal('prof-basic-pay')) || 0;
    const grade = appSettings.grades.find(g => pay >= g.minPay) || appSettings.grades[4];

    rows.forEach((row, idx) => {
        const date = row.querySelector('input[type="date"]').value;
        const from = row.querySelector('input[placeholder="From"]').value;
        const to = row.querySelector('input[placeholder="To"]').value;
        const mode = row.querySelector('select').value;
        const km = parseFloat(row.querySelector('input[placeholder="KM"]').value) || 0;
        const fare = parseFloat(row.querySelector('input[placeholder="Fare"]').value) || 0;
        const da = parseFloat(row.querySelector('input[placeholder="DA"]').value) || 0;
        
        let railDist = "", roadDist = "", trainFare = "", incidentalRate = "", incidentalAmt = "", roadRate = "", roadAmt = "";
        let lineTotal = 0;

        if (mode === 'Special') {
            roadDist = km;
            roadRate = appSettings.misc.specialConveyanceRate;
            roadAmt = km * roadRate;
            lineTotal = roadAmt;
        } else if (mode === 'Rail') {
            railDist = km;
            trainFare = fare;
            incidentalRate = appSettings.misc.trainIncidentalRate;
            incidentalAmt = km * incidentalRate;
            lineTotal = trainFare + incidentalAmt;
        } else {
            // Bus/Air
            if (mode === 'Air') railDist = km; else roadDist = km;
            trainFare = fare;
            lineTotal = fare;
        }

        lineTotal += da;
        totalClaim += lineTotal;

        tableData.push([
            date, from, to, mode, railDist, roadDist, trainFare, incidentalRate, incidentalAmt, roadRate, roadAmt, (da > 0 ? "1" : ""), da, lineTotal, ""
        ]);
    });

    // Handle Purpose (Column 15) - Add it to first row or span
    if (tableData.length > 0) {
        tableData[0][14] = document.getElementById('bill-purpose').value;
    }

    doc.autoTable({
        startY: y + 15,
        head: [
            [{ content: 'Date', rowSpan: 2 }, { content: 'Place', colSpan: 2 }, { content: 'Mode', rowSpan: 2 }, { content: 'Distance', colSpan: 2 }, { content: 'Rail/Air', colSpan: 3 }, { content: 'Road', colSpan: 2 }, { content: 'DA', colSpan: 2 }, { content: 'Total', rowSpan: 2 }, { content: 'Purpose of Journey', rowSpan: 2 }],
            ['From', 'To', 'Rail', 'Road', 'Fare', 'Rate', 'Amt', 'Rate', 'Amt', 'Days', 'Amt']
        ],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 6.5, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
        headStyles: { fillColor: [255, 255, 255], textColor: 0, halign: 'center', fontStyle: 'bold' },
        columnStyles: {
            0: { cellWidth: 14 }, // Date
            1: { cellWidth: 18 }, // From
            2: { cellWidth: 18 }, // To
            3: { cellWidth: 14 }, // Mode
            4: { cellWidth: 10 }, // Rail KM
            5: { cellWidth: 10 }, // Road KM
            6: { cellWidth: 12 }, // Fare
            7: { cellWidth: 10 }, // Incid Rate
            8: { cellWidth: 12 }, // Incid Amt
            9: { cellWidth: 10 }, // Road Rate
            10: { cellWidth: 12 }, // Road Amt
            11: { cellWidth: 10 }, // DA Days
            12: { cellWidth: 12 }, // DA Amt
            13: { cellWidth: 12 }, // Line Total
            14: { cellWidth: 15, halign: 'center' } // Purpose
        },
        margin: { left: 5, right: 5 },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 14 && data.row.index === 0) {
                // This is the Purpose column. If we wanted vertical text, we'd do it here.
                // For now, let's just make it wrap.
            }
        }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text(`Total Claimed: Rs. ${totalClaim.toFixed(2)}`, pageWidth - 60, finalY);
    
    // Certificates
    doc.setFontSize(8);
    let certY = finalY + 15;
    doc.text("CERTIFICATE", pageWidth / 2, certY, { align: "center" }); certY += 5;
    doc.text("1) I Certify that the amount claimed in this bill has not been claimed previously or drawn from any other source.", 15, certY); certY += 4;
    doc.text("2) I Certify that the road journey for which mileage expense has been claimed at the higher rates was performed in my own car.", 15, certY); certY += 15;
    
    doc.text("Place: ....................", 15, certY);
    doc.text("Signature of the Officer", pageWidth - 60, certY); certY += 5;
    doc.text("Date: ....................", 15, certY);

    window.open(doc.output('bloburl'), '_blank');
}

function generateHTMLBill() {
    const getVal = (id) => document.getElementById(id).value;
    const month = getVal('bill-month') || "..................";
    const name = getVal('prof-name');
    const designation = getVal('prof-designation');
    const college = getVal('prof-college');
    const address = getVal('prof-address');
    const basicPay = getVal('prof-basic-pay');
    const accNo = getVal('prof-acc-no');
    const bankIfsc = getVal('prof-bank-ifsc');
    const purpose = getVal('bill-purpose');

    const rows = document.querySelectorAll('#journey-body tr');
    let tableHtml = "";
    let totalClaim = 0;

    rows.forEach((row, idx) => {
        const date = row.querySelector('input[type="date"]').value;
        const from = row.querySelector('input[placeholder="From"]').value;
        const to = row.querySelector('input[placeholder="To"]').value;
        const mode = row.querySelector('select').value;
        const km = parseFloat(row.querySelector('input[placeholder="KM"]').value) || 0;
        const fare = parseFloat(row.querySelector('input[placeholder="Fare"]').value) || 0;
        const da = parseFloat(row.querySelector('input[placeholder="DA"]').value) || 0;
        
        let railDist = "", roadDist = "", trainFare = "", incidentalRate = "", incidentalAmt = "", roadRate = "", roadAmt = "";
        let lineTotal = 0;

        if (mode === 'Special') {
            roadDist = km;
            roadRate = appSettings.misc.specialConveyanceRate;
            roadAmt = (km * roadRate).toFixed(2);
            lineTotal = km * roadRate;
        } else if (mode === 'Rail') {
            railDist = km;
            trainFare = fare;
            incidentalRate = appSettings.misc.trainIncidentalRate;
            incidentalAmt = (km * incidentalRate).toFixed(2);
            lineTotal = fare + (km * incidentalRate);
        } else {
            if (mode === 'Air') railDist = km; else roadDist = km;
            trainFare = fare;
            lineTotal = fare;
        }

        lineTotal += da;
        totalClaim += lineTotal;

        tableHtml += `
            <tr>
                <td>${date}</td>
                <td>${from}</td>
                <td>${to}</td>
                <td>${mode}</td>
                <td>${railDist}</td>
                <td>${roadDist}</td>
                <td>${trainFare}</td>
                <td>${incidentalRate}</td>
                <td>${incidentalAmt}</td>
                <td>${roadRate}</td>
                <td>${roadAmt}</td>
                <td>${da > 0 ? "1" : ""}</td>
                <td>${da || ""}</td>
                <td>${lineTotal.toFixed(2)}</td>
                ${idx === 0 ? `<td rowspan="${rows.length}" style="font-size: 8px; vertical-align: top;">${purpose}</td>` : ""}
            </tr>
        `;
    });

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>TA Bill - ${name}</title>
            <style>
                body { font-family: sans-serif; padding: 20px; font-size: 12px; line-height: 1.4; color: #333; }
                .header { text-align: center; margin-bottom: 20px; }
                .header h1 { margin: 0; font-size: 18px; }
                .header p { margin: 2px 0; }
                .meta-table { width: 100%; margin-bottom: 20px; }
                .meta-table td { padding: 4px 0; }
                .bill-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                .bill-table th, .bill-table td { border: 1px solid #000; padding: 4px; text-align: center; font-size: 10px; }
                .bill-table th { background: #f2f2f2; }
                .footer { margin-top: 40px; }
                .signature-section { display: flex; justify-content: space-between; margin-top: 60px; }
                .stamp { border: 1px solid #000; width: 60px; height: 70px; display: flex; align-items: center; text-align: center; font-size: 9px; }
                @media print { .no-print { display: none; } body { padding: 0; } }
            </style>
        </head>
        <body>
            <button class="no-print" onclick="window.print()" style="margin-bottom: 20px; padding: 10px 20px; background: #2563eb; color: #white; border: none; border-radius: 4px; cursor: pointer;">Print Bill</button>
            <div class="header">
                <h1>UNIVERSITY OF CALICUT</h1>
                <p>(PAREEKSHA BHAVAN)</p>
                <p><strong>TRAVELLING ALLOWANCE FOR THE MONTH OF ${month.toUpperCase()}</strong></p>
            </div>

            <table class="meta-table">
                <tr>
                    <td width="55%">1) Name (In Block Letters): <strong>${name}</strong></td>
                    <td>5) Basic Pay/Consolidated Amount: <strong>${basicPay}</strong></td>
                </tr>
                <tr>
                    <td>2) Designation: <strong>${designation}</strong></td>
                    <td>6) Savings Bank A/c No: <strong>${accNo}</strong></td>
                </tr>
                <tr>
                    <td>3) Name of the College: <strong>${college}</strong></td>
                    <td>7) Name of the Bank with IFSC Code: <strong>${bankIfsc}</strong></td>
                </tr>
                <tr>
                    <td>4) Permanent Address: <strong>${address}</strong></td>
                    <td>Voucher No: .................................<br>Month of: .................................<br>Debit Head: .................................</td>
                </tr>
            </table>

            <table class="bill-table">
                <thead>
                    <tr>
                        <th rowspan="2">Date</th>
                        <th colspan="2">Place</th>
                        <th rowspan="2">Mode</th>
                        <th colspan="2">Distance</th>
                        <th colspan="3">Rail/Air Journey</th>
                        <th colspan="2">Road Journey</th>
                        <th colspan="2">Daily Allowance</th>
                        <th rowspan="2">Total</th>
                        <th rowspan="2">Purpose</th>
                    </tr>
                    <tr>
                        <th>From</th>
                        <th>To</th>
                        <th>Rail</th>
                        <th>Road</th>
                        <th>Fare</th>
                        <th>Rate</th>
                        <th>Amt</th>
                        <th>Rate</th>
                        <th>Amt</th>
                        <th>Days</th>
                        <th>Amt</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableHtml}
                    <tr>
                        <td colspan="13" style="text-align: right;"><strong>Total</strong></td>
                        <td><strong>${totalClaim.toFixed(2)}</strong></td>
                        <td></td>
                    </tr>
                </tbody>
            </table>

            <div class="footer">
                <p><strong>CERTIFICATE</strong></p>
                <p>1) I certify that the amount claimed in this bill or any part thereof has not been claimed previously OR drawn from any other source.</p>
                <p>2) I certify that the road journey on .................... for which mileage allowance has been claimed at the higher rates was performed in my own car Reg. No. ....................</p>
                
                <div class="signature-section">
                    <div>
                        <p>Place: <strong>Palakkad</strong></p>
                        <p>Date: <strong>${new Date().toLocaleDateString()}</strong></p>
                    </div>
                    <div class="stamp">Revenue<br>Stamp</div>
                    <div style="text-align: center;">
                        <br><br>
                        <p>__________________________</p>
                        <p>Signature of the Officer who travelled</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
}

// Start the app
init();
