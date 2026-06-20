const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'routes');
const duplicates = ["SNCA", "SNCN", "MACV", "LFCG"];
const files = fs.readdirSync(routesDir);

const references = {};
for (const dup of duplicates) {
    references[dup] = [];
}

for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(routesDir, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    for (const key of Object.keys(content)) {
        const parts = key.split('_');
        if (parts.length === 2) {
            const [from, to] = parts;
            if (duplicates.includes(from) || duplicates.includes(to)) {
                const matchedDup = duplicates.find(d => d === from || d === to);
                references[matchedDup].push({ file, key });
            }
        }
    }
}

for (const dup of duplicates) {
    console.log(`\nReferences to duplicate "${dup}": ${references[dup].length}`);
    if (references[dup].length > 0) {
        console.log(`  First 10 references:`);
        references[dup].slice(0, 10).forEach(ref => {
            console.log(`    - File: ${ref.file}, Key: ${ref.key}`);
        });
    }
}
