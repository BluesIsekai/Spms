import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import FnODashboard from './pages/FnODashboard';
import StockChart from './pages/StockChart';
import ErrorBoundary from './components/ErrorBoundary';
import { useStockPolling } from './hooks/useStockPolling';
import { useAuth } from './hooks/useAuth.jsx';
import { fetchHoldings, subscribeHoldings } from './services/portfolioService';
import { supabase } from './services/supabaseClient';
import { getFxRatesToINR } from './services/yahooStockApi';
import { convertToINR, inferCurrencyFromSymbol } from './utils/currency';
import Portfolio from './pages/Portfolio';
import Watchlist from './pages/Watchlist';
import Transactions from './pages/Transactions';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ProtectedRoute from './components/ProtectedRoute';
import ExploreCategory from './pages/ExploreCategory';
import GlobalIndices from './pages/GlobalIndices';
import MutualFunds from './pages/MutualFunds';
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
const SUPABASE_CONFIGURED = !!supabase;

function getPageFromPath(pathname) {
  if (pathname === '/' || pathname === '/dashboard') return 'dashboard';
  if (pathname === '/fno') return 'fno';
  if (pathname === '/mutual-funds') return 'mutual_funds';
  if (pathname.startsWith('/chart')) return 'chart';
  if (pathname.startsWith('/portfolio')) return 'portfolio';
  if (pathname.startsWith('/watchlist')) return 'watchlist';
  if (pathname.startsWith('/transactions')) return 'transactions';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'dashboard';
}

function App() {
  const [activeSymbol, setActiveSymbol] = useState('RELIANCE.NS');
  const [holdings, setHoldings] = useState([]);
  const [fxRates, setFxRates] = useState({});
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  
  // Determine if current route is an auth page
  const isAuthPage = ['/login', '/signup', '/forgot-password'].includes(location.pathname);
  const activePage = getPageFromPath(location.pathname);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user?.id) {
      setHoldings([]);
      return () => {};
    }

    if (!SUPABASE_CONFIGURED) {
      setHoldings([]);
      return () => {};
    }

    fetchHoldings(user.id)
      .then((data) => setHoldings(data || []))
      .catch(() => setHoldings([]));

    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeHoldings(user.id, () => {
        fetchHoldings(user.id)
          .then((data) => setHoldings(data || []))
          .catch(() => {});
      });
    } catch {
      unsubscribe = () => {};
    }

    return () => unsubscribe();
  }, [user?.id]);

  // ── Top-level Yahoo Finance polling (shared by Sidebar + Dashboard) ──────
  // Dashboard gets its own granular polling instance for held stocks.
  // Here we only poll the fixed watchlist for the Sidebar.
  const holdingSymbols = useMemo(() => holdings.map((h) => h.stock_symbol), [holdings]);
  const polledSymbols = useMemo(
    () => [...new Set([activeSymbol, ...WATCHLIST_SYMBOLS, ...holdingSymbols])],
    [activeSymbol, holdingSymbols]
  );

  const { prices, lastUpdated, connected, refresh } = useStockPolling(
    polledSymbols,
    POLL_INTERVAL_MS
  );

  // Enrich watchlist with live prices for Sidebar
  const liveWatchlist = useMemo(
    () => WATCHLIST_META.map((item) => ({
      ...item,
      price:     prices[item.symbol]?.price     ?? 0,
      change:    prices[item.symbol]?.change    ?? 0,
      changePct: prices[item.symbol]?.changePct ?? 0,
      currency:  prices[item.symbol]?.currency  ?? inferCurrencyFromSymbol(item.symbol, 'INR'),
    })),
    [prices]
  );

  useEffect(() => {
    const currencies = holdings
      .map((h) => prices[h.stock_symbol]?.currency || h.holding_currency || inferCurrencyFromSymbol(h.stock_symbol, 'USD'))
      .filter(Boolean);

    getFxRatesToINR(currencies)
      .then((rates) => setFxRates(rates || {}))
      .catch(() => setFxRates({}));
  }, [holdings, prices]);

  const sidebarPortfolioValue = useMemo(() => {
    return holdings.reduce((sum, h) => {
      const qty = Number(h.quantity || 0);
      const avgBuy = Number(h.average_buy_price || 0);
      const quote = prices[h.stock_symbol];
      const live = Number(quote?.price || avgBuy);
      const currency = quote?.currency || h.holding_currency || inferCurrencyFromSymbol(h.stock_symbol, 'USD');
      return sum + convertToINR(qty * live, currency, fxRates);
    }, 0);
  }, [holdings, prices, fxRates]);

  const handleNavigate = (page) => {
    setSidebarOpen(false);
    if (page === 'dashboard') navigate('/dashboard');
    if (page === 'fno') navigate('/fno');
    if (page === 'mutual_funds') navigate('/mutual-funds');
    if (page === 'chart') navigate(`/chart/${activeSymbol || 'RELIANCE.NS'}`);
    if (page === 'portfolio') navigate('/portfolio');
    if (page === 'watchlist') navigate('/watchlist');
    if (page === 'transactions') navigate('/transactions');
    if (page === 'settings') navigate('/settings');
  };

  const handleSymbolClick = (symbol) => {
    setActiveSymbol(symbol);
    navigate(`/chart/${symbol}`);
  };

  return (
    <div className="app-shell" id="app-root">
      {!isAuthPage && (
        <>
          <button
            type="button"
            className="mobile-sidebar-toggle"
            aria-label={isSidebarOpen ? 'Close navigation' : 'Open navigation'}
            aria-controls="app-sidebar"
            aria-expanded={isSidebarOpen}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          <button
            type="button"
            className={`app-sidebar-backdrop${isSidebarOpen ? ' visible' : ''}`}
            aria-label="Close navigation overlay"
            onClick={() => setSidebarOpen(false)}
          />
        </>
      )}
      {!isAuthPage && (
        <Sidebar
          activePage={activePage}
          onNavigate={handleNavigate}
          watchlist={liveWatchlist}
          totalValue={sidebarPortfolioValue}
          onSymbolClick={handleSymbolClick}
          mobileOpen={isSidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />
      )}
      <main className="app-main" id="app-main" role="main">
        <ErrorBoundary>
          <Routes>
            {/* Auth Routes (public) */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            
            {/* Protected Routes */}
            <Route
              path="/"
              element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard
                    appPrices={prices}
                    lastUpdated={lastUpdated}
                    connected={connected}
                    onRefresh={refresh}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/fno"
              element={
                <ProtectedRoute>
                  <FnODashboard appPrices={prices} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mutual-funds"
              element={
                <ProtectedRoute>
                  <MutualFunds appPrices={prices} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chart/:symbol"
              element={
                <ProtectedRoute>
                  <StockChart appPrices={prices} />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/portfolio" 
              element={
                <ProtectedRoute>
                  <Portfolio />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/watchlist"
              element={
                <ProtectedRoute>
                  <Watchlist onOpenChart={handleSymbolClick} />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/transactions" 
              element={
                <ProtectedRoute>
                  <Transactions />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/explore/:categoryId" 
              element={
                <ProtectedRoute>
                  <ExploreCategory />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/global-indices"
              element={
                <ProtectedRoute>
                  <GlobalIndices />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;
