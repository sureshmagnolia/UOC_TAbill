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
        railFarePerKM: 1.60, // Estimated 2nd AC rate for auto-calc
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
            const mode = step.Mode === 'Taxi' ? 'Special' : (step.Mode === 'Train' ? 'Rail' : step.Mode);
            
            const speed = mode === 'Rail' ? 60 : 40;
            const durationMin = Math.max(10, Math.round((km / speed) * 60));
            
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
        daRow.querySelector('input[placeholder="To"]').value = "";
        daRow.querySelector('input[placeholder="KM"]').value = "";
        daRow.querySelector('select').classList.add("hidden");
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
            <select class="form-input text-xs p-1 border-none bg-transparent appearance-none" onchange="updateCalculations()">
                <option value="Special">Special</option>
                <option value="Rail">Rail</option>
                <option value="Bus">Bus</option>
                <option value="Air">Air</option>
            </select>
        </td>
        <td class="p-1">
            <input type="number" class="form-input w-10 text-right text-xs p-1 border-none bg-transparent" placeholder="KM" oninput="updateCalculations()">
        </td>
        <td class="p-1">
            <input type="number" class="form-input w-16 text-right text-xs p-1 border-none bg-transparent" placeholder="Fare" oninput="handleFareInput(this)">
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
            row.querySelector('select').value = route.Mode === 'Taxi' ? 'Special' : (route.Mode === 'Train' ? 'Rail' : route.Mode);
        }
    }
    updateCalculations();
}

function handleFareInput(input) {
    input.dataset.auto = "false";
    updateCalculations();
}

