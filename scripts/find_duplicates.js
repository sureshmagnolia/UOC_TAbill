const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'routes');

if (!fs.existsSync(routesDir)) {
    console.log('routes/ directory not found in root.');
    process.exit(0);
}

const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.json'));
let duplicatesFound = false;

for (const file of files) {
    const filePath = path.join(routesDir, file);
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        for (const [pair, legs] of Object.entries(data)) {
            if (!Array.isArray(legs)) continue;

            let trainLegsCount = 0;
            let firstMileCount = 0;
            let lastMileCount = 0;
            const issues = [];

            for (const leg of legs) {
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

            if (trainLegsCount > 1) {
                issues.push(`Multiple train legs found (${trainLegsCount} train legs)`);
            }
            if (firstMileCount > 1) {
                issues.push(`Multiple First_Mile legs found (${firstMileCount} first mile legs)`);
            }
            if (lastMileCount > 1) {
                issues.push(`Multiple Last_Mile legs found (${lastMileCount} last mile legs)`);
            }

            if (issues.length > 0) {
                console.log(`Pair: ${pair} in File: ${file}`);
                issues.forEach(issue => console.log(`  - ${issue}`));
                duplicatesFound = true;
            }
        }
    } catch (e) {
        console.error(`Error reading ${file}:`, e.message);
    }
}

if (!duplicatesFound) {
    console.log('No other college pairs have duplicate/multiple train, first-mile, or last-mile legs.');
}
