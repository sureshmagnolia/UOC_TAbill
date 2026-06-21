const fs = require('fs');
const path = require('path');
const cp = require('child_process');

console.log("Starting data comparison between app.web and app.web.hub_spoke...");

// Load abbreviations to get all college keys
const abbrevs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ta_abbrevs.json'), 'utf8'));
const colleges = abbrevs.map(a => a.Abbreviation);

// Load legs database from app.web.hub_spoke
const legsJsonStr = cp.execSync('git show origin/app.web.hub_spoke:legs.json', { maxBuffer: 50 * 1024 * 1024 }).toString();
const legsDb = JSON.parse(legsJsonStr);

let totalMismatches = 0;
let totalCheckedPairs = 0;

for (const college of colleges) {
    let webRoutes, hubSpokeRoutes;
    
    // Read route file from app.web
    try {
        const webStr = cp.execSync(`git show origin/app.web:routes/${college}.json`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
        webRoutes = JSON.parse(webStr);
    } catch (e) {
        // Some colleges might not have route files (e.g. if they are not in that branch's dataset)
        continue;
    }

    // Read route file from app.web.hub_spoke
    try {
        const hsStr = cp.execSync(`git show origin/app.web.hub_spoke:routes/${college}.json`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
        hubSpokeRoutes = JSON.parse(hsStr);
    } catch (e) {
        console.log(`[Warning] ${college}.json is missing in app.web.hub_spoke branch.`);
        totalMismatches++;
        continue;
    }

    for (const routeKey of Object.keys(webRoutes)) {
        totalCheckedPairs++;
        const webLegs = webRoutes[routeKey];
        const hsLegIds = hubSpokeRoutes[routeKey];

        if (!hsLegIds) {
            console.log(`[Mismatch] Route ${routeKey} missing in app.web.hub_spoke.`);
            totalMismatches++;
            continue;
        }

        // Resolve hsLegIds
        const resolvedHsLegs = hsLegIds.map(id => {
            const leg = legsDb[id];
            if (!leg) {
                console.log(`[Error] Leg ID ${id} referenced in ${routeKey} (hub_spoke) not found in legs.json`);
                return null;
            }
            return leg;
        });

        if (resolvedHsLegs.includes(null)) {
            totalMismatches++;
            continue;
        }

        // Compare legs count
        if (webLegs.length !== resolvedHsLegs.length) {
            console.log(`[Mismatch] Route ${routeKey} leg count difference: app.web has ${webLegs.length}, resolved has ${resolvedHsLegs.length}`);
            totalMismatches++;
            continue;
        }

        // Compare each leg details
        for (let i = 0; i < webLegs.length; i++) {
            const legA = webLegs[i];
            const legB = resolvedHsLegs[i];

            const match = 
                legA.From === legB.From &&
                legA.To === legB.To &&
                legA.Mode === legB.Mode &&
                Math.abs(parseFloat(legA.KM) - parseFloat(legB.KM)) < 0.1 &&
                (legA.Fare == legB.Fare || (legA.Fare === undefined && legB.Fare === undefined));

            if (!match) {
                console.log(`[Mismatch] Leg ${i} for route ${routeKey} differs:`);
                console.log(`  app.web:`, legA);
                console.log(`  hub_spoke resolved:`, legB);
                totalMismatches++;
                break;
            }
        }
    }
}

console.log("-----------------------------------------");
console.log(`Comparison finished.`);
console.log(`Total checked college-pairs: ${totalCheckedPairs}`);
console.log(`Total mismatched/error routes: ${totalMismatches}`);
if (totalMismatches === 0) {
    console.log("SUCCESS: All resolved routes in app.web.hub_spoke match app.web perfectly!");
}
