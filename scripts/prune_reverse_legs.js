const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const legsPath = path.join(rootDir, 'legs.json');
const routesDir = path.join(rootDir, 'routes');

const assetsLegsPath = path.join(rootDir, 'app', 'src', 'main', 'assets', 'legs.json');
const assetsRoutesDir = path.join(rootDir, 'app', 'src', 'main', 'assets', 'routes');

console.log('Loading legs.json...');
const db = JSON.parse(fs.readFileSync(legsPath, 'utf8'));

const uniqueLegs = {};
const legReplacementMap = {}; // deletedLid -> keptLid
const seenSegments = {}; // order-independent key -> keptLid

let initialLegCount = Object.keys(db.legs).length;

for (const [lid, arr] of Object.entries(db.legs)) {
    const fromIdx = arr[0];
    const toIdx = arr[1];
    const modeIdx = arr[2];
    const km = arr[3];
    const typeIdx = arr[4];
    const fare = arr[5] !== undefined ? arr[5] : -1;

    // Order-independent key for station indices
    const minSt = Math.min(fromIdx, toIdx);
    const maxSt = Math.max(fromIdx, toIdx);
    const key = `${minSt}|${maxSt}|${modeIdx}|${km.toFixed(2)}|${typeIdx}|${fare}`;

    if (seenSegments[key]) {
        // We have already seen this segment in one direction!
        const keptLid = seenSegments[key];
        legReplacementMap[lid] = keptLid;
    } else {
        // First time seeing this segment. Keep it.
        seenSegments[key] = lid;
        uniqueLegs[lid] = arr;
    }
}

const finalLegCount = Object.keys(uniqueLegs).length;
console.log(`Pruning legs completed:`);
printStats(initialLegCount, finalLegCount);

function printStats(before, after) {
    console.log(`  Legs before: ${before}`);
    console.log(`  Legs after:  ${after}`);
    console.log(`  Removed:     ${before - after} legs (${((before - after) / before * 100).toFixed(1)}% reduction)`);
}

// Update database object
db.legs = uniqueLegs;

// Update routes files
console.log('Updating route JSON files with unique leg IDs...');
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.json'));

for (const file of routeFiles) {
    const filePath = path.join(routesDir, file);
    const routesData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let fileModified = false;

    for (const [rkey, legs] of Object.entries(routesData)) {
        const updatedLegs = legs.map(lid => {
            if (legReplacementMap[lid]) {
                fileModified = true;
                return legReplacementMap[lid];
            }
            return lid;
        });
        routesData[rkey] = updatedLegs;
    }

    if (fileModified) {
        const fileContent = JSON.stringify(routesData);
        // Write to root
        fs.writeFileSync(filePath, fileContent);
        // Write to assets
        fs.writeFileSync(path.join(assetsRoutesDir, file), fileContent);
    }
}

// Write updated legs.json
const legsContent = JSON.stringify(db);
fs.writeFileSync(legsPath, legsContent);
fs.writeFileSync(assetsLegsPath, legsContent);

console.log('Updated database files saved to root and app assets successfully.');
