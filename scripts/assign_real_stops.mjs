/**
 * For each route, find real OSM stops near the route path,
 * then rebuild route.stops[] and route.stopWaypoints[] using those real stops.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src', 'data');

function dist(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Find closest path index to a given lat/lng
function closestPathIdx(path, lat, lng) {
  let bestIdx = 0, bestD = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = dist(path[i][0], path[i][1], lat, lng);
    if (d < bestD) { bestD = d; bestIdx = i; }
  }
  return { idx: bestIdx, dist: bestD };
}

// Find minimum distance from stop to any path segment
function minDistToPath(path, lat, lng) {
  let best = Infinity;
  for (const pt of path) {
    const d = dist(pt[0], pt[1], lat, lng);
    if (d < best) best = d;
  }
  return best;
}

// Read current stops.js (already updated with real stops)
const stopsContent = fs.readFileSync(path.join(SRC, 'stops.js'), 'utf8');
// Extract the JSON array
const stopsMatch = stopsContent.match(/export const stops = (\[[\s\S]+?\]);/);
const stops = JSON.parse(stopsMatch[1]);
console.log(`Loaded ${stops.length} real stops`);

// Read routes.js and extract the routes array
const routesContent = fs.readFileSync(path.join(SRC, 'routes.js'), 'utf8');

// Parse routes by extracting JSON objects (they have complex structure with path arrays)
// We'll use a simple eval approach - parse the module
// Extract each route as a block
const routeBlocks = [];
let depth = 0, start = -1;
let inArray = false;
// Find the outer routes array
const routesStart = routesContent.indexOf('export const routes = [') + 'export const routes = ['.length;
let pos = routesStart;
depth = 1;
let routeStart = -1;

while (pos < routesContent.length && depth > 0) {
  const ch = routesContent[pos];
  if (ch === '{' && depth === 1) { routeStart = pos; depth++; }
  else if (ch === '{') depth++;
  else if (ch === '}') {
    depth--;
    if (depth === 1) {
      routeBlocks.push(routesContent.slice(routeStart, pos + 1));
    }
  }
  pos++;
}

console.log(`Found ${routeBlocks.length} route blocks`);

// Parse each route block as JSON (they're already JSON)
const routes = routeBlocks.map(block => JSON.parse(block));

// For each route, find real stops near the path
const THRESHOLD = 350; // meters: stop must be within this distance of the path
const MIN_STOPS = 3;   // minimum stops per route (start, middle, end)

const updatedRoutes = routes.map(route => {
  const path = route.path;
  if (!path || path.length < 2) return route;

  // Find all real stops within threshold of this route's path
  const nearbyStops = stops
    .map(stop => {
      const { idx, dist: d } = closestPathIdx(path, stop.lat, stop.lng);
      return { stop, pathIdx: idx, dist: d };
    })
    .filter(x => x.dist < THRESHOLD)
    .sort((a, b) => a.pathIdx - b.pathIdx);

  // Deduplicate: if two stops map to path indices within 15 pts, keep the closer one
  const deduped = [];
  for (const entry of nearbyStops) {
    const conflict = deduped.find(e => Math.abs(e.pathIdx - entry.pathIdx) < 15);
    if (conflict) {
      if (entry.dist < conflict.dist) {
        const i = deduped.indexOf(conflict);
        deduped[i] = entry;
      }
    } else {
      deduped.push(entry);
    }
  }

  if (deduped.length < MIN_STOPS) {
    // Fallback: place at start, 1/3, 2/3, end of path using nearest real stop
    const fallbackIdxs = [
      0,
      Math.floor(path.length / 3),
      Math.floor(2 * path.length / 3),
      path.length - 1
    ];
    const fallback = fallbackIdxs.map(fi => {
      const pt = path[fi];
      let best = null, bestD = Infinity;
      for (const s of stops) {
        const d = dist(pt[0], pt[1], s.lat, s.lng);
        if (d < bestD) { bestD = d; best = s; }
      }
      return { stop: best, pathIdx: fi, dist: bestD };
    });
    // Deduplicate stops that appeared multiple times
    const seen = new Set();
    const uniqueFallback = fallback.filter(f => {
      if (seen.has(f.stop.id)) return false;
      seen.add(f.stop.id);
      return true;
    });
    deduped.push(...uniqueFallback);
    deduped.sort((a, b) => a.pathIdx - b.pathIdx);
  }

  // Final dedup by stop ID: if same stop appears twice, keep the one closest to its path index
  const byStopId = new Map();
  for (const entry of deduped) {
    const key = entry.stop.id;
    if (!byStopId.has(key) || entry.dist < byStopId.get(key).dist) {
      byStopId.set(key, entry);
    }
  }
  const finalEntries = Array.from(byStopId.values()).sort((a, b) => a.pathIdx - b.pathIdx);

  const newStopIds = finalEntries.map(e => e.stop.id);
  const newWaypoints = finalEntries.map(e => e.pathIdx);

  console.log(`Route ${route.id} (Bus ${route.bus_number}): ${newStopIds.length} stops [waypoints: ${newWaypoints.join(', ')}]`);
  finalEntries.forEach(e => console.log(`  pathIdx=${e.pathIdx} dist=${Math.round(e.dist)}m → ${e.stop.name} (#${e.stop.id})`));

  return {
    ...route,
    stops: newStopIds,
    stopWaypoints: newWaypoints,
  };
});

// Collect all used stop IDs
const usedIds = new Set(updatedRoutes.flatMap(r => r.stops));
console.log(`\nStops used by at least one route: ${usedIds.size}`);

// Rebuild routes.js preserving the file structure
// Replace each route's stops and stopWaypoints
let newContent = routesContent;

for (let i = 0; i < routes.length; i++) {
  const orig = routes[i];
  const updated = updatedRoutes[i];

  // Replace "stops": [...] for this route
  const origStopsStr = `"stops": [${orig.stops.join(', ')}]`;
  const newStopsStr = `"stops": [${updated.stops.join(', ')}]`;

  // Replace "stopWaypoints": [...] for this route
  const origWpStr = `"stopWaypoints": [${orig.stopWaypoints.join(', ')}]`;
  const newWpStr = `"stopWaypoints": [${updated.stopWaypoints.join(', ')}]`;

  newContent = newContent.replace(origStopsStr, newStopsStr);
  newContent = newContent.replace(origWpStr, newWpStr);
}

fs.writeFileSync(path.join(SRC, 'routes.js'), newContent);
console.log('\nUpdated routes.js with real stop assignments');

// Also trim stops.js to only keep stops used by routes (optional but cleaner)
// Actually keep all 54 real stops so users can search for any of them
console.log('Done!');
