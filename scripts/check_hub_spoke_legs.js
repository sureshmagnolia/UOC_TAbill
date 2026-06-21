const fs = require('fs');
const path = require('path');

const legsPath = path.join(__dirname, '..', 'legs.json');

if (!fs.existsSync(legsPath)) {
    console.log('legs.json not found.');
    process.exit(0);
}

try {
    const data = JSON.parse(fs.readFileSync(legsPath, 'utf8'));
    let found = false;
    for (const [pair, legs] of Object.entries(data)) {
        if (Array.isArray(legs) && legs.length > 4) {
            console.log(`Branch: app.web.hub_spoke | Pair: ${pair} | Onward Legs Count: ${legs.length} | Total (Onward+Return) Legs: ${legs.length * 2}`);
            found = true;
        }
    }
    if (!found) {
        console.log('No college pair has more than 4 onward legs (i.e. more than 8 total legs) on this branch (legs.json).');
    }
} catch (e) {
    console.error('Error parsing legs.json:', e.message);
}
