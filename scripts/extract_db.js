const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
    console.log('Fetching ta_database.json from Git history...');
    const stdout = execSync(
        'git show 7d423bdf2dfba0f3b7c04ed969e608e72de3a1a9^:app/src/main/assets/ta_database.json',
        { maxBuffer: 100 * 1024 * 1024 } // 100MB buffer
    );
    
    console.log('Parsing JSON database...');
    const db = JSON.parse(stdout.toString('utf8'));
    
    console.log('Extracting legs and routes...');
    const legs = db.legs;
    const routes = db.routes;
    
    console.log(`Writing legs.json (${Object.keys(legs).length} legs)...`);
    fs.writeFileSync(
        path.join(__dirname, '..', 'legs.json'),
        JSON.stringify(legs, null, 2)
    );
    
    console.log(`Writing routes.json (${Object.keys(routes).length} routes)...`);
    fs.writeFileSync(
        path.join(__dirname, '..', 'routes.json'),
        JSON.stringify(routes, null, 2)
    );
    
    console.log('Successfully completed normalized extraction!');
} catch (e) {
    console.error('Error running extraction:', e);
}
