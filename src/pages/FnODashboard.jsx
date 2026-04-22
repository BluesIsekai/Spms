import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStockPolling } from '../hooks/useStockPolling';
import { searchSymbols } from '../services/yahooStockApi';
import { useAuth } from '../hooks/useAuth.jsx';
import { recordRecentView } from '../services/marketFeatureService';
import { getCompanyLogo } from '../utils/logos';
import SymbolLogo from '../components/ui/SymbolLogo';
import './FnODashboard.css';

const INDEX_SYMBOLS = ['^NSEI', '^BSESN', '^NSEBANK', '^DJI', 'YM=F', 'GIFTNIFTY.NS', '^IXIC', '^GSPC', '^N225', '^HSI', '^GDAXI', '^FCHI', '^KS11', '^FTSE'];

const COMMODITIES = [
  { symbol: 'CL=F', name: 'Crude Oil',   icon: '🛢️' },
  { symbol: 'GC=F', name: 'Gold',        icon: '🪙' },
  { symbol: 'SI=F', name: 'Silver',      icon: '🔘' },
  { symbol: 'NG=F', name: 'Natural Gas', icon: '🔥' },
];

const EQUITY_FUTURES = [
  { symbol: 'RELIANCE.NS', name: 'RELIANCE' },
  { symbol: 'HDFCBANK.NS', name: 'HDFCBANK' },
  { symbol: 'INFY.NS',     name: 'INFY' },
  { symbol: 'TCS.NS',      name: 'TCS' },
];

const INDEX_FUTURES = [
  { symbol: 'NQ=F', name: 'Nasdaq 100 Futures' },
  { symbol: 'ES=F', name: 'S&P 500 Futures' },
  { symbol: 'YM=F', name: 'Dow Futures' },
  { symbol: 'RTY=F', name: 'Russell 2000 Futures' },
];

const MOVERS = [
  { symbol: 'BTC-USD', name: 'Bitcoin' },
  { symbol: 'ETH-USD', name: 'Ethereum' },
  { symbol: 'NVDA',    name: 'NVIDIA' },
  { symbol: 'TSLA',    name: 'Tesla' },
];

const ALL_SYMBOLS = [
  ...INDEX_SYMBOLS,
  'USDINR=X',
  ...COMMODITIES.map(c => c.symbol),
  ...EQUITY_FUTURES.map(e => e.symbol),
  ...INDEX_FUTURES.map(i => i.symbol),
  ...MOVERS.map(m => m.symbol)
];

function GridCard({ item, openChart }) {
  if (!item) return null;
  const isUp = item.changePct >= 0;
  return (
    <div className="gd-card" onClick={() => openChart(item.symbol)}>
      <div className="gd-card-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="gd-fno-icon">
            <img 
               src={getCompanyLogo(item.symbol) || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.symbol.replace(/=F|\.NS|-USD/g, ''))}&background=232836&color=fff&size=64`}
               alt={item.symbol}
               style={{ width: '100%', height: '100%', objectFit: 'contain' }}
               onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.symbol.replace(/=F|\.NS|-USD/g, ''))}&background=232836&color=fff&size=64`; }}
            />
          </div>
          <div>
            <div className="gd-symbol">{item.symbol.replace('=F', '').replace('.NS', '')}</div>
            <div className="gd-name">{item.name}</div>
          </div>
        </div>
      </div>
      <div className="gd-price-block">
        <span className="gd-price">{item.price > 0 ? `₹${item.price.toFixed(2)}` : '—'}</span>
        <span className={`gd-change ${isUp ? 'up' : 'down'}`}>
          {isUp ? '+' : ''}{item.change.toFixed(2)} ({isUp ? '+' : ''}{item.changePct.toFixed(2)}%)
        </span>
      </div>
    </div>
  );
}

