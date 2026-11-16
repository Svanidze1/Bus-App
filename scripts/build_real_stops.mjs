/**
 * Fetches real Kutaisi bus stops from OpenStreetMap Overpass API
 * and rewrites src/data/stops.js and updates src/data/routes.js to use them.
 */
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src', 'data');

function httpsPost(hostname, path, body) {
  return new Promise((resolve, reject) => {
    let data = '';
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      res.on('data', d => data += d);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function dist(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

console.log('Fetching real bus stops from OpenStreetMap...');
const query = '[out:json][timeout:30];(node["highway"="bus_stop"](42.20,42.64,42.36,42.78);node["amenity"="bus_stop"](42.20,42.64,42.36,42.78););out body;';
const raw = await httpsPost('overpass-api.de', '/api/interpreter', query);

console.log(`Raw stops: ${raw.elements.length}`);

// Filter: must have a usable English or Georgian name
const withName = raw.elements.filter(e => {
  const tags = e.tags || {};
  return tags['name:en'] || (tags.name && /^[a-zA-Z\s\-'.\/]+$/.test(tags.name));
});

// Prefer English name; fall back to Latin-script name
const mapped = withName.map(e => {
  const tags = e.tags || {};
  const name = tags['name:en'] || tags.name;
  return { osmId: e.id, lat: e.lat, lng: e.lon, name: name.trim() };
});

// Deduplicate stops that are within 60m of each other (pick the one with English name, or the first)
const deduped = [];
for (const stop of mapped) {
  const close = deduped.find(s => dist(s.lat, s.lng, stop.lat, stop.lng) < 60);
  if (close) {
    // Prefer the one with an ASCII English name
    if (!close.name.match(/[^\x00-\x7F]/) && stop.name.match(/[^\x00-\x7F]/)) continue;
    if (close.name.match(/[^\x00-\x7F]/) && !stop.name.match(/[^\x00-\x7F]/)) {
      Object.assign(close, stop);
    }
    continue;
  }
  deduped.push({ ...stop });
}

// Only keep stops inside Kutaisi proper (within 4km of center)
const CENTER = { lat: 42.2662, lng: 42.7180 };
const inCity = deduped.filter(s => dist(s.lat, s.lng, CENTER.lat, CENTER.lng) < 5000);

// Assign sequential IDs
inCity.sort((a, b) => a.lat - b.lat || a.lng - b.lng);
const stops = inCity.map((s, i) => ({
  id: i + 1,
  name: s.name,
  lat: parseFloat(s.lat.toFixed(7)),
  lng: parseFloat(s.lng.toFixed(7)),
}));

console.log(`Final stops: ${stops.length}`);
stops.slice(0, 10).forEach(s => console.log(`  ${s.id}: ${s.name} [${s.lat}, ${s.lng}]`));

// Write stops.js
const stopsJs = `export const stops = ${JSON.stringify(stops, null, 2)};\n\nexport const stopsMap = Object.fromEntries(stops.map(s => [s.id, s]));\n`;
fs.writeFileSync(path.join(SRC, 'stops.js'), stopsJs);
console.log('\nWrote stops.js');

// Now remap routes: for each route's stop IDs, find the nearest real stop
const routesRaw = fs.readFileSync(path.join(SRC, 'routes.js'), 'utf8');

// Parse old stops.js to get original stop positions for remapping
// We need the original stop coordinates to find nearest real stop
// Extract them from the routes.js string via regex on old data
// Instead, load the original stop coordinates from the script arg or hardcoded
// For now, read from the already-overwritten stops.js and use Overpass raw data for old positions

// Build lookup: osmId → new stop id (if within 100m of any new stop)
function nearestStop(lat, lng) {
  let best = null, bestD = Infinity;
  for (const s of stops) {
    const d = dist(lat, lng, s.lat, s.lng);
    if (d < bestD) { bestD = d; best = s; }
  }
  return { stop: best, dist: bestD };
}

// Old stop positions (hardcoded from previous stops.js) - we need these to remap route.stops[]
const OLD_STOPS = [
  {"id":1,"lat":42.2723,"lng":42.7067},
  {"id":2,"lat":42.2683,"lng":42.7055},
  {"id":3,"lat":42.2670,"lng":42.7040},
  {"id":4,"lat":42.2695,"lng":42.7101},
  {"id":5,"lat":42.2608,"lng":42.7225},
  {"id":6,"lat":42.2652,"lng":42.7300},
  {"id":7,"lat":42.2632,"lng":42.7164},
  {"id":8,"lat":42.2554,"lng":42.7070},
  {"id":9,"lat":42.2540,"lng":42.7115},
  {"id":10,"lat":42.2689,"lng":42.7241},
  {"id":11,"lat":42.2450,"lng":42.6990},
  {"id":12,"lat":42.2442,"lng":42.7005},
  {"id":13,"lat":42.2435,"lng":42.7020},
  {"id":14,"lat":42.2428,"lng":42.7035},
  {"id":15,"lat":42.2420,"lng":42.7050},
  {"id":16,"lat":42.2602,"lng":42.7042},
  {"id":17,"lat":42.2615,"lng":42.7056},
  {"id":18,"lat":42.2627,"lng":42.7070},
  {"id":19,"lat":42.2638,"lng":42.7085},
  {"id":20,"lat":42.2650,"lng":42.7100},
  {"id":21,"lat":42.2665,"lng":42.7115},
  {"id":22,"lat":42.2678,"lng":42.7130},
  {"id":23,"lat":42.2690,"lng":42.7145},
  {"id":24,"lat":42.2703,"lng":42.7160},
  {"id":25,"lat":42.2715,"lng":42.7175},
  {"id":26,"lat":42.2640,"lng":42.6995},
  {"id":27,"lat":42.2652,"lng":42.7010},
  {"id":28,"lat":42.2664,"lng":42.7025},
  {"id":29,"lat":42.2676,"lng":42.7040},
  {"id":30,"lat":42.2688,"lng":42.7055},
  {"id":31,"lat":42.2700,"lng":42.7200},
  {"id":32,"lat":42.2712,"lng":42.7215},
  {"id":33,"lat":42.2724,"lng":42.7230},
  {"id":34,"lat":42.2736,"lng":42.7245},
  {"id":35,"lat":42.2748,"lng":42.7260},
  {"id":36,"lat":42.2755,"lng":42.7060},
  {"id":37,"lat":42.2765,"lng":42.7075},
  {"id":38,"lat":42.2775,"lng":42.7090},
  {"id":39,"lat":42.2785,"lng":42.7105},
  {"id":40,"lat":42.2795,"lng":42.7120},
  {"id":41,"lat":42.2620,"lng":42.7090},
  {"id":42,"lat":42.2632,"lng":42.7105},
  {"id":43,"lat":42.2644,"lng":42.7120},
  {"id":44,"lat":42.2656,"lng":42.7135},
  {"id":45,"lat":42.2668,"lng":42.7150},
  {"id":46,"lat":42.2500,"lng":42.7180},
  {"id":47,"lat":42.2512,"lng":42.7195},
  {"id":48,"lat":42.2524,"lng":42.7210},
  {"id":49,"lat":42.2536,"lng":42.7225},
  {"id":50,"lat":42.2548,"lng":42.7240},
  {"id":51,"lat":42.2560,"lng":42.7190},
  {"id":52,"lat":42.2572,"lng":42.7205},
  {"id":53,"lat":42.2584,"lng":42.7220},
  {"id":54,"lat":42.2596,"lng":42.7235},
  {"id":55,"lat":42.2608,"lng":42.7250},
  {"id":56,"lat":42.2710,"lng":42.6960},
  {"id":57,"lat":42.2722,"lng":42.6975},
  {"id":58,"lat":42.2734,"lng":42.6990},
  {"id":59,"lat":42.2746,"lng":42.7005},
  {"id":60,"lat":42.2758,"lng":42.7020},
  {"id":61,"lat":42.2580,"lng":42.7330},
  {"id":62,"lat":42.2568,"lng":42.7315},
  {"id":63,"lat":42.2556,"lng":42.7300},
  {"id":64,"lat":42.2544,"lng":42.7285},
  {"id":65,"lat":42.2532,"lng":42.7270},
  {"id":66,"lat":42.2480,"lng":42.7070},
  {"id":67,"lat":42.2492,"lng":42.7085},
  {"id":68,"lat":42.2504,"lng":42.7100},
  {"id":69,"lat":42.2516,"lng":42.7115},
  {"id":70,"lat":42.2528,"lng":42.7130},
  {"id":71,"lat":42.2400,"lng":42.7200},
  {"id":72,"lat":42.2412,"lng":42.7185},
  {"id":73,"lat":42.2424,"lng":42.7170},
  {"id":74,"lat":42.2436,"lng":42.7155},
  {"id":75,"lat":42.2448,"lng":42.7140},
  {"id":76,"lat":42.2620,"lng":42.7240},
  {"id":77,"lat":42.2632,"lng":42.7255},
  {"id":78,"lat":42.2644,"lng":42.7270},
  {"id":79,"lat":42.2656,"lng":42.7285},
  {"id":80,"lat":42.2668,"lng":42.7300},
  {"id":81,"lat":42.2585,"lng":42.7120},
  {"id":82,"lat":42.2597,"lng":42.7135},
  {"id":83,"lat":42.2609,"lng":42.7150},
  {"id":84,"lat":42.2621,"lng":42.7165},
  {"id":85,"lat":42.2633,"lng":42.7180},
  {"id":86,"lat":42.2450,"lng":42.7250},
  {"id":87,"lat":42.2462,"lng":42.7235},
  {"id":88,"lat":42.2474,"lng":42.7220},
  {"id":89,"lat":42.2486,"lng":42.7205},
  {"id":90,"lat":42.2498,"lng":42.7190},
  {"id":91,"lat":42.2670,"lng":42.7000},
  {"id":92,"lat":42.2682,"lng":42.7015},
  {"id":93,"lat":42.2694,"lng":42.7030},
  {"id":94,"lat":42.2706,"lng":42.7045},
  {"id":95,"lat":42.2718,"lng":42.7060},
  {"id":96,"lat":42.2540,"lng":42.7060},
  {"id":97,"lat":42.2552,"lng":42.7075},
  {"id":98,"lat":42.2564,"lng":42.7090},
  {"id":99,"lat":42.2576,"lng":42.7105},
  {"id":100,"lat":42.2588,"lng":42.7120},
  {"id":101,"lat":42.2600,"lng":42.7135},
  {"id":102,"lat":42.2612,"lng":42.7150},
  {"id":103,"lat":42.2624,"lng":42.7165},
  {"id":104,"lat":42.2636,"lng":42.7180},
  {"id":105,"lat":42.2648,"lng":42.7195},
  {"id":106,"lat":42.2710,"lng":42.7080},
  {"id":107,"lat":42.2722,"lng":42.7095},
  {"id":108,"lat":42.2734,"lng":42.7110},
  {"id":109,"lat":42.2746,"lng":42.7125},
  {"id":110,"lat":42.2758,"lng":42.7140},
  {"id":111,"lat":42.2460,"lng":42.7110},
  {"id":112,"lat":42.2472,"lng":42.7095},
  {"id":113,"lat":42.2484,"lng":42.7080},
  {"id":114,"lat":42.2496,"lng":42.7065},
  {"id":115,"lat":42.2508,"lng":42.7050},
  {"id":116,"lat":42.2660,"lng":42.7310},
  {"id":117,"lat":42.2648,"lng":42.7295},
  {"id":118,"lat":42.2636,"lng":42.7280},
  {"id":119,"lat":42.2624,"lng":42.7265},
  {"id":120,"lat":42.2612,"lng":42.7250},
];

// Build old-id → new-id map
const oldToNew = {};
for (const old of OLD_STOPS) {
  const { stop, dist: d } = nearestStop(old.lat, old.lng);
  oldToNew[old.id] = stop.id;
  if (d > 500) console.log(`  WARNING: old stop ${old.id} (${old.lat},${old.lng}) mapped to "${stop.name}" ${Math.round(d)}m away`);
}

// Patch routes.js: replace stop IDs in the stops arrays
let routesContent = routesRaw;
// Find all "stops": [...] arrays and remap the IDs
routesContent = routesContent.replace(/"stops":\s*\[([^\]]+)\]/g, (match, inner) => {
  const ids = inner.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
  const newIds = ids.map(id => oldToNew[id] ?? id);
  // Deduplicate consecutive identical IDs
  const deduped = newIds.filter((id, i) => i === 0 || id !== newIds[i-1]);
  return `"stops": [${deduped.join(', ')}]`;
});

fs.writeFileSync(path.join(SRC, 'routes.js'), routesContent);
console.log('Updated routes.js stop IDs');

// Summary
console.log('\n=== SUMMARY ===');
console.log(`Stops: ${stops.length} real OSM stops`);
console.log('Old → New ID mapping sample:');
[1,2,3,4,5,6,7,8,9,10].forEach(id => {
  const newId = oldToNew[id];
  const s = stops.find(x => x.id === newId);
  console.log(`  Old ${id} → New ${newId}: ${s?.name}`);
});
