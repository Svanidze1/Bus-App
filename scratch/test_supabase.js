// Polyfill WebSocket
global.WebSocket = class {};

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read env variables
const envText = readFileSync('.env', 'utf-8');
const env = {};
envText.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

console.log('URL:', supabaseUrl);
console.log('Key length:', supabaseAnonKey?.length);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  try {
    const { data: stops, error: stopsError } = await supabase.from('stops').select('*').limit(2);
    console.log('Stops query:', { stops, error: stopsError });

    const { data: buses, error: busesError } = await supabase.from('buses').select('*').limit(2);
    console.log('Buses query:', { buses, error: busesError });
  } catch (e) {
    console.error('Exception:', e);
  }
}

test();
