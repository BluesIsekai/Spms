import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only initialise if real credentials are provided.
// When running without Supabase the app falls back to demo/local state.
function isValidUrl(url) {
  try { return /^https?:\/\/.+/.test(url); } catch { return false; }
}

const isConfigured = isValidUrl(supabaseUrl) && supabaseAnonKey && supabaseAnonKey.length > 20;

export const supabase = isConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

export default supabase;
