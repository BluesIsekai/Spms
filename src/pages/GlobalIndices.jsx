import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStockPolling } from '../hooks/useStockPolling';
import './GlobalIndices.css';

const GLOBAL_INDICES = [
  { label: 'GIFT Nifty',  symbol: 'GIFTNIFTY.NS', region: 'India',   flag: '🇮🇳' },
  { label: 'Dow Jones',   symbol: '^DJI',          region: 'USA',     flag: '🇺🇸' },
  { label: 'Dow Futures', symbol: 'YM=F',          region: 'USA',     flag: '🇺🇸' },
  { label: 'S&P 500',     symbol: '^GSPC',         region: 'USA',     flag: '🇺🇸' },
  { label: 'NASDAQ',      symbol: '^IXIC',         region: 'USA',     flag: '🇺🇸' },
  { label: 'Nikkei 225',  symbol: '^N225',         region: 'Japan',   flag: '🇯🇵' },
  { label: 'Hang Seng',   symbol: '^HSI',          region: 'HK',      flag: '🇭🇰' },
  { label: 'DAX',         symbol: '^GDAXI',        region: 'Germany', flag: '🇩🇪' },
  { label: 'CAC 40',      symbol: '^FCHI',         region: 'France',  flag: '🇫🇷' },
  { label: 'KOSPI',       symbol: '^KS11',         region: 'Korea',   flag: '🇰🇷' },
  { label: 'FTSE 100',    symbol: '^FTSE',         region: 'UK',      flag: '🇬🇧' },
];

const ALL_SYMBOLS = GLOBAL_INDICES.map(i => i.symbol);

export default function GlobalIndices() {
  const navigate = useNavigate();
  const { prices } = useStockPolling(ALL_SYMBOLS, 10_000);

  const enriched = useMemo(() =>
    GLOBAL_INDICES.map(idx => ({
      ...idx,
      price:     prices[idx.symbol]?.price     ?? null,
      change:    prices[idx.symbol]?.change    ?? 0,
      changePct: prices[idx.symbol]?.changePct ?? 0,
    })),
    [prices]
  );

  return (
    <div className="gi-page">
      {/* Header */}
      <div className="gi-header">
        <button className="gi-back-btn" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <div className="gi-title-block">
          <h1 className="gi-title">Global Indices</h1>
          <span className="gi-subtitle">Live market data across major world exchanges</span>
        </div>
        <div className="gi-live-badge">
          <span className="gi-live-dot" />
          Live
        </div>
      </div>

      {/* Grid of cards */}
      <div className="gi-grid">
        {enriched.map(idx => {
          const isUp = idx.changePct >= 0;
          const hasData = idx.price !== null;
          return (
            <div
              key={idx.symbol}
              className={`gi-card ${hasData ? (isUp ? 'gi-card-up' : 'gi-card-down') : ''}`}
              onClick={() => navigate(`/chart/${encodeURIComponent(idx.symbol)}`)}
            >
              <div className="gi-card-top">
                <div className="gi-card-flag-region">
                  <span className="gi-flag">{idx.flag}</span>
                  <span className="gi-region">{idx.region}</span>
                </div>
                {hasData && (
                  <span className={`gi-card-badge ${isUp ? 'up' : 'down'}`}>
                    {isUp ? '▲' : '▼'} {Math.abs(idx.changePct).toFixed(2)}%
                  </span>
                )}
              </div>

              <div className="gi-card-name">{idx.label}</div>
              <div className="gi-card-symbol">{idx.symbol.replace('^', '').replace('=F', ' Futures').replace('.NS', '')}</div>

              <div className="gi-card-bottom">
                <span className="gi-card-price">
                  {hasData
                    ? idx.price.toLocaleString('en-US', { maximumFractionDigits: 2 })
                    : <span className="gi-loading">Loading…</span>
                  }
                </span>
                {hasData && (
                  <span className={`gi-card-change ${isUp ? 'up' : 'down'}`}>
                    {isUp ? '+' : ''}{idx.change.toFixed(2)} ({isUp ? '+' : ''}{idx.changePct.toFixed(2)}%)
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
