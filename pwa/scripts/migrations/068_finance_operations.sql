-- 068_finance_operations.sql
-- Admin finance control sheet for recurring costs, subscriptions, auto debit,
-- and receipt events that can later sync into actuals/budget forward-fill.

CREATE OR REPLACE FUNCTION public.amd_os_current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND m.is_admin IS TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.amd_os_current_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.amd_os_current_user_is_admin() TO authenticated;

CREATE TABLE IF NOT EXISTS public.company_finance_recurring_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  item_kind TEXT NOT NULL DEFAULT 'subscription' CHECK (item_kind IN ('subscription', 'fixed_cost', 'tax', 'salary', 'loan', 'other')),
  display_name TEXT NOT NULL,
  vendor_name TEXT,
  category TEXT NOT NULL DEFAULT 'fixed_cost',
  amount_yen BIGINT NOT NULL DEFAULT 0 CHECK (amount_yen >= 0),
  currency TEXT NOT NULL DEFAULT 'JPY',
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'annual', 'one_time', 'unknown')),
  start_ym TEXT NOT NULL CHECK (start_ym ~ '^[0-9]{6}$'),
  end_ym TEXT CHECK (end_ym IS NULL OR end_ym ~ '^[0-9]{6}$'),
  budget_forward_fill BOOLEAN NOT NULL DEFAULT false,
  auto_debit BOOLEAN,
  withdrawal_account TEXT,
  payment_method TEXT,
  source_kind TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT,
  next_expected_ym TEXT CHECK (next_expected_ym IS NULL OR next_expected_ym ~ '^[0-9]{6}$'),
  last_receipt_at TIMESTAMPTZ,
  last_budget_synced_at TIMESTAMPTZ,
  notes TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS cfr_items_source_ref_uniq
  ON public.company_finance_recurring_items(source_kind, source_ref);
CREATE INDEX IF NOT EXISTS cfr_items_status_idx
  ON public.company_finance_recurring_items(status, item_kind, auto_debit);
CREATE INDEX IF NOT EXISTS cfr_items_start_ym_idx
  ON public.company_finance_recurring_items(start_ym DESC);

CREATE TABLE IF NOT EXISTS public.company_finance_receipt_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_item_id UUID REFERENCES public.company_finance_recurring_items(id) ON DELETE SET NULL,
  ym TEXT CHECK (ym IS NULL OR ym ~ '^[0-9]{6}$'),
  receipt_date DATE,
  vendor_name TEXT,
  amount_yen BIGINT CHECK (amount_yen IS NULL OR amount_yen >= 0),
  currency TEXT NOT NULL DEFAULT 'JPY',
  payment_method TEXT,
  withdrawal_account TEXT,
  subject TEXT,
  source_kind TEXT NOT NULL DEFAULT 'gmail',
  source_ref TEXT,
  raw_hash TEXT,
  attachment_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  actual_synced_at TIMESTAMPTZ,
  budget_suggestion JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'confirmed', 'synced', 'ignored', 'archived')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS cfr_receipts_raw_hash_uniq
  ON public.company_finance_receipt_events(raw_hash)
  WHERE raw_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS cfr_receipts_ym_idx
  ON public.company_finance_receipt_events(ym DESC, status);
CREATE INDEX IF NOT EXISTS cfr_receipts_item_idx
  ON public.company_finance_receipt_events(recurring_item_id, receipt_date DESC);

ALTER TABLE public.company_finance_recurring_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_finance_receipt_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cfr_items_select_admin ON public.company_finance_recurring_items;
CREATE POLICY cfr_items_select_admin
  ON public.company_finance_recurring_items
  FOR SELECT
  TO authenticated
  USING (public.amd_os_current_user_is_admin());
DROP POLICY IF EXISTS cfr_items_insert_admin ON public.company_finance_recurring_items;
CREATE POLICY cfr_items_insert_admin
  ON public.company_finance_recurring_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.amd_os_current_user_is_admin());
DROP POLICY IF EXISTS cfr_items_update_admin ON public.company_finance_recurring_items;
CREATE POLICY cfr_items_update_admin
  ON public.company_finance_recurring_items
  FOR UPDATE
  TO authenticated
  USING (public.amd_os_current_user_is_admin())
  WITH CHECK (public.amd_os_current_user_is_admin());
