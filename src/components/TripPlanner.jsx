import { useState, useMemo, useEffect, useRef } from 'react';
import { stops } from '../data/stops';
import { planTrip, planTripFromCoords } from '../utils/tripPlanner';
import { routesMap } from '../data/routes';
import { stopsMap } from '../data/stops';

const sortedStops = [...stops].sort((a, b) => a.name.localeCompare(b.name));

function SearchableStopSelector({ label, value, onChange, placeholder, colorClass, search, onSearchChange, pickMode, onPickMode, activePickMode }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredStops = useMemo(() => 
    sortedStops.filter(s => s.name.toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1 group">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-200 ${value ? 'bg-slate-800 border-slate-700 shadow-inner' : 'bg-slate-800/40 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
            <div className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 ${colorClass}`}></div>
            <input
              type="text"
              className="bg-transparent border-none outline-none text-xs text-white w-full placeholder:text-slate-600"
              placeholder={placeholder}
              value={isOpen ? search : (value ? (value.type === 'stop' ? value.name : `📍 ${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}`) : '')}
              onFocus={() => setIsOpen(true)}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setIsOpen(true);
              }}
            />
            {value && (
              <button 
                onClick={(e) => { e.stopPropagation(); onChange(null); }} 
                className="text-slate-500 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Dropdown Result List */}
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                {filteredStops.length > 0 ? (
                  filteredStops.map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        onChange({ type: 'stop', id: s.id, name: s.name });
                        onSearchChange('');
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 transition-colors text-left group"
                    >
                      <div className="w-2 h-2 rounded-full border border-slate-600 group-hover:border-blue-400"></div>
                      <span className="text-xs text-slate-300 group-hover:text-white">{s.name}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-xs text-slate-500 italic">No stops found</div>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => onPickMode(activePickMode === pickMode ? null : pickMode)}
          className={`w-11 h-11 rounded-2xl border transition-all duration-200 flex items-center justify-center text-lg shadow-lg ${activePickMode === pickMode 
            ? 'bg-blue-600 border-blue-500 text-white shadow-blue-600/30' 
            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white hover:border-slate-600'}`}
          title="Pick on map"
        >
          📍
        </button>
      </div>
    </div>
  );
}

// Convert segments into a flat list of human-readable steps
function buildSteps(result) {
// ... existing buildSteps
  const steps = [];
  const segs = result.segments;

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const firstStop = stopsMap[seg.stops[0]];
    const lastStop = stopsMap[seg.stops[seg.stops.length - 1]];
    const distM = Math.round((seg.distKm ?? 0) * 1000);
    const route = seg.type === 'bus' ? Object.values(routesMap).find(r => r.bus_number === seg.busNumber) : null;
    const color = seg.type === 'walk' ? '#ef4444' : (route?.color ?? '#64748b');

    if (seg.type === 'walk') {
      steps.push({
        icon: 'walk',
        color: '#ef4444',
        title: `Walk to ${lastStop?.name ?? 'destination'}`,
        sub: `${distM}m · about ${Math.round(seg.timeMin)} min on foot`,
        stopId: seg.stops[seg.stops.length - 1],
        timeMin: seg.timeMin,
        highlight: false,
      });
    } else {
      // Board step
      steps.push({
        icon: seg.busNumber,
        color,
        title: `Board Bus ${seg.busNumber}`,
        sub: `At stop: ${firstStop?.name ?? 'stop'}`,
        stopId: seg.stops[0],
        timeMin: null,
        highlight: true,
      });
      // Ride step
      const stopCount = seg.stops.length - 1;
      steps.push({
        icon: seg.busNumber,
        color,
        title: `Ride ${stopCount} stop${stopCount !== 1 ? 's' : ''}`,
        sub: `Get off at: ${lastStop?.name ?? 'stop'}`,
        stopId: seg.stops[seg.stops.length - 1],
        timeMin: seg.timeMin,
        highlight: false,
      });
    }
  }

  // Final arrive step
  const destination = result.toStop?.name ?? result.toPoint ? 'destination' : 'destination';
  steps.push({
    icon: 'arrive',
    color: '#4ade80',
    title: `Arrive at ${result.toStop?.name ?? 'destination'}`,
    sub: null,
    stopId: result.toStop?.id,
    timeMin: null,
    highlight: false,
  });

  return steps;
}

export default function TripPlanner({ onSelectStop, onTripFound, tripFrom, tripTo, onTripFromChange, onTripToChange, pickMode, onPickMode, onOpenFeedback, isMobile }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fromSearch, setFromSearch] = useState('');
  const [toSearch, setToSearch] = useState('');
  const [isOpenState, setIsOpenState] = useState('collapsed');

  // Collapse drawer when in pick-on-map mode so the user can see the map clearly
  useEffect(() => {
    if (pickMode) {
      setIsOpenState('collapsed');
    }
  }, [pickMode]);

  const filteredFromStops = useMemo(() => 
    sortedStops.filter(s => s.name.toLowerCase().includes(fromSearch.toLowerCase())),
    [fromSearch]
  );

  const filteredToStops = useMemo(() => 
    sortedStops.filter(s => s.name.toLowerCase().includes(toSearch.toLowerCase())),
    [toSearch]
  );

  async function handleFind() {
    if (!tripFrom || !tripTo) return;
    setLoading(true);
    let res;
    if (tripFrom.type === 'point' || tripTo.type === 'point') {
      const fromLat = tripFrom.type === 'point' ? tripFrom.lat : stopsMap[tripFrom.id]?.lat;
      const fromLng = tripFrom.type === 'point' ? tripFrom.lng : stopsMap[tripFrom.id]?.lng;
      const toLat = tripTo.type === 'point' ? tripTo.lat : stopsMap[tripTo.id]?.lat;
      const toLng = tripTo.type === 'point' ? tripTo.lng : stopsMap[tripTo.id]?.lng;
      res = await planTripFromCoords(fromLat, fromLng, toLat, toLng);
    } else {
      res = await planTrip(tripFrom.id, tripTo.id);
    }
    setResult(res);
    setLoading(false);
    onTripFound?.(res);
    if (isMobile && res && !res.error) {
      setIsOpenState('expanded');
    }
  }

  function handleStopClick(stopId) {
    const stop = stopsMap[stopId];
    if (stop) onSelectStop(stop);
  }

  const walkCount = result?.segments?.filter(s => s.type === 'walk').length ?? 0;
  const busCount = result?.segments?.filter(s => s.type === 'bus').length ?? 0;

  const Container = isMobile ? 'div' : 'aside';
  const mobileHeightStyle = isMobile ? {
    height: isOpenState === 'collapsed' ? '56px' : isOpenState === 'half' ? '290px' : '75vh',
    zIndex: 1001,
  } : {};

  return (
    <Container 
      className={isMobile 
        ? "fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700/60 rounded-t-[2rem] flex flex-col overflow-hidden transition-all duration-300 shadow-2xl"
        : "w-72 flex-shrink-0 bg-slate-900 border-r border-slate-700/60 flex flex-col overflow-hidden"
      }
      style={mobileHeightStyle}
    >
      {/* Mobile drag handle */}
      {isMobile && (
        <div 
          className="w-full flex justify-center py-2 cursor-pointer bg-slate-900 hover:bg-slate-800/20 active:bg-slate-800/40 transition-colors flex-shrink-0"
          onClick={() => {
            setIsOpenState(prev => prev === 'collapsed' ? 'half' : prev === 'half' ? 'expanded' : 'collapsed');
          }}
        >
          <div className="w-12 h-1.5 rounded-full bg-slate-700" />
        </div>
      )}

      {/* Header */}
      <div 
        className={`px-5 ${isMobile ? 'py-1 pb-2' : 'pt-5 pb-4'} border-b border-slate-700/60 flex-shrink-0 select-none ${isMobile ? 'cursor-pointer hover:bg-slate-800/10' : ''}`}
        onClick={() => {
          if (isMobile) {
            setIsOpenState(prev => prev === 'collapsed' ? 'half' : 'collapsed');
          }
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <h2 className="text-white font-semibold text-sm">Trip Planner</h2>
          </div>
          {isMobile && (
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
              {isOpenState === 'collapsed' ? 'Tap to Plan' : 'Collapse'}
            </span>
          )}
        </div>
        {!isMobile && <p className="text-slate-400 text-xs mt-1">Bus + walking — every route possible</p>}
      </div>

      <div className={`flex-1 overflow-y-auto ${isMobile && isOpenState === 'collapsed' ? 'hidden' : ''}`}>
        {/* Form */}
        <div className="p-4 space-y-4">
          <SearchableStopSelector 
            label="From"
            placeholder="Search starting stop..."
            value={tripFrom}
            onChange={(val) => { onTripFromChange(val); setResult(null); }}
            colorClass="border-blue-400"
            search={fromSearch}
            onSearchChange={setFromSearch}
            pickMode="from"
            activePickMode={pickMode}
            onPickMode={onPickMode}
          />

          {/* Swap button */}
          <div className="flex justify-center -my-2 relative z-10">
            <button
              onClick={() => { onTripFromChange(tripTo); onTripToChange(tripFrom); setResult(null); }}
              className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-white transition-all shadow-md flex items-center justify-center active:scale-95"
              title="Swap"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          <SearchableStopSelector 
            label="To"
            placeholder="Search destination stop..."
            value={tripTo}
            onChange={(val) => { onTripToChange(val); setResult(null); }}
            colorClass="bg-green-400 border-green-500/40"
            search={toSearch}
            onSearchChange={setToSearch}
            pickMode="to"
            activePickMode={pickMode}
            onPickMode={onPickMode}
          />

          {/* Find button */}
          <button
            onClick={handleFind}
            disabled={!tripFrom || !tripTo || loading}
            className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Finding...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Find Route
              </>
            )}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="px-4 pb-4 space-y-2">
            {result.error ? (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <p className="text-red-400 text-sm font-medium">Route Not Found</p>
                <p className="text-slate-400 text-xs mt-1">{result.error}</p>
              </div>
            ) : (
              <>
                {/* Summary strip */}
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700">
                  <div>
                    <p className="text-white font-bold text-sm">{result.totalMinutes} min total</p>
                    <p className="text-slate-400 text-xs">
                      {busCount > 0 ? `${result.totalBusStops} bus stop${result.totalBusStops !== 1 ? 's' : ''}` : 'Walk only'}
                      {result.totalWalkMin > 0 ? ` · ${result.totalWalkMin} min walking` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {result.transfers === 0 && walkCount === 0 && (
                      <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full border border-green-500/30">Direct</span>
                    )}
                    {result.transfers > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
                        {result.transfers} transfer{result.transfers > 1 ? 's' : ''}
                      </span>
                    )}
                    {walkCount > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-sky-500/20 text-sky-400 rounded-full border border-sky-500/30">+ walk</span>
                    )}
                  </div>
                </div>

                {/* Step-by-step list */}
                <div className="rounded-xl border border-slate-700 overflow-hidden">
                  {buildSteps(result).map((step, i, arr) => (
                    <div
                      key={i}
                      className={`flex gap-3 px-3 py-3 ${i < arr.length - 1 ? 'border-b border-slate-700/60' : ''} ${step.highlight ? 'bg-slate-700/30' : 'bg-slate-800/40'}`}
                    >
                      {/* Icon + connector line */}
                      <div className="flex flex-col items-center gap-0 flex-shrink-0">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: step.color + '25', border: `1.5px solid ${step.color}55` }}
                        >
                          {step.icon === 'walk' ? (
                            <svg className="w-4 h-4" style={{ color: step.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          ) : step.icon === 'arrive' ? (
                            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                          ) : (
                            <span className="text-xs font-bold" style={{ color: step.color }}>{step.icon}</span>
                          )}
                        </div>
                        {i < arr.length - 1 && (
                          <div className="w-px mt-1" style={{ height: 'calc(100% - 28px)', minHeight: 8, background: step.color + '35' }} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold leading-snug">{step.title}</p>
                        {step.sub && <p className="text-slate-400 text-xs mt-0.5 leading-snug">{step.sub}</p>}
                        {step.stopId && step.icon !== 'arrive' && (
                          <button
                            onClick={() => {
                              handleStopClick(step.stopId);
                              if (isMobile) {
                                setIsOpenState('collapsed'); // Collapse drawer to view map
                              }
                            }}
                            className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            Show on map →
                          </button>
                        )}
                      </div>

                      {/* Time */}
                      {step.timeMin != null && (
                        <span className="text-xs font-semibold text-slate-300 flex-shrink-0 pt-0.5">
                          ~{Math.round(step.timeMin)}m
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {(!isMobile || isOpenState === 'expanded') && (
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex flex-col gap-3 flex-shrink-0">
          <button 
            onClick={onOpenFeedback}
            className="w-full py-3 px-4 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-between group hover:bg-slate-700/50 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 border border-orange-500/20 group-hover:scale-110 transition-transform">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-white text-xs font-bold leading-none">Report Issue</p>
                <p className="text-slate-500 text-[10px]">Tell us about a problem</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-slate-600 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <p className="text-[10px] text-slate-600 text-center font-medium">Kutaisi Smart Bus · v2.4.0</p>
        </div>
      )}
    </Container>
  );
}
