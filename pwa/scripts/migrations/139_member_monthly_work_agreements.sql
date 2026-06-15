-- 139_member_monthly_work_agreements.sql
-- 月初にメンバーが当月の遂行対象・想定報酬・条件を確認し、snapshot hash つきで合意する。
-- 報酬計算そのものは変更せず、billing_cycles.reward_summary_json 等を表示・合意するレイヤー。

CREATE TABLE IF NOT EXISTS public.member_monthly_work_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ym text NOT NULL CHECK (ym ~ '^[0-9]{6}$'),
  member_id text NOT NULL REFERENCES public.members(member_id),
  status text NOT NULL DEFAULT 'agreed'
    CHECK (status IN ('agreed', 'superseded', 'revoked')),
  agreed_at timestamptz NOT NULL DEFAULT now(),
  agreed_by text NOT NULL,
  snapshot_json jsonb NOT NULL,
  snapshot_hash text NOT NULL,
  current_hash text NOT NULL,
  invalidated_at timestamptz,
  invalidation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.member_monthly_work_agreements IS
  'メンバーが月初に当月の遂行内容・報酬条件を確認して合意したsnapshot。報酬計算入力は変更しない。';
COMMENT ON COLUMN public.member_monthly_work_agreements.snapshot_json IS
  '合意時に本人へ表示したPJ別遂行対象、条件、想定報酬、未確定理由のsnapshot。';
COMMENT ON COLUMN public.member_monthly_work_agreements.snapshot_hash IS
  'snapshot_json の安定hash。現在表示hashとの差分で再合意要否を判定する。';

CREATE INDEX IF NOT EXISTS idx_member_monthly_work_agreements_member_ym
  ON public.member_monthly_work_agreements(member_id, ym, agreed_at DESC);

CREATE INDEX IF NOT EXISTS idx_member_monthly_work_agreements_ym_status
  ON public.member_monthly_work_agreements(ym, status, member_id);

CREATE UNIQUE INDEX IF NOT EXISTS member_monthly_work_agreements_one_active_agreed
  ON public.member_monthly_work_agreements(ym, member_id)
  WHERE status = 'agreed';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'member_monthly_work_agreements_updated_at'
  ) THEN
    CREATE TRIGGER member_monthly_work_agreements_updated_at
      BEFORE UPDATE ON public.member_monthly_work_agreements
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE public.member_monthly_work_agreements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'member_monthly_work_agreements'
      AND policyname = 'member_monthly_work_agreements_select_own_or_admin'
  ) THEN
    CREATE POLICY member_monthly_work_agreements_select_own_or_admin
      ON public.member_monthly_work_agreements
      FOR SELECT
      TO authenticated
      USING (
        is_admin()
        OR member_id IN (
          SELECT m.member_id
          FROM public.members m
          WHERE lower(m.email) = lower(auth.jwt() ->> 'email')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'member_monthly_work_agreements'
      AND policyname = 'member_monthly_work_agreements_insert_own'
  ) THEN
    CREATE POLICY member_monthly_work_agreements_insert_own
      ON public.member_monthly_work_agreements
      FOR INSERT
      TO authenticated
      WITH CHECK (
        member_id IN (
          SELECT m.member_id
          FROM public.members m
          WHERE lower(m.email) = lower(auth.jwt() ->> 'email')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'member_monthly_work_agreements'
      AND policyname = 'member_monthly_work_agreements_admin_update'
  ) THEN
    CREATE POLICY member_monthly_work_agreements_admin_update
      ON public.member_monthly_work_agreements
      FOR UPDATE
      TO authenticated
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'member_monthly_work_agreements'
      AND policyname = 'member_monthly_work_agreements_service_role_all'
  ) THEN
    CREATE POLICY member_monthly_work_agreements_service_role_all
      ON public.member_monthly_work_agreements
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
