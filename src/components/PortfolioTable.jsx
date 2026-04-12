import './PortfolioTable.css';

/**
 * Portfolio holdings table.
 * Props:
 *  - holdings {Array<{stock_symbol, quantity, average_buy_price}>}
 *  - livePrices {{ [symbol]: number }}
 *  - onSelectSymbol {function}
 */
export default function PortfolioTable({ holdings = [], livePrices = {}, onSelectSymbol }) {
  if (holdings.length === 0) {
    return (
      <div className="portfolio-empty" id="portfolio-table-empty">
        <svg width="40" height="40" fill="none" stroke="#3c494e" strokeWidth="1.5" viewBox="0 0 24 24">
          <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        <span>No holdings yet. Buy your first stock!</span>
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
            const current = livePrices[h.stock_symbol] || h.average_buy_price;
            const pl = (current - h.average_buy_price) * h.quantity;
            const plPct = ((current - h.average_buy_price) / h.average_buy_price) * 100;
            const value = current * h.quantity;
            const isUp = pl >= 0;

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
                <td className="align-right tabular">{h.quantity.toLocaleString()}</td>
                <td className="align-right tabular">${h.average_buy_price.toFixed(2)}</td>
                <td className="align-right tabular">${current.toFixed(2)}</td>
                <td className={`align-right tabular ${isUp ? 'up' : 'down'}`}>
                  {isUp ? '+' : ''}${pl.toFixed(2)}
                </td>
                <td className={`align-right tabular ${isUp ? 'up' : 'down'}`}>
                  {isUp ? '+' : ''}{plPct.toFixed(2)}%
                </td>
                <td className="align-right tabular bold">${value.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
