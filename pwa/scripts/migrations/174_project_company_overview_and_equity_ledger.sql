-- 174_project_company_overview_and_equity_ledger.sql
--
-- 各 PJ の「会社概要」タブを、全 AMD メンバーが閲覧・編集できる正本にする。
-- 基本情報 / 株式イベント / J-KISS 等の潜在株式 / 年度決算を追加し、
-- 既存の株主・ラウンド・総会役会も authenticated member へ開放する。
--
-- destructive DDL は行わない。既存 project_shareholders は互換表示用に残し、
-- 現在行を新しい equity ledger の opening balance へ一度だけ backfill する。

-- ============================================================
-- 1. PJ 法人基本情報
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_company_profiles (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                  text NOT NULL UNIQUE REFERENCES public.projects(project_id),
  legal_status                text NOT NULL DEFAULT 'pre_incorporation',
  legal_name                  text,
  legal_name_en               text,
  corporate_number            text,
  entity_type                 text,
  incorporated_on             date,
  head_office                 text,
  business_purpose            text,
  representative_name         text,
  capital_yen                 bigint,
  authorized_shares           bigint,
  registered_issued_shares    numeric(24,6),
  board_structure             text,
  has_board                   boolean,
  has_auditor                 boolean,
  fiscal_year_end_month       integer,
  public_notice_method        text,
  invoice_registration_number text,
  source_ref                  text,
  source_verified_on          date,
  notes                       text,
  created_by_email            text,
  updated_by_email            text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_company_profiles_fiscal_month_check
    CHECK (fiscal_year_end_month IS NULL OR fiscal_year_end_month BETWEEN 1 AND 12)
);

-- ============================================================
-- 2. 株式イベント台帳
-- transaction = 1つの法的/資本イベント、entry = 株主・証券ごとの増減行。
-- outstanding_delta は顕在株、diluted_delta は完全希薄化後株式数への増減。
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_equity_transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       text NOT NULL REFERENCES public.projects(project_id),
  round_id         uuid REFERENCES public.project_valuation_rounds(id),
  effective_on     date NOT NULL,
  transaction_type text NOT NULL,
  description      text,
  status           text NOT NULL DEFAULT 'confirmed',
  source_ref       text,
  notes            text,
  created_by_email text,
  updated_by_email text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_equity_transactions_status_check
    CHECK (status IN ('planned', 'confirmed', 'void'))
);

CREATE UNIQUE INDEX IF NOT EXISTS project_equity_transactions_source_uniq
  ON public.project_equity_transactions(project_id, source_ref)
  WHERE source_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS project_equity_transactions_project_date_idx
  ON public.project_equity_transactions(project_id, effective_on, created_at);

