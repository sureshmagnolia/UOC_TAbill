const fs = require('fs');
const path = require('path');

const legs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'legs.json'), 'utf8'));

const stations = new Set();
for (const leg of Object.values(legs)) {
    if (leg.Mode === 'Train') {
        stations.add(leg.From);
        stations.add(leg.To);
    }
}

console.log("Railway Stations in database:");
for (const station of Array.from(stations).sort()) {
    console.log(`  - ${station}`);
}
