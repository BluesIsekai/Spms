/**
 * useStockSocket.js — DEPRECATED
 * ─────────────────────────────────────────────────────────────────────────────
 * Finnhub WebSocket integration has been removed.
 * Use useStockPolling instead (polls Yahoo Finance every 10 s).
 *
 *   import { useStockPolling } from './useStockPolling';
 *
 * This shim re-exports useStockPolling under the old name so any
 * existing references don't immediately break.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export { useStockPolling as useStockSocket } from './useStockPolling';
