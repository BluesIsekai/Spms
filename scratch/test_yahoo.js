const https = require('https');

https.get('https://query1.finance.yahoo.com/v8/finance/chart/RELIANCE.NS?interval=1d&range=1d', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const meta = json.chart.result[0].meta;
      console.log('MARKET PRICE:', meta.regularMarketPrice);
      console.log('MARKET CHANGE:', meta.regularMarketChange);
      console.log('MARKET CHANGE PCT:', meta.regularMarketChangePercent);
      console.log('PREV CLOSE:', meta.chartPreviousClose, meta.previousClose);
    } catch(e) {
      console.error(e);
    }
  });
});
