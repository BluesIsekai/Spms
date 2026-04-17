import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatMarketCap, formatVolume } from '../services/yahooStockApi';
import { useStockPolling } from '../hooks/useStockPolling';
import SymbolLogo from '../components/ui/SymbolLogo';
import './ExploreCategory.css';
import './Dashboard.css';

const CATEGORY_SYMBOLS = {
  'most-bought': ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'INFY.NS', 'SBIN.NS', 'ITC.NS', 'LT.NS', 'BAJFINANCE.NS', 'BHARTIARTL.NS'],
  'top-movers':  ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'INFY.NS', 'SBIN.NS', 'ITC.NS', 'LT.NS', 'BAJFINANCE.NS', 'BHARTIARTL.NS'],
  'most-traded-mtf': ['TATASTEEL.NS', 'ZEEL.NS', 'PNB.NS', 'IDEA.NS', 'YESBANK.NS', 'BHEL.NS', 'SAIL.NS', 'BANKBARODA.NS', 'TATAMOTORS.NS', 'SUZLON.NS'],
  'top-intraday': ['HDFCBANK.NS', 'RELIANCE.NS', 'ICICIBANK.NS', 'INFY.NS', 'TCS.NS', 'KOTAKBANK.NS', 'AXISBANK.NS', 'SBIN.NS', 'HINDUNILVR.NS', 'ITC.NS'],
  'volume-shockers': ['IDEA.NS', 'YESBANK.NS', 'SUZLON.NS', 'PNB.NS', 'BHEL.NS', 'ZOMATO.NS', 'IRFC.NS', 'RPOWER.NS', 'NHPC.NS', 'GMRINFRA.NS'],
  'sectors-trending': ['^NSEBANK', '^CNXIT', '^CNXAUTO', '^CNXPHARMA', '^CNXMETAL', '^CNXENERGY', '^CNXFMCG', '^CNXREALTY', '^CNXINFRA', '^CNXCONSUM'],
  'most-bought-etfs': ['NIFTYBEES.NS', 'BANKBEES.NS', 'MON100.NS', 'LIQUIDBEES.NS', 'GOLDBEES.NS', 'JUNIORBEES.NS', 'CPSEETF.NS', 'HDFCNIFETF.NS', 'SETFNIF50.NS']
};

const CATEGORY_TITLES = {
  'most-bought': 'Most Bought on App',
  'top-movers': 'Top Movers Today',
  'most-traded-mtf': 'Most Traded in MTF',
  'top-intraday': 'Top Intraday Highlights',
  'volume-shockers': 'Volume Shockers',
  'sectors-trending': 'Sectors Trending Today',
  'most-bought-etfs': 'Most Bought ETFs'
};

export default function ExploreCategory() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  
  const [filter, setFilter] = useState('Market Cap'); // 'Market Cap', 'Close Price', 'Gainers', 'Losers', 'Volume'
  const [searchQuery, setSearchQuery] = useState('');

  const title = CATEGORY_TITLES[categoryId] || 'Explore Stocks';
  const symbolsToFetch = CATEGORY_SYMBOLS[categoryId] || CATEGORY_SYMBOLS['most-bought'];

  // Use the same realtime polling hook as the Dashboard
  const { prices, loading } = useStockPolling(symbolsToFetch);

  const sortedStocks = useMemo(() => {
    // Only map valid items returned by the API
    let sorted = Object.values(prices).filter(p => p && p.price > 0);
    switch (filter) {
      case 'Market Cap':
        sorted.sort((a, b) => b.marketCap - a.marketCap);
        break;
      case 'Close Price':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'Gainers':
        sorted.sort((a, b) => b.changePct - a.changePct);
        break;
      case 'Losers':
        sorted.sort((a, b) => a.changePct - b.changePct);
        break;
      case 'Volume':
        sorted.sort((a, b) => b.volume - a.volume);
        break;
      default:
        break;
    }
    return sorted;
  }, [prices, filter]);

  const displayedStocks = useMemo(() => {
    if (!searchQuery.trim()) return sortedStocks;
    const q = searchQuery.toLowerCase();
    return sortedStocks.filter(s =>
      (s.symbol || '').toLowerCase().includes(q) ||
      (s.name  || '').toLowerCase().includes(q)
    );
  }, [sortedStocks, searchQuery]);

  return (
    <div className="explore-cat-page">
      <header className="ec-header">
        <button className="ec-back-btn" onClick={() => navigate(-1)}>
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <h1 className="ec-title">{title}</h1>

        {/* Search bar — same teal focus effect as Dashboard */}
        <div className="gd-search-container ec-search">
          <svg width="15" height="15" fill="none" stroke="#555" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className="gd-search-input"
            placeholder="Search by name or symbol…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery.trim().length > 0 && (
            <button
              className="gd-icon-btn"
              style={{ padding: 0 }}
              onClick={() => setSearchQuery('')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      </header>

      <div className="ec-toolbar">
        <span className="ec-count">{displayedStocks.length} items</span>
        <div className="ec-filter-box">
          <label>Sort by:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="ec-select">
            <option value="Market Cap">Market Cap</option>
            <option value="Close Price">Close Price</option>
            <option value="Gainers">Top Gainers</option>
            <option value="Losers">Top Losers</option>
            <option value="Volume">Volume</option>
          </select>
        </div>
      </div>

      <div className="ec-list">
        {loading ? (
          <div className="ec-loading">Loading market data...</div>
        ) : (
          displayedStocks.map((stock, i) => {
             const isUp = stock.changePct >= 0;
             let displayValue = '';

             if (filter === 'Market Cap') {
               displayValue = formatMarketCap(stock.marketCap, stock.currency);
             } else if (filter === 'Close Price') {
               displayValue = `₹${stock.price.toFixed(2)}`;
             } else if (filter === 'Volume') {
               displayValue = formatVolume(stock.volume);
             } else {
               // Gainers / Losers
               displayValue = `${isUp ? '+' : ''}${stock.changePct.toFixed(2)}%`;
             }

             return (
               <div key={stock.symbol} className="ec-list-item" onClick={() => navigate(`/chart/${encodeURIComponent(stock.symbol)}`)}>
                  <div className="ec-item-left">
                     <SymbolLogo symbol={stock.symbol} size={32} />
                     <div className="ec-item-info">
                       <span className="ec-item-name">{stock.name}</span>
                       <span className="ec-item-symbol">{stock.symbol.replace('.NS', '')}</span>
                     </div>
                  </div>
                  <div className="ec-item-right">
                     <div className="ec-item-val">{displayValue}</div>
                     {filter !== 'Gainers' && filter !== 'Losers' && (
                        <div className={`ec-item-subval ${isUp ? 'up' : 'down'}`}>
                          {isUp ? '+' : '−'}₹{Math.abs(stock.change).toFixed(2)} ({isUp ? '+' : '−'}{Math.abs(stock.changePct).toFixed(2)}%)
                        </div>
                     )}
                  </div>
               </div>
             )
          })
        )}
      </div>
    </div>
  );
}
