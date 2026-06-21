const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const legsPath = path.join(rootDir, 'legs.json');

const assetsLegsPath = path.join(rootDir, 'app', 'src', 'main', 'assets', 'legs.json');
const routesDir = path.join(rootDir, 'routes');
const assetsRoutesDir = path.join(rootDir, 'app', 'src', 'main', 'assets', 'routes');

console.log('Loading legs.json...');
const db = JSON.parse(fs.readFileSync(legsPath, 'utf8'));

const cmkmIdx = db.stations.indexOf("CH MUHAMMED KOYA MEMORIAL GOVT. ARTS & SCIENCE COLLEGE , TANUR");
const sngsIdx = db.stations.indexOf("SREE NEELAKANTA GOVT. SANSKRIT COLLEGE(SNGS), PATTAMBI");
const lcoaIdx = db.stations.indexOf("Le-Ment College of Advanced Studies, Mele Pattambi");
const knfjIdx = db.stations.indexOf("M.E.S ARTS AND SCIENCE COLLEGE, AMAYUR, PATTAMBI");

if (cmkmIdx === -1 || sngsIdx === -1 || lcoaIdx === -1 || knfjIdx === -1) {
    console.error('Error: One or more stations not found!');
    process.exit(1);
}

// Find next leg ID
let maxLegNum = 0;
for (const lid of Object.keys(db.legs)) {
    const num = parseInt(lid.split('_')[1], 10);
    if (num > maxLegNum) {
        maxLegNum = num;
    }
}

const modeBusIdx = db.modes.indexOf("Bus");
const typeDirectIdx = db.types.indexOf("Direct");

// Helper to add onward and return legs
const onwardLegs = {}; // targetAbbr -> legId
const returnLegs = {}; // targetAbbr -> legId

function addBusPair(abbr, targetIdx) {
    // Onward: CMKM -> Target
    maxLegNum++;
    const onLid = `LEG_${maxLegNum}`;
    db.legs[onLid] = [cmkmIdx, targetIdx, modeBusIdx, 36.0, typeDirectIdx];
    onwardLegs[abbr] = onLid;

    // Return: Target -> CMKM
    maxLegNum++;
    const retLid = `LEG_${maxLegNum}`;
    db.legs[retLid] = [targetIdx, cmkmIdx, modeBusIdx, 36.0, typeDirectIdx];
    returnLegs[abbr] = retLid;
}

addBusPair("SNGS", sngsIdx);
addBusPair("LCOA", lcoaIdx);
addBusPair("KNFJ", knfjIdx);

// Save updated legs.json
fs.writeFileSync(legsPath, JSON.stringify(db));
fs.writeFileSync(assetsLegsPath, JSON.stringify(db));

// Helper to update a route file
function updateRoute(file, key, legIds) {
    const filePath = path.join(routesDir, `${file}.json`);
    const assetsFilePath = path.join(assetsRoutesDir, `${file}.json`);
    
    if (fs.existsSync(filePath)) {
        const routes = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        routes[key] = legIds;
        fs.writeFileSync(filePath, JSON.stringify(routes));
        fs.writeFileSync(assetsFilePath, JSON.stringify(routes));
        console.log(`Updated route key ${key} in ${file}.json`);
    }
}

// Update onward routes (in CMKM.json)
updateRoute("CMKM", "CMKM_SNGS", [onwardLegs["SNGS"]]);
updateRoute("CMKM", "CMKM_LCOA", [onwardLegs["LCOA"]]);
updateRoute("CMKM", "CMKM_KNFJ", [onwardLegs["KNFJ"]]);

// Update return routes (in respective college JSONs)
updateRoute("SNGS", "SNGS_CMKM", [returnLegs["SNGS"]]);
updateRoute("LCOA", "LCOA_CMKM", [returnLegs["LCOA"]]);
updateRoute("KNFJ", "KNFJ_CMKM", [returnLegs["KNFJ"]]);

console.log('Successfully completed short Tanur-Pattambi direct bus patch for hub_spoke_optimized.');
