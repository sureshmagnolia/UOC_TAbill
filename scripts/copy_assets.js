const fs = require('fs');
const path = require('path');

const srcLegs = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'legs.json');
const srcRoutesDir = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'routes');

const destLegs = path.join(__dirname, '..', 'legs.json');
const destRoutesDir = path.join(__dirname, '..', 'routes');

// Copy legs.json
fs.copyFileSync(srcLegs, destLegs);
console.log('Copied legs.json to root.');

// Copy routes/
if (!fs.existsSync(destRoutesDir)) {
    fs.mkdirSync(destRoutesDir, { recursive: true });
}

// Clear destination routes directory first
const destFiles = fs.readdirSync(destRoutesDir);
for (const file of destFiles) {
    fs.unlinkSync(path.join(destRoutesDir, file));
}

const srcFiles = fs.readdirSync(srcRoutesDir);
for (const file of srcFiles) {
    fs.copyFileSync(path.join(srcRoutesDir, file), path.join(destRoutesDir, file));
}
console.log(`Copied ${srcFiles.length} route files to root routes/ directory.`);
