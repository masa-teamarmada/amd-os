-- 140_member_monthly_work_agreement_requests.sql
-- 月初タスク・報酬合意に対する本人からの修正要望を append-only で保存する。

CREATE TABLE IF NOT EXISTS public.member_monthly_work_agreement_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ym text NOT NULL CHECK (ym ~ '^[0-9]{6}$'),
  member_id text NOT NULL REFERENCES public.members(member_id),
  project_id text NULL REFERENCES public.projects(project_id),
  request_type text NOT NULL DEFAULT 'other',
  body text NOT NULL CHECK (char_length(body) BETWEEN 4 AND 4000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'rejected')),
  snapshot_hash text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL,
  resolved_by text NULL,
  resolution_note text NULL
);

COMMENT ON TABLE public.member_monthly_work_agreement_requests IS
  '月初タスク・報酬合意の表示内容に対する本人からの修正要望。報酬計算の入力は変えず、admin/PM確認キューとして扱う。';
COMMENT ON COLUMN public.member_monthly_work_agreement_requests.snapshot_hash IS
  '要望送信時点で本人が見ていた monthly work agreement snapshot hash。';

CREATE INDEX IF NOT EXISTS idx_member_monthly_work_agreement_requests_member_ym
  ON public.member_monthly_work_agreement_requests(member_id, ym, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_member_monthly_work_agreement_requests_ym_status
  ON public.member_monthly_work_agreement_requests(ym, status, project_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'member_monthly_work_agreement_requests_updated_at'
  ) THEN
    CREATE TRIGGER member_monthly_work_agreement_requests_updated_at
      BEFORE UPDATE ON public.member_monthly_work_agreement_requests
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE public.member_monthly_work_agreement_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'member_monthly_work_agreement_requests'
      AND policyname = 'member_monthly_work_agreement_requests_select_own_or_admin'
  ) THEN
    CREATE POLICY member_monthly_work_agreement_requests_select_own_or_admin
      ON public.member_monthly_work_agreement_requests
      FOR SELECT
      USING (
        auth.role() = 'service_role'
        OR is_admin()
        OR EXISTS (
          SELECT 1 FROM public.members m
          WHERE m.member_id = member_monthly_work_agreement_requests.member_id
            AND lower(m.email) = lower(auth.jwt() ->> 'email')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'member_monthly_work_agreement_requests'
      AND policyname = 'member_monthly_work_agreement_requests_insert_own'
  ) THEN
    CREATE POLICY member_monthly_work_agreement_requests_insert_own
      ON public.member_monthly_work_agreement_requests
      FOR INSERT
      WITH CHECK (
        auth.role() = 'service_role'
        OR EXISTS (
          SELECT 1 FROM public.members m
          WHERE m.member_id = member_monthly_work_agreement_requests.member_id
            AND lower(m.email) = lower(auth.jwt() ->> 'email')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'member_monthly_work_agreement_requests'
      AND policyname = 'member_monthly_work_agreement_requests_admin_update'
  ) THEN
    CREATE POLICY member_monthly_work_agreement_requests_admin_update
      ON public.member_monthly_work_agreement_requests
      FOR UPDATE
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'member_monthly_work_agreement_requests'
      AND policyname = 'member_monthly_work_agreement_requests_service_role_all'
  ) THEN
    CREATE POLICY member_monthly_work_agreement_requests_service_role_all
      ON public.member_monthly_work_agreement_requests
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
