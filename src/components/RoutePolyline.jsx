import { Polyline } from 'react-leaflet';

export default function RoutePolyline({ route }) {
  if (!route || !route.path) return null;

  return (
    <>
      {/* Shadow/glow line */}
      <Polyline
        positions={route.path}
        pathOptions={{
          color: route.color,
          weight: 8,
          opacity: 0.2,
        }}
      />
      {/* Main line */}
      <Polyline
        positions={route.path}
        pathOptions={{
          color: route.color,
          weight: 4,
          opacity: 0.9,
          dashArray: null,
        }}
      />
    </>
  );
}
