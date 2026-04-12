import { useEffect, useMemo, useState } from 'react';
import { fetchTransactions, subscribeTransactions } from '../services/portfolioService';
import { useAuth } from '../hooks/useAuth.jsx';
import { formatCurrency, getStatusClass } from '../constants/designTokens';
import PageHeader from '../components/ui/PageHeader';
import DataTable from '../components/ui/DataTable';
import Card from '../components/ui/Card';
import './Pages.css';

export default function Transactions() {
  const { user } = useAuth();
  const userId = user?.id;
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [filterType, setFilterType] = useState('ALL');
  const [searchSymbol, setSearchSymbol] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return () => {};
    }

    const load = async () => {
      const data = await fetchTransactions(userId, 1000);
      setTransactions(data || []);
    };

    load()
      .catch(console.error)
      .finally(() => setLoading(false));

    const unsubscribe = subscribeTransactions(userId, () => {
      fetchTransactions(userId, 1000)
        .then((data) => setTransactions(data || []))
        .catch(console.error);
    });

    return () => unsubscribe();
  }, [userId]);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
      const matchType = filterType === 'ALL' || tx.transaction_type === filterType;
      const matchSymbol = tx.stock_symbol.toLowerCase().includes(searchSymbol.toLowerCase());
      const createdAt = new Date(tx.created_at);
      const matchFrom = !fromDate || createdAt >= new Date(`${fromDate}T00:00:00`);
      const matchTo = !toDate || createdAt <= new Date(`${toDate}T23:59:59`);
      return matchType && matchSymbol && matchFrom && matchTo;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [transactions, filterType, searchSymbol, fromDate, toDate]);

  if (loading) return <div className="page-loading">Loading transactions...</div>;

  // Transform transactions data for DataTable component
  const tableRows = filteredTransactions.map((tx) => ({
    id: tx.id,
    date: new Date(tx.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
    symbol: tx.stock_symbol,
    action: tx.transaction_type,
    quantity: Number(tx.quantity).toFixed(2),
    price: formatCurrency(tx.price),
    totalAmount: formatCurrency(tx.total_amount),
    actionStatus: getStatusClass(tx.transaction_type === 'BUY' ? 1 : -1),
  }));

  const tableHeaders = [
    { key: 'date', label: 'Date' },
    { key: 'symbol', label: 'Symbol' },
    {
      key: 'action',
      label: 'Action',
      render: (val, row) => <span className={row.actionStatus}>{val}</span>,
    },
    { key: 'quantity', label: 'Qty', align: 'right' },
    { key: 'price', label: 'Price', align: 'right' },
    { key: 'totalAmount', label: 'Total Amount', align: 'right' },
  ];

  return (
    <div className="page-container">
      <PageHeader
        title="Transaction History"
        description="Review your paper trading activity with action, symbol, and date range filters."
      />

      <Card className="transaction-filters-card">
        <div className="table-controls">
          <input
            type="text"
            placeholder="Search symbol..."
            className="table-filter"
            value={searchSymbol}
            onChange={(e) => setSearchSymbol(e.target.value)}
          />
          <select className="table-filter" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="ALL">All Types</option>
            <option value="BUY">Buy</option>
            <option value="SELL">Sell</option>
          </select>
          <input
            type="date"
            className="table-filter"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            title="From date"
          />
          <input
            type="date"
            className="table-filter"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            title="To date"
          />
        </div>
      </Card>

      <DataTable headers={tableHeaders} rows={tableRows} emptyMessage="No transactions found." />
    </div>
  );
}
