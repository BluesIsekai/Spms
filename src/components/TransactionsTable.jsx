import './PortfolioTable.css';

/**
 * Transactions history table.
 * Props:
 *  - transactions {Array}
 */
export default function TransactionsTable({ transactions = [] }) {
  if (transactions.length === 0) {
    return (
      <div className="portfolio-empty" id="transactions-table-empty">
        <svg width="40" height="40" fill="none" stroke="#3c494e" strokeWidth="1.5" viewBox="0 0 24 24">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
        </svg>
        <span>No transactions yet.</span>
      </div>
    );
  }

  return (
    <div className="portfolio-table-wrapper" id="transactions-history-table">
      <table className="data-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Symbol</th>
            <th className="align-right">Qty</th>
            <th className="align-right">Price</th>
            <th className="align-right">Total</th>
            <th className="align-right">Date</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id} id={`tx-row-${tx.id}`} className="table-row">
              <td>
                <span className={`type-badge ${tx.transaction_type === 'BUY' ? 'buy' : 'sell'}`}>
                  {tx.transaction_type}
                </span>
              </td>
              <td><span className="symbol-badge">{tx.stock_symbol}</span></td>
              <td className="align-right tabular">{tx.quantity.toLocaleString()}</td>
              <td className="align-right tabular">${tx.price.toFixed(2)}</td>
              <td className="align-right tabular bold">${tx.total_amount.toFixed(2)}</td>
              <td className="align-right muted">
                {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
