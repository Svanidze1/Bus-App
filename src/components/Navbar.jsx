import { useState, useMemo, useEffect, useRef } from 'react';
import SearchBar from './SearchBar';
import { routes } from '../data/routes';

export default function Navbar({ onSelectStop, onSelectBus, onSelectRoute, onClearFilter, buses, stopsCount, isMobile }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeBusCount = useMemo(() => buses.filter(b => b.isActive !== false).length, [buses]);

  // Count active buses per route
  const activeBusesPerRoute = useMemo(() => {
    const counts = {};
    buses.forEach(bus => {
      if (bus.isActive !== false) {
        counts[bus.route_id] = (counts[bus.route_id] || 0) + 1;
      }
    });
    return counts;
  }, [buses]);

  return (
    <header className="flex items-center justify-between px-3 md:px-5 py-2.5 md:py-3 bg-slate-900/95 backdrop-blur border-b border-slate-700/60 relative flex-shrink-0" style={{ zIndex: 2000 }}>
      {/* Logo & Stats */}
      <div className="flex items-center gap-3 md:gap-6">
        <div className="flex items-center gap-2 md:gap-3">
          <img 
            src="/logo.png" 
            alt="Kutaisi Smart Bus Logo" 
            className="w-8 h-8 md:w-10 md:h-10 rounded-xl object-cover border border-emerald-500/20 shadow-lg shadow-emerald-500/20"
          />
          <div>
            <h1 className="text-white font-bold text-sm md:text-lg leading-none tracking-tight">
              Kutaisi Smart Bus
            </h1>
            <p className="text-slate-400 text-[10px] md:text-xs">Real-time transit map</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4 border-l border-slate-700/60 pl-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-white font-bold text-sm leading-none">{activeBusCount}</span>
            </div>
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Active Buses</span>
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold text-sm leading-none">{stopsCount}</span>
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Bus Stops</span>
          </div>
        </div>
      </div>

      {/* Search */}
      {!isMobile && (
        <div className="flex-1 max-w-md mx-6">
          <SearchBar
            onSelectStop={onSelectStop}
            onSelectBus={onSelectBus}
            buses={buses}
          />
        </div>
      )}

      {/* Collapsible Routes List */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => {
            setIsMenuOpen(prev => {
              const newState = !prev;
              if (!newState) onClearFilter(); // Reset selection when COLLAPSING
              return newState;
            });
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all duration-200 ${isMenuOpen
              ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600'
            }`}
        >
          <span className="text-sm font-semibold">Routes & Buses</span>
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isMenuOpen && (
          <div className="absolute top-full right-0 mt-2 w-72 max-h-[70vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[2001] flex flex-col">
            <div className="p-4 border-b border-slate-800 bg-slate-900/50">
              <h3 className="text-white font-bold text-sm">Select Route</h3>
              <p className="text-slate-500 text-xs">Filter map by bus line</p>
            </div>
            <div className="overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700">
              <button
                onClick={() => {
                  onClearFilter();
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 hover:bg-red-500/10 rounded-xl transition-colors text-left group mb-1 border border-dashed border-slate-700 hover:border-red-500/30"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-red-400 border border-slate-700 group-hover:border-red-500/30">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <p className="text-white text-xs font-semibold group-hover:text-red-400 transition-colors">
                    Clear Selection
                  </p>
                  <p className="text-slate-500 text-[10px]">Show all buses & stops</p>
                </div>
              </button>

              {routes.map(route => {
                const activeCount = activeBusesPerRoute[route.id] || 0;
                return (
                  <button
                    key={route.id}
                    onClick={() => {
                      onSelectRoute(route.id);
                      // Removed auto-close: setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-800 rounded-xl transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-inner"
                        style={{ background: route.color }}
                      >
                        {route.bus_number}
                      </div>
                      <div>
                        <p className="text-white text-xs font-semibold group-hover:text-blue-400 transition-colors">
                          Route {route.bus_number}
                        </p>
                        <p className="text-slate-500 text-[10px] truncate w-32">
                          {route.stops.length} stops
                        </p>
                      </div>
                    </div>
                    {activeCount > 0 && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-800 border border-slate-700">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
                        <span className="text-white text-[10px] font-bold">{activeCount}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
