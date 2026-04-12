import { useEffect, useMemo, useState } from 'react';
import {
  addToWatchlist,
  fetchWatchlist,
  recordTransaction,
  removeFromWatchlist,
  subscribeWatchlist,
} from '../services/portfolioService';
import { useStockPolling } from '../hooks/useStockPolling';
import { getFxRatesToINR } from '../services/yahooStockApi';
import { searchStocks } from '../services/searchService';
import { useAuth } from '../hooks/useAuth.jsx';
import { formatCurrency, formatPercent, getStatusClass } from '../constants/designTokens';
import { inferCurrencyFromSymbol } from '../utils/currency';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import DataTable from '../components/ui/DataTable';
import Card from '../components/ui/Card';
import './Pages.css';

function resolveTradingSymbol(stock) {
  return stock?.yahoo_symbol || stock?.stock_symbol || stock?.symbol || '';
}

export default function Watchlist({ onOpenChart }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [watchlistItems, setWatchlistItems] = useState([]);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [tradingSymbol, setTradingSymbol] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return () => {};
    }

    const load = async () => {
      const data = await fetchWatchlist(userId);
      setWatchlistItems(data || []);
    };

    load()
      .catch(console.error)
      .finally(() => setLoading(false));

    const unsubscribe = subscribeWatchlist(userId, () => {
      fetchWatchlist(userId)
        .then((data) => setWatchlistItems(data || []))
        .catch(console.error);
    });

    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setSearching(true);
      try {
        const data = await searchStocks(query);
        setResults(data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(handle);
  }, [query]);

  const symbols = useMemo(
    () => watchlistItems.map((w) => resolveTradingSymbol(w)).filter(Boolean),
    [watchlistItems]
  );

  const { prices } = useStockPolling(symbols, 10000);

  const handleAdd = async (stock) => {
    const symbol = stock.symbol || stock.stock_symbol;
    const marketSymbol = stock.yahoo_symbol || symbol;
    if (!symbol || !marketSymbol) return;

    try {
      await addToWatchlist(userId, marketSymbol, stock.company_name || symbol);
      setQuery('');
      setResults([]);
    } catch (err) {
      alert(`Failed to add stock: ${err.message}`);
    }
  };

  const handleRemove = async (symbol) => {
    try {
      await removeFromWatchlist(userId, symbol);
      setWatchlistItems((prev) => prev.filter((w) => w.stock_symbol !== symbol));
    } catch (err) {
      alert(`Failed to remove stock: ${err.message}`);
    }
  };

  const handleQuickTrade = async (symbol, action, livePrice, liveCurrency) => {
    if (!livePrice) return alert("Market price unavailable.");
    const currency = liveCurrency || inferCurrencyFromSymbol(symbol, 'USD');
    const symbolMap = { INR: '₹', USD: '$', GBP: '£', EUR: '€', JPY: '¥' };
    const displaySymbol = symbolMap[currency] || `${currency} `;
    const qty = parseInt(prompt(`Enter quantity to ${action} ${symbol} at ${displaySymbol}${livePrice.toFixed(2)}:`), 10);
    if (!qty || qty <= 0) return;
    
    try {
      const assetCurrency = currency;
      const rates = await getFxRatesToINR([assetCurrency]);
      const fxRateToInr = assetCurrency === 'INR' ? 1 : Number(rates[assetCurrency] || 1);
      await recordTransaction({
        userId,
        symbol,
        type: action,
        quantity: qty,
        price: livePrice,
        assetCurrency,
        fxRateToInr,
      });
      alert(`Successfully ${action}ED ${qty} shares of ${symbol}.`);
    } catch (err) {
      alert(`Trade failed: ${err.message}`);
    }
  };

  const handleOpenChart = (symbol) => {
    onOpenChart?.(symbol);
  };

  if (loading) return <div className="page-loading">Loading watchlist...</div>;

  // Transform watchlist data for DataTable component
  const tableRows = watchlistItems.map((item) => {
    const symbol = resolveTradingSymbol(item);
    const quote = prices[symbol] || {};
    const price = quote.price || 0;
    const currency = quote.currency || inferCurrencyFromSymbol(symbol, 'USD');
    const change = quote.change || 0;
    const changePct = quote.changePct || 0;

    return {
      id: item.id,
      symbol,
      company: item.company_name || symbol.replace('.NS', ''),
      price: formatCurrency(price),
      change: `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)`,
      changeStatus: getStatusClass(change),
      rawPrice: price,
      rawCurrency: currency,
      rawSymbol: symbol,
    };
  });

  const tableHeaders = [
    { key: 'symbol', label: 'Symbol' },
    { key: 'company', label: 'Company' },
    { key: 'price', label: 'Market Price', align: 'right' },
    {
      key: 'change',
      label: 'Change',
      align: 'right',
      render: (val, row) => <span className={row.changeStatus}>{val}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div className="actions-row">
          <Button
            variant="success"
            size="sm"
            onClick={() => handleQuickTrade(row.rawSymbol, 'BUY', row.rawPrice, row.rawCurrency)}
          >
            Buy
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleQuickTrade(row.rawSymbol, 'SELL', row.rawPrice, row.rawCurrency)}
          >
            Sell
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenChart(row.rawSymbol)}
          >
            Chart
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRemove(row.rawSymbol)}
          >
            Remove
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <PageHeader title="Watchlist" description="Track your favorite symbols with live prices and quick paper trading actions." />

      <Card className="watchlist-controls-card">
        <div className="watchlist-controls">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stocks or indices..."
            className="table-filter"
          />
          <Button
            variant="primary"
            size="md"
            disabled={!tradingSymbol}
            onClick={() => {
              if (!tradingSymbol) return;
              handleAdd({ symbol: tradingSymbol, yahoo_symbol: tradingSymbol, company_name: tradingSymbol });
              setTradingSymbol('');
            }}
          >
            Add Symbol
          </Button>
        </div>

        {query.trim() && (
          <div className="search-results-panel">
            {searching && <div className="search-results-empty">Searching...</div>}
            {!searching && results.length === 0 && <div className="search-results-empty">No matches found.</div>}
            {!searching &&
              results.length > 0 &&
              results.map((result) => {
                const symbol = resolveTradingSymbol(result);
                return (
                  <button
                    key={`${result.symbol}-${result.exchange}`}
                    type="button"
                    className="search-result-row"
                    onClick={() => handleAdd(result)}
                  >
                    <div>
                      <div className="search-result-title">{symbol}</div>
                      <div className="search-result-subtitle">{result.company_name || result.shortname || result.symbol}</div>
                    </div>
                    <span className="add-pill">Add</span>
                  </button>
                );
              })}
          </div>
        )}

        <div className="watchlist-controls mt-4">
          <input
            type="text"
            value={tradingSymbol}
            onChange={(e) => setTradingSymbol(e.target.value.toUpperCase().trim())}
            placeholder="Quick add by Yahoo symbol, e.g. RELIANCE.NS"
            className="table-filter"
          />
        </div>
      </Card>

      <DataTable
        headers={tableHeaders}
        rows={tableRows}
        emptyMessage="Your watchlist is empty. Add stocks from the Dashboard."
        className="watchlist-table"
      />
    </div>
  );
}
