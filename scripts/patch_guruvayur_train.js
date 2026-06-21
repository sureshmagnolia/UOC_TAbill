const fs = require('fs');
const path = require('path');

const WORKSPACE = path.join(__dirname, '..');
const LEGS_PATH = path.join(WORKSPACE, 'legs.json');
const ROUTES_DIR = path.join(WORKSPACE, 'routes');

function patch() {
    console.log('Running Guruvayur Train-to-Bus patch...');

    // 1. Patch legs.json
    if (fs.existsSync(LEGS_PATH)) {
        const legsData = JSON.parse(fs.readFileSync(LEGS_PATH, 'utf8'));
        let modifiedLegs = false;
        
        if (legsData.legs && legsData.legs['LEG_4458']) {
            delete legsData.legs['LEG_4458'];
            console.log('  Deleted train leg LEG_4458 from legs.json');
            modifiedLegs = true;
        }
        if (legsData.legs && legsData.legs['LEG_34220']) {
            delete legsData.legs['LEG_34220'];
            console.log('  Deleted return train leg LEG_34220 from legs.json');
            modifiedLegs = true;
        }
        
        if (modifiedLegs) {
            fs.writeFileSync(LEGS_PATH, JSON.stringify(legsData), 'utf8');
            console.log('  Saved legs.json');
        }
    } else {
        console.error('Error: legs.json not found');
        return;
    }

    // 2. Patch routes/*.json files
    if (fs.existsSync(ROUTES_DIR)) {
        const files = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.json'));
        let patchedFilesCount = 0;

        files.forEach(filename => {
            const filePath = path.join(ROUTES_DIR, filename);
            const routes = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            let modified = false;

            for (const [key, lids] of Object.entries(routes)) {
                if (Array.isArray(lids)) {
                    // Replace LEG_4458 with LEG_12409
                    const idx = lids.indexOf('LEG_4458');
                    if (idx !== -1) {
                        lids[idx] = 'LEG_12409';
                        modified = true;
                    }
                    // Replace LEG_34220 with LEG_34222
                    const idxReturn = lids.indexOf('LEG_34220');
                    if (idxReturn !== -1) {
                        lids[idxReturn] = 'LEG_34222';
                        modified = true;
                    }
                }
            }

            if (modified) {
                fs.writeFileSync(filePath, JSON.stringify(routes), 'utf8');
                console.log(`  Patched route file: ${filename}`);
                patchedFilesCount++;
            }
        });
        console.log(`Successfully patched ${patchedFilesCount} route files.`);
    } else {
        console.error('Error: routes directory not found');
    }
}

patch();
