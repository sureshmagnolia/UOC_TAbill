const fs = require('fs');
const path = require('path');

const legs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'legs.json'), 'utf8'));

function verifyRoute(source, target) {
    const routeFile = path.join(__dirname, '..', 'routes', `${source}.json`);
    const routes = JSON.parse(fs.readFileSync(routeFile, 'utf8'));
    const routeKey = `${source}_${target}`;
    const legIds = routes[routeKey];
    
    console.log(`\nRoute details for ${routeKey}:`);
    if (!legIds) {
        console.log("  Route not found!");
        return;
    }
    legIds.forEach(id => {
        const leg = legs[id];
        console.log(`  - ${id}: ${leg.From} -> ${leg.To} (${leg.Mode}, ${leg.KM} km, Type: ${leg.Type})`);
    });
}

verifyRoute("ASM", "VIC");
verifyRoute("NAT", "VIC");
verifyRoute("CCI", "VIC");
