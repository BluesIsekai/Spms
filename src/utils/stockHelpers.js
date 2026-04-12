/**
 * Utility functions for stock and index evaluations.
 */

/**
 * Identify if a tracking symbol natively represents a stock market index.
 * Standard Yahoo Finance convention dictates that indexes are prefixed with a circumflex (e.g. ^NSEI, ^BSESN).
 * 
 * @param {string} symbol
 * @returns {boolean} True if the symbol is an index.
 */
export function isIndex(symbol) {
  if (!symbol) return false;
  return symbol.startsWith('^');
}