CREATE TABLE IF NOT EXISTS public.project_equity_entries (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id        uuid NOT NULL REFERENCES public.project_equity_transactions(id) ON DELETE CASCADE,
  project_id            text NOT NULL REFERENCES public.projects(project_id),
  holder_type           text,
  holder_name           text NOT NULL,
  security_class        text NOT NULL DEFAULT '普通株式',
  outstanding_delta     numeric(24,6) NOT NULL DEFAULT 0,
  diluted_delta         numeric(24,6) NOT NULL DEFAULT 0,
  paid_in_yen_delta     bigint NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_equity_entries_project_idx
  ON public.project_equity_entries(project_id, holder_name, security_class);
CREATE INDEX IF NOT EXISTS project_equity_entries_transaction_idx
  ON public.project_equity_entries(transaction_id);

-- ============================================================
-- 3. J-KISS / SAFE / CB 等の転換前証券
-- 現在の普通株比率には混ぜず、転換シナリオでのみ estimated_conversion_shares を使う。
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_convertible_instruments (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                  text NOT NULL REFERENCES public.projects(project_id),
  round_id                    uuid REFERENCES public.project_valuation_rounds(id),
  holder_name                 text NOT NULL,
  instrument_type             text NOT NULL DEFAULT 'J-KISS',
  issued_on                   date,
  principal_yen               bigint,
  valuation_cap_yen           bigint,
  discount_rate               numeric(8,6),
  conversion_trigger          text,
  maturity_on                 date,
  estimated_conversion_price  numeric,
  estimated_conversion_shares numeric(24,6),
  status                      text NOT NULL DEFAULT 'outstanding',
  source_ref                  text,
  notes                       text,
  created_by_email            text,
  updated_by_email            text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_convertible_discount_check
    CHECK (discount_rate IS NULL OR (discount_rate >= 0 AND discount_rate <= 1))
);

CREATE INDEX IF NOT EXISTS project_convertible_instruments_project_idx
  ON public.project_convertible_instruments(project_id, issued_on);

-- ============================================================
-- 4. 法定/確定年度決算サマリ
-- project_pl_monthly (月次計画/経営 PL) とは混ぜない。
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_financial_periods (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            text NOT NULL REFERENCES public.projects(project_id),
  fiscal_year           integer NOT NULL,
  period_start_on       date,
  period_end_on         date,
  statement_status      text NOT NULL DEFAULT 'draft',
  revenue_yen           bigint,
  operating_income_yen  bigint,
  ordinary_income_yen   bigint,
  net_income_yen        bigint,
  total_assets_yen      bigint,
  total_liabilities_yen bigint,
  net_assets_yen        bigint,
  cash_yen              bigint,
  debt_yen              bigint,
  filed_on              date,
  source_ref            text,
  notes                 text,
  created_by_email      text,
  updated_by_email      text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, fiscal_year)
);

CREATE INDEX IF NOT EXISTS project_financial_periods_project_idx
  ON public.project_financial_periods(project_id, fiscal_year DESC);

-- ============================================================
-- 5. AMD member 権限
-- 全 PJ の会社概要を全 AMD メンバーが見て、自分で作れることがまさ確定仕様。
-- ただし「ログイン済みなら誰でも」ではなく、members テーブルに登録された
-- AMD メンバー本人に限定する（project_documents と同様の gate 関数方式）。
-- ============================================================
CREATE OR REPLACE FUNCTION public.amd_os_is_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE lower(m.email) = lower(auth.email())
  );
$$;

REVOKE ALL ON FUNCTION public.amd_os_is_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.amd_os_is_member() TO authenticated;

ALTER TABLE public.project_company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_equity_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_equity_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_convertible_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_financial_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_company_profiles_members" ON public.project_company_profiles;
CREATE POLICY "project_company_profiles_members" ON public.project_company_profiles
  FOR ALL TO authenticated USING (public.amd_os_is_member()) WITH CHECK (public.amd_os_is_member());
DROP POLICY IF EXISTS "project_company_profiles_service" ON public.project_company_profiles;
CREATE POLICY "project_company_profiles_service" ON public.project_company_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "project_equity_transactions_members" ON public.project_equity_transactions;
CREATE POLICY "project_equity_transactions_members" ON public.project_equity_transactions
  FOR ALL TO authenticated USING (public.amd_os_is_member()) WITH CHECK (public.amd_os_is_member());
DROP POLICY IF EXISTS "project_equity_transactions_service" ON public.project_equity_transactions;
CREATE POLICY "project_equity_transactions_service" ON public.project_equity_transactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "project_equity_entries_members" ON public.project_equity_entries;
CREATE POLICY "project_equity_entries_members" ON public.project_equity_entries
  FOR ALL TO authenticated USING (public.amd_os_is_member()) WITH CHECK (public.amd_os_is_member());
DROP POLICY IF EXISTS "project_equity_entries_service" ON public.project_equity_entries;
CREATE POLICY "project_equity_entries_service" ON public.project_equity_entries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "project_convertible_instruments_members" ON public.project_convertible_instruments;
CREATE POLICY "project_convertible_instruments_members" ON public.project_convertible_instruments
  FOR ALL TO authenticated USING (public.amd_os_is_member()) WITH CHECK (public.amd_os_is_member());
