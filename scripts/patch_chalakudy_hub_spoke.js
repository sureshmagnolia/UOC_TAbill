const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const legsPath = path.join(rootDir, 'legs.json');
const routesDir = path.join(rootDir, 'routes');

const assetsLegsPath = path.join(rootDir, 'app', 'src', 'main', 'assets', 'legs.json');
const assetsRoutesDir = path.join(rootDir, 'app', 'src', 'main', 'assets', 'routes');

console.log('Loading legs.json...');
const db = JSON.parse(fs.readFileSync(legsPath, 'utf8'));

// 1. Find indices of Thrissur Railway Station and Chalakudy colleges
const thrissurNames = ["Thrissur Railway Station", "Thrissur Railway Stn"];
const thrissurIndices = thrissurNames.map(name => db.stations.indexOf(name)).filter(idx => idx !== -1);
console.log(`Thrissur Railway Station indices: ${thrissurIndices}`);

const colleges = {
    "QLBF": { name: "NIRMALA COLLEGE OF ARTS AND SCIENCE , KUNNAPPILLY PO, MELOOR, CHALAKUDY, THRISSUR", km: 6.5 },
    "PMGC": { name: "PANAMPILLY MEMORIAL GOVT (P.M.G) COLLEGE, CHALAKUDY", km: 2.0 },
    "SHCF": { name: "SACRED HEART COLLEGE FOR WOMEN, CHALAKUDY", km: 1.5 },
    "UTEC": { name: "UNIVERSITY TEACHER EDUCATION CENTRE CHALAKUDY", km: 1.0 }
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

// Find train legs connecting Thrissur (onward and return)
const thrissurTrainLegsOnward = {}; // other_station_idx -> legId (Thrissur -> Other)
const thrissurTrainLegsReturn = {}; // other_station_idx -> legId (Other -> Thrissur)

for (const [lid, arr] of Object.entries(db.legs)) {
    const fIdx = arr[0];
    const tIdx = arr[1];
    const modeIdx = arr[2];
    if (db.modes[modeIdx] === "Train") {
        if (thrissurIndices.includes(fIdx)) {
            thrissurTrainLegsOnward[tIdx] = lid;
        } else if (thrissurIndices.includes(tIdx)) {
            thrissurTrainLegsReturn[fIdx] = lid;
        }
    }
}
console.log('Thrissur Onward Train Legs found for:', Object.keys(thrissurTrainLegsOnward).map(idx => db.stations[idx]));
console.log('Thrissur Return Train Legs found for:', Object.keys(thrissurTrainLegsReturn).map(idx => db.stations[idx]));

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

// Add new First_Mile legs to/from Chalakudy Railway Station
const modeTaxiIdx = db.modes.indexOf("Taxi");
const typeFirstIdx = db.types.indexOf("First_Mile");
const chalakudyConnectionsOnward = {}; // collegeAbbr -> legId (College -> Chalakudy Rly)
const chalakudyConnectionsReturn = {}; // collegeAbbr -> legId (Chalakudy Rly -> College)

for (const [abbr, info] of Object.entries(colleges)) {
    const cIdx = collegeIndices[abbr];
    
    maxLegNum++;
    const onwardLid = `LEG_${maxLegNum}`;
    db.legs[onwardLid] = [cIdx, chalakudyRlyIdx, modeTaxiIdx, info.km, typeFirstIdx];
    chalakudyConnectionsOnward[abbr] = onwardLid;

    maxLegNum++;
    const returnLid = `LEG_${maxLegNum}`;
    db.legs[returnLid] = [chalakudyRlyIdx, cIdx, modeTaxiIdx, info.km, typeFirstIdx];
    chalakudyConnectionsReturn[abbr] = returnLid;
}

// Add new Train legs from/to Chalakudy Railway Station
const modeTrainIdx = db.modes.indexOf("Train");
const typeMainIdx = db.types.indexOf("Main_Haul");
const chalakudyTrainLegsOnward = {}; // other_station_idx -> legId (Chalakudy Rly -> Other)
const chalakudyTrainLegsReturn = {}; // other_station_idx -> legId (Other -> Chalakudy Rly)

// Onward Train Legs
for (const [otherIdx, oldLid] of Object.entries(thrissurTrainLegsOnward)) {
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
    chalakudyTrainLegsOnward[otherIdx] = newLid;
}

// Return Train Legs
for (const [otherIdx, oldLid] of Object.entries(thrissurTrainLegsReturn)) {
    maxLegNum++;
    const newLid = `LEG_${maxLegNum}`;
    const oldArr = db.legs[oldLid];
    const oldKm = oldArr[3];
    const newKm = oldKm + 30.0;
    
    const newLegArr = [parseInt(otherIdx, 10), chalakudyRlyIdx, modeTrainIdx, newKm, typeMainIdx];
    if (oldArr[5] !== undefined) {
        newLegArr.push(oldArr[5]);
    }
    db.legs[newLid] = newLegArr;
    chalakudyTrainLegsReturn[otherIdx] = newLid;
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
        let isOnward = false;
        
        if (colleges[from]) {
            chalakudyCol = from;
            otherCol = to;
            isOnward = true;
        } else if (colleges[to]) {
            chalakudyCol = to;
            otherCol = from;
            isOnward = false;
        }
        
        if (!chalakudyCol) continue;
        
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
            const otherIdx = db.stations.indexOf(db.stations.find(s => s.includes(otherCol)));
            const destRlyIdx = collegeToRlyStn[otherIdx];
            
            if (destRlyIdx) {
                if (isOnward) {
                    const cConnLeg = chalakudyConnectionsOnward[chalakudyCol];
                    const trainLeg = chalakudyTrainLegsOnward[destRlyIdx];
                    const destConnLeg = rlyToCollegeLeg[otherIdx];
                    
                    if (cConnLeg && trainLeg && destConnLeg) {
                        routesData[rkey] = [cConnLeg, trainLeg, destConnLeg];
                        fileModified = true;
                        totalRoutesModified++;
                    }
                } else {
                    const destConnLeg = collegeToRlyLeg[otherIdx];
                    const trainLeg = chalakudyTrainLegsReturn[destRlyIdx];
                    const cConnLeg = chalakudyConnectionsReturn[chalakudyCol];
                    
                    if (destConnLeg && trainLeg && cConnLeg) {
                        routesData[rkey] = [destConnLeg, trainLeg, cConnLeg];
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
