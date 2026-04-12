import { useState, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ErrorBoundary from './components/ErrorBoundary';
import { useStockPolling } from './hooks/useStockPolling';
import Portfolio from './pages/Portfolio';
import Watchlist from './pages/Watchlist';
import Transactions from './pages/Transactions';
import Settings from './pages/Settings';
import './App.css';



// Top-level Indian NSE watchlist — App owns the symbols list
const WATCHLIST_META = [
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries' },
  { symbol: 'TCS.NS',      name: 'Tata Consultancy Services' },
  { symbol: 'INFY.NS',     name: 'Infosys' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank' },
  { symbol: 'SBIN.NS',     name: 'State Bank of India' },
];

const WATCHLIST_SYMBOLS = WATCHLIST_META.map((w) => w.symbol);
const POLL_INTERVAL_MS  = 10_000;

function getPageFromPath(pathname) {
  if (pathname === '/' || pathname === '/dashboard') return 'dashboard';
  if (pathname.startsWith('/portfolio')) return 'portfolio';
  if (pathname.startsWith('/watchlist')) return 'watchlist';
  if (pathname.startsWith('/transactions')) return 'transactions';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'dashboard';
}

function App() {
  const [activeSymbol, setActiveSymbol] = useState('RELIANCE.NS');
  const navigate = useNavigate();
  const location = useLocation();
  const activePage = getPageFromPath(location.pathname);

  // ── Top-level Yahoo Finance polling (shared by Sidebar + Dashboard) ──────
  // Dashboard gets its own granular polling instance for held stocks.
  // Here we only poll the fixed watchlist for the Sidebar.
  const { prices, lastUpdated, connected, refresh } = useStockPolling(
    [activeSymbol, ...WATCHLIST_SYMBOLS],
    POLL_INTERVAL_MS
  );

  // Enrich watchlist with live prices for Sidebar
  const liveWatchlist = useMemo(
    () => WATCHLIST_META.map((item) => ({
      ...item,
      price:     prices[item.symbol]?.price     ?? 0,
      change:    prices[item.symbol]?.change    ?? 0,
      changePct: prices[item.symbol]?.changePct ?? 0,
    })),
    [prices]
  );

  const handleNavigate = (page) => {
    if (page === 'dashboard') navigate('/dashboard');
    if (page === 'portfolio') navigate('/portfolio');
    if (page === 'watchlist') navigate('/watchlist');
    if (page === 'transactions') navigate('/transactions');
    if (page === 'settings') navigate('/settings');
  };

  const handleSymbolClick = (symbol) => {
    setActiveSymbol(symbol);
    navigate('/dashboard');
  };

  return (
    <div className="app-shell" id="app-root">
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        watchlist={liveWatchlist}
        totalValue={0}
        onSymbolClick={handleSymbolClick}
      />
      <main className="app-main" id="app-main" role="main">
        <ErrorBoundary>
          <Routes>
            <Route
              path="/"
              element={<Navigate to="/dashboard" replace />}
            />
            <Route
              path="/dashboard"
              element={(
                <Dashboard
                  activeSymbol={activeSymbol}
                  setActiveSymbol={setActiveSymbol}
                  appPrices={prices}
                  lastUpdated={lastUpdated}
                  connected={connected}
                  onRefresh={refresh}
                />
              )}
            />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route
              path="/watchlist"
              element={<Watchlist onOpenChart={handleSymbolClick} />}
            />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;
