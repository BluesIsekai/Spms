import { useEffect, useState } from 'react';
import StockChart from '../charts/StockChart';
import { formatMarketCap, formatVolume, currencySymbol, getHistoricalData } from '../../services/yahooStockApi';
import { isIndex } from '../../utils/stockHelpers';
import './StockPanel.css';

// Top Indian stocks shown as quick-access tabs
const POPULAR_SYMBOLS = [
  'RELIANCE.NS',
  'TCS.NS',
  'INFY.NS',
  'HDFCBANK.NS',
  'SBIN.NS',
];

/**
 * Main stock info + chart panel.
 *
 * Props:
 *  symbol          {string}  Active ticker
 *  quote           {object}  Yahoo Finance quote — { price, change, changePct,
 *                            open, high, low, prevClose, volume, marketCap,
 *                            name, currency, marketState }
 *  onSymbolChange  {fn}
 *  onBuy           {fn(symbol, qty, price)}
 *  onSell          {fn(symbol, qty, price)}
 */
export default function StockPanel({ symbol, quote, availableBalance = 0, onSymbolChange, onBuy, onSell }) {
  const [orderQty, setOrderQty]       = useState('');
  const [tradeLoading, setTradeLoading] = useState(false);
  const [trend, setTrend] = useState(null);
  const [trendLoading, setTrendLoading] = useState(false);

  // Destructure Yahoo quote with safe fallbacks
  const price      = quote?.price     ?? 0;
  const change     = quote?.change    ?? 0;
  const changePct  = quote?.changePct ?? 0;
  const high       = quote?.high      ?? 0;
  const low        = quote?.low       ?? 0;
  const open       = quote?.open      ?? 0;
  const prevClose  = quote?.prevClose ?? 0;
  const volume     = quote?.volume    ?? 0;
  const currency   = quote?.currency  ?? 'INR';
  const name       = quote?.name      ?? '';
  const marketState = quote?.marketState ?? 'CLOSED';

  const sym        = currencySymbol(currency);
  const isUp       = change >= 0;
  const isIdx      = isIndex(symbol);
  const marketCap  = formatMarketCap(quote?.marketCap ?? 0, currency);

  const orderTotal = orderQty && price
    ? (parseFloat(orderQty) * price).toLocaleString('en-IN', { minimumFractionDigits: 2 })
    : (0).toFixed(2);

  useEffect(() => {
    let cancelled = false;

    const avg = (arr) => arr.reduce((sum, n) => sum + n, 0) / arr.length;

    const loadTrend = async () => {
      setTrendLoading(true);
      try {
        const { candles } = await getHistoricalData(symbol, '1M');
        const closes = (candles || []).map((c) => Number(c.close)).filter((n) => Number.isFinite(n));

        if (closes.length < 21) {
          if (!cancelled) setTrend(null);
          return;
        }

        const ma5 = avg(closes.slice(-5));
        const ma20 = avg(closes.slice(-20));
        const prevMa5 = avg(closes.slice(-6, -1));
        const prevMa20 = avg(closes.slice(-21, -1));
        const lastClose = closes[closes.length - 1];
        const close5Ago = closes[closes.length - 6] ?? lastClose;
        const momentumPct = close5Ago ? ((lastClose - close5Ago) / close5Ago) * 100 : 0;
        const maGapPct = ma20 ? ((ma5 - ma20) / ma20) * 100 : 0;

        const crossoverUp = prevMa5 <= prevMa20 && ma5 > ma20;
        const crossoverDown = prevMa5 >= prevMa20 && ma5 < ma20;

        let direction = 'Sideways';
        if (maGapPct > 0.25) direction = 'Bullish';
        if (maGapPct < -0.25) direction = 'Bearish';

        let signal = 'Neutral';
        if (crossoverUp) signal = 'Bullish Crossover';
        else if (crossoverDown) signal = 'Bearish Crossover';
        else if (direction === 'Bullish') signal = 'Above MA20';
        else if (direction === 'Bearish') signal = 'Below MA20';

        let recommendation = 'Hold';
        if (direction === 'Bullish' && momentumPct >= 1.2) recommendation = 'Strong Buy';
        else if (direction === 'Bullish' && momentumPct > 0) recommendation = 'Buy';
        else if (direction === 'Bearish' && momentumPct <= -1.2) recommendation = 'Strong Sell';
        else if (direction === 'Bearish' && momentumPct < 0) recommendation = 'Sell';

        const confidenceRaw = Math.abs(maGapPct) * 6 + Math.abs(momentumPct) * 8;
        const confidence = Math.max(35, Math.min(98, confidenceRaw));

        if (!cancelled) {
          setTrend({
            direction,
            signal,
            recommendation,
            confidence,
            momentumPct,
            ma5,
            ma20,
          });
        }
      } catch (_) {
        if (!cancelled) setTrend(null);
      } finally {
        if (!cancelled) setTrendLoading(false);
      }
    };

    loadTrend();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const handleTrade = async (type) => {
    if (!orderQty || parseFloat(orderQty) <= 0) return;
    setTradeLoading(true);
    try {
      if (type === 'BUY') await onBuy?.(symbol, parseFloat(orderQty), price);
      else await onSell?.(symbol, parseFloat(orderQty), price);
      setOrderQty('');
    } finally {
      setTradeLoading(false);
    }
  };

  return (
    <div className="stock-panel-wrapper">
      {/* Symbol quick-access tabs */}
      <div className="symbol-tabs" id="symbol-tabs">
        {POPULAR_SYMBOLS.map((sym) => (
          <button
            key={sym}
            id={`tab-${sym.replace('.', '-')}`}
            className={`sym-tab${symbol === sym ? ' active' : ''}`}
            onClick={() => onSymbolChange?.(sym)}
          >
            {/* Show short version e.g. RELIANCE instead of RELIANCE.NS */}
            {sym.split('.')[0]}
          </button>
        ))}
        <div className="tab-spacer" />
        {/* Market state badge */}
        <div className={`market-state-badge ${marketState === 'REGULAR' ? 'open' : 'closed'}`}>
          <span className="msb-dot" />
          {marketState === 'REGULAR' ? 'Market Open' : 'Market Closed'}
        </div>
      </div>

      {/* Main layout */}
      <div className="panel-main">
        {/* Left: chart section */}
        <div className="chart-section">
          <div className="chart-price-header">
            <div className="cph-symbol">
              <span className="cph-ticker">{symbol}</span>
              {isIdx && <span className="cph-index-label">Index</span>}
              {name && <span className="cph-name">{name}</span>}
            </div>
            <div className="cph-price-block">
              <span className="cph-price">{sym}{price.toFixed(2)}</span>
              <span className={`cph-change ${isUp ? 'up' : 'down'}`}>
                {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{change.toFixed(2)}{' '}
                ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Chart — passes price for live-tick nudge */}
          <StockChart symbol={symbol} livePrice={price} height={400} />
        </div>

        {/* Right: stats + order panel */}
        <div className="info-panel">
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Open</span>
              <span className="stat-val">{sym}{open.toFixed(2)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">High</span>
              <span className="stat-val up">{sym}{high.toFixed(2)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Low</span>
              <span className="stat-val down">{sym}{low.toFixed(2)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Prev Close</span>
              <span className="stat-val">{sym}{prevClose.toFixed(2)}</span>
            </div>
            {!isIdx && (
              <>
                <div className="stat-item">
                  <span className="stat-label">Volume</span>
                  <span className="stat-val">{formatVolume(volume)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Mkt Cap</span>
                  <span className="stat-val">{marketCap}</span>
                </div>
              </>
            )}
          </div>

          <div className="panel-divider" />
          <div className="trend-card">
            <div className="trend-card-head">
              <span className="trend-title">Trend Analysis</span>
              <span className={`trend-badge ${trend?.direction?.toLowerCase() || 'neutral'}`}>
                {trendLoading ? 'Analyzing' : trend?.direction || 'N/A'}
              </span>
            </div>

            <div className="trend-metrics">
              <div className="trend-row">
                <span className="trend-label">Confidence Factor</span>
                <span className="trend-val">{trend ? `${trend.confidence.toFixed(0)}%` : '—'}</span>
              </div>
              <div className="trend-row">
                <span className="trend-label">Momentum Engine</span>
                <span className={`trend-val ${trend?.momentumPct >= 0 ? 'up' : 'down'}`}>
                  {trend ? `${trend.momentumPct >= 0 ? '+' : ''}${trend.momentumPct.toFixed(2)}%` : '—'}
                </span>
              </div>
              <div className="trend-row">
                <span className="trend-label">Execution Signal</span>
                <span className="trend-val">{trend?.signal || '—'}</span>
              </div>
              <div className="trend-row">
                <span className="trend-label">Recommendation</span>
                <span className="trend-val rec">{trend?.recommendation || '—'}</span>
              </div>
            </div>

            <div className="trend-ma-row">
              <span>MA5: {trend ? `${sym}${trend.ma5.toFixed(2)}` : '—'}</span>
              <span>MA20: {trend ? `${sym}${trend.ma20.toFixed(2)}` : '—'}</span>
            </div>
          </div>

          {/* Show Order Form strictly for equities */}
          {!isIdx && (
            <>
              <div className="panel-divider" />
              <div className="order-form" id="order-form">
                <div className="of-header">Place Order</div>

                <div className="of-balance-row">
                  <span className="of-label">Available Balance</span>
                  <span className="of-balance">₹{Number(availableBalance || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>

                <div className="of-price-row">
                  <span className="of-label">Market Price</span>
                  <span className="of-price">{sym}{price.toFixed(2)}</span>
                </div>

                <div className="input-group">
                  <label htmlFor="order-qty" className="input-label">Quantity (shares)</label>
                  <input
                    id="order-qty"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="0"
                    value={orderQty}
                    onChange={(e) => setOrderQty(e.target.value)}
                    className="order-input"
                  />
                </div>

                <div className="of-total-row">
                  <span className="of-label">Estimated Total</span>
                  <span className="of-total">{sym}{orderTotal}</span>
                </div>

                <div className="trade-buttons">
                  <button
                    id="buy-btn"
                    className="trade-btn buy-btn"
                    disabled={!orderQty || tradeLoading}
                    onClick={() => handleTrade('BUY')}
                  >
                    {tradeLoading && <span className="btn-spinner" />}
                    Buy {symbol.split('.')[0]}
                  </button>
                  <button
                    id="sell-btn"
                    className="trade-btn sell-btn"
                    disabled={!orderQty || tradeLoading}
                    onClick={() => handleTrade('SELL')}
                  >
                    {tradeLoading && <span className="btn-spinner" />}
                    Sell {symbol.split('.')[0]}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
