-- 259_bzm_2_multidisciplinary_audit_correction.sql
--
-- 5役のAI模擬監査で見つかったP0修正を、全SPS対象PJのBZM 2.0観測台帳へ追記する。
-- 既存qとPの値・根拠は変更せず、PJ固有の計画期限内に資本自立する経路の
-- 確率と条件付き価値であることをsymbolとlabelで限定する。
-- 共通期間の到達曲線、共通経済評価地平までの資本自立経路確率・価値、全経路価値、
-- 価値実現経路の分割は、根拠と計算が無いため0を置かず欠測または未着手にする。

BEGIN;

DO $$
DECLARE
  target_project text;
  prior_revision public.bzm_2_model_revisions%ROWTYPE;
  insert_attempt integer;
BEGIN
  FOREACH target_project IN ARRAY ARRAY[
    'p03', 'p04', 'p06', 'p07', 'p09', 'p11',
    'p18', 'p20', 'p21', 'p24', 'p26', 'p29'
  ]::text[]
  LOOP
    -- 同じ規約を使う並行migration同士をPJ単位で直列化する。
    PERFORM pg_advisory_xact_lock(
      hashtextextended('bzm-2-model-revision:' || target_project, 0)
    );

    IF NOT EXISTS (
      SELECT 1
      FROM public.bzm_2_model_revisions AS revisions
      JOIN public.bzm_2_parameter_observations AS observations
        ON observations.revision_id = revisions.revision_id
       AND observations.parameter_key = 'q'
      WHERE revisions.project_id = target_project
        AND revisions.revision_key <> 'audit-p0-open-v1.4'
    ) THEN
      RAISE EXCEPTION 'BZM 2.0 q source is missing for project %', target_project;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.bzm_2_model_revisions AS revisions
      JOIN public.bzm_2_parameter_observations AS observations
        ON observations.revision_id = revisions.revision_id
       AND observations.parameter_key = 'P'
      WHERE revisions.project_id = target_project
        AND revisions.revision_key <> 'audit-p0-open-v1.4'
    ) THEN
      RAISE EXCEPTION 'BZM 2.0 P source is missing for project %', target_project;
    END IF;

    insert_attempt := 0;

    LOOP
      EXIT WHEN EXISTS (
        SELECT 1
        FROM public.bzm_2_model_revisions AS revisions
        WHERE revisions.project_id = target_project
          AND revisions.revision_key = 'audit-p0-open-v1.4'
      );

      insert_attempt := insert_attempt + 1;

      SELECT revisions.*
      INTO prior_revision
      FROM public.bzm_2_model_revisions AS revisions
      WHERE revisions.project_id = target_project
      ORDER BY revisions.revision_order DESC, revisions.created_at DESC
      LIMIT 1;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'BZM 2.0 prior revision is missing for project %', target_project;
      END IF;

      INSERT INTO public.bzm_2_model_revisions (
        project_id, revision_key, revision_order, theory_version, model_version,
        measurement_status, information_cutoff, forward_validation_count,
        revision_reason, source_ref
      ) VALUES (
        target_project,
        'audit-p0-open-v1.4',
        prior_revision.revision_order + 1,
        'theory-fixed v1.4 / audit-p0-open',
        'all-path-value-draft-v0.2',
        prior_revision.measurement_status,
        prior_revision.information_cutoff,
        prior_revision.forward_validation_count,
        '5役のAI模擬監査のP0修正中。旧qとPを計画期限内の資本自立経路へ限定し、共通期間の到達曲線と全価値実現経路のモデル価値は未測定として分離する',
        'pwa/scripts/migrations/259_bzm_2_multidisciplinary_audit_correction.sql'
      )
      ON CONFLICT DO NOTHING;

      EXIT WHEN EXISTS (
        SELECT 1
        FROM public.bzm_2_model_revisions AS revisions
        WHERE revisions.project_id = target_project
          AND revisions.revision_key = 'audit-p0-open-v1.4'
      );

      IF insert_attempt >= 10 THEN
        RAISE EXCEPTION
          'Could not allocate the next BZM 2.0 revision_order for project % after % attempts',
          target_project,
          insert_attempt;
      END IF;
    END LOOP;
  END LOOP;
END
$$;