function CommoditySimpleCard({ item, openChart }) {
  if (!item) return null;
  return (
    <div className="gd-commodity-simple" onClick={() => openChart(item.symbol)}>
      <div className="commodity-icon">{item.icon}</div>
      <div className="commodity-name">{item.name}</div>
      <div className="commodity-price">{item.price > 0 ? `₹${item.price.toFixed(2)}` : '—'}</div>
    </div>
  );
}

export default function FnODashboard({ appPrices = {} }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Top Bar State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Tabs state
  const [activeTab, setActiveTab] = useState('Explore'); // 'Explore', 'Positions', 'Orders', 'Watchlists'
  const [tradedTab, setTradedTab] = useState('Equity'); // 'Equity', 'Commodities'

  const { prices: poolPrices } = useStockPolling(ALL_SYMBOLS, 10_000);
  const prices = useMemo(() => ({ ...poolPrices, ...appPrices }), [poolPrices, appPrices]);

  const usdInrRate = prices['USDINR=X']?.price || 83.50; // Fallback to 83.50 if not loaded

  const mapPrices = (arr) => arr.map(meta => ({
    ...meta,
    price: prices[meta.symbol]?.price ?? 0,
    change: prices[meta.symbol]?.change ?? 0,
    changePct: prices[meta.symbol]?.changePct ?? 0,
  }));

  const mapMcxCommodities = (arr) => arr.map(meta => {
    const rawPrice = prices[meta.symbol]?.price ?? 0;
    const rawChange = prices[meta.symbol]?.change ?? 0;
    const changePct = prices[meta.symbol]?.changePct ?? 0;

    let inrPrice = 0;
    let inrChange = 0;

    if (rawPrice > 0) {
       // Direct INR translation
       inrPrice = rawPrice * usdInrRate;
       inrChange = rawChange * usdInrRate;

       // MCX Scale Formatting & Import Duty
       if (meta.symbol === 'GC=F') {
         // Troy Ounce to 10 Grams + ~15% Indian Bullion Import Duty & Premium
         inrPrice = (inrPrice / 3.11035) * 1.15;
         inrChange = (inrChange / 3.11035) * 1.15;
       } else if (meta.symbol === 'SI=F') {
         // Troy Ounce to 1 KG + ~15% Indian Bullion Import Duty & Premium
         inrPrice = (inrPrice * 32.1507) * 1.15;
         inrChange = (inrChange * 32.1507) * 1.15;
       }
       // Crude Oil (CL) and Nat Gas (NG) remain 1:1 volume size, just INR converted
    }

    return {
      ...meta,
      price: inrPrice,
      change: inrChange,
      changePct: changePct,
    };
  });

  const commoditiesData = mapMcxCommodities(COMMODITIES);
  const equityFuturesData = mapPrices(EQUITY_FUTURES);
  const indexFuturesData = mapPrices(INDEX_FUTURES);
  const moversData = mapPrices(MOVERS);

  // Top Bar indices definitions
  const domesticIndices = [
    { label: 'NIFTY 50', symbol: '^NSEI', data: prices['^NSEI'] },
    { label: 'SENSEX', symbol: '^BSESN', data: prices['^BSESN'] },
    { label: 'BANK NIFTY', symbol: '^NSEBANK', data: prices['^NSEBANK'] },
  ];


  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setIsSearching(true);
      searchSymbols(searchQuery)
        .then(res => {
          setSearchResults(res || []);
        })
        .catch(() => setSearchResults([]))
        .finally(() => setIsSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleOpenChart = (symbol) => {
    void recordRecentView(user?.id, symbol, {
      companyName: symbol.replace('.NS', '').replace('=F', ''),
      sourcePage: 'fno',
    });
    navigate(`/chart/${encodeURIComponent(symbol)}`);
  };

  return (
    <div className="fno-dashboard-page groww-dashboard">
      {/* ── TOP BAR (Mirrored from Dashboard) ── */}
      <header className="gd-topbar">
        <div className="gd-indices-scroll">
          {domesticIndices.map((idx) => {
            const price = idx.data?.price;
            const changePct = idx.data?.changePct || 0;
            const change = idx.data?.change || 0;
            const isUp = changePct >= 0;
            return (
              <div key={idx.label} className="gd-index-card" onClick={() => handleOpenChart(idx.symbol)} style={{ cursor: 'pointer' }}>
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
                        onClick={() => { setSearchQuery(''); setSearchResults([]); handleOpenChart(res.symbol); }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#242424'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 8, overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <SymbolLogo symbol={res.symbol} size={44} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ fontSize: '15px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{res.shortname || res.longname || res.symbol}</span>
                          <span style={{ fontSize: '12px', color: '#666' }}>{res.symbol} &nbsp;·&nbsp; {res.exchDisp || res.exchange} &nbsp;·&nbsp; <span style={{ color: '#444' }}>{res.quoteType}</span></span>
                        </div>
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

      {/* ── Sub Navigation Tabs ── */}
      <div className="db-tab-nav-container">
        <div className="db-tab-nav">
          {['Explore', 'Positions', 'Orders', 'Watchlists'].map(tab => (
            <button
              key={tab}
              className={`db-tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="db-content">
        <div className="db-content-inner">
          {activeTab === 'Explore' && (
            <div className="explore-grid">
              
              {/* 1. Commodities - Simple layout as requested */}
              <div className="db-section">
                <div className="db-section-header">
                  <span className="db-section-title">Commodities</span>
                  <button className="db-view-all">View All</button>
                </div>
                <div className="gd-grid-horizontal">
                  {commoditiesData.map(item => (
                    <CommoditySimpleCard key={item.symbol} item={item} openChart={handleOpenChart} />
                  ))}
                </div>
              </div>

              {/* 2. Top Traded (Switcher) */}
              <div className="db-section">
                <div className="section-subtabs">
                  {['Equity', 'Commodities'].map(t => (
                    <button
                      key={t}
                      className={`subtab-btn ${tradedTab === t ? 'active' : ''}`}
                      onClick={() => setTradedTab(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="gd-grid-horizontal">
                  {(tradedTab === 'Equity' ? equityFuturesData : commoditiesData).map(item => (
                    <GridCard key={item.symbol} item={item} openChart={handleOpenChart} />
                  ))}
                </div>
              </div>

              {/* 3. Top Traded Commodity Futures */}
              <div className="db-section">
                <div className="db-section-header">
                  <span className="db-section-title">Top traded commodity futures</span>
                </div>
                <div className="gd-grid-horizontal">
                  {commoditiesData.map(item => (
                    <GridCard key={`cf-${item.symbol}`} item={item} openChart={handleOpenChart} />
                  ))}
                </div>
              </div>

              {/* 4. Top Movers */}
              <div className="db-section">
                <div className="db-section-header">
                  <span className="db-section-title">Top Movers</span>
                </div>
                <div className="gd-grid-horizontal">
                  {moversData.map(item => (
                    <GridCard key={item.symbol} item={item} openChart={handleOpenChart} />
                  ))}
                </div>
              </div>

              {/* 5. Top Traded Index Futures */}
              <div className="db-section">
                <div className="db-section-header">
                  <span className="db-section-title">Top traded index futures</span>
                </div>
                <div className="gd-grid-horizontal">
                  {indexFuturesData.map(item => (
                    <GridCard key={item.symbol} item={item} openChart={handleOpenChart} />
                  ))}
                </div>
              </div>

              {/* 6. Top Traded Stock Futures */}
              <div className="db-section">
                <div className="db-section-header">
                  <span className="db-section-title">Top traded stock futures</span>
                </div>
                <div className="gd-grid-horizontal">
                  {equityFuturesData.map(item => (
                    <GridCard key={item.symbol} item={item} openChart={handleOpenChart} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Positions' && <div className="gd-empty">You have no open F&O positions.</div>}
          {activeTab === 'Orders' && <div className="gd-empty">No F&O orders found.</div>}
          {activeTab === 'Watchlists' && <div className="gd-empty">Create a custom F&O watchlist to track your favorite derivatives.</div>}

        </div>
      </div>
    </div>
  );
}
