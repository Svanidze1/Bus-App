const fs = require('fs');
const path = require('path');

// ── Helpers ──────────────────────────────────────────────────────────

/** Read a file, extract the array assigned to `varName`, and JSON.parse it. */
function extractArray(filePath, varName) {
  const src = fs.readFileSync(filePath, 'utf-8');

  // Build a regex that finds "export const <varName> = ["
  const tag = `export const ${varName}`;
  const idx = src.indexOf(tag);
  if (idx === -1) throw new Error(`Could not find "${tag}" in ${filePath}`);

  // Find the first '[' after the tag
  const startBracket = src.indexOf('[', idx);
  if (startBracket === -1) throw new Error(`Could not find opening '[' for ${varName}`);

  // Walk forward counting brackets to find the matching ']'
  let depth = 0;
  let endBracket = -1;
  for (let i = startBracket; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') {
      depth--;
      if (depth === 0) { endBracket = i; break; }
    }
  }
  if (endBracket === -1) throw new Error(`Could not find matching ']' for ${varName}`);

  let arrayText = src.substring(startBracket, endBracket + 1);
  // Strip single-line JS comments (// ...) that break JSON.parse
  arrayText = arrayText.replace(/\/\/[^\n\r]*/g, '');
  // Strip trailing commas before ] (e.g. ",\n]")
  arrayText = arrayText.replace(/,\s*(\])/g, '$1');
  return JSON.parse(arrayText);
}

/** Escape a string value for SQL (double any single-quotes). */
function esc(str) {
  return String(str).replace(/'/g, "''");
}

// ── Read Data ────────────────────────────────────────────────────────

const dataDir = path.join(__dirname, '..', 'src', 'data');

const stops       = extractArray(path.join(dataDir, 'stops.js'),  'stops');
const routes      = extractArray(path.join(dataDir, 'routes.js'), 'routes');
const initialBuses = extractArray(path.join(dataDir, 'buses.js'), 'initialBuses');

console.log(`Read ${stops.length} stops, ${routes.length} routes, ${initialBuses.length} buses`);

// Build a quick lookup: route_id → path array
const routePathMap = {};
for (const r of routes) {
  routePathMap[r.id] = r.path;
}

// ── Generate SQL ─────────────────────────────────────────────────────

const lines = [];

lines.push('BEGIN;');
lines.push('');

// 1. stops
lines.push('-- =====================');
lines.push('-- stops');
lines.push('-- =====================');
for (const s of stops) {
  lines.push(
    `INSERT INTO stops (id, name, latitude, longitude) VALUES (${s.id}, '${esc(s.name)}', ${s.lat}, ${s.lng});`
  );
}
lines.push('');

// 2. routes
lines.push('-- =====================');
lines.push('-- routes');
lines.push('-- =====================');
for (const r of routes) {
  const desc = `Route ${r.bus_number}`;
  lines.push(
    `INSERT INTO routes (id, bus_number, color, description) VALUES (${r.id}, '${esc(r.bus_number)}', '${esc(r.color)}', '${esc(desc)}');`
  );
}
lines.push('');

// 3. route_stops
lines.push('-- =====================');
lines.push('-- route_stops');
lines.push('-- =====================');
for (const r of routes) {
  for (let i = 0; i < r.stops.length; i++) {
    const waypointIndex = (r.stopWaypoints && r.stopWaypoints[i] !== undefined)
      ? r.stopWaypoints[i]
      : 'NULL';
    lines.push(
      `INSERT INTO route_stops (route_id, stop_id, stop_order, waypoint_index) VALUES (${r.id}, ${r.stops[i]}, ${i}, ${waypointIndex});`
    );
  }
}
lines.push('');

// 4. route_path_points
lines.push('-- =====================');
lines.push('-- route_path_points');
lines.push('-- =====================');
for (const r of routes) {
  for (let i = 0; i < r.path.length; i++) {
    const [lat, lng] = r.path[i];
    lines.push(
      `INSERT INTO route_path_points (route_id, point_order, latitude, longitude) VALUES (${r.id}, ${i}, ${lat}, ${lng});`
    );
  }
}
lines.push('');

// 5. buses
lines.push('-- =====================');
lines.push('-- buses');
lines.push('-- =====================');
for (const b of initialBuses) {
  const routePath = routePathMap[b.route_id];
  const pathIndex = (b.startPathIndex < routePath.length) ? b.startPathIndex : 0;
  const [lat, lng] = routePath[pathIndex];
  const licensePlate = `KUT-${b.id}`;

  lines.push(
    `INSERT INTO buses (id, route_id, license_plate, status, current_latitude, current_longitude, current_path_index, direction, progress) VALUES (${b.id}, ${b.route_id}, '${esc(licensePlate)}', 'moving', ${lat}, ${lng}, ${pathIndex}, 'forward', 0.0);`
  );
}
lines.push('');

lines.push('COMMIT;');
lines.push('');

// ── Write File ───────────────────────────────────────────────────────

const outPath = path.join(__dirname, '..', 'seed_data.sql');
fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
console.log(`Wrote ${lines.length} lines to ${outPath}`);
