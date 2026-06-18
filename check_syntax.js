const fs = require('fs');

try {
    const appJs = fs.readFileSync('app/src/main/assets/app.js', 'utf8');
    console.log("Loaded app.js. Length:", appJs.length);
    
    // Check if there are any syntax errors by compiling it
    const vm = require('vm');
    const script = new vm.Script(appJs);
    console.log("Syntax is valid!");
} catch (e) {
    console.error("Syntax Error:", e);
}
