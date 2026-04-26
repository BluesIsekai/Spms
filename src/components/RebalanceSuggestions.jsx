import { useMemo, useState } from 'react';
import './RebalanceSuggestions.css';

const PRESET_STRATEGIES = {
  equal:      { label: 'Equal Weight',       desc: 'Every stock gets the same allocation' },
  top3heavy:  { label: 'Top-3 Heavy (60/40)', desc: 'Top 3 holdings get 60%, rest split 40%' },
  custom:     { label: 'Custom Targets',      desc: 'Set your own target % for each stock' },
};

const OVERWEIGHT_THRESHOLD  = 30; // % of portfolio — above this = overweight
const UNDERWEIGHT_THRESHOLD = 5;  // % of portfolio — below this = underweight

function fmt(n) {
  return `₹${Math.abs(Number(n)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function DeviationBar({ current, target }) {
  const dev = current - target;
  const maxDev = 30;
  const clampedLeft  = Math.max(0, Math.min(100, 50 - (Math.max(0, -dev) / maxDev) * 50));
  const width = Math.min(50, (Math.abs(dev) / maxDev) * 50);
  const isOver = dev > 0;

  return (
    <div className="rb-devbar">
      <div className="rb-devbar-track">
        <div className="rb-devbar-center" />
        <div
          className={`rb-devbar-fill ${isOver ? 'over' : 'under'}`}
          style={{
            left:  `${isOver ? 50 : clampedLeft}%`,
            width: `${width}%`,
          }}
        />
      </div>
      <div className={`rb-dev-label ${isOver ? 'over' : 'under'}`}>
        {dev > 0 ? '+' : ''}{dev.toFixed(1)}%
      </div>
    </div>
  );
}

export default function RebalanceSuggestions({ holdings, prices, totalValue }) {
  const [strategy, setStrategy]     = useState('equal');
  const [customTargets, setCustomTargets] = useState({});
  const [minTradeSize, setMinTradeSize] = useState(500);

  // Build enriched holdings with current weights
  const enriched = useMemo(() => {
    return holdings.map(h => {
      const q         = prices?.[h.stock_symbol] || {};
      const curPrice  = Number(q.price) || Number(h.average_buy_price);
      const qty       = Number(h.quantity);
      const avgBuy    = Number(h.average_buy_price);
      const invested  = avgBuy * qty;
      const curVal    = curPrice * qty;
      const plPct     = invested > 0 ? ((curVal - invested) / invested) * 100 : 0;
      const symbol    = h.stock_symbol.replace('.NS', '').replace('.BO', '');
      const weight    = totalValue > 0 ? (curVal / totalValue) * 100 : 0;
      return { ...h, symbol, curPrice, qty, invested, curVal, plPct, weight };
    }).sort((a, b) => b.curVal - a.curVal);
  }, [holdings, prices, totalValue]);

  // Compute target weights based on strategy
  const targetWeights = useMemo(() => {
    if (!enriched.length) return {};
    const n = enriched.length;

    if (strategy === 'equal') {
      const t = 100 / n;
      return Object.fromEntries(enriched.map(h => [h.stock_symbol, t]));
    }

    if (strategy === 'top3heavy') {
      const top3Share = Math.min(60, n <= 3 ? 100 : 60);
      const restShare = 100 - top3Share;
      const top3      = enriched.slice(0, 3);
      const rest      = enriched.slice(3);
      const perTop3   = top3.length > 0 ? top3Share / top3.length : 0;
      const perRest   = rest.length  > 0 ? restShare  / rest.length  : 0;
      const map = {};
      top3.forEach(h => { map[h.stock_symbol] = perTop3; });
      rest.forEach(h => { map[h.stock_symbol] = perRest; });
      return map;
    }

    // custom
    const sum = enriched.reduce((s, h) => s + (Number(customTargets[h.stock_symbol]) || 0), 0);
    return Object.fromEntries(enriched.map(h => {
      const t = Number(customTargets[h.stock_symbol]) || (100 / n);
      return [h.stock_symbol, sum > 0 ? (t / sum) * 100 : 100 / n];
    }));
  }, [enriched, strategy, customTargets]);

  // Generate rebalancing actions
  const suggestions = useMemo(() => {
    return enriched.map(h => {
      const target    = targetWeights[h.stock_symbol] ?? 0;
      const deviation = h.weight - target;
      const targetVal = (target / 100) * totalValue;
      const diff      = targetVal - h.curVal;  // positive = need to buy, negative = need to sell

      let action = 'HOLD';
      if (Math.abs(diff) < minTradeSize) action = 'HOLD';
      else if (diff > 0) action = 'BUY';
      else               action = 'SELL';

      const sharesNeeded = h.curPrice > 0 ? Math.abs(diff) / h.curPrice : 0;

      return { ...h, target, deviation, targetVal, diff, action, sharesNeeded };
    }).sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
  }, [enriched, targetWeights, totalValue, minTradeSize]);

  const totalToSell = suggestions.filter(s => s.action === 'SELL').reduce((sum, s) => sum + Math.abs(s.diff), 0);
  const totalToBuy  = suggestions.filter(s => s.action === 'BUY').reduce((sum, s) => sum + s.diff, 0);
  const overweighted = suggestions.filter(s => s.deviation > 5);
  const underweighted = suggestions.filter(s => s.deviation < -5);

  if (!holdings?.length) {
    return (
      <div className="rb-empty">
        <div style={{ fontSize: 40 }}>⚖️</div>
        <div>Add holdings to your portfolio to see rebalancing suggestions.</div>
      </div>
    );
  }

  return (
    <div className="rb-wrap">
      {/* Summary strip */}
      <div className="rb-summary-strip">
        <div className="rb-sum-item">
          <span className="rb-sum-label">Overweight stocks</span>
          <span className="rb-sum-val warn">{overweighted.length}</span>
        </div>
        <div className="rb-sum-item">
          <span className="rb-sum-label">Underweight stocks</span>
          <span className="rb-sum-val info">{underweighted.length}</span>
        </div>
        <div className="rb-sum-item">
          <span className="rb-sum-label">Total to sell</span>
          <span className="rb-sum-val sell">{fmt(totalToSell)}</span>
        </div>
        <div className="rb-sum-item">
          <span className="rb-sum-label">Total to buy</span>
          <span className="rb-sum-val buy">{fmt(totalToBuy)}</span>
        </div>
      </div>

      {/* Strategy selector */}
      <div className="rb-strategy-row">
        <div className="rb-strategy-label">Rebalancing Strategy:</div>
        <div className="rb-strategy-tabs">
          {Object.entries(PRESET_STRATEGIES).map(([key, val]) => (
            <button
              key={key}
              className={`rb-strat-btn ${strategy === key ? 'active' : ''}`}
              onClick={() => setStrategy(key)}
              title={val.desc}
            >
              {val.label}
            </button>
          ))}
        </div>
        <div className="rb-min-trade">
          <label className="rb-min-label">Ignore trades &lt;</label>
          <input
            type="number"
            className="rb-min-input"
            value={minTradeSize}
            onChange={e => setMinTradeSize(Number(e.target.value) || 0)}
            min="0"
          />
        </div>
      </div>

      {/* Strategy description */}
      <div className="rb-strat-desc">
        {PRESET_STRATEGIES[strategy].desc}
        {strategy === 'custom' && (
          <span style={{ color: '#666', marginLeft: 6 }}>— edit target % in each row below</span>
        )}
      </div>

      {/* Table header */}
      <div className="rb-table-header">
        <div className="rb-col flex-2">Stock</div>
        <div className="rb-col right">Current</div>
        <div className="rb-col right">Target</div>
        <div className="rb-col center">Deviation</div>
        <div className="rb-col right">Action</div>
      </div>

      {/* Rows */}
      {suggestions.map(s => {
        const actionColor = s.action === 'BUY' ? '#00C853' : s.action === 'SELL' ? '#FF5252' : '#666';
        const actionBg    = s.action === 'BUY' ? 'rgba(0,200,83,0.1)' : s.action === 'SELL' ? 'rgba(255,82,82,0.1)' : 'transparent';
        return (
          <div key={s.stock_symbol} className={`rb-row ${s.action !== 'HOLD' ? 'highlighted' : ''}`}>
            {/* Stock info */}
            <div className="rb-col flex-2">
              <div className="rb-sym">{s.symbol}</div>
              <div className="rb-sub">
                {s.qty} shares · ₹{s.curPrice.toFixed(2)} · {fmt(s.curVal)} current
              </div>
              <div className={`rb-plbadge ${s.plPct >= 0 ? 'up' : 'down'}`}>
                {s.plPct >= 0 ? '+' : ''}{s.plPct.toFixed(2)}% overall P&L
              </div>
            </div>

            {/* Current % */}
            <div className="rb-col right">
              <div className={`rb-weight ${s.weight > OVERWEIGHT_THRESHOLD ? 'over' : s.weight < UNDERWEIGHT_THRESHOLD ? 'under' : ''}`}>
                {s.weight.toFixed(1)}%
              </div>
              <div className="rb-sub">{fmt(s.curVal)}</div>
            </div>

            {/* Target % (editable in custom mode) */}
            <div className="rb-col right">
              {strategy === 'custom' ? (
                <input
                  className="rb-target-input"
                  type="number"
                  value={customTargets[s.stock_symbol] ?? s.target.toFixed(1)}
                  onChange={e => setCustomTargets(prev => ({ ...prev, [s.stock_symbol]: e.target.value }))}
                  min="0" max="100"
                />
              ) : (
                <div className="rb-weight">{s.target.toFixed(1)}%</div>
              )}
              <div className="rb-sub">{fmt(s.targetVal)}</div>
            </div>

            {/* Deviation bar */}
            <div className="rb-col center">
              <DeviationBar current={s.weight} target={s.target} />
            </div>

            {/* Action */}
            <div className="rb-col right">
              <div className="rb-action-badge" style={{ background: actionBg, color: actionColor, borderColor: `${actionColor}44` }}>
                {s.action === 'BUY'  && '📈 '}
                {s.action === 'SELL' && '📉 '}
                {s.action === 'HOLD' && '✋ '}
                {s.action}
              </div>
              {s.action !== 'HOLD' && (
                <div className="rb-action-detail">
                  {s.action === 'SELL' ? 'Sell' : 'Buy'} ~{s.sharesNeeded.toFixed(1)} shares
                  <br />({s.action === 'SELL' ? '-' : '+'}{fmt(Math.abs(s.diff))})
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Rebalancing plan */}
      {(totalToSell > 0 || totalToBuy > 0) && (
        <div className="rb-plan">
          <div className="rb-plan-title">📋 Rebalancing Plan</div>
          <div className="rb-plan-steps">
            {suggestions.filter(s => s.action === 'SELL').map(s => (
              <div key={s.stock_symbol} className="rb-plan-step sell">
                <span className="rb-step-sym">SELL {s.symbol}</span>
                <span className="rb-step-detail">~{s.sharesNeeded.toFixed(1)} shares → raises {fmt(Math.abs(s.diff))}</span>
              </div>
            ))}
            {suggestions.filter(s => s.action === 'BUY').map(s => (
              <div key={s.stock_symbol} className="rb-plan-step buy">
                <span className="rb-step-sym">BUY {s.symbol}</span>
                <span className="rb-step-detail">~{s.sharesNeeded.toFixed(1)} shares → deploys {fmt(s.diff)}</span>
              </div>
            ))}
          </div>
          <div className="rb-plan-note">
            ⚠️ This is a suggestion based on your selected strategy. Rebalancing involves brokerage charges and tax implications. Review carefully before executing.
          </div>
        </div>
      )}
    </div>
  );
}
