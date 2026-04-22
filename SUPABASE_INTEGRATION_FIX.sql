-- SPMS integration + RLS hardening patch
-- Does NOT recreate tables.

-- 1) Strict user-only RLS policies (remove legacy demo user bypass)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['holdings','transactions','watchlist','paper_wallet','user_settings','user_recent_views','user_mutual_fund_sips','user_fno_watchlists','user_fno_watchlist_items']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON public.%I', t, t);

    EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT USING (auth.uid() = user_id)', t, t);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)', t, t);
    EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t, t);
    EXECUTE format('CREATE POLICY %I_delete ON public.%I FOR DELETE USING (auth.uid() = user_id)', t, t);
  END LOOP;
END $$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_own_row ON public.users;
CREATE POLICY users_own_row ON public.users
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

ALTER TABLE public.stocks_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stocks_master_public_read ON public.stocks_master;
CREATE POLICY stocks_master_public_read ON public.stocks_master
  FOR SELECT
  USING (true);

-- 2) Atomic trade execution to keep wallet/transactions/holdings consistent
CREATE OR REPLACE FUNCTION public.execute_paper_trade(
  p_symbol TEXT,
  p_transaction_type TEXT,
  p_quantity NUMERIC,
  p_price NUMERIC,
  p_asset_currency TEXT DEFAULT 'INR',
  p_fx_rate_to_inr NUMERIC DEFAULT 1,
  p_company_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_type TEXT := upper(trim(coalesce(p_transaction_type, '')));
  v_qty NUMERIC := coalesce(p_quantity, 0);
  v_price NUMERIC := coalesce(p_price, 0);
  v_fx NUMERIC := CASE WHEN upper(coalesce(p_asset_currency, 'INR')) = 'INR' THEN 1 ELSE coalesce(p_fx_rate_to_inr, 1) END;
  v_total NUMERIC;
  v_wallet NUMERIC;
  v_new_wallet NUMERIC;
  v_holding holdings%ROWTYPE;
  v_new_qty NUMERIC;
  v_new_avg NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_type NOT IN ('BUY', 'SELL') THEN
    RAISE EXCEPTION 'Invalid transaction type %', v_type;
  END IF;

  IF v_qty <= 0 OR v_price <= 0 THEN
    RAISE EXCEPTION 'Quantity and price must be positive';
  END IF;

  v_total := v_qty * v_price * v_fx;

  SELECT * INTO v_holding
  FROM public.holdings
  WHERE user_id = v_user_id AND stock_symbol = p_symbol
  FOR UPDATE;

  SELECT virtual_balance INTO v_wallet
  FROM public.paper_wallet
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_wallet IS NULL THEN
    INSERT INTO public.paper_wallet (user_id, virtual_balance, initial_balance)
    VALUES (v_user_id, 100000.00, 100000.00)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT virtual_balance INTO v_wallet
    FROM public.paper_wallet
    WHERE user_id = v_user_id
    FOR UPDATE;
  END IF;

  IF v_type = 'BUY' THEN
    IF v_wallet < v_total THEN
      RAISE EXCEPTION 'Insufficient virtual balance';
    END IF;
    v_new_wallet := v_wallet - v_total;
  ELSE
    IF coalesce(v_holding.quantity, 0) < v_qty THEN
      RAISE EXCEPTION 'Cannot sell more shares than held';
    END IF;
    v_new_wallet := v_wallet + v_total;
  END IF;

  UPDATE public.paper_wallet
  SET virtual_balance = v_new_wallet,
      updated_at = now()
  WHERE user_id = v_user_id;

  INSERT INTO public.transactions (
    user_id, stock_symbol, transaction_type, quantity, price, total_amount
  ) VALUES (
    v_user_id, p_symbol, v_type, v_qty, v_price, v_total
  );

  IF v_type = 'BUY' THEN
    v_new_qty := coalesce(v_holding.quantity, 0) + v_qty;
    v_new_avg :=
      CASE
        WHEN coalesce(v_holding.quantity, 0) <= 0 THEN v_price
        ELSE ((v_holding.quantity * v_holding.average_buy_price) + (v_qty * v_price)) / v_new_qty
      END;

    INSERT INTO public.holdings (
      user_id, stock_symbol, company_name, quantity, average_buy_price
    ) VALUES (
      v_user_id,
      p_symbol,
      coalesce(p_company_name, p_symbol),
      v_new_qty,
      v_new_avg
    )
    ON CONFLICT (user_id, stock_symbol)
    DO UPDATE SET
      company_name = coalesce(excluded.company_name, holdings.company_name),
      quantity = excluded.quantity,
      average_buy_price = excluded.average_buy_price;
  ELSE
    v_new_qty := v_holding.quantity - v_qty;

    IF v_new_qty <= 0 THEN
      DELETE FROM public.holdings
      WHERE user_id = v_user_id AND stock_symbol = p_symbol;
    ELSE
      UPDATE public.holdings
      SET quantity = v_new_qty
      WHERE user_id = v_user_id AND stock_symbol = p_symbol;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', v_user_id,
    'symbol', p_symbol,
    'transaction_type', v_type,
    'wallet_balance', v_new_wallet
  );
END;
$$;
