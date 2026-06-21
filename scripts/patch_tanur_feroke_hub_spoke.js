const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const legsPath = path.join(rootDir, 'legs.json');
const routesDir = path.join(rootDir, 'routes');

const assetsLegsPath = path.join(rootDir, 'app', 'src', 'main', 'assets', 'legs.json');
const assetsRoutesDir = path.join(rootDir, 'app', 'src', 'main', 'assets', 'routes');

console.log('Loading legs.json and abbreviations...');
const db = JSON.parse(fs.readFileSync(legsPath, 'utf8'));
const abbrevs = JSON.parse(fs.readFileSync(path.join(rootDir, 'ta_abbrevs.json'), 'utf8'));

function getFullCollegeName(abbr) {
    const match = abbrevs.find(c => c.Abbreviation === abbr);
    return match ? match['Full College Name & Location'] : abbr;
}

// 1. Find indices of Parappanangadi Railway Station and target colleges
const pgiNames = ["Parappanangadi Railway Station", "Parappanangadi Stn"];
const pgiIndices = pgiNames.map(name => db.stations.indexOf(name)).filter(idx => idx !== -1);
console.log(`Parappanangadi Railway Station indices: ${pgiIndices}`);

const tanurColleges = {
    "CMKM": { name: "CH MUHAMMED KOYA MEMORIAL GOVT. ARTS & SCIENCE COLLEGE , TANUR", km: 4.0 }
};

const ferokeColleges = {
    "ACOE": { name: "AWH COLLEGE OF EDUCATION (UNAIDED),FAROOK (P.O),KOZHIKODE", km: 3.5 },
    "FCK": { name: "FAROOK COLLEGE (AUTONOMOUS), KOZHIKODE", km: 3.5 },
    "FIOM": { name: "FAROOK INSTITUTE OF MANAGEMENT, FAROOK COLLEGE", km: 3.5 },
    "FTCF": { name: "FAROOK TRAINING COLLEGE, FAROOK COLLEGE,KOZHIKODE", km: 3.5 },
    "RUAC": { name: "ROUZATHUL ULOOM ARABIC COLLEGE, FAROOK COLLEGE, PO, KOZHIKODE - 673 632", km: 3.5 },
    "WHEU": { name: "ROUZATHUL ULOOM ARABIC COLLEGE, PO FAROOK COLLEGE, KOZHIKODE", km: 3.5 }
};

const allColleges = { ...tanurColleges, ...ferokeColleges };
const collegeIndices = {};
for (const [abbr, info] of Object.entries(allColleges)) {
    const idx = db.stations.indexOf(info.name);
    if (idx === -1) {
        console.error(`Error: College ${abbr} (${info.name}) not found!`);
        process.exit(1);
    }
    collegeIndices[abbr] = idx;
}

// Map each college in the database to its nearest railway station legs
console.log('Mapping colleges to railway stations...');
const rlyToCollegeLeg = {}; // college_idx -> legId (Railway -> College)
const collegeToRlyLeg = {}; // college_idx -> legId (College -> Railway)
const collegeToRlyStn = {}; // college_idx -> rly_station_idx

for (const [lid, arr] of Object.entries(db.legs)) {
    const fIdx = arr[0];
    const tIdx = arr[1];
    const ltype = db.types[arr[4]];
    
    if (ltype === "First_Mile" || ltype === "Last_Mile") {
        const fName = db.stations[fIdx];
        const tName = db.stations[tIdx];
        
        const fIsRly = (fName.toLowerCase().includes("railway") || fName.toLowerCase().includes("rly") || fName.toLowerCase().includes("stn") || fName.toLowerCase().includes("station")) && !fName.toLowerCase().includes("college");
        const tIsRly = (tName.toLowerCase().includes("railway") || tName.toLowerCase().includes("rly") || tName.toLowerCase().includes("stn") || tName.toLowerCase().includes("station")) && !tName.toLowerCase().includes("college");
        
        if (fIsRly && !tIsRly) {
            rlyToCollegeLeg[tIdx] = lid;
            collegeToRlyStn[tIdx] = fIdx;
        } else if (tIsRly && !fIsRly) {
            collegeToRlyLeg[fIdx] = lid;
            collegeToRlyStn[fIdx] = tIdx;
        }
    }
}

// Find train legs connecting Parappanangadi (onward and return)
const pgiTrainLegsOnward = {}; // other_station_idx -> legId (Parappanangadi -> Other)
const pgiTrainLegsReturn = {}; // other_station_idx -> legId (Other -> Parappanangadi)

