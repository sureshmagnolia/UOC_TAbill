const fs = require('fs');
const path = require('path');

const routesDirs = [
    path.join(__dirname, '..', 'routes'),
    path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'routes')
];

const irinjalakudaColleges = {
    "ASM": { name: "MES Asmabi College", km: 22.0 },
    "NAT": { name: "SN College, Nattika", km: 24.0 },
    "CCI": { name: "Christ College (Autonomous), Irinjalakuda", km: 7.0 },
    "SJCI": { name: "ST JOSEPHS COLLEGE (AUTONOMOUS), IRINJALAKUDA", km: 8.0 },
    "ETCI": { name: "EUPHRAISIA TRAINING COLLEGE, IRINJALAKUDA, THRISSUR", km: 8.0 }
};

const trainStationKm = {
    "Palakkad Jn Railway": 95.0,
    "Palakkad Railway Station": 95.0,
    "Parappanangadi Stn": 101.0,
    "Parappanangadi Railway Station": 101.0,
    "Pattambi Railway Stn": 65.0,
    "Ottappalam Railway Stn": 54.0,
    "Kozhikode Railway Station": 133.0,
    "Tirur Railway Station": 92.0,
    "Kuttippuram Railway Station": 77.0,
    "Shoranur Railway Station": 54.0,
    "Guruvayur Railway Stn": 46.0,
    "Vadakara Railway Station": 178.0,
    "Thrissur Railway Stn": 21.0,
    "Thrissur Railway Station": 21.0
};

function applyIrinjalakudaRouting(routeKey, legObjects) {
    const parts = routeKey.split('_');
    if (parts.length !== 2) return legObjects;
    const from = parts[0];
    const to = parts[1];
    let modifiedLegs = [...legObjects];

    if (irinjalakudaColleges[from]) {
        const idx = modifiedLegs.findIndex(l => l.Mode === 'Train');
        if (idx !== -1) {
            const trainLeg = modifiedLegs[idx];
            const otherStation = trainLeg.To;
            if (trainStationKm.hasOwnProperty(otherStation)) {
                modifiedLegs.splice(0, idx + 1, 
                    { From: irinjalakudaColleges[from].name, To: "Irinjalakuda Railway Stn", Mode: "Taxi", KM: irinjalakudaColleges[from].km.toFixed(1), Type: "First_Mile" },
                    { From: "Irinjalakuda Railway Stn", To: otherStation, Mode: "Train", KM: trainStationKm[otherStation].toFixed(1), Fare: 750, Type: "Main_Haul" }
                );
            }
        }
    }

    if (irinjalakudaColleges[to]) {
        const idx = modifiedLegs.map(l => l.Mode).lastIndexOf('Train');
        if (idx !== -1) {
            const trainLeg = modifiedLegs[idx];
            const otherStation = trainLeg.From;
            if (trainStationKm.hasOwnProperty(otherStation)) {
                modifiedLegs.splice(idx, modifiedLegs.length - idx, 
                    { From: otherStation, To: "Irinjalakuda Railway Stn", Mode: "Train", KM: trainStationKm[otherStation].toFixed(1), Fare: 750, Type: "Main_Haul" },
                    { From: "Irinjalakuda Railway Stn", To: irinjalakudaColleges[to].name, Mode: "Taxi", KM: irinjalakudaColleges[to].km.toFixed(1), Type: "Last_Mile" }
                );
            }
        }
    }

    return modifiedLegs;
}

for (const routesDir of routesDirs) {
    if (!fs.existsSync(routesDir)) continue;
    console.log(`Processing files in directory: ${routesDir}`);
    const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.json'));
    
    let updatedFilesCount = 0;
    
    for (const file of files) {
        const filePath = path.join(routesDir, file);
        const routeMap = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        let modified = false;
        
        const updatedRouteMap = {};
        for (const [routeKey, legObjects] of Object.entries(routeMap)) {
            const newLegs = applyIrinjalakudaRouting(routeKey, legObjects);
            
            // Check if anything changed
            if (JSON.stringify(newLegs) !== JSON.stringify(legObjects)) {
                modified = true;
            }
            updatedRouteMap[routeKey] = newLegs;
        }
        
        if (modified) {
            fs.writeFileSync(filePath, JSON.stringify(updatedRouteMap, null, 2));
            updatedFilesCount++;
        }
    }
    
    console.log(`  Updated ${updatedFilesCount} files.`);
}

console.log('Finished updating Irinjalakuda routing on app.web branch!');
