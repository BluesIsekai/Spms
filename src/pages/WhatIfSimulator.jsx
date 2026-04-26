import { useState, useRef } from 'react';
import { getHistoricalData, searchSymbols, getQuote } from '../services/yahooStockApi';
import './WhatIfSimulator.css';

const BENCHMARK_SYMBOL = '^NSEI'; // Nifty 50 as benchmark

// Period presets: label → Yahoo Finance range key
const PERIOD_OPTIONS = [
  { label: '1 Month',  value: '1M'  },
  { label: '6 Months', value: '6M'  },
  { label: '1 Year',   value: '1Y'  },
  { label: 'Max',      value: 'MAX' },
];

function fmt(n) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function MiniSparkline({ candles, color = '#00D09C' }) {
  if (!candles?.length) return null;
  const closes = candles.map(c => c.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const W = 260, H = 60;
  const pts = closes.map((v, i) => {
    const x = (i / (closes.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="60" preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="spkgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={color} strokeWidth="2" points={pts} />
      <polygon
        fill="url(#spkgrad)"
        points={`0,${H} ${pts} ${W},${H}`}
      />
    </svg>
  );
}

export default function WhatIfSimulator() {
  const [symbol,         setSymbol]        = useState('');
  const [symbolDisplay,  setSymbolDisplay] = useState('');
  const [amount,         setAmount]        = useState('10000');
  const [period,         setPeriod]        = useState('1Y');
  const [searchResults,  setSearchResults] = useState([]);
  const [isSearching,    setIsSearching]   = useState(false);
  const [showDropdown,   setShowDropdown]  = useState(false);
  const [loading,        setLoading]       = useState(false);
  const [error,          setError]         = useState('');
  const [result,         setResult]        = useState(null);
  const searchTimer = useRef(null);

  // ── Symbol search ──────────────────────────────────────────────────────────
  const handleSymbolInput = (e) => {
    const q = e.target.value;
    setSymbolDisplay(q);
    setSymbol('');
    setShowDropdown(true);

    clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchSymbols(q);
        setSearchResults(res || []);
      } catch { setSearchResults([]); }
      finally { setIsSearching(false); }
    }, 300);
  };

  const selectSymbol = (res) => {
    setSymbol(res.symbol);
    setSymbolDisplay(`${res.symbol} — ${res.shortname || res.longname || ''}`);
    setSearchResults([]);
    setShowDropdown(false);
  };

  // ── Simulate ───────────────────────────────────────────────────────────────
  const handleSimulate = async () => {
    const sym = symbol || symbolDisplay.split('—')[0].trim();
    if (!sym) { setError('Please select a stock symbol.'); return; }
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError('Please enter a valid amount.'); return; }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const [stockData, benchData, currentQuote] = await Promise.all([
        getHistoricalData(sym, period),
        getHistoricalData(BENCHMARK_SYMBOL, period),
        getQuote(sym),
      ]);

      const stockCandles = stockData.candles;
      const benchCandles = benchData.candles;

      if (!stockCandles.length) {
        setError('No historical data available for this symbol and period.');
        setLoading(false);
        return;
      }

      const buyPrice  = stockCandles[0].close;
      const sellPrice = stockCandles[stockCandles.length - 1].close;
      const shares    = amt / buyPrice;
      const currentValue = shares * sellPrice;
      const profitLoss   = currentValue - amt;
      const returnPct    = ((sellPrice - buyPrice) / buyPrice) * 100;

      // CAGR calculation
      const days = stockCandles.length;
      const years = days / 252; // trading days per year
      const cagr  = years > 0 ? (Math.pow(sellPrice / buyPrice, 1 / years) - 1) * 100 : returnPct;

      // Benchmark comparison
      let benchReturn = null;
      if (benchCandles.length >= 2) {
        const bStart = benchCandles[0].close;
        const bEnd   = benchCandles[benchCandles.length - 1].close;
        benchReturn  = ((bEnd - bStart) / bStart) * 100;
      }

      // Peak & trough during period
      const closes = stockCandles.map(c => c.close);
      const peak   = Math.max(...closes);
      const trough = Math.min(...closes);
      const maxDrawdown = ((trough - peak) / peak) * 100;

      setResult({
        sym,
        name: currentQuote?.name || sym,
        amount: amt,
        buyPrice,
        sellPrice,
        shares,
        currentValue,
        profitLoss,
        returnPct,
        cagr,
        benchReturn,
        maxDrawdown,
        peak,
        trough,
        candles: stockCandles,
        currency: currentQuote?.currency || 'INR',
        period,
      });
    } catch (err) {
      setError(`Failed to fetch data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const isProfit = result && result.profitLoss >= 0;

  return (
    <div className="wif-page">
      <div className="wif-hero">
        <div className="wif-hero-icon">⏳</div>
        <h1 className="wif-title">What-If Simulator</h1>
        <p className="wif-subtitle">
          "If I had invested ₹10,000 in this stock 1 year ago — how much would I have today?"
        </p>
      </div>

      {/* ── Input Panel ── */}
      <div className="wif-card">
        <div className="wif-form">
          {/* Symbol search */}
          <div className="wif-field">
            <label className="wif-label">Stock / ETF / Index</label>
            <div className="wif-search-wrap">
              <input
                className="wif-input"
                placeholder="Search symbol… e.g. RELIANCE, TCS, NIFTY"
                value={symbolDisplay}
                onChange={handleSymbolInput}
                onFocus={() => setShowDropdown(true)}
                autoComplete="off"
                id="wif-symbol-input"
              />
              {showDropdown && (searchResults.length > 0 || isSearching) && (
                <div className="wif-dropdown">
                  {isSearching ? (
                    <div className="wif-dd-loading">Searching…</div>
                  ) : searchResults.map(r => (
                    <button
                      key={r.symbol}
                      className="wif-dd-item"
                      onMouseDown={() => selectSymbol(r)}
                    >
                      <span className="wif-dd-sym">{r.symbol}</span>
                      <span className="wif-dd-name">{r.shortname || r.longname || ''}</span>
                      <span className="wif-dd-type">{r.exchDisp || ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Amount */}
          <div className="wif-field">
            <label className="wif-label">Investment Amount (₹)</label>
            <input
              id="wif-amount-input"
              type="number"
              className="wif-input"
              placeholder="10000"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min="1"
            />
          </div>

          {/* Period */}
          <div className="wif-field">
            <label className="wif-label">Period</label>
            <div className="wif-period-tabs">
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`wif-period-btn ${period === opt.value ? 'active' : ''}`}
                  onClick={() => setPeriod(opt.value)}
                  id={`wif-period-${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            id="wif-simulate-btn"
            className="wif-btn-primary"
            onClick={handleSimulate}
            disabled={loading}
          >
            {loading ? (
              <span className="wif-spinner" />
            ) : (
              <>🔮 Simulate Investment</>
            )}
          </button>
        </div>

        {error && <div className="wif-error">{error}</div>}
      </div>

      {/* ── Results Panel ── */}
      {result && (
        <div className="wif-result-section">
          {/* Hero result */}
          <div className={`wif-result-hero ${isProfit ? 'profit' : 'loss'}`}>
            <div className="wif-rh-left">
              <div className="wif-rh-label">
                If you had invested <strong>₹{fmt(result.amount)}</strong> in{' '}
                <strong>{result.name}</strong> {period === 'MAX' ? 'from the beginning' : `${PERIOD_OPTIONS.find(p=>p.value===period)?.label} ago`}
              </div>
              <div className="wif-rh-value">
                ₹{fmt(result.currentValue)}
              </div>
              <div className={`wif-rh-pl ${isProfit ? 'up' : 'down'}`}>
                {isProfit ? '▲' : '▼'} {isProfit ? '+' : ''}₹{fmt(Math.abs(result.profitLoss))}
                {' '}({isProfit ? '+' : ''}{result.returnPct.toFixed(2)}%)
              </div>
            </div>
            <div className="wif-rh-sparkline">
              <MiniSparkline candles={result.candles} color={isProfit ? '#00C853' : '#FF1744'} />
            </div>
          </div>

          {/* Stats grid */}
          <div className="wif-stats-grid">
            <div className="wif-stat-card">
              <div className="wif-stat-label">Shares You'd Own</div>
              <div className="wif-stat-value">{result.shares.toFixed(4)}</div>
            </div>
            <div className="wif-stat-card">
              <div className="wif-stat-label">Buy Price (then)</div>
              <div className="wif-stat-value">₹{fmt(result.buyPrice)}</div>
            </div>
            <div className="wif-stat-card">
              <div className="wif-stat-label">Current Price</div>
              <div className="wif-stat-value">₹{fmt(result.sellPrice)}</div>
            </div>
            <div className="wif-stat-card">
              <div className="wif-stat-label">CAGR (annualised)</div>
              <div className={`wif-stat-value ${result.cagr >= 0 ? 'up' : 'down'}`}>
                {result.cagr >= 0 ? '+' : ''}{result.cagr.toFixed(2)}%
              </div>
            </div>
            <div className="wif-stat-card">
              <div className="wif-stat-label">Period High</div>
              <div className="wif-stat-value">₹{fmt(result.peak)}</div>
            </div>
            <div className="wif-stat-card">
              <div className="wif-stat-label">Max Drawdown</div>
              <div className="wif-stat-value down">{result.maxDrawdown.toFixed(2)}%</div>
            </div>
          </div>

          {/* Benchmark comparison */}
          {result.benchReturn !== null && (
            <div className="wif-bench-card">
              <div className="wif-bench-title">📊 vs Nifty 50 Benchmark</div>
              <div className="wif-bench-row">
                <div className="wif-bench-item">
                  <div className="wif-bench-label">{result.name}</div>
                  <div className={`wif-bench-pct ${result.returnPct >= 0 ? 'up' : 'down'}`}>
                    {result.returnPct >= 0 ? '+' : ''}{result.returnPct.toFixed(2)}%
                  </div>
                </div>
                <div className="wif-bench-vs">vs</div>
                <div className="wif-bench-item">
                  <div className="wif-bench-label">Nifty 50</div>
                  <div className={`wif-bench-pct ${result.benchReturn >= 0 ? 'up' : 'down'}`}>
                    {result.benchReturn >= 0 ? '+' : ''}{result.benchReturn.toFixed(2)}%
                  </div>
                </div>
              </div>
              <div className="wif-bench-verdict">
                {result.returnPct > result.benchReturn
                  ? `🏆 ${result.name} outperformed Nifty 50 by ${(result.returnPct - result.benchReturn).toFixed(2)}%`
                  : result.returnPct < result.benchReturn
                  ? `📉 ${result.name} underperformed Nifty 50 by ${(result.benchReturn - result.returnPct).toFixed(2)}%`
                  : 'Matched benchmark performance exactly.'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
