-- 176_company_payment_obligations.sql
--
-- 法人の支払義務を、通知と月次資金繰りが共有する正本として管理する。
-- 金額・期日が未確定の候補も needs_review で保持し、見落としを防ぐ。

CREATE TABLE IF NOT EXISTS public.company_payment_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  counterparty TEXT,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('tax', 'social_insurance', 'payroll', 'reimbursement', 'reward', 'invoice', 'subscription', 'loan', 'other')),
  amount_yen BIGINT CHECK (amount_yen IS NULL OR amount_yen >= 0),
  amount_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (amount_status IN ('exact', 'estimated', 'unknown')),
  due_date DATE,
  due_date_precision TEXT NOT NULL DEFAULT 'unknown'
    CHECK (due_date_precision IN ('day', 'month', 'unknown')),
  expected_payment_ym TEXT CHECK (expected_payment_ym IS NULL OR expected_payment_ym ~ '^[0-9]{6}$'),
  status TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (status IN ('needs_review', 'open', 'scheduled', 'paid', 'cancelled')),
  cashflow_treatment TEXT NOT NULL DEFAULT 'additive'
    CHECK (cashflow_treatment IN ('additive', 'included_in_budget')),
  budget_category TEXT,
  auto_debit BOOLEAN,
  owner_member_id TEXT REFERENCES public.members(member_id) ON DELETE SET NULL,
  source_kind TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.500
    CHECK (confidence >= 0 AND confidence <= 1),
  paid_at TIMESTAMPTZ,
  paid_amount_yen BIGINT CHECK (paid_amount_yen IS NULL OR paid_amount_yen >= 0),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT company_payment_obligations_due_precision_check
    CHECK (due_date_precision <> 'day' OR due_date IS NOT NULL),
  CONSTRAINT company_payment_obligations_amount_presence_check
    CHECK (amount_status = 'unknown' OR amount_yen IS NOT NULL),
  CONSTRAINT company_payment_obligations_paid_check
    CHECK (status <> 'paid' OR paid_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS company_payment_obligations_schedule_idx
  ON public.company_payment_obligations(status, expected_payment_ym, due_date);
CREATE INDEX IF NOT EXISTS company_payment_obligations_review_idx
  ON public.company_payment_obligations(status, updated_at DESC)
  WHERE status = 'needs_review';
CREATE INDEX IF NOT EXISTS company_payment_obligations_source_idx
  ON public.company_payment_obligations(source_kind, source_ref);

CREATE TABLE IF NOT EXISTS public.company_payment_obligation_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id UUID NOT NULL REFERENCES public.company_payment_obligations(id) ON DELETE CASCADE,
  recipient_member_id TEXT REFERENCES public.members(member_id) ON DELETE SET NULL,
  recipient_slack_id TEXT NOT NULL,
  schedule_key TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  slack_channel_id TEXT,
  slack_ts TEXT,
  error_message TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (obligation_id, recipient_slack_id, schedule_key, stage)
);

CREATE INDEX IF NOT EXISTS company_payment_obligation_notifications_status_idx
  ON public.company_payment_obligation_notifications(status, attempted_at DESC);

ALTER TABLE public.company_payment_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_payment_obligation_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_payment_obligations_admin_all ON public.company_payment_obligations;
CREATE POLICY company_payment_obligations_admin_all
  ON public.company_payment_obligations
  FOR ALL TO authenticated
  USING (public.amd_os_current_user_is_admin())
  WITH CHECK (public.amd_os_current_user_is_admin());
DROP POLICY IF EXISTS company_payment_obligations_service_all ON public.company_payment_obligations;
CREATE POLICY company_payment_obligations_service_all
  ON public.company_payment_obligations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS company_payment_obligation_notifications_admin_all ON public.company_payment_obligation_notifications;
CREATE POLICY company_payment_obligation_notifications_admin_all
  ON public.company_payment_obligation_notifications
  FOR ALL TO authenticated
  USING (public.amd_os_current_user_is_admin())
  WITH CHECK (public.amd_os_current_user_is_admin());
DROP POLICY IF EXISTS company_payment_obligation_notifications_service_all ON public.company_payment_obligation_notifications;
CREATE POLICY company_payment_obligation_notifications_service_all
  ON public.company_payment_obligation_notifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.company_payment_obligations FROM anon;
REVOKE ALL ON public.company_payment_obligation_notifications FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_payment_obligations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_payment_obligation_notifications TO authenticated, service_role;
