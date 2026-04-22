import './PortfolioTable.css';
import { inferCurrencyFromSymbol } from '../utils/currency';
import SymbolLogo from './ui/SymbolLogo';

function formatINR(value) {
  const num = Number(value || 0);
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatByCurrency(value, currency = 'INR') {
  const num = Number(value || 0);
  const map = { INR: '₹', USD: '$', GBP: '£', EUR: '€', JPY: '¥' };
  const symbol = map[currency] || `${currency} `;
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  return `${symbol}${num.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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
          {transactions.map((tx) => {
            const priceCurrency = inferCurrencyFromSymbol(tx.stock_symbol, 'USD');
            return (
            <tr key={tx.id} id={`tx-row-${tx.id}`} className="table-row">
              <td>
                <span className={`type-badge ${tx.transaction_type === 'BUY' ? 'buy' : 'sell'}`}>
                  {tx.transaction_type}
                </span>
              </td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <SymbolLogo symbol={tx.stock_symbol} size={28} />
                  <span className="symbol-badge">{tx.stock_symbol}</span>
                </div>
              </td>
              <td className="align-right tabular">{Number(tx.quantity || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
              <td className="align-right tabular">{formatByCurrency(tx.price, priceCurrency)}</td>
              <td className="align-right tabular bold">{formatINR(tx.total_amount)}</td>
              <td className="align-right muted">
                {new Date(tx.created_at).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
            </tr>
          );})}
        </tbody>
      </table>

      <div className="transactions-mobile-cards">
        {transactions.map((tx) => {
          const priceCurrency = inferCurrencyFromSymbol(tx.stock_symbol, 'USD');

          return (
            <div key={tx.id} id={`tx-card-${tx.id}`} className="transaction-mobile-card">
              <div className="transaction-mobile-card-head">
                <span className={`type-badge ${tx.transaction_type === 'BUY' ? 'buy' : 'sell'}`}>
                  {tx.transaction_type}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <SymbolLogo symbol={tx.stock_symbol} size={24} />
                  <span className="symbol-badge">{tx.stock_symbol}</span>
                </div>
              </div>

              <div className="transaction-mobile-grid">
                <div>
                  <span className="portfolio-mobile-label">Qty</span>
                  <span className="portfolio-mobile-value">{Number(tx.quantity || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div>
                  <span className="portfolio-mobile-label">Price</span>
                  <span className="portfolio-mobile-value">{formatByCurrency(tx.price, priceCurrency)}</span>
                </div>
                <div>
                  <span className="portfolio-mobile-label">Total</span>
                  <span className="portfolio-mobile-value bold">{formatINR(tx.total_amount)}</span>
                </div>
                <div className="transaction-mobile-span">
                  <span className="portfolio-mobile-label">Date</span>
                  <span className="portfolio-mobile-value muted">
                    {new Date(tx.created_at).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
