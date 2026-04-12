import { useEffect, useMemo, useState } from 'react';
import {
  fetchHoldings,
  subscribeHoldings,
  subscribeTransactions,
} from '../services/portfolioService';
import { fetchWallet, subscribeWallet } from '../services/walletService';
import { useStockPolling } from '../hooks/useStockPolling';
import { useAuth } from '../hooks/useAuth.jsx';
import { getFxRatesToINR } from '../services/yahooStockApi';
import { formatCurrency, formatPercent, getStatusClass } from '../constants/designTokens';
import { convertToINR, inferCurrencyFromSymbol } from '../utils/currency';
import PageHeader from '../components/ui/PageHeader';
import SummaryCard from '../components/ui/SummaryCard';
import DataTable from '../components/ui/DataTable';
import './Pages.css';

const DEFAULT_BALANCE = 100000;

export default function Portfolio() {
  const { user } = useAuth();
  const userId = user?.id;
  const [holdings, setHoldings] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fxRates, setFxRates] = useState({});

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return () => {};
    }

    const load = async () => {
      const [hData, wData] = await Promise.all([
        fetchHoldings(userId),
        fetchWallet(userId),
      ]);
      setHoldings(hData || []);
      setWallet(wData);
    };

    load()
      .catch(console.error)
      .finally(() => setLoading(false));

    const unsubHoldings = subscribeHoldings(userId, () => {
      fetchHoldings(userId).then((hData) => setHoldings(hData || [])).catch(console.error);
    });
    const unsubWallet = subscribeWallet(userId, () => {
      fetchWallet(userId).then((wData) => setWallet(wData)).catch(console.error);
    });
    const unsubTransactions = subscribeTransactions(userId, () => {
      fetchWallet(userId).then((wData) => setWallet(wData)).catch(console.error);
    });

    return () => {
      unsubHoldings();
      unsubWallet();
      unsubTransactions();
    };
  }, [userId]);

  const heldSymbols = useMemo(() => holdings.map((h) => h.stock_symbol), [holdings]);
  const { prices } = useStockPolling(heldSymbols, 10000);

  useEffect(() => {
    const currencies = holdings
      .map((h) => prices[h.stock_symbol]?.currency || h.holding_currency || inferCurrencyFromSymbol(h.stock_symbol, 'USD'))
      .filter(Boolean);

    getFxRatesToINR(currencies)
      .then((rates) => setFxRates(rates || {}))
      .catch(() => setFxRates({}));
  }, [holdings, prices]);

  const stats = useMemo(() => {
    let totalInvested = 0;
    let totalCurrentValue = 0;
    let previousCloseValue = 0;

    holdings.forEach((h) => {
      const qty = h.quantity || 0;
      const buyPrice = h.average_buy_price || 0;
      const quote = prices[h.stock_symbol] || {};
      const livePrice = quote.price || buyPrice;
      const change = quote.change || 0;
      const currency = quote.currency || h.holding_currency || inferCurrencyFromSymbol(h.stock_symbol, 'USD');
      const previousPrice = Math.max(livePrice - change, 0);
      
      totalInvested += convertToINR(qty * buyPrice, currency, fxRates);
      totalCurrentValue += convertToINR(qty * livePrice, currency, fxRates);
      previousCloseValue += convertToINR(qty * previousPrice, currency, fxRates);
    });

    const totalProfitLoss = totalCurrentValue - totalInvested;
    const dailyPnL = totalCurrentValue - previousCloseValue;
    const dailyPnLPct = previousCloseValue > 0 ? (dailyPnL / previousCloseValue) * 100 : 0;
    
    return {
      totalInvested,
      totalCurrentValue,
      totalProfitLoss,
      dailyPnLPct,
    };
  }, [holdings, prices, fxRates]);

  if (loading) return <div className="page-loading">Loading portfolio...</div>;

  const virtualBalance = Number(wallet?.virtual_balance ?? DEFAULT_BALANCE);
  const totalProfitLossUp = stats.totalProfitLoss >= 0;
  const dailyPnLUp = stats.dailyPnLPct >= 0;

  // Transform holdings data for DataTable component
  const tableRows = holdings.map((h) => {
    const quote = prices[h.stock_symbol] || {};
    const currency = quote.currency || h.holding_currency || inferCurrencyFromSymbol(h.stock_symbol, 'USD');
    const livePrice = quote.price || h.average_buy_price;
    const investedNative = h.quantity * h.average_buy_price;
    const valueNative = h.quantity * livePrice;
    const invested = convertToINR(investedNative, currency, fxRates);
    const value = convertToINR(valueNative, currency, fxRates);
    const pnl = value - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

    return {
      id: h.id,
      symbol: h.stock_symbol,
      company: h.company_name || h.stock_symbol.replace('.NS', ''),
      quantity: Number(h.quantity).toFixed(2),
      avgBuyPrice: formatCurrency(h.average_buy_price, currency),
      livePrice: formatCurrency(livePrice, currency),
      currentValue: formatCurrency(value),
      pnl: formatCurrency(pnl),
      pnlPct: formatPercent(pnlPct),
      pnlStatus: getStatusClass(pnl),
    };
  });

  const tableHeaders = [
    { key: 'symbol', label: 'Symbol' },
    { key: 'company', label: 'Company' },
    { key: 'quantity', label: 'Quantity', align: 'right' },
    { key: 'avgBuyPrice', label: 'Avg Buy Price', align: 'right' },
    { key: 'livePrice', label: 'Live Market Price', align: 'right' },
    { key: 'currentValue', label: 'Current Value', align: 'right' },
    {
      key: 'pnl',
      label: 'Profit / Loss',
      align: 'right',
      render: (val, row) => <span className={row.pnlStatus}>{row.pnl}</span>,
    },
    {
      key: 'pnlPct',
      label: '% Return',
      align: 'right',
      render: (val, row) => <span className={row.pnlStatus}>{row.pnlPct}</span>,
    },
  ];

  return (
    <div className="page-container">
      <PageHeader title="Portfolio" description="Track holdings, live market value, and paper trading returns in real time." />

      <div className="summary-cards">
        <SummaryCard label="Virtual Balance" value={formatCurrency(virtualBalance)} />
        <SummaryCard label="Total Invested" value={formatCurrency(stats.totalInvested)} />
        <SummaryCard label="Current Portfolio Value" value={formatCurrency(stats.totalCurrentValue)} />
        <SummaryCard
          label="Total Profit / Loss"
          value={formatCurrency(stats.totalProfitLoss)}
          status={totalProfitLossUp ? 'up' : 'down'}
        />
        <SummaryCard label="Daily P/L %" value={formatPercent(stats.dailyPnLPct)} status={dailyPnLUp ? 'up' : 'down'} />
      </div>

      <DataTable
        headers={tableHeaders}
        rows={tableRows}
        emptyMessage="Your portfolio is empty. Place a buy order from the Dashboard."
      />
    </div>
  );
}
