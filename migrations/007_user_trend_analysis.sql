-- User Trend Analysis Preferences Migration
-- Persists per-user Trend Analysis page data (watchlist + hidden holdings)

CREATE TABLE IF NOT EXISTS public.user_trend_watchlist (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  display_name text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_trend_watchlist_pkey PRIMARY KEY (id),
  CONSTRAINT user_trend_watchlist_user_symbol_key UNIQUE (user_id, symbol),
  CONSTRAINT user_trend_watchlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_user_trend_watchlist_user_id
  ON public.user_trend_watchlist USING btree (user_id) TABLESPACE pg_default;

ALTER TABLE public.user_trend_watchlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_trend_watchlist_own" ON public.user_trend_watchlist;
CREATE POLICY "user_trend_watchlist_own" ON public.user_trend_watchlist
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_trend_hidden_holdings (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_trend_hidden_holdings_pkey PRIMARY KEY (id),
  CONSTRAINT user_trend_hidden_holdings_user_symbol_key UNIQUE (user_id, symbol),
  CONSTRAINT user_trend_hidden_holdings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_user_trend_hidden_holdings_user_id
  ON public.user_trend_hidden_holdings USING btree (user_id) TABLESPACE pg_default;

ALTER TABLE public.user_trend_hidden_holdings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_trend_hidden_holdings_own" ON public.user_trend_hidden_holdings;
CREATE POLICY "user_trend_hidden_holdings_own" ON public.user_trend_hidden_holdings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
