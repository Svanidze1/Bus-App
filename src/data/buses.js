import busesJson from './buses.json';
import { supabase } from '../supabaseClient';

let busesData = busesJson;

if (supabase) {
  try {
    const { data, error } = await supabase
      .from('buses')
      .select('id, route_id, current_path_index')
      .eq('is_active', true)
      .order('id');

    if (!error && data && data.length > 0) {
      busesData = data.map(b => ({
        id: b.id,
        route_id: b.route_id,
        startPathIndex: b.current_path_index
      }));
      console.log(`[Supabase] Loaded ${busesData.length} buses from database.`);
    } else if (error) {
      console.warn('[Supabase] Error loading buses, using local JSON fallback:', error.message);
    }
  } catch (err) {
    console.warn('[Supabase] Failed to query buses, using local JSON fallback:', err);
  }
} else {
  console.log('[Offline] Supabase not configured. Using local JSON for buses.');
}

export const initialBuses = busesData;
