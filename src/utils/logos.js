export const SYMBOL_OVERRIDES = {
  // Hardcoded direct URLs to perfect SVG/PNG logos
  'RELIANCE.NS': 'https://www.freelogovectors.net/wp-content/uploads/2023/10/reliance_industries_logo-freelogovectors.net_.png',
  'INFY.NS': 'https://upload.wikimedia.org/wikipedia/commons/9/95/Infosys_logo.svg',
  'HDFCBANK.NS': 'https://upload.wikimedia.org/wikipedia/commons/2/28/HDFC_Bank_Logo.svg',
  'ICICIBANK.NS': 'https://upload.wikimedia.org/wikipedia/commons/1/12/ICICI_Bank_Logo.svg',
  'SBIN.NS': 'https://upload.wikimedia.org/wikipedia/commons/c/cc/SBI-logo.svg',
  'AXISBANK.NS': 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Axis_Bank_logo.svg',
  'KOTAKBANK.NS': 'https://upload.wikimedia.org/wikipedia/en/c/c5/Kotak_Mahindra_Bank_logo.svg',
  'LT.NS': 'https://upload.wikimedia.org/wikipedia/commons/e/e5/L%26T.svg',
  'HINDUNILVR.NS': 'https://upload.wikimedia.org/wikipedia/en/8/81/Hindustan_Unilever_logo.svg',
  'ITC.NS': 'https://upload.wikimedia.org/wikipedia/commons/f/ff/ITC_Limited_Logo.svg',

  // US Equities
  'NVDA': 'https://upload.wikimedia.org/wikipedia/commons/a/a4/NVIDIA_logo.svg',
  'TSLA': 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Tesla_Motors.svg',
  'AAPL': 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg',
  'MSFT': 'https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg',
  'GOOGL': 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg',
  'AMZN': 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
  'META': 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg',

  // Indices
  'NQ=F': 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Nasdaq_logo.svg',
  '^IXIC': 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Nasdaq_logo.svg',
  'ES=F': 'https://upload.wikimedia.org/wikipedia/commons/0/07/S%26P_Global_logo.svg',
  '^GSPC': 'https://upload.wikimedia.org/wikipedia/commons/0/07/S%26P_Global_logo.svg',

  // Crypto
  'BTC-USD': 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
  'ETH-USD': 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
};

export const SYMBOL_TO_DOMAIN = {
  // Clearbit Domain Fallbacks (for any standard scraping)
  'TCS.NS': 'tcs.com',
};

export function getCompanyLogo(symbol) {
  if (!symbol) return null;
  const upper = symbol.toUpperCase();
  
  // 1. Check direct override
  if (SYMBOL_OVERRIDES[upper]) return SYMBOL_OVERRIDES[upper];
  
  // 2. Check Clearbit
  const mapped = SYMBOL_TO_DOMAIN[upper];
  if (mapped) return `https://logo.clearbit.com/${mapped}`;
  
  return null;
}
