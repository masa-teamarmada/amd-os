-- 257_bzm_2_equity_value_definition.sql
--
-- BZM 2.0のPを、社会・経済の二成分指数から、共通到達目標へ着いた場合の
-- 会社全体の条件付き理論時価総額へ改訂する。
-- 256の指数と根拠状態は履歴として残すが、円への換算規則が無いため現行Pや
-- SPSには使わない。円建て評価入力が揃うまでPとSPSは欠測として明示する。

WITH prior_revisions AS (
  SELECT revisions.*
  FROM public.bzm_2_model_revisions AS revisions
  WHERE revisions.model_version = 'potential-vector-provisional-v0.1'
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
  CASE WHEN prior_revisions.project_id = 'p21' THEN 'v0.9' ELSE 'v0.5' END,
  CASE WHEN prior_revisions.project_id = 'p21' THEN 9 ELSE 5 END,
  'theory-fixed v1.2 / P monetary definition v0.1',
  'equity-value-definition-v0.1',
  prior_revisions.measurement_status,
  '2026-08-11T23:59:59+09:00'::timestamptz,
  prior_revisions.forward_validation_count,
  'Pを到達時条件付きの会社全体理論時価総額へ改訂。二成分指数は単位不一致のため撤回し、円建て入力が揃うまで現行PとSPSを欠測にする',
  'pwa/scripts/migrations/257_bzm_2_equity_value_definition.sql'
FROM prior_revisions
ON CONFLICT (project_id, revision_key) DO NOTHING;

INSERT INTO public.bzm_2_parameter_observations (
  revision_id, parameter_key, symbol, label, parameter_group, value_json,
  display_value, value_status, unit, evidence_kind, evidence_ref, affects,
  condition_json, note, sort_order
)
SELECT
  revisions.revision_id,
  'P',
  'P_tau',
  '条件付き理論時価総額',
  'result',
  NULL::jsonb,
  '円建て評価入力待ち',
  'missing',
  'million JPY',
  'none',
  NULL::text,
  ARRAY['SPS_tau']::text[],
  jsonb_build_object(
    'schema_when_measured', 'bzm2-equity-value-v0.1',
    'conditional_on', 'A_v = {T_C < T_Y, T_C <= H_v}',
    'value_basis', 'total_company_equity_value',
    'currency', 'JPY',
    'social_routes', jsonb_build_array('q', 'cash_flow', 'market_pricing'),
    'legacy_vector_status', 'withdrawn',
    'legacy_vector_not_converted', true,
    'bzsf_ownership_excluded', true
  ),
  '到達後の売上・費用・残存価値・資本構成・市場価格づけを抽出中。旧0〜100二成分指数に円換算規則は無く、推測換算しない',
  20
FROM public.bzm_2_model_revisions AS revisions
WHERE revisions.model_version = 'equity-value-definition-v0.1'
ON CONFLICT (revision_id, parameter_key) DO NOTHING;
