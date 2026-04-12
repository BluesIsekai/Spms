import { supabase } from './supabaseClient';

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.');
}

/**
 * Fetch or initialize the paper trading wallet for a user.
 */
export async function fetchWallet(userId) {
  requireSupabase();
  const { data, error } = await supabase
    .from('paper_wallet')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Wallet not found, create default
      return initializeWallet(userId);
    }
    throw error;
  }
  return data;
}

/**
 * Initialize a default paper wallet with 1,00,000 INR
 */
export async function initializeWallet(userId, balance = 100000.0) {
  requireSupabase();
  const { data, error } = await supabase
    .from('paper_wallet')
    .insert({
      user_id: userId,
      virtual_balance: balance,
      initial_balance: balance,
    })
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function updateWalletBalance(userId, balance) {
  requireSupabase();
  const nextBalance = Number(balance);
  if (!Number.isFinite(nextBalance) || nextBalance < 0) {
    throw new Error('Balance must be a valid non-negative number.');
  }

  const { data, error } = await supabase
    .from('paper_wallet')
    .upsert(
      {
        user_id: userId,
        virtual_balance: nextBalance,
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Subscribe to realtime wallet changes.
 */
export function subscribeWallet(userId, callback) {
  requireSupabase();
  const channel = supabase
    .channel('wallet-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'paper_wallet', filter: `user_id=eq.${userId}` },
      callback
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
