import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap, Polyline, CircleMarker, Tooltip, useMapEvents, Marker } from 'react-leaflet';
import L from 'leaflet';
import StopMarker from './StopMarker';
import BusMarker from './BusMarker';
import RoutePolyline from './RoutePolyline';
import { stops, stopsMap } from '../data/stops';
import { routesMap } from '../data/routes';

const KUTAISI_CENTER = [42.2662, 42.7180];

function MapController({ flyTo, onMapReady, tripPlan }) {
  const map = useMap();

  useEffect(() => {
    if (onMapReady) onMapReady(map);
  }, [map, onMapReady]);

  useEffect(() => {
    if (flyTo) {
      map.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom || 17, { duration: 1.2 });
    }
  }, [flyTo, map]);

  // Fit map to trip plan bounds
  useEffect(() => {
    if (!tripPlan?.segments?.length) return;
    const allCoords = tripPlan.segments.flatMap(s => s.coords ?? []);
    if (allCoords.length < 2) return;
    try {
      map.fitBounds(allCoords, { padding: [60, 60], maxZoom: 16, duration: 1 });
    } catch {}
  }, [tripPlan, map]);

  return null;
}

// Draw the active trip plan: walking lines (dashed) + bus route highlights
function TripPlanOverlay({ tripPlan }) {
  if (!tripPlan?.segments) return null;

  return (
    <>
      {/* Bus segments first (below) */}
      {tripPlan.segments.map((seg, idx) => {
        if (seg.type !== 'bus' || !seg.coords || seg.coords.length < 2) return null;
        const route = routesMap[seg.routeId];
        const color = route?.color ?? '#64748b';
        return (
          <Polyline
            key={`bus-${idx}`}
            positions={seg.coords}
            pathOptions={{ color, weight: 6, opacity: 0.9 }}
          />
        );
      })}

      {/* Walk segments on top */}
      {tripPlan.segments.map((seg, idx) => {
        if (seg.type !== 'walk' || !seg.coords || seg.coords.length < 2) return null;
        return (
          <Polyline
            key={`walk-${idx}`}
            positions={seg.coords}
            pathOptions={{ color: '#ef4444', weight: 3, opacity: 1, dashArray: '10 8' }}
          />
        );
      })}

      {/* Only highlight key stops: start, end, and transfer points */}
      {(() => {
        const keyStops = [];
        const segs = tripPlan.segments;
        segs.forEach((seg, segIdx) => {
          const firstId = seg.stops[0];
          const lastId = seg.stops[seg.stops.length - 1];
          const isOverallStart = segIdx === 0;
          const isOverallEnd = segIdx === segs.length - 1;

          if (isOverallStart) {
            keyStops.push({ stopId: firstId, label: 'Start', color: '#60a5fa', radius: 10 });
          } else {
            // Board point (transfer)
            keyStops.push({ stopId: firstId, label: 'Transfer', color: '#fbbf24', radius: 8 });
          }

          if (isOverallEnd) {
            keyStops.push({ stopId: lastId, label: 'Destination', color: '#4ade80', radius: 10 });
          } else {
            // Alight point (transfer)
            keyStops.push({ stopId: lastId, label: 'Transfer', color: '#fbbf24', radius: 8 });
          }
        });

        // Deduplicate by stopId
        const seen = new Set();
        return keyStops.filter(k => {
          if (seen.has(k.stopId)) return false;
          seen.add(k.stopId);
          return true;
        }).map(({ stopId, label, color, radius }) => {
          const stop = stopsMap[stopId];
          if (!stop) return null;
          return (
            <CircleMarker
              key={`key-stop-${stopId}`}
              center={[stop.lat, stop.lng]}
              radius={radius}
              pathOptions={{ color, fillColor: color, fillOpacity: 1, weight: 2 }}
            >
              <Tooltip direction="top" opacity={0.95} permanent={label === 'Start' || label === 'Destination'}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                  {label === 'Start' ? '🔵 ' : label === 'Destination' ? '🟢 ' : '🔄 '}
                  {stop.name}
                </span>
              </Tooltip>
            </CircleMarker>
          );
        });
      })()}
    </>
  );
}

function MapClickHandler({ pickMode, onMapClick }) {
  useMapEvents({
    click(e) {
      if (pickMode) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

function makePinIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50% 50% 50% 0;background:${color};border:2px solid white;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 14],
  });
}

export default function MapView({
  buses,
  visibleBuses,
  visibleStops,
  selectedBus,
  selectedStop,
  onSelectBus,
  onSelectStop,
  flyTo,
  onMapReady,
  tripPlan,
  pickMode,
  onMapClick,
  tripFrom,
  tripTo,
  filterMode,
  isMobile,
}) {
  // Determine which route polylines to show
  const routesToShow = [];
  if (filterMode) {
    const seenRoutes = new Set();
    for (const bus of visibleBuses) {
      if (!seenRoutes.has(bus.route_id)) {
        seenRoutes.add(bus.route_id);
        const route = routesMap[bus.route_id];
        if (route) routesToShow.push(route);
      }
    }
  } else if (selectedBus) {
    const route = routesMap[selectedBus.route_id];
    if (route) routesToShow.push(route);
  }

  return (
    <div style={{ width: '100%', height: '100%', cursor: pickMode ? 'crosshair' : undefined }}>
    <MapContainer
      center={KUTAISI_CENTER}
      zoom={14}
      style={{ width: '100%', height: '100%' }}
      zoomControl={!isMobile}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapController flyTo={flyTo} onMapReady={onMapReady} tripPlan={tripPlan} />

      {/* Pick mode cursor */}
      {pickMode && <MapClickHandler pickMode={pickMode} onMapClick={onMapClick} />}

      {/* Custom from/to pin markers */}
      {tripFrom?.type === 'point' && (
        <Marker
          position={[tripFrom.lat, tripFrom.lng]}
          icon={makePinIcon('#60a5fa')}
          zIndexOffset={1000}
        />
      )}
      {tripTo?.type === 'point' && (
        <Marker
          position={[tripTo.lat, tripTo.lng]}
          icon={makePinIcon('#4ade80')}
          zIndexOffset={1000}
        />
      )}

      {/* Active trip plan overlay */}
      {tripPlan && <TripPlanOverlay tripPlan={tripPlan} />}

      {/* Route polylines */}
      {routesToShow.map(route => (
        <RoutePolyline key={route.id} route={route} />
      ))}

      {/* Bus stops */}
      {visibleStops.map(stop => (
        <StopMarker
          key={stop.id}
          stop={stop}
          isSelected={selectedStop?.id === stop.id}
          onSelect={onSelectStop}
        />
      ))}

      {/* Live buses */}
      {visibleBuses.map(bus => (
        <BusMarker
          key={bus.id}
          bus={bus}
          isSelected={selectedBus?.id === bus.id}
          onSelect={onSelectBus}
        />
      ))}
    </MapContainer>
    </div>
  );
}