for (const [lid, arr] of Object.entries(db.legs)) {
    const fIdx = arr[0];
    const tIdx = arr[1];
    const modeIdx = arr[2];
    if (db.modes[modeIdx] === "Train") {
        if (pgiIndices.includes(fIdx)) {
            pgiTrainLegsOnward[tIdx] = lid;
        } else if (pgiIndices.includes(tIdx)) {
            pgiTrainLegsReturn[fIdx] = lid;
        }
    }
}

// 2. Add Tanur and Feroke Railway Stations
const tanurRlyName = "Tanur Railway Station";
let tanurRlyIdx = db.stations.indexOf(tanurRlyName);
if (tanurRlyIdx === -1) {
    db.stations.push(tanurRlyName);
    tanurRlyIdx = db.stations.length - 1;
}

const ferokeRlyName = "Feroke Railway Station";
let ferokeRlyIdx = db.stations.indexOf(ferokeRlyName);
if (ferokeRlyIdx === -1) {
    db.stations.push(ferokeRlyName);
    ferokeRlyIdx = db.stations.length - 1;
}

// Next leg ID number
let maxLegNum = 0;
for (const lid of Object.keys(db.legs)) {
    const num = parseInt(lid.split('_')[1], 10);
    if (num > maxLegNum) {
        maxLegNum = num;
    }
}

// Add First_Mile connection legs
const modeTaxiIdx = db.modes.indexOf("Taxi");
const typeFirstIdx = db.types.indexOf("First_Mile");

const collegeConnectionsOnward = {}; // collegeAbbr -> legId (College -> Railway)
const collegeConnectionsReturn = {}; // collegeAbbr -> legId (Railway -> College)

// Helper to add taxi legs
function addTaxiLegs(abbr, rlyIdx, km) {
    const cIdx = collegeIndices[abbr];
    
    maxLegNum++;
    const onwardLid = `LEG_${maxLegNum}`;
    db.legs[onwardLid] = [cIdx, rlyIdx, modeTaxiIdx, km, typeFirstIdx];
    collegeConnectionsOnward[abbr] = onwardLid;

    maxLegNum++;
    const returnLid = `LEG_${maxLegNum}`;
    db.legs[returnLid] = [rlyIdx, cIdx, modeTaxiIdx, km, typeFirstIdx];
    collegeConnectionsReturn[abbr] = returnLid;
}

for (const [abbr, info] of Object.entries(tanurColleges)) {
    addTaxiLegs(abbr, tanurRlyIdx, info.km);
}
for (const [abbr, info] of Object.entries(ferokeColleges)) {
    addTaxiLegs(abbr, ferokeRlyIdx, info.km);
}

// Add train legs using offsets from Parappanangadi
const modeTrainIdx = db.modes.indexOf("Train");
const typeMainIdx = db.types.indexOf("Main_Haul");

const tanurTrainLegsOnward = {}; // other_station_idx -> legId
const tanurTrainLegsReturn = {}; // other_station_idx -> legId
const ferokeTrainLegsOnward = {}; // other_station_idx -> legId
const ferokeTrainLegsReturn = {}; // other_station_idx -> legId

// Helper to determine train offsets
// Tanur is 8 KM South of Parappanangadi. Feroke is 14 KM North of Parappanangadi.
// We check the other station's position relative to Parappanangadi.
function getOffsets(otherIdx) {
    const otherName = db.stations[otherIdx].toLowerCase();
    
    // Stations North of Parappanangadi
    const isNorth = otherName.includes("kozhikode") || otherName.includes("vadakara");
    
    const tanurOffset = isNorth ? 8.0 : -8.0;
    const ferokeOffset = isNorth ? -14.0 : 14.0;
    
    return { tanurOffset, ferokeOffset };
}

// Create Train legs
for (const [otherIdx, oldLid] of Object.entries(pgiTrainLegsOnward)) {
    const oldArr = db.legs[oldLid];
    const oldKm = oldArr[3];
    const { tanurOffset, ferokeOffset } = getOffsets(otherIdx);

    // Tanur Onward
    maxLegNum++;
    const tOnLid = `LEG_${maxLegNum}`;
    db.legs[tOnLid] = [tanurRlyIdx, parseInt(otherIdx, 10), modeTrainIdx, Math.abs(oldKm + tanurOffset), typeMainIdx];
    tanurTrainLegsOnward[otherIdx] = tOnLid;

    // Feroke Onward
    maxLegNum++;
    const fOnLid = `LEG_${maxLegNum}`;
    db.legs[fOnLid] = [ferokeRlyIdx, parseInt(otherIdx, 10), modeTrainIdx, Math.abs(oldKm + ferokeOffset), typeMainIdx];
    ferokeTrainLegsOnward[otherIdx] = fOnLid;
}

