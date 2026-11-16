import { routes, routesMap } from '../data/routes';
import { stops, stopsMap } from '../data/stops';

const WALK_SPEED_KMH = 5;
const BUS_SPEED_KMH = 18;
const BUS_BOARD_MIN = 3; // one-time penalty when boarding a bus (not per-hop)

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildGraph() {
  const graph = {};
  const ensure = id => { if (!graph[id]) graph[id] = []; };

  for (const route of routes) {
    for (let i = 0; i < route.stops.length - 1; i++) {
      const fromId = route.stops[i];
      const toId = route.stops[i + 1];
      const a = stopsMap[fromId];
      const b = stopsMap[toId];
      if (!a || !b) continue;
      const distKm = haversineKm(a.lat, a.lng, b.lat, b.lng);
      const timeMin = (distKm / BUS_SPEED_KMH) * 60; // travel time only — boarding cost added separately
      ensure(fromId); ensure(toId);
      graph[fromId].push({ to: toId, type: 'bus', routeId: route.id, busNumber: route.bus_number, timeMin, distKm });
      graph[toId].push({ to: fromId, type: 'bus', routeId: route.id, busNumber: route.bus_number, timeMin, distKm });
    }
  }

  for (let i = 0; i < stops.length; i++) {
    for (let j = i + 1; j < stops.length; j++) {
      const a = stops[i];
      const b = stops[j];
      const distKm = haversineKm(a.lat, a.lng, b.lat, b.lng);
      const timeMin = (distKm * 1.4 / WALK_SPEED_KMH) * 60;
      ensure(a.id); ensure(b.id);
      graph[a.id].push({ to: b.id, type: 'walk', timeMin, distKm });
      graph[b.id].push({ to: a.id, type: 'walk', timeMin, distKm });
    }
  }

  return graph;
}

// State key encodes stopId + current routeId (null = walking/start)
function stateKey(id, routeId) { return `${id}:${routeId ?? '_'}`; }

function dijkstra(fromId, toId, graph) {
  const dist = {};
  const prev = {};
  const visited = new Set();
  const startKey = stateKey(fromId, null);
  dist[startKey] = 0;
  const queue = [{ cost: 0, id: fromId, routeId: null }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const { cost, id, routeId } = queue.shift();
    const key = stateKey(id, routeId);
    if (visited.has(key)) continue;
    visited.add(key);
    if (id === toId) break;

    for (const edge of graph[id] || []) {
      // Add boarding cost only when switching onto a different bus route
      const boarding = (edge.type === 'bus' && edge.routeId !== routeId) ? BUS_BOARD_MIN : 0;
      const newCost = cost + edge.timeMin + boarding;
      const nextRouteId = edge.type === 'bus' ? edge.routeId : null;
      const nextKey = stateKey(edge.to, nextRouteId);

      if (newCost < (dist[nextKey] ?? Infinity)) {
        dist[nextKey] = newCost;
        prev[nextKey] = { fromId: id, fromRouteId: routeId, edge };
        queue.push({ cost: newCost, id: edge.to, routeId: nextRouteId });
      }
    }
  }

  // Find best arrival state at toId across all possible routeIds
  let bestCost = Infinity, bestKey = null;
  for (const [k, v] of Object.entries(dist)) {
    if (k.startsWith(`${toId}:`) && v < bestCost) { bestCost = v; bestKey = k; }
  }
  if (bestKey === null) return null;

  // Reconstruct path
  const path = [];
  let curKey = bestKey;
  while (true) {
    const entry = prev[curKey];
    if (!entry) break;
    const { fromId: fId, fromRouteId, edge } = entry;
    path.unshift({ from: fId, to: edge.to, ...edge });
    curKey = stateKey(fId, fromRouteId);
  }
  return { path, totalMinutes: bestCost };
}

function groupSegments(path) {
  const segments = [];
  let seg = null;

  for (const step of path) {
    const cont = seg &&
      seg.type === step.type &&
      (step.type === 'walk' || seg.busNumber === step.busNumber);

    if (cont) {
      seg.stops.push(step.to);
      seg.timeMin += step.timeMin;
      seg.distKm += step.distKm ?? 0;
    } else {
      seg = {
        type: step.type,
        busNumber: step.busNumber,
        routeId: step.routeId,
        stops: [step.from, step.to],
        timeMin: step.timeMin,
        distKm: step.distKm ?? 0,
      };
      segments.push(seg);
    }
  }

  return segments;
}

