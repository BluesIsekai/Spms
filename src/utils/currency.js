import { currencySymbol } from '../services/yahooStockApi';

export function inferCurrencyFromSymbol(symbol = '', fallback = 'USD') {
  if (!symbol) return fallback;
  if (symbol.endsWith('.NS') || symbol.endsWith('.BO')) return 'INR';
  if (symbol.includes('=X') && symbol.endsWith('INR=X')) return 'INR';
  return fallback;
}

export function formatAmount(value, currency = 'INR') {
  const num = Number(value || 0);
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  return `${currencySymbol(currency)}${num.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function convertToINR(amount, currency = 'INR', fxRates = {}) {
  const num = Number(amount || 0);
  if (currency === 'INR') return num;
  const fx = Number(fxRates[currency] || 1);
  return num * fx;
}
