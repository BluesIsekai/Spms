import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StockPanel from '../components/charts/StockPanel';
import { useStockPolling } from '../hooks/useStockPolling';
import { useAuth } from '../hooks/useAuth.jsx';
import { getFxRatesToINR, getQuote } from '../services/yahooStockApi';
import {
  fetchHoldings,
  fetchTransactions,
  recordTransaction,
  subscribeHoldings,
  subscribeTransactions,
} from '../services/portfolioService';
import { fetchWallet, subscribeWallet } from '../services/walletService';
import { supabase } from '../services/supabaseClient';
import { inferCurrencyFromSymbol } from '../utils/currency';
import './StockChart.css';

const SUPABASE_CONFIGURED = !!supabase;

export default function StockChart({ appPrices = {} }) {
  const { symbol: urlSymbol } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeSymbol, setActiveSymbol] = useState(urlSymbol || 'RELIANCE.NS');
  const [holdings, setHoldings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [tradeError, setTradeError] = useState('');

  // Update active symbol when URL changes
  useEffect(() => {
    if (urlSymbol) setActiveSymbol(urlSymbol);
  }, [urlSymbol]);

  // Poll this symbol's price
  const { prices: chartPrices } = useStockPolling([activeSymbol], 10_000);
  const mergedPrices = useMemo(() => ({ ...chartPrices, ...appPrices }), [chartPrices, appPrices]);

  // Portfolio data
  useEffect(() => {
    if (!user?.id || !SUPABASE_CONFIGURED) return;

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

  const walletBalance = Number(wallet?.virtual_balance ?? 100000);

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
    if (!user?.id) { setTradeError('Please login to place a trade.'); return; }
    try {
      setTradeError('');
      const latestQuote = await getQuote(symbol);
      const marketPrice = Number(latestQuote?.price || 0);
      const assetCurrency = latestQuote?.currency || inferCurrencyFromSymbol(symbol, 'USD');
      const rates = await getFxRatesToINR([assetCurrency]);
      const fxRateToInr = assetCurrency === 'INR' ? 1 : Number(rates[assetCurrency] || 1);
      if (!marketPrice) throw new Error('Unable to fetch live market price.');
      await recordTransaction({ userId: user.id, symbol, type: 'BUY', quantity: qty, price: marketPrice, assetCurrency, fxRateToInr, companyName: latestQuote?.name || symbol });
      await refreshPortfolioState();
    } catch (err) {
      setTradeError(err.message || 'Buy order failed.');
    }
  };

  const handleSell = async (symbol, qty) => {
    if (!user?.id) { setTradeError('Please login to place a trade.'); return; }
    try {
      setTradeError('');
      const latestQuote = await getQuote(symbol);
      const marketPrice = Number(latestQuote?.price || 0);
      const assetCurrency = latestQuote?.currency || inferCurrencyFromSymbol(symbol, 'USD');
      const rates = await getFxRatesToINR([assetCurrency]);
      const fxRateToInr = assetCurrency === 'INR' ? 1 : Number(rates[assetCurrency] || 1);
      if (!marketPrice) throw new Error('Unable to fetch live market price.');
      await recordTransaction({ userId: user.id, symbol, type: 'SELL', quantity: qty, price: marketPrice, assetCurrency, fxRateToInr, companyName: latestQuote?.name || symbol });
      await refreshPortfolioState();
    } catch (err) {
      setTradeError(err.message || 'Sell order failed.');
    }
  };

  const handleSymbolChange = (newSymbol) => {
    setActiveSymbol(newSymbol);
    navigate(`/chart/${newSymbol}`, { replace: true });
  };

  // Current holding for this symbol
  const holding = holdings.find(h => h.stock_symbol === activeSymbol);
  // Symbol-specific transactions (last 5)
  const symbolTransactions = useMemo(
    () => transactions.filter(t => t.stock_symbol === activeSymbol).slice(0, 5),
    [transactions, activeSymbol]
  );

  const quote = mergedPrices[activeSymbol];

  return (
    <div className="stock-chart-page" id="stock-chart-page">
      {/* Top breadcrumb bar */}
      <div className="scp-topbar">
        <button
          id="chart-back-btn"
          className="scp-back-btn"
          onClick={() => navigate('/dashboard')}
          aria-label="Back to dashboard"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Dashboard
        </button>

        <div className="scp-breadcrumb">
          <span className="scp-symbol">{activeSymbol}</span>
          {quote?.name && <span className="scp-company">{quote.name}</span>}
        </div>

        <div className="scp-market-status">
          <span className={`scp-status-dot ${quote?.marketState === 'REGULAR' ? 'live' : 'closed'}`} />
          <span className="scp-status-text">
            {quote?.marketState === 'REGULAR' ? 'NSE Live' : 'Market Closed'}
          </span>
          <span className="scp-time">IST 09:15–15:30</span>
        </div>
      </div>

      {tradeError && (
        <div className="scp-error-banner" role="alert">{tradeError}</div>
      )}

      {/* Main chart panel — takes full width */}
      <div className="scp-content">
        <StockPanel
          symbol={activeSymbol}
          quote={mergedPrices[activeSymbol]}
          availableBalance={walletBalance}
          onSymbolChange={handleSymbolChange}
          onBuy={handleBuy}
          onSell={handleSell}
          leftBottom={
            holding || symbolTransactions.length > 0 ? (
              <div className="scp-bottom-info">
                {holding && (
                  <div className="scp-holding-card">
                    <div className="scp-holding-header">
                      <span className="scp-holding-label">Your Position</span>
                      <span className="scp-holding-qty">{holding.quantity} shares</span>
                    </div>
                    <div className="scp-holding-stats">
                      <div className="scp-holding-stat">
                        <span className="scp-stat-lbl">Avg Buy</span>
                        <span className="scp-stat-val">₹{Number(holding.average_buy_price).toFixed(2)}</span>
                      </div>
                      <div className="scp-holding-stat">
                        <span className="scp-stat-lbl">Current Val</span>
                        <span className="scp-stat-val">
                          ₹{((quote?.price || holding.average_buy_price) * holding.quantity).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      {quote?.price && (
                        <div className="scp-holding-stat">
                          <span className="scp-stat-lbl">P&L</span>
                          <span className={`scp-stat-val ${(quote.price - holding.average_buy_price) >= 0 ? 'up' : 'down'}`}>
                            {(quote.price - holding.average_buy_price) >= 0 ? '+' : ''}
                            ₹{((quote.price - holding.average_buy_price) * holding.quantity).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {symbolTransactions.length > 0 && (
                  <div className="scp-recent-orders">
                    <div className="scp-recent-orders-header">Recent Orders — {activeSymbol}</div>
                    <div className="scp-orders-list">
                      {symbolTransactions.map(tx => (
                        <div key={tx.id} className="scp-order-row">
                          <span className={`scp-order-type ${tx.transaction_type === 'BUY' ? 'buy' : 'sell'}`}>
                            {tx.transaction_type}
                          </span>
                          <span className="scp-order-qty">{tx.quantity} @ ₹{Number(tx.price).toFixed(2)}</span>
                          <span className="scp-order-total">₹{Number(tx.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                          <span className="scp-order-date">{new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null
          }
        />
      </div>
    </div>
  );
}