-- 最新の旧qを、値・表示・根拠を変えずq_planへ読み替える。
WITH target_revisions AS (
  SELECT revisions.revision_id, revisions.project_id, revisions.revision_order
  FROM public.bzm_2_model_revisions AS revisions
  WHERE revisions.revision_key = 'audit-p0-open-v1.4'
    AND revisions.model_version = 'all-path-value-draft-v0.2'
    AND revisions.project_id IN (
      'p03', 'p04', 'p06', 'p07', 'p09', 'p11',
      'p18', 'p20', 'p21', 'p24', 'p26', 'p29'
    )
), q_sources AS (
  SELECT
    target_revisions.revision_id AS target_revision_id,
    source_observations.effective_information_cutoff,
    source_observations.parameter_group,
    source_observations.value_json,
    source_observations.display_value,
    source_observations.value_status,
    source_observations.unit,
    source_observations.evidence_kind,
    source_observations.evidence_ref,
    source_observations.condition_json,
    source_observations.note,
    source_observations.sort_order
  FROM target_revisions
  CROSS JOIN LATERAL (
    SELECT
      observations.*,
      source_revisions.information_cutoff AS effective_information_cutoff
    FROM public.bzm_2_model_revisions AS source_revisions
    JOIN public.bzm_2_parameter_observations AS observations
      ON observations.revision_id = source_revisions.revision_id
     AND observations.parameter_key = 'q'
    WHERE source_revisions.project_id = target_revisions.project_id
      AND source_revisions.revision_order < target_revisions.revision_order
    ORDER BY
      source_revisions.revision_order DESC,
      source_revisions.created_at DESC,
      observations.created_at DESC
    LIMIT 1
  ) AS source_observations
)
INSERT INTO public.bzm_2_parameter_observations (
  revision_id, parameter_key, symbol, label, parameter_group, value_json,
  display_value, value_status, unit, evidence_kind, evidence_ref, affects,
  condition_json, note, sort_order
)
SELECT
  q_sources.target_revision_id,
  'q',
  'q_plan',
  '計画期限内の資本自立到達見込み',
  q_sources.parameter_group,
  q_sources.value_json,
  q_sources.display_value,
  q_sources.value_status,
  q_sources.unit,
  q_sources.evidence_kind,
  q_sources.evidence_ref,
  ARRAY['SPS_plan']::text[],
  COALESCE(q_sources.condition_json, '{}'::jsonb) || jsonb_build_object(
    'audit_mapping', 'q_to_q_plan',
    'scope', 'project_plan_deadline_capital_self_sufficiency',
    'event_key', 'G_self_plan',
    'horizon_key', 'H_v',
    'effective_information_cutoff', q_sources.effective_information_cutoff,
    'valuation_date', NULL,
    'valuation_date_match_required_for_contribution', true,
    'not_Q_h', true,
    'not_q_G', true,
    'not_all_path_probability', true
  ),
  concat_ws(
    ' / ',
    NULLIF(q_sources.note, ''),
    '監査訂正では値と根拠を変更せず、PJ固有の計画期限内に資本自立する経路の見込みへ意味を限定'
  ),
  q_sources.sort_order
FROM q_sources
ON CONFLICT (revision_id, parameter_key) DO NOTHING;

