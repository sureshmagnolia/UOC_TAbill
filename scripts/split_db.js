/**
 * split_db.js
 * Pre-flattens ta_database.json and splits it into per-source-college files.
 *
 * Usage: node scripts/split_db.js
 *
 * Output:
 *   app/src/main/assets/ta_abbrevs.json        (abbreviations, ~60KB)
 *   app/src/main/assets/routes/<PREFIX>.json    (one per source college, ~138KB each)
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'ta_database_patched.json');
const OUT_DIR = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'routes');
const ABBREVS_OUT = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'ta_abbrevs.json');
const WEB_OUT_DIR = path.join(__dirname, '..', 'routes');
const WEB_ABBREVS_OUT = path.join(__dirname, '..', 'ta_abbrevs.json');

console.log('Reading ta_database.json...');
const db = JSON.parse(fs.readFileSync(SRC, 'utf8'));

// 1. Write abbreviations files
fs.writeFileSync(ABBREVS_OUT, JSON.stringify(db.abbreviations));
fs.writeFileSync(WEB_ABBREVS_OUT, JSON.stringify(db.abbreviations));
console.log(`Written: ta_abbrevs.json (${db.abbreviations.length} entries)`);

// 2. Create routes output directories
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
if (!fs.existsSync(WEB_OUT_DIR)) fs.mkdirSync(WEB_OUT_DIR, { recursive: true });

// 3. Group routes by source college prefix and pre-flatten legs
const byPrefix = {};
const routeKeys = Object.keys(db.routes);
console.log(`Processing ${routeKeys.length} routes...`);

routeKeys.forEach(routeId => {
    const prefix = routeId.split('_')[0];
    if (!byPrefix[prefix]) byPrefix[prefix] = {};

    // Pre-flatten: replace leg ID references with actual leg objects
    byPrefix[prefix][routeId] = db.routes[routeId].map(legId => db.legs[legId]);
});

// 4. Write one file per source prefix
const prefixes = Object.keys(byPrefix);
console.log(`Writing ${prefixes.length} route files...`);

let totalBytes = 0;
prefixes.forEach((prefix, i) => {
    const content = JSON.stringify(byPrefix[prefix]);
    
    // Write to assets
    const outPath = path.join(OUT_DIR, `${prefix}.json`);
    fs.writeFileSync(outPath, content);
    
    // Write to web routes
    const webOutPath = path.join(WEB_OUT_DIR, `${prefix}.json`);
    fs.writeFileSync(webOutPath, content);
    
    totalBytes += content.length;
    if ((i + 1) % 50 === 0 || i === prefixes.length - 1) {
        process.stdout.write(`  ${i + 1}/${prefixes.length} files written...\r`);
    }
});

console.log(`\nDone!`);
console.log(`  ${prefixes.length} route files written to assets/routes/`);
console.log(`  Total routes size: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
console.log(`  Average per file:  ${(totalBytes / prefixes.length / 1024).toFixed(1)} KB`);
