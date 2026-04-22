import { searchSymbols } from './src/services/yahooStockApi.js';

async function test() {
  const queries = ['MCX', 'CRUDEOIL.BO', 'GOLD.BO', 'SILVER.BO', 'NATURALGAS.BO'];
  for (const q of queries) {
    const res = await searchSymbols(q);
    console.log(`--- Query: ${q} ---`);
    console.log(res);
  }
}

test();
