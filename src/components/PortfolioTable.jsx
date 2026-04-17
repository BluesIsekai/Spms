import './PortfolioTable.css';
import { convertToINR, formatAmount, inferCurrencyFromSymbol } from '../utils/currency';
import SymbolLogo from './ui/SymbolLogo';

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
            const currentPrice = Number(quote.price || livePrices[h.stock_symbol] || avgBuyPrice);
            const rowPL = (currentPrice - avgBuyPrice) * quantity;
            const rowPLPercent = avgBuyPrice > 0 ? ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100 : 0;
            const valueInInr = convertToINR(currentPrice * quantity, currency, fxRates);
            const plInInr = convertToINR(rowPL, currency, fxRates);
            const isUp = plInInr >= 0;

            return (
              <tr
                key={h.stock_symbol}
                id={`holding-row-${h.stock_symbol}`}
                className="table-row clickable"
                onClick={() => onSelectSymbol?.(h.stock_symbol)}
              >
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <SymbolLogo symbol={h.stock_symbol} size={28} />
                    <span className="symbol-badge">{h.stock_symbol}</span>
                  </div>
                </td>
                <td className="align-right tabular">{quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                <td className="align-right tabular">{formatAmount(avgBuyPrice, currency)}</td>
                <td className="align-right tabular">{formatAmount(currentPrice, currency)}</td>
                <td className={`align-right tabular ${isUp ? 'up' : 'down'}`}>
                  {isUp ? '+' : '-'}{formatINR(Math.abs(plInInr))}
                </td>
                <td className={`align-right tabular ${isUp ? 'up' : 'down'}`}>
                  {isUp ? '+' : '−'}{rowPLPercent.toFixed(2)}%
                </td>
                <td className="align-right tabular bold">{formatINR(valueInInr)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="portfolio-mobile-cards">
        {holdings.map((h) => {
          const quantity = Number(h.quantity || 0);
          const avgBuyPrice = Number(h.average_buy_price || 0);
          const quote = liveQuotes[h.stock_symbol] || {};
          const currency = quote.currency || h.holding_currency || inferCurrencyFromSymbol(h.stock_symbol, 'USD');
          const currentPrice = Number(quote.price || livePrices[h.stock_symbol] || avgBuyPrice);
          const rowPL = (currentPrice - avgBuyPrice) * quantity;
          const rowPLPercent = avgBuyPrice > 0 ? ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100 : 0;
          const valueInInr = convertToINR(currentPrice * quantity, currency, fxRates);
          const plInInr = convertToINR(rowPL, currency, fxRates);
          const isUp = plInInr >= 0;

          return (
            <button
              key={h.stock_symbol}
              type="button"
              id={`holding-card-${h.stock_symbol}`}
              className="portfolio-mobile-card"
              onClick={() => onSelectSymbol?.(h.stock_symbol)}
            >
              <div className="portfolio-mobile-card-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <SymbolLogo symbol={h.stock_symbol} size={24} />
                  <span className="symbol-badge">{h.stock_symbol}</span>
                </div>
                <span className={`portfolio-mobile-card-value ${isUp ? 'up' : 'down'}`}>
                  {isUp ? '+' : '-'}{formatINR(Math.abs(plInInr))}
                </span>
              </div>

              <div className="portfolio-mobile-card-grid">
                <div>
                  <span className="portfolio-mobile-label">Quantity</span>
                  <span className="portfolio-mobile-value">{quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div>
                  <span className="portfolio-mobile-label">Avg Price</span>
                  <span className="portfolio-mobile-value">{formatAmount(avgBuyPrice, currency)}</span>
                </div>
                <div>
                  <span className="portfolio-mobile-label">Current</span>
                  <span className="portfolio-mobile-value">{formatAmount(currentPrice, currency)}</span>
                </div>
                <div>
                  <span className="portfolio-mobile-label">P&amp;L %</span>
                  <span className={`portfolio-mobile-value ${isUp ? 'up' : 'down'}`}>
                    {isUp ? '+' : '−'}{rowPLPercent.toFixed(2)}%
                  </span>
                </div>
                <div className="portfolio-mobile-span">
                  <span className="portfolio-mobile-label">Value</span>
                  <span className="portfolio-mobile-value bold">{formatINR(valueInInr)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
