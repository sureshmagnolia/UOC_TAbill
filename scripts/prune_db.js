const fs = require('fs');
const path = require('path');

const abbrevsPath = path.join(__dirname, '..', 'ta_abbrevs.json');
const routesPath = path.join(__dirname, '..', 'routes.json');
const legsPath = path.join(__dirname, '..', 'legs.json');

console.log('Loading ta_abbrevs.json...');
const abbrevs = JSON.parse(fs.readFileSync(abbrevsPath, 'utf8'));
const activeColleges = new Set(abbrevs.map(a => a.Abbreviation));
console.log(`Found ${activeColleges.size} active colleges.`);

console.log('Loading routes.json...');
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
const prunedRoutes = {};
let keptRoutesCount = 0;

for (const key of Object.keys(routes)) {
    const parts = key.split('_');
    if (parts.length === 2) {
        const [from, to] = parts;
        if (activeColleges.has(from) && activeColleges.has(to)) {
            prunedRoutes[key] = routes[key];
            keptRoutesCount++;
        }
    }
}
console.log(`Kept ${keptRoutesCount} / ${Object.keys(routes).length} routes.`);

console.log('Loading legs.json...');
const legs = JSON.parse(fs.readFileSync(legsPath, 'utf8'));
const prunedLegs = {};
const referencedLegs = new Set();

for (const key of Object.keys(prunedRoutes)) {
    const legIds = prunedRoutes[key];
    for (const legId of legIds) {
        referencedLegs.add(legId);
    }
}

for (const legId of referencedLegs) {
    if (legs[legId]) {
        prunedLegs[legId] = legs[legId];
    } else {
        console.warn(`Warning: referenced leg ${legId} not found in legs.json`);
    }
}
console.log(`Kept ${Object.keys(prunedLegs).length} / ${Object.keys(legs).length} legs.`);

const webRoutesOut = path.join(__dirname, '..', 'routes_pruned.json');
const webLegsOut = path.join(__dirname, '..', 'legs_pruned.json');
fs.writeFileSync(webRoutesOut, JSON.stringify(prunedRoutes));
fs.writeFileSync(webLegsOut, JSON.stringify(prunedLegs));

console.log('Pruned files written:');
console.log(`  routes_pruned.json: ${(fs.statSync(webRoutesOut).size / 1024 / 1024).toFixed(2)} MB`);
console.log(`  legs_pruned.json: ${(fs.statSync(webLegsOut).size / 1024 / 1024).toFixed(2)} MB`);
