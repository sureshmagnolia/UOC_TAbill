const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'routes');
const legsPath = path.join(__dirname, '..', 'legs.json');

if (!fs.existsSync(routesDir) || !fs.existsSync(legsPath)) {
    console.log('routes/ or legs.json not found.');
    process.exit(0);
}

const legsDb = JSON.parse(fs.readFileSync(legsPath, 'utf8'));
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.json'));
let duplicatesFound = false;

for (const file of files) {
    const filePath = path.join(routesDir, file);
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        for (const [pair, legIds] of Object.entries(data)) {
            if (!Array.isArray(legIds)) continue;

            const seen = new Set();
            let hasDuplicate = false;
            let duplicateDetails = [];
            let trainLegsCount = 0;
            let firstMileCount = 0;
            let lastMileCount = 0;

            for (const legId of legIds) {
                const leg = legsDb[legId];
                if (!leg) continue;

                if (seen.has(legId)) {
                    hasDuplicate = true;
                    duplicateDetails.push(`Duplicate leg reference: ${legId} (${leg.From} -> ${leg.To})`);
                }
                seen.add(legId);

                if (leg.Mode === 'Train' || leg.Mode === 'Rail') {
                    trainLegsCount++;
                }
                if (leg.Type === 'First_Mile') {
                    firstMileCount++;
                }
                if (leg.Type === 'Last_Mile') {
                    lastMileCount++;
                }
            }

            if (hasDuplicate) {
                console.log(`Pair: ${pair} in File: ${file}`);
                duplicateDetails.forEach(d => console.log(`  - ${d}`));
                duplicatesFound = true;
            }
            if (trainLegsCount > 1) {
                console.log(`Pair: ${pair} in File: ${file} has multiple train legs (${trainLegsCount})`);
                duplicatesFound = true;
            }
            if (firstMileCount > 1) {
                console.log(`Pair: ${pair} in File: ${file} has multiple First_Mile legs (${firstMileCount})`);
                duplicatesFound = true;
            }
            if (lastMileCount > 1) {
                console.log(`Pair: ${pair} in File: ${file} has multiple Last_Mile legs (${lastMileCount})`);
                duplicatesFound = true;
            }
        }
    } catch (e) {
        console.error(`Error reading ${file}:`, e.message);
    }
}

if (!duplicatesFound) {
    console.log('No duplicates or multiple main/first/last legs found on app.web.hub_spoke branch.');
}
