import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStockPolling } from '../hooks/useStockPolling';
import { useAuth } from '../hooks/useAuth.jsx';
import { getFxRatesToINR, getHistoricalData } from '../services/yahooStockApi';
import {
  fetchHoldings,
  fetchTransactions,
  subscribeHoldings,
  subscribeTransactions,
  fetchWatchlist,
  subscribeWatchlist,
} from '../services/portfolioService';
import { fetchWallet, subscribeWallet } from '../services/walletService';
import { supabase } from '../services/supabaseClient';
import { convertToINR, inferCurrencyFromSymbol } from '../utils/currency';
import './Dashboard.css';

const DEFAULT_BALANCE = 100000;

// Fallback watchlist when user has no Supabase items
const DEFAULT_WATCHLIST = [
  { stock_symbol: 'RELIANCE.NS', company_name: 'Reliance Industries' },
  { stock_symbol: 'TCS.NS',      company_name: 'Tata Consultancy Services' },
  { stock_symbol: 'INFY.NS',     company_name: 'Infosys' },
  { stock_symbol: 'HDFCBANK.NS', company_name: 'HDFC Bank' },
  { stock_symbol: 'SBIN.NS',     company_name: 'State Bank of India' },
];

// Market indices
const INDEX_SYMBOLS = ['^NSEI', '^BSESN'];

