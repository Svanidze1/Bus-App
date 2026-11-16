import stopsJson from './stops.json';
import { supabase } from '../supabaseClient';

let stopsData = stopsJson;

if (supabase) {
  try {
    const { data, error } = await supabase
      .from('stops')
      .select('id, name, latitude, longitude')
      .eq('is_active', true)
      .order('id');

    if (!error && data && data.length > 0) {
      stopsData = data.map(s => ({
        id: s.id,
        name: s.name,
        lat: parseFloat(s.latitude),
        lng: parseFloat(s.longitude)
      }));
      console.log(`[Supabase] Loaded ${stopsData.length} stops from database.`);
    } else if (error) {
      console.warn('[Supabase] Error loading stops, using local JSON fallback:', error.message);
    }
  } catch (err) {
    console.warn('[Supabase] Failed to query stops, using local JSON fallback:', err);
  }
} else {
  console.log('[Offline] Supabase not configured. Using local JSON for stops.');
}

export const stops = stopsData;
export const stopsMap = Object.fromEntries(stops.map(s => [s.id, s]));
