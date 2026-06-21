const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const legsPath = path.join(rootDir, 'legs.json');
const cmkmRoutePath = path.join(rootDir, 'routes', 'CMKM.json');

const assetsLegsPath = path.join(rootDir, 'app', 'src', 'main', 'assets', 'legs.json');
const assetsCmkmRoutePath = path.join(rootDir, 'app', 'src', 'main', 'assets', 'routes', 'CMKM.json');

console.log('Loading legs.json and CMKM.json...');
const db = JSON.parse(fs.readFileSync(legsPath, 'utf8'));
const cmkmRoutes = JSON.parse(fs.readFileSync(cmkmRoutePath, 'utf8'));

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

// Helper to add a direct bus leg
function addDirectBusLeg(fromIdx, toIdx) {
    maxLegNum++;
    const lid = `LEG_${maxLegNum}`;
    db.legs[lid] = [fromIdx, toIdx, modeBusIdx, 36.0, typeDirectIdx];
    return lid;
}

console.log('Adding direct bus legs...');
const cmkmSngsLeg = addDirectBusLeg(cmkmIdx, sngsIdx);
const cmkmLcoaLeg = addDirectBusLeg(cmkmIdx, lcoaIdx);
const cmkmKnfjLeg = addDirectBusLeg(cmkmIdx, knfjIdx);

console.log('Updating routes...');
cmkmRoutes['CMKM_SNGS'] = [cmkmSngsLeg];
cmkmRoutes['CMKM_LCOA'] = [cmkmLcoaLeg];
cmkmRoutes['CMKM_KNFJ'] = [cmkmKnfjLeg];

// Write updates
fs.writeFileSync(legsPath, JSON.stringify(db));
fs.writeFileSync(assetsLegsPath, JSON.stringify(db));

fs.writeFileSync(cmkmRoutePath, JSON.stringify(cmkmRoutes));
fs.writeFileSync(assetsCmkmRoutePath, JSON.stringify(cmkmRoutes));

console.log('Successfully updated short Tanur-Pattambi routes to direct bus.');
