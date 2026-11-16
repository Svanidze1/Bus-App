const fs = require('fs');
const path = require('path');

// ── Extract array from ES module source ─────────────────────────────
function extractArray(filePath, varName) {
  const src = fs.readFileSync(filePath, 'utf-8');
  const tag = `export const ${varName}`;
  const idx = src.indexOf(tag);
  if (idx === -1) throw new Error(`Could not find "${tag}" in ${filePath}`);

  const startBracket = src.indexOf('[', idx);
  if (startBracket === -1) throw new Error(`Could not find opening '[' for ${varName}`);

  let depth = 0, endBracket = -1;
  for (let i = startBracket; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') { depth--; if (depth === 0) { endBracket = i; break; } }
  }
  if (endBracket === -1) throw new Error(`Could not find matching ']' for ${varName}`);

  let arrayText = src.substring(startBracket, endBracket + 1);
  // Strip JS single-line comments
  arrayText = arrayText.replace(/\/\/[^\n\r]*/g, '');
  // Strip trailing commas before ]
  arrayText = arrayText.replace(/,\s*(\])/g, '$1');
  return JSON.parse(arrayText);
}

// ── Read and write ──────────────────────────────────────────────────
const dataDir = path.join(__dirname, '..', 'src', 'data');

const stops = extractArray(path.join(dataDir, 'stops.js'), 'stops');
const routes = extractArray(path.join(dataDir, 'routes.js'), 'routes');
const buses = extractArray(path.join(dataDir, 'buses.js'), 'initialBuses');

fs.writeFileSync(path.join(dataDir, 'stops.json'), JSON.stringify(stops, null, 2), 'utf-8');
fs.writeFileSync(path.join(dataDir, 'routes.json'), JSON.stringify(routes, null, 2), 'utf-8');
fs.writeFileSync(path.join(dataDir, 'buses.json'), JSON.stringify(buses, null, 2), 'utf-8');

console.log(`Created stops.json  (${stops.length} entries)`);
console.log(`Created routes.json (${routes.length} entries)`);
console.log(`Created buses.json  (${buses.length} entries)`);
