import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Shared headers to mimic a browser session visiting Yahoo Finance.
// This prevents 401/403 when the dev-proxy forwards requests to Yahoo Finance.
const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://finance.yahoo.com',
  Referer: 'https://finance.yahoo.com/',
};

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Chart / quote data  →  query1.finance.yahoo.com
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
        headers: YAHOO_HEADERS,
      },
      // Symbol search  →  query2.finance.yahoo.com
      '/api/yahoo-search': {
        target: 'https://query2.finance.yahoo.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo-search/, ''),
        headers: YAHOO_HEADERS,
      },
    },
  },
});
