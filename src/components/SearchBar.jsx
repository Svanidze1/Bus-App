import { useState, useRef, useEffect } from 'react';
import { stops } from '../data/stops';
import { routes } from '../data/routes';

export default function SearchBar({ onSelectStop, onSelectBus, buses }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState([]);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const q = query.toLowerCase();

    const matchedStops = stops
      .filter(s => s.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map(s => ({ type: 'stop', data: s }));

    const matchedRoutes = routes
      .filter(r => r.bus_number.includes(q))
      .slice(0, 3)
      .map(r => {
        const liveBus = buses.find(b => b.route_id === r.id);
        return { type: 'bus', data: liveBus || { route_id: r.id, id: r.id }, route: r };
      });

    setResults([...matchedStops, ...matchedRoutes]);
    setIsOpen(true);
  }, [query, buses]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(result) {
    setQuery('');
    setIsOpen(false);
    if (result.type === 'stop') {
      onSelectStop(result.data);
    } else {
      onSelectBus(result.data);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search stop or bus number..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-700/80 border border-slate-600 rounded-xl text-white placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setIsOpen(false); }}
            className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="search-dropdown absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-[9999] overflow-hidden">
          {results.map((result, idx) => (
            <button
              key={idx}
              onClick={() => handleSelect(result)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-left border-b border-slate-700/50 last:border-0"
            >
              {result.type === 'stop' ? (
                <>
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 border border-green-500/40 flex items-center justify-center flex-shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{result.data.name}</p>
                    <p className="text-slate-400 text-xs">Stop #{result.data.id}</p>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
                    style={{ background: result.route.color }}
                  >
                    {result.route.bus_number}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Bus {result.route.bus_number}</p>
                    <p className="text-slate-400 text-xs">{result.route.stops.length} stops on route</p>
                  </div>
                </>
              )}
            </button>
          ))}
        </div>
      )}

      {isOpen && results.length === 0 && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-[9999] px-4 py-3">
          <p className="text-slate-400 text-sm">No results for "{query}"</p>
        </div>
      )}
    </div>
  );
}
