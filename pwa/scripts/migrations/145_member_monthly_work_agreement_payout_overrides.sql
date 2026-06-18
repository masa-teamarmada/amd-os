-- 145_member_monthly_work_agreement_payout_overrides.sql
-- 月初合意 payout gate の admin override を append-only で監査保存する。

CREATE TABLE IF NOT EXISTS public.member_monthly_work_agreement_payout_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_ym text NOT NULL CHECK (payment_ym ~ '^[0-9]{6}$'),
  source_ym text NOT NULL CHECK (source_ym ~ '^[0-9]{6}$'),
  member_id text NOT NULL REFERENCES public.members(member_id),
  project_id text NOT NULL REFERENCES public.projects(project_id),
  target_action text NOT NULL,
  blocker_status text NOT NULL CHECK (blocker_status IN ('pending', 'stale', 'revision_requested')),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 8 AND 4000),
  actor_email text NOT NULL,
  snapshot_hash text NULL,
  current_hash text NULL,
  request_id uuid NULL REFERENCES public.member_monthly_work_agreement_requests(id),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.member_monthly_work_agreement_payout_overrides IS
  '月初合意が未合意・条件更新あり・修正要望中でも admin が支払保存/PDF生成/送付を例外実行した監査ログ。';
COMMENT ON COLUMN public.member_monthly_work_agreement_payout_overrides.payment_ym IS
  '/admin/payouts で開いている支払月。';
COMMENT ON COLUMN public.member_monthly_work_agreement_payout_overrides.source_ym IS
  '報酬明細の稼働月 (= billing_cycles.ym / monthly_reward_payout.ym)。';
COMMENT ON COLUMN public.member_monthly_work_agreement_payout_overrides.target_action IS
  'override した server-side action。例: save_payout_data, issue_notice_pdf, send_notice_email。';
COMMENT ON COLUMN public.member_monthly_work_agreement_payout_overrides.metadata_json IS
  'blocker reason、member/project label、支払額など、監査用の補助情報。';

CREATE INDEX IF NOT EXISTS idx_mmwa_payout_overrides_target
  ON public.member_monthly_work_agreement_payout_overrides(payment_ym, source_ym, member_id, project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mmwa_payout_overrides_action
  ON public.member_monthly_work_agreement_payout_overrides(target_action, blocker_status, created_at DESC);

ALTER TABLE public.member_monthly_work_agreement_payout_overrides ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'member_monthly_work_agreement_payout_overrides'
      AND policyname = 'member_monthly_work_agreement_payout_overrides_admin_select'
  ) THEN
    CREATE POLICY member_monthly_work_agreement_payout_overrides_admin_select
      ON public.member_monthly_work_agreement_payout_overrides
      FOR SELECT
      USING (auth.role() = 'service_role' OR is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'member_monthly_work_agreement_payout_overrides'
      AND policyname = 'member_monthly_work_agreement_payout_overrides_admin_insert'
  ) THEN
    CREATE POLICY member_monthly_work_agreement_payout_overrides_admin_insert
      ON public.member_monthly_work_agreement_payout_overrides
      FOR INSERT
      WITH CHECK (auth.role() = 'service_role' OR is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'member_monthly_work_agreement_payout_overrides'
      AND policyname = 'member_monthly_work_agreement_payout_overrides_service_role_all'
  ) THEN
    CREATE POLICY member_monthly_work_agreement_payout_overrides_service_role_all
      ON public.member_monthly_work_agreement_payout_overrides
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
