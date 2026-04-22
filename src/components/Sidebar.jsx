import { useState } from 'react';
import './Sidebar.css';

const ASSET_NAV = [
  {
    id: 'dashboard',
    label: 'Stocks',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    id: 'fno',
    label: 'F&O',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    id: 'mutual_funds',
    label: 'Mutual Funds',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    ),
  }
];

export default function Sidebar({
  activePage,
  onNavigate,
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
        {ASSET_NAV.map((nav) => (
          <button
            key={nav.id}
            className={`nav-item${(activePage === nav.id || (nav.id === 'dashboard' && activePage !== 'fno' && activePage !== 'mutual_funds' && activePage !== 'settings')) ? ' active' : ''}`}
            onClick={() => onNavigate?.(nav.id)}
            title={collapsed ? nav.label : undefined}
          >
            <span className="nav-icon">{nav.icon}</span>
            {!collapsed && <span className="nav-label">{nav.label}</span>}
            {(activePage === nav.id || (nav.id === 'dashboard' && activePage !== 'fno' && activePage !== 'mutual_funds' && activePage !== 'settings')) && <span className="nav-active-bar" />}
          </button>
        ))}

        <div style={{ flex: 1 }}></div>

        <button
          key="settings"
          className={`nav-item${activePage === 'settings' ? ' active' : ''}`}
          onClick={() => onNavigate?.('settings')}
          title={collapsed ? 'Settings' : undefined}
          style={{ marginTop: 'auto', marginBottom: '16px' }}
        >
          <span className="nav-icon">
             <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
               <circle cx="12" cy="12" r="3"/>
               <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
             </svg>
          </span>
          {!collapsed && <span className="nav-label">Settings</span>}
          {activePage === 'settings' && <span className="nav-active-bar" />}
        </button>
      </nav>
    </aside>
  );
}
