-- 161_reward_member_liability_offsets.sql
--
-- MS design をシーズン途中で修正したとき、PDF送付済み・支払済みなどの protected 月は
-- billing_cycles.reward_summary_json を書き換えず、メンバー別差額だけを未来の未保護月へ精算する。
--
-- offset_yen:
--   正 = 本人へ追加で払うべき額。apply_ym の regular/cap_extra 報酬需要へ加算する。
--   負 = 本人へ払いすぎた額。apply_ym 以降の本人報酬から回収しきるまで控除する。
--
-- apply_ym が NULL の行は、シーズン内に未保護の未来月が無い pending 差額。
-- 管理画面で確認し、次シーズン移送または個別対応するために残す。

CREATE TABLE IF NOT EXISTS public.reward_member_liability_offsets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id),
  plan_cycle_id text NOT NULL REFERENCES public.value_plan_cycles(plan_cycle_id),
  source_ym text NOT NULL CHECK (source_ym ~ '^[0-9]{6}$'),
  apply_ym text NULL CHECK (apply_ym IS NULL OR apply_ym ~ '^[0-9]{6}$'),
  member_id text NOT NULL REFERENCES public.members(member_id),
  pool text NOT NULL DEFAULT 'regular' CHECK (pool IN ('regular','cap_extra')),
  offset_yen int4 NOT NULL CHECK (offset_yen <> 0),
  before_base_yen int4 NOT NULL DEFAULT 0,
  after_base_yen int4 NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','voided','settled')),
  origin_type text NOT NULL DEFAULT 'ms_overview_edit',
  reason text NOT NULL DEFAULT 'MS design revision on protected billing cycle',
  revision_id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_by_email text NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz NULL,
  settled_at timestamptz NULL
);

-- 既に 2026-07-02 時点で旧スキーマ
-- (amount_yen / applies_from_ym / status active|void / pool any) の同名テーブルがある環境を
-- 非破壊で新スキーマへ寄せる。旧列は残し、既存行も保持する。
ALTER TABLE public.reward_member_liability_offsets
  ADD COLUMN IF NOT EXISTS source_ym text,
  ADD COLUMN IF NOT EXISTS apply_ym text,
  ADD COLUMN IF NOT EXISTS offset_yen int4,
  ADD COLUMN IF NOT EXISTS before_base_yen int4 NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS after_base_yen int4 NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS origin_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS revision_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS created_by_email text,
  ADD COLUMN IF NOT EXISTS settled_at timestamptz;

ALTER TABLE public.reward_member_liability_offsets
  ALTER COLUMN source_ym DROP NOT NULL,
  ALTER COLUMN apply_ym DROP NOT NULL,
  ALTER COLUMN offset_yen DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reward_member_liability_offsets'
      AND column_name = 'amount_yen'
  ) THEN
    ALTER TABLE public.reward_member_liability_offsets
      ALTER COLUMN amount_yen DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reward_member_liability_offsets'
      AND column_name = 'applies_from_ym'
  ) THEN
    ALTER TABLE public.reward_member_liability_offsets
      ALTER COLUMN applies_from_ym DROP NOT NULL;
  END IF;
END $$;

UPDATE public.reward_member_liability_offsets
SET
  source_ym = COALESCE(source_ym, applies_from_ym),
  apply_ym = COALESCE(apply_ym, applies_from_ym),
  offset_yen = COALESCE(offset_yen, amount_yen),
  origin_type = COALESCE(NULLIF(origin_type, ''), 'manual')
