/**
 * yahooStockApi.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Yahoo Finance data service — no API key required.
 *
 * All HTTP requests are routed through Vite dev-server proxy paths:
 *   /api/yahoo        →  https://query1.finance.yahoo.com
 *   /api/yahoo-search →  https://query2.finance.yahoo.com
 *
 * For production deploy, configure the same proxy rules in nginx / Caddy, or
 * add a thin serverless function (Vercel/Netlify) that forwards the requests.
 *
 * Supported ticker formats:
 *   NSE → RELIANCE.NS   BSE → RELIANCE.BO
 *
 * Note: Yahoo Finance scraper APIs are public but unofficial. Use reasonably
 *        (≤ 1 req/symbol/10 s) to avoid transient rate-limit (429) responses.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CHART_BASE  = '/api/yahoo';        // maps to query1.finance.yahoo.com
const SEARCH_BASE = '/api/yahoo-search'; // maps to query2.finance.yahoo.com

/** interval + range combos for Yahoo Finance v8 chart endpoint */
const RANGE_CONFIG = {
  '1D':  { interval: '5m',  range: '1d'  },
  '1W':  { interval: '60m', range: '5d'  },
  '1M':  { interval: '1d',  range: '1mo' },
  '6M':  { interval: '1d',  range: '6mo' },
  '1Y':  { interval: '1d',  range: '1y'  },
  'MAX': { interval: '1wk', range: 'max' },
};

// ── Internal helpers ─────────────────────────────────────────────────────────

async function fetchChart(symbol, params = '') {
  const url = `${CHART_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Yahoo Finance error ${res.status} for ${symbol}: ${text.slice(0, 120)}`);
  }
  const json = await res.json();
  if (json?.chart?.error) {
    throw new Error(json.chart.error.description || `No data for ${symbol}`);
  }
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No data returned for ${symbol}`);
  return result;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a real-time quote for a single symbol.
 *
 * @param {string} symbol - e.g. 'RELIANCE.NS', 'TCS.NS', 'AAPL'
 * @returns {Promise<Quote>}
 *
 * Returned Quote shape:
 * {
 *   symbol, name, currency, exchange, marketState,
 *   price, change, changePct,
 *   open, high, low, prevClose,
 *   volume, marketCap
 * }
 */
export async function getQuote(symbol) {
  const result = await fetchChart(symbol, '?interval=1d&range=1d');
  const m = result.meta;

  return {
    symbol,
    name:        m.shortName    || m.longName      || symbol,
    currency:    m.currency     || 'INR',
    exchange:    m.exchangeName || '',
    marketState: m.marketState  || 'CLOSED',

    price:     m.regularMarketPrice           ?? 0,
    change:    m.regularMarketChange          ?? 0,
    changePct: m.regularMarketChangePercent   ?? 0,

    open:      m.regularMarketOpen            ?? 0,
    high:      m.regularMarketDayHigh         ?? 0,
    low:       m.regularMarketDayLow          ?? 0,
    prevClose: m.previousClose ?? m.chartPreviousClose ?? 0,

    volume:    m.regularMarketVolume          ?? 0,
    marketCap: m.marketCap                    ?? 0,
  };
}

/**
 * Fetch OHLCV candle data for a chart.
 *
 * @param {string} symbol   - e.g. 'RELIANCE.NS'
 * @param {'1D'|'1W'|'1M'|'6M'|'1Y'|'MAX'} range
 * @returns {Promise<{ candles, volumes, meta }>}
 *
 * candles  → Array<{ time: number, open, high, low, close }>   (Unix seconds)
 * volumes  → Array<{ time: number, value: number, color: string }>
 */
export async function getHistoricalData(symbol, range = '1M') {
  const cfg = RANGE_CONFIG[range] ?? RANGE_CONFIG['1M'];
  const result = await fetchChart(
    symbol,
    `?interval=${cfg.interval}&range=${cfg.range}`
  );

  const timestamps = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};

  const candles = [];
  const volumes = [];

  timestamps.forEach((t, i) => {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    const v = q.volume?.[i];

    // Yahoo Finance sometimes returns null entries for non-trading periods
    if (o == null || h == null || l == null || c == null) return;

    candles.push({ time: t, open: o, high: h, low: l, close: c });
    volumes.push({
      time:  t,
      value: v ?? 0,
      color: c >= o ? 'rgba(0, 200, 150, 0.5)' : 'rgba(255, 71, 87, 0.5)',
    });
  });

  return { candles, volumes, meta: result.meta };
}

/**
 * Batch-fetch current quotes for a list of symbols (for watchlist / portfolio).
 * Uses Promise.allSettled so one failure doesn't block the rest.
 *
 * @param {string[]} symbols
 * @returns {Promise<Record<string, Quote>>}  { 'RELIANCE.NS': Quote, ... }
 */
export async function getWatchlistPrices(symbols) {
  if (!symbols?.length) return {};

  const settled = await Promise.allSettled(symbols.map((s) => getQuote(s)));
  const result  = {};

  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      result[symbols[i]] = r.value;
    }
  });

  return result;
}

/**
 * Search for stock symbols using Yahoo Finance.
 * Prioritises .NS / .BO equities but falls back to all equities.
 *
 * @param {string} query
 * @returns {Promise<Array<{ symbol, shortname, exchDisp }>>}
 */
export async function searchSymbols(query) {
  if (!query?.trim()) return [];
  const url =
    `${SEARCH_BASE}/v1/finance/search` +
    `?q=${encodeURIComponent(query.trim())}` +
    `&quotesCount=10&newsCount=0&enableFuzzyQuery=false&lang=en-US`;

  const res = await fetch(url);
  if (!res.ok) return [];

  const json = await res.json();
  const quotes = json?.finance?.result?.[0]?.quotes ?? [];

  return quotes
    .filter((q) => q.quoteType === 'EQUITY' && q.isYahooFinance)
    .slice(0, 8);
}

// ── Formatting utilities ─────────────────────────────────────────────────────

/**
 * Format market cap with Indian currency notation.
 * Yahoo Finance returns marketCap in absolute units (not in crores/millions).
 */
export function formatMarketCap(num, currency = 'INR') {
  if (!num || num === 0) return 'N/A';

  if (currency === 'INR') {
    const cr = num / 1e7; // rupees → crores
    if (cr >= 1e5) return `₹${(cr / 1e5).toFixed(2)}L Cr`;
    if (cr >= 1e3) return `₹${(cr / 1e3).toFixed(2)}K Cr`;
    if (cr >= 1)   return `₹${cr.toFixed(2)} Cr`;
    return `₹${num.toLocaleString('en-IN')}`;
  }

  // USD / other currencies
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9)  return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6)  return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toFixed(2)}`;
}

