import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchSymbols } from '../services/yahooStockApi';
import { useStockPolling } from '../hooks/useStockPolling';
import { useAuth } from '../hooks/useAuth.jsx';
import { recordTransaction } from '../services/portfolioService';
import SymbolLogo from '../components/ui/SymbolLogo';
import './MutualFunds.css';
import './Dashboard.css';

// ── Constants ──────────────────────────────────────────────────────────────
const INDEX_SYMBOLS = ['^NSEI', '^BSESN', '^NSEBANK'];
const MF_API = 'https://api.mfapi.in/mf';

const FILTER_OPTIONS = ['Index Fund', 'Flexi Cap', 'Sectoral', '4+ Star', 'Large Cap', 'Mid Cap', 'Small Cap', 'ELSS'];

// 4+ Star curated scheme codes (well-known highly rated funds on Groww/ValueResearch)
const FOUR_STAR_CODES = new Set([
  '119551','120465','118989','125497','119844','122639','120578','149544',
  '120716','135781','147946','120597','118778','119598','119313','136118',
  '120505','151144','118569','120503','129900','127042',
]);

// Popular fund name patterns to search in the list
const POPULAR_PATTERNS = [
  'Parag Parikh Flexi Cap Fund - Direct Plan',
  'Mirae Asset Large Cap Fund - Direct Plan',
  'SBI Small Cap Fund - Direct Plan',
  'HDFC Mid-Cap Opportunities Fund - Direct Plan',
  'Axis Bluechip Fund - Direct Plan',
  'Nippon India Small Cap Fund - Direct Plan',
];

// ── Collections ────────────────────────────────────────────────────────────
const COLLECTIONS = [
  {
    filterId: 'Large Cap', label: 'High Return', color: '#00D09C',
    bg: 'rgba(0,208,156,0.1)', border: 'rgba(0,208,156,0.25)',
    icon: <svg width="28" height="28" fill="none" stroke="#00D09C" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  },
  {
    filterId: 'Flexi Cap', label: 'Best SIP Funds', color: '#6c63ff',
    bg: 'rgba(108,99,255,0.1)', border: 'rgba(108,99,255,0.25)',
    icon: <svg width="28" height="28" fill="none" stroke="#6c63ff" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>,
  },
  {
    filterId: 'Index Fund', label: 'Gold & Silver', color: '#f5a623',
    bg: 'rgba(245,166,35,0.1)', border: 'rgba(245,166,35,0.25)',
    icon: <svg width="28" height="28" fill="none" stroke="#f5a623" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/></svg>,
  },
  {
    filterId: '4+ Star', label: '5 Star Funds', color: '#FFD700',
    bg: 'rgba(255,215,0,0.1)', border: 'rgba(255,215,0,0.25)',
    icon: <svg width="28" height="28" fill="none" stroke="#FFD700" strokeWidth="1.8" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  },
  {
    filterId: 'Mid Cap', label: 'Midcap', color: '#00b4d8',
    bg: 'rgba(0,180,216,0.1)', border: 'rgba(0,180,216,0.25)',
    icon: <svg width="28" height="28" fill="none" stroke="#00b4d8" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="2" y="3" width="4" height="18" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="18" y="5" width="4" height="16" rx="1"/></svg>,
  },
  {
    filterId: 'Small Cap', label: 'Smallcap', color: '#ff6b6b',
    bg: 'rgba(255,107,107,0.1)', border: 'rgba(255,107,107,0.25)',
    icon: <svg width="28" height="28" fill="none" stroke="#ff6b6b" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="8" cy="8" r="4"/><circle cx="16" cy="16" r="3"/><line x1="11.5" y1="11.5" x2="13.5" y2="13.5"/></svg>,
  },
];