WHERE source_ym IS NULL OR apply_ym IS NULL OR offset_yen IS NULL OR origin_type IS NULL OR origin_type = '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reward_member_liability_offsets_status_check'
      AND conrelid = 'public.reward_member_liability_offsets'::regclass
  ) THEN
    ALTER TABLE public.reward_member_liability_offsets
      DROP CONSTRAINT reward_member_liability_offsets_status_check;
  END IF;

  ALTER TABLE public.reward_member_liability_offsets
    ADD CONSTRAINT reward_member_liability_offsets_status_check
    CHECK (status IN ('pending','active','voided','void','settled'));
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reward_member_liability_offsets_source_ym_check'
      AND conrelid = 'public.reward_member_liability_offsets'::regclass
  ) THEN
    ALTER TABLE public.reward_member_liability_offsets
      ADD CONSTRAINT reward_member_liability_offsets_source_ym_check
      CHECK (source_ym IS NULL OR source_ym ~ '^[0-9]{6}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reward_member_liability_offsets_apply_ym_check'
      AND conrelid = 'public.reward_member_liability_offsets'::regclass
  ) THEN
    ALTER TABLE public.reward_member_liability_offsets
      ADD CONSTRAINT reward_member_liability_offsets_apply_ym_check
      CHECK (apply_ym IS NULL OR apply_ym ~ '^[0-9]{6}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reward_member_liability_offsets_offset_yen_check'
      AND conrelid = 'public.reward_member_liability_offsets'::regclass
  ) THEN
    ALTER TABLE public.reward_member_liability_offsets
      ADD CONSTRAINT reward_member_liability_offsets_offset_yen_check
      CHECK (offset_yen IS NULL OR offset_yen <> 0);
  END IF;
END $$;

COMMENT ON TABLE public.reward_member_liability_offsets IS
  'Protected billing cycle の reward_summary_json を書き換えず、MS設計修正によるメンバー別差額を未来月へ精算する台帳。';
COMMENT ON COLUMN public.reward_member_liability_offsets.source_ym IS
  '差額の発生元となった protected 稼働月 (= billing_cycles.ym)。';
COMMENT ON COLUMN public.reward_member_liability_offsets.apply_ym IS
  '差額を報酬計算へ反映する未保護の未来月。NULL はシーズン内に反映先が無い pending 差額。';
COMMENT ON COLUMN public.reward_member_liability_offsets.offset_yen IS
  '正=追加支払、負=過払い回収。本人別に future reward summary へ反映する。';
COMMENT ON COLUMN public.reward_member_liability_offsets.pool IS
  'regular は本契約財布、cap_extra は別財布。報酬cap/stockの系統を分ける。';
COMMENT ON COLUMN public.reward_member_liability_offsets.status IS
  'pending=報酬計算対象、voided=後続MS編集で置き換え済み、settled=個別精算済み。';

CREATE INDEX IF NOT EXISTS idx_reward_liability_offsets_apply
  ON public.reward_member_liability_offsets(project_id, apply_ym, status, member_id)
  WHERE status = 'pending' AND apply_ym IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reward_liability_offsets_legacy_apply
  ON public.reward_member_liability_offsets(project_id, applies_from_ym, status, member_id)
  WHERE status = 'active' AND applies_from_ym IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reward_liability_offsets_source
  ON public.reward_member_liability_offsets(project_id, plan_cycle_id, source_ym, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reward_liability_offsets_revision
  ON public.reward_member_liability_offsets(revision_id, created_at DESC);

ALTER TABLE public.reward_member_liability_offsets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reward_member_liability_offsets'
      AND policyname = 'reward_member_liability_offsets_admin_select'
  ) THEN
    CREATE POLICY reward_member_liability_offsets_admin_select
      ON public.reward_member_liability_offsets
      FOR SELECT
      USING (auth.role() = 'service_role' OR is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reward_member_liability_offsets'
      AND policyname = 'reward_member_liability_offsets_admin_insert'
  ) THEN
    CREATE POLICY reward_member_liability_offsets_admin_insert
      ON public.reward_member_liability_offsets
      FOR INSERT
      WITH CHECK (auth.role() = 'service_role' OR is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reward_member_liability_offsets'
      AND policyname = 'reward_member_liability_offsets_admin_update'
  ) THEN
    CREATE POLICY reward_member_liability_offsets_admin_update
      ON public.reward_member_liability_offsets
      FOR UPDATE
      USING (auth.role() = 'service_role' OR is_admin())
      WITH CHECK (auth.role() = 'service_role' OR is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reward_member_liability_offsets'
      AND policyname = 'reward_member_liability_offsets_service_role_all'
  ) THEN
    CREATE POLICY reward_member_liability_offsets_service_role_all
      ON public.reward_member_liability_offsets
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
