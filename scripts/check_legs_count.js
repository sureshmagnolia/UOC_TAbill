const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'routes');

if (!fs.existsSync(routesDir)) {
    console.log('routes/ directory not found in root.');
    process.exit(0);
}

const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.json'));
let found = false;

for (const file of files) {
    const filePath = path.join(routesDir, file);
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        for (const [pair, legs] of Object.entries(data)) {
            if (Array.isArray(legs) && legs.length > 4) {
                console.log(`Branch: app.web | Pair: ${pair} | File: ${file} | Onward Legs Count: ${legs.length} | Total (Onward+Return) Legs: ${legs.length * 2}`);
                found = true;
            }
        }
    } catch (e) {
        console.error(`Error reading ${file}:`, e.message);
    }
}

if (!found) {
    console.log('No college pair has more than 4 onward legs (i.e. more than 8 total legs) on this branch.');
}
