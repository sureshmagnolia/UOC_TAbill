const fs = require('fs');
const path = require('path');

// 1. Update perfect_hub_map.json
const hubMapPath = path.join(__dirname, '..', 'perfect_hub_map.json');
const hubMap = JSON.parse(fs.readFileSync(hubMapPath, 'utf8'));

const irinjalakudaColleges = {
    "ASM": { nearest_station: "Irinjalakuda Railway Stn", km_to_station: 22.0 },
    "NAT": { nearest_station: "Irinjalakuda Railway Stn", km_to_station: 24.0 },
    "CCI": { nearest_station: "Irinjalakuda Railway Stn", km_to_station: 7.0 },
    "SJCI": { nearest_station: "Irinjalakuda Railway Stn", km_to_station: 8.0 },
    "ETCI": { nearest_station: "Irinjalakuda Railway Stn", km_to_station: 8.0 }
};

for (const [abbr, data] of Object.entries(irinjalakudaColleges)) {
    hubMap[abbr] = data;
    console.log(`Updated hubMap for ${abbr}`);
}

fs.writeFileSync(hubMapPath, JSON.stringify(hubMap, null, 2));
console.log('Saved perfect_hub_map.json');

// 2. Update train_backbone.json
const trainPath = path.join(__dirname, '..', 'train_backbone.json');
const trainBackbone = JSON.parse(fs.readFileSync(trainPath, 'utf8'));

const trainStationKm = {
    "Palakkad Railway Station": 95.0,
    "Parappanangadi Railway Station": 101.0,
    "Pattambi Railway Station": 65.0,
    "Ottappalam Railway Station": 54.0,
    "Kozhikode Railway Station": 133.0,
    "Tirur Railway Station": 92.0,
    "Kuttippuram Railway Station": 77.0,
    "Shoranur Railway Station": 54.0,
    "Guruvayur Railway Station": 46.0,
    "Vadakara Railway Station": 178.0,
    "Thrissur Railway Station": 21.0
};

for (const [station, km] of Object.entries(trainStationKm)) {
    const key1 = `Irinjalakuda Railway Stn|${station}`;
    const key2 = `${station}|Irinjalakuda Railway Stn`;
    
    trainBackbone[key1] = {
        From: "Irinjalakuda Railway Stn",
        To: station,
        Mode: "Train",
        KM: km
    };
    trainBackbone[key2] = {
        From: station,
        To: "Irinjalakuda Railway Stn",
        Mode: "Train",
        KM: km
    };
    console.log(`Added train connections between Irinjalakuda Railway Stn and ${station}`);
}

fs.writeFileSync(trainPath, JSON.stringify(trainBackbone, null, 2));
console.log('Saved train_backbone.json');
