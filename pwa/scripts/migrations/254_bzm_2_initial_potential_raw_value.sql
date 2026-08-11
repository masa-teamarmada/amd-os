-- 254_bzm_2_initial_potential_raw_value.sql
--
-- migration 253でP^(0)を0〜100へ換算したが、Pは確率ではなく、旧SPSの
-- 潜在性入力を100点化する必要もない。誤った換算版は履歴として残し、
-- 元の入力値をそのまま使う訂正版を全12PJへ追記する。

WITH source_revisions AS (
  SELECT revisions.*
  FROM public.bzm_2_model_revisions AS revisions
  WHERE revisions.model_version = 'initial-potential-proxy-v0.1'
    AND revisions.project_id IN (
      'p03', 'p04', 'p06', 'p07', 'p09', 'p11',
      'p18', 'p20', 'p21', 'p24', 'p26', 'p29'
    )
)
INSERT INTO public.bzm_2_model_revisions (
  project_id, revision_key, revision_order, theory_version, model_version,
  measurement_status, information_cutoff, forward_validation_count,
  revision_reason, source_ref
)
SELECT
  source_revisions.project_id,
  CASE WHEN source_revisions.project_id = 'p21' THEN 'v0.7' ELSE 'v0.3' END,
  CASE WHEN source_revisions.project_id = 'p21' THEN 7 ELSE 3 END,
  source_revisions.theory_version,
  'initial-potential-proxy-v0.2',
  source_revisions.measurement_status,
  source_revisions.information_cutoff,
  source_revisions.forward_validation_count,
  'P^(0)は確率ではなく100点換算も不要。旧Pまたは6軸平均の元の数値をそのまま使い、分母と%を付けない訂正版',
  'pwa/scripts/migrations/254_bzm_2_initial_potential_raw_value.sql'
FROM source_revisions
ON CONFLICT (project_id, revision_key) DO NOTHING;

WITH corrected_sources AS (
  SELECT
    source_revisions.project_id,
    source_observations.value_json ->> 'source_mode' AS source_mode,
    NULLIF(source_observations.value_json ->> 'source_score_0_to_9', '')::numeric AS source_value,
    source_observations.evidence_kind,
    source_observations.evidence_ref,
    source_observations.affects,
    source_observations.sort_order,
    source_observations.value_json -> 'components' AS components
  FROM public.bzm_2_model_revisions AS source_revisions
  JOIN public.bzm_2_parameter_observations AS source_observations
    ON source_observations.revision_id = source_revisions.revision_id
   AND source_observations.parameter_key = 'P'
  WHERE source_revisions.model_version = 'initial-potential-proxy-v0.1'
    AND source_revisions.project_id IN (
      'p03', 'p04', 'p06', 'p07', 'p09', 'p11',
      'p18', 'p20', 'p21', 'p24', 'p26', 'p29'
    )
), target_revisions AS (
  SELECT revision_id, project_id
  FROM public.bzm_2_model_revisions
  WHERE model_version = 'initial-potential-proxy-v0.2'
)
INSERT INTO public.bzm_2_parameter_observations (
  revision_id, parameter_key, symbol, label, parameter_group, value_json,
  display_value, value_status, unit, evidence_kind, evidence_ref, affects,
  condition_json, note, sort_order
)
SELECT
  target_revisions.revision_id,
  'P',
  'P_0',
  '価値の初期投影',
  'result',
  jsonb_build_object(
    'schema', 'bzm2-potential-proxy-v0.2',
    'initial_value', corrected_sources.source_value,
    'source_mode', corrected_sources.source_mode,
    'components', COALESCE(
      corrected_sources.components,
      jsonb_build_object('V_soc', 'unmeasured', 'V_econ', 'unmeasured')
    )
  ),
  rtrim(rtrim(to_char(round(corrected_sources.source_value, 3), 'FM999990.000'), '0'), '.'),
  'estimated',
  NULL,
  corrected_sources.evidence_kind,
  corrected_sources.evidence_ref || '; raw-value correction v0.2',
  corrected_sources.affects,
  jsonb_build_object(
    'projection_formula', CASE
      WHEN corrected_sources.source_mode = 'legacy_prs_potential'
        THEN 'prs_potential'
      ELSE 'mean(TRL, BRL, GRL, SRL, HRL, FRL)'
    END,
    'not_probability', true,
    'not_bzm_value_vector', true,
    'unmeasured_components', jsonb_build_array('V_soc', 'V_econ')
  ),
  CASE
    WHEN corrected_sources.source_mode = 'legacy_prs_potential'
      THEN 'P^(0)は旧SPS PrimaryのPを換算せずそのまま使う初期値。確率ではなく、社会的価値と条件付きDCFは未測定'
    ELSE 'P^(0)はprs_potential欠測時に記録済み6軸平均を換算せず使う初期値。確率ではなく、社会的価値と条件付きDCFは未測定'
  END,
  corrected_sources.sort_order
FROM corrected_sources
JOIN target_revisions
  ON target_revisions.project_id = corrected_sources.project_id
WHERE corrected_sources.source_value IS NOT NULL
ON CONFLICT (revision_id, parameter_key) DO NOTHING;
