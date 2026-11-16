import { routesMap } from '../data/routes';
import { stopsMap } from '../data/stops';

export default function BusDetailPanel({ bus, onClose }) {
  if (!bus) return null;

  const route = routesMap[bus.route_id];
  if (!route) return null;

  const stopIndex = bus.stopIndex ?? 0;
  const isDwelling = bus.status === 'dwelling';
  const etaToStops = bus.etaToStops ?? [];

  // Build per-stop ETA lookup from etaToStops
  const etaMap = Object.fromEntries(etaToStops.map(e => [e.stopId, e]));

  return (
    <div className="panel-slide-in flex flex-col h-full">
      {/* Header */}
      <div
        className="p-4 border-b border-slate-700"
        style={{ background: `linear-gradient(135deg, ${route.color}22, transparent)` }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold text-white shadow-lg flex-shrink-0"
              style={{ background: route.color }}
            >
              {route.bus_number}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: route.color }}>
                Bus Route {route.bus_number}
              </p>
              <h2 className="text-lg font-bold text-white leading-tight">Bus #{route.bus_number}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-700 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Status badge */}
        <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl ${isDwelling ? 'bg-green-500/15 border border-green-500/30' : 'bg-amber-500/10 border border-amber-500/20'}`}>
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isDwelling ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`}></div>
          <div>
            <p className={`text-xs font-bold uppercase tracking-wide ${isDwelling ? 'text-green-400' : 'text-amber-400'}`}>
              {isDwelling ? 'At Stop' : 'In Transit'}
            </p>
            <p className="text-xs text-slate-400 leading-tight">
              {isDwelling
                ? `Stopped at ${bus.current_stop} — departing soon`
                : `En route to ${bus.next_stop}`}
            </p>
          </div>
        </div>

        {/* Destination */}
        {bus.destination && (
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            <span>Destination: <span className="text-slate-200 font-medium">{bus.destination}</span></span>
          </div>
        )}
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-px bg-slate-700 border-b border-slate-700">
        <div className="bg-slate-800 p-3 text-center">
          <p className="text-lg font-bold text-white">{route.stops.length}</p>
          <p className="text-xs text-slate-500">Total Stops</p>
        </div>
        <div className="bg-slate-800 p-3 text-center">
          <p className="text-lg font-bold" style={{ color: route.color }}>{bus.stops_remaining ?? 0}</p>
          <p className="text-xs text-slate-500">Remaining</p>
        </div>
        <div className="bg-slate-800 p-3 text-center">
          {(() => {
            const termEta = etaToStops.find(e => e.isTerminus);
            return (
              <>
                <p className="text-lg font-bold text-white">{termEta ? termEta.etaMinutes : '—'}</p>
                <p className="text-xs text-slate-500">Min to End</p>
              </>
            );
          })()}
        </div>
      </div>

      {/* Full route stop list with ETAs */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Route Schedule — {route.stops.length} Stops
        </h3>

        <div className="relative">
          <div
            className="absolute left-[19px] top-5 bottom-5 w-0.5"
            style={{ background: `${route.color}33` }}
          ></div>

          <div className="space-y-0.5">
            {route.stops.map((stopId, idx) => {
              const stop = stopsMap[stopId];
              const isCurrent = idx === stopIndex;
              const isPast = idx < stopIndex;
              const isNext = idx === stopIndex + 1;
              const isTerminus = idx === route.stops.length - 1;
              const eta = etaMap[stopId];

              return (
                <div
                  key={stopId}
                  className={`flex items-center gap-3 relative py-1.5 px-2 rounded-lg transition-colors ${isCurrent ? 'bg-slate-700/70' : 'hover:bg-slate-700/30'}`}
                >
                  {/* Timeline dot */}
                  <div
                    className="w-5 h-5 rounded-full flex-shrink-0 border-2 flex items-center justify-center z-10"
                    style={{
                      background: isCurrent ? route.color : isPast ? '#334155' : '#1e293b',
                      borderColor: isCurrent ? route.color : isTerminus ? '#94a3b8' : isPast ? '#475569' : '#334155',
                    }}
                  >
                    {isCurrent && <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>}
                    {isTerminus && !isCurrent && <div className="w-1.5 h-1.5 rounded-sm bg-slate-400"></div>}
                  </div>

                  {/* Stop name */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isCurrent ? 'text-white' : isPast ? 'text-slate-600' : 'text-slate-300'}`}>
                      {stop ? stop.name : `Stop ${stopId}`}
                    </p>
                    {isCurrent && (
                      <p className="text-xs" style={{ color: route.color }}>
                        {isDwelling ? '● Stopped here' : '● Current position'}
                      </p>
                    )}
                    {isNext && !isCurrent && (
                      <p className="text-xs text-amber-400">→ Next stop</p>
                    )}
                    {isTerminus && !isCurrent && (
                      <p className="text-xs text-slate-500">Terminus</p>
                    )}
                  </div>

                  {/* ETA */}
                  <div className="text-right flex-shrink-0">
                    {isCurrent ? (
                      <span className="text-lg">🚌</span>
                    ) : isPast ? (
                      <span className="text-xs text-slate-600">✓</span>
                    ) : eta ? (
                      <span className={`text-xs font-semibold ${eta.etaMinutes <= 2 ? 'text-green-400' : eta.etaMinutes <= 6 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {eta.etaMinutes === 0 ? '<1' : eta.etaMinutes}m
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live footer */}
      <div className="p-3 border-t border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: route.color }}></div>
          <span>Live position</span>
        </div>
        {isDwelling && (
          <span className="text-xs text-green-400 font-medium">
            Departing in ~{Math.round((bus.dwellTicks ?? 0) * 0.1)}s
          </span>
        )}
      </div>
    </div>
  );
}
