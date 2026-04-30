-- Enable UUID extension (already enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── users (synced with auth.users via trigger) ───────────────
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT,
  email       TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── holdings ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.holdings (
  id                UUID    DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id           UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  stock_symbol      TEXT    NOT NULL,
  company_name      TEXT,
  quantity          NUMERIC(18, 6) NOT NULL DEFAULT 0,
  average_buy_price NUMERIC(18, 6) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, stock_symbol)
);

CREATE INDEX IF NOT EXISTS idx_holdings_user_id ON public.holdings(user_id);

-- ─── transactions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id               UUID    DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  stock_symbol     TEXT    NOT NULL,
  transaction_type TEXT    NOT NULL CHECK (transaction_type IN ('BUY', 'SELL')),
  quantity         NUMERIC(18, 6) NOT NULL,
  price            NUMERIC(18, 6) NOT NULL,
  total_amount     NUMERIC(18, 6) NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_symbol  ON public.transactions(stock_symbol);

-- ─── watchlist ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.watchlist (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  stock_symbol TEXT NOT NULL,
  company_name TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, stock_symbol)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON public.watchlist(user_id);

-- ─── paper_wallet ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paper_wallet (
  id              UUID    DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  virtual_balance NUMERIC(18, 6) NOT NULL DEFAULT 100000.00,
  initial_balance NUMERIC(18, 6) NOT NULL DEFAULT 100000.00,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_paper_wallet_user_id ON public.paper_wallet(user_id);

-- ─── user_settings ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_settings (
  id               UUID    DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  theme            TEXT    DEFAULT 'dark',
  currency         TEXT    DEFAULT 'INR',
  refresh_interval INTEGER DEFAULT 10000,
  default_balance  NUMERIC(18, 6) DEFAULT 100000.00,
  notifications    BOOLEAN DEFAULT true,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ─── Non-breaking Column Migrations ──────────────────────────
ALTER TABLE public.holdings
  ADD COLUMN IF NOT EXISTS company_name TEXT;

ALTER TABLE public.watchlist
  ADD COLUMN IF NOT EXISTS company_name TEXT;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS default_balance NUMERIC(18, 6) DEFAULT 100000.00;

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- ─── Row-Level Security ───────────────────────────────────────
ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_wallet   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings  ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own row
DROP POLICY IF EXISTS "users_own_row" ON public.users;
CREATE POLICY "users_own_row" ON public.users
  FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "holdings_own" ON public.holdings;
CREATE POLICY "holdings_own" ON public.holdings
  FOR SELECT USING (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  );
DROP POLICY IF EXISTS "holdings_own_insert" ON public.holdings;
CREATE POLICY "holdings_own_insert" ON public.holdings
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  );
DROP POLICY IF EXISTS "holdings_own_update" ON public.holdings;
CREATE POLICY "holdings_own_update" ON public.holdings
  FOR UPDATE USING (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  ) WITH CHECK (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  );
DROP POLICY IF EXISTS "holdings_own_delete" ON public.holdings;
CREATE POLICY "holdings_own_delete" ON public.holdings
  FOR DELETE USING (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  );

DROP POLICY IF EXISTS "transactions_own" ON public.transactions;
CREATE POLICY "transactions_own" ON public.transactions
  FOR SELECT USING (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  );
DROP POLICY IF EXISTS "transactions_own_insert" ON public.transactions;
CREATE POLICY "transactions_own_insert" ON public.transactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  );
DROP POLICY IF EXISTS "transactions_own_update" ON public.transactions;
CREATE POLICY "transactions_own_update" ON public.transactions
  FOR UPDATE USING (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  ) WITH CHECK (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  );
DROP POLICY IF EXISTS "transactions_own_delete" ON public.transactions;
CREATE POLICY "transactions_own_delete" ON public.transactions
  FOR DELETE USING (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  );

DROP POLICY IF EXISTS "watchlist_own" ON public.watchlist;
CREATE POLICY "watchlist_own" ON public.watchlist
  FOR SELECT USING (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  );
