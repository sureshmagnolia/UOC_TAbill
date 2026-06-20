const fs = require('fs');
const path = require('path');

const legs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'legs.json'), 'utf8'));

console.log("Searching legs.json for 'Irinjalakuda':");
const matches = [];
for (const [id, leg] of Object.entries(legs)) {
    const fromMatch = (leg.From || '').toLowerCase().includes('irinjalakuda') || (leg.From || '').toLowerCase().includes('irinlakkuda');
    const toMatch = (leg.To || '').toLowerCase().includes('irinjalakuda') || (leg.To || '').toLowerCase().includes('irinlakkuda');
    if (fromMatch || toMatch) {
        matches.push({ id, leg });
    }
}

console.log(`Found ${matches.length} matching legs:`);
for (const m of matches) {
    console.log(`  - ${m.id}: ${m.leg.From} -> ${m.leg.To} (${m.leg.Mode}, ${m.leg.KM} km)`);
}
