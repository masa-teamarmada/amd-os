-- 256_bzm_2_provisional_potential_vector.sql
--
-- BZM 2.0の潜在価値を、社会的価値とPJ自身の経済的価値の二成分で
-- 全SPS対象PJへ初めて追記する。両成分は暫定0〜100指数であり、確率、DCF、
-- 企業価値、投資順位ではない。到達度、資金余力、XRL段階はPへ再投入しない。
--
-- 各成分は5軸（各0〜20）の和で作る。直接証拠が足りない軸も欠測のまま
-- 計算停止せず、中立点10を置いてevidence_status='imputed'とする。
-- それ以外も校正前の代理推定なのでevidence_status='proxy'と明示する。

WITH prior_revisions AS (
  SELECT revisions.*
  FROM public.bzm_2_model_revisions AS revisions
  WHERE revisions.model_version = 'initial-potential-proxy-v0.2'
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
  prior_revisions.project_id,
  CASE WHEN prior_revisions.project_id = 'p21' THEN 'v0.8' ELSE 'v0.4' END,
  CASE WHEN prior_revisions.project_id = 'p21' THEN 8 ELSE 4 END,
  'theory-fixed v1.1 / P measurement v0.1',
  'potential-vector-provisional-v0.1',
  prior_revisions.measurement_status,
  '2026-08-11T23:59:59+09:00'::timestamptz,
  prior_revisions.forward_validation_count,
  'Pを社会的価値と経済的価値の暫定二成分へ更新。根拠不足軸は中立点10で補完し、代理推定と欠測補完を区別して保存する',
  'pwa/scripts/migrations/256_bzm_2_provisional_potential_vector.sql'
FROM prior_revisions
ON CONFLICT (project_id, revision_key) DO NOTHING;

WITH potential_seed(
  project_id,
  social_values,
  social_statuses,
  economic_values,
  economic_statuses,
  source_ref
) AS (
  VALUES
    ('p03', ARRAY[15,16,16,14,18], ARRAY['proxy','proxy','proxy','proxy','proxy'],
      ARRAY[18,15,14,10,17], ARRAY['proxy','proxy','proxy','imputed','proxy'],
      'AMD OS project_ventures p03 + amd_score_inputs p03 evaluated_at=2024-09-01'),
    ('p04', ARRAY[15,15,14,15,13], ARRAY['proxy','proxy','proxy','proxy','proxy'],
      ARRAY[16,14,15,10,13], ARRAY['proxy','proxy','proxy','imputed','proxy'],
      'AMD OS project_ventures p04 + amd_score_inputs p04 evaluated_at=2026-01-01'),
    ('p06', ARRAY[20,18,18,18,15], ARRAY['proxy','proxy','proxy','proxy','proxy'],
      ARRAY[19,19,17,10,18], ARRAY['proxy','proxy','proxy','imputed','proxy'],
      'AMD OS project_ventures p06 + amd_score_inputs p06 evaluated_at=2026-05-07'),
    ('p07', ARRAY[18,17,19,20,16], ARRAY['proxy','proxy','proxy','proxy','proxy'],
      ARRAY[18,18,17,13,17], ARRAY['proxy','proxy','proxy','proxy','proxy'],
      'pwa/bzm/SPS_2_0_PREREGISTRATION_LST_2026-08-09.md + AMD OS project_ventures p07'),
    ('p09', ARRAY[17,16,18,18,13], ARRAY['proxy','proxy','proxy','proxy','proxy'],
      ARRAY[15,14,14,10,13], ARRAY['proxy','proxy','proxy','imputed','proxy'],
      'AMD OS project_ventures p09 + amd_score_inputs p09 evaluated_at=2026-07-01'),
    ('p11', ARRAY[18,18,19,18,15], ARRAY['proxy','proxy','proxy','proxy','proxy'],
      ARRAY[18,16,15,10,16], ARRAY['proxy','proxy','proxy','imputed','proxy'],
      'AMD OS project_ventures p11 + amd_score_inputs p11 evaluated_at=2026-04-30'),
    ('p18', ARRAY[17,16,19,17,11], ARRAY['proxy','proxy','proxy','proxy','proxy'],
      ARRAY[11,9,12,6,10], ARRAY['proxy','proxy','proxy','proxy','imputed'],
      'AMD OS project_ventures p18 + amd_score_inputs p18 evaluated_at=2025-09-30'),
    ('p20', ARRAY[16,15,17,18,16], ARRAY['proxy','proxy','proxy','proxy','proxy'],
      ARRAY[16,17,15,10,17], ARRAY['proxy','proxy','proxy','imputed','proxy'],
      'AMD OS project_ventures p20 + project_capital_plans p20 rev.2 (unfrozen)'),
    ('p21', ARRAY[18,17,19,17,15], ARRAY['proxy','proxy','proxy','proxy','proxy'],
      ARRAY[18,17,16,14,16], ARRAY['proxy','proxy','proxy','proxy','proxy'],
      'pwa/bzm/SPS_2_0_PREREGISTRATION_SX_2026-08-07.md + AMD OS project_ventures p21'),
    ('p24', ARRAY[18,17,19,18,14], ARRAY['proxy','proxy','proxy','proxy','proxy'],
      ARRAY[17,16,15,10,14], ARRAY['proxy','proxy','proxy','imputed','proxy'],
      'AMD OS project_ventures p24 + amd_score_inputs p24 evaluated_at=2026-05-24'),
    ('p26', ARRAY[14,15,13,14,17], ARRAY['proxy','proxy','proxy','proxy','proxy'],
      ARRAY[15,14,17,10,17], ARRAY['proxy','proxy','proxy','imputed','proxy'],
      'AMD OS project_ventures p26 + amd_score_inputs p26 evaluated_at=2026-05-27'),
    ('p29', ARRAY[16,14,16,19,17], ARRAY['proxy','proxy','proxy','proxy','proxy'],
      ARRAY[18,17,15,10,18], ARRAY['proxy','proxy','proxy','imputed','proxy'],
      'AMD OS project_ventures p29 + amd_score_inputs p29 evaluated_at=2026-07-16')
), axis_definition AS (
  SELECT *
  FROM (VALUES
    ('social', 1, 'problem_scale', '課題の大きさ'),
    ('social', 2, 'beneficiary_breadth', '便益が届く広さ'),
    ('social', 3, 'positive_externality', '支払者外への便益'),
    ('social', 4, 'public_mission', '公共政策との整合'),
    ('social', 5, 'additionality', '代替されにくさ'),
    ('economic', 1, 'payment_pool', '対価市場の天井'),
    ('economic', 2, 'value_capture', '顧客価値の回収余地'),
    ('economic', 3, 'repeatability', '反復可能な拡張性'),
    ('economic', 4, 'capital_efficiency', '規模化後の資本効率'),
    ('economic', 5, 'defensibility', '価値捕捉の持続性')
  ) AS axes(component, axis_order, axis_key, axis_label)
), component_payload AS (
  SELECT
    potential_seed.project_id,
    potential_seed.source_ref,
    component.component,
    SUM(component.axis_value)::integer AS component_value,
    jsonb_agg(
      jsonb_build_object(
        'key', axis_definition.axis_key,
        'label', axis_definition.axis_label,
        'value', component.axis_value,
        'evidence_status', component.axis_status,
        'evidence_ref', CASE
          WHEN component.axis_status = 'imputed'
            THEN 'P measurement v0.1 neutral midpoint rule'
          ELSE potential_seed.source_ref
        END,
        'note', CASE
          WHEN component.axis_status = 'imputed'
            THEN '直接証拠が足りないため、0〜20尺度の中立点10を使用'
          ELSE '記録済みのPJ説明、計画、既存の潜在性情報から置いた校正前の代理推定'
        END
      ) ORDER BY axis_definition.axis_order
    ) AS axes
  FROM potential_seed
  CROSS JOIN LATERAL (
    SELECT 'social'::text AS component, axis_value, axis_status, ordinality
    FROM unnest(potential_seed.social_values, potential_seed.social_statuses)
      WITH ORDINALITY AS social_axes(axis_value, axis_status, ordinality)
    UNION ALL
    SELECT 'economic'::text AS component, axis_value, axis_status, ordinality
    FROM unnest(potential_seed.economic_values, potential_seed.economic_statuses)
      WITH ORDINALITY AS economic_axes(axis_value, axis_status, ordinality)
  ) AS component
  JOIN axis_definition
    ON axis_definition.component = component.component
   AND axis_definition.axis_order = component.ordinality
  GROUP BY potential_seed.project_id, potential_seed.source_ref, component.component
), vector_payload AS (
  SELECT
    potential_seed.project_id,
    potential_seed.source_ref,
    social.component_value AS social_value,
    economic.component_value AS economic_value,
    jsonb_build_object(
      'schema', 'bzm2-potential-vector-v0.1',
      'components', jsonb_build_object(
        'V_soc', jsonb_build_object(
          'key', 'V_soc',
          'label', '社会的価値',
          'value', social.component_value,
          'scale', 'index_0_100',
          'axes', social.axes
        ),
        'V_econ', jsonb_build_object(
          'key', 'V_econ',
          'label', 'PJ自身の経済的価値',
          'value', economic.component_value,
          'scale', 'index_0_100',
          'axes', economic.axes
        )
      ),
      'scalar_projection', NULL,
      'conditional_on', 'G_self(12m)を保った事業化シナリオへ到達した場合',
      'imputation_rule', '証拠不足軸は0〜20尺度の中立点10。値とimputed表示を同時に保存',
      'excluded_inputs', jsonb_build_array('q', 'T_C', 'T_Y', 'XRL readiness', 'current cash'),
      'calibration_status', 'uncalibrated',
      'forward_validation_count', 0
    ) AS value_json
  FROM potential_seed
  JOIN component_payload AS social
    ON social.project_id = potential_seed.project_id AND social.component = 'social'
  JOIN component_payload AS economic
    ON economic.project_id = potential_seed.project_id AND economic.component = 'economic'
)
INSERT INTO public.bzm_2_parameter_observations (
  revision_id, parameter_key, symbol, label, parameter_group, value_json,
  display_value, value_status, unit, evidence_kind, evidence_ref, affects,
  condition_json, note, sort_order
)
SELECT
  revisions.revision_id,
  'P',
  'P',
  '潜在価値ベクトル（暫定）',
  'result',
  vector_payload.value_json,
  '(' || vector_payload.social_value || ', ' || vector_payload.economic_value || ')',
  'estimated',
  'index 0-100 × 2',
  'mixed',
  vector_payload.source_ref || '; P measurement rubric v0.1',
  ARRAY['SPS']::text[],
  jsonb_build_object(
    'conditional_on', 'G_self(12m)',
    'no_scalar_projection', true,
    'not_probability', true,
    'not_dcf', true,
    'not_enterprise_value', true,
    'q_inputs_excluded', true
  ),
  '社会と経済の二成分を別々に保持する暫定P 2.0。代理推定と中立点補完を色・ラベル・軸別出所で区別し、単一値へは合成しない',
  20
FROM vector_payload
JOIN public.bzm_2_model_revisions AS revisions
  ON revisions.project_id = vector_payload.project_id
 AND revisions.model_version = 'potential-vector-provisional-v0.1'
ON CONFLICT (revision_id, parameter_key) DO NOTHING;
