import { useState } from 'react';
import { formatAmount } from '../utils/currency';
import './Sidebar.css';

const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    id: 'chart',
    label: 'Charts',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    id: 'watchlist',
    label: 'Watchlist',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ),
  },
  {
    id: 'transactions',
    label: 'Transactions',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>
    ),
  },
];

/**
 * Sidebar component.
 * Props:
 *  - activePage {string}
 *  - onNavigate {function}
 *  - watchlist {Array<{symbol, price, change}>}
 *  - totalValue {number}
 *  - onSymbolClick {function}
 *  - mobileOpen {boolean}
 *  - onMobileClose {function}
 */
export default function Sidebar({
  activePage,
  onNavigate,
  watchlist = [],
  totalValue = 0,
  onSymbolClick,
  mobileOpen = false,
  onMobileClose,
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`} id="app-sidebar">
      <button
        type="button"
        className="sidebar-mobile-close"
        aria-label="Close navigation"
        onClick={() => onMobileClose?.()}
      >
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Logo */}
      <div className="sidebar-logo" onClick={() => onNavigate?.('dashboard')}>
        <div className="logo-icon">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M3 15 L7 9 L11 12 L15 5 L19 8" stroke="#00d4ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="19" cy="8" r="2" fill="#00d4ff"/>
          </svg>
        </div>
        {!collapsed && <span className="logo-text">SPMS</span>}
      </div>

      {/* Collapse toggle */}
      <button
        id="sidebar-collapse-btn"
        className="collapse-btn"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          {collapsed
            ? <polyline points="9 18 15 12 9 6"/>
            : <polyline points="15 18 9 12 15 6"/>}
        </svg>
      </button>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ id, label, icon }) => (
          <button
            key={id}
            id={`nav-${id}`}
            className={`nav-item${activePage === id ? ' active' : ''}`}
            onClick={() => onNavigate?.(id)}
            title={collapsed ? label : undefined}
          >
            <span className="nav-icon">{icon}</span>
            {!collapsed && <span className="nav-label">{label}</span>}
            {activePage === id && <span className="nav-active-bar" />}
          </button>
        ))}
      </nav>

      {/* Watchlist */}
      {!collapsed && (
        <div className="sidebar-watchlist">
          <div className="section-header">
            <span>Watchlist</span>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>

          <div className="watchlist-items">
            {watchlist.length === 0 ? (
              <div className="watchlist-empty">No symbols added</div>
            ) : (
              watchlist.map((item) => {
                const isUp = item.change >= 0;
                return (
                  <button
                    key={item.symbol}
                    id={`watchlist-item-${item.symbol}`}
                    className="watchlist-item"
                    onClick={() => onSymbolClick?.(item.symbol)}
                  >
                    <div className="wi-left">
                      <span className="wi-symbol">{item.symbol}</span>
                      <span className="wi-name">{item.name || ''}</span>
                    </div>
                    <div className="wi-right">
                      <span className="wi-price">{formatAmount(item.price || 0, item.currency || 'INR')}</span>
                      <span className={`wi-change ${isUp ? 'up' : 'down'}`}>
                        {isUp ? '+' : ''}{((item.changePct ?? item.change) || 0).toFixed(2)}%
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Portfolio summary */}
      {!collapsed && (
        <div className="sidebar-footer">
          <div className="portfolio-summary">
            <span className="ps-label">Portfolio Value</span>
            <span className="ps-value">₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
