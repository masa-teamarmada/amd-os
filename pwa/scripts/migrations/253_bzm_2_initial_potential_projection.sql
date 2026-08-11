-- 253_bzm_2_initial_potential_projection.sql
--
-- BZM 2.0のPベクトル本測定が未着手の段階でも、値の版更新を観察できるよう
-- 全SPS対象PJにP^(0)の初期投影を追加する。
-- P^(0)は社会的価値V_socと条件付きDCF V_econを測った値ではない。
-- 既存のSPS Primary入力を出所つきの単一基準線へ写すだけであり、q、時計、
-- 現行SPSの最終点、投資判断へ自動接続しない。

-- 10 PJの構造化DB凍結値を使った初期投影版。
INSERT INTO public.bzm_2_model_revisions (
  project_id, revision_key, revision_order, theory_version, model_version,
  measurement_status, information_cutoff, forward_validation_count, revision_reason, source_ref
)
SELECT
  projects.project_id,
  'v0.2',
  2,
  'theory-fixed v1.1',
  'initial-potential-proxy-v0.1',
  'data_collection',
  '2026-08-10T18:32:28+09:00'::timestamptz,
  0,
  '既存SPS Primaryの潜在性入力を、明示した変換規則でP^(0)の初期投影へ写す。社会的価値と条件付きDCFは未測定のまま保持する',
  'pwa/scripts/migrations/253_bzm_2_initial_potential_projection.sql'
FROM public.projects AS projects
WHERE projects.project_id IN ('p03', 'p04', 'p06', 'p09', 'p11', 'p18', 'p20', 'p24', 'p26', 'p29')
ON CONFLICT (project_id, revision_key) DO NOTHING;

-- SXはq v0.5を変えず、P^(0)だけをv0.6として追記する。
INSERT INTO public.bzm_2_model_revisions (
  project_id, revision_key, revision_order, theory_version, model_version,
  measurement_status, information_cutoff, forward_validation_count, revision_reason, source_ref
)
SELECT
  projects.project_id,
  'v0.6',
  6,
  'theory-fixed v1.1 / SX qは再計算なし',
  'initial-potential-proxy-v0.1',
  'measured_hypothesis',
  '2026-08-07T23:59:59+09:00'::timestamptz,
  0,
  'q v0.5は不変。既存SPS Primaryの潜在性入力からP^(0)の初期投影を追加する。社会的価値と条件付きDCFは未測定のまま保持する',
  'pwa/scripts/migrations/253_bzm_2_initial_potential_projection.sql'
FROM public.projects AS projects
WHERE projects.project_id = 'p21'
ON CONFLICT (project_id, revision_key) DO NOTHING;

-- LSTは事前登録状態を保ったままP^(0)を追記する。qは未計算のまま。
INSERT INTO public.bzm_2_model_revisions (
  project_id, revision_key, revision_order, theory_version, model_version,
  measurement_status, information_cutoff, forward_validation_count, revision_reason, source_ref
)
SELECT
  projects.project_id,
  'v0.2',
  2,
  'theory-fixed v1.1',
  'initial-potential-proxy-v0.1',
  'preregistration_open',
  '2026-08-10T23:59:59+09:00'::timestamptz,
  0,
  'qは依存グラフ、時間三点幅、C0が欠測のまま。既存SPS Primaryの潜在性入力からP^(0)の初期投影を追加する',
  'pwa/scripts/migrations/253_bzm_2_initial_potential_projection.sql'
FROM public.projects AS projects
WHERE projects.project_id = 'p07'
ON CONFLICT (project_id, revision_key) DO NOTHING;

-- SXとLSTは、情報締切以前のprs_potentialを明示して使う。
WITH direct_seed(project_id, revision_key, source_score, evaluated_at) AS (
  VALUES
    ('p21'::text, 'v0.6'::text, 8.0::numeric, '2026-04-30'::text),
    ('p07'::text, 'v0.2'::text, 7.0::numeric, '2026-05-31'::text)
)
INSERT INTO public.bzm_2_parameter_observations (
  revision_id, parameter_key, symbol, label, parameter_group, value_json, display_value,
  value_status, unit, evidence_kind, evidence_ref, affects, condition_json, note, sort_order
)
SELECT
  revisions.revision_id,
  'P',
  'P_0',
  '価値の初期投影',
  'result',
  jsonb_build_object(
    'schema', 'bzm2-potential-proxy-v0.1',
    'score_0_to_100', round(direct_seed.source_score * 100 / 9, 1),
    'source_mode', 'legacy_prs_potential',
    'source_score_0_to_9', direct_seed.source_score,
    'components', jsonb_build_object('V_soc', 'unmeasured', 'V_econ', 'unmeasured')
  ),
  to_char(round(direct_seed.source_score * 100 / 9, 1), 'FM990.0') || ' / 100',
  'estimated',
  'index 0-100',
  'mixed',
  'AMD OS amd_score_inputs ' || direct_seed.project_id || ' evaluated_at=' || direct_seed.evaluated_at || '; projection rule v0.1',
  ARRAY['SPS_0']::text[],
  jsonb_build_object(
    'projection_formula', '100 * prs_potential / 9',
    'not_bzm_value_vector', true,
    'unmeasured_components', jsonb_build_array('V_soc', 'V_econ')
  ),
  'P^(0)は画面で版推移を見るための初期投影。社会的価値とPJ自身の条件付きDCFは未測定で、qや時計を変えない',
  20
