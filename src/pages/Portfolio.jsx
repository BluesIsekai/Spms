import { useEffect, useMemo, useState } from 'react';
import {
  fetchHoldings,
  subscribeHoldings,
  subscribeTransactions,
} from '../services/portfolioService';
import { fetchWallet, subscribeWallet } from '../services/walletService';
import { useStockPolling } from '../hooks/useStockPolling';
import { getDefaultUserId } from '../services/userService';
import { formatCurrency, formatPercent, getStatusClass } from '../constants/designTokens';
import PageHeader from '../components/ui/PageHeader';
import SummaryCard from '../components/ui/SummaryCard';
import DataTable from '../components/ui/DataTable';
import './Pages.css';

const DEFAULT_BALANCE = 100000;

export default function Portfolio() {
  const userId = getDefaultUserId();
  const [holdings, setHoldings] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  const stats = useMemo(() => {
    let totalInvested = 0;
    let totalCurrentValue = 0;
    let previousCloseValue = 0;

    holdings.forEach((h) => {
      const qty = h.quantity || 0;
      const buyPrice = h.average_buy_price || 0;
      const livePrice = prices[h.stock_symbol]?.price || buyPrice;
      const change = prices[h.stock_symbol]?.change || 0;
      const previousPrice = Math.max(livePrice - change, 0);
      
      totalInvested += qty * buyPrice;
      totalCurrentValue += qty * livePrice;
      previousCloseValue += qty * previousPrice;
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
  }, [holdings, prices]);

  if (loading) return <div className="page-loading">Loading portfolio...</div>;

  const virtualBalance = Number(wallet?.virtual_balance ?? DEFAULT_BALANCE);
  const totalProfitLossUp = stats.totalProfitLoss >= 0;
  const dailyPnLUp = stats.dailyPnLPct >= 0;

  // Transform holdings data for DataTable component
  const tableRows = holdings.map((h) => {
    const livePrice = prices[h.stock_symbol]?.price || h.average_buy_price;
    const invested = h.quantity * h.average_buy_price;
    const value = h.quantity * livePrice;
    const pnl = value - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

    return {
      id: h.id,
      symbol: h.stock_symbol,
      company: h.company_name || h.stock_symbol.replace('.NS', ''),
      quantity: Number(h.quantity).toFixed(2),
      avgBuyPrice: formatCurrency(h.average_buy_price),
      livePrice: formatCurrency(livePrice),
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
