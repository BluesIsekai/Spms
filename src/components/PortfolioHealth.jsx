import { useMemo } from 'react';
import './PortfolioHealth.css';

// ── Score computation ─────────────────────────────────────────────────────────

function computeHealthScore(holdings, prices) {
  if (!holdings?.length) return null;

  const enriched = holdings.map(h => {
    const q        = prices?.[h.stock_symbol] || {};
    const curPrice = Number(q.price) || Number(h.average_buy_price);
    const avgBuy   = Number(h.average_buy_price);
    const qty      = Number(h.quantity);
    const curVal   = curPrice * qty;
    const invested = avgBuy   * qty;
    const plPct    = invested > 0 ? ((curVal - invested) / invested) * 100 : 0;
    const changePct = Number(q.changePct) || 0;
    return { ...h, curPrice, curVal, invested, plPct, changePct };
  });

  const totalVal = enriched.reduce((s, h) => s + h.curVal, 0);
  const n        = enriched.length;

  // Weights
  const withWeight = enriched.map(h => ({
    ...h,
    weight: totalVal > 0 ? (h.curVal / totalVal) * 100 : 0,
  }));

  const maxWeight = Math.max(...withWeight.map(h => h.weight));

  // ── Component 1: Diversification (0–25 pts) ───────────────────────────────
  // More stocks in appropriate range = better
  let diversScore = 0;
  if      (n >= 10) diversScore = 25;
  else if (n >= 7)  diversScore = 22;
  else if (n >= 5)  diversScore = 18;
  else if (n >= 3)  diversScore = 13;
  else if (n === 2) diversScore = 8;
  else              diversScore = 4;

  // ── Component 2: Concentration (0–25 pts) ────────────────────────────────
  // Lower max weight = better
  let concScore = 0;
  if      (maxWeight < 15) concScore = 25;
  else if (maxWeight < 25) concScore = 20;
  else if (maxWeight < 35) concScore = 14;
  else if (maxWeight < 50) concScore = 8;
  else                     concScore = 3;

  // ── Component 3: Profitability (0–25 pts) ────────────────────────────────
  const profitCount  = withWeight.filter(h => h.plPct >= 0).length;
  const profitRatio  = n > 0 ? profitCount / n : 0;
  const totalPL      = withWeight.reduce((s, h) => s + (h.curVal - h.invested), 0);
  const totalInv     = withWeight.reduce((s, h) => s + h.invested, 0);
  const overallPLPct = totalInv > 0 ? (totalPL / totalInv) * 100 : 0;

  let profitScore = Math.round(profitRatio * 20); // up to 20
  if (overallPLPct > 0) profitScore = Math.min(25, profitScore + 5);

  // ── Component 4: Volatility/Stability (0–25 pts) ─────────────────────────
  // Classify each stock, then reward stable mix
  const classify = (h) => {
    const absChange = Math.abs(h.changePct);
    const absPL     = Math.abs(h.plPct);
    if (absChange > 4 || absPL > 30) return 'risky';
    if (absChange > 2 || absPL > 15) return 'moderate';
    return 'stable';
  };

  const classes     = withWeight.map(classify);
  const stableCount = classes.filter(c => c === 'stable').length;
  const modCount    = classes.filter(c => c === 'moderate').length;
  const riskyCount  = classes.filter(c => c === 'risky').length;

  const stableRatio = n > 0 ? stableCount / n : 0;
  const riskyRatio  = n > 0 ? riskyCount  / n : 0;
  let volScore = Math.round(stableRatio * 22) - Math.round(riskyRatio * 10);
  volScore = Math.max(0, Math.min(25, volScore + 3)); // base 3

  const total = diversScore + concScore + profitScore + volScore;
  const grade = total >= 85 ? 'A+' : total >= 75 ? 'A' : total >= 65 ? 'B' : total >= 50 ? 'C' : 'D';
  const gradeColor = total >= 75 ? '#00C853' : total >= 60 ? '#FFD740' : total >= 45 ? '#FF6D00' : '#FF5252';

  return {
    total, grade, gradeColor,
    components: [
      { label: 'Diversification', score: diversScore,  max: 25, icon: '🌐', hint: `${n} stocks held` },
      { label: 'Concentration',   score: concScore,    max: 25, icon: '⚖️', hint: `Max single stock: ${maxWeight.toFixed(1)}%` },
      { label: 'Profitability',   score: profitScore,  max: 25, icon: '💹', hint: `${profitCount}/${n} stocks profitable` },
      { label: 'Stability',       score: volScore,     max: 25, icon: '🛡️', hint: `${stableCount} stable, ${modCount} moderate, ${riskyCount} risky` },
    ],
    volatility: { stableCount, modCount, riskyCount, classes, holdings: withWeight.map((h, i) => ({ ...h, vol: classes[i] })) },
    overallPLPct,
  };
}

