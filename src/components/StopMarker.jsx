import { useState, useMemo } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';

function createStopIcon(isSelected) {
  const size = isSelected ? 24 : 18;
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${isSelected ? '#22c55e' : '#4ade80'};
        border: 3px solid ${isSelected ? '#fff' : '#16a34a'};
        border-radius: 50%;
        box-shadow: 0 0 0 ${isSelected ? '5px' : '2px'} rgba(34,197,94,0.35), 0 2px 8px rgba(0,0,0,0.3);
        transition: all 0.2s ease;
        cursor: pointer;
      "></div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function StopMarker({ stop, isSelected, onSelect }) {
  const [isHovered, setIsHovered] = useState(false);
  
  // Memoize icon
  const icon = useMemo(() => createStopIcon(isSelected), [isSelected]);

  return (
    <Marker
      position={[stop.lat, stop.lng]}
      icon={icon}
      eventHandlers={{
        click: () => onSelect(stop),
        mouseover: () => setIsHovered(true),
        mouseout: () => setIsHovered(false)
      }}
    >
      {isHovered && (
        <Tooltip direction="top" offset={[0, -12]} opacity={0.95} permanent>
          <span style={{ fontSize: '12px', fontWeight: 600 }}>{stop.name}</span>
        </Tooltip>
      )}
    </Marker>
  );
}
