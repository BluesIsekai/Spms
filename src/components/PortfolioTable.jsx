import './PortfolioTable.css';
import { convertToINR, formatAmount, inferCurrencyFromSymbol } from '../utils/currency';

function formatINR(value) {
  const num = Number(value || 0);
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Portfolio holdings table.
 * Props:
 *  - holdings {Array<{stock_symbol, quantity, average_buy_price}>}
 *  - livePrices {{ [symbol]: number }}
 *  - onSelectSymbol {function}
 */
export default function PortfolioTable({ holdings = [], livePrices = {}, liveQuotes = {}, fxRates = {}, onSelectSymbol, onEmptyCta }) {
  if (holdings.length === 0) {
    return (
      <div className="portfolio-empty" id="portfolio-table-empty">
        <div className="portfolio-empty-icon" aria-hidden="true">
          <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
            <path d="M4 16l4-5 3 2 5-7 4 3"/>
            <circle cx="20" cy="9" r="1.5" fill="currentColor" stroke="none"/>
          </svg>
        </div>
        <h3 className="portfolio-empty-title">No holdings yet.</h3>
        <p className="portfolio-empty-copy">Start paper trading by buying your first stock.</p>
        <button className="portfolio-empty-cta" type="button" onClick={() => onEmptyCta?.()}>
          Buy First Stock
        </button>
      </div>
    );
  }

  return (
    <div className="portfolio-table-wrapper" id="portfolio-holdings-table">
      <table className="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th className="align-right">Qty</th>
            <th className="align-right">Avg Price</th>
            <th className="align-right">Current</th>
            <th className="align-right">P&amp;L</th>
            <th className="align-right">P&amp;L %</th>
            <th className="align-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const quantity = Number(h.quantity || 0);
            const avgBuyPrice = Number(h.average_buy_price || 0);
            const quote = liveQuotes[h.stock_symbol] || {};
            const currency = quote.currency || h.holding_currency || inferCurrencyFromSymbol(h.stock_symbol, 'USD');
            const current = Number(quote.price || livePrices[h.stock_symbol] || avgBuyPrice);
            const plNative = (current - avgBuyPrice) * quantity;
            const plPct = avgBuyPrice > 0 ? ((current - avgBuyPrice) / avgBuyPrice) * 100 : 0;
            const valueInInr = convertToINR(current * quantity, currency, fxRates);
            const plInInr = convertToINR(plNative, currency, fxRates);
            const isUp = plInInr >= 0;

            return (
              <tr
                key={h.stock_symbol}
                id={`holding-row-${h.stock_symbol}`}
                className="table-row clickable"
                onClick={() => onSelectSymbol?.(h.stock_symbol)}
              >
                <td>
                  <span className="symbol-badge">{h.stock_symbol}</span>
                </td>
                <td className="align-right tabular">{quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                <td className="align-right tabular">{formatAmount(avgBuyPrice, currency)}</td>
                <td className="align-right tabular">{formatAmount(current, currency)}</td>
                <td className={`align-right tabular ${isUp ? 'up' : 'down'}`}>
                  {isUp ? '+' : '-'}{formatINR(Math.abs(plInInr))}
                </td>
                <td className={`align-right tabular ${isUp ? 'up' : 'down'}`}>
                  {isUp ? '+' : ''}{plPct.toFixed(2)}%
                </td>
                <td className="align-right tabular bold">{formatINR(valueInInr)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
