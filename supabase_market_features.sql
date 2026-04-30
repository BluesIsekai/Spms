CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Shared instrument catalog ────────────────────────────────
-- Same shape as the stock master list, extended with asset type.
CREATE TABLE IF NOT EXISTS public.market_catalog (
  symbol        TEXT PRIMARY KEY,
  company_name  TEXT NOT NULL,
  exchange      TEXT NOT NULL,
  yahoo_symbol  TEXT NOT NULL UNIQUE,
  sector        TEXT,
  asset_type    TEXT NOT NULL CHECK (asset_type IN ('EQUITY', 'ETF', 'INDEX', 'MUTUAL_FUND', 'FNO', 'COMMODITY', 'CRYPTO')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_catalog_company_name ON public.market_catalog(company_name);
CREATE INDEX IF NOT EXISTS idx_market_catalog_exchange ON public.market_catalog(exchange);
CREATE INDEX IF NOT EXISTS idx_market_catalog_sector ON public.market_catalog(sector);

ALTER TABLE public.market_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "market_catalog_public_read" ON public.market_catalog;
CREATE POLICY "market_catalog_public_read" ON public.market_catalog
  FOR SELECT USING (true);

-- Seed the shared catalog from the legacy stock master when it already exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'stocks_master'
  ) THEN
    INSERT INTO public.market_catalog (symbol, company_name, exchange, yahoo_symbol, sector, asset_type)
    SELECT symbol, company_name, exchange, yahoo_symbol, sector, 'EQUITY'
    FROM public.stocks_master
    ON CONFLICT (symbol) DO UPDATE
    SET company_name = EXCLUDED.company_name,
        exchange = EXCLUDED.exchange,
        yahoo_symbol = EXCLUDED.yahoo_symbol,
        sector = EXCLUDED.sector,
        asset_type = EXCLUDED.asset_type;
  END IF;
END $$;

-- ─── Mutual fund master ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mutual_funds_master (
  scheme_code  TEXT PRIMARY KEY,
  scheme_name  TEXT NOT NULL,
  fund_house   TEXT,
  category     TEXT,
  risk_level   TEXT,
  yahoo_symbol TEXT UNIQUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mutual_funds_master_scheme_name ON public.mutual_funds_master(scheme_name);
CREATE INDEX IF NOT EXISTS idx_mutual_funds_master_category ON public.mutual_funds_master(category);
CREATE INDEX IF NOT EXISTS idx_mutual_funds_master_fund_house ON public.mutual_funds_master(fund_house);

ALTER TABLE public.mutual_funds_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mutual_funds_master_public_read" ON public.mutual_funds_master;
CREATE POLICY "mutual_funds_master_public_read" ON public.mutual_funds_master
  FOR SELECT USING (true);

-- ─── F&O instrument master ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fno_instruments_master (
  symbol           TEXT PRIMARY KEY,
  company_name     TEXT NOT NULL,
  exchange         TEXT NOT NULL,
  yahoo_symbol     TEXT NOT NULL UNIQUE,
  sector           TEXT,
  instrument_type  TEXT NOT NULL CHECK (instrument_type IN ('FUTURE', 'OPTION')),
  underlying_symbol TEXT,
  expiry_date      DATE,
  strike_price     NUMERIC(18, 6),
  option_type      TEXT CHECK (option_type IN ('CE', 'PE')),
  lot_size         INTEGER,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fno_instruments_master_company_name ON public.fno_instruments_master(company_name);
CREATE INDEX IF NOT EXISTS idx_fno_instruments_master_underlying_symbol ON public.fno_instruments_master(underlying_symbol);
CREATE INDEX IF NOT EXISTS idx_fno_instruments_master_expiry_date ON public.fno_instruments_master(expiry_date);

ALTER TABLE public.fno_instruments_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fno_instruments_master_public_read" ON public.fno_instruments_master;
CREATE POLICY "fno_instruments_master_public_read" ON public.fno_instruments_master
  FOR SELECT USING (true);

-- ─── User recent views ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_recent_views (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  symbol         TEXT NOT NULL,
  yahoo_symbol   TEXT NOT NULL,
  company_name   TEXT,
  asset_type     TEXT NOT NULL CHECK (asset_type IN ('EQUITY', 'ETF', 'INDEX', 'MUTUAL_FUND', 'FNO', 'COMMODITY', 'CRYPTO')),
  source_page    TEXT,
  view_count     INTEGER NOT NULL DEFAULT 1,
  last_viewed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, yahoo_symbol, asset_type)
);

CREATE INDEX IF NOT EXISTS idx_user_recent_views_user_id ON public.user_recent_views(user_id);
CREATE INDEX IF NOT EXISTS idx_user_recent_views_last_viewed_at ON public.user_recent_views(user_id, last_viewed_at DESC);

ALTER TABLE public.user_recent_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_recent_views_own" ON public.user_recent_views;
CREATE POLICY "user_recent_views_own" ON public.user_recent_views
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── Mutual fund SIP plans ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_mutual_fund_sips (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  scheme_code     TEXT NOT NULL,
  scheme_name     TEXT NOT NULL,
  category        TEXT,
  amount          NUMERIC(18, 6) NOT NULL,
  deduction_day   INTEGER NOT NULL CHECK (deduction_day BETWEEN 1 AND 28),
  status          TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Paused', 'Cancelled', 'Completed')),
  next_payment_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, scheme_code, deduction_day)
);

CREATE INDEX IF NOT EXISTS idx_user_mutual_fund_sips_user_id ON public.user_mutual_fund_sips(user_id);
CREATE INDEX IF NOT EXISTS idx_user_mutual_fund_sips_status ON public.user_mutual_fund_sips(status);

ALTER TABLE public.user_mutual_fund_sips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_mutual_fund_sips_own" ON public.user_mutual_fund_sips;
CREATE POLICY "user_mutual_fund_sips_own" ON public.user_mutual_fund_sips
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── F&O watchlists ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_fno_watchlists (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_fno_watchlist_items (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  watchlist_id    UUID NOT NULL REFERENCES public.user_fno_watchlists(id) ON DELETE CASCADE,
  symbol          TEXT NOT NULL,
  yahoo_symbol    TEXT NOT NULL,
  company_name    TEXT,
  asset_type      TEXT NOT NULL DEFAULT 'FNO' CHECK (asset_type IN ('FNO', 'EQUITY', 'INDEX', 'ETF', 'MUTUAL_FUND', 'COMMODITY', 'CRYPTO')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(watchlist_id, yahoo_symbol)
);

CREATE INDEX IF NOT EXISTS idx_user_fno_watchlists_user_id ON public.user_fno_watchlists(user_id);
CREATE INDEX IF NOT EXISTS idx_user_fno_watchlist_items_watchlist_id ON public.user_fno_watchlist_items(watchlist_id);

ALTER TABLE public.user_fno_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_fno_watchlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_fno_watchlists_own" ON public.user_fno_watchlists;
CREATE POLICY "user_fno_watchlists_own" ON public.user_fno_watchlists
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_fno_watchlist_items_own" ON public.user_fno_watchlist_items;
CREATE POLICY "user_fno_watchlist_items_own" ON public.user_fno_watchlist_items
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.user_fno_watchlists w
      WHERE w.id = watchlist_id
        AND w.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_fno_watchlists w
      WHERE w.id = watchlist_id
        AND w.user_id = auth.uid()
    )
  );
