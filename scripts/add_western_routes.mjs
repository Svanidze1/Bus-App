/**
 * Adds new bus routes through unserved western Kutaisi stops,
 * fetches OSRM paths, and rebuilds routes.js + buses.js
 */
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src', 'data');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

async function fetchOSRMPath(coords) {
  // coords = [[lat,lng], ...]
  const waypoints = coords.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`;
  try {
    const data = await httpsGet(url);
    if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
      return data.routes[0].geometry.coordinates.map(([lng, lat]) => [
        parseFloat(lat.toFixed(7)),
        parseFloat(lng.toFixed(7))
      ]);
    }
  } catch(e) { console.error('OSRM error:', e.message); }
  return null;
}

function dist(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function closestPathIdx(path, lat, lng) {
  let bestIdx = 0, bestD = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = dist(path[i][0], path[i][1], lat, lng);
    if (d < bestD) { bestD = d; bestIdx = i; }
  }
  return { idx: bestIdx, dist: bestD };
}

// Read current stops
const stopsContent = fs.readFileSync(path.join(SRC, 'stops.js'), 'utf8');
const stopsMatch = stopsContent.match(/export const stops = (\[[\s\S]+?\]);/);
const stops = JSON.parse(stopsMatch[1]);
const stopsMap = Object.fromEntries(stops.map(s => [s.id, s]));

// New routes: each defined by stop IDs in order
// These connect the unserved western stops to the central hub
const NEW_ROUTE_DEFS = [
  {
    id: 11,
    bus_number: 'A',
    color: '#a855f7',  // purple
    // West express: Pirosmani → minerals → ice palace area → victory sq → revenue svc → aslanikashvili → grishashvili → tourist info → karvasla
    stopIds: [4, 29, 47, 46, 41, 44, 39, 34, 37, 40, 38, 49, 48]
  },
  {
    id: 12,
    bus_number: 'B',
    color: '#10b981',  // emerald
    // Chavchavadze / parliament → 21st school → garden of glory → aslanikashvili → tortladze → parnavaz → grishashvili → aghmashenebeli bridge → music school
    stopIds: [9, 23, 26, 16, 18, 32, 35, 37, 40, 17, 33]
  },
  {
    id: 13,
    bus_number: 'C',
    color: '#ef4444',  // red
    // Youth park → autonomy → nutsubidze → tskhinvali → revenue svc → victory sq → oghaskura → minerals → pirosmani → shartava → kutaisi2
    stopIds: [2, 19, 21, 44, 39, 36, 41, 29, 4, 12, 7]
  },
  {
    id: 14,
    bus_number: 'D',
    color: '#f97316',  // orange
    // Suliko → bukhaidze → oghaskura → tortladze → 21st school → asatiani → aghmashenebeli bridge → university → korkia st → balakhvani → school#12
    stopIds: [27, 31, 41, 32, 16, 14, 17, 30, 42, 20, 11]
  },
  {
    id: 15,
    bus_number: 'E',
    color: '#06b6d4',  // cyan
    // Train station → school#12 → balakhvani → university → aghmashenebeli bridge → asatiani → chechelashvili → garden of glory → 21st school → shartava → kutaisi2
    stopIds: [15, 11, 20, 30, 17, 14, 28, 18, 16, 12, 7]
  },
];

console.log('Fetching OSRM paths for new routes...\n');

const newRoutes = [];
for (const def of NEW_ROUTE_DEFS) {
  const coords = def.stopIds.map(id => {
    const s = stopsMap[id];
    if (!s) { console.warn(`Stop ${id} not found!`); return null; }
    return [s.lat, s.lng];
  }).filter(Boolean);

  console.log(`Route ${def.id} (Bus ${def.bus_number}): fetching path through ${coords.length} stops...`);
  const path = await fetchOSRMPath(coords);

  if (!path) {
    console.error(`  FAILED to fetch path for route ${def.id}`);
    continue;
  }

  console.log(`  Got ${path.length} path points`);

  // Compute stopWaypoints
  const stopWaypoints = def.stopIds.map(id => {
    const s = stopsMap[id];
    if (!s) return 0;
    const { idx, dist: d } = closestPathIdx(path, s.lat, s.lng);
    console.log(`  Stop ${id} (${s.name}): pathIdx=${idx}, dist=${Math.round(d)}m`);
    return idx;
  });

  // Deduplicate consecutive identical waypoints
  const cleanStops = [];
  const cleanWaypoints = [];
  let lastWp = -1;
  for (let i = 0; i < def.stopIds.length; i++) {
    if (stopWaypoints[i] !== lastWp) {
      cleanStops.push(def.stopIds[i]);
      cleanWaypoints.push(stopWaypoints[i]);
      lastWp = stopWaypoints[i];
    }
  }

  newRoutes.push({
    id: def.id,
    bus_number: def.bus_number,
    color: def.color,
    stops: cleanStops,
    stopWaypoints: cleanWaypoints,
    path,
  });

  // Small delay between requests
  await new Promise(r => setTimeout(r, 500));
}

console.log(`\nFetched ${newRoutes.length} new routes`);

// Append to routes.js
let routesContent = fs.readFileSync(path.join(SRC, 'routes.js'), 'utf8');

// Find the closing ]; of the routes array and insert before it
const insertPos = routesContent.lastIndexOf('];');
const newRoutesStr = newRoutes.map(r => {
  const pathStr = r.path.map(pt => `[${pt[0]},${pt[1]}]`).join(',');
  return `  {
    "id": ${r.id},
    "bus_number": "${r.bus_number}",
    "color": "${r.color}",
    "stops": [${r.stops.join(', ')}],
    "stopWaypoints": [${r.stopWaypoints.join(', ')}],
    "path": [${pathStr}]
  }`;
}).join(',\n');

routesContent = routesContent.slice(0, insertPos) + ',\n' + newRoutesStr + '\n' + routesContent.slice(insertPos);
fs.writeFileSync(path.join(SRC, 'routes.js'), routesContent);
console.log('Updated routes.js with new routes');

// Rebuild buses.js: 4 buses per route, evenly spaced
const pathLengths = {
  1: 149,   // Bus 5
  2: 424,   // Bus 10 (using max path index ~ stopWaypoints last)
  3: 111,   // Bus 20
  4: 414,   // Bus 2
  5: 265,   // Bus 3
  6: 161,   // Bus 7
  7: 282,   // Bus 15
  8: 240,   // Bus 22
  9: 265,   // Bus 30
  10: 358,  // Bus 11
};
for (const r of newRoutes) {
  pathLengths[r.id] = r.path.length - 1;
}

// Build all routes list (existing + new IDs)
const allRouteIds = [1,2,3,4,5,6,7,8,9,10, ...newRoutes.map(r => r.id)];

let busId = 100;
const buses = [];
for (const routeId of allRouteIds) {
  const pathLen = pathLengths[routeId];
  const numBuses = 4;
  for (let i = 0; i < numBuses; i++) {
    const startIdx = Math.floor((i / numBuses) * pathLen);
    buses.push(`  { "id": ${++busId}, "route_id": ${routeId}, "startPathIndex": ${startIdx} }`);
  }
}

const busesJs = `// ${buses.length} buses across ${allRouteIds.length} routes, 4 per route\nexport const initialBuses = [\n${buses.join(',\n')}\n];\n`;
fs.writeFileSync(path.join(SRC, 'buses.js'), busesJs);
console.log(`Wrote buses.js with ${buses.length} buses`);

// Update TripPlanner footer
const tpPath = path.join(__dirname, '..', 'src', 'components', 'TripPlanner.jsx');
let tpContent = fs.readFileSync(tpPath, 'utf8');
tpContent = tpContent.replace(
  /<p className="text-lg font-bold text-white">10<\/p>\s*\n\s*<p className="text-xs text-slate-500">Active Routes<\/p>/,
  `<p className="text-lg font-bold text-white">${allRouteIds.length}</p>\n            <p className="text-xs text-slate-500">Active Routes</p>`
);
fs.writeFileSync(tpPath, tpContent);
console.log('Updated TripPlanner footer');
