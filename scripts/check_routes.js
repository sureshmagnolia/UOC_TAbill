const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.json'));

console.log(`Checking ${files.length} route files...`);

let count = 0;
for (const file of files) {
    const filePath = path.join(routesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    let data;
    try {
        data = JSON.parse(content);
    } catch (e) {
        console.error(`Failed to parse ${file}:`, e.message);
        continue;
    }

    for (const routeId in data) {
        const steps = data[routeId];
        if (!Array.isArray(steps)) continue;

        let totalKm = steps.reduce((sum, step) => sum + parseFloat(step.KM || 0), 0);
        if (totalKm > 50) {
            const hasRail = steps.some(step => step.Mode === 'Train' || step.Mode === 'Rail');
            if (!hasRail) {
                console.log(`Route ${routeId} in ${file} is ${totalKm} km but has NO Train/Rail step!`);
                count++;
            }
        }
    }
}

console.log(`Total routes > 50km without Train/Rail: ${count}`);
