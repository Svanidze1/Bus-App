import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if credentials are set and are not placeholder values
const isConfigured = 
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-project-id') && 
  supabaseAnonKey !== 'your-anon-key-here';

export const supabase = isConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;
