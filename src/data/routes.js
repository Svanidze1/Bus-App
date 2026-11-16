import routesJson from './routes.json';
import { supabase } from '../supabaseClient';

let routesData = routesJson;

if (supabase) {
  try {
    const [routesRes, routeStopsRes, pathPointsRes] = await Promise.all([
      supabase.from('routes').select('id, bus_number, color').eq('is_active', true).order('id'),
      supabase.from('route_stops').select('route_id, stop_id, stop_order, waypoint_index').order('stop_order'),
      supabase.from('route_path_points').select('route_id, point_order, latitude, longitude').order('point_order')
    ]);

    if (!routesRes.error && !routeStopsRes.error && !pathPointsRes.error) {
      const dbRoutes = routesRes.data;
      const dbRouteStops = routeStopsRes.data;
      const dbPathPoints = pathPointsRes.data;

      if (dbRoutes && dbRoutes.length > 0) {
        routesData = dbRoutes.map(r => {
          const stops = dbRouteStops
            .filter(rs => rs.route_id === r.id)
            .map(rs => rs.stop_id);

          const stopWaypoints = dbRouteStops
            .filter(rs => rs.route_id === r.id)
            .map(rs => rs.waypoint_index);

          const path = dbPathPoints
            .filter(pp => pp.route_id === r.id)
            .map(pp => [parseFloat(pp.latitude), parseFloat(pp.longitude)]);

          return {
            id: r.id,
            bus_number: r.bus_number,
            color: r.color,
            stops,
            stopWaypoints,
            path
          };
        });
        console.log(`[Supabase] Loaded ${routesData.length} routes from database.`);
      }
    } else {
      console.warn('[Supabase] Error loading routes data, using local JSON fallback:', {
        routesError: routesRes.error?.message,
        routeStopsError: routeStopsRes.error?.message,
        pathPointsError: pathPointsRes.error?.message
      });
    }
  } catch (err) {
    console.warn('[Supabase] Failed to query routes, using local JSON fallback:', err);
  }
} else {
  console.log('[Offline] Supabase not configured. Using local JSON for routes.');
}

export const routes = routesData;
export const routesMap = Object.fromEntries(routes.map(r => [r.id, r]));