DROP POLICY IF EXISTS "watchlist_own_insert" ON public.watchlist;
CREATE POLICY "watchlist_own_insert" ON public.watchlist
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  );

DROP POLICY IF EXISTS "watchlist_own_update" ON public.watchlist;
CREATE POLICY "watchlist_own_update" ON public.watchlist
  FOR UPDATE USING (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  ) WITH CHECK (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  );
DROP POLICY IF EXISTS "watchlist_own_delete" ON public.watchlist;
CREATE POLICY "watchlist_own_delete" ON public.watchlist
  FOR DELETE USING (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  );

DROP POLICY IF EXISTS "paper_wallet_own" ON public.paper_wallet;
CREATE POLICY "paper_wallet_own" ON public.paper_wallet
  FOR SELECT USING (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  );
DROP POLICY IF EXISTS "paper_wallet_own_insert" ON public.paper_wallet;
CREATE POLICY "paper_wallet_own_insert" ON public.paper_wallet
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  );
DROP POLICY IF EXISTS "paper_wallet_own_update" ON public.paper_wallet;
CREATE POLICY "paper_wallet_own_update" ON public.paper_wallet
  FOR UPDATE USING (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  ) WITH CHECK (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  );
DROP POLICY IF EXISTS "paper_wallet_own_delete" ON public.paper_wallet;
CREATE POLICY "paper_wallet_own_delete" ON public.paper_wallet
  FOR DELETE USING (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  );

DROP POLICY IF EXISTS "user_settings_own" ON public.user_settings;
CREATE POLICY "user_settings_own" ON public.user_settings
  FOR SELECT USING (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  );
DROP POLICY IF EXISTS "user_settings_own_insert" ON public.user_settings;
CREATE POLICY "user_settings_own_insert" ON public.user_settings
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  );

DROP POLICY IF EXISTS "user_settings_own_update" ON public.user_settings;
CREATE POLICY "user_settings_own_update" ON public.user_settings
  FOR UPDATE USING (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  ) WITH CHECK (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  );
DROP POLICY IF EXISTS "user_settings_own_delete" ON public.user_settings;
CREATE POLICY "user_settings_own_delete" ON public.user_settings
  FOR DELETE USING (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000001'::uuid
  );

-- ─── Trigger: sync auth.users → public.users ─────────────────
-- Create function to handle new user signup
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    name = COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    email = NEW.email;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create default user_settings when user signs up
DROP FUNCTION IF EXISTS public.create_user_settings() CASCADE;
CREATE FUNCTION public.create_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id, theme, currency, refresh_interval, default_balance, notifications)
  VALUES (NEW.id, 'dark', 'INR', 10000, 100000.00, true)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to initialize settings
DROP TRIGGER IF EXISTS on_user_created_settings ON public.users;
CREATE TRIGGER on_user_created_settings
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_settings();

-- Create default paper wallet when user signs up
DROP FUNCTION IF EXISTS public.create_paper_wallet() CASCADE;
CREATE FUNCTION public.create_paper_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.paper_wallet (user_id, virtual_balance, initial_balance)
  VALUES (NEW.id, 100000.00, 100000.00)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to initialize wallet
DROP TRIGGER IF EXISTS on_user_created_wallet ON public.users;
CREATE TRIGGER on_user_created_wallet
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_paper_wallet();

-- ─── Enable Realtime for all tables ──────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'holdings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.holdings;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'transactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'watchlist') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.watchlist;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'paper_wallet') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.paper_wallet;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_settings;
  END IF;
END $$;

-- ─── stocks_master (Global Search) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.stocks_master (
  symbol TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  exchange TEXT NOT NULL,
  yahoo_symbol TEXT NOT NULL,
  sector TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optimize search with indices
CREATE INDEX IF NOT EXISTS idx_stocks_master_symbol ON public.stocks_master(symbol);
CREATE INDEX IF NOT EXISTS idx_stocks_master_company_name ON public.stocks_master(company_name);

-- Public read access
ALTER TABLE public.stocks_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Access" ON public.stocks_master;
CREATE POLICY "Public Read Access" ON public.stocks_master
  FOR SELECT USING (true);