// ── Tools ──────────────────────────────────────────────────────────────────
const TOOLS = [
  { id: 'import', label: 'Import Funds', color: '#00D09C', icon: <svg width="26" height="26" fill="none" stroke="#00D09C" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> },
  { id: 'nfo',    label: "NFO's",        color: '#6c63ff', icon: <svg width="26" height="26" fill="none" stroke="#6c63ff" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg> },
  { id: 'calc',   label: 'SIP Calculator', color: '#f5a623', icon: <svg width="26" height="26" fill="none" stroke="#f5a623" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="13" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="13" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="10" y2="18"/><line x1="13" y1="18" x2="16" y2="18"/></svg> },
  { id: 'compare',label: 'Compare Funds', color: '#00b4d8', icon: <svg width="26" height="26" fill="none" stroke="#00b4d8" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="2 10 2 4 8 4"/><polyline points="22 14 22 20 16 20"/><path d="M2 4l10 10"/><path d="M22 20L12 10"/></svg> },
  { id: 'cart',   label: 'Cart',          color: '#ff6b6b', icon: <svg width="26" height="26" fill="none" stroke="#ff6b6b" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function getCategory(name) {
  const n = name.toUpperCase();
  if (n.includes('INDEX') || (n.includes('NIFTY') && (n.includes('INDEX') || n.includes('BEES') || n.includes('ETF')))) return 'Index Fund';
  if (n.includes('FLEXI CAP') || n.includes('FLEXICAP')) return 'Flexi Cap';
  if (n.includes('SECTORAL') || n.includes('THEMATIC') || n.includes('PHARMA') || n.includes('BANKING AND') || n.includes('TECHNOLOGY') || n.includes('INFRA') || n.includes('CONSUMPTION') || n.includes('HEALTHCARE') || n.includes('ENERGY') || n.includes('AUTO')) return 'Sectoral';
  if (n.includes('LARGE CAP') || n.includes('LARGECAP') || n.includes('BLUECHIP') || n.includes('TOP 100') || n.includes('BLUE CHIP')) return 'Large Cap';
  if (n.includes('MID CAP') || n.includes('MIDCAP') || n.includes('EMERGING EQUITY') || n.includes('MID AND SMALL')) return 'Mid Cap';
  if (n.includes('SMALL CAP') || n.includes('SMALLCAP')) return 'Small Cap';
  if (n.includes('ELSS') || n.includes('TAX SAVER') || n.includes('TAX SAVINGS') || n.includes('LONG TERM EQUITY')) return 'ELSS';
  if (n.includes('MULTI CAP') || n.includes('MULTICAP')) return 'Multi Cap';
  if (n.includes('HYBRID') || n.includes('BALANCED') || n.includes('EQUITY SAVINGS') || n.includes('AGGRESSIVE HYBRID') || n.includes('CONSERVATIVE HYBRID')) return 'Hybrid';
  return null;
}

function computeCAGR(navData, years) {
  if (!navData || navData.length < 2) return null;
  const sorted = [...navData].sort((a, b) => new Date(b.date) - new Date(a.date));
  const latestNav = parseFloat(sorted[0]?.nav);
  if (!latestNav || latestNav <= 0) return null;
  const target = new Date();
  target.setFullYear(target.getFullYear() - years);
  const past = sorted.find(n => new Date(n.date) <= target);
  if (!past) return null;
  const pastNav = parseFloat(past.nav);
  if (!pastNav || pastNav <= 0) return null;
  if (years <= 1) return ((latestNav - pastNav) / pastNav) * 100;
  return (Math.pow(latestNav / pastNav, 1 / years) - 1) * 100;
}

async function safeFetch(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('bad response');
    return await r.json();
  } catch { return null; }
}

function shortName(schemeName) {
  return schemeName
    .replace(' - Direct Plan - Growth', '')
    .replace(' - Direct Plan-Growth', '')
    .replace(' - Direct - Growth', '')
    .replace('(Direct Growth)', '')
    .replace('Direct Plan Growth', '')
    .replace('Direct Growth', '')
    .trim();
}

function initials(name) {
  return name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
}

// ── Sub-components ─────────────────────────────────────────────────────────
function ReturnBadge({ value }) {
  if (value === null || value === undefined) return <span className="mf-ret-dash">—</span>;
  const pos = value >= 0;
  return (
    <span className={`mf-ret-val ${pos ? 'up' : 'down'}`}>
      {pos ? '+' : '−'}{Math.abs(value).toFixed(1)}%
    </span>
  );
}

function FundCard({ fund, details }) {
  const d = details;
  const ini = initials(fund.schemeName);
  const name = shortName(fund.schemeName);
  return (
    <button className="gd-stock-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', textAlign: 'left', minWidth: '160px' }}>
      <div className="gd-stock-icon" style={{ background: 'linear-gradient(135deg, #1e3a5f, #0d4f3c)', color: '#7dd3c8', border: 'none' }}>
        {ini}
      </div>
      <div className="gd-stock-name">{name}</div>
      <div className="gd-stock-price-row">
        <span className="gd-card-price">{d && d.nav > 0 ? `₹${d.nav.toFixed(2)}` : (d ? '—' : <span className="sk-line w-20" style={{display: 'inline-block'}} />)}</span>
      </div>
      <div className="gd-stock-change-row">
        {d ? (
           d.ret3Y !== null && d.ret3Y !== undefined ? (
             <span className={`gd-card-change ${d.ret3Y >= 0 ? 'up' : 'down'}`}>
               {d.ret3Y >= 0 ? '+' : '−'}{Math.abs(d.ret3Y).toFixed(1)}% 3Y
             </span>
           ) : <span className="mf-ret-dash" style={{fontSize: 12}}>—</span>
        ) : <span className="sk-line w-30" style={{marginTop: 4}} />}
      </div>
    </button>
  );
}

function FundCardSkeleton() {
  return (
    <div className="gd-stock-card" style={{ minWidth: '160px', padding: '16px', display: 'flex', flexDirection: 'column', textAlign: 'left', cursor: 'default' }}>
      <div className="gd-stock-icon sk-box"></div>
      <span className="sk-line w-60" style={{marginTop: 8}}></span>
      <span className="sk-line w-30" style={{marginTop: 8}}></span>
      <span className="sk-line w-20" style={{marginTop: 12}}></span>
    </div>
  );
}

function AllFundRow({ fund, details, onStartSip }) {
  const d = details;
  const ini = initials(fund.schemeName);
  const name = shortName(fund.schemeName);
  return (
    <div className="mf-all-fund-row">
      <div className="mf-all-fund-left">
        <div className="mf-fund-avatar sm">{ini}</div>
        <div className="mf-fund-meta">
          <span className="mf-all-fund-name">{name}</span>
          <span className="mf-cat-pill">{fund.category}</span>
        </div>
      </div>
      <div className="mf-all-returns">
        <div className="mf-ret-col">
          <span className="mf-ret-hdr">1Y</span>
          {d ? <ReturnBadge value={d.ret1Y} /> : <span className="mf-ret-dash">—</span>}
        </div>
        <div className="mf-ret-col">
          <span className="mf-ret-hdr">3Y</span>
          {d ? <ReturnBadge value={d.ret3Y} /> : <span className="mf-ret-dash">—</span>}
        </div>
        <div className="mf-ret-col">
          <span className="mf-ret-hdr">5Y</span>
          {d ? <ReturnBadge value={d.ret5Y} /> : <span className="mf-ret-dash">—</span>}
        </div>
      </div>
      <button className="mf-sip-btn" onClick={() => onStartSip(fund)}>Start SIP</button>
    </div>
  );
}

function FundSkeleton() {
  return (
    <div className="mf-all-fund-row mf-skeleton">
      <div className="mf-all-fund-left">
        <div className="mf-fund-avatar sm sk-box" />
        <div className="mf-fund-meta">
          <span className="sk-line w-60" />
          <span className="sk-line w-30" />
        </div>
      </div>
      <div className="mf-all-returns">
        {[1,2,3].map(i => <div key={i} className="mf-ret-col"><span className="sk-line w-20" /><span className="sk-line w-20" /></div>)}
      </div>
      <div className="mf-sip-btn sk-box" style={{ width: 72, height: 30, borderRadius: 6 }} />
    </div>
  );
}

// ── Module-level cache ─────────────────────────────────────────────────────
const fundDetailCache = {};

// ── Main Component ─────────────────────────────────────────────────────────
export default function MutualFunds({ appPrices = {} }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Top bar
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Tabs — same as Stocks page
  const [activeTab, setActiveTab] = useState('Explore');

  // Funds state
  const [allFunds, setAllFunds]       = useState([]);   // all Direct-Growth equity funds
  const [fundsLoading, setFundsLoading] = useState(true);
  const [popularFunds, setPopularFunds] = useState([]);  // 5 curated popular funds
  const [recentFunds, setRecentFunds]   = useState([]);  // 3 funds used in Recently Viewed

  // Filters
  const [activeFilters, setActiveFilters] = useState([]);
  const [visibleCount, setVisibleCount]   = useState(20);

  // SIP State
  const [userSips, setUserSips] = useState([]);
  const [sipModal, setSipModal] = useState({ isOpen: false, fund: null });
  const [sipAmount, setSipAmount] = useState('');
  const [sipDate, setSipDate] = useState('5');

  // Load SIPs
  useEffect(() => {
    if (user?.id) {
      try {
        const stored = localStorage.getItem(`spms_user_sips_${user.id}`);
        if (stored) setUserSips(JSON.parse(stored));
      } catch(e) {}
    }
  }, [user]);

  const handleStartSipClick = useCallback((fund) => {
    setSipModal({ isOpen: true, fund });
    setSipAmount('1000');
    setSipDate('5');
  }, []);

  const handleConfirmSip = async () => {
    if (!user?.id || !sipModal.fund || !sipAmount) return;
    const amountNum = Number(sipAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    try {
      const d = new Date();
      const newSip = {
        id: Date.now().toString(),
        schemeCode: sipModal.fund.schemeCode,
        schemeName: sipModal.fund.schemeName,
        category: sipModal.fund.category,
        amount: amountNum,
        deductionDate: sipDate,
        status: 'Active',
        nextPaymentDate: `${sipDate} ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`
      };

      const updatedSips = [...userSips, newSip];
      setUserSips(updatedSips);
      localStorage.setItem(`spms_user_sips_${user.id}`, JSON.stringify(updatedSips));

      // Charge first installment
      const nav = fundDetails[sipModal.fund.schemeCode]?.nav || 10;
      const qty = amountNum / nav;

      await recordTransaction({
        userId: user.id,
        symbol: sipModal.fund.schemeName + '_MF',
        type: 'BUY',
        quantity: qty,
        price: nav,
        companyName: sipModal.fund.schemeName
      });

      setSipModal({ isOpen: false, fund: null });
      setActiveTab('SIPs');
    } catch (err) {
      alert("Failed to start SIP: " + err.message);
    }
  };

  // Details (nav + returns) per schemeCode
  const [fundDetails, setFundDetails] = useState({});
  const fetchingRef = useRef(new Set()); // track in-flight requests

  // Index prices
  const { prices: idxPrices } = useStockPolling(INDEX_SYMBOLS, 10_000);
  const prices = { ...idxPrices, ...appPrices };
  const domesticIndices = [
    { label: 'NIFTY 50',   symbol: '^NSEI',    data: prices['^NSEI'] },
    { label: 'SENSEX',     symbol: '^BSESN',   data: prices['^BSESN'] },
    { label: 'BANK NIFTY', symbol: '^NSEBANK', data: prices['^NSEBANK'] },
  ];

  // Debounced top-bar search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      setIsSearching(true);
      searchSymbols(searchQuery)
        .then(r => setSearchResults(r || []))
        .catch(() => setSearchResults([]))
        .finally(() => setIsSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Load all funds from mfapi.in ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setFundsLoading(true);
      try {
        const list = await safeFetch(MF_API);
        if (!list || cancelled) return;

        const filtered = list
          .filter(f => {
            const n = f.schemeName.toUpperCase();
            return (
              (n.includes('DIRECT') || n.includes('DIR.')) &&
              n.includes('GROWTH') &&
              !n.includes('DIVIDEND') && !n.includes('IDCW') &&
              !n.includes('BONUS') && !n.includes('REINVEST') &&
              !n.includes('LIQUID') && !n.includes('OVERNIGHT') &&
              !n.includes('ULTRA SHORT') && !n.includes('MONEY MARKET') &&
              !n.includes('ARBITRAGE') && !n.includes('GILT') &&
              !n.includes('CREDIT RISK') && !n.includes('BANKING AND PSU')
            );
          })
          .map(f => ({ schemeCode: String(f.schemeCode), schemeName: f.schemeName, category: getCategory(f.schemeName) }))
          .filter(f => f.category !== null);

        if (!cancelled) {
          setAllFunds(filtered);

          // Find popular funds
          const pop = POPULAR_PATTERNS
            .map(pat => filtered.find(f => f.schemeName.toUpperCase().includes(pat.toUpperCase())))
            .filter(Boolean)
            .slice(0, 6);
          setPopularFunds(pop);

          // Recently viewed: pick 6 from different categories
          const cats = ['Small Cap', 'Mid Cap', 'Hybrid', 'Large Cap', 'Flexi Cap', 'Index Fund'];
          const rec = cats.map(cat => filtered.find(f => f.category === cat)).filter(Boolean);
          setRecentFunds(rec);
        }
      } finally {
        if (!cancelled) setFundsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Batch-fetch fund details ──────────────────────────────────────────────
  const fetchDetailsBatch = useCallback(async (codes) => {
    const toFetch = codes.filter(c => !fundDetailCache[c] && !fetchingRef.current.has(c));
    if (!toFetch.length) return;
    toFetch.forEach(c => fetchingRef.current.add(c));

    const BATCH = 5;
    for (let i = 0; i < toFetch.length; i += BATCH) {
      const batch = toFetch.slice(i, i + BATCH);
      await Promise.all(batch.map(async code => {
        try {
          const data = await safeFetch(`${MF_API}/${code}`);
          if (data?.data?.length) {
            const hist = data.data;
            const detail = {
              nav:   parseFloat(hist[0]?.nav) || 0,
              ret1Y: computeCAGR(hist, 1),
              ret3Y: computeCAGR(hist, 3),
              ret5Y: computeCAGR(hist, 5),
            };
            fundDetailCache[code] = detail;
            setFundDetails(prev => ({ ...prev, [code]: detail }));
          }
        } catch { /* skip */ }
        fetchingRef.current.delete(code);
      }));
      if (i + BATCH < toFetch.length) await new Promise(r => setTimeout(r, 120));
    }
  }, []);

  // ── Trigger fetch when visible funds / popular change ─────────────────────
  const filteredFunds = allFunds.filter(f => {
    if (!activeFilters.length) return true;
    return activeFilters.some(fil => {
      if (fil === '4+ Star') return FOUR_STAR_CODES.has(f.schemeCode);
      return f.category === fil;
    });
  });
  const visibleFunds = filteredFunds.slice(0, visibleCount);

  const visKey  = visibleFunds.map(f => f.schemeCode).join(',');
  const popKey  = popularFunds.map(f => f.schemeCode).join(',');
  const recKey  = recentFunds.map(f => f.schemeCode).join(',');

  useEffect(() => {
    const codes = [...new Set([
      ...visibleFunds.map(f => f.schemeCode),
      ...popularFunds.map(f => f.schemeCode),
      ...recentFunds.map(f => f.schemeCode),
    ])];
    if (codes.length) fetchDetailsBatch(codes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visKey, popKey, recKey]);

  // ── Filter helpers ────────────────────────────────────────────────────────
  const toggleFilter = (f) => {
    setActiveFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
    setVisibleCount(20);
  };

  const handleOpenChart = (sym) => navigate(`/chart/${encodeURIComponent(sym)}`);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mf-page groww-dashboard">

      {/* ══ TOP BAR ════════════════════════════════════════════════════════ */}
      <header className="gd-topbar">
        <div className="gd-indices-scroll">
          {domesticIndices.map(idx => {
            const price = idx.data?.price;
            const changePct = idx.data?.changePct || 0;
            const change = idx.data?.change || 0;
            const isUp = changePct >= 0;
            return (
              <div key={idx.label} className="gd-index-card" onClick={() => handleOpenChart(idx.symbol)} style={{ cursor: 'pointer' }}>
                <span className="gd-index-name">{idx.label}</span>
                <div className="gd-index-values">
                  <span className="gd-index-price">{price ? price.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}</span>
                  {idx.data && (
                    <span className={`gd-index-change ${isUp ? 'up' : 'down'}`}>
                      {isUp ? '+' : '−'}{Math.abs(change).toFixed(2)} ({isUp ? '+' : '−'}{Math.abs(changePct).toFixed(2)}%)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          <div className="gd-index-card gd-global-trigger" onClick={() => navigate('/global-indices')} style={{ cursor: 'pointer' }}>
            <span className="gd-index-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Global Indices <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
            </span>
            <span className="gd-index-price" style={{ color: '#666', fontSize: 11 }}>11 markets</span>
          </div>
        </div>

        <div className="gd-topbar-actions">
          {/* Stretched search bar */}
          <div className="gd-search-container">
            <svg width="16" height="16" fill="none" stroke="#555" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" className="gd-search-input" placeholder="Search mutual funds…"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            {searchQuery.trim().length > 0 && (
              <button className="gd-icon-btn" style={{ padding: 0 }} onClick={() => { setSearchQuery(''); setSearchResults([]); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
            {searchQuery.trim().length > 0 && (
              <div className="gd-search-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '12px', marginTop: '6px', zIndex: 1000, maxHeight: '460px', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}>
                {isSearching ? (
                  <div style={{ padding: '20px', color: '#666', fontSize: 13, textAlign: 'center' }}>Searching…</div>
                ) : searchResults.length > 0 ? (
                  searchResults.map(res => (
                    <div key={res.symbol} style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', borderBottom: '1px solid #232323', transition: 'background 0.15s' }}
                      onClick={() => { setSearchQuery(''); setSearchResults([]); handleOpenChart(res.symbol); }}
                      onMouseEnter={e => e.currentTarget.style.background = '#242424'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        <SymbolLogo symbol={res.symbol} size={44} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{res.shortname || res.longname || res.symbol}</span>
                        <span style={{ fontSize: 12, color: '#666' }}>{res.symbol} &nbsp;·&nbsp; {res.exchDisp || res.exchange}</span>
                      </div>
                      <svg style={{ flexShrink: 0, color: '#444' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '20px', color: '#555', fontSize: 13, textAlign: 'center' }}>No results found</div>
                )}
              </div>
            )}
          </div>

          {/* Profile */}
          <button className="gd-icon-btn gd-profile-btn" onClick={() => navigate('/settings')} title="Profile">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ══ TABS — same as Stocks ═══════════════════════════════════════════ */}
      <nav className="gd-tabs-nav">
        {['Explore', 'Dashboard', 'SIPs', 'Watchlists'].map(tab => (
          <button key={tab} className={`gd-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </nav>

      {/* ══ CONTENT ════════════════════════════════════════════════════════ */}
      <main className="gd-content">

        {/* ── EXPLORE ── */}
        {activeTab === 'Explore' && (
          <div className="gd-tab-panel mf-explore">

            {/* Popular Funds */}
            <section className="gd-explore-section">
              <div className="gd-section-header-split">
                <h2 className="gd-section-title">Popular Funds</h2>
                <button className="gd-see-more-btn">See All</button>
              </div>
              <div className="gd-stock-grid">
                {fundsLoading || !popularFunds.length
                  ? Array.from({ length: 6 }).map((_, i) => <FundCardSkeleton key={i} />)
                  : popularFunds.map(f => (
                      <FundCard key={f.schemeCode} fund={f} details={fundDetails[f.schemeCode]} />
                    ))
                }
              </div>
            </section>

            {/* Collections */}
            <section className="gd-explore-section">
              <h2 className="gd-section-title">Collections</h2>
              <div className="mf-collections-row">
                {COLLECTIONS.map(col => (
                  <button key={col.filterId} className="mf-collection-card"
                    style={{ '--col-border': col.border }}
                    onClick={() => { toggleFilter(col.filterId); setActiveTab('Explore'); }}>
                    <div className="mf-col-icon-wrap" style={{ background: col.bg, border: `1px solid ${col.border}` }}>
                      {col.icon}
                    </div>
                    <span className="mf-col-label">{col.label}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Recently Viewed */}
            <section className="gd-explore-section">
              <div className="gd-section-header-split">
                <h2 className="gd-section-title">Recently Viewed</h2>
              </div>
              <div className="gd-stock-grid">
                {recentFunds.length > 0
                  ? recentFunds.map(f => (
                      <FundCard key={f.schemeCode} fund={f} details={fundDetails[f.schemeCode]} />
                    ))
                  : <div className="gd-empty" style={{ padding: '24px', width: '100%' }}>Browse funds to see recently viewed.</div>
                }
              </div>
            </section>

            {/* Products & Tools */}
            <section className="gd-explore-section">
              <h2 className="gd-section-title">Products &amp; Tools</h2>
              <div className="mf-tools-row">
                {TOOLS.map(tool => (
                  <button key={tool.id} className="mf-tool-card">
                    <div className="mf-tool-icon-wrap" style={{
                      background: `${tool.color}1a`,
                      border: `1px solid ${tool.color}44`,
                    }}>{tool.icon}</div>
                    <span className="mf-tool-label">{tool.label}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* ══ ALL MUTUAL FUNDS ══ */}
            <section className="gd-explore-section">
              <h2 className="gd-section-title">All Mutual Funds</h2>

              {/* Filter pills */}
              <div className="mf-filter-bar">
                {FILTER_OPTIONS.map(filter => {
                  const active = activeFilters.includes(filter);
                  return (
                    <button
                      key={filter}
                      className={`mf-filter-pill ${active ? 'active' : ''}`}
                      onClick={() => toggleFilter(filter)}
                    >
                      {filter}
                      {active && (
                        <span
                          className="mf-pill-x"
                          onClick={e => { e.stopPropagation(); toggleFilter(filter); }}
                        >×</span>
                      )}
                    </button>
                  );
                })}
                {activeFilters.length > 0 && (
                  <button className="mf-clear-all" onClick={() => { setActiveFilters([]); setVisibleCount(20); }}>
                    Clear All
                  </button>
                )}
              </div>

              {/* Column headers */}
              <div className="mf-all-funds-hdr">
                <span>Fund</span>
                <div className="mf-hdr-returns">
                  <span>1Y</span><span>3Y</span><span>5Y</span>
                </div>
                <span></span>
              </div>

              {/* Fund rows */}
              <div className="mf-all-funds-list">
                {fundsLoading
                  ? Array.from({ length: 10 }).map((_, i) => <FundSkeleton key={i} />)
                  : visibleFunds.length === 0
                    ? <div className="gd-empty" style={{ padding: 40 }}>No funds match the selected filters.</div>
                    : visibleFunds.map(f => (
                        <AllFundRow key={f.schemeCode} fund={f} details={fundDetails[f.schemeCode]} />
                      ))
                }
              </div>

              {/* Load more */}
              {!fundsLoading && filteredFunds.length > visibleCount && (
                <button className="mf-load-more" onClick={() => setVisibleCount(v => v + 20)}>
                  Load More ({filteredFunds.length - visibleCount} remaining)
                </button>
              )}
              {!fundsLoading && filteredFunds.length > 0 && (
                <p className="mf-count-note">Showing {Math.min(visibleCount, filteredFunds.length)} of {filteredFunds.length.toLocaleString()} funds</p>
              )}
            </section>

          </div>
        )}

        {/* ── DASHBOARD ── */}
        {activeTab === 'Dashboard' && (
          <div className="gd-tab-panel">
            <div className="gd-empty" style={{ paddingTop: 64 }}>
              <svg width="48" height="48" fill="none" stroke="#333" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 16 }}>
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              <h3 style={{ color: '#E0E0E0', fontSize: 18, marginBottom: 8 }}>No MF Holdings</h3>
              <p style={{ fontSize: 14, maxWidth: 340, margin: '0 auto', color: '#666' }}>Invest in a fund to see your portfolio here.</p>
            </div>
          </div>
        )}

        {/* ── SIPs ── */}
        {activeTab === 'SIPs' && (
          <div className="gd-tab-panel">
            <div className="gd-portfolio-card-v2" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 13, color: '#aaa', marginBottom: 4 }}>Total Active SIPs Amount / month</div>
                  <div style={{ fontSize: 32, fontWeight: 600, color: '#fff' }}>
                    ₹{userSips.reduce((sum, s) => sum + (s.status === 'Active' ? s.amount : 0), 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {userSips.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {userSips.map(sip => (
                    <div key={sip.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#181818', borderRadius: 8, border: '1px solid #222' }}>
                      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                        <div className="mf-fund-avatar sm">{initials(sip.schemeName)}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>{shortName(sip.schemeName)}</span>
                          <span style={{ fontSize: 12, color: '#00D09C' }}>Next installment: {sip.nextPaymentDate}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <span style={{ fontSize: 16, color: '#fff', fontWeight: 600 }}>₹{sip.amount.toLocaleString('en-IN')} / mo</span>
                        <span style={{ fontSize: 11, color: '#aaa' }}>Date: {sip.deductionDate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="gd-empty" style={{ padding: '40px 0' }}>
                  <svg width="48" height="48" fill="none" stroke="#333" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 16 }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <h3 style={{ color: '#E0E0E0', fontSize: 18, marginBottom: 8 }}>No Active SIPs</h3>
                  <p style={{ fontSize: 14, color: '#666' }}>Start a Systematic Investment Plan to automate your wealth creation.</p>
                </div>
              )}
            </div>
          </div>
        )}


        {/* ── WATCHLISTS ── */}
        {activeTab === 'Watchlists' && (
          <div className="gd-tab-panel">
            <div className="gd-empty" style={{ paddingTop: 64 }}>
              <svg width="48" height="48" fill="none" stroke="#333" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 16 }}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l7.78-7.78a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              <h3 style={{ color: '#E0E0E0', fontSize: 18, marginBottom: 8 }}>Watchlist Empty</h3>
              <p style={{ fontSize: 14, color: '#666', maxWidth: 340, margin: '0 auto' }}>Add funds you like to track them here.</p>
            </div>
          </div>
        )}

      </main>

      {/* ══ SIP MODAL ═══════════════════════════════════════════════════════ */}
      {sipModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1E1E1E', borderRadius: '16px', border: '1px solid #333', width: '100%', maxWidth: '420px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', position: 'relative' }}>
            <button style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#999', cursor: 'pointer' }} onClick={() => setSipModal({ isOpen: false, fund: null })}>
               <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <h2 style={{ fontSize: 18, color: '#E8E8E8', marginBottom: 6 }}>Set up SIP</h2>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #2A2A2A' }}>{shortName(sipModal.fund.schemeName)}</div>
            
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 8 }}>Installment Amount</label>
              <div style={{ display: 'flex', alignItems: 'center', background: '#121212', borderRadius: '8px', border: '1px solid #333', padding: '0 12px' }}>
                <span style={{ fontSize: 20, color: '#fff', paddingRight: 8 }}>₹</span>
                <input type="number" 
                  value={sipAmount} onChange={e => setSipAmount(e.target.value)}
                  style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: 24, padding: '12px 0', outline: 'none', fontWeight: 600 }}
                  placeholder="0"
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {[500, 1000, 2500, 5000].map(amt => (
                  <button key={amt} onClick={() => setSipAmount(String(amt))}
                    style={{ flex: 1, padding: '6px 0', background: sipAmount === String(amt) ? 'rgba(0,208,156,0.15)' : '#181818', 
                             color: sipAmount === String(amt) ? '#00D09C' : '#888', border: sipAmount === String(amt) ? '1px solid #00D09C' : '1px solid #2a2a2a', 
                             borderRadius: '6px', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' }}>
                    +₹{amt}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 32 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 8 }}>Every month on</label>
              <select value={sipDate} onChange={e => setSipDate(e.target.value)}
                style={{ width: '100%', background: '#121212', border: '1px solid #333', color: '#fff', fontSize: 15, padding: '12px', borderRadius: '8px', outline: 'none' }}>
                {Array.from({ length: 28 }).map((_, i) => (
                  <option key={i+1} value={String(i+1)}>{i+1}{[1, 21].includes(i+1) ? 'st' : [2, 22].includes(i+1) ? 'nd' : [3, 23].includes(i+1) ? 'rd' : 'th'} of the month</option>
                ))}
              </select>
            </div>

            <button onClick={handleConfirmSip}
              style={{ width: '100%', background: '#00D09C', color: '#000', border: 'none', padding: '14px', borderRadius: '8px', fontSize: 16, fontWeight: 600, cursor: 'pointer', } }>
              Start SIP
            </button>
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: '#666' }}>
              First installment will be deducted from your Virtual Wallet today.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
