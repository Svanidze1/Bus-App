import { useState, useMemo } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { routesMap } from '../data/routes';

function createBusIcon(busNumber, color, isSelected, isDwelling, destination, isActive) {
  const size = isSelected ? 52 : 44;
  const destLabel = destination ? `→ ${destination.slice(0, 9)}` : '';
  const borderColor = isDwelling ? '#4ade80' : 'white';
  const glowColor = isDwelling ? '#22c55e' : color;
  const dwellingRing = isDwelling
    ? `box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 0 4px ${glowColor}88;`
    : isSelected
    ? `box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 0 3px ${color}66;`
    : `box-shadow: 0 4px 12px rgba(0,0,0,0.4);`;

  const opacity = isActive ? 1 : 0.45;
  const grayscale = isActive ? 'none' : 'grayscale(80%)';

  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative; display:inline-block;">
        <div style="
          width: ${size}px;
          height: ${size}px;
          background: ${color};
          border-radius: 10px;
          border: 2px solid ${borderColor};
          ${dwellingRing}
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          cursor: pointer;
          opacity: ${opacity};
          filter: ${grayscale};
        ">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: ${isSelected ? '20px' : '17px'}; height: ${isSelected ? '20px' : '17px'}; color: white; margin-bottom: 2px;">
            <path d="M18 4H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2v2c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-2h8v2c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-2c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM6.5 14c-.83 0-1.5-.67-1.5-1.5S5.67 11 6.5 11s1.5.67 1.5 1.5S7.33 14 6.5 14zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM19 9H5V6h14v3z"/>
          </svg>
          <span style="color:white;font-size:9px;font-weight:800;font-family:system-ui;line-height:1;text-shadow:0 1px 2px rgba(0,0,0,0.5);">
            ${busNumber}
          </span>
          ${destLabel ? `<span style="color:rgba(255,255,255,0.85);font-size:7px;font-family:system-ui;line-height:1;margin-top:1px;white-space:nowrap;overflow:hidden;max-width:${size-6}px;text-overflow:ellipsis;">${destLabel}</span>` : ''}
        </div>
        ${isDwelling ? `<div style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;background:#4ade80;border-radius:50%;border:1.5px solid white;animation:pulse 1s ease-in-out infinite;"></div>` : ''}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function BusMarker({ bus, isSelected, onSelect }) {
  const [isHovered, setIsHovered] = useState(false);
  const route = routesMap[bus.route_id];
  const color = route ? route.color : '#f59e0b';
  const busNumber = route ? route.bus_number : '?';
  const isDwelling = bus.status === 'dwelling';
  const isActive = bus.isActive !== false;

  // Memoize icon to prevent flicker on coordinate updates
  const icon = useMemo(() => 
    createBusIcon(busNumber, color, isSelected, isDwelling, bus.destination, isActive),
    [busNumber, color, isSelected, isDwelling, bus.destination, isActive]
  );

  return (
    <Marker
      position={[bus.lat, bus.lng]}
      icon={icon}
      eventHandlers={{ 
        click: () => onSelect(bus),
        mouseover: () => setIsHovered(true),
        mouseout: () => setIsHovered(false)
      }}
      zIndexOffset={isDwelling ? 900 : isSelected ? 1000 : 500}
    >
      {isHovered && (
        <Tooltip direction="top" offset={[0, -12]} opacity={0.97} permanent>
          <div style={{ fontSize: '11px' }}>
            <div style={{ fontWeight: 800, marginBottom: '2px' }}>
              Bus {busNumber} 
              {isDwelling && <span style={{ color: '#4ade80', marginLeft: '6px' }}>● AT STOP</span>}
            </div>
            <div style={{ color: '#94a3b8' }}>
              {isDwelling ? `Stopped: ${bus.current_stop || '...'}` : `Next: ${bus.next_stop || '...'}`}
            </div>
          </div>
        </Tooltip>
      )}
    </Marker>
  );
}

