-- User Recent Views Table Migration
-- This table stores the recently viewed stocks for each user

CREATE TABLE IF NOT EXISTS public.user_recent_views (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  symbol text not null,
  yahoo_symbol text not null,
  company_name text null,
  asset_type text not null,
  source_page text null,
  view_count integer not null default 1,
  last_viewed_at timestamp with time zone null default now(),
  created_at timestamp with time zone null default now(),
  constraint user_recent_views_pkey primary key (id),
  constraint user_recent_views_user_id_yahoo_symbol_asset_type_key unique (user_id, yahoo_symbol, asset_type),
  constraint user_recent_views_user_id_fkey foreign key (user_id) references users (id) on delete CASCADE,
  constraint user_recent_views_asset_type_check check (
    (
      asset_type = any (
        array[
          'EQUITY'::text,
          'ETF'::text,
          'INDEX'::text,
          'MUTUAL_FUND'::text,
          'FNO'::text,
          'COMMODITY'::text,
          'CRYPTO'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_user_recent_views_user_id on public.user_recent_views using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_user_recent_views_last_viewed_at on public.user_recent_views using btree (user_id, last_viewed_at desc) TABLESPACE pg_default;

-- Enable RLS
ALTER TABLE public.user_recent_views ENABLE ROW LEVEL SECURITY;

-- Create RLS Policy
DROP POLICY IF EXISTS "user_recent_views_own" ON public.user_recent_views;
CREATE POLICY "user_recent_views_own" ON public.user_recent_views
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
