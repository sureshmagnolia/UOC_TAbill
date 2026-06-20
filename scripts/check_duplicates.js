const fs = require('fs');
const path = require('path');

const abbrevs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ta_abbrevs.json'), 'utf8'));

// Check duplicate abbreviations
const abbrMap = new Map();
const nameMap = new Map();

for (const entry of abbrevs) {
    const abbr = entry.Abbreviation;
    const name = entry['Full College Name & Location'];
    
    if (abbrMap.has(abbr)) {
        console.log(`Duplicate Abbreviation found: ${abbr}`);
        console.log(`  - ${JSON.stringify(abbrMap.get(abbr))}`);
        console.log(`  - ${JSON.stringify(entry)}`);
    } else {
        abbrMap.set(abbr, entry);
    }
    
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (nameMap.has(normalizedName)) {
        console.log(`Overlapping College Name found: "${name}"`);
        console.log(`  - Abbr: ${nameMap.get(normalizedName)}`);
        console.log(`  - Abbr: ${abbr}`);
    } else {
        nameMap.set(normalizedName, abbr);
    }
}

// Print specific check for the 15 manual colleges
const manualAbbrs = ["VIC", "MCY", "PRK", "PTB", "OTP", "MKD", "CTR", "NEM", "ALA", "SMT", "SKG", "SKC", "LFC", "NAT", "ASM", "UOC"];
console.log("\nChecking specific manual abbreviation presence:");
for (const ma of manualAbbrs) {
    const found = abbrevs.filter(a => a.Abbreviation === ma);
    console.log(`  - ${ma}: found ${found.length} entries. ${JSON.stringify(found)}`);
}