DROP POLICY IF EXISTS "project_convertible_instruments_service" ON public.project_convertible_instruments;
CREATE POLICY "project_convertible_instruments_service" ON public.project_convertible_instruments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "project_financial_periods_members" ON public.project_financial_periods;
CREATE POLICY "project_financial_periods_members" ON public.project_financial_periods
  FOR ALL TO authenticated USING (public.amd_os_is_member()) WITH CHECK (public.amd_os_is_member());
DROP POLICY IF EXISTS "project_financial_periods_service" ON public.project_financial_periods;
CREATE POLICY "project_financial_periods_service" ON public.project_financial_periods
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 既存の cap table / round / 総会役会も全 AMD メンバーへ開放する（ログインのみでは不可）。
DROP POLICY IF EXISTS "project_shareholders_members" ON public.project_shareholders;
CREATE POLICY "project_shareholders_members" ON public.project_shareholders
  FOR ALL TO authenticated USING (public.amd_os_is_member()) WITH CHECK (public.amd_os_is_member());
DROP POLICY IF EXISTS "project_valuation_rounds_members" ON public.project_valuation_rounds;
CREATE POLICY "project_valuation_rounds_members" ON public.project_valuation_rounds
  FOR ALL TO authenticated USING (public.amd_os_is_member()) WITH CHECK (public.amd_os_is_member());
DROP POLICY IF EXISTS "project_shareholder_meetings_members" ON public.project_shareholder_meetings;
CREATE POLICY "project_shareholder_meetings_members" ON public.project_shareholder_meetings
  FOR ALL TO authenticated USING (public.amd_os_is_member()) WITH CHECK (public.amd_os_is_member());

-- ============================================================
-- 6. 既存 current snapshot を opening balance へ非破壊 backfill
-- ============================================================
WITH latest_snapshot AS (
  SELECT project_id, max(as_of_ym) AS as_of_ym
  FROM public.project_shareholders
  WHERE is_current IS DISTINCT FROM false AND shares IS NOT NULL
  GROUP BY project_id
)
INSERT INTO public.project_equity_transactions (
  project_id, effective_on, transaction_type, description, status, source_ref, created_by_email
)
SELECT
  latest.project_id,
  CASE
    WHEN latest.as_of_ym ~ '^[0-9]{6}$' THEN to_date(latest.as_of_ym || '01', 'YYYYMMDD')
    ELSE current_date
  END,
  'opening_balance',
  '既存 cap table から移行した開始残高',
  'confirmed',
  'migration:project_shareholders:opening',
  'migration_174'
FROM latest_snapshot latest
ON CONFLICT DO NOTHING;

WITH latest_snapshot AS (
  SELECT project_id, max(as_of_ym) AS as_of_ym
  FROM public.project_shareholders
  WHERE is_current IS DISTINCT FROM false AND shares IS NOT NULL
  GROUP BY project_id
), source_rows AS (
  SELECT s.*
  FROM public.project_shareholders s
  JOIN latest_snapshot latest
    ON latest.project_id = s.project_id
   AND (s.as_of_ym = latest.as_of_ym OR (s.as_of_ym IS NULL AND latest.as_of_ym IS NULL))
  WHERE s.is_current IS DISTINCT FROM false AND s.shares IS NOT NULL
)
INSERT INTO public.project_equity_entries (
  transaction_id, project_id, holder_type, holder_name, security_class,
  outstanding_delta, diluted_delta, paid_in_yen_delta
)
SELECT
  tx.id,
  s.project_id,
  s.holder_type,
  s.holder_name,
  coalesce(s.share_class, '普通株式'),
  s.shares,
  s.shares,
  coalesce(s.invested_yen, 0)
FROM source_rows s
JOIN public.project_equity_transactions tx
  ON tx.project_id = s.project_id
 AND tx.source_ref = 'migration:project_shareholders:opening'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.project_equity_entries e
  WHERE e.transaction_id = tx.id
    AND e.holder_name = s.holder_name
    AND e.security_class = coalesce(s.share_class, '普通株式')
);