// Fetch road path from OSRM for a walking segment
async function fetchWalkPath(fromStop, toStop) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromStop.lng},${fromStop.lat};${toStop.lng},${toStop.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
      // OSRM returns [lng, lat], Leaflet needs [lat, lng]
      return data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    }
  } catch {}
  return null;
}

// Extract the slice of a bus route's path between two stops
function getBusSegmentPath(route, boardStopId, alightStopId) {
  if (!route?.stopWaypoints || !route?.path) return null;
  const boardIdx = route.stops.indexOf(boardStopId);
  const alightIdx = route.stops.indexOf(alightStopId);
  if (boardIdx === -1 || alightIdx === -1) return null;

  // Handle both forward and reverse direction
  const startPt = route.stopWaypoints[Math.min(boardIdx, alightIdx)];
  const endPt = route.stopWaypoints[Math.max(boardIdx, alightIdx)];
  const slice = route.path.slice(startPt, endPt + 1);

  // Reverse if bus is going backwards through the route
  return boardIdx > alightIdx ? [...slice].reverse() : slice;
}

export async function planTrip(fromId, toId) {
  if (!fromId || !toId || fromId === toId) return null;
  fromId = parseInt(fromId);
  toId = parseInt(toId);

  const graph = buildGraph();
  const result = dijkstra(fromId, toId, graph);

  if (!result) return { error: 'No route found.' };

  const segments = groupSegments(result.path);
  const busSegs = segments.filter(s => s.type === 'bus');
  const walkSegs = segments.filter(s => s.type === 'walk');
  const totalWalkMin = walkSegs.reduce((s, x) => s + x.timeMin, 0);
  const totalWalkM = Math.round(walkSegs.reduce((s, x) => s + x.distKm, 0) * 1000);

  // Attach coords to each segment
  const segmentsWithCoords = await Promise.all(segments.map(async seg => {
    if (seg.type === 'walk') {
      const fromStop = stopsMap[seg.stops[0]];
      const toStop = stopsMap[seg.stops[seg.stops.length - 1]];
      // Fetch real road path from OSRM; fall back to straight line
      const roadCoords = await fetchWalkPath(fromStop, toStop);
      return {
        ...seg,
        coords: roadCoords ?? [
          [fromStop.lat, fromStop.lng],
          [toStop.lat, toStop.lng],
        ],
      };
    } else {
      // Bus: slice route path to only the traveled portion
      const route = routesMap[seg.routeId];
      const busPath = getBusSegmentPath(route, seg.stops[0], seg.stops[seg.stops.length - 1]);
      return {
        ...seg,
        coords: busPath ?? seg.stops.map(id => {
          const s = stopsMap[id];
          return s ? [s.lat, s.lng] : null;
        }).filter(Boolean),
      };
    }
  }));

  return {
    segments: segmentsWithCoords,
    totalMinutes: Math.round(result.totalMinutes),
    totalBusStops: busSegs.reduce((s, x) => s + x.stops.length - 1, 0),
    transfers: Math.max(0, busSegs.length - 1),
    totalWalkMin: Math.round(totalWalkMin),
    totalWalkM,
    fromStop: stopsMap[fromId],
    toStop: stopsMap[toId],
    isWalkOnly: busSegs.length === 0,
  };
}

// Find nearest N stops to a lat/lng
function nearestStops(lat, lng, n = 5) {
  return [...stops]
    .map(s => ({ ...s, distKm: haversineKm(lat, lng, s.lat, s.lng) }))
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, n);
}

