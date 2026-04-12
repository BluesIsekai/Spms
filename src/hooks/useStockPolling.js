/**
 * useStockPolling.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Replaces useStockSocket. Polls Yahoo Finance every `interval` ms for a list
 * of symbols and returns a normalised price map.
 *
 * Returns:
 *  prices      – { [symbol]: Quote }   full quote objects, not just numbers
 *  loading     – true while the very first fetch is pending
 *  lastUpdated – Date of the most recent successful refresh
 *  error       – string | null        last error message
 *  refresh()   – imperative manual refresh
 *  connected   – boolean alias (true once we have at least one price)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getWatchlistPrices } from '../services/yahooStockApi';

const DEFAULT_INTERVAL_MS = 10_000; // 10 seconds

/**
 * @param {string[]} symbols   – list of ticker symbols to poll
 * @param {number}   interval  – polling interval in ms (default 10 000)
 */
export function useStockPolling(symbols, interval = DEFAULT_INTERVAL_MS) {
  const [prices, setPrices]           = useState({});
  const [loading, setLoading]         = useState(true);   // true only on first load
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError]             = useState(null);

  // Keep a ref so the stable `fetchPrices` callback always reads the *current* symbols
  const symbolsRef  = useRef(symbols);
  const firstFetch  = useRef(true);
  const isMounted   = useRef(true);

  useEffect(() => {
    symbolsRef.current = symbols;
  });

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Stable fetch callback — no deps so it never triggers re-subscription
  const fetchPrices = useCallback(async () => {
    const syms = symbolsRef.current;
    if (!syms?.length) return;

    // Only show the full loading spinner on the very first call
    if (firstFetch.current) setLoading(true);

    try {
      const data = await getWatchlistPrices(syms);
      if (!isMounted.current) return;

      // Merge rather than replace: preserves stale data while new data loads in
      setPrices((prev) => ({ ...prev, ...data }));
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      if (!isMounted.current) return;
      setError(err.message ?? 'Failed to fetch stock data');
    } finally {
      if (isMounted.current && firstFetch.current) {
        setLoading(false);
        firstFetch.current = false;
      }
    }
  }, []); // deliberately stable

  // Start polling & clean up on unmount
  useEffect(() => {
    fetchPrices();
    const timer = setInterval(fetchPrices, interval);
    return () => clearInterval(timer);
  }, [fetchPrices, interval]);

  // Re-fetch immediately when the symbols list changes
  useEffect(() => {
    fetchPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(symbols)]);

  const connected = Object.keys(prices).length > 0;

  return { prices, loading, lastUpdated, error, refresh: fetchPrices, connected };
}
