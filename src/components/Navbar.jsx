import { useState, useRef, useEffect } from 'react';
import { currencySymbol } from '../services/yahooStockApi';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';
import './Navbar.css';

/**
 * Top Navbar.
 *
 * Props:
 *  activeSymbol   {string}
 *  quote          {object}  Yahoo Finance quote — { price, change, changePct, currency }
 *  lastUpdated    {Date|null} timestamp of last successful poll
 *  connected      {boolean}   true once first poll has succeeded
 *  onRefresh      {fn}        manual refresh trigger
 *  onSymbolChange {fn}        callback to trigger symbol swap
 */
export default function Navbar({ activeSymbol, quote, lastUpdated, connected, onRefresh, onSymbolChange }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef(null);
  
  // Custom Hook replaces Yahoo Finance endpoint
  const { query, setQuery, results, isSearching, clearSearch } = useDebouncedSearch(300);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Manage Dropdown visibility based on query contents
  useEffect(() => {
    if (query.trim().length > 0) {
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
    // Reset keyboard tracking when query changes
    setSelectedIndex(-1);
  }, [query, results]);

  const handleSelect = (yahoo_symbol) => {
    onSymbolChange?.(yahoo_symbol);
    clearSearch();
    setShowDropdown(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelect(results[selectedIndex].yahoo_symbol);
      } else if (results.length > 0) {
        handleSelect(results[0].yahoo_symbol);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const sym       = currencySymbol(quote?.currency ?? 'INR');
  const isUp      = (quote?.change ?? 0) >= 0;
  const price     = quote?.price     ?? 0;
  const change    = quote?.change    ?? 0;
  const changePct = quote?.changePct ?? 0;

  // Format last-updated time as HH:MM:SS IST
  const updatedStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })
    : null;

  return (
    <header className="navbar" id="app-navbar">
      {/* Symbol search */}
      <div className="search-wrapper" ref={searchRef}>
        <div className="search-bar">
          <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            id="symbol-search-input"
            className="search-input"
            type="text"
            placeholder="Search NSE/BSE stocks… (e.g. Reliance)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.length > 0 && setShowDropdown(true)}
            onKeyDown={handleKeyDown}
          />
          {isSearching && <div className="search-spinner" />}
        </div>

        {showDropdown && results.length > 0 && (
          <ul className="search-dropdown" role="listbox">
            {results.map((r, i) => (
              <li
                key={r.symbol}
                className={`search-result${i === selectedIndex ? ' keyboard-active' : ''}`}
                role="option"
                onMouseDown={() => handleSelect(r.yahoo_symbol)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <div className="sr-left">
                  <span className="sr-symbol">{r.symbol}</span>
                  <span className={`sr-exchange badge-${(r.exchange || '').toLowerCase()}`}>
                    {r.exchange === 'INDEX' ? '[INDEX]' : `[${r.exchange}]`}
                  </span>
                </div>
                <div className="sr-right">
                  <span className="sr-desc">{r.company_name}</span>
                  {r.sector && <span className="sr-sector">{r.sector}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Live ticker strip */}
      {quote && (
        <div className="ticker-strip" id="navbar-ticker">
          <span className="ts-symbol">{activeSymbol}</span>
          <span className="ts-price">{sym}{price.toFixed(2)}</span>
          <span className={`ts-change ${isUp ? 'up' : 'down'}`}>
            {isUp ? '+' : ''}{change.toFixed(2)} ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
          </span>
        </div>
      )}

      {/* Right controls */}
      <div className="navbar-right">
        {/* Polling status indicator */}
        <div
          className={`ws-status${connected ? ' connected' : ''}`}
          title={connected && updatedStr ? `Last updated ${updatedStr} IST` : 'Connecting to Server…'}
        >
          <span className="ws-dot" />
          <span className="ws-label">
            {connected ? (updatedStr ? updatedStr : 'LIVE') : 'Loading'}
          </span>
        </div>

        {/* Manual refresh button */}
        <button
          id="manual-refresh-btn"
          className="icon-btn"
          aria-label="Refresh prices"
          onClick={onRefresh}
          title="Refresh prices now"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
        </button>

        {/* Notifications */}
        <button id="notifications-btn" className="icon-btn" aria-label="Notifications">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          <span className="notif-badge">3</span>
        </button>

        {/* User avatar */}
        <button id="user-avatar-btn" className="avatar-btn" aria-label="User menu">
          <div className="avatar">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
        </button>
      </div>
    </header>
  );
}