-- 最新の旧Pを、値・表示・根拠を変えずP_G_planへ読み替える。
WITH target_revisions AS (
  SELECT revisions.revision_id, revisions.project_id, revisions.revision_order
  FROM public.bzm_2_model_revisions AS revisions
  WHERE revisions.revision_key = 'audit-p0-open-v1.4'
    AND revisions.model_version = 'all-path-value-draft-v0.2'
    AND revisions.project_id IN (
      'p03', 'p04', 'p06', 'p07', 'p09', 'p11',
      'p18', 'p20', 'p21', 'p24', 'p26', 'p29'
    )
), p_sources AS (
  SELECT
    target_revisions.revision_id AS target_revision_id,
    source_observations.effective_information_cutoff,
    source_observations.parameter_group,
    source_observations.value_json,
    source_observations.display_value,
    source_observations.value_status,
    source_observations.unit,
    source_observations.evidence_kind,
    source_observations.evidence_ref,
    source_observations.condition_json,
    source_observations.note,
    source_observations.sort_order
  FROM target_revisions
  CROSS JOIN LATERAL (
    SELECT
      observations.*,
      source_revisions.information_cutoff AS effective_information_cutoff
    FROM public.bzm_2_model_revisions AS source_revisions
    JOIN public.bzm_2_parameter_observations AS observations
      ON observations.revision_id = source_revisions.revision_id
     AND observations.parameter_key = 'P'
    WHERE source_revisions.project_id = target_revisions.project_id
      AND source_revisions.revision_order < target_revisions.revision_order
    ORDER BY
      source_revisions.revision_order DESC,
      source_revisions.created_at DESC,
      observations.created_at DESC
    LIMIT 1
  ) AS source_observations
)
INSERT INTO public.bzm_2_parameter_observations (
  revision_id, parameter_key, symbol, label, parameter_group, value_json,
  display_value, value_status, unit, evidence_kind, evidence_ref, affects,
  condition_json, note, sort_order
)
SELECT
  p_sources.target_revision_id,
  'P',
  'P_G_plan',
  '計画期限内の資本自立経路価値',
  p_sources.parameter_group,
  p_sources.value_json,
  p_sources.display_value,
  p_sources.value_status,
  p_sources.unit,
  p_sources.evidence_kind,
  p_sources.evidence_ref,
  ARRAY['SPS_plan']::text[],
  COALESCE(p_sources.condition_json, '{}'::jsonb) || jsonb_build_object(
    'audit_mapping', 'P_to_P_G_plan',
    'scope', 'project_plan_deadline_capital_self_sufficiency',
    'event_key', 'G_self_plan',
    'horizon_key', 'H_v',
    'effective_information_cutoff', p_sources.effective_information_cutoff,
    'schema_when_measured', 'bzm2-path-equity-value-v0.2',
    'information_cutoff_required', true,
    'valuation_date_must_match_probability', true,
    'not_P_G', true,
    'not_all_path_value', true
  ),
  concat_ws(
    ' / ',
    NULLIF(p_sources.note, ''),
    '監査訂正では値と根拠を変更せず、PJ固有の計画期限内に資本自立する経路の条件付き価値へ意味を限定'
  ),
  p_sources.sort_order
FROM p_sources
ON CONFLICT (revision_id, parameter_key) DO NOTHING;