DROP POLICY IF EXISTS cfr_items_delete_admin ON public.company_finance_recurring_items;
CREATE POLICY cfr_items_delete_admin
  ON public.company_finance_recurring_items
  FOR DELETE
  TO authenticated
  USING (public.amd_os_current_user_is_admin());
DROP POLICY IF EXISTS cfr_items_service_role_all ON public.company_finance_recurring_items;
CREATE POLICY cfr_items_service_role_all
  ON public.company_finance_recurring_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS cfr_receipts_select_admin ON public.company_finance_receipt_events;
CREATE POLICY cfr_receipts_select_admin
  ON public.company_finance_receipt_events
  FOR SELECT
  TO authenticated
  USING (public.amd_os_current_user_is_admin());
DROP POLICY IF EXISTS cfr_receipts_insert_admin ON public.company_finance_receipt_events;
CREATE POLICY cfr_receipts_insert_admin
  ON public.company_finance_receipt_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.amd_os_current_user_is_admin());
DROP POLICY IF EXISTS cfr_receipts_update_admin ON public.company_finance_receipt_events;
CREATE POLICY cfr_receipts_update_admin
  ON public.company_finance_receipt_events
  FOR UPDATE
  TO authenticated
  USING (public.amd_os_current_user_is_admin())
  WITH CHECK (public.amd_os_current_user_is_admin());
DROP POLICY IF EXISTS cfr_receipts_delete_admin ON public.company_finance_receipt_events;
CREATE POLICY cfr_receipts_delete_admin
  ON public.company_finance_receipt_events
  FOR DELETE
  TO authenticated
  USING (public.amd_os_current_user_is_admin());
DROP POLICY IF EXISTS cfr_receipts_service_role_all ON public.company_finance_receipt_events;
CREATE POLICY cfr_receipts_service_role_all
  ON public.company_finance_receipt_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.company_finance_recurring_items FROM anon;
REVOKE ALL ON public.company_finance_receipt_events FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_finance_recurring_items TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_finance_receipt_events TO authenticated, service_role;

INSERT INTO public.company_finance_recurring_items (
  status,
  item_kind,
  display_name,
  vendor_name,
  category,
  amount_yen,
  frequency,
  start_ym,
  end_ym,
  budget_forward_fill,
  auto_debit,
  source_kind,
  source_ref,
  notes,
  payload
)
SELECT
  'active',
  CASE
    WHEN lower(label) IN ('co-en', 'conduct', 'slack', 'claude', 'notion', 'freee', 'docusign', 'microsoft') THEN 'subscription'
    ELSE 'fixed_cost'
  END,
  label,
  label,
  'fixed_cost',
  amount_yen,
  'monthly',
  COALESCE(ym, payload ->> 'startYm', '202601'),
  NULLIF(payload ->> 'endYm', ''),
  false,
  NULL,
  'gas_monthly_pl',
  'gas_monthly_pl:fixed_cost:' || source_id || ':' || version,
  'Seeded from company_budget_inputs. budget_forward_fill is off because GAS monthly PL already carries this baseline.',
  jsonb_build_object(
    'budgetInputId', id,
    'sourceVersion', version,
    'sourcePayload', payload
  )
FROM public.company_budget_inputs
WHERE input_kind = 'fixed_cost'
  AND source = 'gas_monthly_pl'
  AND amount_yen IS NOT NULL
ON CONFLICT (source_kind, source_ref) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  vendor_name = EXCLUDED.vendor_name,
  amount_yen = EXCLUDED.amount_yen,
  start_ym = EXCLUDED.start_ym,
  end_ym = EXCLUDED.end_ym,
  payload = EXCLUDED.payload,
  updated_at = NOW();

COMMENT ON TABLE public.company_finance_recurring_items IS
  'Admin-only finance control sheet for subscriptions, fixed recurring costs, auto debit, withdrawal account, and budget forward-fill decisions.';
COMMENT ON TABLE public.company_finance_receipt_events IS
  'Admin-only receipt events from Gmail/freee/manual sources. Confirmed events can sync actuals and suggest recurring budget rows.';
