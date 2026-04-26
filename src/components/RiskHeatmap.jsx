/**
 * RiskHeatmap.jsx
 * ────────────────────────────────────────────────────────────────────────────
 * Visual risk heatmap for portfolio holdings.
 * Each tile represents one stock; size = portfolio weight; color = risk level.
 *
 * Risk score per stock = weighted combination of:
 *   • Today's absolute % change (volatility proxy)
 *   • Overall P&L% distance from cost
 *   • Portfolio concentration weight
 * ────────────────────────────────────────────────────────────────────────────
 */

import './RiskHeatmap.css';

/** Returns a CSS color from green (low risk) → red (high risk) */
function riskColor(riskScore) {
  // riskScore: 0 (safe) → 100 (very risky)
  const clamped = Math.min(100, Math.max(0, riskScore));
  if (clamped < 20)  return { bg: '#00C853', label: 'Low Risk',    emoji: '🟢' };
  if (clamped < 40)  return { bg: '#64DD17', label: 'Low-Med',     emoji: '🟩' };
  if (clamped < 55)  return { bg: '#FFD740', label: 'Moderate',    emoji: '🟡' };
  if (clamped < 70)  return { bg: '#FF6D00', label: 'High Risk',   emoji: '🟠' };
  return               { bg: '#FF1744', label: 'Very High',  emoji: '🔴' };
}

function computeRisk(holding, quote, weight) {
  const avgBuy   = Number(holding.average_buy_price) || 0;
  const curPrice = Number(quote?.price) || avgBuy;
  const changePct = Math.abs(Number(quote?.changePct) || 0);
  const plPct    = avgBuy > 0 ? ((curPrice - avgBuy) / avgBuy) * 100 : 0;
  const weightPct = weight * 100;

  // Volatility component (today's movement) — higher = riskier
  const volatilityScore = Math.min(40, changePct * 6);

  // Drawdown component — negative P&L → risky, very high positive → bubble risk
  let plScore = 0;
  if (plPct < -20)        plScore = 40;
  else if (plPct < -10)   plScore = 30;
  else if (plPct < -5)    plScore = 20;
  else if (plPct > 50)    plScore = 25; // overextended
  else if (plPct > 30)    plScore = 15;
  else                    plScore = Math.max(0, -plPct);

  // Concentration risk
  const concScore = Math.min(20, weightPct * 0.5);

  const total = volatilityScore + plScore + concScore;
  return { riskScore: total, changePct: Number(quote?.changePct || 0), plPct, weightPct };
}

export default function RiskHeatmap({ holdings, prices, totalValue }) {
  if (!holdings?.length) {
    return (
      <div className="rhm-empty">
        <span>No holdings to display risk heatmap.</span>
      </div>
    );
  }

  const enriched = holdings.map((h) => {
    const q      = prices[h.stock_symbol] || {};
    const price  = q.price ?? Number(h.average_buy_price);
    const value  = price * Number(h.quantity);
    const weight = totalValue > 0 ? value / totalValue : 1 / holdings.length;
    const risk   = computeRisk(h, q, weight);
    const color  = riskColor(risk.riskScore);

    return {
      symbol:   h.stock_symbol,
      name:     h.stock_symbol.replace('.NS', '').replace('.BO', ''),
      quantity: h.quantity,
      value,
      weight,
      price,
      ...risk,
      ...color,
    };
  }).sort((a, b) => b.riskScore - a.riskScore);

  // Tooltip state handled via CSS :hover

  return (
    <div className="rhm-wrapper">
      <div className="rhm-legend">
        {[
          { label: 'Low Risk',   color: '#00C853' },
          { label: 'Low-Med',    color: '#64DD17' },
          { label: 'Moderate',   color: '#FFD740' },
          { label: 'High Risk',  color: '#FF6D00' },
          { label: 'Very High',  color: '#FF1744' },
        ].map((l) => (
          <span key={l.label} className="rhm-legend-item">
            <span className="rhm-dot" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
        <span className="rhm-legend-note">Tile size = portfolio weight</span>
      </div>

      <div className="rhm-grid">
        {enriched.map((stock) => {
          // Tile size: min 80px, max 200px based on weight
          const size = Math.max(80, Math.min(200, Math.round(stock.weightPct * 8 + 70)));

          return (
            <div
              key={stock.symbol}
              className="rhm-tile"
              style={{
                background:  stock.bg,
                width:  `${size}px`,
                height: `${size}px`,
              }}
            >
              <div className="rhm-tile-inner">
                <div className="rhm-tile-name">{stock.name}</div>
                <div className="rhm-tile-risk">{stock.label}</div>
                <div className="rhm-tile-pl">
                  {stock.plPct >= 0 ? '+' : ''}{stock.plPct.toFixed(1)}%
                </div>
              </div>

              {/* Tooltip */}
              <div className="rhm-tooltip">
                <div className="rhm-tt-symbol">{stock.symbol}</div>
                <div className="rhm-tt-row">
                  <span>Today</span>
                  <span className={stock.changePct >= 0 ? 'up' : 'down'}>
                    {stock.changePct >= 0 ? '+' : ''}{stock.changePct.toFixed(2)}%
                  </span>
                </div>
                <div className="rhm-tt-row">
                  <span>Total P&L</span>
                  <span className={stock.plPct >= 0 ? 'up' : 'down'}>
                    {stock.plPct >= 0 ? '+' : ''}{stock.plPct.toFixed(2)}%
                  </span>
                </div>
                <div className="rhm-tt-row">
                  <span>Weight</span>
                  <span>{stock.weightPct.toFixed(1)}%</span>
                </div>
                <div className="rhm-tt-row">
                  <span>Risk Score</span>
                  <span style={{ color: stock.bg }}>{stock.riskScore.toFixed(0)}/100</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
