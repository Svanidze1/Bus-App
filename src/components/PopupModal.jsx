import { routes, routesMap } from '../data/routes';
import { stopsMap } from '../data/stops';

function formatTime(seconds) {
  if (seconds <= 0) return 'Arriving';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getBusJitter(busId) {
  // Simple deterministic jitter based on ID
  const idStr = String(busId || '');
  const num = parseInt(idStr.replace(/\D/g, '') || '0');
  return (num % 15) - 5; // -5 to +10 seconds jitter
}

function getArrivingBuses(stop, buses) {
  const arriving = [];

  for (const route of routes) {
    if (!route.stops.includes(stop.id)) continue;

    const routeBuses = buses.filter(b => b.route_id === route.id);
    const stopPositionInRoute = route.stops.indexOf(stop.id);

    for (const liveBus of routeBuses) {
      const busStopIndex = liveBus.stopIndex ?? 0;
      const diff = stopPositionInRoute - busStopIndex;
      const stopsAway = diff >= 0 ? diff : route.stops.length + diff;

      const jitter = getBusJitter(liveBus.id);
      const totalSeconds = Math.max(5, (stopsAway * 180) - (liveBus.progress * 180) + jitter);

      arriving.push({
        busId: liveBus.id,
        busNumber: route.bus_number,
        routeId: route.id,
        color: route.color,
        seconds: totalSeconds,
        isActive: liveBus.isActive !== false,
      });
    }

    if (routeBuses.length === 0) {
      arriving.push({
        busId: null,
        busNumber: route.bus_number,
        routeId: route.id,
        color: route.color,
        seconds: (stopPositionInRoute + 1) * 180,
        isActive: false,
      });
    }
  }

  return arriving.sort((a, b) => a.seconds - b.seconds);
}

export default function PopupModal({ type, stop, bus, buses, onClose, onSelectBus, isMobile }) {
  if (!type) return null;

  const handleOverlayClick = (e) => {
    if (e.target.classList.contains('popup-overlay')) {
      onClose();
    }
  };

  if (type === 'stop' && stop) {
    const arriving = getArrivingBuses(stop, buses);

    return (
      <div className="popup-overlay !flex !flex-col !justify-end md:!flex-row md:!justify-end" onClick={handleOverlayClick}>
        <div className={`popup-modal !w-full !max-w-full md:!w-[380px] md:!max-w-[85vw] ${isMobile ? '!h-[60vh] rounded-t-[2rem] border-t border-slate-700/60 popup-slide-up' : '!h-full border-l border-slate-700/60'}`} style={isMobile ? { zIndex: 1002 } : {}}>
          <button className="popup-close" onClick={onClose}>
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="popup-header">
            <div className="popup-icon stop-icon">🟢</div>
            <div>
              <h2 className="popup-title">{stop.name}</h2>
              <p className="popup-subtitle">Stop #{stop.id}</p>
            </div>
          </div>

          <div className="popup-content">
            <h3 className="popup-section-title">Buses through this stop</h3>
            {arriving.length === 0 ? (
              <p className="popup-empty">No buses serve this stop.</p>
            ) : (
              <div className="popup-list">
                {arriving.map((item, i) => (
                  <button
                    key={`${item.routeId}-${item.busId || i}`}
                    className="popup-bus-item"
                    onClick={() => {
                      if (item.busId) {
                        const liveBus = buses.find(b => b.id === item.busId);
                        if (liveBus && onSelectBus) onSelectBus(liveBus);
                      }
                    }}
                  >
                    <div className="popup-bus-left">
                      <div className="popup-bus-badge" style={{ background: item.color }}>
                        {item.busNumber}
                      </div>
                      <div>
                        <p className="popup-bus-name">Bus {item.busNumber}</p>
                        <p className="popup-bus-status" style={{ color: item.isActive ? '#22c55e' : '#ef4444' }}>
                          {item.isActive ? '● Active' : '● Inactive'}
                        </p>
                      </div>
                    </div>
                    <div className="popup-bus-right">
                      <p className={`popup-eta ${item.seconds <= 180 ? 'eta-soon' : item.seconds <= 420 ? 'eta-mid' : ''}`}>
                        {formatTime(item.seconds)}
                      </p>
                      <p className="popup-eta-label">arriving</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (type === 'bus' && bus) {
    const route = routesMap[bus.route_id];
    if (!route) return null;

    const stopIndex = bus.stopIndex ?? 0;
    const firstStop = stopsMap[route.stops[0]];
    const lastStop = stopsMap[route.stops[route.stops.length - 1]];
    const stopsRemaining = route.stops.length - stopIndex - 1;

    const jitter = getBusJitter(bus.id);
    const timeLeftInSeconds = Math.max(5, 180 - (bus.progress * 180) + jitter);
    const isActive = bus.isActive !== false;

    return (
      <div className="popup-overlay !flex !flex-col !justify-end md:!flex-row md:!justify-end" onClick={handleOverlayClick}>
        <div className={`popup-modal !w-full !max-w-full md:!w-[380px] md:!max-w-[85vw] ${isMobile ? '!h-[60vh] rounded-t-[2rem] border-t border-slate-700/60 popup-slide-up' : '!h-full border-l border-slate-700/60'}`} style={isMobile ? { zIndex: 1002 } : {}}>
          <button className="popup-close" onClick={onClose}>
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="popup-header" style={{ borderLeft: `4px solid ${route.color}` }}>
            <div className="popup-icon" style={{ background: route.color }}>
              {route.bus_number}
            </div>
            <div>
              <h2 className="popup-title">Bus #{route.bus_number}</h2>
              <p className="popup-subtitle" style={{ color: isActive ? '#22c55e' : '#ef4444' }}>
                {isActive ? '● Active' : '● Inactive'} — ID: {bus.id}
              </p>
            </div>
          </div>

          <div className="p-4 border-b border-slate-700 bg-slate-800/20">
            <div className="popup-route-info mb-0">
              <div className="popup-route-endpoint">
                <span className="popup-route-label">From</span>
                <span className="popup-route-name">{firstStop?.name || 'Unknown'}</span>
              </div>
              <div className="popup-route-arrow">→</div>
              <div className="popup-route-endpoint">
                <span className="popup-route-label">To</span>
                <span className="popup-route-name">{lastStop?.name || 'Unknown'}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="popup-section-title">Full Route Stop List</h3>
            <div className="relative">
              <div
                className="absolute left-[19px] top-5 bottom-5 w-0.5"
                style={{ background: `${route.color}44` }}
              ></div>

              <div className="space-y-2">
                {route.stops.map((stopId, idx) => {
                  const stop = stopsMap[stopId];
                  const isCurrent = idx === stopIndex;
                  const isPast = idx < stopIndex;
                  const isNext = idx === stopIndex + 1;

                  return (
                    <div
                      key={`${stopId}-${idx}`}
                      className={`flex items-center gap-3 relative py-2 px-3 rounded-xl transition-all ${isCurrent ? 'bg-slate-700/70 border border-slate-600/50' : 'border border-transparent'
                        } ${isPast ? 'stop-item-passed' : ''}`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex-shrink-0 border-2 flex items-center justify-center z-10 ${isPast ? 'stop-dot-passed' : ''
                          }`}
                        style={{
                          background: isCurrent ? route.color : isPast ? '#334155' : '#1e293b',
                          borderColor: isCurrent ? route.color : isPast ? '#475569' : '#334155',
                        }}
                      >
                        {isCurrent && (
                          <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                        )}
                        {isPast && (
                          <div className="text-[10px] text-white">✓</div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isCurrent ? 'text-white' : isPast ? 'text-slate-500' : 'text-slate-300'
                          }`}>
                          {stop ? stop.name : `Stop ${stopId}`}
                        </p>
                        {isCurrent && (
                          <p className="text-[10px] uppercase font-bold tracking-tight" style={{ color: route.color }}>
                            Current Location
                          </p>
                        )}
                        {isNext && (
                          <p className="text-[10px] uppercase font-bold text-amber-500 tracking-tight">
                            Next Arrival
                          </p>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 flex-shrink-0 font-mono">
                        {isCurrent ? '🚌' : isPast ? 'PAST' : `+${(idx - stopIndex) * 3}m`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-900/50 border-t border-slate-700">
            <div className="grid grid-cols-2 gap-3">
              <div className="stat-card-premium stat-card-blue">
                <span className="stat-icon-bg">⏱️</span>
                <span className="stat-label-mini">Time to Next</span>
                <span className="stat-value-large">
                  {formatTime(timeLeftInSeconds)}
                </span>
                <p className="text-[10px] text-blue-300/60 font-medium mt-1 uppercase tracking-tighter">Live Estimate</p>
              </div>
              <div className="stat-card-premium stat-card-teal">
                <span className="stat-icon-bg">📍</span>
                <span className="stat-label-mini">Stops Left</span>
                <span className="stat-value-large">
                  {stopsRemaining}
                </span>
                <p className="text-[10px] text-teal-300/60 font-medium mt-1 uppercase tracking-tighter">To Terminus</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
