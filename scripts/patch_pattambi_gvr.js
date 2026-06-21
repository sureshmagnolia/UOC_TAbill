const fs = require('fs');
const path = require('path');

const WORKSPACE = path.join(__dirname, '..');
const LEGS_PATH = path.join(WORKSPACE, 'legs.json');

function patch() {
    console.log('Running refined Pattambi-Guruvayur Bus Stand patch...');

    if (fs.existsSync(LEGS_PATH)) {
        const db = JSON.parse(fs.readFileSync(LEGS_PATH, 'utf8'));
        
        // 1. Ensure "Pattambi Bus Stand" is in stations
        let pattambiBusStandIdx = db.stations.indexOf('Pattambi Bus Stand');
        if (pattambiBusStandIdx === -1) {
            db.stations.push('Pattambi Bus Stand');
            pattambiBusStandIdx = db.stations.length - 1;
            console.log(`  Appended "Pattambi Bus Stand" to stations at index ${pattambiBusStandIdx}`);
        } else {
            console.log(`  "Pattambi Bus Stand" already exists at index ${pattambiBusStandIdx}`);
        }

        const busIdx = db.modes.indexOf('Bus');
        const gvrBusStandIdx = 448; // Guruvayur Bus Stand index verified

        let modified = false;

        // 2. Modify LEG_61877 (First Mile): change To station to Pattambi Bus Stand (pattambiBusStandIdx)
        if (db.legs && db.legs['LEG_61877']) {
            db.legs['LEG_61877'][1] = pattambiBusStandIdx;
            console.log(`  Updated LEG_61877: To -> index ${pattambiBusStandIdx} ("Pattambi Bus Stand")`);
            modified = true;
        }

        // 3. Modify LEG_61881 (Main Haul): change From to Pattambi Bus Stand, To to Guruvayur Bus Stand, Mode to 'Bus', KM to 35.0
        if (db.legs && db.legs['LEG_61881']) {
            db.legs['LEG_61881'][0] = pattambiBusStandIdx;
            db.legs['LEG_61881'][1] = gvrBusStandIdx;
            db.legs['LEG_61881'][2] = busIdx;
            db.legs['LEG_61881'][3] = 35.0;
            console.log(`  Updated LEG_61881: From -> index ${pattambiBusStandIdx}, To -> index ${gvrBusStandIdx}, Mode -> Bus, KM -> 35.0`);
            modified = true;
        }

        // 4. Modify LEG_47029 (Last Mile LFC): change From to Guruvayur Bus Stand
        if (db.legs && db.legs['LEG_47029']) {
            db.legs['LEG_47029'][0] = gvrBusStandIdx;
            console.log(`  Updated LEG_47029: From -> index ${gvrBusStandIdx} ("Guruvayur Bus Stand")`);
            modified = true;
        }

        // 5. Modify LEG_47034 (Last Mile SKG): change From to Guruvayur Bus Stand
        if (db.legs && db.legs['LEG_47034']) {
            db.legs['LEG_47034'][0] = gvrBusStandIdx;
            console.log(`  Updated LEG_47034: From -> index ${gvrBusStandIdx} ("Guruvayur Bus Stand")`);
            modified = true;
        }

        // 6. Modify LEG_34350: KM to 37.5
        if (db.legs && db.legs['LEG_34350']) {
            db.legs['LEG_34350'][3] = 37.5;
            console.log('  Updated LEG_34350: KM -> 37.5');
            modified = true;
        }

        // 7. Modify LEG_60406: KM to 40.0
        if (db.legs && db.legs['LEG_60406']) {
            db.legs['LEG_60406'][3] = 40.0;
            console.log('  Updated LEG_60406: KM -> 40.0');
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(LEGS_PATH, JSON.stringify(db), 'utf8');
            console.log('Successfully updated legs.json');
        }
    } else {
        console.error('Error: legs.json not found');
    }
}

patch();
