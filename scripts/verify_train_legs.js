const fs = require('fs');
const path = require('path');

const legs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'legs.json'), 'utf8'));
const alaRoutes = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'routes', 'ALA.json'), 'utf8'));

const testPairs = ["ALA_SNGS", "ALA_UOC", "ALA_ASM"];

for (const pair of testPairs) {
    console.log(`\nRoute details for ${pair}:`);
    const legIds = alaRoutes[pair];
    if (!legIds) {
        console.log("  Route not found!");
        continue;
    }
    legIds.forEach(id => {
        const leg = legs[id];
        console.log(`  - ${id}: ${leg.From} -> ${leg.To} (${leg.Mode}, ${leg.KM} km)`);
    });
}