// ── Circular gauge ────────────────────────────────────────────────────────────
function ScoreGauge({ score, grade, color }) {
  const R   = 44;
  const cx  = 56, cy = 56;
  const circumference = 2 * Math.PI * R;
  // Draw only 270° arc (from 135° to 45° clockwise)
  const arcLen  = circumference * 0.75;
  const fillLen = (score / 100) * arcLen;
  const offset  = circumference - fillLen;

  return (
    <div className="ph-gauge-wrap">
      <svg width="112" height="112" viewBox="0 0 112 112">
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={R}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="10"
          strokeDasharray={`${arcLen} ${circumference - arcLen}`}
          strokeDashoffset={circumference * 0.125} /* start at 135° */
          strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
        />
        {/* Fill */}
        <circle
          cx={cx} cy={cy} r={R}
          fill="none"
          stroke={`url(#gauge-grad-${score})`}
          strokeWidth="10"
          strokeDasharray={`${fillLen} ${circumference - fillLen}`}
          strokeDashoffset={circumference * 0.125}
          strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
        <defs>
          <linearGradient id={`gauge-grad-${score}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={score >= 50 ? color : '#FF5252'} />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        {/* Score text */}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#fff" fontSize="22" fontWeight="800" fontFamily="Inter">{score}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#555" fontSize="10" fontFamily="Inter">/100</text>
        {/* Grade */}
        <text x={cx} y={cy + 26} textAnchor="middle" fill={color} fontSize="13" fontWeight="800" fontFamily="Inter">{grade}</text>
      </svg>
      <div className="ph-gauge-label">Health Score</div>
    </div>
  );
}

// ── Volatility donut ──────────────────────────────────────────────────────────
function VolDonut({ stable, moderate, risky }) {
  const total = stable + moderate + risky || 1;
  const sp = (stable   / total) * 251.2;
  const mp = (moderate / total) * 251.2;
  const rp = (risky    / total) * 251.2;
  const R = 40, cx = 50, cy = 50;

  let offset = 0;
  const segs = [
    { val: sp, color: '#00C853', label: 'Stable',   count: stable   },
    { val: mp, color: '#FFD740', label: 'Moderate', count: moderate },
    { val: rp, color: '#FF5252', label: 'Risky',    count: risky    },
  ];

  return (
    <div className="ph-donut-wrap">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="16" />
        {segs.map((s, i) => {
          if (s.val === 0) { return null; }
          const el = (
            <circle
              key={i}
              cx={cx} cy={cy} r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="16"
              strokeDasharray={`${s.val} ${251.2 - s.val}`}
              strokeDashoffset={-(offset - 251.2 * 0.25)}
              strokeLinecap="butt"
              style={{ transition: 'stroke-dasharray 1s ease' }}
            />
          );
          offset += s.val;
          return el;
        })}
        <text x={cx} y={cy - 3} textAnchor="middle" fill="#fff" fontSize="14" fontWeight="800" fontFamily="Inter">{total}</text>
        <text x={cx} y={cy + 11} textAnchor="middle" fill="#555" fontSize="8"  fontFamily="Inter">stocks</text>
      </svg>
      <div className="ph-donut-legend">
        {segs.map(s => s.count > 0 && (
          <div key={s.label} className="ph-leg-item">
            <span className="ph-leg-dot" style={{ background: s.color }} />
            <span className="ph-leg-label">{s.label}</span>
            <span className="ph-leg-count">{s.count}</span>
          </div>
        ))}
      </div>
      <div className="ph-donut-label">Volatility Meter</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PortfolioHealth({ holdings, prices }) {
  const data = useMemo(() => computeHealthScore(holdings, prices), [holdings, prices]);

  if (!data || !holdings?.length) return null;

  const { total, grade, gradeColor, components, volatility } = data;

  return (
    <div className="ph-banner">
      {/* Left: Score gauge */}
      <ScoreGauge score={total} grade={grade} color={gradeColor} />

      {/* Middle: Score breakdown */}
      <div className="ph-breakdown">
        <div className="ph-bd-title">Score Breakdown</div>
        {components.map(c => {
          const pct = (c.score / c.max) * 100;
          const barColor = pct >= 75 ? '#00C853' : pct >= 50 ? '#FFD740' : '#FF6D00';
          return (
            <div key={c.label} className="ph-bd-row">
              <div className="ph-bd-left">
                <span className="ph-bd-icon">{c.icon}</span>
                <div>
                  <div className="ph-bd-name">{c.label}</div>
                  <div className="ph-bd-hint">{c.hint}</div>
                </div>
              </div>
              <div className="ph-bd-right">
                <div className="ph-bd-bar">
                  <div className="ph-bd-fill" style={{ width: `${pct}%`, background: barColor }} />
                </div>
                <span className="ph-bd-score" style={{ color: barColor }}>
                  {c.score}<span className="ph-bd-max">/{c.max}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Right: Volatility donut + stock chips */}
      <div className="ph-volatility">
        <VolDonut
          stable={volatility.stableCount}
          moderate={volatility.modCount}
          risky={volatility.riskyCount}
        />

        {/* Per-stock volatility chips */}
        <div className="ph-vol-stocks">
          {volatility.holdings.map(h => {
            const sym = h.stock_symbol.replace('.NS','').replace('.BO','');
            const colors = { stable: '#00C853', moderate: '#FFD740', risky: '#FF5252' };
            const bg     = { stable: 'rgba(0,200,83,0.1)', moderate: 'rgba(255,215,64,0.1)', risky: 'rgba(255,82,82,0.1)' };
            return (
              <div key={h.stock_symbol} className="ph-vol-chip"
                style={{ borderColor: `${colors[h.vol]}44`, background: bg[h.vol] }}>
                <span className="ph-vol-sym" style={{ color: colors[h.vol] }}>{sym}</span>
                <span className="ph-vol-label">{h.vol}</span>
                <span className="ph-vol-change" style={{ color: colors[h.vol] }}>
                  {h.changePct >= 0 ? '+' : ''}{h.changePct.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
