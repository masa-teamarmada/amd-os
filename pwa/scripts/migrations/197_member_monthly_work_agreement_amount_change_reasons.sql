-- 197_member_monthly_work_agreement_amount_change_reasons.sql
-- 月初合意の想定報酬額(project別)が変わった理由を、管理者が1PJ×1スナップショット毎に記録する。
-- report計算・報酬額の算定ロジックには一切関与しない。表示・監査用の付帯情報。

CREATE TABLE IF NOT EXISTS public.member_monthly_work_agreement_amount_change_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ym text NOT NULL CHECK (ym ~ '^[0-9]{6}$'),
  member_id text NOT NULL REFERENCES public.members(member_id),
  project_id text NOT NULL REFERENCES public.projects(project_id),
  agreement_snapshot_hash text NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) >= 8),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ym, member_id, project_id, agreement_snapshot_hash)
);

COMMENT ON TABLE public.member_monthly_work_agreement_amount_change_reasons IS
  '月初合意スナップショットのPJ別想定報酬額が変わった理由を管理者が記録する。snapshot hashが変わる=金額が変わりうるため、hashごとに理由を新規に要求する。';
COMMENT ON COLUMN public.member_monthly_work_agreement_amount_change_reasons.agreement_snapshot_hash IS
  '記録時点の member_monthly_work_agreements 相当の現在snapshot hash。hashが変われば別レコードとして新しい理由が必要。';

CREATE INDEX IF NOT EXISTS idx_member_monthly_work_agreement_amount_change_reasons_member_ym
  ON public.member_monthly_work_agreement_amount_change_reasons(member_id, ym, project_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'member_monthly_work_agreement_amount_change_reasons_updated_at'
  ) THEN
    CREATE TRIGGER member_monthly_work_agreement_amount_change_reasons_updated_at
      BEFORE UPDATE ON public.member_monthly_work_agreement_amount_change_reasons
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE public.member_monthly_work_agreement_amount_change_reasons ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- 対象メンバー本人 or 管理者のみ閲覧可（他メンバーの理由は見えない）
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'member_monthly_work_agreement_amount_change_reasons'
      AND policyname = 'mmwacr_select_own_or_admin'
  ) THEN
    CREATE POLICY mmwacr_select_own_or_admin
      ON public.member_monthly_work_agreement_amount_change_reasons
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

  -- 理由の作成・更新は管理者のみ（本人含め一般メンバーは書けない）
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'member_monthly_work_agreement_amount_change_reasons'
      AND policyname = 'mmwacr_admin_insert'
  ) THEN
    CREATE POLICY mmwacr_admin_insert
      ON public.member_monthly_work_agreement_amount_change_reasons
      FOR INSERT
      TO authenticated
      WITH CHECK (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'member_monthly_work_agreement_amount_change_reasons'
      AND policyname = 'mmwacr_admin_update'
  ) THEN
    CREATE POLICY mmwacr_admin_update
      ON public.member_monthly_work_agreement_amount_change_reasons
      FOR UPDATE
      TO authenticated
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;

  -- DELETE ポリシーは意図的に作らない（削除不可、履歴として残す）

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'member_monthly_work_agreement_amount_change_reasons'
      AND policyname = 'mmwacr_service_role_all'
  ) THEN
    CREATE POLICY mmwacr_service_role_all
      ON public.member_monthly_work_agreement_amount_change_reasons
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
