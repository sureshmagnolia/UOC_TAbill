const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Fetching ta_database.json from Git history...');
const stdout = execSync(
    'git show 7d423bdf2dfba0f3b7c04ed969e608e72de3a1a9^:app/src/main/assets/ta_database.json',
    { maxBuffer: 100 * 1024 * 1024 }
);
const db = JSON.parse(stdout.toString('utf8'));

const testPairs = ["ALA_PTB", "ALA_UOC", "ALA_ASM"];

for (const pair of testPairs) {
    console.log(`\nOriginal database route details for ${pair}:`);
    const legIds = db.routes[pair];
    if (!legIds) {
        console.log("  Route not found!");
        continue;
    }
    legIds.forEach(id => {
        const leg = db.legs[id];
        console.log(`  - ${id}: ${leg.From} -> ${leg.To} (${leg.Mode}, ${leg.KM} km)`);
    });
}
