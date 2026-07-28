-- 199_legacy_reward_payout_amount_override_events.sql
-- ポイント制移行前 (2026年6月以前) の事前合意額を、支払通知書/支払snapshotにだけ固定する。
-- reward_summary_json・MS・stock/carry・将来月の差額精算には書き戻さない。

CREATE TABLE IF NOT EXISTS public.legacy_reward_payout_amount_override_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_key text NOT NULL UNIQUE,
  project_id text NOT NULL REFERENCES public.projects(project_id),
  source_ym text NOT NULL CHECK (source_ym ~ '^[0-9]{6}$' AND source_ym <= '202606'),
  member_id text NOT NULL REFERENCES public.members(member_id),
  action text NOT NULL CHECK (action IN ('set', 'clear')),
  amount_yen bigint NULL CHECK (amount_yen IS NULL OR amount_yen >= 0),
  reason text NOT NULL CHECK (length(trim(reason)) >= 8),
  authorized_by text NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (action = 'set' AND amount_yen IS NOT NULL)
    OR (action = 'clear' AND amount_yen IS NULL)
  )
);

COMMENT ON TABLE public.legacy_reward_payout_amount_override_events IS
  '2026年6月以前の旧制度月について、事前合意済み税抜額を支払snapshot/PDFにだけ適用するappend-only監査イベント。最新idのset/clearが対象member×PJ×稼働月に効く。';
COMMENT ON COLUMN public.legacy_reward_payout_amount_override_events.amount_yen IS
  '支払通知書とmonthly_reward_payoutへ同期する税抜額。reward_summary_jsonや将来carryには書き戻さない。';
COMMENT ON COLUMN public.legacy_reward_payout_amount_override_events.event_key IS
  '同じ承認イベントの重複投入を防ぐ冪等キー。';

CREATE INDEX IF NOT EXISTS idx_legacy_reward_payout_amount_override_target
  ON public.legacy_reward_payout_amount_override_events(project_id, source_ym, member_id, id DESC);

ALTER TABLE public.legacy_reward_payout_amount_override_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'legacy_reward_payout_amount_override_events'
      AND policyname = 'legacy_reward_payout_amount_override_admin_select'
  ) THEN
    CREATE POLICY legacy_reward_payout_amount_override_admin_select
      ON public.legacy_reward_payout_amount_override_events
      FOR SELECT TO authenticated
      USING (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'legacy_reward_payout_amount_override_events'
      AND policyname = 'legacy_reward_payout_amount_override_admin_insert'
  ) THEN
    CREATE POLICY legacy_reward_payout_amount_override_admin_insert
      ON public.legacy_reward_payout_amount_override_events
      FOR INSERT TO authenticated
      WITH CHECK (is_admin());
  END IF;
END $$;

INSERT INTO public.legacy_reward_payout_amount_override_events (
  event_key,
  project_id,
  source_ym,
  member_id,
  action,
  amount_yen,
  reason,
  authorized_by,
  metadata_json
)
VALUES
  (
    'zmp-202606-ID004-prior-agreement-20260728',
    'p19', '202606', 'ID004', 'set', 0,
    'ポイント制移行前に事前合意した2026年6月稼働分の税抜額を固定する',
    'masa',
    '{"payment_ym":"202607","tax_basis":"tax_exclusive","scope":"payout_notice_only"}'::jsonb
  ),
  (
    'zmp-202606-ID009-prior-agreement-20260728',
    'p19', '202606', 'ID009', 'set', 40000,
    'ポイント制移行前に事前合意した2026年6月稼働分の税抜額を固定する',
    'masa',
    '{"payment_ym":"202607","tax_basis":"tax_exclusive","scope":"payout_notice_only"}'::jsonb
  ),
  (
    'zmp-202606-ID008-prior-agreement-20260728',
    'p19', '202606', 'ID008', 'set', 5000,
    'ポイント制移行前に事前合意した2026年6月稼働分の税抜額を固定する',
    'masa',
    '{"payment_ym":"202607","tax_basis":"tax_exclusive","scope":"payout_notice_only"}'::jsonb
  ),
  (
    'zmp-202606-ID026-prior-agreement-20260728',
    'p19', '202606', 'ID026', 'set', 55000,
    'ポイント制移行前に事前合意した2026年6月稼働分の税抜額を固定する',
    'masa',
    '{"payment_ym":"202607","tax_basis":"tax_exclusive","scope":"payout_notice_only"}'::jsonb
  )
ON CONFLICT (event_key) DO NOTHING;
