import { useState, useEffect, useCallback } from 'react';
import { getHistoricalData, searchSymbols } from '../services/yahooStockApi';
import './TrendAnalysis.css';

// ── Technical Analysis Helpers ───────────────────────────────────────────────

function calcSMA(closes, period) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  const recent = closes.slice(-(period + 1));
  let gains = 0, losses = 0;
  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i] - recent[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  gains  /= period;
  losses /= period;
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function calcMACD(closes) {
  const ema = (arr, n) => {
    const k = 2 / (n + 1);
    let e = arr[0];
    for (let i = 1; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
    return e;
  };
  if (closes.length < 26) return null;
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  return { macd: ema12 - ema26, ema12, ema26 };
}

function detectTrend(price, sma20, sma50) {
  if (!sma20 || !sma50) return 'Insufficient data';
  const pctAbove20 = ((price - sma20) / sma20) * 100;
  const pctAbove50 = ((price - sma50) / sma50) * 100;

  if (price > sma20 && sma20 > sma50) {
    if (pctAbove20 > 3 && pctAbove50 > 5) return 'Strong Uptrend';
    return 'Uptrend';
  }
  if (price < sma20 && sma20 < sma50) {
    if (pctAbove20 < -3 && pctAbove50 < -5) return 'Strong Downtrend';
    return 'Downtrend';
  }
  if (Math.abs(pctAbove20) < 1.5) return 'Sideways';
  return price > sma20 ? 'Weak Uptrend' : 'Weak Downtrend';
}

function trendColor(trend) {
  if (trend.includes('Strong Up')) return '#00C853';
  if (trend.includes('Up'))        return '#69F0AE';
  if (trend.includes('Sideways'))  return '#FFD740';
  if (trend.includes('Weak Down')) return '#FF8A80';
  if (trend.includes('Strong Down')) return '#FF1744';
  return '#FF5252';
}

function rsiLabel(rsi) {
  if (rsi === null) return { label: 'N/A', color: '#555', note: 'Not enough data' };
  if (rsi >= 70) return { label: `${rsi.toFixed(1)} — Overbought`, color: '#FF5252', note: 'Stock may be due for a pullback' };
  if (rsi >= 55) return { label: `${rsi.toFixed(1)} — Bullish`,    color: '#69F0AE', note: 'Momentum is positive' };
  if (rsi >= 45) return { label: `${rsi.toFixed(1)} — Neutral`,    color: '#FFD740', note: 'No clear momentum signal' };
  if (rsi >= 30) return { label: `${rsi.toFixed(1)} — Bearish`,    color: '#FF8A80', note: 'Momentum is negative' };
  return           { label: `${rsi.toFixed(1)} — Oversold`,        color: '#00C853', note: 'Stock may be due for a bounce' };
}

function MiniSparkline({ prices, color = '#00D09C' }) {
  if (!prices?.length) return null;
  const W = 260, H = 60;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * W;
    const y = H - ((p - min) / range) * (H - 6) - 3;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" className="ta-spark">
      <defs>
        <linearGradient id={`tagrad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill={`url(#tagrad-${color.replace('#','')})`}
        points={`0,${H} ${pts} ${W},${H}`} />
      <polyline fill="none" stroke={color} strokeWidth="2" points={pts} />
    </svg>
  );
}

function TrendCard({ symbol, displayName, onRemove }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [range,   setRange]   = useState('3mo');

  // Map display range labels → keys expected by getHistoricalData (RANGE_CONFIG)
  const RANGE_MAP = { '1mo': '1M', '3mo': '6M', '6mo': '6M', '1y': '1Y' };

  useEffect(() => {
    setLoading(true);
    setError('');
    setData(null);

    const apiRange = RANGE_MAP[range] || '6M';

    getHistoricalData(symbol, apiRange)
      .then(result => {
        // getHistoricalData returns { candles, volumes, meta }
        const candles = result?.candles ?? [];

        if (!candles.length) {
          setError('No historical data available for this symbol.');
          setLoading(false);
          return;
        }

        const closes = candles.map(d => d.close).filter(Boolean);

        if (closes.length < 5) {
          setError('Not enough data points to calculate indicators.');
          setLoading(false);
          return;
        }

        const price       = closes[closes.length - 1];
        const open        = closes[0];
        const rangeReturn = ((price - open) / open) * 100;

        const sma7   = calcSMA(closes, 7);
        const sma20  = calcSMA(closes, 20);
        const sma50  = calcSMA(closes, 50);
        const rsi    = calcRSI(closes);
        const macd   = calcMACD(closes);
        const trend  = detectTrend(price, sma20, sma50);

        // Volatility: std dev of daily returns over last 20 candles
        const rets   = closes.slice(-21).map((c, i, a) => i === 0 ? 0 : (c - a[i - 1]) / a[i - 1] * 100).slice(1);
        const avgRet = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
        const vol    = Math.sqrt(rets.reduce((a, b) => a + Math.pow(b - avgRet, 2), 0) / (rets.length || 1));

        // 20-day support / resistance
        const recent20   = closes.slice(-20);
        const support    = Math.min(...recent20);
        const resistance = Math.max(...recent20);

        setData({ closes, price, rangeReturn, sma7, sma20, sma50, rsi, macd, trend, vol, support, resistance });
        setLoading(false);
      })
      .catch(err => {
        console.error('TrendAnalysis fetch error:', err);
        setError('Failed to load data. Check your internet connection or try a different range.');
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, range]);
  const rsiInfo  = data ? rsiLabel(data.rsi) : null;
  const color    = data ? trendColor(data.trend) : '#888';

  return (
    <div className="ta-card" style={{ borderLeftColor: color }}>
      {/* Card header */}
      <div className="ta-card-header">
        <div>
          <div className="ta-card-symbol">{displayName || symbol.replace('.NS','').replace('.BO','')}</div>
          <div className="ta-card-exchange">{symbol}</div>
        </div>
        <div className="ta-card-header-right">
          <div className="ta-range-tabs">
            {['1mo','3mo','6mo','1y'].map(r => (
              <button key={r} className={`ta-range-btn ${range===r?'active':''}`} onClick={() => setRange(r)}>{r}</button>
            ))}
          </div>
          {onRemove && <button className="ta-remove" onClick={onRemove}>✕</button>}
        </div>
      </div>

      {loading && <div className="ta-loading"><div className="ta-spinner" />Loading trend data…</div>}
      {error   && <div className="ta-error">{error}</div>}

      {data && !loading && (
        <>
          {/* Price + trend */}
          <div className="ta-price-row">
            <div>
              <div className="ta-price">₹{data.price.toFixed(2)}</div>
              <div className={`ta-range-ret ${data.rangeReturn >= 0 ? 'up':'down'}`}>
                {data.rangeReturn >= 0 ? '+':''}{data.rangeReturn.toFixed(2)}% ({range})
              </div>
            </div>
            <div className="ta-trend-badge" style={{ background: `${color}22`, color, borderColor: `${color}44` }}>
              {data.trend.includes('Up') ? '▲' : data.trend.includes('Down') ? '▼' : '→'} {data.trend}
            </div>
          </div>

          {/* Sparkline */}
          <MiniSparkline prices={data.closes.slice(-60)} color={color} />

          {/* Metrics grid */}
          <div className="ta-metrics">
            {/* RSI */}
            <div className="ta-metric-block">
              <div className="ta-metric-label">RSI (14)</div>
              <div className="ta-metric-val" style={{ color: rsiInfo.color }}>{rsiInfo.label}</div>
              <div className="ta-metric-note">{rsiInfo.note}</div>
              {data.rsi !== null && (
                <div className="ta-rsi-bar">
                  <div className="ta-rsi-fill" style={{ left: `${data.rsi}%` }} />
                  <div className="ta-rsi-zone oversold" />
                  <div className="ta-rsi-zone neutral" />
                  <div className="ta-rsi-zone overbought" />
                </div>
              )}
            </div>

            {/* Moving Averages */}
            <div className="ta-metric-block">
              <div className="ta-metric-label">Moving Averages</div>
              {[['SMA 7', data.sma7], ['SMA 20', data.sma20], ['SMA 50', data.sma50]].map(([label, val]) => (
                val !== null && (
                  <div className="ta-ma-row" key={label}>
                    <span className="ta-ma-label">{label}</span>
                    <span className="ta-ma-val">₹{val.toFixed(2)}</span>
                    <span className={`ta-ma-cmp ${data.price >= val ? 'up':'down'}`}>
                      {data.price >= val ? '▲ Above' : '▼ Below'}
                    </span>
                  </div>
                )
              ))}
            </div>

            {/* Support & Resistance */}
            <div className="ta-metric-block">
              <div className="ta-metric-label">Support / Resistance (20d)</div>
              <div className="ta-sr-row">
                <div className="ta-sr-item resist">
                  <span>Resistance</span>
                  <strong>₹{data.resistance.toFixed(2)}</strong>
                </div>
                <div className="ta-sr-item support">
                  <span>Support</span>
                  <strong>₹{data.support.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            {/* Volatility */}
            <div className="ta-metric-block">
              <div className="ta-metric-label">Daily Volatility (20d)</div>
              <div className="ta-metric-val" style={{ color: data.vol > 3 ? '#FF5252' : data.vol > 1.5 ? '#FFD740' : '#00C853' }}>
                {data.vol.toFixed(2)}%
              </div>
              <div className="ta-metric-note">
                {data.vol > 3 ? 'High volatility — risky' : data.vol > 1.5 ? 'Moderate volatility' : 'Low volatility — stable'}
              </div>
            </div>

            {/* MACD */}
            {data.macd && (
              <div className="ta-metric-block">
                <div className="ta-metric-label">MACD Signal</div>
                <div className="ta-metric-val" style={{ color: data.macd.macd >= 0 ? '#00C853':'#FF5252' }}>
                  {data.macd.macd >= 0 ? '📈 Bullish' : '📉 Bearish'}
                </div>
                <div className="ta-metric-note">
                  MACD: {data.macd.macd.toFixed(2)} (EMA12 {data.macd.ema12.toFixed(2)} vs EMA26 {data.macd.ema26.toFixed(2)})
                </div>
              </div>
            )}

            {/* Overall Signal */}
            <div className="ta-metric-block ta-signal-block">
              <div className="ta-metric-label">Overall Technical Signal</div>
              {(() => {
                let bull = 0, bear = 0;
                if (data.rsi !== null) { if (data.rsi < 50) bear++; else bull++; }
                if (data.sma20 !== null) { if (data.price > data.sma20) bull++; else bear++; }
                if (data.sma50 !== null) { if (data.price > data.sma50) bull++; else bear++; }
                if (data.macd)          { if (data.macd.macd > 0) bull++; else bear++; }
                const total  = bull + bear;
                const pctBull = total > 0 ? (bull / total) * 100 : 50;
                const signal = pctBull >= 70 ? { label:'🚀 Strong Bullish', color:'#00C853' }
                             : pctBull >= 55 ? { label:'📈 Mildly Bullish',  color:'#69F0AE' }
                             : pctBull <= 30 ? { label:'🔴 Strong Bearish',  color:'#FF1744' }
                             : pctBull <= 45 ? { label:'📉 Mildly Bearish',  color:'#FF8A80' }
                             :                 { label:'➡️ Neutral',          color:'#FFD740' };
                return (
                  <>
                    <div className="ta-metric-val" style={{ color: signal.color }}>{signal.label}</div>
                    <div className="ta-signal-bar">
                      <div className="ta-signal-fill" style={{ left: `${pctBull}%` }} />
                    </div>
                    <div className="ta-signal-labels">
                      <span style={{ color:'#FF5252' }}>Bearish {bear}/{total}</span>
                      <span style={{ color:'#00C853' }}>Bullish {bull}/{total}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function TrendAnalysis({ portfolioHoldings = [] }) {
  const [searchQ,   setSearchQ]   = useState('');
  const [searching, setSearching] = useState(false);
  const [searchRes, setSearchRes] = useState([]);
  const [watchList, setWatchList] = useState([]); // { symbol, displayName }
  const [hiddenHoldings, setHiddenHoldings] = useState([]); // [symbol]

  // Auto-load portfolio holdings (excluding hidden ones)
  const portfolioSymbols = portfolioHoldings
    .filter(h => !hiddenHoldings.includes(h.stock_symbol))
    .map(h => ({
      symbol: h.stock_symbol,
      displayName: h.stock_symbol.replace('.NS','').replace('.BO',''),
      isHolding: true,
    }));

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQ.length < 2) { setSearchRes([]); return; }
      setSearching(true);
      try {
        const res = await searchSymbols(searchQ);
        setSearchRes((res || []).slice(0, 6));
      } catch { setSearchRes([]); }
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQ]);

  const addToWatch = (symbol, name) => {
    const disp = name || symbol.replace('.NS','').replace('.BO','');
    if (!watchList.find(w => w.symbol === symbol) && !portfolioSymbols.find(p => p.symbol === symbol)) {
      setWatchList(prev => [...prev, { symbol, displayName: disp }]);
    }
    setSearchQ('');
    setSearchRes([]);
  };

  const removeFromWatch = (symbol) => setWatchList(prev => prev.filter(w => w.symbol !== symbol));

  const handleRemove = (symbol, isHolding) => {
    if (isHolding) setHiddenHoldings(prev => [...prev, symbol]);
    else removeFromWatch(symbol);
  };

  const allSymbols = [...portfolioSymbols, ...watchList];

  return (
    <div className="ta-page">
      <div className="ta-hero">
        <div className="ta-hero-icon">📊</div>
        <h1 className="ta-title">Trend Analysis</h1>
        <p className="ta-sub">Technical indicators for your portfolio stocks — RSI, SMA, MACD, Support & Resistance</p>
      </div>

      {/* Search bar */}
      <div className="ta-search-wrap">
        <div className="ta-search-box">
          <svg width="16" height="16" fill="none" stroke="#555" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            id="ta-search-input"
            className="ta-search-input"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search any stock to analyze (e.g. INFY, TCS, HDFC)…"
          />
          {searching && <div className="ta-spinner small" />}
        </div>
        {searchRes.length > 0 && (
          <div className="ta-search-dropdown">
            {searchRes.map(r => (
              <button
                key={r.symbol}
                className="ta-search-result"
                onClick={() => addToWatch(r.symbol, r.shortname || r.longname)}
              >
                <span className="ta-sr-sym">{r.symbol}</span>
                <span className="ta-sr-name">{r.shortname || r.longname}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {allSymbols.length === 0 ? (
        <div className="ta-empty">
          <div style={{ fontSize: 48 }}>📈</div>
          <div>Add holdings to your portfolio or search for a stock above to see trend analysis.</div>
          {hiddenHoldings.length > 0 && (
            <button className="ta-range-btn" onClick={() => setHiddenHoldings([])} style={{ marginTop: 10 }}>
              Restore hidden portfolio stocks
            </button>
          )}
        </div>
      ) : (
        <div className="ta-grid">
          {allSymbols.map(({ symbol, displayName, isHolding }) => (
            <TrendCard
              key={symbol}
              symbol={symbol}
              displayName={displayName}
              onRemove={() => handleRemove(symbol, isHolding)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