const SUPABASE_CONFIGURED = !!supabase;

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function Dashboard({ appPrices = {}, lastUpdated, connected, onRefresh }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [holdings, setHoldings]         = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [wallet, setWallet]             = useState(null);
  const [watchlistItems, setWatchlistItems] = useState([]);
  const [fxRates, setFxRates]           = useState({});
  const [prevCloseBySymbol, setPrevCloseBySymbol] = useState({});

  // ── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    if (!SUPABASE_CONFIGURED) {
      setHoldings([
        { stock_symbol: 'RELIANCE.NS', quantity: 10, average_buy_price: 2800 },
        { stock_symbol: 'TCS.NS',      quantity: 5,  average_buy_price: 3600 },
        { stock_symbol: 'INFY.NS',     quantity: 15, average_buy_price: 1500 },
      ]);
      setTransactions([
        { id: 1, stock_symbol: 'RELIANCE.NS', transaction_type: 'BUY', quantity: 10, price: 2800, total_amount: 28000, created_at: new Date(Date.now() - 7200000).toISOString() },
        { id: 2, stock_symbol: 'TCS.NS',      transaction_type: 'BUY', quantity: 5,  price: 3600, total_amount: 18000, created_at: new Date(Date.now() - 86400000).toISOString() },
        { id: 3, stock_symbol: 'INFY.NS',     transaction_type: 'SELL', quantity: 3, price: 1520, total_amount: 4560,  created_at: new Date(Date.now() - 259200000).toISOString() },
      ]);
      setWallet({ virtual_balance: DEFAULT_BALANCE });
      setWatchlistItems(DEFAULT_WATCHLIST);
      return;
    }

    Promise.all([
      fetchHoldings(user.id),
      fetchTransactions(user.id, 20),
      fetchWallet(user.id),
      fetchWatchlist(user.id),
    ])
      .then(([h, t, w, wl]) => {
        setHoldings(h || []);
        setTransactions(t || []);
        setWallet(w || null);
        setWatchlistItems(wl?.length ? wl : DEFAULT_WATCHLIST);
      })
      .catch(() => {});

    const unsub1 = subscribeHoldings(user.id, () =>
      fetchHoldings(user.id).then(setHoldings).catch(() => {})
    );
    const unsub2 = subscribeTransactions(user.id, () =>
      fetchTransactions(user.id, 20).then(setTransactions).catch(() => {})
    );
    const unsub3 = subscribeWallet(user.id, () =>
      fetchWallet(user.id).then(setWallet).catch(() => {})
    );
    const unsub4 = subscribeWatchlist(user.id, () =>
      fetchWatchlist(user.id).then(wl => setWatchlistItems(wl?.length ? wl : DEFAULT_WATCHLIST)).catch(() => {})
    );
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [user?.id]);

  // ── Stock price polling ───────────────────────────────────────────────────
  const watchlistSymbols = useMemo(
    () => watchlistItems.map(w => w.stock_symbol || w.yahoo_symbol).filter(Boolean),
    [watchlistItems]
  );
  const heldSymbols = useMemo(() => holdings.map(h => h.stock_symbol), [holdings]);
  const allPolled = useMemo(
    () => [...new Set([...watchlistSymbols, ...heldSymbols, ...INDEX_SYMBOLS])],
    [watchlistSymbols.join(), heldSymbols.join()]
  );

  const { prices: dashPrices } = useStockPolling(allPolled, 10_000);
  const mergedPrices = useMemo(() => ({ ...dashPrices, ...appPrices }), [dashPrices, appPrices]);

  // FX rates
  useEffect(() => {
    const currencies = holdings
      .map(h => mergedPrices[h.stock_symbol]?.currency || inferCurrencyFromSymbol(h.stock_symbol, 'USD'))
      .filter(Boolean);
    getFxRatesToINR(currencies).then(r => setFxRates(r || {})).catch(() => {});
  }, [holdings, mergedPrices]);

  // Prev close fallback
  useEffect(() => {
    let cancelled = false;
    const targets = holdings
      .map(h => h.stock_symbol)
      .filter(sym => {
        const q = mergedPrices[sym];
        return !(q && Number.isFinite(Number(q.prevClose)) && Number(q.prevClose) > 0);
      });
    if (!targets.length) return () => { cancelled = true; };

    (async () => {
      const entries = await Promise.all(
        [...new Set(targets)].map(async sym => {
          try {
            const { candles = [] } = await getHistoricalData(sym, '5D');
            const closes = candles.map(c => Number(c?.close)).filter(n => Number.isFinite(n) && n > 0);
            if (!closes.length) return [sym, undefined];
            return [sym, closes.length > 1 ? closes[closes.length - 2] : closes[0]];
          } catch { return [sym, undefined]; }
        })
      );
      if (!cancelled) {
        setPrevCloseBySymbol(Object.fromEntries(entries.filter(([, v]) => Number.isFinite(v) && v > 0)));
      }
    })();
    return () => { cancelled = true; };
  }, [holdings, mergedPrices]);

  // ── Derived metrics ───────────────────────────────────────────────────────
  const portfolioMetrics = useMemo(() => {
    const portfolioValue = holdings.reduce((sum, h) => {
      const p = mergedPrices[h.stock_symbol]?.price ?? Number(h.average_buy_price);
      const currency = mergedPrices[h.stock_symbol]?.currency || inferCurrencyFromSymbol(h.stock_symbol, 'USD');
      return sum + convertToINR(p * Number(h.quantity), currency, fxRates);
    }, 0);

    const invested = holdings.reduce((sum, h) => {
      const currency = mergedPrices[h.stock_symbol]?.currency || inferCurrencyFromSymbol(h.stock_symbol, 'USD');
      return sum + convertToINR(Number(h.average_buy_price) * Number(h.quantity), currency, fxRates);
    }, 0);

    const previousCloseValue = holdings.reduce((sum, h) => {
      const quote = mergedPrices[h.stock_symbol];
      const current = quote?.price ?? Number(h.average_buy_price);
      const previous =
        (Number.isFinite(Number(quote?.prevClose)) && Number(quote?.prevClose) > 0
          ? Number(quote.prevClose) : undefined) ??
        prevCloseBySymbol[h.stock_symbol] ??
        (quote ? current - (quote.change ?? 0) : Number(h.average_buy_price));
      const currency = quote?.currency || inferCurrencyFromSymbol(h.stock_symbol, 'USD');
      return sum + convertToINR(previous * Number(h.quantity), currency, fxRates);
    }, 0);

    const totalPnL = portfolioValue - invested;
    const todayPnL = portfolioValue - previousCloseValue;
    const todayPnLPct = previousCloseValue > 0 ? (todayPnL / previousCloseValue) * 100 : 0;

    return { portfolioValue, invested, totalPnL, todayPnL, todayPnLPct };
  }, [holdings, mergedPrices, fxRates, prevCloseBySymbol]);

  const walletBalance = Number(wallet?.virtual_balance ?? DEFAULT_BALANCE);

  // ── Watchlist enriched with live prices & movers ──────────────────────────
  const enrichedWatchlist = useMemo(() =>
    watchlistItems.map(item => {
      const sym = item.stock_symbol || item.yahoo_symbol;
      const q = mergedPrices[sym] || {};
      return {
        symbol: sym,
        name: item.company_name || sym,
        price: q.price || 0,
        change: q.change || 0,
        changePct: q.changePct || 0,
        currency: q.currency || 'INR',
      };
    }),
    [watchlistItems, mergedPrices]
  );

  const topMovers = useMemo(() => {
    const sorted = [...enrichedWatchlist].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
    const gainers = sorted.filter(s => s.changePct > 0).slice(0, 3);
    const losers  = sorted.filter(s => s.changePct < 0).slice(0, 3);
    return { gainers, losers };
  }, [enrichedWatchlist]);

  const recentTransactions = useMemo(() => transactions.slice(0, 5), [transactions]);

  // Market indices
  const nifty  = mergedPrices['^NSEI'];
  const sensex = mergedPrices['^BSESN'];

  const openChart = (symbol) => navigate(`/chart/${symbol}`);

  return (
    <div className="dashboard" id="dashboard-page">
      {/* ── Market Indices Strip ── */}
      <section className="mkt-indices-strip" aria-label="Market indices">
        <div className="mkt-index-chip" id="index-nifty">
          <span className="mkt-index-icon">📈</span>
          <div>
            <div className="mkt-index-label">NIFTY 50</div>
            <div className="mkt-index-value">
              {nifty ? nifty.price.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}
            </div>
          </div>
          {nifty && (
            <span className={`mkt-index-change ${nifty.changePct >= 0 ? 'up' : 'down'}`}>
              {nifty.changePct >= 0 ? '▲' : '▼'} {Math.abs(nifty.changePct).toFixed(2)}%
            </span>
          )}
        </div>

        <div className="mkt-index-chip" id="index-sensex">
          <span className="mkt-index-icon">🏦</span>
          <div>
            <div className="mkt-index-label">SENSEX</div>
            <div className="mkt-index-value">
              {sensex ? sensex.price.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}
            </div>
          </div>
          {sensex && (
            <span className={`mkt-index-change ${sensex.changePct >= 0 ? 'up' : 'down'}`}>
              {sensex.changePct >= 0 ? '▲' : '▼'} {Math.abs(sensex.changePct).toFixed(2)}%
            </span>
          )}
        </div>

        <div className={`mkt-index-chip today-pl ${portfolioMetrics.todayPnL >= 0 ? 'up' : 'down'}`} id="index-today-pl">
          <span className="mkt-index-icon">💹</span>
          <div>
            <div className="mkt-index-label">Today P/L</div>
            <div className="mkt-index-value mono">
              {portfolioMetrics.todayPnL >= 0 ? '+' : ''}₹{Math.abs(portfolioMetrics.todayPnL).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>
          <span className={`mkt-index-change ${portfolioMetrics.todayPnLPct >= 0 ? 'up' : 'down'}`}>
            {portfolioMetrics.todayPnLPct >= 0 ? '▲' : '▼'} {Math.abs(portfolioMetrics.todayPnLPct).toFixed(2)}%
          </span>
        </div>

        <div className="mkt-index-chip" id="index-portfolio-value">
          <span className="mkt-index-icon">💼</span>
          <div>
            <div className="mkt-index-label">Portfolio Value</div>
            <div className="mkt-index-value mono">
              ₹{portfolioMetrics.portfolioValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        <div className="mkt-index-chip" id="index-watchlist-count">
          <span className="mkt-index-icon">👁</span>
          <div>
            <div className="mkt-index-label">Watchlist</div>
            <div className="mkt-index-value">{watchlistItems.length} Stocks</div>
          </div>
          {connected != null && (
            <span className={`mkt-index-status ${connected ? 'live' : 'off'}`}>
              {connected ? '● Live' : '● Off'}
            </span>
          )}
        </div>

        {lastUpdated && (
          <div className="mkt-indices-refresh">
            <button id="refresh-btn" className="refresh-btn" onClick={onRefresh} title="Refresh prices">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
            </button>
            <span className="mkt-last-updated">{new Date(lastUpdated).toLocaleTimeString('en-IN')}</span>
          </div>
        )}
      </section>

      <div className="dashboard-content">
        {/* ── 2-column main layout ── */}
        <div className="dash-grid">

          {/* ═══ LEFT COLUMN ═══ */}
          <div className="dash-col-left">

            {/* My Watchlist */}
            <section className="dash-card" aria-label="My watchlist" id="watchlist-card">
              <div className="dash-card-header">
                <span className="dash-card-title">My Watchlist</span>
                <button
                  id="manage-watchlist-btn"
                  className="dash-card-action"
                  onClick={() => navigate('/watchlist')}
                >
                  Manage →
                </button>
              </div>

              <div className="watchlist-rows">
                {enrichedWatchlist.length === 0 ? (
                  <div className="empty-state">No stocks in watchlist</div>
                ) : (
                  enrichedWatchlist.map(item => (
                    <button
                      key={item.symbol}
                      id={`wl-${item.symbol}`}
                      className="wl-row"
                      onClick={() => openChart(item.symbol)}
                    >
                      <div className="wl-symbol-badge">{item.symbol.replace('.NS', '').replace('.BSE', '')}</div>
                      <div className="wl-info">
                        <span className="wl-name">{item.name}</span>
                        <span className="wl-symbol-full">{item.symbol}</span>
                      </div>
                      <div className="wl-prices">
                        <span className="wl-price mono">
                          {item.price > 0 ? `₹${item.price.toFixed(2)}` : '—'}
                        </span>
                        <span className={`wl-change ${item.changePct >= 0 ? 'up' : 'down'}`}>
                          {item.changePct >= 0 ? '▲' : '▼'} {Math.abs(item.changePct).toFixed(2)}%
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>

            {/* Recent Transactions */}
            <section className="dash-card" aria-label="Recent transactions" id="recent-transactions-card">
              <div className="dash-card-header">
                <span className="dash-card-title">Recent Transactions</span>
                <button
                  id="view-all-txns-btn"
                  className="dash-card-action"
                  onClick={() => navigate('/transactions')}
                >
                  View All →
                </button>
              </div>

              <div className="txn-rows">
                {recentTransactions.length === 0 ? (
                  <div className="empty-state">No transactions yet — start trading!</div>
                ) : (
                  recentTransactions.map(tx => (
                    <div key={tx.id} className="txn-row">
                      <button
                        className="txn-symbol"
                        id={`txn-chart-${tx.id}`}
                        onClick={() => openChart(tx.stock_symbol)}
                      >
                        {tx.stock_symbol.replace('.NS', '')}
                      </button>
                      <span className={`txn-type ${tx.transaction_type === 'BUY' ? 'buy' : 'sell'}`}>
                        {tx.transaction_type}
                      </span>
                      <span className="txn-detail mono">
                        {tx.quantity} × ₹{Number(tx.price).toFixed(2)}
                      </span>
                      <span className="txn-total mono">
                        ₹{Number(tx.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                      <span className="txn-time">{timeAgo(tx.created_at)}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* ═══ RIGHT COLUMN ═══ */}
          <div className="dash-col-right">

            {/* Portfolio Summary */}
            <section className="dash-card" aria-label="Portfolio summary" id="portfolio-summary-card">
              <div className="dash-card-header">
                <span className="dash-card-title">Portfolio Summary</span>
                <button
                  id="view-portfolio-btn"
                  className="dash-card-action"
                  onClick={() => navigate('/portfolio')}
                >
                  Details →
                </button>
              </div>

              <div className="portfolio-stats">
                <div className="ps-stat">
                  <span className="ps-stat-label">Invested</span>
                  <span className="ps-stat-value mono">₹{portfolioMetrics.invested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="ps-stat">
                  <span className="ps-stat-label">Current Value</span>
                  <span className="ps-stat-value mono primary">₹{portfolioMetrics.portfolioValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="ps-stat">
                  <span className="ps-stat-label">Total P/L</span>
                  <span className={`ps-stat-value mono ${portfolioMetrics.totalPnL >= 0 ? 'up' : 'down'}`}>
                    {portfolioMetrics.totalPnL >= 0 ? '+' : ''}₹{Math.abs(portfolioMetrics.totalPnL).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="ps-stat">
                  <span className="ps-stat-label">Cash Balance</span>
                  <span className="ps-stat-value mono">₹{walletBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              </div>

              {/* Holdings allocation mini-bars */}
              {holdings.length > 0 && (
                <div className="ps-allocation">
                  <div className="ps-alloc-label">Holdings Allocation</div>
                  {holdings.slice(0, 4).map(h => {
                    const price = mergedPrices[h.stock_symbol]?.price ?? h.average_buy_price;
                    const val = price * h.quantity;
                    const pct = portfolioMetrics.portfolioValue > 0 ? (val / portfolioMetrics.portfolioValue) * 100 : 0;
                    return (
                      <div key={h.stock_symbol} className="ps-alloc-row">
                        <button
                          className="ps-alloc-symbol"
                          id={`alloc-chart-${h.stock_symbol}`}
                          onClick={() => openChart(h.stock_symbol)}
                        >
                          {h.stock_symbol.replace('.NS', '')}
                        </button>
                        <div className="ps-alloc-bar-track">
                          <div className="ps-alloc-bar-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className="ps-alloc-pct mono">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Today's Top Movers */}
            <section className="dash-card" aria-label="Top movers" id="top-movers-card">
              <div className="dash-card-header">
                <span className="dash-card-title">Today's Top Movers</span>
                <span className="dash-card-subtitle">From your watchlist</span>
              </div>

              {topMovers.gainers.length > 0 && (
                <div className="movers-section">
                  <div className="movers-section-label up">▲ Gainers</div>
                  {topMovers.gainers.map(s => (
                    <button key={s.symbol} id={`gainer-${s.symbol}`} className="mover-row" onClick={() => openChart(s.symbol)}>
                      <span className="mover-symbol">{s.symbol.replace('.NS', '')}</span>
                      <span className="mover-price mono">₹{s.price.toFixed(2)}</span>
                      <span className="mover-change up">+{s.changePct.toFixed(2)}%</span>
                    </button>
                  ))}
                </div>
              )}

              {topMovers.losers.length > 0 && (
                <div className="movers-section">
                  <div className="movers-section-label down">▼ Losers</div>
                  {topMovers.losers.map(s => (
                    <button key={s.symbol} id={`loser-${s.symbol}`} className="mover-row" onClick={() => openChart(s.symbol)}>
                      <span className="mover-symbol">{s.symbol.replace('.NS', '')}</span>
                      <span className="mover-price mono">₹{s.price.toFixed(2)}</span>
                      <span className="mover-change down">{s.changePct.toFixed(2)}%</span>
                    </button>
                  ))}
                </div>
              )}

              {topMovers.gainers.length === 0 && topMovers.losers.length === 0 && (
                <div className="empty-state">Price data loading…</div>
              )}
            </section>

            {/* Quick Actions */}
            <section className="dash-card" aria-label="Quick actions" id="quick-actions-card">
              <div className="dash-card-header">
                <span className="dash-card-title">Quick Actions</span>
              </div>
              <div className="quick-actions-grid">
                <button id="qa-charts" className="qa-btn" onClick={() => navigate('/chart/RELIANCE.NS')}>
                  <span className="qa-icon">📊</span>
                  <span className="qa-label">View Charts</span>
                </button>
                <button id="qa-watchlist" className="qa-btn" onClick={() => navigate('/watchlist')}>
                  <span className="qa-icon">+</span>
                  <span className="qa-label">Add to Watchlist</span>
                </button>
                <button id="qa-portfolio" className="qa-btn" onClick={() => navigate('/portfolio')}>
                  <span className="qa-icon">💼</span>
                  <span className="qa-label">Portfolio</span>
                </button>
                <button id="qa-transactions" className="qa-btn" onClick={() => navigate('/transactions')}>
                  <span className="qa-icon">📋</span>
                  <span className="qa-label">Transactions</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* ── Footer status bar ── */}
      <footer className="dash-footer">
        <span className="dash-footer-status">
          <span className="dash-footer-dot live" />
          NSE Live
        </span>
        <span className="dash-footer-times">IST 09:15–15:30</span>
        <span className="dash-footer-copy">Yahoo Finance data</span>
      </footer>
    </div>
  );
}
