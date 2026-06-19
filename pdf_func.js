function cleanAddressString(addr) {
    if (!addr) return "";
    let lines = addr.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    let joined = lines.map((line, index) => {
        if (index === lines.length - 1) return line;
        if (/[,\.\-\/;]$/.test(line)) {
            return line;
        }
        return line + ',';
    }).join(' ');
    joined = joined.replace(/\s+/g, ' ');
    joined = joined.replace(/\s*,\s*,+/g, ',');
    joined = joined.replace(/\s*,\s*/g, ', ');
    return joined.trim().replace(/,$/, '').trim();
}

function getTruncatedCollegeNamePDF(collegeName, doc, maxWidth) {
    if (!collegeName) return "";
    let fullText = `3) College: ${collegeName}`;
    if (doc.getTextWidth(fullText) <= maxWidth) {
        return fullText;
    }
    let place = "";
    let namePart = collegeName;
    if (collegeName.includes(',')) {
        let parts = collegeName.split(',');
        place = parts.pop().trim();
        namePart = parts.join(',').trim();
    } else {
        let parts = collegeName.split(/\s+/);
        if (parts.length > 1) {
            place = parts.pop().trim();
            namePart = parts.join(' ').trim();
        }
    }
    let suffix = place ? `, ${place}` : "";
    let basePrefix = "3) College: ";
    let low = 0;
    let high = namePart.length;
    let bestTruncated = "";
    while (low <= high) {
        let mid = Math.floor((low + high) / 2);
        let testName = namePart.substring(0, mid);
        let testString = `${basePrefix}${testName}...${suffix}`;
        if (doc.getTextWidth(testString) <= maxWidth) {
            bestTruncated = testName;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return `${basePrefix}${bestTruncated}...${suffix}`;
}

function getTruncatedCollegeNameHTML(collegeName, maxLength = 50) {
    if (!collegeName || collegeName.length <= maxLength) return collegeName;
    let place = "";
    let namePart = collegeName;
    if (collegeName.includes(',')) {
        let parts = collegeName.split(',');
        place = parts.pop().trim();
        namePart = parts.join(',').trim();
    } else {
        let parts = collegeName.split(/\s+/);
        if (parts.length > 1) {
            place = parts.pop().trim();
            namePart = parts.join(' ').trim();
        }
    }
    let suffix = place ? `, ${place}` : "";
    let maxNameLen = maxLength - suffix.length - 3;
    if (maxNameLen < 5) maxNameLen = 5;
    return `${namePart.substring(0, maxNameLen)}...${suffix}`;
}

function truncateStation(name, maxLen) {
    if (!name) return "";
    maxLen = maxLen || 30;
    if (name.length <= maxLen) return name;
    // Keep first 2 words and last word (which is usually the place)
    const words = name.split(/\s+/);
    if (words.length <= 3) return name.substring(0, maxLen - 3) + '...';
    const lastWord = words[words.length - 1];
    const firstTwo = words.slice(0, 2).join(' ');
    const candidate = `${firstTwo}... ${lastWord}`;
    if (candidate.length <= maxLen) return candidate;
    // If even that's too long, just truncate lastWord
    return `${firstTwo}...`;
}

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
    
    let truncatedCollege = getTruncatedCollegeNamePDF(getFullCollegeName(getVal('prof-college')), doc, 290);
    doc.text(truncatedCollege, 40, 120);
    
    doc.text(`7) Bank & IFSC: ${getVal('prof-bank-ifsc')}`, 350, 120);
    
    let cleanAddress = cleanAddressString(getVal('prof-address'));
    let addressLabel = `4) Address: ${cleanAddress}`;
    let addressLines = doc.splitTextToSize(addressLabel, 515);
    doc.text(addressLines, 40, 135);

    const tableData = [];
    let totalClaim = 0;
    
    let limBuf = null;
    const flushLim = (isFirst) => {
        if (!limBuf) return;
        totalClaim += limBuf.da;
        let days = (limBuf.da > 0 && limBuf.da % 600 === 0) ? limBuf.da / 600 : (limBuf.da > 0 && limBuf.da % 400 === 0 ? limBuf.da / 400 : 1);
        let rate = limBuf.da > 0 ? limBuf.da / days : 0;
        let daStr = limBuf.da > 0 ? `\n${rate} X ${days} Days = ${limBuf.da}` : "";
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
            const daStr = da > 0 ? `\n${rate} X ${days} Days = ${da}` : "";
            tableData.push(["", { content: `DA${daStr}`, colSpan: 10, styles: { halign: 'left', fontStyle: 'bold' } }, days, da.toFixed(2), da.toFixed(2), isFirst?getVal('bill-purpose'):""]);
            return;
        }
        const dateRaw = row.querySelector('input[type="date"]').value;
        const date = formatDate(dateRaw);
        const fTime = row.querySelector('input[placeholder="FT"]').value || "";
        const tTime = row.querySelector('input[placeholder="TT"]').value || "";
        const dateTime = `${date}\n${fTime}-${tTime}`;

        const from = truncateStation(row.querySelector('input[placeholder="From"]').value, 28);
        const to = truncateStation(row.querySelector('input[placeholder="To"]').value, 28);
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

    doc.autoTable({
        startY: Math.max(135 + (addressLines.length * 11) + 5, 150),
        head: [
            [{ content: 'Date & Time', rowSpan: 2 }, { content: 'Place', colSpan: 2 }, { content: 'Mode', rowSpan: 2 }, { content: 'Dist', colSpan: 2 }, { content: 'Rail (2nd AC)', colSpan: 3 }, { content: 'Road', colSpan: 2 }, { content: 'DA', colSpan: 2 }, { content: 'Total', rowSpan: 2 }, { content: 'Purpose', rowSpan: 2 }],
            ['From', 'To', 'Rail', 'Road', 'Fare', 'Rate', 'Amt', 'Rate', 'Amt', 'Days', 'Amt'],
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15']
        ],
        body: tableData,
        theme: 'grid', styles: { fontSize: 6.5, cellPadding: 1, textColor: 0, lineColor: 0, lineWidth: 0.5 }, headStyles: { fillColor: false, halign: 'center', fontStyle: 'bold' },
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

    let finalY = doc.lastAutoTable.finalY + 15;
    
    // Add page if there's no room for the complex certificate section
    if (finalY + 380 > doc.internal.pageSize.getHeight()) {
        doc.addPage();
        finalY = 40;
    }

    doc.setFontSize(9);
    doc.text(`Grand Total: Rs. ${totalClaim.toFixed(2)}`, pageWidth - 40, finalY, { align: "right" });
    doc.text(`Total Amount in Words: ${numberToWords(totalClaim)} Only`, 40, finalY);

    finalY += 20;
    doc.setFontSize(10);
    doc.text("CERTIFICATE", pageWidth / 2, finalY, { align: "center" });
    finalY += 10;

    doc.autoTable({
        startY: finalY,
        body: [
            ['General*', '1)', 'I Certify that the amount claimed in this bill or any part thereof has not been claimed previously OR drawn from any other source.'],
            ['', '2)', 'I Certify that the road journey on .............................. for which mileage expense has been claimed at the higher rates was performed in my own car Reg. No. ..............................'],
            ['', '3)', 'I Certify that i was actually present on the previous day of the practical examination for the preparation work\n*Necessary certificate should be attested with dated signature']
        ],
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 15 } }
    });
    finalY = doc.lastAutoTable.finalY + 20;

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
        placeText = collegeName.split(',')[1].trim();
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
    finalY += 15;
    doc.text(`Date: ${returnDate}`, 40, finalY);
    
    finalY += 15;
    doc.line(40, finalY, pageWidth - 40, finalY);
    finalY += 15;

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
        styles: { fontSize: 8, cellPadding: 5, valign: 'top' }
    });
    finalY = doc.lastAutoTable.finalY + 15;

    doc.text("Countersigned and certified that the days for which halting allowance is claimed were necessarily", pageWidth / 2, finalY, { align: "center" });
    finalY += 12;
    doc.text("spent for conduct of university business. The Claim may be admitted", pageWidth / 2, finalY, { align: "center" });
    
    finalY += 30;
    doc.text("Signature...........................................................", 40, finalY);
    doc.text("Chairman/Board of Examiners/Question Paper Setters in ......................", pageWidth - 40, finalY, { align: "right" });
    
    finalY += 25;
    doc.text("Asst.", 100, finalY);
    doc.text("S.O.", pageWidth / 2, finalY, { align: "center" });
    doc.text("A.R./D.R.", pageWidth - 100, finalY, { align: "right" });

    finalY += 15;

    doc.autoTable({
        startY: finalY,
        body: [
            [
                'Pre-Audit By Finance Branch\n\nRs...................................................................................\n\n(Rupees. ..............................................................................\n\n.................................................................................Only)\n\nfound admissible and passed for payment.\n\n\n\nAsst.                   S. O.                   A.R/D.R/J.R./FO',
                'Payement by Pareeksha Bhavan\n\nThe Amount paid by Cheque\n\nNo...................................................................................\n\nDate.................................................................................\n\n\n\n\nAsst.                   S. O.                   A.R/D.R/J.R./FO'
            ]
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 8, valign: 'top', textColor: 0, lineColor: 0, lineWidth: 0.5 },
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
            ['Road Mileage @ Rs.2 per kilometer (special conveyance) OR II A/C Railway fare + incidental expense at the rate of 80 paise per kilometre for Grade I officers']
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
        placeText = collegeName.split(',')[1].trim();
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
        let daStr = limBufHtml.da > 0 ? `<br><span class="font-normal" style="font-size:9px">${rate} X ${days} Days = ${limBufHtml.da}</span>` : "";
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
            const daStr = da > 0 ? `<br><span class="font-normal" style="font-size:9px">${rate} X ${days} Days = ${da}</span>` : "";
            htmlRows.push(`<tr><td></td><td colspan="10" class="text-left font-bold" style="padding-left:5px;">DA${daStr}</td><td class="text-center">${days}</td><td class="text-right">${da.toFixed(2)}</td><td class="text-right font-bold">${da.toFixed(2)}</td>${isFirst?`<td rowspan="@@ROWSPAN@@" style="position:relative;padding:0;"><div id="html-purpose-container" style="position:absolute;top:2px;bottom:2px;left:2px;right:2px;overflow:hidden;display:flex;align-items:center;justify-content:center;"><div id="html-purpose-text" style="font-size:10px;writing-mode:vertical-rl;transform:rotate(180deg);text-align:center;max-height:100%;word-wrap:break-word;">${getVal('bill-purpose')}</div></div></td>`:""}</tr>`);
            return;
        }
        const dateRaw = row.querySelector('input[type="date"]').value;
        const date = fixDate(dateRaw);
        const fTime = row.querySelector('input[placeholder="FT"]').value || "";
        const tTime = row.querySelector('input[placeholder="TT"]').value || "";
        const dateTime = (fTime || tTime) ? `${date}<br><span style="font-size:8px">${fTime} - ${tTime}</span>` : date;
        const from = truncateStation(row.querySelector('input[placeholder="From"]').value, 30);
        const to = truncateStation(row.querySelector('input[placeholder="To"]').value, 30);
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
                <td>3) Name of the College: ${getTruncatedCollegeNameHTML(getFullCollegeName(getVal('prof-college')), 50)}</td>
                <td>7) Name of the Bank with IFSC code: ${getVal('prof-bank-ifsc')}</td>
            </tr>
            <tr>
                <td>4) Permanent Address: ${cleanAddressString(getVal('prof-address'))}</td>
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
            <div style="margin-left: 20px;">Road Mileage @ Rs.2 per kilometer (special conveyance) OR II A/C Railway fare + incidental expense at the rate of 80 paise per kilometre for Grade I officers</div>
            
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