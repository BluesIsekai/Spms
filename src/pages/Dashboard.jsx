import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStockPolling } from '../hooks/useStockPolling';
import { useAuth } from '../hooks/useAuth.jsx';
import { getFxRatesToINR, getHistoricalData, searchSymbols } from '../services/yahooStockApi';
import { fetchRecentViews, recordRecentView } from '../services/marketFeatureService';
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
import { getCompanyLogo } from '../utils/logos';
import SymbolLogo from '../components/ui/SymbolLogo';
import './Dashboard.css';

const DEFAULT_BALANCE = 100000;

// Popular Indian Stocks as a fallback to form the "Explore" Grid
const DEFAULT_WATCHLIST = [
  { stock_symbol: 'RELIANCE.NS', company_name: 'Reliance Industries' },
  { stock_symbol: 'TCS.NS',      company_name: 'Tata Consultancy Services' },
  { stock_symbol: 'HDFCBANK.NS', company_name: 'HDFC Bank' },
  { stock_symbol: 'ICICIBANK.NS', company_name: 'ICICI Bank' },
  { stock_symbol: 'INFY.NS',     company_name: 'Infosys' },
  { stock_symbol: 'SBIN.NS',     company_name: 'State Bank of India' },
];

// Market indices (Added Bank Nifty)
const INDEX_SYMBOLS = ['^NSEI', '^BSESN', '^NSEBANK', '^DJI', 'YM=F', 'GIFTNIFTY.NS', '^IXIC', '^GSPC', '^N225', '^HSI', '^GDAXI', '^FCHI', '^KS11', '^FTSE'];

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