/**
 * Format trading volume with Indian number suffixes.
 */
export function formatVolume(v) {
  if (!v) return 'N/A';
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)} L`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)} K`;
  return String(v);
}

/**
 * Return the currency symbol for the quote's currency code.
 */
export function currencySymbol(currency) {
  const map = { INR: '₹', USD: '$', GBP: '£', EUR: '€', JPY: '¥' };
  return map[currency] ?? currency + ' ';
}

const fxRateCache = new Map();

export async function getFxRateToINR(currency = 'INR') {
  if (!currency || currency === 'INR') return 1;

  const cacheKey = `${currency}_INR`;
  const cached = fxRateCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
    return cached.rate;
  }

  try {
    const fxQuote = await getQuote(`${currency}INR=X`);
    const rate = Number(fxQuote?.price || 0);
    if (Number.isFinite(rate) && rate > 0) {
      fxRateCache.set(cacheKey, { rate, ts: Date.now() });
      return rate;
    }
  } catch (_) {
    // Fall through to safe default.
  }

  return 1;
}

export async function getFxRatesToINR(currencies = []) {
  const unique = [...new Set((currencies || []).filter(Boolean))].filter((c) => c !== 'INR');
  if (!unique.length) return {};

  const settled = await Promise.allSettled(unique.map((c) => getFxRateToINR(c)));
  const result = {};
  settled.forEach((item, idx) => {
    if (item.status === 'fulfilled') {
      result[unique[idx]] = Number(item.value || 1);
    }
  });
  return result;
}
