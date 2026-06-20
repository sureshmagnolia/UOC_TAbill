const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const stdout = execSync(
    'git show 7d423bdf2dfba0f3b7c04ed969e608e72de3a1a9^:app/src/main/assets/ta_database.json',
    { maxBuffer: 100 * 1024 * 1024 }
);
const db = JSON.parse(stdout.toString('utf8'));

const ptbEntry = db.abbreviations.find(a => a.Abbreviation === 'PTB');
const sngsEntry = db.abbreviations.find(a => a.Abbreviation === 'SNGS');

console.log("Original Abbreviations:");
console.log("  PTB:", JSON.stringify(ptbEntry));
console.log("  SNGS:", JSON.stringify(sngsEntry));

console.log("\nOriginal Routes to PTB:");
const ptbRoutes = Object.keys(db.routes).filter(k => k.endsWith('_PTB'));
console.log(`  Found ${ptbRoutes.length} routes ending in _PTB`);

console.log("\nOriginal Routes to SNGS:");
const sngsRoutes = Object.keys(db.routes).filter(k => k.endsWith('_SNGS'));
console.log(`  Found ${sngsRoutes.length} routes ending in _SNGS`);
