const fs = require('fs');
const path = require('path');

const legs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'legs.json'), 'utf8'));

const uniqueLegs = new Map();
let duplicateCount = 0;

for (const [id, leg] of Object.entries(legs)) {
    const key = `${leg.From}|${leg.To}|${leg.Mode}|${leg.KM}`;
    if (uniqueLegs.has(key)) {
        duplicateCount++;
    } else {
        uniqueLegs.set(key, id);
    }
}

console.log(`Total legs: ${Object.keys(legs).length}`);
console.log(`Unique legs: ${uniqueLegs.size}`);
console.log(`Duplicate legs: ${duplicateCount}`);
