import { useState, useMemo, useEffect } from 'react';
import Navbar from '../components/Navbar';
import StockPanel from '../components/charts/StockPanel';
import PortfolioTable from '../components/PortfolioTable';
import TransactionsTable from '../components/TransactionsTable';
import { useStockPolling } from '../hooks/useStockPolling';
import {
  fetchHoldings,
  fetchTransactions,
  recordTransaction,
  subscribeHoldings,
  subscribeTransactions,
} from '../services/portfolioService';
import './Dashboard.css';

// Demo user (replace with supabase.auth.getUser() when auth is set up)
const DEMO_USER_ID = 'demo-user-1';

// Default Indian NSE watchlist — populated by Yahoo Finance polling
const DEFAULT_WATCHLIST = [
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries' },
  { symbol: 'TCS.NS',      name: 'Tata Consultancy Services' },
  { symbol: 'INFY.NS',     name: 'Infosys' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank' },
  { symbol: 'SBIN.NS',     name: 'State Bank of India' },
];

const SUPABASE_CONFIGURED =
  import.meta.env.VITE_SUPABASE_URL &&
  /^https?:\/\/.+/.test(import.meta.env.VITE_SUPABASE_URL);

export default function Dashboard({
  activeSymbol,
  setActiveSymbol,
  appPrices = {},
  lastUpdated,
  connected,
  onRefresh
}) {
  const [holdings, setHoldings]         = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab]       = useState('holdings');

  // Dashboard-specific polling: For any holdings that are not already covered in appPrices
  const heldSymbols = useMemo(() => holdings.map((h) => h.stock_symbol), [holdings]);
  const heldSymbolsToPoll = useMemo(() => {
    return [...new Set(heldSymbols)].filter(sym => !appPrices[sym] && sym !== activeSymbol);
  }, [heldSymbols.join(','), appPrices, activeSymbol]);

  // Use Dashboard local polling for the missing symbols
  const { prices: dashboardPrices } = useStockPolling(heldSymbolsToPoll, 10_000);

  // Merge app-level prices with dashboard-level prices
  const mergedPrices = useMemo(() => {
    return { ...dashboardPrices, ...appPrices };
  }, [dashboardPrices, appPrices]);

  // ── Portfolio data from Supabase (or demo fallback) ──────────────────────
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      // Demo data — Indian stocks
      setHoldings([
        { stock_symbol: 'RELIANCE.NS', quantity: 10,  average_buy_price: 2800 },
        { stock_symbol: 'TCS.NS',      quantity: 5,   average_buy_price: 3600 },
        { stock_symbol: 'INFY.NS',     quantity: 15,  average_buy_price: 1500 },
      ]);
      setTransactions([
        { id: 1, stock_symbol: 'RELIANCE.NS', transaction_type: 'BUY', quantity: 10, price: 2800, total_amount: 28000, created_at: new Date().toISOString() },
        { id: 2, stock_symbol: 'TCS.NS',      transaction_type: 'BUY', quantity: 5,  price: 3600, total_amount: 18000, created_at: new Date().toISOString() },
        { id: 3, stock_symbol: 'INFY.NS',     transaction_type: 'BUY', quantity: 15, price: 1500, total_amount: 22500, created_at: new Date().toISOString() },
      ]);
      return;
    }

    Promise.all([fetchHoldings(DEMO_USER_ID), fetchTransactions(DEMO_USER_ID)])
      .then(([h, t]) => { setHoldings(h); setTransactions(t); })
      .catch(() => {});

    const unsub1 = subscribeHoldings(DEMO_USER_ID, () =>
      fetchHoldings(DEMO_USER_ID).then(setHoldings).catch(() => {})
    );
    const unsub2 = subscribeTransactions(DEMO_USER_ID, () =>
      fetchTransactions(DEMO_USER_ID).then(setTransactions).catch(() => {})
    );
    return () => { unsub1(); unsub2(); };
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────

  // Total live portfolio value
  const totalValue = holdings.reduce((sum, h) => {
    const p = mergedPrices[h.stock_symbol]?.price ?? h.average_buy_price;
    return sum + p * h.quantity;
  }, 0);

  // Flat price map { symbol: number } for legacy prop interfaces (PortfolioTable)
  const livePriceMap = Object.fromEntries(
    Object.entries(mergedPrices).map(([sym, q]) => [sym, q.price])
  );

  // ── Trade handlers ────────────────────────────────────────────────────────
  const handleBuy = async (symbol, qty, price) => {
    const newTx = {
      id: Date.now(), stock_symbol: symbol, transaction_type: 'BUY',
      quantity: qty, price, total_amount: qty * price, created_at: new Date().toISOString(),
    };
    setTransactions((prev) => [newTx, ...prev]);
    setHoldings((prev) => {
      const ex = prev.find((h) => h.stock_symbol === symbol);
      if (ex) {
        const newQty = ex.quantity + qty;
        const newAvg = (ex.quantity * ex.average_buy_price + qty * price) / newQty;
        return prev.map((h) => h.stock_symbol === symbol ? { ...h, quantity: newQty, average_buy_price: newAvg } : h);
      }
      return [...prev, { stock_symbol: symbol, quantity: qty, average_buy_price: price }];
    });
    try { await recordTransaction({ userId: DEMO_USER_ID, symbol, type: 'BUY', quantity: qty, price }); } catch (_) {}
  };

  const handleSell = async (symbol, qty, price) => {
    const newTx = {
      id: Date.now(), stock_symbol: symbol, transaction_type: 'SELL',
      quantity: qty, price, total_amount: qty * price, created_at: new Date().toISOString(),
    };
    setTransactions((prev) => [newTx, ...prev]);
    setHoldings((prev) =>
      prev
        .map((h) => h.stock_symbol === symbol ? { ...h, quantity: h.quantity - qty } : h)
        .filter((h) => h.quantity > 0)
    );
    try { await recordTransaction({ userId: DEMO_USER_ID, symbol, type: 'SELL', quantity: qty, price }); } catch (_) {}
  };

  return (
    <div className="dashboard" id="dashboard-page">
      <Navbar
        activeSymbol={activeSymbol}
        quote={mergedPrices[activeSymbol]}
        connected={connected}
        lastUpdated={lastUpdated}
        onRefresh={onRefresh}
        onSymbolChange={setActiveSymbol}
      />

      <div className="dashboard-content">
        {/* Main stock panel */}
        <StockPanel
          symbol={activeSymbol}
          quote={mergedPrices[activeSymbol]}
          onSymbolChange={setActiveSymbol}
          onBuy={handleBuy}
          onSell={handleSell}
        />

        {/* Bottom holdings / transactions */}
        <div className="bottom-section">
          <div className="bottom-tabs" id="bottom-tabs">
            <button
              id="tab-holdings"
              className={`bottom-tab${activeTab === 'holdings' ? ' active' : ''}`}
              onClick={() => setActiveTab('holdings')}
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/>
              </svg>
              Holdings
              <span className="tab-count">{holdings.length}</span>
            </button>
            <button
              id="tab-transactions"
              className={`bottom-tab${activeTab === 'transactions' ? ' active' : ''}`}
              onClick={() => setActiveTab('transactions')}
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
              </svg>
              Transactions
              <span className="tab-count">{transactions.length}</span>
            </button>

            <div className="portfolio-value-strip">
              <span className="pvs-label">Portfolio</span>
              <span className="pvs-value">
                ₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="bottom-content">
            {activeTab === 'holdings' ? (
              <PortfolioTable
                holdings={holdings}
                livePrices={livePriceMap}
                onSelectSymbol={setActiveSymbol}
              />
            ) : (
              <TransactionsTable transactions={transactions} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
