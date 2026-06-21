const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const legsPath = path.join(rootDir, 'legs.json');
const routesDir = path.join(rootDir, 'routes');

const assetsLegsPath = path.join(rootDir, 'app', 'src', 'main', 'assets', 'legs.json');
const assetsRoutesDir = path.join(rootDir, 'app', 'src', 'main', 'assets', 'routes');

console.log('Loading legs.json...');
const db = JSON.parse(fs.readFileSync(legsPath, 'utf8'));

console.log('Loading ta_abbrevs.json...');
const abbrevs = JSON.parse(fs.readFileSync(path.join(rootDir, 'ta_abbrevs.json'), 'utf8'));
const abbrMap = {};
for (const item of abbrevs) {
    if (item.Abbreviation) {
        abbrMap[item.Abbreviation] = item['Full College Name & Location'] || item['Full Name & Location'];
    }
}
abbrMap['UOC'] = 'University of Calicut (Thenjipalam)';

// 1. Find indices of Thrissur Railway Station and Chalakudy colleges
const thrissurNames = ["Thrissur Railway Station", "Thrissur Railway Stn"];
const thrissurIndices = thrissurNames.map(name => db.stations.indexOf(name)).filter(idx => idx !== -1);
console.log(`Thrissur Railway Station indices: ${thrissurIndices}`);

const colleges = {
    "QLBF": { name: "NIRMALA COLLEGE OF ARTS AND SCIENCE , KUNNAPPILLY PO, MELOOR, CHALAKUDY, THRISSUR", km: 6.5 },
    "PMGC": { name: "PANAMPILLY MEMORIAL GOVT (P.M.G) COLLEGE, CHALAKUDY", km: 2.0 },
    "SHCF": { name: "SACRED HEART COLLEGE FOR WOMEN, CHALAKUDY", km: 1.5 },
    "UTEC": { name: "UNIVERSITY TEACHER EDUCATION CENTRE CHALAKUDY", km: 1.0 },
    "DIOM": { name: "DIVINE INSTITUTE OF MEDIA SCIENCE(DIMS) CHALAKKUDY", km: 2.0 }
};

const collegeIndices = {};
for (const [abbr, info] of Object.entries(colleges)) {
    const idx = db.stations.indexOf(info.name);
    if (idx === -1) {
        console.error(`Error: College ${abbr} (${info.name}) not found!`);
        process.exit(1);
    }
    collegeIndices[abbr] = idx;
}

// Map each college in the database to its nearest railway station
console.log('Mapping colleges to railway stations...');
const collegeToRly = {}; // college_idx -> rly_station_idx
const rlyToCollegeLeg = {}; // college_idx -> legId (First/Last Mile leg to its rly station)

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
            collegeToRly[tIdx] = fIdx;
            rlyToCollegeLeg[tIdx] = lid;
        } else if (tIsRly && !fIsRly) {
            collegeToRly[fIdx] = tIdx;
            rlyToCollegeLeg[fIdx] = lid;
        }
    }
}

// Find train legs connecting Thrissur to other stations
const thrissurTrainLegs = {}; // other_station_idx -> legId
for (const [lid, arr] of Object.entries(db.legs)) {
    const fIdx = arr[0];
    const tIdx = arr[1];
    const modeIdx = arr[2];
    if (db.modes[modeIdx] === "Train" && (thrissurIndices.includes(fIdx) || thrissurIndices.includes(tIdx))) {
        const otherIdx = thrissurIndices.includes(fIdx) ? tIdx : fIdx;
        thrissurTrainLegs[otherIdx] = lid;
    }
}
console.log('Thrissur Train Legs found for:', Object.keys(thrissurTrainLegs).map(idx => db.stations[idx]));

