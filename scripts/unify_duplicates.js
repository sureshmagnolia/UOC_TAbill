const fs = require('fs');
const path = require('path');

const abbrevsPath = path.join(__dirname, '..', 'ta_abbrevs.json');
const routesPath = path.join(__dirname, '..', 'routes.json');
const legsPath = path.join(__dirname, '..', 'legs.json');

// Mappings for duplicates (From Duplicate -> To Canonical)
const dupMap = {
    "SNCA": "ALA",
    "SNCN": "NAT",
    "MACV": "ASM",
    "LFCG": "LFC",
    "PTB": "SNGS"  // PTB was the manually curated code, SNGS is the canonical abbreviation in ta_abbrevs.json
};

// We want to prioritize routes that originally came from the manual/curated codes:
const manualCodes = new Set(["ALA", "NAT", "ASM", "LFC", "PTB", "VIC", "MCY", "PRK", "OTP", "MKD", "CTR", "NEM", "SMT", "SKG", "UOC"]);

console.log('Updating ta_abbrevs.json...');
let abbrevs = JSON.parse(fs.readFileSync(abbrevsPath, 'utf8'));
// Ensure PTB is not in abbreviations list (as SNGS is the official one), and remove other duplicates
const filteredAbbrevs = abbrevs.filter(a => !["SNCA", "SNCN", "MACV", "LFCG", "PTB"].includes(a.Abbreviation));
fs.writeFileSync(abbrevsPath, JSON.stringify(filteredAbbrevs, null, 2));
console.log(`Abbreviations count: ${filteredAbbrevs.length}`);

console.log('Loading legs...');
const legs = JSON.parse(fs.readFileSync(legsPath, 'utf8'));

console.log('Updating routes.json...');
let routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
const updatedRoutes = {};
const originalKeys = {}; // track which original key was chosen for each unified key

for (const [key, value] of Object.entries(routes)) {
    const parts = key.split('_');
    if (parts.length === 2) {
        let [from, to] = parts;
        const originalFrom = from;
        const originalTo = to;
        
        if (dupMap.hasOwnProperty(from)) {
            from = dupMap[from];
        }
        if (dupMap.hasOwnProperty(to)) {
            to = dupMap[to];
        }
        const newKey = `${from}_${to}`;
        
        // Unify ALA_ALA, SNGS_SNGS etc. to empty arrays (same college)
        if (from === to) {
            updatedRoutes[newKey] = [];
            originalKeys[newKey] = key;
            continue;
        }

        const isNewManual = manualCodes.has(originalFrom) && manualCodes.has(originalTo);
        const existingKey = originalKeys[newKey];
        
        if (existingKey) {
            const existingParts = existingKey.split('_');
            const isExistingManual = manualCodes.has(existingParts[0]) && manualCodes.has(existingParts[1]);
            
            // Check if existing route has a train leg
            const existingHasTrain = updatedRoutes[newKey].some(legId => legs[legId] && legs[legId].Mode === 'Train');
            const newHasTrain = value.some(legId => legs[legId] && legs[legId].Mode === 'Train');
            
            let preferNew = false;
            
            if (isNewManual && !isExistingManual) {
                preferNew = true;
            } else if (!isNewManual && isExistingManual) {
                preferNew = false;
            } else if (newHasTrain && !existingHasTrain) {
                preferNew = true; // prefer the route that actually uses train/railway
            } else if (!newHasTrain && existingHasTrain) {
                preferNew = false;
            } else if (value.length > updatedRoutes[newKey].length) {
                preferNew = true; // prefer more detailed multi-leg routing
            }
            
            if (preferNew) {
                console.log(`Replacing collision for ${newKey}: preferring original route ${key} over ${existingKey}`);
                updatedRoutes[newKey] = value;
                originalKeys[newKey] = key;
            } else {
                // keep existing
            }
        } else {
            updatedRoutes[newKey] = value;
            originalKeys[newKey] = key;
        }
    } else {
        updatedRoutes[key] = value;
    }
}

fs.writeFileSync(routesPath, JSON.stringify(updatedRoutes, null, 2));
console.log(`Routes updated. Total routes: ${Object.keys(updatedRoutes).length}`);
