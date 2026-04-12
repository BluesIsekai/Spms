import { supabase } from './supabaseClient';

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.');
}

/**
 * Fetch user settings, create default if missing.
 */
export async function fetchSettings(userId) {
  requireSupabase();
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return updateSettings(userId, {
        theme: 'dark',
        currency: 'INR',
        refresh_interval: 10000,
        default_balance: 100000,
        notifications: true
      });
    }
    throw error;
  }
  return data;
}

/**
 * Update user settings.
 */
export async function updateSettings(userId, updates) {
  requireSupabase();
  const payload = { user_id: userId, ...updates };
  const { data, error } = await supabase
    .from('user_settings')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}
