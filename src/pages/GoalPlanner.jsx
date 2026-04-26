import { useState, useEffect, useMemo } from 'react';
import './GoalPlanner.css';

// ── Preset goals ───────────────────────────────────────────────────────────
const GOAL_PRESETS = [
  { id: 'laptop',    label: '💻 Laptop',         defaultAmount: 80000,   defaultMonths: 12 },
  { id: 'phone',     label: '📱 Smartphone',      defaultAmount: 50000,   defaultMonths: 6  },
  { id: 'car',       label: '🚗 Car',             defaultAmount: 800000,  defaultMonths: 48 },
  { id: 'house',     label: '🏠 House Down Pay',  defaultAmount: 2000000, defaultMonths: 60 },
  { id: 'education', label: '🎓 Education',       defaultAmount: 500000,  defaultMonths: 36 },
  { id: 'vacation',  label: '✈️ Vacation',        defaultAmount: 150000,  defaultMonths: 18 },
  { id: 'emergency', label: '🛡️ Emergency Fund',  defaultAmount: 300000,  defaultMonths: 24 },
  { id: 'custom',    label: '✏️ Custom Goal',     defaultAmount: 100000,  defaultMonths: 12 },
];

// Risk profiles mapped to expected annual return % (realistic for India)
const RISK_PROFILES = {
  conservative: { label: 'Conservative',  return: 7,  equity: 20, debt: 60, gold: 20, color: '#64DD17' },
  moderate:     { label: 'Moderate',      return: 11, equity: 50, debt: 40, gold: 10, color: '#FFD740' },
  aggressive:   { label: 'Aggressive',    return: 15, equity: 80, debt: 15, gold: 5,  color: '#FF6D00' },
};

// SIP formula: FV = P * [((1+r)^n - 1) / r] * (1+r)
// → P = FV * r / [((1+r)^n - 1) * (1+r)]
function calcSIP(target, currentSavings, months, annualReturn) {
  const remaining = Math.max(0, target - currentSavings);
  if (remaining <= 0) return 0;
  const r = annualReturn / 100 / 12; // monthly rate
  if (r === 0) return remaining / months;
  const n = months;
  const sip = (remaining * r) / (Math.pow(1 + r, n + 1) - (1 + r));
  return Math.max(0, sip);
}

// Project month-by-month corpus growth
function projectCorpus(sip, currentSavings, months, annualReturn) {
  const r = annualReturn / 100 / 12;
  const points = [];
  let corpus = currentSavings;
  for (let m = 0; m <= months; m++) {
    points.push({ month: m, corpus });
    corpus = corpus * (1 + r) + sip;
  }
  return points;
}

const LS_KEY = 'spms_goals_v1';

function loadGoals() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch { return []; }
}

function saveGoals(goals) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(goals)); } catch {}
}

function MiniProgress({ progress }) {
  const pct = Math.min(100, Math.max(0, progress));
  return (
    <div className="gp-progress-bar">
      <div
        className="gp-progress-fill"
        style={{ width: `${pct}%`, background: pct >= 100 ? '#00C853' : '#00D09C' }}
      />
    </div>
  );
}

// Mini sparkline for projection chart
function ProjectionChart({ points, target, color = '#00D09C' }) {
  if (!points?.length) return null;
  const values = points.map(p => p.corpus);
  const max    = Math.max(target, ...values);
  const W = 500, H = 90;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - (v / max) * (H - 4);
    return `${x},${y}`;
  }).join(' ');
  const targetY = H - (target / max) * (H - 4);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" className="gp-chart-svg">
      <defs>
        <linearGradient id="gpgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      {/* Target line */}
      <line x1="0" y1={targetY} x2={W} y2={targetY}
        stroke="#ffffff22" strokeWidth="1.5" strokeDasharray="6 4" />
      {/* Corpus area */}
      <polygon fill="url(#gpgrad)"
        points={`0,${H} ${pts} ${W},${H}`} />
      <polyline fill="none" stroke={color} strokeWidth="2.2" points={pts} />
    </svg>
  );
}

