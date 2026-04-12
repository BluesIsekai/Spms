-- ╔══════════════════════════════════════════════════════════════╗
-- ║   SPMS — Supabase Seed Data                                  ║
-- ║   Run this in: Supabase Dashboard → SQL Editor               ║
-- ╚══════════════════════════════════════════════════════════════╝

INSERT INTO public.stocks_master (symbol, company_name, exchange, yahoo_symbol, sector)
VALUES 
('RELIANCE', 'Reliance Industries', 'NSE', 'RELIANCE.NS', 'Energy'),
('TCS', 'Tata Consultancy Services', 'NSE', 'TCS.NS', 'IT'),
('HDFCBANK', 'HDFC Bank', 'NSE', 'HDFCBANK.NS', 'Banking'),
('INFY', 'Infosys', 'NSE', 'INFY.NS', 'IT'),
('SBIN', 'State Bank of India', 'NSE', 'SBIN.NS', 'Banking'),
('TATAMOTORS', 'Tata Motors', 'NSE', 'TATAMOTORS.NS', 'Automotive'),
('TATASTEEL', 'Tata Steel', 'NSE', 'TATASTEEL.NS', 'Metals'),
('ICICIBANK', 'ICICI Bank', 'NSE', 'ICICIBANK.NS', 'Banking'),
('WIPRO', 'Wipro', 'NSE', 'WIPRO.NS', 'IT'),
('BAJFINANCE', 'Bajaj Finance', 'NSE', 'BAJFINANCE.NS', 'Finance'),
('ITC', 'ITC Limited', 'NSE', 'ITC.NS', 'FMCG'),
('LT', 'Larsen & Toubro', 'NSE', 'LT.NS', 'Construction'),
('AXISBANK', 'Axis Bank', 'NSE', 'AXISBANK.NS', 'Banking'),
('HINDUNILVR', 'Hindustan Unilever', 'NSE', 'HINDUNILVR.NS', 'FMCG'),
('MARUTI', 'Maruti Suzuki', 'NSE', 'MARUTI.NS', 'Automotive')
ON CONFLICT (symbol) DO NOTHING;