function updateCalculations() {
    let total = 0;
    const rows = document.querySelectorAll('#journey-body tr');
    
    rows.forEach(row => {
        if (row.dataset.type === "DA") {
            total += parseFloat(row.querySelector('input[placeholder="DA"]').value) || 0;
            return;
        }

        const kmInput = row.querySelector('input[placeholder="KM"]');
        const fareInput = row.querySelector('input[placeholder="Fare"]');
        const daInput = row.querySelector('input[placeholder="DA"]');
        
        const km = parseFloat(kmInput.value) || 0;
        const mode = row.querySelector('select').value;
        
        // Auto-calculate Fare if empty or auto-flagged
        if (fareInput.value === "" || fareInput.dataset.auto === "true") {
            if (mode === 'Rail') {
                fareInput.value = Math.round(km * appSettings.misc.railFarePerKM);
                fareInput.dataset.auto = "true";
            } else if (mode === 'Special' || mode === 'Bus') {
                fareInput.value = (km * appSettings.misc.specialConveyanceRate).toFixed(2);
                fareInput.dataset.auto = "true";
            }
        }

        const fare = parseFloat(fareInput.value) || 0;
        const da = parseFloat(daInput.value) || 0;
        
        let rowTotal = 0;
        if (mode === 'Special' || mode === 'Bus') {
            rowTotal = fare; 
        } else if (mode === 'Rail') {
            rowTotal = fare + (km * appSettings.misc.trainIncidentalRate);
        } else {
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
                <label class="text-[10px] uppercase font-bold text-gray-400">Road Mileage (Bus/Taxi)</label>
                <input type="number" step="0.01" value="${appSettings.misc.specialConveyanceRate}" class="form-input" onchange="updateSetting('misc', 'specialConveyanceRate', null, this.value)">
            </div>
            <div>
                <label class="text-[10px] uppercase font-bold text-gray-400">Train Incidental (per KM)</label>
                <input type="number" step="0.01" value="${appSettings.misc.trainIncidentalRate}" class="form-input" onchange="updateSetting('misc', 'trainIncidentalRate', null, this.value)">
            </div>
            <div>
                <label class="text-[10px] uppercase font-bold text-gray-400">Rail Fare (per KM)</label>
                <input type="number" step="0.01" value="${appSettings.misc.railFarePerKM}" class="form-input" onchange="updateSetting('misc', 'railFarePerKM', null, this.value)">
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

    rows.forEach((row, idx) => {
        if (row.dataset.type === "DA") {
            const da = parseFloat(row.querySelector('input[placeholder="DA"]').value) || 0;
            const days = row.dataset.days || "1";
            totalClaim += da;
            tableData.push([
                { content: `(DA for ${days} Days)`, colSpan: 12, styles: { halign: 'center', fontStyle: 'bold' } },
                "", "", "", "", "", "", "", "", "", "", "", da, "", ""
            ]);
            // Filter out the empty cells that autoTable would otherwise draw
            tableData[tableData.length-1] = tableData[tableData.length-1].slice(0, 2); 
            tableData[tableData.length-1].push(da);
            tableData[tableData.length-1].push("");
            return;
        }

        const date = row.querySelector('input[type="date"]').value;
        const from = row.querySelector('input[placeholder="From"]').value;
        const to = row.querySelector('input[placeholder="To"]').value;
        const mode = row.querySelector('select').value;
        const km = parseFloat(row.querySelector('input[placeholder="KM"]').value) || 0;
        const fare = parseFloat(row.querySelector('input[placeholder="Fare"]').value) || 0;
        const da = parseFloat(row.querySelector('input[placeholder="DA"]').value) || 0;
        
        let railDist = "", roadDist = "", trainFare = "", incidentalRate = "", incidentalAmt = "", roadRate = "", roadAmt = "";
        let lineTotal = 0;

        if (mode === 'Special' || mode === 'Bus') {
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

        tableData.push([
            date, from, to, mode, railDist, roadDist, trainFare, incidentalRate, incidentalAmt, roadRate, roadAmt, (da > 0 ? "1" : ""), da, lineTotal.toFixed(2), ""
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
        margin: { left: 5, right: 5 }
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
    const formatDate = (d) => { if(!d) return ""; const parts = d.split('-'); return `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}`; };
    
    const name = getVal('prof-name');
    const designation = getVal('prof-designation');
    const college = getVal('prof-college');
    const address = getVal('prof-address');
    const basicPay = getVal('prof-basic-pay');
    const accNo = getVal('prof-acc-no');
    const bankIfsc = getVal('prof-bank-ifsc');
    const month = getVal('bill-month');
    const purpose = getVal('bill-purpose');

    const rows = document.querySelectorAll('#journey-body tr');
    let tableHtml = "";
    let totalClaim = 0;

    rows.forEach((row, idx) => {
        if (row.dataset.type === "DA") {
            const da = parseFloat(row.querySelector('input[placeholder="DA"]').value) || 0;
            const days = row.dataset.days || "1";
            totalClaim += da;
            tableHtml += `
                <tr style="background: #fdfdfd; font-weight: bold;">
                    <td colspan="13" style="text-align: center;">DA for ${days} Days</td>
                    <td>${da.toFixed(2)}</td>
                    ${idx === 0 ? `<td rowspan="${rows.length}" style="font-size: 8px; vertical-align: top; text-align: left;">${purpose}</td>` : ""}
                </tr>
            `;
            return;
        }

        const date = formatDate(row.querySelector('input[type="date"]').value);
        const from = row.querySelector('input[placeholder="From"]').value;
        const to = row.querySelector('input[placeholder="To"]').value;
        const mode = row.querySelector('select').value;
        const km = parseFloat(row.querySelector('input[placeholder="KM"]').value) || 0;
        const fare = parseFloat(row.querySelector('input[placeholder="Fare"]').value) || 0;
        const da = parseFloat(row.querySelector('input[placeholder="DA"]').value) || 0;
        const fTime = row.querySelector('input[placeholder="FT"]').value || "";
        const tTime = row.querySelector('input[placeholder="TT"]').value || "";
        
        let railDist = "", roadDist = "", trainFare = "", incidentalRate = "", incidentalAmt = "", roadRate = "", roadAmt = "";
        let lineTotal = 0;

        if (mode === 'Special' || mode === 'Bus') {
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
                <td>${date}<br><small>${fTime}-${tTime}</small></td>
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
                ${idx === 0 ? `<td rowspan="${rows.length}" style="font-size: 8px; vertical-align: top; text-align: left;">${purpose}</td>` : ""}
            </tr>
        `;
    });

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>TA Bill - ${name}</title>
            <style>
                @page { size: A4; margin: 10mm; }
                body { font-family: 'Times New Roman', serif; color: #000; background: #fff; margin: 0; padding: 0; }
                .page { width: 210mm; min-height: 297mm; padding: 10mm; margin: 0 auto; background: #fff; position: relative; box-sizing: border-box; page-break-after: always; }
                .header { text-align: center; border-bottom: 1px double #000; padding-bottom: 10px; margin-bottom: 15px; }
                .header h1 { margin: 0; font-size: 20px; font-weight: bold; }
                .header p { margin: 2px 0; font-size: 14px; }
                .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 12px; }
                .meta-table td { padding: 3px 0; vertical-align: top; }
                .bill-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
                .bill-table th, .bill-table td { border: 1px solid #000; padding: 3px; text-align: center; font-size: 9px; line-height: 1.1; }
                .bill-table th { background: #eee; font-weight: bold; }
                .footer { margin-top: 20px; font-size: 11px; }
                .cert-box { border: 1px solid #000; padding: 10px; margin-top: 10px; }
                .signature-row { display: flex; justify-content: space-between; margin-top: 40px; }
                .stamp-box { border: 1px solid #000; width: 60px; height: 70px; display: flex; align-items: center; text-align: center; font-size: 10px; }
                
                /* Instructions Page */
                .instructions { font-size: 11px; line-height: 1.3; }
                .instructions h2 { font-size: 14px; text-align: center; text-decoration: underline; margin-bottom: 15px; }
                .instructions ol { padding-left: 20px; }
                .instructions li { margin-bottom: 8px; }
                .grade-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                .grade-table th, .grade-table td { border: 1px solid #000; padding: 4px; text-align: left; }
                
                @media print { 
                    .no-print { display: none; } 
                    .page { border: none; box-shadow: none; margin: 0; width: 100%; } 
                }
            </style>
        </head>
        <body>
            <div class="no-print" style="position: fixed; top: 10px; right: 10px; z-index: 1000;">
                <button onclick="window.print()" style="padding: 10px 20px; background: #2563eb; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">Print 2-Sided Bill</button>
            </div>

            <!-- PAGE 1: BILL -->
            <div class="page">
                <div class="header">
                    <h1>UNIVERSITY OF CALICUT</h1>
                    <p>(PAREEKSHA BHAVAN)</p>
                    <p><strong>TRAVELLING ALLOWANCE BILL FOR THE MONTH OF ${month.toUpperCase()}</strong></p>
                </div>

                <table class="meta-table">
                    <tr>
                        <td width="55%">1) Name (in block letters): <strong>${name}</strong></td>
                        <td>5) Basic Pay/Consolidated Amount: <strong>${basicPay}</strong></td>
                    </tr>
                    <tr>
                        <td>2) Designation: <strong>${designation}</strong></td>
                        <td>6) Savings Bank A/c No: <strong>${accNo}</strong></td>
                    </tr>
                    <tr>
                        <td>3) Name of College: <strong>${college}</strong></td>
                        <td>7) Name of the Bank with IFSC Code: <strong>${bankIfsc}</strong></td>
                    </tr>
                    <tr>
                        <td rowspan="2">4) Permanent Address: <strong>${address}</strong></td>
                        <td style="border-top: 1px solid #ddd; padding-top: 5px;">Voucher No: .................................<br>Month of: .................................<br>Debit Head: .................................</td>
                    </tr>
                </table>

                <table class="bill-table">
                    <thead>
                        <tr>
                            <th rowspan="2" width="10%">Date &<br>Time</th>
                            <th colspan="2">Place</th>
                            <th rowspan="2" width="6%">Mode of<br>Conv.</th>
                            <th colspan="2">Distance</th>
                            <th colspan="3">Rail/Air Journey</th>
                            <th colspan="2">Road Journey</th>
                            <th colspan="2">Daily Allowance</th>
                            <th rowspan="2" width="7%">Total</th>
                            <th rowspan="2" width="15%">Purpose</th>
                        </tr>
                        <tr>
                            <th width="10%">From</th>
                            <th width="10%">To</th>
                            <th width="4%">Rail</th>
                            <th width="4%">Road</th>
                            <th width="6%">Fare</th>
                            <th width="5%">Rate</th>
                            <th width="6%">Amt</th>
                            <th width="5%">Rate</th>
                            <th width="6%">Amt</th>
                            <th width="4%">Days</th>
                            <th width="6%">Amt</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableHtml}
                        <tr style="font-weight: bold; background: #f9f9f9;">
                            <td colspan="13" style="text-align: right; padding-right: 10px;">GRAND TOTAL</td>
                            <td>${totalClaim.toFixed(2)}</td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>

                <div class="footer">
                    <p style="text-align: center; font-weight: bold; text-decoration: underline;">CERTIFICATE</p>
                    <p>1. I certify that the amount claimed in this bill has not been claimed previously OR drawn from any other source.</p>
                    <p>2. I certify that the road journey on .................... for which mileage allowance has been claimed at the higher rates was performed in my own car Reg. No. ....................</p>
                    <p>3. I certify that I was actually present on the previous day of the practical examination for the preparation work.</p>
                    
                    <div class="signature-row">
                        <div style="width: 30%;">
                            <p>Place: ....................</p>
                            <p>Date: <strong>${new Date().toLocaleDateString('en-GB')}</strong></p>
                        </div>
                        <div class="stamp-box">Revenue<br>Stamp</div>
                        <div style="text-align: center; width: 40%;">
                            <br><br>
                            <p>..........................................................</p>
                            <p><strong>Signature of the Officer who travelled</strong></p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- PAGE 2: INSTRUCTIONS -->
            <div class="page instructions">
                <h2 style="margin-top: 0;">RATES OF T.A. AND D.A. TO EXAMINERS AND UNIVERSITY OFFICERS</h2>
                <p><strong>Note:</strong> i) No T.A./D.A. will be paid if the journey distance is not more than Eight Kilometres unless otherwise specified.</p>
                <p>ii) For calculating T.A./D.A. Head quarters alone will be considered. Vacation address will not be considered.</p>
                <p>iii) The Vice-chancellor may, for special reasons to be recorded, allow a particular examiner mileage allowance at a higher rate than is prescribed in rule 1 below.</p>
                <p>iv) The provisions under these rules are independent of the provisions in Part II, KSR.</p>

                <p><strong>Rule 1. Travelling Allowance for journey by Road/Rail:</strong></p>
                <p>Road Mileage @ Rs. 2.50 per kilometer (special conveyance) OR II A/C Railway fare + incidental expense at the rate of 90 paise per kilometre for Grade I officers.</p>
                
                <table class="grade-table">
                    <thead>
                        <tr>
                            <th>Classification</th>
                            <th>Rate (Ps)</th>
                            <th>Eligible Train Class</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Grade I:</strong> Employees with basic pay of Rs. 50,400/- and above</td>
                            <td>0.80</td>
                            <td>II AC</td>
                        </tr>
                        <tr>
                            <td><strong>Grade II (a):</strong> Employees with basic pay of Rs. 42,500/- to Rs. 50,400/-</td>
                            <td>0.60</td>
                            <td>I Class</td>
                        </tr>
                        <tr>
                            <td><strong>Grade II (b):</strong> Employees with basic pay of Rs. 27,800/- to Rs. 42,500/-</td>
                            <td>0.50</td>
                            <td>III AC</td>
                        </tr>
                        <tr>
                            <td><strong>Grade III:</strong> Employees with basic pay of Rs. 18,000/- to Rs. 27,800/-</td>
                            <td>0.50</td>
                            <td>II Class</td>
                        </tr>
                        <tr>
                            <td><strong>Grade IV:</strong> Employees with basic pay below Rs. 18,000/-</td>
                            <td>0.50</td>
                            <td>II Class</td>
                        </tr>
                    </tbody>
                </table>

                <p><strong>General:</strong> If one travels more than 200 kilometres a day by Road, the rate of mileage allowance for the excess over 200 kilometres will be reduced to 3/4 of the normal rate.</p>

                <p><strong>4. Daily Allowance:</strong></p>
                <ol>
                    <li>Rs. 600/- per day for actual day of University business irrespective of duration of hours of halt. For inter-state travel Rs. 550/- per day (Grade 1).</li>
                    <li>Rs. 550/- per day will be paid as D.A. for duty at Lakshadweep.</li>
                    <li>For Chemistry Practical Examination one D.A. will be paid for the previous day for preparation work provided certificate is furnished.</li>
                    <li>For meetings of Board of Examiners, Question Paper Setters, D.A. for the actual day of University business will be paid in addition to eligible T.A.</li>
                    <li>No T.A./D.A. will be paid to Examiners for Practical/Viva-Voce etc. unless distance travelled exceeds 8 kilometres. If distance is 2-8 km, conveyance allowance @ Rs. 50/- per day will be paid.</li>
                </ol>

                <div style="margin-top: 30px; border: 1px solid #000; padding: 15px;">
                    <p><strong>FOR OFFICE USE ONLY (PAREEKSHA BHAVAN)</strong></p>
                    <p>Memo of Budget Allotment: Rs. ......................... Advance drawn: .........................</p>
                    <p>Expenditure including this bill: Rs. ......................... Balance Claimed: .........................</p>
                    <p>Passed for payment of Rs. ................................. (Rupees ..................................................................................................... only)</p>
                    <div class="signature-row" style="margin-top: 20px;">
                        <p>Section Officer</p>
                        <p>Asst. Registrar</p>
                        <p>Joint Registrar/F.O.</p>
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