// 2. Add or find Chalakudy Railway Station
const chalakudyRlyName = "Chalakudy Railway Station";
let chalakudyRlyIdx = db.stations.indexOf(chalakudyRlyName);
if (chalakudyRlyIdx === -1) {
    db.stations.push(chalakudyRlyName);
    chalakudyRlyIdx = db.stations.length - 1;
}

// Next leg ID number
let maxLegNum = 0;
for (const lid of Object.keys(db.legs)) {
    const num = parseInt(lid.split('_')[1], 10);
    if (num > maxLegNum) {
        maxLegNum = num;
    }
}

// Add new First_Mile legs to Chalakudy Railway Station
const modeTaxiIdx = db.modes.indexOf("Taxi");
const typeFirstIdx = db.types.indexOf("First_Mile");
const chalakudyConnections = {}; // collegeAbbr -> legId

for (const [abbr, info] of Object.entries(colleges)) {
    maxLegNum++;
    const newLid = `LEG_${maxLegNum}`;
    const cIdx = collegeIndices[abbr];
    db.legs[newLid] = [cIdx, chalakudyRlyIdx, modeTaxiIdx, info.km, typeFirstIdx];
    chalakudyConnections[abbr] = newLid;
}

// Add new Train legs from Chalakudy Railway Station
const modeTrainIdx = db.modes.indexOf("Train");
const typeMainIdx = db.types.indexOf("Main_Haul");
const chalakudyTrainLegs = {}; // other_station_idx -> legId

for (const [otherIdx, oldLid] of Object.entries(thrissurTrainLegs)) {
    maxLegNum++;
    const newLid = `LEG_${maxLegNum}`;
    const oldArr = db.legs[oldLid];
    const oldKm = oldArr[3];
    const newKm = oldKm + 30.0; // Chalakudy is 30 KM south of Thrissur
    
    const newLegArr = [chalakudyRlyIdx, parseInt(otherIdx, 10), modeTrainIdx, newKm, typeMainIdx];
    if (oldArr[5] !== undefined) {
        newLegArr.push(oldArr[5]);
    }
    db.legs[newLid] = newLegArr;
    chalakudyTrainLegs[otherIdx] = newLid;
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
        
        let chalakudyCol = null;
        let otherCol = null;
        
        if (colleges[from]) {
            chalakudyCol = from;
            otherCol = to;
        } else if (colleges[to]) {
            chalakudyCol = to;
            otherCol = from;
        }
        
        if (!chalakudyCol) continue;
        
        // Calculate current total distance
        let totalKm = 0;
        let hasTrainLeg = false;
        for (const lid of legs) {
            const leg = db.legs[lid];
            if (leg) {
                totalKm += leg[3];
                if (db.modes[leg[2]] === "Train") {
                    hasTrainLeg = true;
                }
            }
        }
        
        // If distance is >= 50 KM, we want it to be a train route!
        if (totalKm >= 50.0) {
            let otherIdx = -1;
            const fullName = abbrMap[otherCol];
            if (fullName) {
                otherIdx = db.stations.indexOf(fullName);
            }
            if (otherIdx === -1) {
                otherIdx = db.stations.indexOf(db.stations.find(s => s.includes(otherCol)));
            }
            
            const destRlyIdx = collegeToRly[otherIdx];
            
            if (destRlyIdx && chalakudyTrainLegs[destRlyIdx]) {
                // Reconstruct route via Train!
                const cConnLeg = chalakudyConnections[chalakudyCol];
                const trainLeg = chalakudyTrainLegs[destRlyIdx];
                const destConnLeg = rlyToCollegeLeg[otherIdx];
                
                if (destConnLeg) {
                    // Check order (onward vs return)
                    let newLegs;
                    if (rkey.startsWith(chalakudyCol)) {
                        newLegs = [cConnLeg, trainLeg, destConnLeg];
                    } else {
                        newLegs = [destConnLeg, trainLeg, cConnLeg];
                    }
                    
                    routesData[rkey] = newLegs;
                    fileModified = true;
                    totalRoutesModified++;
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