export default function GoalPlanner() {
  const [goals, setGoals]         = useState(loadGoals);
  const [tab, setTab]             = useState('create'); // 'create' | 'my-goals'
  const [preset, setPreset]       = useState('laptop');
  const [goalName, setGoalName]   = useState('');
  const [targetAmt, setTargetAmt] = useState('80000');
  const [months, setMonths]       = useState('12');
  const [currentSav, setCurrentSav] = useState('0');
  const [riskProfile, setRiskProfile] = useState('moderate');

  // When preset changes, fill defaults
  useEffect(() => {
    const p = GOAL_PRESETS.find(g => g.id === preset);
    if (p) {
      setGoalName(p.id === 'custom' ? '' : p.label.replace(/^[^ ]+ /, ''));
      setTargetAmt(String(p.defaultAmount));
      setMonths(String(p.defaultMonths));
    }
  }, [preset]);

  // Auto-select risk profile based on months
  useEffect(() => {
    const m = Number(months) || 12;
    if (m <= 12)      setRiskProfile('conservative');
    else if (m <= 36) setRiskProfile('moderate');
    else              setRiskProfile('aggressive');
  }, [months]);

  const profile = RISK_PROFILES[riskProfile];
  const target  = Number(targetAmt) || 0;
  const mths    = Number(months) || 1;
  const savings = Number(currentSav) || 0;

  const sipAmount = useMemo(() =>
    calcSIP(target, savings, mths, profile.return),
    [target, savings, mths, profile.return]
  );

  const projPoints = useMemo(() =>
    projectCorpus(sipAmount, savings, mths, profile.return),
    [sipAmount, savings, mths, profile.return]
  );

  const totalInvested = sipAmount * mths + savings;
  const wealthGain    = target - totalInvested;

  const handleSaveGoal = () => {
    if (!goalName.trim() || !target || !mths) return;
    const newGoal = {
      id:           Date.now().toString(),
      name:         goalName.trim(),
      preset,
      target,
      months:       mths,
      currentSav:   savings,
      riskProfile,
      sipAmount,
      startDate:    new Date().toISOString(),
      paidMonths:   0,
      totalPaid:    savings,
    };
    const updated = [...goals, newGoal];
    setGoals(updated);
    saveGoals(updated);
    setTab('my-goals');
  };

  const handleMarkSIP = (id) => {
    const updated = goals.map(g => {
      if (g.id !== id) return g;
      const paid = g.paidMonths + 1;
      const totalPaid = g.totalPaid + g.sipAmount;
      return { ...g, paidMonths: paid, totalPaid };
    });
    setGoals(updated);
    saveGoals(updated);
  };

  const handleDeleteGoal = (id) => {
    const updated = goals.filter(g => g.id !== id);
    setGoals(updated);
    saveGoals(updated);
  };

  const fmt = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  return (
    <div className="gp-page">
      <div className="gp-hero">
        <div className="gp-hero-icon">🎯</div>
        <h1 className="gp-title">Goal-Based Planner</h1>
        <p className="gp-subtitle">Set financial goals and get a personalised SIP plan to achieve them</p>
      </div>

      <div className="gp-tabs">
        <button id="gp-tab-create"   className={`gp-tab ${tab === 'create'   ? 'active' : ''}`} onClick={() => setTab('create')}>
          ＋ Create Goal
        </button>
        <button id="gp-tab-mygoals" className={`gp-tab ${tab === 'my-goals' ? 'active' : ''}`} onClick={() => setTab('my-goals')}>
          📋 My Goals {goals.length > 0 && <span className="gp-badge">{goals.length}</span>}
        </button>
      </div>

      {/* ══ CREATE TAB ══════════════════════════════════════════════════════ */}
      {tab === 'create' && (
        <div className="gp-create-layout">
          {/* Left: Inputs */}
          <div className="gp-input-panel">
            <div className="gp-section-label">Choose a Goal</div>
            <div className="gp-presets">
              {GOAL_PRESETS.map(p => (
                <button
                  key={p.id}
                  id={`gp-preset-${p.id}`}
                  className={`gp-preset-btn ${preset === p.id ? 'active' : ''}`}
                  onClick={() => setPreset(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="gp-fields">
              <div className="gp-field">
                <label className="gp-label">Goal Name</label>
                <input
                  id="gp-goal-name"
                  className="gp-input"
                  value={goalName}
                  onChange={e => setGoalName(e.target.value)}
                  placeholder="e.g. Buy a laptop"
                />
              </div>

              <div className="gp-field">
                <label className="gp-label">Target Amount (₹)</label>
                <input
                  id="gp-target-amount"
                  type="number"
                  className="gp-input"
                  value={targetAmt}
                  onChange={e => setTargetAmt(e.target.value)}
                  min="1000"
                />
              </div>

              <div className="gp-field">
                <label className="gp-label">Time to Achieve (months)</label>
                <input
                  id="gp-months"
                  type="number"
                  className="gp-input"
                  value={months}
                  onChange={e => setMonths(e.target.value)}
                  min="1"
                  max="360"
                />
              </div>

              <div className="gp-field">
                <label className="gp-label">Current Savings Towards This Goal (₹)</label>
                <input
                  id="gp-current-savings"
                  type="number"
                  className="gp-input"
                  value={currentSav}
                  onChange={e => setCurrentSav(e.target.value)}
                  min="0"
                />
              </div>
            </div>

            {/* Risk profile */}
            <div className="gp-section-label" style={{ marginTop: 20 }}>Risk Profile (auto-suggested)</div>
            <div className="gp-risk-tabs">
              {Object.entries(RISK_PROFILES).map(([key, rp]) => (
                <button
                  key={key}
                  id={`gp-risk-${key}`}
                  className={`gp-risk-btn ${riskProfile === key ? 'active' : ''}`}
                  style={riskProfile === key ? { borderColor: rp.color, color: rp.color } : {}}
                  onClick={() => setRiskProfile(key)}
                >
                  {rp.label}
                  <span className="gp-risk-ret">~{rp.return}% p.a.</span>
                </button>
              ))}
            </div>

            <button id="gp-save-goal-btn" className="gp-save-btn" onClick={handleSaveGoal}
              disabled={!goalName.trim() || !target || !mths}>
              💾 Save Goal
            </button>
          </div>

          {/* Right: Live Plan */}
          <div className="gp-plan-panel">
            <div className="gp-plan-card">
              <div className="gp-plan-title">Your SIP Plan</div>

              {/* SIP amount — hero */}
              <div className="gp-sip-hero">
                <div className="gp-sip-label">Monthly SIP Required</div>
                <div className="gp-sip-amount">₹{fmt(sipAmount)}</div>
                <div className="gp-sip-sub">for {mths} months at {profile.return}% p.a. ({profile.label})</div>
              </div>

              {/* Key metrics */}
              <div className="gp-plan-metrics">
                <div className="gp-pm-item">
                  <span className="gp-pm-label">Target</span>
                  <span className="gp-pm-val">₹{fmt(target)}</span>
                </div>
                <div className="gp-pm-item">
                  <span className="gp-pm-label">Total Invested</span>
                  <span className="gp-pm-val">₹{fmt(totalInvested)}</span>
                </div>
                <div className="gp-pm-item">
                  <span className="gp-pm-label">Wealth Gain</span>
                  <span className="gp-pm-val" style={{ color: wealthGain >= 0 ? '#00C853' : '#FF5252' }}>
                    {wealthGain >= 0 ? '+' : ''}₹{fmt(wealthGain)}
                  </span>
                </div>
              </div>

              {/* Projection chart */}
              <div className="gp-chart-wrap">
                <div className="gp-chart-label">Corpus Projection</div>
                <ProjectionChart points={projPoints} target={target} color={profile.color} />
                <div className="gp-chart-axis">
                  <span>Now</span>
                  <span>Month {Math.round(mths / 2)}</span>
                  <span>{mths >= 12 ? `${Math.round(mths / 12)}yr${mths >= 24 ? 's' : ''}` : `${mths}mo`}</span>
                </div>
              </div>

              {/* Allocation */}
              <div className="gp-alloc-section">
                <div className="gp-chart-label">Suggested Allocation</div>
                <div className="gp-alloc-bar">
                  <div className="gp-alloc-seg equity"  style={{ flex: profile.equity  }} title={`Equity ${profile.equity}%`} />
                  <div className="gp-alloc-seg debt"    style={{ flex: profile.debt    }} title={`Debt ${profile.debt}%`} />
                  <div className="gp-alloc-seg gold"    style={{ flex: profile.gold    }} title={`Gold ${profile.gold}%`} />
                </div>
                <div className="gp-alloc-legend">
                  <span><span className="gp-dot equity" />Equity {profile.equity}%</span>
                  <span><span className="gp-dot debt"   />Debt {profile.debt}%</span>
                  <span><span className="gp-dot gold"   />Gold {profile.gold}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MY GOALS TAB ════════════════════════════════════════════════════ */}
      {tab === 'my-goals' && (
        <div className="gp-goals-list">
          {goals.length === 0 ? (
            <div className="gp-empty">
              <div style={{ fontSize: 48 }}>🎯</div>
              <div>No goals yet. Create your first goal!</div>
              <button className="gp-save-btn" style={{ marginTop: 20, display: 'inline-flex' }}
                onClick={() => setTab('create')}>
                ＋ Create a Goal
              </button>
            </div>
          ) : (
            goals.map(g => {
              const progress = Math.min(100, (g.totalPaid / g.target) * 100);
              const remaining = g.months - g.paidMonths;
              const rp = RISK_PROFILES[g.riskProfile] || RISK_PROFILES.moderate;
              return (
                <div key={g.id} className="gp-goal-card">
                  <div className="gp-goal-header">
                    <div>
                      <div className="gp-goal-name">{g.name}</div>
                      <div className="gp-goal-meta">
                        {g.paidMonths}/{g.months} months · {rp.label} · ₹{fmt(g.sipAmount)}/mo SIP
                      </div>
                    </div>
                    <button
                      className="gp-delete-btn"
                      onClick={() => handleDeleteGoal(g.id)}
                      title="Delete goal"
                    >✕</button>
                  </div>

                  <div className="gp-goal-amounts">
                    <span>₹{fmt(g.totalPaid)} saved</span>
                    <span style={{ color: '#555' }}>of ₹{fmt(g.target)}</span>
                  </div>

                  <MiniProgress progress={progress} />

                  <div className="gp-goal-footer">
                    <span className="gp-goal-pct">{progress.toFixed(1)}% complete</span>
                    <span className="gp-goal-left">{remaining > 0 ? `${remaining} months left` : '🎉 Goal reached!'}</span>
                  </div>

                  {remaining > 0 && (
                    <button
                      id={`gp-mark-sip-${g.id}`}
                      className="gp-mark-btn"
                      onClick={() => handleMarkSIP(g.id)}
                    >
                      ✅ Mark This Month's SIP Paid
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
