import { supabase } from './supabaseClient';

/** Throw a clear error if called without Supabase configured. */
function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.local file.');
}

function makeChannelName(base, userId) {
  return `${base}-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}


// ─── Holdings ────────────────────────────────────────────────────────────────

/** Fetch all holdings for the current user. */
export async function fetchHoldings(userId) {
  requireSupabase();
  const { data, error } = await supabase
    .from('holdings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Upsert (create or update) a holding. */
export async function upsertHolding({ userId, symbol, quantity, averageBuyPrice, companyName = null }) {
  requireSupabase();
  const { data, error } = await supabase
    .from('holdings')
    .upsert(
      {
        user_id: userId,
        stock_symbol: symbol,
        company_name: companyName,
        quantity,
        average_buy_price: averageBuyPrice,
      },
      { onConflict: 'user_id,stock_symbol' }
    )
    .select();
  if (error) throw error;
  return data;
}

/** Delete a holding by symbol for a user. */
export async function deleteHolding(userId, symbol) {
  requireSupabase();
  const { error } = await supabase
    .from('holdings')
    .delete()
    .eq('user_id', userId)
    .eq('stock_symbol', symbol);
  if (error) throw error;
}

// ─── Transactions ─────────────────────────────────────────────────────────────

/** Fetch all transactions for the current user. */
export async function fetchTransactions(userId, limit = 50) {
  requireSupabase();
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

/**
 * Record a buy or sell transaction and update the holding and paper wallet.
 * @param {'BUY'|'SELL'} type
 */
export async function recordTransaction({ userId, symbol, type, quantity, price }) {
  requireSupabase();
  const normalizedType = String(type || '').toUpperCase();
  if (normalizedType !== 'BUY' && normalizedType !== 'SELL') {
    throw new Error('Invalid transaction type. Expected BUY or SELL.');
  }

  const normalizedQuantity = Number(quantity);
  const normalizedPrice = Number(price);
  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
    throw new Error('Quantity must be a positive number.');
  }
  if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
    throw new Error('Price must be a positive number.');
  }

  const totalAmount = normalizedQuantity * normalizedPrice;

  // 1. Fetch wallet to deduct/add balance
  const { data: walletData, error: walletQueryError } = await supabase
    .from('paper_wallet')
    .select('virtual_balance')
    .eq('user_id', userId)
    .single();

  if (walletQueryError && walletQueryError.code !== 'PGRST116') throw walletQueryError;
  let currentBalance = walletData ? Number(walletData.virtual_balance) : 100000.0;
  
  if (normalizedType === 'BUY' && currentBalance < totalAmount) {
    throw new Error('Insufficient virtual balance for this transaction.');
  }

  // 2. Fetch existing holding to validate SELL
  const { data: existing, error: existingError } = await supabase
    .from('holdings')
    .select('*')
    .eq('user_id', userId)
    .eq('stock_symbol', symbol)
    .single();

  if (existingError && existingError.code !== 'PGRST116') {
    throw existingError;
  }

  if (normalizedType === 'SELL') {
    const existingQty = Number(existing?.quantity || 0);
    if (existingQty < normalizedQuantity) {
      throw new Error('Cannot sell more shares than you hold.');
    }
  }

  // 3. Update Wallet Balance
  const newBalance = normalizedType === 'BUY' ? currentBalance - totalAmount : currentBalance + totalAmount;
  const { error: walletUpsertError } = await supabase
    .from('paper_wallet')
    .upsert({ user_id: userId, virtual_balance: newBalance }, { onConflict: 'user_id' });
  if (walletUpsertError) throw walletUpsertError;

  // 4. Insert transaction record
  const { error: txError } = await supabase.from('transactions').insert({
    user_id: userId,
    stock_symbol: symbol,
    transaction_type: normalizedType,
    quantity: normalizedQuantity,
    price: normalizedPrice,
    total_amount: totalAmount,
  });
  if (txError) throw txError;

  // 5. Update Holdings
  if (normalizedType === 'BUY') {
    const prevQty = Number(existing?.quantity || 0);
    const prevAvg = Number(existing?.average_buy_price || 0);
    const newQty = prevQty + normalizedQuantity;
    const newAvg = (prevQty * prevAvg + normalizedQuantity * normalizedPrice) / newQty;
    await upsertHolding({
      userId,
      symbol,
      quantity: newQty,
      averageBuyPrice: newAvg,
      companyName: existing?.company_name || symbol.replace('.NS', ''),
    });
  } else if (normalizedType === 'SELL') {
    const newQty = Number(existing?.quantity || 0) - normalizedQuantity;
    if (newQty <= 0) {
      await deleteHolding(userId, symbol);
    } else {
      await upsertHolding({
        userId,
        symbol,
        quantity: newQty,
        averageBuyPrice: existing.average_buy_price,
        companyName: existing.company_name || symbol.replace('.NS', ''),
      });
    }
  }
}

/**
 * Reset User Portfolio. Deletes all transactions, holdings, and resets virtual balance.
 */
export async function resetPortfolio(userId, defaultBalance = 100000) {
  requireSupabase();
  
  // Clear holdings
  const { error: hError } = await supabase.from('holdings').delete().eq('user_id', userId);
  if (hError) throw hError;

  // Clear transactions
  const { error: tError } = await supabase.from('transactions').delete().eq('user_id', userId);
  if (tError) throw tError;

  // Reset wallet
  const { error: wError } = await supabase
    .from('paper_wallet')
    .upsert(
      {
        user_id: userId,
        virtual_balance: Number(defaultBalance),
        initial_balance: Number(defaultBalance),
      },
      { onConflict: 'user_id' }
    );
  if (wError) throw wError;
}

// ─── Watchlist ────────────────────────────────────────────────────────────────

/** Fetch the watchlist for a user. */
export async function fetchWatchlist(userId) {
  requireSupabase();
  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

/** Add a symbol to the watchlist. */
export async function addToWatchlist(userId, symbol, companyName = null) {
  requireSupabase();
  const { data, error } = await supabase
    .from('watchlist')
    .insert({ user_id: userId, stock_symbol: symbol, company_name: companyName })
    .select();
  if (error) throw error;
  return data;
}

/** Remove a symbol from the watchlist. */
export async function removeFromWatchlist(userId, symbol) {
  requireSupabase();
  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('user_id', userId)
    .eq('stock_symbol', symbol);
  if (error) throw error;
}

// ─── Realtime Subscriptions ───────────────────────────────────────────────────

/**
 * Subscribe to real-time changes in the holdings table.
 * Returns an unsubscribe function.
 */
export function subscribeHoldings(userId, callback) {
  requireSupabase();
  const channel = supabase
    .channel(makeChannelName('holdings-changes', userId))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'holdings', filter: `user_id=eq.${userId}` },
      callback
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/**
 * Subscribe to real-time changes in the transactions table.
 */
export function subscribeTransactions(userId, callback) {
  requireSupabase();
  const channel = supabase
    .channel(makeChannelName('transactions-changes', userId))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
      callback
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/**
 * Subscribe to real-time changes in the watchlist table.
 */
export function subscribeWatchlist(userId, callback) {
  requireSupabase();
  const channel = supabase
    .channel(makeChannelName('watchlist-changes', userId))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'watchlist', filter: `user_id=eq.${userId}` },
      callback
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
