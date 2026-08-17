-- 283: SPS現行版を明示し、旧版fallbackと凍結評価の変更をDBで防ぐ。
-- 現行: sps-ind-v1 / q-eval-v2 / rubric-v1.1 / p-ind-v1
BEGIN;

CREATE TABLE IF NOT EXISTS public.sps_model_versions (
  model_version text PRIMARY KEY,
  formula text NOT NULL,
  measure_version text NOT NULL,
  q_model_version text NOT NULL,
  q_ruleset_version text NOT NULL,
  p_model_version text NOT NULL,
  assessment_ruleset_version text NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  effective_from timestamptz NOT NULL,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((is_current AND retired_at IS NULL) OR NOT is_current)
);

CREATE UNIQUE INDEX IF NOT EXISTS sps_model_versions_one_current_idx
  ON public.sps_model_versions (is_current)
  WHERE is_current;

INSERT INTO public.sps_model_versions (
  model_version,
  formula,
  measure_version,
  q_model_version,
  q_ruleset_version,
  p_model_version,
  assessment_ruleset_version,
  is_current,
  effective_from
) VALUES (
  'sps-ind-tier0-v1',
  'SPS = Σ q_o P^ind_o',
  'sps-ind-v1',
  'q-eval-v2',
  'rubric-v1.1',
  'p-ind-v1',
  'rubric-v1.1+ind-v1',
  true,
  '2026-08-16T00:00:00+09:00'
)
ON CONFLICT (model_version) DO UPDATE SET
  formula = EXCLUDED.formula,
  measure_version = EXCLUDED.measure_version,
  q_model_version = EXCLUDED.q_model_version,
  q_ruleset_version = EXCLUDED.q_ruleset_version,
  p_model_version = EXCLUDED.p_model_version,
  assessment_ruleset_version = EXCLUDED.assessment_ruleset_version,
  is_current = EXCLUDED.is_current,
  retired_at = NULL;

-- 新規行が旧版へ暗黙分類される事故を止める。writerは版を必ず明示する。
ALTER TABLE public.seed_screening_bands
  ALTER COLUMN measure_version DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.guard_frozen_seed_screening_band()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.frozen THEN
    RAISE EXCEPTION 'frozen seed_screening_bands row % is immutable; append a reassessment instead', OLD.id;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS seed_screening_bands_frozen_immutable ON public.seed_screening_bands;
CREATE TRIGGER seed_screening_bands_frozen_immutable
  BEFORE UPDATE OR DELETE ON public.seed_screening_bands
  FOR EACH ROW EXECUTE FUNCTION public.guard_frozen_seed_screening_band();

ALTER TABLE public.sps_model_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sps_model_versions FROM anon, authenticated;
GRANT SELECT ON public.sps_model_versions TO service_role;

COMMENT ON TABLE public.sps_model_versions IS
  'SPS版の正本。is_current=trueの完全な版組だけを現行UI/APIが使用する。BZM 2.2は別モデル。';
COMMENT ON FUNCTION public.guard_frozen_seed_screening_band() IS
  'frozen評価は更新・削除禁止。再評価はseed_screening_bandsへのappend-only insertで行う。';

COMMIT;