function StockGrid({ stocks, type = "normal", idPrefix = "", openChart }) {
  if (!stocks || stocks.length === 0) return <div className="gd-empty">No data available</div>;
  return (
    <div className={`gd-stock-grid ${type === 'small' ? 'gd-stock-grid-small' : ''}`}>
      {stocks.map(stock => {
        const isUp = stock.changePct >= 0;
        return (
          <button key={`${idPrefix}-${stock.symbol}`} className={`gd-stock-card ${type === 'small' ? 'small' : ''}`} onClick={() => openChart(stock.symbol)}>
            <div className="gd-stock-icon" style={{ padding: 0, overflow: 'hidden', background: '#fff' }}>
              <img 
                 src={getCompanyLogo(stock.symbol) || `https://ui-avatars.com/api/?name=${encodeURIComponent(stock.symbol.replace(/=F|\.NS|\.BO|-USD/g, ''))}&background=232836&color=fff&size=64`}
                 alt={stock.symbol}
                 style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                 onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(stock.symbol.replace(/=F|\.NS|\.BO|-USD/g, ''))}&background=232836&color=fff&size=64`; }}
              />
            </div>
            <div className="gd-stock-name">{stock.name}</div>
            <div className="gd-stock-price-row">
              <span className="gd-card-price">{stock.price > 0 ? `₹${stock.price.toFixed(2)}` : '—'}</span>
            </div>
            <div className="gd-stock-change-row">
              <span className={`gd-card-change ${isUp ? 'up' : 'down'}`}>
                {isUp ? '+' : ''}{stock.change.toFixed(2)} ({isUp ? '+' : ''}{stock.changePct.toFixed(2)}%)
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function Dashboard({ appPrices = {}, lastUpdated, connected, onRefresh }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Tabs state
  const [activeTab, setActiveTab] = useState('Explore'); // 'Explore', 'Holdings', 'Positions', 'Orders', 'Watchlists'
  const [orderSubTab, setOrderSubTab] = useState('All'); // 'All', 'Completed', 'Pending', 'Cancelled'
  const [topMoversTab, setTopMoversTab] = useState('Gainers'); // 'Gainers', 'Losers'
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced symbol search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setIsSearching(true);
      searchSymbols(searchQuery)
        .then(res => setSearchResults(res || []))
        .catch(() => setSearchResults([]))
        .finally(() => setIsSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Custom LocalStorage Watchlists State
  const [customWatchlists, setCustomWatchlists] = useState([]);
  const [activeWatchlistId, setActiveWatchlistId] = useState('default-db');
  const [isAddingWatchlist, setIsAddingWatchlist] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState('');

  const [isBalanceHidden, setIsBalanceHidden] = useState(false);

  const [holdings, setHoldings]         = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [wallet, setWallet]             = useState(null);
  const [watchlistItems, setWatchlistItems] = useState([]);
  const [fxRates, setFxRates]           = useState({});
  const [prevCloseBySymbol, setPrevCloseBySymbol] = useState({});
  const [recentViewRows, setRecentViewRows] = useState([]);

  // ── Local Storage Custom Watchlists ───────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem('spms_custom_watchlists');
      if (stored) {
        setCustomWatchlists(JSON.parse(stored));
      }
    } catch (e) {}
  }, []);

  const handleAddCustomList = (e) => {
    e.preventDefault();
    if (!newWatchlistName.trim()) return;
    const newList = {
      id: Date.now().toString(),
      name: newWatchlistName.trim(),
      symbols: []
    };
    const updated = [...customWatchlists, newList];
    setCustomWatchlists(updated);
    try { localStorage.setItem('spms_custom_watchlists', JSON.stringify(updated)); } catch(e){}
    setNewWatchlistName('');
    setIsAddingWatchlist(false);
    setActiveWatchlistId(newList.id);
  };

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
        { id: 1, stock_symbol: 'RELIANCE.NS', transaction_type: 'BUY', quantity: 10, price: 2800, status: 'COMPLETED', total_amount: 28000, created_at: new Date(Date.now() - 7200000).toISOString() },
        { id: 2, stock_symbol: 'TCS.NS',      transaction_type: 'BUY', quantity: 5,  price: 3600, status: 'COMPLETED', total_amount: 18000, created_at: new Date(Date.now() - 86400000).toISOString() },
      ]);
      setWallet({ virtual_balance: DEFAULT_BALANCE });
      setWatchlistItems(DEFAULT_WATCHLIST);
      return;
    }

    Promise.all([
      fetchHoldings(user.id),
      fetchTransactions(user.id, 50), // Fetch more for the orders tab
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
      fetchTransactions(user.id, 50).then(setTransactions).catch(() => {})
    );
    const unsub3 = subscribeWallet(user.id, () =>
      fetchWallet(user.id).then(setWallet).catch(() => {})
    );
    const unsub4 = subscribeWatchlist(user.id, () =>
      fetchWatchlist(user.id).then(wl => setWatchlistItems(wl?.length ? wl : DEFAULT_WATCHLIST)).catch(() => {})
    );
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !SUPABASE_CONFIGURED) {
      setRecentViewRows([]);
      return;
    }

    fetchRecentViews(user.id, {
      limit: 7,
      assetTypes: ['EQUITY', 'ETF', 'INDEX', 'FNO', 'COMMODITY', 'CRYPTO'],
    })
      .then((rows) => setRecentViewRows(rows || []))
      .catch(() => setRecentViewRows([]));
  }, [user?.id]);

  // ── Stock price polling ───────────────────────────────────────────────────
  const watchlistSymbols = useMemo(
    () => watchlistItems.map(w => w.stock_symbol || w.yahoo_symbol).filter(Boolean),
    [watchlistItems]
  );
  const heldSymbols = useMemo(() => holdings.map(h => h.stock_symbol), [holdings]);
  const defaultSymbols = DEFAULT_WATCHLIST.map(w => w.stock_symbol);
  
  const allPolled = useMemo(
    () => [...new Set([...watchlistSymbols, ...heldSymbols, ...defaultSymbols, ...INDEX_SYMBOLS])],
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

  // Prev close fallback (for holdings P/L calculation if quote prevClose is missing)
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
    const totalPnLPct = invested > 0 ? (totalPnL / invested) * 100 : 0;
    const todayPnL = portfolioValue - previousCloseValue;
    const todayPnLPct = previousCloseValue > 0 ? (todayPnL / previousCloseValue) * 100 : 0;

    return { portfolioValue, invested, totalPnL, totalPnLPct, todayPnL, todayPnLPct };
  }, [holdings, mergedPrices, fxRates, prevCloseBySymbol]);

  // Use either actual watchlist or default for explore grid
  const exploreStocks = useMemo(() => {
    const source = watchlistItems.length > 0 ? watchlistItems : DEFAULT_WATCHLIST;
    return source.map(item => {
      const sym = item.stock_symbol || item.yahoo_symbol;
      const q = mergedPrices[sym] || {};
      return {
        symbol: sym,
        name: item.company_name || sym.replace('.NS', ''),
        price: q.price || 0,
        change: q.change || 0,
        changePct: q.changePct || 0,
        currency: q.currency || 'INR',
      };
    });
  }, [watchlistItems, mergedPrices]);

  const baseExtended = useMemo(() => {
    return [...exploreStocks, ...exploreStocks, ...exploreStocks];
  }, [exploreStocks]);

  const getSlice = (start) => {
    return baseExtended.slice(start, start + 5);
  };

  const topGainers = useMemo(() => {
    return [...baseExtended].sort((a, b) => b.changePct - a.changePct).filter(s => s.changePct > 0);
  }, [baseExtended]);

  const topLosers = useMemo(() => {
    return [...baseExtended].sort((a, b) => a.changePct - b.changePct).filter(s => s.changePct < 0);
  }, [baseExtended]);

  const topGainersSlice = useMemo(() => topGainers.slice(0, 5), [topGainers]);
  const topLosersSlice = useMemo(() => topLosers.slice(0, 5), [topLosers]);

  const recentlyViewed = useMemo(() => {
    if (!recentViewRows.length) return baseExtended.slice(0, 7);

    const chartableRows = recentViewRows.filter((row) => row.asset_type !== 'MUTUAL_FUND');
    if (!chartableRows.length) return baseExtended.slice(0, 7);

    return chartableRows.map((row) => {
      const symbol = row.yahoo_symbol || row.symbol;
      const quote = mergedPrices[symbol] || {};
      return {
        symbol,
        name: row.company_name || symbol.replace('.NS', '').replace('^', ''),
        price: quote.price || 0,
        change: quote.change || 0,
        changePct: quote.changePct || 0,
        currency: quote.currency || 'INR',
      };
    });
  }, [recentViewRows, baseExtended, mergedPrices]);
  const mostBought = useMemo(() => getSlice(3), [baseExtended]);
  const mostTradedMtf = useMemo(() => getSlice(1), [baseExtended]);
  const topIntraday = useMemo(() => getSlice(2), [baseExtended]);
  const volumeShockers = useMemo(() => getSlice(0), [baseExtended]);
  const sectorsTrending = useMemo(() => getSlice(5), [baseExtended]);
  const mostBoughtEtfs = useMemo(() => getSlice(4), [baseExtended]);

  // Orders filtering
  const filteredOrders = useMemo(() => {
    if (orderSubTab === 'All') return transactions;
    if (orderSubTab === 'Completed') return transactions; // DB currently only stores completed ones
    return []; // Pending / Cancelled will be empty
  }, [transactions, orderSubTab]);

  // Market indices
  const indices = [
    { label: 'NIFTY 50', symbol: '^NSEI', data: mergedPrices['^NSEI'] },
    { label: 'SENSEX', symbol: '^BSESN', data: mergedPrices['^BSESN'] },
    { label: 'BANK NIFTY', symbol: '^NSEBANK', data: mergedPrices['^NSEBANK'] },
  ];

  const globalIndices = [
    { label: 'GIFT Nifty',  symbol: 'GIFTNIFTY.NS', data: mergedPrices['GIFTNIFTY.NS'] },
    { label: 'Dow Jones',  symbol: '^DJI',          data: mergedPrices['^DJI'] },
    { label: 'Dow Futures',symbol: 'YM=F',          data: mergedPrices['YM=F'] },
    { label: 'S&P 500',    symbol: '^GSPC',         data: mergedPrices['^GSPC'] },
    { label: 'NASDAQ',     symbol: '^IXIC',         data: mergedPrices['^IXIC'] },
    { label: 'Nikkei 225', symbol: '^N225',         data: mergedPrices['^N225'] },
    { label: 'Hang Seng',  symbol: '^HSI',          data: mergedPrices['^HSI'] },
    { label: 'DAX',        symbol: '^GDAXI',        data: mergedPrices['^GDAXI'] },
    { label: 'CAC 40',     symbol: '^FCHI',         data: mergedPrices['^FCHI'] },
    { label: 'KOSPI',      symbol: '^KS11',         data: mergedPrices['^KS11'] },
    { label: 'FTSE 100',   symbol: '^FTSE',         data: mergedPrices['^FTSE'] },
  ];

  const openChart = (symbol) => {
    void recordRecentView(user?.id, symbol, {
      companyName: symbol.replace('.NS', '').replace('^', ''),
      sourcePage: 'dashboard',
    });
    navigate(`/chart/${encodeURIComponent(symbol)}`);
  };

  return (
    <div className="groww-dashboard">
      {/* ── TOP BAR ── */}
      <header className="gd-topbar">
        <div className="gd-indices-scroll">
          {indices.map((idx) => {
            const price = idx.data?.price;
            const changePct = idx.data?.changePct || 0;
            const change = idx.data?.change || 0;
            const isUp = changePct >= 0;
            return (
              <div key={idx.label} className="gd-index-card" onClick={() => navigate(`/chart/${encodeURIComponent(idx.symbol)}`)} style={{ cursor: 'pointer' }}>
                <span className="gd-index-name">{idx.label}</span>
                <div className="gd-index-values">
                  <span className="gd-index-price">
                    {price ? price.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}
                  </span>
                  {idx.data && (
                    <span className={`gd-index-change ${isUp ? 'up' : 'down'}`}>
                      {isUp ? '+' : ''}{change.toFixed(2)} ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          <div
            className="gd-index-card gd-global-trigger"
            onClick={() => navigate('/global-indices')}
            style={{ cursor: 'pointer' }}
          >
            <span className="gd-index-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Global Indices
              <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
            </span>
            <span className="gd-index-price" style={{ color: '#666', fontSize: 11 }}>11 markets</span>
          </div>
        </div>
        
        <div className="gd-topbar-actions">
          <div className="gd-search-container">
              <svg width="16" height="16" fill="none" stroke="#555" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                className="gd-search-input"
                placeholder="Search stocks, ETFs, indices…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery.trim().length > 0 && (
                <button className="gd-icon-btn" style={{ padding: 0 }} onClick={() => { setSearchQuery(''); setSearchResults([]); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              )}

              {(searchQuery.trim().length > 0) && (
                <div className="gd-search-dropdown" style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '12px',
                  marginTop: '6px', zIndex: 1000, maxHeight: '460px', overflowY: 'auto',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.7)'
                }}>
                  {isSearching ? (
                    <div style={{ padding: '20px', color: '#666', fontSize: '13px', textAlign: 'center' }}>Searching market…</div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map(res => (
                      <div
                        key={res.symbol}
                        style={{
                          padding: '14px 20px', display: 'flex', alignItems: 'center',
                          gap: '16px', cursor: 'pointer',
                          borderBottom: '1px solid #232323', transition: 'background 0.15s'
                        }}
                        onClick={() => { setSearchQuery(''); setSearchResults([]); openChart(res.symbol); }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#242424'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        {/* Logo — bigger, fixed size, no shrink */}
                        <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 8, overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <SymbolLogo symbol={res.symbol} size={44} />
                        </div>
                        {/* Name + meta */}
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ fontSize: '15px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{res.shortname || res.longname || res.symbol}</span>
                          <span style={{ fontSize: '12px', color: '#666' }}>{res.symbol} &nbsp;·&nbsp; {res.exchDisp || res.exchange} &nbsp;·&nbsp; <span style={{ color: '#444' }}>{res.quoteType}</span></span>
                        </div>
                        {/* Arrow hint */}
                        <svg style={{ flexShrink: 0, color: '#444' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '20px', color: '#555', fontSize: '13px', textAlign: 'center' }}>No symbols found</div>
                  )}
                </div>
              )}
            </div>
          <button className="gd-icon-btn gd-profile-btn" onClick={() => navigate('/settings')} title="Profile">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </button>
        </div>
      </header>

      {/* ── TABS NAVIGATION ── */}
      <nav className="gd-tabs-nav">
        {['Explore', 'Holdings', 'Positions', 'Orders', 'Watchlists'].map(tab => (
          <button
            key={tab}
            className={`gd-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      <main className="gd-content">
        {/* ════════ EXPLORE TAB ════════ */}
        {activeTab === 'Explore' && (
          <div className="gd-tab-panel">
            <div className="gd-explore-vertical">
              {/* Recently Viewed */}
              <section className="gd-explore-section">
                <h2 className="gd-section-title">Recently Viewed</h2>
                <StockGrid stocks={recentlyViewed} type="small" idPrefix="rv" openChart={openChart} />
              </section>

              {/* Most Bought */}
              <section className="gd-explore-section">
                <div className="gd-section-header-split">
                  <h2 className="gd-section-title">Most Bought</h2>
                  <button className="gd-see-more-btn" onClick={() => navigate('/explore/most-bought')}>See More</button>
                </div>
                <StockGrid stocks={mostBought} idPrefix="mb" openChart={openChart} />
              </section>

              {/* Top Movers Today */}
              <section className="gd-explore-section">
                <div className="gd-section-header-split">
                  <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                    <h2 className="gd-section-title">Top Movers Today</h2>
                    <div className="gd-inline-tabs">
                       <button className={topMoversTab === 'Gainers' ? "active" : ""} onClick={() => setTopMoversTab('Gainers')}>Gainers</button>
                       <button className={topMoversTab === 'Losers' ? "active" : ""} onClick={() => setTopMoversTab('Losers')}>Losers</button>
                    </div>
                  </div>
                  <button className="gd-see-more-btn" onClick={() => navigate('/explore/top-movers')}>See More</button>
                </div>
                <StockGrid stocks={topMoversTab === 'Gainers' ? topGainersSlice : topLosersSlice} idPrefix="tm" openChart={openChart} />
              </section>

              {/* Most Traded in MTF */}
              <section className="gd-explore-section">
                <div className="gd-section-header-split">
                  <h2 className="gd-section-title">Most Traded in MTF</h2>
                  <button className="gd-see-more-btn" onClick={() => navigate('/explore/most-traded-mtf')}>See More</button>
                </div>
                <StockGrid stocks={mostTradedMtf} idPrefix="mtf" openChart={openChart} />
              </section>

              {/* Top Intraday */}
              <section className="gd-explore-section">
                <div className="gd-section-header-split">
                  <h2 className="gd-section-title">Top Intraday</h2>
                  <button className="gd-see-more-btn" onClick={() => navigate('/explore/top-intraday')}>See More</button>
                </div>
                <StockGrid stocks={topIntraday} idPrefix="ti" openChart={openChart} />
              </section>

              {/* Volume Shockers */}
              <section className="gd-explore-section">
                <div className="gd-section-header-split">
                  <h2 className="gd-section-title">Volume Shockers</h2>
                  <button className="gd-see-more-btn" onClick={() => navigate('/explore/volume-shockers')}>See More</button>
                </div>
                <StockGrid stocks={volumeShockers} idPrefix="vs" openChart={openChart} />
              </section>

              {/* Sectors Trending Today */}
              <section className="gd-explore-section">
                <div className="gd-section-header-split">
                  <h2 className="gd-section-title">Sectors Trending Today</h2>
                  <button className="gd-see-more-btn" onClick={() => navigate('/explore/sectors-trending')}>See More</button>
                </div>
                <StockGrid stocks={sectorsTrending} idPrefix="st" openChart={openChart} />
              </section>

              {/* Most Bought ETFs */}
              <section className="gd-explore-section">
                <div className="gd-section-header-split">
                  <h2 className="gd-section-title">Most Bought ETFs</h2>
                  <button className="gd-see-more-btn" onClick={() => navigate('/explore/most-bought-etfs')}>See More</button>
                </div>
                <StockGrid stocks={mostBoughtEtfs} idPrefix="mbetf" openChart={openChart} />
              </section>
            </div>
          </div>
        )}

        {/* ════════ HOLDINGS TAB ════════ */}
        {activeTab === 'Holdings' && (
          <div className="gd-tab-panel">
            {/* Portfolio Overview */}
            <div className="gd-portfolio-card-v2">
              <div className="gd-pc-top">
                <div className="gd-pc-current-value">
                   Current Value
                   <span className="gd-pc-big-val">
                     {isBalanceHidden ? '••••••' : `₹${portfolioMetrics.portfolioValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                   </span>
                </div>
                <button className="gd-eye-btn" onClick={() => setIsBalanceHidden(!isBalanceHidden)} title={isBalanceHidden ? "Show balances" : "Hide balances"}>
                   {isBalanceHidden ? (
                     <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/></svg>
                   ) : (
                     <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                   )}
                </button>
              </div>

              <div className="gd-pc-metrics">
                 <div className="gd-pc-metric-row">
                    <span className="gd-pc-label">1D returns</span>
                    <span className={`gd-pc-val ${portfolioMetrics.todayPnL >= 0 ? 'up' : 'down'}`}>
                       {isBalanceHidden ? '••••••' : (
                         <>{portfolioMetrics.todayPnL >= 0 ? '+' : '−'}₹{Math.abs(portfolioMetrics.todayPnL).toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({portfolioMetrics.todayPnL >= 0 ? '+' : '−'}{Math.abs(portfolioMetrics.todayPnLPct).toFixed(2)}%)</>
                       )}
                    </span>
                 </div>
                 <div className="gd-pc-metric-row">
                    <span className="gd-pc-label">Total returns</span>
                    <span className={`gd-pc-val ${portfolioMetrics.totalPnL >= 0 ? 'up' : 'down'}`}>
                       {isBalanceHidden ? '••••••' : (
                         <>{portfolioMetrics.totalPnL >= 0 ? '+' : '−'}₹{Math.abs(portfolioMetrics.totalPnL).toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({portfolioMetrics.totalPnL >= 0 ? '+' : '−'}{Math.abs(portfolioMetrics.totalPnLPct).toFixed(2)}%)</>
                       )}
                    </span>
                 </div>
                 <div className="gd-pc-metric-row" style={{ borderBottom: 'none' }}>
                    <span className="gd-pc-label">Invested</span>
                    <span className="gd-pc-val standard">
                       {isBalanceHidden ? '••••••' : `₹${portfolioMetrics.invested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                    </span>
                 </div>
              </div>
            </div>

            {/* Holdings List */}
            <div className="gd-list-container">
              {holdings.length === 0 ? (
                <div className="gd-empty">No delivery holdings yet. Start investing!</div>
              ) : (
                <>
                  <div className="gd-hr-header">
                     <div className="gd-hr-col flex-2 left">Stock Name</div>
                     <div className="gd-hr-col right">Market Price (1D%)</div>
                     <div className="gd-hr-col right">Returns (%)</div>
                     <div className="gd-hr-col right">Current (Invested)</div>
                  </div>
                  {holdings.map(h => {
                    const quote = mergedPrices[h.stock_symbol];
                    const currentPrice = quote?.price ?? Number(h.average_buy_price);
                    const invested = Number(h.quantity) * Number(h.average_buy_price);
                    const currentVal = Number(h.quantity) * currentPrice;
                    const pl = currentVal - invested;
                    const plPct = invested > 0 ? (pl / invested) * 100 : 0;
                    const isUp = pl >= 0;

                    const todayPct = quote?.changePct || 0;
                    const isDayUp = todayPct >= 0;

                    return (
                      <button key={h.stock_symbol} className="gd-holdings-row" onClick={() => openChart(h.stock_symbol)}>
                         <div className="gd-hr-col flex-2 left">
                            <span className="gd-hr-title">{h.stock_symbol.replace('.NS', '')}</span>
                            <span className="gd-hr-subtitle">{h.quantity} shares</span>
                         </div>
                         <div className="gd-hr-col right">
                            <span className="gd-hr-val">{isBalanceHidden ? '••••••' : `₹${currentPrice.toFixed(2)}`}</span>
                            <span className={`gd-hr-sub ${isDayUp ? 'up' : 'down'}`}>{isBalanceHidden ? '••••••' : `(${isDayUp ? '+' : '−'}${Math.abs(todayPct).toFixed(2)}%)`}</span>
                         </div>
                         <div className="gd-hr-col right">
                            <span className={`gd-hr-val ${isUp ? 'up' : 'down'}`}>{isBalanceHidden ? '••••••' : `${isUp ? '+' : '−'}${Math.abs(plPct).toFixed(2)}%`}</span>
                            <span className={`gd-hr-sub ${isUp ? 'up' : 'down'}`}>{isBalanceHidden ? '••••••' : `${isUp ? '+' : '−'}₹${Math.abs(pl).toFixed(2)}`}</span>
                         </div>
                         <div className="gd-hr-col right">
                            <span className="gd-hr-val current">{isBalanceHidden ? '••••••' : `₹${currentVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}</span>
                            <span className="gd-hr-sub invested">{isBalanceHidden ? '••••••' : `(₹${invested.toLocaleString('en-IN', { maximumFractionDigits: 0 })})`}</span>
                         </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}

        {/* ════════ ORDERS TAB ════════ */}
        {activeTab === 'Orders' && (
          <div className="gd-tab-panel">
            {/* Orders Sub Navigation */}
            <div className="gd-subtabs">
              {['All', 'Completed', 'Pending', 'Cancelled'].map(sub => (
                <button
                  key={sub}
                  className={`gd-subtab ${orderSubTab === sub ? 'active' : ''}`}
                  onClick={() => setOrderSubTab(sub)}
                >
                  {sub}
                </button>
              ))}
            </div>

            {/* Orders List */}
            <div className="gd-list-container">
              {filteredOrders.length === 0 ? (
                <div className="gd-empty">No {orderSubTab.toLowerCase()} orders found.</div>
              ) : (
                filteredOrders.map(tx => (
                  <div key={tx.id} className="gd-order-item">
                    <div className="gd-order-header">
                      <div className="gd-order-title">
                        <span className={`gd-order-type ${tx.transaction_type === 'BUY' ? 'buy' : 'sell'}`}>
                          {tx.transaction_type}
                        </span>
                        <span>{tx.stock_symbol.replace('.NS', '')}</span>
                      </div>
                      <div className="gd-order-status completed">
                        {tx.status || 'Successful'}
                      </div>
                    </div>
                    <div className="gd-order-details">
                      <div className="gd-od-item">
                        <span className="gd-od-label">Qty</span>
                        <span className="gd-od-val">{tx.quantity}</span>
                      </div>
                      <div className="gd-od-item">
                        <span className="gd-od-label">Price</span>
                        <span className="gd-od-val">₹{Number(tx.price).toFixed(2)}</span>
                      </div>
                      <div className="gd-od-item right">
                        <span className="gd-od-label">Executed</span>
                        <span className="gd-od-val">{timeAgo(tx.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ════════ POSITIONS TAB ════════ */}
        {activeTab === 'Positions' && (
          <div className="gd-tab-panel">
            <div className="gd-list-container" style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>
               <svg width="48" height="48" fill="none" stroke="#444" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: '16px' }}>
                 <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
               </svg>
               <h3 style={{ color: '#E0E0E0', fontSize: '18px', marginBottom: '8px' }}>No Open Positions</h3>
               <p style={{ fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>
                 You currently do not have any open intraday or F&O positions. Your delivery investments are available in the Holdings tab.
               </p>
            </div>
          </div>
        )}

        {/* ════════ WATCHLISTS TAB ════════ */}
        {activeTab === 'Watchlists' && (
          <div className="gd-tab-panel">
            <div className="gd-subtabs" style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
              <button 
                className={`gd-subtab ${activeWatchlistId === 'default-db' ? 'active' : ''}`}
                onClick={() => setActiveWatchlistId('default-db')}
              >
                Synced Watchlist
              </button>
              
              {customWatchlists.map(list => (
                <button 
                  key={list.id}
                  className={`gd-subtab ${activeWatchlistId === list.id ? 'active' : ''}`}
                  onClick={() => setActiveWatchlistId(list.id)}
                >
                  {list.name}
                </button>
              ))}

              {isAddingWatchlist ? (
                <form onSubmit={handleAddCustomList} style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
                  <input 
                    autoFocus
                    type="text" 
                    value={newWatchlistName}
                    onChange={e => setNewWatchlistName(e.target.value)}
                    placeholder="List name"
                    style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #333', background: '#111', color: '#fff', fontSize: '14px', outline: 'none' }}
                  />
                  <button type="submit" style={{ background: '#00D09C', color: '#000', border: 'none', borderRadius: '4px', padding: '0 12px', fontSize: '14px', cursor: 'pointer', fontWeight: 600 }}>Create</button>
                  <button type="button" onClick={() => setIsAddingWatchlist(false)} style={{ background: '#333', color: '#fff', border: 'none', borderRadius: '4px', padding: '0 12px', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
                </form>
              ) : (
                <button 
                  className="gd-subtab"
                  style={{ border: '1px dashed #555', background: 'transparent' }}
                  onClick={() => setIsAddingWatchlist(true)}
                >
                  + Add Watchlist
                </button>
              )}
            </div>

            <div className="gd-list-container" style={{ marginTop: '24px' }}>
              {activeWatchlistId === 'default-db' ? (
                watchlistItems.length === 0 ? (
                  <div className="gd-empty">No stocks in your primary watchlist. Use the search bar to find and add stocks.</div>
                ) : (
                  exploreStocks.map(stock => {
                    const isUp = stock.changePct >= 0;
                    return (
                      <button key={stock.symbol} className="gd-list-item" onClick={() => openChart(stock.symbol)}>
                        <div className="gd-item-left">
                          <SymbolLogo symbol={stock.symbol} size={40} className="gd-icon-square" />
                          <div style={{ textAlign: 'left' }}>
                            <div className="gd-item-title">{stock.symbol.replace('.NS', '')}</div>
                            <div className="gd-item-subtitle">{stock.name}</div>
                          </div>
                        </div>
                        <div className="gd-item-right" style={{ textAlign: 'right' }}>
                          <div className="gd-item-val">{stock.price ? `₹${stock.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}</div>
                          <div className={`gd-item-pl ${isUp ? 'up' : 'down'}`}>
                            {isUp ? '+' : ''}{stock.change.toFixed(2)} ({isUp ? '+' : ''}{stock.changePct.toFixed(2)}%)
                          </div>
                        </div>
                      </button>
                    )
                  })
                )
              ) : (
                <div className="gd-empty" style={{ padding: '40px 0' }}>
                  This custom watchlist is currently empty.
                  <br/><span style={{ fontSize: '13px', color: '#555', marginTop: '8px', display: 'block' }}>(Feature integration pending)</span>
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
