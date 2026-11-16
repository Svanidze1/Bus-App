import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import Navbar from './components/Navbar';
import TripPlanner from './components/TripPlanner';
import MapView from './components/MapView';
import PopupModal from './components/PopupModal';
import FeedbackModal from './components/FeedbackModal';
import SearchBar from './components/SearchBar';
import { useBusSimulation } from './hooks/useBusSimulation';
import { initialBuses } from './data/buses';
import { stops, stopsMap } from './data/stops';
import { routes, routesMap } from './data/routes';

export default function App() {
  const buses = useBusSimulation(initialBuses);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [filterMode, setFilterMode] = useState(null); // null | { type: 'stop', stopId } | { type: 'bus', busId }
  const [selectedStop, setSelectedStop] = useState(null);
  const [selectedBus, setSelectedBus] = useState(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [flyTo, setFlyTo] = useState(null);
  const [activeTripPlan, setActiveTripPlan] = useState(null);
  const [tripFrom, setTripFrom] = useState(null); // { type: 'stop', id, name } | { type: 'point', lat, lng }
  const [tripTo, setTripTo] = useState(null);
  const [pickMode, setPickMode] = useState(null); // 'from' | 'to' | null
  const mapRef = useRef(null);

  const handleMapClick = useCallback((lat, lng) => {
    if (pickMode === 'from') setTripFrom({ type: 'point', lat, lng });
    else if (pickMode === 'to') setTripTo({ type: 'point', lat, lng });
    setPickMode(null);
  }, [pickMode]);

  // Compute visible stops and buses based on filter mode
  const { visibleStops, visibleBuses } = useMemo(() => {
    if (!filterMode) {
      return { visibleStops: stops, visibleBuses: buses };
    }

    if (filterMode.type === 'stop') {
      const stop = stopsMap[filterMode.stopId];
      if (!stop) return { visibleStops: [], visibleBuses: [] };

      // Find all routes that pass through this stop
      const relevantRoutes = routes.filter(r => r.stops.includes(filterMode.stopId));
      const routeIds = new Set(relevantRoutes.map(r => r.id));

      // Only show buses on those routes
      const filteredBuses = buses.filter(b => routeIds.has(b.route_id));

      // If NO buses are currently on these routes, show ONLY the stop
      if (filteredBuses.length === 0) {
        return { visibleStops: [stop], visibleBuses: [] };
      }

      // If there ARE buses, show the full route context (all stops on those routes)
      const relevantStopIds = new Set();
      for (const route of relevantRoutes) {
        for (const sId of route.stops) {
          relevantStopIds.add(sId);
        }
      }
      const filteredStops = stops.filter(s => relevantStopIds.has(s.id));

      return { visibleStops: filteredStops, visibleBuses: filteredBuses };
    }

    if (filterMode.type === 'bus') {
      const bus = buses.find(b => b.id === filterMode.busId);
      if (!bus) return { visibleStops: stops, visibleBuses: buses };

      const route = routesMap[bus.route_id];
      if (!route) return { visibleStops: [bus], visibleBuses: [bus] };

      // Only the selected bus
      const filteredBuses = [bus];

      // Only stops on this bus's route
      const routeStopIds = new Set(route.stops);
      const filteredStops = stops.filter(s => routeStopIds.has(s.id));

      return { visibleStops: filteredStops, visibleBuses: filteredBuses };
    }

    if (filterMode.type === 'route') {
      const route = routesMap[filterMode.routeId];
      if (!route) return { visibleStops: stops, visibleBuses: buses };

      const filteredBuses = buses.filter(b => b.route_id === filterMode.routeId);
      const routeStopIds = new Set(route.stops);
      const filteredStops = stops.filter(s => routeStopIds.has(s.id));

      return { visibleStops: filteredStops, visibleBuses: filteredBuses };
    }

    return { visibleStops: stops, visibleBuses: buses };
  }, [filterMode, buses]);

  const handleSelectStop = useCallback((stop) => {
    setSelectedStop(stop);
    setSelectedBus(null);
    setFilterMode({ type: 'stop', stopId: stop.id });
    setFlyTo({ lat: stop.lat, lng: stop.lng, zoom: 16 });
  }, []);

  const handleSelectBus = useCallback((bus) => {
    const liveBus = buses.find(b => b.id === bus.id) || bus;
    setSelectedBus(liveBus);
    setSelectedStop(null);
    setFilterMode({ type: 'bus', busId: liveBus.id });
    setFlyTo({ lat: liveBus.lat, lng: liveBus.lng, zoom: 16 });
  }, [buses]);

  const handleSelectRoute = useCallback((routeId) => {
    const route = routesMap[routeId];
    if (!route) return;
    setSelectedBus(null);
    setSelectedStop(null);
    setFilterMode({ type: 'route', routeId });
    
    // Fly to first stop of route if available
    const firstStopId = route.stops[0];
    const firstStop = stopsMap[firstStopId];
    if (firstStop) {
      setFlyTo({ lat: firstStop.lat, lng: firstStop.lng, zoom: 14 });
    }
  }, []);

  const handleClearAll = useCallback(() => {
    setSelectedStop(null);
    setSelectedBus(null);
    setFilterMode(null);
    setTripFrom(null);
    setTripTo(null);
    setActiveTripPlan(null);
  }, []);

  // Keep selected bus synced with simulation
  const liveBus = selectedBus ? buses.find(b => b.id === selectedBus.id) || selectedBus : null;

  const activeBusCount = buses.filter(b => b.isActive !== false).length;

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      {/* Top navbar */}
      <Navbar
        onSelectStop={handleSelectStop}
        onSelectBus={handleSelectBus}
        onSelectRoute={handleSelectRoute}
        onClearFilter={handleClearAll}
        buses={buses}
        stopsCount={stops.length}
        isMobile={isMobile}
      />

      <FeedbackModal 
        isOpen={isFeedbackOpen} 
        onClose={useCallback(() => setIsFeedbackOpen(false), [])} 
      />

      {/* Main content area */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
        {/* Left sidebar - Trip Planner */}
        <TripPlanner
          onSelectStop={handleSelectStop}
          onTripFound={plan => setActiveTripPlan(plan && !plan.error ? plan : null)}
          tripFrom={tripFrom}
          tripTo={tripTo}
          onTripFromChange={(val) => { setTripFrom(val); if (!val) setActiveTripPlan(null); }}
          onTripToChange={(val) => { setTripTo(val); if (!val) setActiveTripPlan(null); }}
          pickMode={pickMode}
          onPickMode={setPickMode}
          onOpenFeedback={() => setIsFeedbackOpen(true)}
          isMobile={isMobile}
        />

        {/* Map */}
        <div className="flex-1 relative">
          <MapView
            buses={buses}
            visibleBuses={visibleBuses}
            visibleStops={visibleStops}
            selectedBus={liveBus}
            selectedStop={selectedStop}
            onSelectBus={handleSelectBus}
            onSelectStop={handleSelectStop}
            flyTo={flyTo}
            onMapReady={(map) => { mapRef.current = map; }}
            tripPlan={activeTripPlan}
            pickMode={pickMode}
            onMapClick={handleMapClick}
            tripFrom={tripFrom}
            tripTo={tripTo}
            filterMode={filterMode}
            isMobile={isMobile}
          />

          {/* Floating Mobile Search Bar */}
          {isMobile && (
            <div className="absolute top-4 left-4 right-4 z-[999] shadow-2xl">
              <SearchBar
                onSelectStop={handleSelectStop}
                onSelectBus={handleSelectBus}
                buses={buses}
              />
            </div>
          )}

          {/* Pick mode overlay */}
          {pickMode && (
            <div className="absolute inset-0 z-[998] pointer-events-none" style={{ outline: `3px solid ${pickMode === 'from' ? '#60a5fa' : '#4ade80'}`, outlineOffset: '-3px' }}>
              <div className={`absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-xl ${pickMode === 'from' ? 'bg-blue-600' : 'bg-green-600'}`}>
                📍 Click anywhere to set {pickMode === 'from' ? 'start' : 'destination'}
              </div>
            </div>
          )}

          {/* Popup Modal */}
           <PopupModal
            type={filterMode?.type || null}
            stop={selectedStop}
            bus={liveBus}
            buses={buses}
            onClose={handleClearAll}
            onSelectBus={handleSelectBus}
            isMobile={isMobile}
          />

          {/* Premium Bottom Left Stats */}
          {!isMobile && (
            <div className="absolute bottom-6 left-6 flex items-center gap-3 z-[999] pointer-events-none">
              <div className="flex flex-col gap-2">
                <div className="group pointer-events-auto bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-4 transition-all hover:bg-slate-900/80 hover:border-white/20">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center text-green-400 border border-green-500/30 group-hover:scale-110 transition-transform">
                    <span className="text-xl">🚌</span>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-white text-lg font-bold leading-none">{activeBusCount}</span>
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Live</span>
                    </div>
                    <p className="text-slate-500 text-[10px] font-medium leading-tight">Active Buses</p>
                  </div>
                </div>

                <div className="group pointer-events-auto bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-4 transition-all hover:bg-slate-900/80 hover:border-white/10">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/30 group-hover:scale-110 transition-transform">
                    <span className="text-xl">📍</span>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-white text-lg font-bold leading-none">{stops.length}</span>
                    </div>
                    <p className="text-slate-500 text-[10px] font-medium leading-tight">Total Stops</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Help hint */}
          {!filterMode && !isMobile && (
            <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-sm border border-slate-700/60 rounded-xl px-4 py-3 shadow-lg z-[999] max-w-xs">
              <p className="text-white text-sm font-semibold mb-1">Get started</p>
              <p className="text-slate-400 text-xs">Click any 🟢 stop or 🚌 bus icon to see details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
