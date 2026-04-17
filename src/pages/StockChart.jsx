import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StockPanel from '../components/charts/StockPanel';
import SymbolLogo from '../components/ui/SymbolLogo';
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
  const [isHoldingModalOpen, setIsHoldingModalOpen] = useState(false);

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
  // Symbol-specific transactions (ALL of them, since user requested entire history in modal)
  const symbolTransactions = useMemo(
    () => transactions.filter(t => t.stock_symbol === activeSymbol).sort((a,b) => new Date(b.created_at) - new Date(a.created_at)),
    [transactions, activeSymbol]
  );

  const quote = mergedPrices[activeSymbol];

  // Holding Maths
  const avgBuy = holding ? Number(holding.average_buy_price) : 0;
  const qty = holding ? Number(holding.quantity) : 0;
  const currentPrice = quote?.price || avgBuy;
  const invested = avgBuy * qty;
  const currentVal = currentPrice * qty;
  const totalReturn = currentVal - invested;
  const isUp = totalReturn >= 0;
  const totalReturnPct = invested > 0 ? (totalReturn / invested) * 100 : 0;
  const todayReturn = quote?.change ? quote.change * qty : 0;
  const todayReturnPct = quote?.changePct || 0;

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

        <div className="scp-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SymbolLogo symbol={activeSymbol} size={32} />
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
            holding ? (
              <div className="scp-holding-card v2-card" onClick={() => setIsHoldingModalOpen(true)}>
                <div className="scp-hc-col left">
                  <span className="scp-hc-label">No. of Shares</span>
                  <span className="scp-hc-val big">{qty}</span>
                  <span className="scp-hc-label mt-8">Average Price</span>
                  <span className="scp-hc-val">₹{avgBuy.toFixed(2)}</span>
                </div>
                <div className="scp-hc-col right">
                  <span className="scp-hc-label">Invested Value</span>
                  <span className="scp-hc-val">₹{invested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  <span className="scp-hc-label mt-8">Current Value</span>
                  <span className={`scp-hc-val big ${isUp ? 'up' : 'down'}`}>₹{currentVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            ) : null
          }
        />
      </div>

      {/* Deep-Dive Holding Modal */}
      {isHoldingModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsHoldingModalOpen(false)}>
          <div className="sc-holding-modal" onClick={e => e.stopPropagation()}>
             <div className="sc-hm-header">
                <h3>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                     <SymbolLogo symbol={activeSymbol} size={28} />
                     {activeSymbol} Portfolio Stats
                   </div>
                </h3>
                <button onClick={() => setIsHoldingModalOpen(false)}>✕</button>
             </div>
             
             {/* Macro Stats Grid */}
             <div className="sc-hm-stats-grid">
                <div className="sc-hms-item">
                   <label>Shares</label>
                   <span>{qty}</span>
                </div>
                <div className="sc-hms-item">
                   <label>Invested</label>
                   <span>₹{invested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="sc-hms-item">
                   <label>Current Value</label>
                   <span className={isUp ? 'up' : 'down'}>₹{currentVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="sc-hms-item">
                   <label>Total Returns</label>
                   <span className={isUp ? 'up' : 'down'}>{isUp?'+':''}₹{totalReturn.toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({isUp?'+':''}{totalReturnPct.toFixed(2)}%)</span>
                </div>
                <div className="sc-hms-item">
                   <label>1D Return</label>
                   <span className={todayReturn >= 0 ? 'up' : 'down'}>{todayReturn >= 0?'+':''}₹{Math.abs(todayReturn).toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({todayReturn >= 0?'+':''}{todayReturnPct.toFixed(2)}%)</span>
                </div>
                <div className="sc-hms-item">
                   <label>Avg Price / Mkt Price</label>
                   <span>₹{avgBuy.toFixed(2)} / ₹{currentPrice.toFixed(2)}</span>
                </div>
             </div>

             {/* Transaction Ledger */}
             <div className="sc-hm-ledger">
                <h4>Holding Transactions</h4>
                <div className="sc-hml-list">
                  {symbolTransactions.length === 0 ? (
                    <div className="gd-empty">No transactions found.</div>
                  ) : (
                    symbolTransactions.map(tx => (
                      <div key={tx.id} className="sc-hml-row">
                         <div className="hml-col left">
                            <span className={`hml-type ${tx.transaction_type.toLowerCase()}`}>
                               {tx.transaction_type}
                            </span>
                            <span className="hml-qty">{tx.quantity} shares</span>
                            <span className="hml-date">{new Date(tx.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</span>
                         </div>
                         <div className="hml-col right">
                            <span className="hml-price">₹{Number(tx.price).toFixed(2)} / stock</span>
                            <span className="hml-total">Total: ₹{Number(tx.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                         </div>
                      </div>
                    ))
                  )}
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
