import { supabase } from './supabaseClient';

// Helper to check if Supabase is practically configured
const SUPABASE_CONFIGURED =
  import.meta.env.VITE_SUPABASE_URL &&
  /^https?:\/\/.+/.test(import.meta.env.VITE_SUPABASE_URL) &&
  import.meta.env.VITE_SUPABASE_URL !== 'https://your-project.supabase.co';

// Static fallback search for Demo Mode
const FALLBACK_STOCKS = [
  { symbol: 'RELIANCE', company_name: 'Reliance Industries', exchange: 'NSE', yahoo_symbol: 'RELIANCE.NS', sector: 'Energy' },
  { symbol: 'TCS', company_name: 'Tata Consultancy Services', exchange: 'NSE', yahoo_symbol: 'TCS.NS', sector: 'IT' },
  { symbol: 'HDFCBANK', company_name: 'HDFC Bank', exchange: 'NSE', yahoo_symbol: 'HDFCBANK.NS', sector: 'Banking' },
  { symbol: 'INFY', company_name: 'Infosys', exchange: 'NSE', yahoo_symbol: 'INFY.NS', sector: 'IT' },
  { symbol: 'SBIN', company_name: 'State Bank of India', exchange: 'NSE', yahoo_symbol: 'SBIN.NS', sector: 'Banking' },
  { symbol: 'TATAMOTORS', company_name: 'Tata Motors', exchange: 'NSE', yahoo_symbol: 'TATAMOTORS.NS', sector: 'Automotive' },
  { symbol: 'TATASTEEL', company_name: 'Tata Steel', exchange: 'NSE', yahoo_symbol: 'TATASTEEL.NS', sector: 'Metals' },
  { symbol: 'ICICIBANK', company_name: 'ICICI Bank', exchange: 'NSE', yahoo_symbol: 'ICICIBANK.NS', sector: 'Banking' },
  { symbol: 'WIPRO', company_name: 'Wipro', exchange: 'NSE', yahoo_symbol: 'WIPRO.NS', sector: 'IT' },
  { symbol: 'BAJFINANCE', company_name: 'Bajaj Finance', exchange: 'NSE', yahoo_symbol: 'BAJFINANCE.NS', sector: 'Finance' },
  { symbol: 'NIFTY', company_name: 'NIFTY 50', exchange: 'INDEX', yahoo_symbol: '^NSEI', sector: 'Index' },
  { symbol: 'BANKNIFTY', company_name: 'NIFTY Bank', exchange: 'INDEX', yahoo_symbol: '^NSEBANK', sector: 'Index' },
  { symbol: 'FINNIFTY', company_name: 'NIFTY Financial Services', exchange: 'INDEX', yahoo_symbol: '^CNXFIN', sector: 'Index' },
  { symbol: 'SENSEX', company_name: 'BSE SENSEX', exchange: 'INDEX', yahoo_symbol: '^BSESN', sector: 'Index' },
];

/**
 * Perform a global search against the Supabase `stocks_master` schema.
 * Matches on both stock symbol prefix and company name loosely.
 */
export async function searchStocks(query) {
  if (!query) return [];

  const lowerq = query.trim().toLowerCase();

  // Handle unconfigured/demo mode elegantly via memory filter
  if (!SUPABASE_CONFIGURED || !supabase) {
    return FALLBACK_STOCKS.filter((stock) => 
      stock.symbol.toLowerCase().includes(lowerq) || 
      stock.company_name.toLowerCase().includes(lowerq)
    ).slice(0, 10);
  }

  const searchFromCatalog = async (tableName) => {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .or(`symbol.ilike.%${lowerq}%,company_name.ilike.%${lowerq}%,yahoo_symbol.ilike.%${lowerq}%,sector.ilike.%${lowerq}%`)
      .limit(10);

    if (error) throw error;
    return data || [];
  };

  try {
    const marketCatalog = await searchFromCatalog('market_catalog');
    if (marketCatalog.length > 0) return marketCatalog;
  } catch (error) {
    if (error?.code !== '42P01') {
      console.error('Supabase market catalog search error:', error);
      return [];
    }
  }

  try {
    return await searchFromCatalog('stocks_master');
  } catch (error) {
    console.error('Supabase autocomplete search error:', error);
    return [];
  }
}