FROM direct_seed
JOIN public.bzm_2_model_revisions AS revisions
  ON revisions.project_id = direct_seed.project_id
 AND revisions.revision_key = direct_seed.revision_key
ON CONFLICT (revision_id, parameter_key) DO NOTHING;

-- 残る10PJは、v0.1で凍結した現行SPS入力だけを読む。
-- prs_potentialが無いPJだけは、記録済みのTRL/BRL/GRL/SRL/HRL/FRLの単純平均を
-- 同じ0〜9の初期尺度として使う。これは値を欠測のまま見せないための明示的な
-- 代替規則であり、価値ベクトルの二成分を測ったことを意味しない。
WITH source_scores AS (
  SELECT
    revisions.project_id,
    revisions.revision_id,
    NULLIF(observations.value_json ->> 'prs_potential', '')::numeric AS prs_potential,
    (
      NULLIF(observations.value_json ->> 'trl', '')::numeric
      + NULLIF(observations.value_json ->> 'brl', '')::numeric
      + NULLIF(observations.value_json ->> 'grl', '')::numeric
      + NULLIF(observations.value_json ->> 'srl', '')::numeric
      + NULLIF(observations.value_json ->> 'hrl', '')::numeric
      + NULLIF(observations.value_json ->> 'frl', '')::numeric
    ) / 6 AS readiness_mean
  FROM public.bzm_2_model_revisions AS revisions
  JOIN public.bzm_2_parameter_observations AS observations
    ON observations.revision_id = revisions.revision_id
   AND observations.parameter_key = 'quality.current_sps_input'
  WHERE revisions.project_id IN ('p03', 'p04', 'p06', 'p09', 'p11', 'p18', 'p20', 'p24', 'p26', 'p29')
    AND revisions.revision_key = 'v0.1'
), projection_source AS (
  SELECT
    project_id,
    COALESCE(prs_potential, readiness_mean) AS source_score,
    CASE
      WHEN prs_potential IS NOT NULL THEN 'legacy_prs_potential'
      ELSE 'readiness_mean_fallback'
    END AS source_mode
  FROM source_scores
)
INSERT INTO public.bzm_2_parameter_observations (
  revision_id, parameter_key, symbol, label, parameter_group, value_json, display_value,
  value_status, unit, evidence_kind, evidence_ref, affects, condition_json, note, sort_order
)
SELECT
  revisions.revision_id,
  'P',
  'P_0',
  '価値の初期投影',
  'result',
  jsonb_build_object(
    'schema', 'bzm2-potential-proxy-v0.1',
    'score_0_to_100', round(projection_source.source_score * 100 / 9, 1),
    'source_mode', projection_source.source_mode,
    'source_score_0_to_9', projection_source.source_score,
    'components', jsonb_build_object('V_soc', 'unmeasured', 'V_econ', 'unmeasured')
  ),
  to_char(round(projection_source.source_score * 100 / 9, 1), 'FM990.0') || ' / 100',
  'estimated',
  'index 0-100',
  'mixed',
  'AMD OS bzm_2_parameter_observations quality.current_sps_input v0.1; projection rule v0.1',
  ARRAY['SPS_0']::text[],
  jsonb_build_object(
    'projection_formula', CASE
      WHEN projection_source.source_mode = 'legacy_prs_potential' THEN '100 * prs_potential / 9'
      ELSE '100 * mean(TRL, BRL, GRL, SRL, HRL, FRL) / 9'
    END,
    'not_bzm_value_vector', true,
    'unmeasured_components', jsonb_build_array('V_soc', 'V_econ')
  ),
  CASE
    WHEN projection_source.source_mode = 'legacy_prs_potential'
      THEN 'P^(0)は現行SPS Primaryの潜在性入力を100点へ換算した初期投影。社会的価値と条件付きDCFは未測定で、qや時計を変えない'
    ELSE 'P^(0)はprs_potential欠測時に限り、記録済み6軸平均を100点へ換算した初期投影。社会的価値と条件付きDCFは未測定で、qや時計を変えない'
  END,
  20
FROM projection_source
JOIN public.bzm_2_model_revisions AS revisions
  ON revisions.project_id = projection_source.project_id
 AND revisions.revision_key = 'v0.2'
WHERE projection_source.source_score IS NOT NULL
ON CONFLICT (revision_id, parameter_key) DO NOTHING;
