import { routes, routesMap } from '../data/routes';

function getArrivingBuses(stop, buses) {
  const arriving = [];

  for (const route of routes) {
    if (!route.stops.includes(stop.id)) continue;

    const liveBus = buses.find(b => b.route_id === route.id);
    if (!liveBus) continue;

    const eta = liveBus.etaToStops?.find(e => e.stopId === stop.id);
    // Bus is dwelling at THIS specific stop
    const isDwellingHere =
      liveBus.status === 'dwelling' &&
      route.stops[liveBus.stopIndex] === stop.id;

    arriving.push({
      busNumber: route.bus_number,
      routeId: route.id,
      color: route.color,
      etaSeconds: isDwellingHere ? 0 : (eta?.etaSeconds ?? 999),
      etaMinutes: isDwellingHere ? 0 : (eta?.etaMinutes ?? 0),
      isDwellingHere,
      dwellTicksLeft: liveBus.dwellTicks ?? 0,
      bus: liveBus,
    });
  }

  return arriving.sort((a, b) => a.etaSeconds - b.etaSeconds);
}

export default function StopDetailPanel({ stop, buses, onClose, onSelectBus, onSetTripFrom, onSetTripTo, tripFromId, tripToId }) {
  if (!stop) return null;

  const arriving = getArrivingBuses(stop, buses);
  const isFrom = String(tripFromId) === String(stop.id);
  const isTo = String(tripToId) === String(stop.id);

  return (
    <div className="panel-slide-in flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-slate-700">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-green-400 shadow-lg shadow-green-400/50"></div>
            <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">Bus Stop</span>
          </div>
          <h2 className="text-xl font-bold text-white leading-tight">{stop.name}</h2>
          <p className="text-sm text-slate-400 mt-0.5">Stop #{stop.id}</p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-700"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Trip planner quick-set buttons */}
      {(onSetTripFrom || onSetTripTo) && (
        <div className="px-4 py-3 border-b border-slate-700/50 flex gap-2">
          <button
            onClick={() => onSetTripFrom?.(stop.id)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              isFrom
                ? 'bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-blue-500/30 hover:text-blue-300'
            }`}
          >
            {isFrom ? '✓ Start' : 'Set as Start'}
          </button>
          <button
            onClick={() => onSetTripTo?.(stop.id)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              isTo
                ? 'bg-green-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-green-500/30 hover:text-green-300'
            }`}
          >
            {isTo ? '✓ Destination' : 'Set as Destination'}
          </button>
        </div>
      )}

      {/* Coordinates */}
      <div className="px-5 py-2 border-b border-slate-700/50">
        <div className="flex gap-4 text-xs text-slate-500">
          <span>Lat: {stop.lat.toFixed(4)}</span>
          <span>Lng: {stop.lng.toFixed(4)}</span>
        </div>
      </div>

      {/* Arriving buses */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Live Arrivals
        </h3>

        {arriving.length === 0 ? (
          <p className="text-slate-500 text-sm">No buses serve this stop.</p>
        ) : (
          <div className="space-y-2">
            {arriving.map(({ busNumber, routeId, color, etaMinutes, etaSeconds, isDwellingHere, dwellTicksLeft, bus }) => (
              <button
                key={routeId}
                onClick={() => onSelectBus(bus)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-700/50 hover:bg-slate-700 transition-colors border border-slate-600/50 hover:border-slate-500"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-lg relative flex-shrink-0"
                    style={{ background: color }}
                  >
                    {busNumber}
                    {isDwellingHere && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border border-slate-800 animate-pulse"></div>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-white font-semibold text-sm">Bus {busNumber}</p>
                    {isDwellingHere ? (
                      <p className="text-green-400 text-xs font-medium">
                        ● AT STOP — departing in ~{Math.round(dwellTicksLeft * 0.1)}s
                      </p>
                    ) : (
                      <p className="text-slate-400 text-xs">
                        {routesMap[routeId]?.stops.length} stops on route
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  {isDwellingHere ? (
                    <div>
                      <p className="text-green-400 font-bold text-sm">HERE</p>
                      <p className="text-xs text-slate-500">now</p>
                    </div>
                  ) : (
                    <div>
                      <p className={`text-lg font-bold leading-tight ${
                        etaMinutes <= 2 ? 'text-green-400' :
                        etaMinutes <= 6 ? 'text-amber-400' :
                        'text-slate-300'
                      }`}>
                        {etaMinutes === 0 ? '<1' : etaMinutes}
                        <span className="text-xs font-normal text-slate-400 ml-0.5">min</span>
                      </p>
                      <p className="text-xs text-slate-500">arriving</p>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Live indicator */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
          <span>Real-time — updates every 100ms</span>
        </div>
      </div>
    </div>
  );
}