for (const [otherIdx, oldLid] of Object.entries(pgiTrainLegsReturn)) {
    const oldArr = db.legs[oldLid];
    const oldKm = oldArr[3];
    const { tanurOffset, ferokeOffset } = getOffsets(otherIdx);

    // Tanur Return
    maxLegNum++;
    const tRetLid = `LEG_${maxLegNum}`;
    db.legs[tRetLid] = [parseInt(otherIdx, 10), tanurRlyIdx, modeTrainIdx, Math.abs(oldKm + tanurOffset), typeMainIdx];
    tanurTrainLegsReturn[otherIdx] = tRetLid;

    // Feroke Return
    maxLegNum++;
    const fRetLid = `LEG_${maxLegNum}`;
    db.legs[fRetLid] = [parseInt(otherIdx, 10), ferokeRlyIdx, modeTrainIdx, Math.abs(oldKm + ferokeOffset), typeMainIdx];
    ferokeTrainLegsReturn[otherIdx] = fRetLid;
}

// 3. Update route files
console.log('Patching route JSON files...');
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.json'));

let totalRoutesModified = 0;
for (const file of routeFiles) {
    const filePath = path.join(routesDir, file);
    const routesData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let fileModified = false;

    for (const [rkey, legs] of Object.entries(routesData)) {
        const parts = rkey.split('_');
        if (parts.length !== 2) continue;
        const [from, to] = parts;
        
        let targetCol = null;
        let otherCol = null;
        let isOnward = false;
        let isTanur = false;
        
        if (allColleges[from]) {
            targetCol = from;
            otherCol = to;
            isOnward = true;
            isTanur = !!tanurColleges[from];
        } else if (allColleges[to]) {
            targetCol = to;
            otherCol = from;
            isOnward = false;
            isTanur = !!tanurColleges[to];
        }
        
        if (!targetCol) continue;
        
        // Calculate current total distance
        let totalKm = 0;
        for (const lid of legs) {
            const leg = db.legs[lid];
            if (leg) {
                totalKm += leg[3];
            }
        }
        
        // If distance is >= 50 KM, we want it to be a train route!
        if (totalKm >= 50.0) {
            const otherFull = getFullCollegeName(otherCol);
            const otherIdx = db.stations.indexOf(otherFull);
            const destRlyIdx = collegeToRlyStn[otherIdx];
            
            if (destRlyIdx) {
                const connOn = collegeConnectionsOnward[targetCol];
                const connRet = collegeConnectionsReturn[targetCol];
                const trainOn = isTanur ? tanurTrainLegsOnward[destRlyIdx] : ferokeTrainLegsOnward[destRlyIdx];
                const trainRet = isTanur ? tanurTrainLegsReturn[destRlyIdx] : ferokeTrainLegsReturn[destRlyIdx];
                const destConnOn = rlyToCollegeLeg[otherIdx];
                const destConnRet = collegeToRlyLeg[otherIdx];
                
                if (isOnward) {
                    if (connOn && trainOn && destConnOn) {
                        routesData[rkey] = [connOn, trainOn, destConnOn];
                        fileModified = true;
                        totalRoutesModified++;
                    }
                } else {
                    if (destConnRet && trainRet && connRet) {
                        routesData[rkey] = [destConnRet, trainRet, connRet];
                        fileModified = true;
                        totalRoutesModified++;
                    }
                }
            }
        }
    }

    if (fileModified) {
        const fileContent = JSON.stringify(routesData);
        fs.writeFileSync(filePath, fileContent);
        fs.writeFileSync(path.join(assetsRoutesDir, file), fileContent);
    }
}

console.log(`Successfully patched ${totalRoutesModified} routes for >= 50KM train connectivity.`);

// 4. Save legs.json
const legsContent = JSON.stringify(db);
fs.writeFileSync(legsPath, legsContent);
fs.writeFileSync(assetsLegsPath, legsContent);
console.log('Saved updated legs.json to root and assets.');
