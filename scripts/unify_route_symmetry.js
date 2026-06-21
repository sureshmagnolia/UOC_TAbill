const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const legsPath = path.join(rootDir, 'legs.json');
const routesDir = path.join(rootDir, 'routes');

const assetsLegsPath = path.join(rootDir, 'app', 'src', 'main', 'assets', 'legs.json');
const assetsRoutesDir = path.join(rootDir, 'app', 'src', 'main', 'assets', 'routes');

console.log('Loading legs.json...');
const db = JSON.parse(fs.readFileSync(legsPath, 'utf8'));

// Build unique lookup map for legs to check if reverse exists
// Key format: "from_idx|to_idx|mode_idx|km|type_idx"
const legLookup = {};
let maxLegNum = 0;
for (const [lid, arr] of Object.entries(db.legs)) {
    const key = `${arr[0]}|${arr[1]}|${arr[2]}|${arr[3].toFixed(2)}|${arr[4]}`;
    legLookup[key] = lid;
    const num = parseInt(lid.split('_')[1], 10);
    if (num > maxLegNum) {
        maxLegNum = num;
    }
}
console.log(`Initial legs count: ${Object.keys(db.legs).length}. Max leg number: ${maxLegNum}`);

// Helper to get or create a reversed leg
let newLegsAdded = 0;
function getReverseLeg(legId) {
    const arr = db.legs[legId];
    const fromIdx = arr[0];
    const toIdx = arr[1];
    const modeIdx = arr[2];
    const km = arr[3];
    const typeIdx = arr[4];
    const fare = arr[5]; // optional

    const revKey = `${toIdx}|${fromIdx}|${modeIdx}|${km.toFixed(2)}|${typeIdx}`;
    if (legLookup[revKey]) {
        return legLookup[revKey];
    }

    // Create new reversed leg
    maxLegNum++;
    const newLid = `LEG_${maxLegNum}`;
    const newArr = [toIdx, fromIdx, modeIdx, km, typeIdx];
    if (fare !== undefined) {
        newArr.push(fare);
    }

    db.legs[newLid] = newArr;
    legLookup[revKey] = newLid;
    newLegsAdded++;
    return newLid;
}

// Load all route files
console.log('Loading all route JSON files...');
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.json'));
const allRoutes = {};
const fileMap = {}; // routeKey -> file name

for (const file of routeFiles) {
    const filePath = path.join(routesDir, file);
    const routesData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const [rkey, legs] of Object.entries(routesData)) {
        allRoutes[rkey] = legs;
        fileMap[rkey] = file;
    }
}
console.log(`Loaded ${Object.keys(allRoutes).length} total route keys from ${routeFiles.length} files.`);

// Identify bidirectional pairs
const pairs = [];
const seen = new Set();
for (const rkey of Object.keys(allRoutes)) {
    if (!rkey.includes('_')) continue;
    const [p1, p2] = rkey.split('_');
    const revKey = `${p2}_${p1}`;
    if (allRoutes[revKey]) {
        const pairId = [rkey, revKey].sort().join('|');
        if (!seen.has(pairId)) {
            pairs.push([rkey, revKey]);
            seen.add(pairId);
        }
    }
}
console.log(`Found ${pairs.length} bidirectional route pairs.`);

// Harmonize each pair
let modifiedRoutesCount = 0;
for (const [k1, k2] of pairs) {
    const legs1 = allRoutes[k1];
    const legs2 = allRoutes[k2];

    // Determine master: the one with more legs (details). If equal, default to alphabetical order of keys.
    let masterKey, slaveKey;
    if (legs1.length > legs2.length) {
        masterKey = k1;
        slaveKey = k2;
    } else if (legs2.length > legs1.length) {
        masterKey = k2;
        slaveKey = k1;
    } else {
        // If lengths are equal, pick alphabetically smaller key as master
        if (k1 < k2) {
            masterKey = k1;
            slaveKey = k2;
        } else {
            masterKey = k2;
            slaveKey = k1;
        }
    }

    const masterLegs = allRoutes[masterKey];
    const expectedSlaveLegs = [];
    for (let i = masterLegs.length - 1; i >= 0; i--) {
        const revLid = getReverseLeg(masterLegs[i]);
        expectedSlaveLegs.push(revLid);
    }

    // Check if slave route needs update
    const currentSlaveLegs = allRoutes[slaveKey];
    let needsUpdate = currentSlaveLegs.length !== expectedSlaveLegs.length;
    if (!needsUpdate) {
        for (let i = 0; i < currentSlaveLegs.length; i++) {
            if (currentSlaveLegs[i] !== expectedSlaveLegs[i]) {
                needsUpdate = true;
                break;
            }
        }
    }

    if (needsUpdate) {
        allRoutes[slaveKey] = expectedSlaveLegs;
        modifiedRoutesCount++;
    }
}

console.log(`Symmetrization complete. Modified ${modifiedRoutesCount} routes.`);
console.log(`Added ${newLegsAdded} new reversed legs to legs.json.`);

// Save legs.json to root and assets
console.log('Writing updated legs.json...');
const legsContent = JSON.stringify(db);
fs.writeFileSync(legsPath, legsContent);
fs.writeFileSync(assetsLegsPath, legsContent);

// Save updated route files
console.log('Writing updated route JSON files to root and assets...');
// Regroup routes by file prefix
const groupedRoutes = {};
for (const [rkey, legs] of Object.entries(allRoutes)) {
    const prefix = rkey.split('_')[0];
    if (!groupedRoutes[prefix]) {
        groupedRoutes[prefix] = {};
    }
    groupedRoutes[prefix][rkey] = legs;
}

// Ensure directories exist
if (!fs.existsSync(assetsRoutesDir)) {
    fs.mkdirSync(assetsRoutesDir, { recursive: true });
}

for (const [prefix, routes] of Object.entries(groupedRoutes)) {
    const fileContent = JSON.stringify(routes);
    
    // Write to root/routes/
    fs.writeFileSync(path.join(routesDir, `${prefix}.json`), fileContent);
    // Write to app/src/main/assets/routes/
    fs.writeFileSync(path.join(assetsRoutesDir, `${prefix}.json`), fileContent);
}

console.log('Successfully wrote legs and route assets to both root and app assets directories.');