-- 新しい全経路モデルの入力は、根拠なし・数値なしで開始する。
WITH target_revisions AS (
  SELECT revisions.revision_id
  FROM public.bzm_2_model_revisions AS revisions
  WHERE revisions.revision_key = 'audit-p0-open-v1.4'
    AND revisions.model_version = 'all-path-value-draft-v0.2'
    AND revisions.project_id IN (
      'p03', 'p04', 'p06', 'p07', 'p09', 'p11',
      'p18', 'p20', 'p21', 'p24', 'p26', 'p29'
    )
), missing_seed(
  parameter_key, symbol, label, parameter_group, display_value, value_status,
  unit, affects, condition_json, note, sort_order
) AS (
  VALUES
    (
      'Q_h',
      'Q_h',
      '共通期間内の資本自立到達見込み',
      'result',
      '未着手（0ではない）',
      'not_started',
      'probability'::text,
      ARRAY[]::text[],
      jsonb_build_object(
        'definition', 'Pr(T_C < T_Y, T_C <= h | I_tau)',
        'event_key', 'G_self_common_horizon',
        'horizon_key', 'common_h',
        'horizon_months', NULL,
        'horizon_months_required', true,
        'economic_horizon_months', NULL,
        'economic_horizon_date', NULL,
        'common_economic_horizon_months_required', true,
        'effective_information_cutoff', NULL,
        'valuation_date', NULL,
        'comparison_end_must_not_exceed_economic_horizon_date', true,
        'common_horizon_required', true,
        'not_zero', true
      ),
      '全PJで共通の期間hを使う累積到達曲線は未計算であり、旧qから補間しない',
      21
    ),
    (
      'q_G',
      'q_G',
      '共通経済評価地平までの資本自立到達見込み',
      'result',
      '未着手（0ではない）',
      'not_started',
      'probability'::text,
      ARRAY['SPS_G']::text[],
      jsonb_build_object(
        'definition', 'Pr(T_C < T_Y, T_C <= H_econ | I_tau)',
        'event_key', 'G_self_all',
        'horizon_key', 'H_econ',
        'economic_horizon_months', NULL,
        'economic_horizon_date', NULL,
        'effective_information_cutoff', NULL,
        'valuation_date', NULL,
        'valuation_date_match_required_for_contribution', true,
        'includes_late_arrival', true,
        'not_zero', true
      ),
      '計画期限後を含む資本自立経路全体の確率は未計算であり、q_planまたはQ(h)から補間しない',
      22
    ),
    (
      'P_G',
      'P_G',
      '資本自立経路全体の条件付き価値',
      'result',
      '欠測（0ではない）',
      'missing',
      'million JPY'::text,
      ARRAY['SPS_G']::text[],
      jsonb_build_object(
        'conditional_on', 'capital_self_sufficiency_including_late_arrival',
        'event_key', 'G_self_all',
        'horizon_key', 'H_econ',
        'economic_horizon_months', NULL,
        'economic_horizon_date', NULL,
        'includes_late_arrival', true,
        'schema_when_measured', 'bzm2-path-equity-value-v0.2',
        'information_cutoff_required', true,
        'valuation_date_must_match_probability', true,
        'all_time_cash_flows_required', true,
        'not_zero', true
      ),
      '共通経済評価地平までの資本自立経路全体へ条件づけた円建てのモデル上の総持分価値は未測定',
      23
    ),
    (
      'SPS_all',
      'SPS_all',
      '全価値実現経路のモデル価値',
      'result',
      '未着手（0ではない）',
      'not_started',
      'million JPY'::text,
      ARRAY[]::text[],
      jsonb_build_object(
        'formula', 'sum_o(q_o * P_o)',
        'schema_when_measured', 'bzm2-all-path-value-v0.2',
        'economic_horizon_key', 'H_econ',
        'economic_horizon_months', NULL,
        'economic_horizon_date', NULL,
        'outcome_partition_required', true,
        'runtime_closure_checks', jsonb_build_array(
          'exact_nine_path_keys',
          'unique_assignment',
          'probability_sum_one',
          'common_valuation_date_currency_horizon_months_and_date',
          'recompute_each_q_times_P_and_total'
        ),
        'not_market_cap_claim', true,
        'not_zero', true
      ),
      '価値実現経路の分割と経路別確率・価値が未測定のため、全経路価値を計算しない',
      24
    ),
    (
      'O',
      'O',
      '価値実現経路の分割',
      'result',
      '未着手（0ではない）',
      'not_started',
      NULL::text,
      ARRAY['SPS_all']::text[],
      jsonb_build_object(
        'required_paths', jsonb_build_array(
          'self_sufficiency_plan',
          'self_sufficiency_late',
          'm_and_a',
          'license',
          'ip_sale',
          'pivot',
          'abandon',
          'liquidation',
          'unresolved_continuation'
        ),
        'economic_horizon_key', 'H_econ',
        'economic_horizon_months', NULL,
        'economic_horizon_date', NULL,
        'mutually_exclusive_required', true,
        'collectively_exhaustive_required', true,
        'not_zero', true
      ),
      '全経路を重複も漏れもない葉へ分ける依存グラフは未作成',
      25
    ),
    (
      'H_econ',
      'H_econ',
      '共通経済評価地平',
      'clock',
      '欠測（0ではない）',
      'missing',
      'months'::text,
      ARRAY['Q_h', 'q_G', 'P_G', 'SPS_all', 'O']::text[],
      jsonb_build_object(
        'required', true,
        'shared_across_projects', true,
        'horizon_months', NULL,
        'corresponding_date', NULL,
        'same_elapsed_months_across_projects', true,
        'corresponding_date_derived_from_effective_information_cutoff', true,
        'unresolved_path_at_horizon', 'unresolved_continuation',
        'not_zero', true
      ),
      '全PJ共通の経済評価期限は未確定であり、PJ別の計画期限から補完しない',
      60
    )
)
INSERT INTO public.bzm_2_parameter_observations (
  revision_id, parameter_key, symbol, label, parameter_group, value_json,
  display_value, value_status, unit, evidence_kind, evidence_ref, affects,
  condition_json, note, sort_order
)
SELECT
  target_revisions.revision_id,
  missing_seed.parameter_key,
  missing_seed.symbol,
  missing_seed.label,
  missing_seed.parameter_group,
  NULL::jsonb,
  missing_seed.display_value,
  missing_seed.value_status,
  missing_seed.unit,
  'none',
  NULL::text,
  missing_seed.affects,
  missing_seed.condition_json,
  missing_seed.note,
  missing_seed.sort_order
