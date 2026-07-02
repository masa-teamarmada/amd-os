-- 161_reward_member_liability_offsets.sql
-- 支払済み/送付済みの過払いを、会社留保ではなく同一メンバー本人の未払残から相殺するための監査台帳。

CREATE TABLE IF NOT EXISTS public.reward_member_liability_offsets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id),
  plan_cycle_id text NOT NULL REFERENCES public.value_plan_cycles(plan_cycle_id),
  member_id text NOT NULL REFERENCES public.members(member_id),
  pool text NOT NULL DEFAULT 'any' CHECK (pool IN ('regular', 'cap_extra', 'any')),
  amount_yen integer NOT NULL CHECK (amount_yen > 0),
  applies_from_ym text NOT NULL CHECK (applies_from_ym ~ '^[0-9]{6}$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'void')),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 8 AND 4000),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz NULL,
  voided_by text NULL
);

COMMENT ON TABLE public.reward_member_liability_offsets IS
  '送付済み/支払済み実績が現行報酬正本より多い場合に、同一メンバー本人の未払stockから相殺するための監査台帳。会社留保や他メンバー未払からは差し引かない。';
COMMENT ON COLUMN public.reward_member_liability_offsets.pool IS
  'regular/cap_extra/any。any は本人の未払stockを regular → cap_extra の順に相殺する。';
COMMENT ON COLUMN public.reward_member_liability_offsets.amount_yen IS
  '本人の未払残から差し引く総額。正数のみ。';
COMMENT ON COLUMN public.reward_member_liability_offsets.applies_from_ym IS
  'この稼働月以降の reward_summary 再計算で相殺を開始する YYYYMM。';

CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_member_liability_offsets_active_unique
  ON public.reward_member_liability_offsets(project_id, plan_cycle_id, member_id, pool, applies_from_ym)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_reward_member_liability_offsets_lookup
  ON public.reward_member_liability_offsets(project_id, plan_cycle_id, status, applies_from_ym);

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
