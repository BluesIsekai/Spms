import { useState, useMemo, useEffect } from 'react';
import Navbar from '../components/Navbar';
import StockPanel from '../components/charts/StockPanel';
import PortfolioTable from '../components/PortfolioTable';
import TransactionsTable from '../components/TransactionsTable';
import { useStockPolling } from '../hooks/useStockPolling';
import { useAuth } from '../hooks/useAuth.jsx';
import { getFxRatesToINR, getHistoricalData, getQuote } from '../services/yahooStockApi';
import {
  fetchHoldings,
  fetchTransactions,
  recordTransaction,
  subscribeHoldings,
  subscribeTransactions,
} from '../services/portfolioService';
import { fetchWallet, subscribeWallet } from '../services/walletService';
import { supabase } from '../services/supabaseClient';
import { convertToINR, inferCurrencyFromSymbol } from '../utils/currency';
import './Dashboard.css';

const DEFAULT_BALANCE = 100000;

// Default Indian NSE watchlist — populated by Yahoo Finance polling
const DEFAULT_WATCHLIST = [
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries' },
  { symbol: 'TCS.NS',      name: 'Tata Consultancy Services' },
  { symbol: 'INFY.NS',     name: 'Infosys' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank' },
  { symbol: 'SBIN.NS',     name: 'State Bank of India' },
];

const SUPABASE_CONFIGURED = !!supabase;

export default function Dashboard({
  activeSymbol,
  setActiveSymbol,
  appPrices = {},
  lastUpdated,
  connected,
  onRefresh
}) {
  const { user } = useAuth();
  const [holdings, setHoldings]         = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [wallet, setWallet]             = useState(null);
  const [activeTab, setActiveTab]       = useState('holdings');
  const [tradeError, setTradeError]     = useState('');
  const [fxRates, setFxRates]           = useState({});
  const [prevCloseBySymbol, setPrevCloseBySymbol] = useState({});

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

  useEffect(() => {
    const currencies = holdings
      .map((h) => mergedPrices[h.stock_symbol]?.currency || h.holding_currency || inferCurrencyFromSymbol(h.stock_symbol, 'USD'))
      .filter(Boolean);

    getFxRatesToINR(currencies)
      .then((rates) => setFxRates(rates || {}))
      .catch(() => setFxRates({}));
  }, [holdings, mergedPrices]);

  useEffect(() => {
    let cancelled = false;

    const targets = holdings
      .map((h) => h.stock_symbol)
      .filter((sym) => {
        const quote = mergedPrices[sym];
        return !(quote && Number.isFinite(Number(quote.prevClose)) && Number(quote.prevClose) > 0);
      });

    if (!targets.length) {
      setPrevCloseBySymbol({});
      return () => {
        cancelled = true;
      };
    }

    const loadFallbackPrevClose = async () => {
      const entries = await Promise.all(
        [...new Set(targets)].map(async (sym) => {
          try {
            const { candles = [] } = await getHistoricalData(sym, '5D');
            const closes = candles
              .map((c) => Number(c?.close))
              .filter((n) => Number.isFinite(n) && n > 0);
            if (!closes.length) return [sym, undefined];
            const prevClose = closes.length > 1 ? closes[closes.length - 2] : closes[0];
            return [sym, prevClose];
          } catch {
            return [sym, undefined];
          }
        })
      );

      if (!cancelled) {
        const next = Object.fromEntries(entries.filter(([, v]) => Number.isFinite(v) && v > 0));
        setPrevCloseBySymbol(next);
      }
    };

    loadFallbackPrevClose();

    return () => {
      cancelled = true;
    };
  }, [holdings, mergedPrices]);

  // ── Portfolio data from Supabase (or demo fallback) ──────────────────────
  useEffect(() => {
    if (!user?.id) return;

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
      setWallet({ virtual_balance: DEFAULT_BALANCE, initial_balance: DEFAULT_BALANCE });
      return;
    }

    Promise.all([fetchHoldings(user.id), fetchTransactions(user.id), fetchWallet(user.id)])
      .then(([h, t, w]) => {
        setHoldings(h || []);
        setTransactions(t || []);
        setWallet(w || null);
      })
      .catch(() => {});

    const unsub1 = subscribeHoldings(user.id, () =>
      fetchHoldings(user.id).then(setHoldings).catch(() => {})
    );
    const unsub2 = subscribeTransactions(user.id, () =>
      fetchTransactions(user.id).then(setTransactions).catch(() => {})
    );
    const unsub3 = subscribeWallet(user.id, () =>
      fetchWallet(user.id).then(setWallet).catch(() => {})
    );
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [user?.id]);

  // ── Derived values ────────────────────────────────────────────────────────

  const portfolioMetrics = useMemo(() => {
    const invested = holdings.reduce((sum, h) => {
      const currency = mergedPrices[h.stock_symbol]?.currency || h.holding_currency || inferCurrencyFromSymbol(h.stock_symbol, 'USD');
      const value = Number(h.average_buy_price) * Number(h.quantity);
      return sum + convertToINR(value, currency, fxRates);
    }, 0);
    const portfolioValue = holdings.reduce((sum, h) => {
      const p = mergedPrices[h.stock_symbol]?.price ?? Number(h.average_buy_price);
      const currency = mergedPrices[h.stock_symbol]?.currency || h.holding_currency || inferCurrencyFromSymbol(h.stock_symbol, 'USD');
      return sum + convertToINR(p * Number(h.quantity), currency, fxRates);
    }, 0);
    const previousCloseValue = holdings.reduce((sum, h) => {
      const quote = mergedPrices[h.stock_symbol];
      const current = quote?.price ?? Number(h.average_buy_price);
      const previous =
        (Number.isFinite(Number(quote?.prevClose)) && Number(quote?.prevClose) > 0
          ? Number(quote.prevClose)
          : undefined) ??
        prevCloseBySymbol[h.stock_symbol] ??
        (quote ? current - (quote.change ?? 0) : Number(h.average_buy_price));
      const currency = quote?.currency || h.holding_currency || inferCurrencyFromSymbol(h.stock_symbol, 'USD');
      return sum + convertToINR(previous * Number(h.quantity), currency, fxRates);
    }, 0);

    const totalPnL = holdings.reduce((sum, h) => {
      const quote = mergedPrices[h.stock_symbol];
      const currentPrice = Number(quote?.price || h.average_buy_price || 0);
      const avgBuyPrice = Number(h.average_buy_price || 0);
      const quantity = Number(h.quantity || 0);
      const currency = quote?.currency || h.holding_currency || inferCurrencyFromSymbol(h.stock_symbol, 'USD');

      const rowPnL = (currentPrice - avgBuyPrice) * quantity;
      return sum + convertToINR(rowPnL, currency, fxRates);
    }, 0);

    const todayPnL = portfolioValue - previousCloseValue;
    const todayPnLPct = previousCloseValue > 0 ? (todayPnL / previousCloseValue) * 100 : 0;

    return {
      invested,
      portfolioValue,
      totalPnL,
      todayPnLPct,
    };
  }, [holdings, mergedPrices, fxRates, prevCloseBySymbol]);

  const walletBalance = Number(wallet?.virtual_balance ?? DEFAULT_BALANCE);

  // Flat price map { symbol: number } for legacy prop interfaces (PortfolioTable)
  const livePriceMap = Object.fromEntries(
    Object.entries(mergedPrices).map(([sym, q]) => [sym, q.price])
  );

  // ── Trade handlers ────────────────────────────────────────────────────────
  const refreshPortfolioState = async () => {
    if (!user?.id || !SUPABASE_CONFIGURED) return;
    const [h, t, w] = await Promise.all([
      fetchHoldings(user.id),
      fetchTransactions(user.id),
      fetchWallet(user.id),
    ]);
    setHoldings(h || []);
    setTransactions(t || []);
    setWallet(w || null);
  };

  const handleBuy = async (symbol, qty) => {
    if (!user?.id) {
      setTradeError('Please login to place a trade.');
      return;
    }

    try {
      setTradeError('');
      const latestQuote = await getQuote(symbol);
      const marketPrice = Number(latestQuote?.price || 0);
      const assetCurrency = latestQuote?.currency || inferCurrencyFromSymbol(symbol, 'USD');
      const rates = await getFxRatesToINR([assetCurrency]);
      const fxRateToInr = assetCurrency === 'INR' ? 1 : Number(rates[assetCurrency] || 1);
      if (!marketPrice) throw new Error('Unable to fetch live market price.');

      await recordTransaction({
        userId: user.id,
        symbol,
        type: 'BUY',
        quantity: qty,
        price: marketPrice,
        assetCurrency,
        fxRateToInr,
        companyName: latestQuote?.name || symbol,
      });
      await refreshPortfolioState();
    } catch (err) {
      setTradeError(err.message || 'Buy order failed.');
    }
  };

  const handleSell = async (symbol, qty) => {
    if (!user?.id) {
      setTradeError('Please login to place a trade.');
      return;
    }

    try {
      setTradeError('');
      const latestQuote = await getQuote(symbol);
      const marketPrice = Number(latestQuote?.price || 0);
      const assetCurrency = latestQuote?.currency || inferCurrencyFromSymbol(symbol, 'USD');
      const rates = await getFxRatesToINR([assetCurrency]);
      const fxRateToInr = assetCurrency === 'INR' ? 1 : Number(rates[assetCurrency] || 1);
      if (!marketPrice) throw new Error('Unable to fetch live market price.');

      await recordTransaction({
        userId: user.id,
        symbol,
        type: 'SELL',
        quantity: qty,
        price: marketPrice,
        assetCurrency,
        fxRateToInr,
        companyName: latestQuote?.name || symbol,
      });
      await refreshPortfolioState();
    } catch (err) {
      setTradeError(err.message || 'Sell order failed.');
    }
  };

  const summaryCards = [
    {
      label: 'Virtual Balance',
      value: `₹${walletBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
      meta: 'Ready capital',
      status: 'neutral',
    },
    {
      label: 'Portfolio Value',
      value: `₹${portfolioMetrics.portfolioValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
      meta: `${holdings.length} active positions`,
      status: 'neutral',
    },
    {
      label: 'Total P/L',
      value: `${portfolioMetrics.totalPnL >= 0 ? '+' : '-'}₹${Math.abs(portfolioMetrics.totalPnL).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
      meta: 'Lifetime return',
      status: portfolioMetrics.totalPnL >= 0 ? 'up' : 'down',
    },
    {
      label: "Today's P/L %",
      value: `${portfolioMetrics.todayPnLPct >= 0 ? '+' : ''}${portfolioMetrics.todayPnLPct.toFixed(2)}%`,
      meta: 'Session movement',
      status: portfolioMetrics.todayPnLPct >= 0 ? 'up' : 'down',
    },
  ];

  const activeQuote = mergedPrices[activeSymbol];
  const activeMove = Number(activeQuote?.changePct || 0);
  const marketLive = activeQuote?.marketState === 'REGULAR';

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
        <section className="command-center-strip" aria-label="Dashboard command center">
          <div className="ccs-left compact">
            <span className="ccs-app-label">SPMS</span>
            <span className="ccs-title-compact">Dashboard</span>
          </div>
          <div className="ccs-right">
            <div className="ccs-chip symbol">
              <span className="chip-label">Active Symbol</span>
              <strong>{activeSymbol}</strong>
            </div>
            <div className={`ccs-chip move ${activeMove >= 0 ? 'up' : 'down'}`}>
              <span className="chip-label">Session Move</span>
              <strong>{activeMove >= 0 ? '+' : ''}{activeMove.toFixed(2)}%</strong>
            </div>
            <div className={`ccs-chip pulse ${marketLive ? 'live' : 'closed'}`}>
              <span className="chip-dot" />
              <strong>{marketLive ? 'Live Session' : 'After Hours'}</strong>
            </div>
          </div>
        </section>

        <section className="summary-cards-row" aria-label="Portfolio summary">
          {summaryCards.map((card) => (
            <article key={card.label} className={`summary-card ${card.status}`}>
              <div className="summary-card-top">
                <span className="summary-card-label">{card.label}</span>
                <span className={`summary-card-dot ${card.status}`} />
              </div>
              <strong className="summary-card-value">{card.value}</strong>
              <span className="summary-card-meta">{card.meta}</span>
            </article>
          ))}
        </section>

        {tradeError && <div className="trade-error-banner">{tradeError}</div>}

        {/* Main stock panel */}
        <StockPanel
          symbol={activeSymbol}
          quote={mergedPrices[activeSymbol]}
          availableBalance={walletBalance}
          onSymbolChange={setActiveSymbol}
          onBuy={handleBuy}
          onSell={handleSell}
          leftBottom={(
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
                    ₹{portfolioMetrics.portfolioValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="bottom-content">
                {activeTab === 'holdings' ? (
                  <PortfolioTable
                    holdings={holdings}
                    livePrices={livePriceMap}
                    liveQuotes={mergedPrices}
                    fxRates={fxRates}
                    onSelectSymbol={setActiveSymbol}
                    onEmptyCta={() => {
                      setActiveTab('holdings');
                      setActiveSymbol(DEFAULT_WATCHLIST[0].symbol);
                      document.getElementById('order-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  />
                ) : (
                  <TransactionsTable transactions={transactions} />
                )}
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