FROM target_revisions
CROSS JOIN missing_seed
ON CONFLICT (revision_id, parameter_key) DO NOTHING;

-- 冪等再実行でも、12PJすべてに必要な8行があり、新規6行へ数値や根拠が
-- 入っていないことを最後に検査する。
DO $$
DECLARE
  target_project text;
  target_revision_id uuid;
  required_count integer;
BEGIN
  FOREACH target_project IN ARRAY ARRAY[
    'p03', 'p04', 'p06', 'p07', 'p09', 'p11',
    'p18', 'p20', 'p21', 'p24', 'p26', 'p29'
  ]::text[]
  LOOP
    SELECT revisions.revision_id
    INTO target_revision_id
    FROM public.bzm_2_model_revisions AS revisions
    WHERE revisions.project_id = target_project
      AND revisions.revision_key = 'audit-p0-open-v1.4'
      AND revisions.theory_version = 'theory-fixed v1.4 / audit-p0-open'
    AND revisions.model_version = 'all-path-value-draft-v0.2';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Audit P0-open BZM 2.0 revision is missing for project %', target_project;
    END IF;

    SELECT count(*)
    INTO required_count
    FROM public.bzm_2_parameter_observations AS observations
    WHERE observations.revision_id = target_revision_id
      AND observations.parameter_key IN (
        'q', 'P', 'Q_h', 'q_G', 'P_G', 'SPS_all', 'O', 'H_econ'
      );

    IF required_count <> 8 THEN
      RAISE EXCEPTION
        'Audit P0-open BZM 2.0 observations are incomplete for project %: expected 8, found %',
        target_project,
        required_count;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.bzm_2_parameter_observations AS observations
      WHERE observations.revision_id = target_revision_id
        AND observations.parameter_key IN (
          'Q_h', 'q_G', 'P_G', 'SPS_all', 'O', 'H_econ'
        )
        AND (
          observations.value_json IS NOT NULL
          OR observations.evidence_kind <> 'none'
          OR observations.evidence_ref IS NOT NULL
          OR observations.value_status NOT IN ('missing', 'not_started')
        )
    ) THEN
      RAISE EXCEPTION
        'New all-path BZM 2.0 parameters must remain missing and evidence-free for project %',
        target_project;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.bzm_2_parameter_observations AS observations
      WHERE observations.revision_id = target_revision_id
        AND observations.parameter_key IN ('q', 'P')
        AND NULLIF(
          observations.condition_json ->> 'effective_information_cutoff',
          ''
        ) IS NULL
    ) THEN
      RAISE EXCEPTION
        'Copied q/P must preserve the source revision information cutoff for project %',
        target_project;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.bzm_2_parameter_observations AS target_observations
      CROSS JOIN LATERAL (
        SELECT source_observations.*
        FROM public.bzm_2_model_revisions AS source_revisions
        JOIN public.bzm_2_parameter_observations AS source_observations
          ON source_observations.revision_id = source_revisions.revision_id
         AND source_observations.parameter_key = target_observations.parameter_key
        WHERE source_revisions.project_id = target_project
          AND source_revisions.revision_order < (
            SELECT target_revisions.revision_order
            FROM public.bzm_2_model_revisions AS target_revisions
            WHERE target_revisions.revision_id = target_revision_id
          )
        ORDER BY
          source_revisions.revision_order DESC,
          source_revisions.created_at DESC,
          source_observations.created_at DESC
        LIMIT 1
      ) AS source_observations
      WHERE target_observations.revision_id = target_revision_id
        AND target_observations.parameter_key IN ('q', 'P')
        AND (
          target_observations.value_json IS DISTINCT FROM source_observations.value_json
          OR target_observations.display_value IS DISTINCT FROM source_observations.display_value
          OR target_observations.value_status IS DISTINCT FROM source_observations.value_status
          OR target_observations.unit IS DISTINCT FROM source_observations.unit
          OR target_observations.evidence_kind IS DISTINCT FROM source_observations.evidence_kind
          OR target_observations.evidence_ref IS DISTINCT FROM source_observations.evidence_ref
        )
    ) THEN
      RAISE EXCEPTION
        'Copied q/P must not change source values or evidence for project %',
        target_project;
    END IF;
  END LOOP;
END
$$;

COMMIT;
