import { useState, useEffect } from 'react';
import { routesMap } from '../data/routes';
import { stopsMap } from '../data/stops';

const TICK_MS = 100;
const PROGRESS_PER_TICK = 0.045; // ~15 km/h city bus speed
const DWELL_TICKS = 50;          // 5 seconds stopped at each stop
const SECS_PER_SEGMENT = (TICK_MS / 1000) / PROGRESS_PER_TICK;
const DWELL_SECS = (DWELL_TICKS * TICK_MS) / 1000;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function computeETAs(pathIndex, progress, direction, route) {
  const { stopWaypoints, stops: stopIds, path } = route;
  const maxSegment = path.length - 2;
  const remainingOnSegment = (1 - progress) * SECS_PER_SEGMENT;

  return stopWaypoints.map((wp, i) => {
    let segsAway;
    if (direction === 1) {
      if (wp > pathIndex) segsAway = wp - pathIndex;
      else if (wp === pathIndex) segsAway = 0;
      else segsAway = (maxSegment - pathIndex) + wp;
    } else {
      if (wp < pathIndex) segsAway = pathIndex - wp;
      else if (wp === pathIndex) segsAway = 0;
      else segsAway = pathIndex + (maxSegment - wp);
    }

    const intermediateStops = stopWaypoints.filter(other => {
      if (direction === 1) {
        if (wp > pathIndex) return other > pathIndex && other < wp;
        return other > pathIndex || other < wp;
      } else {
        if (wp < pathIndex) return other < pathIndex && other > wp;
        return other < pathIndex || other > wp;
      }
    }).length;

    const etaSeconds = segsAway === 0
      ? 0
      : remainingOnSegment + (segsAway - 1) * SECS_PER_SEGMENT + intermediateStops * DWELL_SECS;

    const stopId = stopIds[i];
    const stop = stopsMap[stopId];
    return {
      stopId,
      name: stop ? stop.name : `Stop ${stopId}`,
      etaSeconds: Math.max(0, Math.round(etaSeconds)),
      etaMinutes: Math.max(0, Math.round(etaSeconds / 60)),
      isTerminus: i === stopWaypoints.length - 1,
    };
  }).sort((a, b) => a.etaSeconds - b.etaSeconds);
}

function initBus(bus) {
  const route = routesMap[bus.route_id];
  const stopIds = route?.stops ?? [];
  const terminus = stopIds.length > 0 ? stopsMap[stopIds[stopIds.length - 1]] : null;
  const startPathIndex = bus.startPathIndex ?? 0;
  const wp = route?.stopWaypoints ?? [];
  let startStopIdx = 0;
  for (let i = 0; i < wp.length; i++) {
    if (wp[i] <= startPathIndex) startStopIdx = i;
  }
  const pt = route?.path?.[startPathIndex] ?? route?.path?.[0];
  return {
    ...bus,
    lat: pt?.[0] ?? 42.2662,
    lng: pt?.[1] ?? 42.7180,
    pathIndex: startPathIndex,
    progress: 0,
    direction: 1,
    status: 'moving',
    dwellTicks: 0,
    stopIndex: startStopIdx,
    etaToStops: [],
    destination: terminus ? terminus.name : '',
    current_stop: stopsMap[stopIds[startStopIdx]]?.name ?? '',
    next_stop: stopsMap[stopIds[startStopIdx + 1] ?? stopIds[0]]?.name ?? '',
  };
}

export function useBusSimulation(initialBuses) {
  const [buses, setBuses] = useState(() => initialBuses.map(b => initBus(b)));

  useEffect(() => {
    const interval = setInterval(() => {
      setBuses(prev =>
        prev.map(bus => {
          // Inactive buses don't move
          if (bus.isActive === false) return bus;

          const route = routesMap[bus.route_id];
          if (!route) return bus;

          const { path, stops: stopIds, stopWaypoints } = route;
          const maxSegmentIndex = path.length - 2;

          // --- DWELLING ---
          if (bus.status === 'dwelling') {
            const newDwell = bus.dwellTicks - 1;
            return newDwell <= 0
              ? { ...bus, status: 'moving', dwellTicks: 0 }
              : { ...bus, dwellTicks: newDwell };
          }

          // --- MOVING ---
          let newProgress = bus.progress + PROGRESS_PER_TICK;
          let newPathIndex = bus.pathIndex;
          let newDirection = bus.direction ?? 1;
          let newStatus = 'moving';
          let newDwellTicks = 0;
          let newStopIndex = bus.stopIndex;

          if (newProgress >= 1) {
            newProgress = 0;
            newPathIndex = bus.pathIndex + newDirection;

            // Hit end → reverse direction
            if (newPathIndex > maxSegmentIndex) {
              newDirection = -1;
              newPathIndex = maxSegmentIndex - 1;
            }
            // Hit start → reverse direction
            if (newPathIndex < 0) {
              newDirection = 1;
              newPathIndex = 1;
            }

            // Check stop waypoint arrival
            const wpIdx = stopWaypoints.indexOf(newPathIndex);
            if (wpIdx !== -1) {
              newStatus = 'dwelling';
              newDwellTicks = DWELL_TICKS;
              newStopIndex = wpIdx;
            }
          }

          // Interpolate position — swap from/to when going in reverse
          const fromPt = newDirection === 1 ? path[newPathIndex] : path[newPathIndex + 1] ?? path[newPathIndex];
          const toPt = newDirection === 1 ? path[Math.min(newPathIndex + 1, path.length - 1)] : path[newPathIndex];
          const lat = lerp(fromPt[0], toPt[0], newProgress);
          const lng = lerp(fromPt[1], toPt[1], newProgress);

          const currentStopId = stopIds[newStopIndex];
          const nextStopIdx = newDirection === 1
            ? (newStopIndex + 1) % stopIds.length
            : Math.max(0, newStopIndex - 1);
          const nextStopId = stopIds[nextStopIdx];

          // Update destination label to reflect current direction
          const terminusIdx = newDirection === 1 ? stopIds.length - 1 : 0;
          const destination = stopsMap[stopIds[terminusIdx]]?.name ?? '';

          const etaToStops = computeETAs(newPathIndex, newProgress, newDirection, route);

          return {
            ...bus,
            lat,
            lng,
            pathIndex: newPathIndex,
            progress: newProgress,
            direction: newDirection,
            status: newStatus,
            dwellTicks: newDwellTicks,
            stopIndex: newStopIndex,
            etaToStops,
            destination,
            current_stop: stopsMap[currentStopId]?.name ?? bus.current_stop,
            next_stop: stopsMap[nextStopId]?.name ?? bus.next_stop,
            stops_remaining: newDirection === 1
              ? stopIds.length - newStopIndex - 1
              : newStopIndex,
          };
        })
      );
    }, TICK_MS);

    return () => clearInterval(interval);
  }, []);

  return buses;
}
