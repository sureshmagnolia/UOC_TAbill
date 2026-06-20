const fs = require('fs');
const backbone = require('./train_backbone.json');
const hubs = require('./perfect_hub_map.json');

const aliasMap = {
  'Palakkad Jn Railway': 'Palakkad Railway Station',
  'Parappanangadi Stn': 'Parappanangadi Railway Station',
  'Thrissur Railway Stn': 'Thrissur Railway Station',
  'Pattambi Railway Stn': 'Pattambi Railway Station',
  'Ottappalam Railway Stn': 'Ottappalam Railway Station',
  'Guruvayur Railway Stn': 'Guruvayur Railway Station'
};

function normalize(name) {
  return aliasMap[name] || name;
}

const newHubs = {};
for (const [abbr, data] of Object.entries(hubs)) {
    newHubs[abbr] = {
        nearest_station: normalize(data.nearest_station),
        km_to_station: data.km_to_station
    };
}

const newBackbone = {};
for (const [key, hop] of Object.entries(backbone)) {
    const [from, to] = key.split('|');
    const normFrom = normalize(from);
    const normTo = normalize(to);
    
    const newKey = normFrom + '|' + normTo;
    
    if (!newBackbone[newKey]) {
        newBackbone[newKey] = {
            ...hop,
            From: normFrom,
            To: normTo
        };
    }
}

fs.writeFileSync('perfect_hub_map.json', JSON.stringify(newHubs, null, 2));
fs.writeFileSync('train_backbone.json', JSON.stringify(newBackbone, null, 2));
console.log('Normalized data.');
