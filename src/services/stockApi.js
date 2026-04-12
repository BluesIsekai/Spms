/**
 * stockApi.js — DEPRECATED
 * ─────────────────────────────────────────────────────────────────────────────
 * This file previously contained Finnhub API integration.
 * All Finnhub code has been removed. This file now re-exports the
 * equivalent functions from yahooStockApi.js for backwards compatibility
 * with any remaining import paths.
 *
 * Please update your imports to use yahooStockApi.js directly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export {
  getQuote,
  getHistoricalData,
  getWatchlistPrices,
  searchSymbols as searchSymbol,
  formatMarketCap,
  formatVolume,
  currencySymbol,
} from './yahooStockApi';