export async function planTripFromCoords(fromLat, fromLng, toLat, toLng) {
  if (!fromLat || !fromLng || !toLat || !toLng) return null;

  const graph = buildGraph();
  const fromCandidates = nearestStops(fromLat, fromLng, 5);
  const toCandidates = nearestStops(toLat, toLng, 5);

  // Direct walk fallback — apply 1.4x detour factor since real walking paths
  // are longer than straight-line distance, making transit more competitive
  const directDist = haversineKm(fromLat, fromLng, toLat, toLng);
  const directTime = (directDist * 1.4 / WALK_SPEED_KMH) * 60;

  let bestResult = null;
  let bestTime = directTime;

  for (const fStop of fromCandidates) {
    const walkToMin = (fStop.distKm / WALK_SPEED_KMH) * 60;
    if (walkToMin >= bestTime) continue;
    for (const tStop of toCandidates) {
      if (fStop.id === tStop.id) continue;
      const walkFromMin = (tStop.distKm / WALK_SPEED_KMH) * 60;
      if (walkToMin + walkFromMin >= bestTime) continue;
      const r = dijkstra(fStop.id, tStop.id, graph);
      if (!r) continue;
      const total = walkToMin + r.totalMinutes + walkFromMin;
      if (total < bestTime) {
        bestTime = total;
        bestResult = { r, fStop, tStop, walkToMin, walkFromMin };
      }
    }
  }

  // Build segments
  let allSegments = [];
  let fromStopForWalk = null, toStopForWalk = null;

  if (!bestResult) {
    // Walk only
    allSegments = [{
      type: 'walk', stops: [], timeMin: directTime, distKm: directDist,
    }];
  } else {
    const { r, fStop, tStop, walkToMin, walkFromMin } = bestResult;
    const middleSegments = groupSegments(r.path);
    fromStopForWalk = fStop;
    toStopForWalk = tStop;
    if (fStop.distKm > 0.03) {
      allSegments.push({ type: 'walk', stops: [fStop.id], timeMin: walkToMin, distKm: fStop.distKm, _isFirstWalk: true });
    }
    allSegments.push(...middleSegments);
    if (tStop.distKm > 0.03) {
      allSegments.push({ type: 'walk', stops: [tStop.id], timeMin: walkFromMin, distKm: tStop.distKm, _isLastWalk: true });
    }
  }

  const segmentsWithCoords = await Promise.all(allSegments.map(async (seg, idx) => {
    if (seg.type === 'walk') {
      let fromPt, toPt;
      if (seg._isFirstWalk) {
        fromPt = { lat: fromLat, lng: fromLng };
        toPt = fromStopForWalk;
      } else if (seg._isLastWalk) {
        fromPt = toStopForWalk;
        toPt = { lat: toLat, lng: toLng };
      } else if (!bestResult) {
        fromPt = { lat: fromLat, lng: fromLng };
        toPt = { lat: toLat, lng: toLng };
      } else {
        const fromStop = stopsMap[seg.stops[0]];
        const toStop = stopsMap[seg.stops[seg.stops.length - 1]];
        fromPt = fromStop;
        toPt = toStop;
      }
      const roadCoords = fromPt && toPt ? await fetchWalkPath(fromPt, toPt) : null;
      return {
        ...seg,
        coords: roadCoords ?? (fromPt && toPt ? [[fromPt.lat, fromPt.lng], [toPt.lat, toPt.lng]] : []),
      };
    } else {
      const route = routesMap[seg.routeId];
      const busPath = getBusSegmentPath(route, seg.stops[0], seg.stops[seg.stops.length - 1]);
      return {
        ...seg,
        coords: busPath ?? seg.stops.map(id => {
          const s = stopsMap[id];
          return s ? [s.lat, s.lng] : null;
        }).filter(Boolean),
      };
    }
  }));

  const busSegs = allSegments.filter(s => s.type === 'bus');
  const walkSegs = allSegments.filter(s => s.type === 'walk');
  const totalWalkMin = walkSegs.reduce((s, x) => s + x.timeMin, 0);
  const totalWalkM = Math.round(walkSegs.reduce((s, x) => s + x.distKm, 0) * 1000);

  return {
    segments: segmentsWithCoords,
    totalMinutes: Math.round(bestTime),
    totalBusStops: busSegs.reduce((s, x) => s + x.stops.length - 1, 0),
    transfers: Math.max(0, busSegs.length - 1),
    totalWalkMin: Math.round(totalWalkMin),
    totalWalkM,
    fromPoint: { lat: fromLat, lng: fromLng },
    toPoint: { lat: toLat, lng: toLng },
    isWalkOnly: busSegs.length === 0,
  };
}
