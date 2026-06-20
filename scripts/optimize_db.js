const fs = require('fs');
const path = require('path');

const abbrevsPath = path.join(__dirname, '..', 'ta_abbrevs.json');
const routesPath = path.join(__dirname, '..', 'routes.json');
const legsPath = path.join(__dirname, '..', 'legs.json');
const outRoutesDir = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'routes');
const outLegsPath = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'legs.json');

// Ensure output directories exist
if (!fs.existsSync(outRoutesDir)) {
    fs.mkdirSync(outRoutesDir, { recursive: true });
} else {
    // Clear old JSON files
    const oldFiles = fs.readdirSync(outRoutesDir);
    for (const file of oldFiles) {
        if (file.endsWith('.json')) {
            fs.unlinkSync(path.join(outRoutesDir, file));
        }
    }
}

console.log('Loading ta_abbrevs.json...');
const abbrevs = JSON.parse(fs.readFileSync(abbrevsPath, 'utf8'));
const activeColleges = new Set(abbrevs.map(a => a.Abbreviation));
console.log(`Active colleges count: ${activeColleges.size}`);

console.log('Loading routes.json...');
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));

console.log('Loading legs.json...');
const legs = JSON.parse(fs.readFileSync(legsPath, 'utf8'));

// Step 1: Filter routes to only keep active college pairs
const activeRoutes = {};
for (const [routeKey, legIds] of Object.entries(routes)) {
    const parts = routeKey.split('_');
    if (parts.length === 2) {
        const [from, to] = parts;
        if (activeColleges.has(from) && activeColleges.has(to)) {
            activeRoutes[routeKey] = legIds;
        }
    }
}
console.log(`Active routes count: ${Object.keys(activeRoutes).length}`);

// Step 2: Deduplicate legs referenced by active routes
const uniqueLegMap = new Map(); // key (content) -> new leg ID
const newLegs = {};
let nextLegId = 1;

// Function to generate a unique key for a leg object to check equality
function getLegKey(leg) {
    return `${leg.From || ''}|${leg.To || ''}|${leg.Mode || ''}|${leg.KM || ''}|${leg.Fare || ''}|${leg.Type || ''}`;
}

const irinjalakudaColleges = {
    "ASM": { name: "MES Asmabi College", km: 22.0 },
    "NAT": { name: "SN College, Nattika", km: 24.0 },
    "CCI": { name: "Christ College (Autonomous), Irinjalakuda", km: 7.0 },
    "SJCD": { name: "ST JOSEPHS COLLEGE (AUTONOMOUS), IRINJALAKUDA", km: 8.0 },
    "SJCI": { name: "ST JOSEPHS COLLEGE (AUTONOMOUS), IRINJALAKUDA", km: 8.0 },
    "ETCI": { name: "EUPHRAISIA TRAINING COLLEGE, IRINJALAKUDA, THRISSUR", km: 8.0 }
};

const trainStationKm = {
    "Palakkad Jn Railway": 95.0,
    "Palakkad Railway Station": 95.0,
    "Parappanangadi Stn": 101.0,
    "Parappanangadi Railway Station": 101.0,
    "Pattambi Railway Stn": 65.0,
    "Ottappalam Railway Stn": 54.0,
    "Kozhikode Railway Station": 133.0,
    "Tirur Railway Station": 92.0,
    "Kuttippuram Railway Station": 77.0,
    "Shoranur Railway Station": 54.0,
    "Guruvayur Railway Stn": 46.0,
    "Vadakara Railway Station": 178.0,
    "Thrissur Railway Stn": 21.0,
    "Thrissur Railway Station": 21.0
};

function applyIrinjalakudaRouting(routeKey, legObjects) {
    const parts = routeKey.split('_');
    if (parts.length !== 2) return legObjects;
    const from = parts[0];
    const to = parts[1];
    let modifiedLegs = [...legObjects];

    if (irinjalakudaColleges[from]) {
        const idx = modifiedLegs.findIndex(l => l.Mode === 'Train');
        if (idx !== -1) {
            const trainLeg = modifiedLegs[idx];
            const otherStation = trainLeg.To;
            if (trainStationKm.hasOwnProperty(otherStation)) {
                modifiedLegs.splice(0, idx + 1, 
                    { From: irinjalakudaColleges[from].name, To: "Irinjalakuda Railway Stn", Mode: "Taxi", KM: irinjalakudaColleges[from].km.toFixed(1), Type: "First_Mile" },
                    { From: "Irinjalakuda Railway Stn", To: otherStation, Mode: "Train", KM: trainStationKm[otherStation].toFixed(1), Fare: 750, Type: "Main_Haul" }
                );
            }
        }
    }

    if (irinjalakudaColleges[to]) {
        const idx = modifiedLegs.map(l => l.Mode).lastIndexOf('Train');
        if (idx !== -1) {
            const trainLeg = modifiedLegs[idx];
            const otherStation = trainLeg.From;
            if (trainStationKm.hasOwnProperty(otherStation)) {
                modifiedLegs.splice(idx, modifiedLegs.length - idx, 
                    { From: otherStation, To: "Irinjalakuda Railway Stn", Mode: "Train", KM: trainStationKm[otherStation].toFixed(1), Fare: 750, Type: "Main_Haul" },
                    { From: "Irinjalakuda Railway Stn", To: irinjalakudaColleges[to].name, Mode: "Taxi", KM: irinjalakudaColleges[to].km.toFixed(1), Type: "Last_Mile" }
                );
            }
        }
    }

    return modifiedLegs;
}

const rewrittenRoutes = {};
for (const [routeKey, legIds] of Object.entries(activeRoutes)) {
    // Resolve all leg objects for this route
    let legObjects = legIds.map(oldId => legs[oldId]).filter(Boolean);
    
    // Apply Irinjalakuda routing override
    legObjects = applyIrinjalakudaRouting(routeKey, legObjects);

    const newLegIds = [];
    for (const leg of legObjects) {
        const legKey = getLegKey(leg);
        let newId;
        if (uniqueLegMap.has(legKey)) {
            newId = uniqueLegMap.get(legKey);
        } else {
            newId = `LEG_${nextLegId++}`;
            uniqueLegMap.set(legKey, newId);
            newLegs[newId] = leg;
        }
        newLegIds.push(newId);
    }
    rewrittenRoutes[routeKey] = newLegIds;
}

console.log(`Deduplicated legs count: ${Object.keys(newLegs).length}`);

// Step 3: Write the deduplicated legs.json
fs.writeFileSync(outLegsPath, JSON.stringify(newLegs));
console.log(`Written legs.json: ${(fs.statSync(outLegsPath).size / 1024 / 1024).toFixed(2)} MB`);

// Step 4: Group routes by source college and write individual files
const routesBySource = {};
for (const [routeKey, legIds] of Object.entries(rewrittenRoutes)) {
    const [from, to] = routeKey.split('_');
    if (!routesBySource[from]) {
        routesBySource[from] = {};
    }
    routesBySource[from][routeKey] = legIds;
}

let totalRoutesSize = 0;
for (const [source, sourceRoutes] of Object.entries(routesBySource)) {
    const fileContent = JSON.stringify(sourceRoutes);
    const filePath = path.join(outRoutesDir, `${source}.json`);
    fs.writeFileSync(filePath, fileContent);
    totalRoutesSize += fileContent.length;
}

console.log(`Written ${Object.keys(routesBySource).length} files to routes/ directory.`);
console.log(`Total routes files size: ${(totalRoutesSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`Average routes file size: ${(totalRoutesSize / Object.keys(routesBySource).length / 1024).toFixed(2)} KB`);
