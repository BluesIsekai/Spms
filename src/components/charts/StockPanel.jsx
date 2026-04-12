import { useState } from 'react';
import StockChart from '../charts/StockChart';
import { formatMarketCap, formatVolume, currencySymbol } from '../../services/yahooStockApi';
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
export default function StockPanel({ symbol, quote, onSymbolChange, onBuy, onSell }) {
  const [orderQty, setOrderQty]       = useState('');
  const [tradeLoading, setTradeLoading] = useState(false);

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

          {/* Show Order Form strictly for equities */}
          {!isIdx && (
            <>
              <div className="panel-divider" />
              <div className="order-form" id="order-form">
                <div className="of-header">Place Order</div>

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
