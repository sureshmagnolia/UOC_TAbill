const fs = require('fs');
const path = require('path');

const abbrevs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ta_abbrevs.json'), 'utf8'));

const targets = [
    { name: "Victoria", key: "victoria" },
    { name: "Mercy", key: "mercy" },
    { name: "Parakkulam", key: "parakkulam" },
    { name: "Pattambi", key: "pattambi" },
    { name: "Ottappalam", key: "ottappalam" },
    { name: "Mannarkkad", key: "mannarkkad" },
    { name: "Chittur", key: "chittur" },
    { name: "Nemmara", key: "nemmara" },
    { name: "Alathur", key: "alathur" },
    { name: "Thrissur", key: "thrissur" },
    { name: "Sree Krishna", key: "sree krishna" },
    { name: "Guruvayur", key: "guruvayur" },
    { name: "Nattika", key: "nattika" },
    { name: "Asmabi", key: "asmabi" },
    { name: "Calicut", key: "calicut" }
];

console.log("Searching for name substrings in ta_abbrevs.json:");
for (const target of targets) {
    const matches = abbrevs.filter(a => 
        (a['Full College Name & Location'] || '').toLowerCase().includes(target.key)
    );
    console.log(`\nTarget: "${target.name}"`);
    for (const m of matches) {
        console.log(`  - ${m.Abbreviation}: "${m['Full College Name & Location']}" (${m['Hub Category']})`);
    }
}
