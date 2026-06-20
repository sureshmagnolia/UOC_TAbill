const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'routes');
const duplicates = ["SNCA", "SNCN", "MACV", "LFCG"];

console.log("Checking route files in routes/ directory:");
for (const dup of duplicates) {
    const fileExists = fs.existsSync(path.join(routesDir, `${dup}.json`));
    console.log(`  - routes/${dup}.json exists: ${fileExists}`);
}

const abbrevs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ta_abbrevs.json'), 'utf8'));
console.log("\nDetails in ta_abbrevs.json:");
for (const dup of duplicates) {
    const found = abbrevs.find(a => a.Abbreviation === dup);
    console.log(`  - ${dup}: ${JSON.stringify(found)}`);
}
