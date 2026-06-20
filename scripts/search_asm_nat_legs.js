const fs = require('fs');
const path = require('path');

const legs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'legs.json'), 'utf8'));

console.log("Road legs from ASM (MES Asmabi):");
for (const [id, leg] of Object.entries(legs)) {
    if ((leg.From || '').includes('Asmabi') || (leg.To || '').includes('Asmabi')) {
        console.log(`  - ${id}: ${leg.From} -> ${leg.To} (${leg.Mode}, ${leg.KM} km, Type: ${leg.Type})`);
    }
}

console.log("\nRoad legs from NAT (SN College Nattika):");
for (const [id, leg] of Object.entries(legs)) {
    if ((leg.From || '').includes('Nattika') || (leg.To || '').includes('Nattika')) {
        console.log(`  - ${id}: ${leg.From} -> ${leg.To} (${leg.Mode}, ${leg.KM} km, Type: ${leg.Type})`);
    }
}
