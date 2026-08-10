-- 251_bzm_2_model_observatory.sql
--
-- BZM 2.0の式、版、現在値、欠測、出所をPJごとに追える追記型台帳。
-- parameter_keyを行として持つため、Z_policyのような共通状態が増えても列追加を要しない。
-- この台帳は表示と検証のための記録であり、現行SPSやGO判定を置き換えない。

CREATE TABLE IF NOT EXISTS public.bzm_2_model_revisions (
  revision_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  revision_key             text NOT NULL,
  revision_order           integer NOT NULL,
  theory_version           text NOT NULL,
  model_version            text NOT NULL,
  measurement_status       text NOT NULL,
  information_cutoff       timestamptz NOT NULL,
  forward_validation_count integer NOT NULL DEFAULT 0,
  revision_reason          text NOT NULL,
  source_ref               text NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bzm_2_model_revisions_project_key_uniq UNIQUE (project_id, revision_key),
  CONSTRAINT bzm_2_model_revisions_project_order_uniq UNIQUE (project_id, revision_order),
  CONSTRAINT bzm_2_model_revisions_order_check CHECK (revision_order > 0),
  CONSTRAINT bzm_2_model_revisions_validation_count_check CHECK (forward_validation_count >= 0),
  CONSTRAINT bzm_2_model_revisions_status_check CHECK (
    measurement_status IN ('preregistration_open', 'measurement_ready', 'measured_hypothesis')
  ),
  CONSTRAINT bzm_2_model_revisions_nonempty_check CHECK (
    btrim(revision_key) <> ''
    AND btrim(theory_version) <> ''
    AND btrim(model_version) <> ''
    AND btrim(revision_reason) <> ''
    AND btrim(source_ref) <> ''
  )
);

CREATE INDEX IF NOT EXISTS bzm_2_model_revisions_project_order_idx
  ON public.bzm_2_model_revisions(project_id, revision_order DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.bzm_2_parameter_observations (
  observation_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id       uuid NOT NULL REFERENCES public.bzm_2_model_revisions(revision_id) ON DELETE CASCADE,
  parameter_key     text NOT NULL,
  symbol            text NOT NULL,
  label             text NOT NULL,
  parameter_group   text NOT NULL,
  value_json        jsonb,
  display_value     text NOT NULL,
  value_status      text NOT NULL,
  unit              text,
  evidence_kind     text NOT NULL,
  evidence_ref      text,
  affects           text[] NOT NULL DEFAULT '{}',
  condition_json    jsonb NOT NULL DEFAULT '{}'::jsonb,
  note              text,
  sort_order        integer NOT NULL DEFAULT 100,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bzm_2_parameter_observations_revision_key_uniq UNIQUE (revision_id, parameter_key),
  CONSTRAINT bzm_2_parameter_observations_group_check CHECK (
    parameter_group IN ('result', 'clock', 'state', 'node', 'cash', 'quality')
  ),
  CONSTRAINT bzm_2_parameter_observations_status_check CHECK (
    value_status IN ('calculated', 'observed', 'conditional', 'estimated', 'partial', 'missing', 'not_started')
  ),
  CONSTRAINT bzm_2_parameter_observations_evidence_check CHECK (
    evidence_kind IN ('calculation', 'document', 'record', 'hearing', 'assumption', 'mixed', 'none')
  ),
  CONSTRAINT bzm_2_parameter_observations_value_check CHECK (
    (
      value_status IN ('missing', 'not_started')
      AND value_json IS NULL
    )
    OR
    (
      value_status NOT IN ('missing', 'not_started')
      AND value_json IS NOT NULL
    )
  ),
  CONSTRAINT bzm_2_parameter_observations_source_check CHECK (
    (evidence_kind = 'none' AND evidence_ref IS NULL)
    OR
    (evidence_kind <> 'none' AND evidence_ref IS NOT NULL AND btrim(evidence_ref) <> '')
  ),
  CONSTRAINT bzm_2_parameter_observations_condition_object_check CHECK (
    jsonb_typeof(condition_json) = 'object'
  ),
  CONSTRAINT bzm_2_parameter_observations_nonempty_check CHECK (
    btrim(parameter_key) <> ''
    AND btrim(symbol) <> ''
    AND btrim(label) <> ''
    AND btrim(display_value) <> ''
    AND sort_order >= 0
  )
);

CREATE INDEX IF NOT EXISTS bzm_2_parameter_observations_revision_order_idx
  ON public.bzm_2_parameter_observations(revision_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS bzm_2_parameter_observations_key_idx
  ON public.bzm_2_parameter_observations(parameter_key, created_at DESC);

COMMENT ON TABLE public.bzm_2_model_revisions IS
  'PJ別BZM 2.0測定版の追記台帳。計算済みでも前向き検証済みとは限らない';
COMMENT ON COLUMN public.bzm_2_model_revisions.information_cutoff IS
  'その版が利用できた情報の締切。後から得た結果で過去入力を書き換えない';
COMMENT ON TABLE public.bzm_2_parameter_observations IS
  '版ごとのBZM 2.0パラメータ。新しい共通状態はparameter_keyの追加で表す';
COMMENT ON COLUMN public.bzm_2_parameter_observations.affects IS
  'その状態または入力が条件づける工程や時計。独立加点を意味しない';

ALTER TABLE public.bzm_2_model_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bzm_2_parameter_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bzm_2_model_revisions_members_read" ON public.bzm_2_model_revisions;
CREATE POLICY "bzm_2_model_revisions_members_read" ON public.bzm_2_model_revisions
  FOR SELECT TO authenticated
  USING (public.amd_os_is_member());

DROP POLICY IF EXISTS "bzm_2_model_revisions_service" ON public.bzm_2_model_revisions;
CREATE POLICY "bzm_2_model_revisions_service" ON public.bzm_2_model_revisions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "bzm_2_parameter_observations_members_read" ON public.bzm_2_parameter_observations;
CREATE POLICY "bzm_2_parameter_observations_members_read" ON public.bzm_2_parameter_observations
  FOR SELECT TO authenticated
  USING (public.amd_os_is_member());

DROP POLICY IF EXISTS "bzm_2_parameter_observations_service" ON public.bzm_2_parameter_observations;
CREATE POLICY "bzm_2_parameter_observations_service" ON public.bzm_2_parameter_observations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- SXのq版推移。撤回済みv0.1は入れない。
INSERT INTO public.bzm_2_model_revisions (
  project_id, revision_key, revision_order, theory_version, model_version,
  measurement_status, information_cutoff, forward_validation_count, revision_reason, source_ref
)
SELECT
  projects.project_id, seed.revision_key, seed.revision_order, seed.theory_version, seed.model_version,
  'measured_hypothesis', '2026-08-07T23:59:59+09:00'::timestamptz, 0, seed.revision_reason, seed.source_ref
FROM public.projects AS projects
CROSS JOIN (VALUES
  ('v0.2', 2, 'theory-fixed v1.0', 'gself-path-pert-v0.2',
   '工程を条件付き確率とPERT時間で結んだ最初の共同経路計算',
   'pwa/bzm/pilot/sps-2-0-sx-results-v0.2.json'),
  ('v0.3', 3, 'theory-fixed v1.0', 'gself-path-cashflow-v0.3',
   'Seed期限を資金の崖として導入したが、設立工程の時間順序を誤読していた',
   'pwa/bzm/pilot/sps-2-0-sx-results-v0.3.json'),
  ('v0.4', 4, 'theory-fixed v1.0', 'gself-path-cashflow-v0.4',
   '設立準備と技術工程の並行関係を訂正し、時間入力を再較正した',
   'pwa/bzm/pilot/sps-2-0-sx-results-v0.4.json'),
  ('v0.5', 5, 'theory-fixed v1.1 / SX qは再計算なし', 'gself-path-cashflow-v0.5',
   '前段確率と時計の二重計上を解消し、全フェーズの月次資金繰りと感度を実装した',
   'pwa/bzm/pilot/sps-2-0-sx-results-v0.5.json')
) AS seed(revision_key, revision_order, theory_version, model_version, revision_reason, source_ref)
WHERE projects.project_id = 'p21'
ON CONFLICT (project_id, revision_key) DO NOTHING;

INSERT INTO public.bzm_2_parameter_observations (
  revision_id, parameter_key, symbol, label, parameter_group, value_json, display_value,
  value_status, unit, evidence_kind, evidence_ref, note, sort_order
)
SELECT revisions.revision_id, 'q', 'q', '期限内到達見込み', 'result', seed.q_value, seed.display_value,
  'calculated', 'probability', 'calculation', revisions.source_ref, seed.note, 10
FROM public.bzm_2_model_revisions AS revisions
JOIN (VALUES
  ('v0.2', '0.0131'::jsonb, '0.0131', '初回の共同経路計算'),
  ('v0.3', '0.0016'::jsonb, '0.0016', '資金の崖を導入。時間順序の誤読を含む'),
  ('v0.4', '0.0335'::jsonb, '0.0335', '並行工程の訂正と時間再較正'),
  ('v0.5', '0.0415'::jsonb, '0.0415（95%CI 0.0378–0.0456）', '月次資金繰りと二重計上解消。前向き検証0件')
) AS seed(revision_key, q_value, display_value, note)
  ON seed.revision_key = revisions.revision_key
WHERE revisions.project_id = 'p21'
ON CONFLICT (revision_id, parameter_key) DO NOTHING;

INSERT INTO public.bzm_2_parameter_observations (
  revision_id, parameter_key, symbol, label, parameter_group, value_json, display_value,
  value_status, unit, evidence_kind, evidence_ref, affects, condition_json, note, sort_order
)
SELECT revisions.revision_id, seed.parameter_key, seed.symbol, seed.label, seed.parameter_group,
  seed.value_json, seed.display_value, seed.value_status, seed.unit, seed.evidence_kind,
  seed.evidence_ref, seed.affects, seed.condition_json, seed.note, seed.sort_order
FROM public.bzm_2_model_revisions AS revisions
CROSS JOIN (VALUES
  ('P', 'P', '潜在価値ベクトル', 'result', NULL::jsonb, '未着手', 'not_started', NULL::text, 'none', NULL::text, ARRAY[]::text[], '{}'::jsonb, '社会的価値尺度と条件付きDCFは未着手', 20),
  ('T_C', 'T_C', '到達時間', 'clock', '{"p05_months":50.4875,"median_months":54.007,"p95_months":55.5439}'::jsonb, '成功経路 中央54.0か月（p05 50.5 / p95 55.5）', 'calculated', 'months', 'calculation', 'pwa/bzm/pilot/sps-2-0-sx-results-v0.5.json', ARRAY['q']::text[], '{}'::jsonb, '成功経路415本の分布。全経路の平均ではない', 30),
  ('T_Y', 'T_Y', '戦略余力の喪失時間', 'clock', '{"implemented":["financial"],"missing":["customer_trust","team","ip_control","alternative_options"]}'::jsonb, '資金成分のみ実装 / 非資金時計は欠測', 'partial', NULL::text, 'mixed', 'pwa/bzm/sps-2-0-reachability-model.md#3.3', ARRAY['q']::text[], '{}'::jsonb, 'C_j/b_jはT_Y全体と等価ではない', 40),
  ('H_v', 'H_v', '計画上の期限', 'clock', '"2031-03-31"'::jsonb, '2031-03-31', 'observed', 'date', 'document', 'pwa/bzm/pilot/sps-2-0-sx-inputs-v0.5.json', ARRAY['q']::text[], '{}'::jsonb, '資金の崖とは別の判定条件', 50),
  ('Z_policy', 'Z_policy', '政策支援状態', 'state', NULL::jsonb, '欠測', 'missing', NULL::text, 'none', NULL::text, ARRAY[]::text[], '{}'::jsonb, 'SXではこの共通状態を測定していない', 60),
  ('node.founding.success', 'p_founding', '設立・着金までの累積成立', 'node', '0.63'::jsonb, '63%', 'conditional', 'probability', 'hearing', 'pwa/bzm/pilot/sps-2-0-sx-inputs-v0.5.json', ARRAY['T_C','q']::text[], '{"includes_deadline":"2027-04"}'::jsonb, '技術0.90×有償PoC0.80×Seed0.875。時期性込み', 100),
  ('node.P1.success', 'p_P1', 'Phase 1出口', 'node', '0.794'::jsonb, '79.4%', 'conditional', 'probability', 'hearing', 'pwa/bzm/pilot/sps-2-0-sx-inputs-v0.5.json', ARRAY['T_C','T_Y','q']::text[], '{}'::jsonb, 'Series A 6億円接続込み', 110),
  ('node.P1.time', 't_P1', 'Phase 1所要時間', 'node', '[12,17,26]'::jsonb, '12 / 17 / 26か月', 'estimated', 'PERT months', 'assumption', 'pwa/bzm/pilot/sps-2-0-sx-inputs-v0.5.json', ARRAY['T_C','T_Y','q']::text[], '{}'::jsonb, '最短 / 最頻 / 悲観', 111),
  ('node.P2.success', 'p_P2', 'Phase 2出口', 'node', '0.6'::jsonb, '60.0%', 'conditional', 'probability', 'hearing', 'pwa/bzm/pilot/sps-2-0-sx-inputs-v0.5.json', ARRAY['T_C','q']::text[], '{}'::jsonb, NULL::text, 120),
  ('node.P2.time', 't_P2', 'Phase 2所要時間', 'node', '[24,30,42]'::jsonb, '24 / 30 / 42か月', 'estimated', 'PERT months', 'assumption', 'pwa/bzm/pilot/sps-2-0-sx-inputs-v0.5.json', ARRAY['T_C','T_Y','q']::text[], '{}'::jsonb, '最短 / 最頻 / 悲観', 121),
  ('node.P3.success', 'p_P3', 'フロー自給到達', 'node', '0.833'::jsonb, '83.3%', 'conditional', 'probability', 'hearing', 'pwa/bzm/pilot/sps-2-0-sx-inputs-v0.5.json', ARRAY['T_C','q']::text[], '{}'::jsonb, NULL::text, 130),
  ('node.P3.time', 't_P3', 'Phase 3所要時間', 'node', '[0,3,12]'::jsonb, '0 / 3 / 12か月', 'estimated', 'PERT months', 'assumption', 'pwa/bzm/pilot/sps-2-0-sx-inputs-v0.5.json', ARRAY['T_C','T_Y','q']::text[], '{}'::jsonb, '最短 / 最頻 / 悲観', 131),
  ('cash.phase1.initial', 'C_1', 'Phase 1初期現金', 'cash', '150'::jsonb, '1.5億円', 'observed', 'million JPY', 'document', 'pwa/bzm/pilot/sps-2-0-sx-inputs-v0.5.json', ARRAY['T_Y','q']::text[], '{}'::jsonb, NULL::text, 200),
  ('cash.phase1.burn', 'b_1', 'Phase 1純燃焼', 'cash', '[4.5,6.5,10]'::jsonb, '450 / 650 / 1,000万円/月', 'estimated', 'PERT million JPY/month', 'assumption', 'pwa/bzm/pilot/sps-2-0-sx-inputs-v0.5.json', ARRAY['T_Y','q']::text[], '{}'::jsonb, '最小 / 最頻 / 最大', 201),
  ('cash.phase2.in', 'C_2', 'Series A接続額', 'cash', '600'::jsonb, '6億円', 'observed', 'million JPY', 'document', 'pwa/bzm/pilot/sps-2-0-sx-inputs-v0.5.json', ARRAY['T_Y','q']::text[], '{}'::jsonb, NULL::text, 210),
  ('cash.phase2.burn', 'b_2', 'Phase 2純燃焼', 'cash', '[7,10,15]'::jsonb, '700 / 1,000 / 1,500万円/月', 'estimated', 'PERT million JPY/month', 'assumption', 'pwa/bzm/pilot/sps-2-0-sx-inputs-v0.5.json', ARRAY['T_Y','q']::text[], '{}'::jsonb, '最小 / 最頻 / 最大', 211),
  ('cash.phase3.burn', 'b_3', 'Phase 3純燃焼', 'cash', '[0,4,8]'::jsonb, '0 / 400 / 800万円/月', 'estimated', 'PERT million JPY/month', 'assumption', 'pwa/bzm/pilot/sps-2-0-sx-inputs-v0.5.json', ARRAY['T_Y','q']::text[], '{}'::jsonb, '最小 / 最頻 / 最大', 220)
) AS seed(parameter_key, symbol, label, parameter_group, value_json, display_value, value_status, unit, evidence_kind, evidence_ref, affects, condition_json, note, sort_order)
WHERE revisions.project_id = 'p21' AND revisions.revision_key = 'v0.5'
ON CONFLICT (revision_id, parameter_key) DO NOTHING;

-- LSTは結合構造と時間・現金が欠測なので、qを計算せず事前登録状態をそのまま表示する。
INSERT INTO public.bzm_2_model_revisions (
  project_id, revision_key, revision_order, theory_version, model_version,
  measurement_status, information_cutoff, forward_validation_count, revision_reason, source_ref
)
SELECT
  projects.project_id, 'v0.1', 1, 'theory-fixed v1.1', 'lst-preregistration-open-v0.1',
  'preregistration_open', '2026-08-10T23:59:59+09:00'::timestamptz, 0,
  '4フェーズ3レーンと条件付き確信度を取得。依存グラフ、時間三点幅、C0は欠測のため計算前で停止',
  'pwa/bzm/SPS_2_0_PREREGISTRATION_LST_2026-08-09.md'
FROM public.projects AS projects
WHERE projects.project_id = 'p07'
ON CONFLICT (project_id, revision_key) DO NOTHING;

INSERT INTO public.bzm_2_parameter_observations (
  revision_id, parameter_key, symbol, label, parameter_group, value_json, display_value,
  value_status, unit, evidence_kind, evidence_ref, affects, condition_json, note, sort_order
)
SELECT revisions.revision_id, seed.parameter_key, seed.symbol, seed.label, seed.parameter_group,
  seed.value_json, seed.display_value, seed.value_status, seed.unit, seed.evidence_kind,
  seed.evidence_ref, seed.affects, seed.condition_json, seed.note, seed.sort_order
FROM public.bzm_2_model_revisions AS revisions
CROSS JOIN (VALUES
  ('q', 'q', '期限内到達見込み', 'result', NULL::jsonb, '欠測', 'missing', 'probability'::text, 'none', NULL::text, ARRAY[]::text[], '{}'::jsonb, '依存グラフ、時間三点幅、C0が揃うまで計算しない', 10),
  ('P', 'P', '潜在価値ベクトル', 'result', NULL::jsonb, '未着手', 'not_started', NULL::text, 'none', NULL::text, ARRAY[]::text[], '{}'::jsonb, '社会的価値尺度と条件付きDCFは未着手', 20),
  ('T_C', 'T_C', '到達時間', 'clock', NULL::jsonb, '時間三点幅 未取得', 'missing', 'months', 'none', NULL::text, ARRAY['q']::text[], '{}'::jsonb, '経営会議と取締役会で出た実数から埋める', 30),
  ('T_Y', 'T_Y', '戦略余力の喪失時間', 'clock', NULL::jsonb, 'C0未取得 / FY2027前後に大型調達の崖', 'missing', 'months', 'none', NULL::text, ARRAY['q']::text[], '{}'::jsonb, '資金時計を含め未計算。非資金成分も時計として欠測', 40),
  ('H_v', 'H_v', '計画上の期限', 'clock', '"2031-03-31"'::jsonb, '2031-03-31', 'observed', 'date', 'document', 'pwa/bzm/SPS_2_0_PREREGISTRATION_LST_2026-08-09.md', ARRAY['q']::text[], '{}'::jsonb, 'SXと同じ共通期限', 50),
  ('Z_policy', 'Z_policy', '政策支援状態', 'state', '"present"'::jsonb, 'present（hearing）', 'estimated', 'state', 'hearing', 'pwa/bzm/SPS_2_0_PREREGISTRATION_LST_2026-08-09.md#4.12', ARRAY['#2','#6','T_C','T_Y','q']::text[], '{"conditioned_inputs":{"#2":0.9,"#6":0.6},"counterfactual":"missing"}'::jsonb, '#2=90%と#6=60%に織り込み済み。独立加点はしない。文書・記録への格上げ待ち', 60),
  ('node.1.success', 'p_1', '#1 2号機検収', 'node', '0.8'::jsonb, '80%', 'conditional', 'probability', 'hearing', 'pwa/bzm/SPS_2_0_PREREGISTRATION_LST_2026-08-09.md#4.2', ARRAY['T_C','q']::text[], '{}'::jsonb, '失敗時の影響範囲は欠測', 101),
  ('node.1.failure_scope', 'scope_1', '#1 失敗範囲', 'node', NULL::jsonb, '欠測', 'missing', NULL::text, 'none', NULL::text, ARRAY['q']::text[], '{}'::jsonb, '詳細ヒアリングをまさへ一問ずつ続ける方式は打ち切り', 102),
  ('node.2.success', 'p_2', '#2 川崎整備ラウンド', 'node', '0.9'::jsonb, '90%', 'conditional', 'probability', 'hearing', 'pwa/bzm/SPS_2_0_PREREGISTRATION_LST_2026-08-09.md#4.12', ARRAY['T_C','T_Y','q']::text[], '{"Z_policy":"present"}'::jsonb, '失敗時は代替拠点へ分岐し、遅延と追加費用が発生', 110),
  ('node.3.success', 'p_3', '#3 量産品質達成', 'node', '0.7'::jsonb, '70%', 'conditional', 'probability', 'hearing', 'pwa/bzm/SPS_2_0_PREREGISTRATION_LST_2026-08-09.md#4.2', ARRAY['T_C','q']::text[], '{}'::jsonb, NULL::text, 120),
  ('node.4.success', 'p_4', '#4 ブラックマス安定調達', 'node', '0.6'::jsonb, '60%', 'conditional', 'probability', 'hearing', 'pwa/bzm/SPS_2_0_PREREGISTRATION_LST_2026-08-09.md#4.8', ARRAY['recycle_lane','R_rep','T_C','q']::text[], '{}'::jsonb, '失敗してもリサイクル由来だけが削れ、塩湖かん水経路は残る', 130),
  ('node.5.success', 'p_5', '#5 量産ユニット初受注・初出荷', 'node', '0.65'::jsonb, '65%', 'conditional', 'probability', 'hearing', 'pwa/bzm/SPS_2_0_PREREGISTRATION_LST_2026-08-09.md#4.2', ARRAY['T_C','q']::text[], '{}'::jsonb, '商談は品質達成と並行', 140),
  ('node.6.success', 'p_6', '#6 FY2027前後の大型調達', 'node', '0.6'::jsonb, '60%', 'conditional', 'probability', 'hearing', 'pwa/bzm/SPS_2_0_PREREGISTRATION_LST_2026-08-09.md#4.12', ARRAY['T_Y','q']::text[], '{"Z_policy":"present"}'::jsonb, '政策支援状態を織り込み済み。主たる資金の崖', 150),
  ('node.7.slope_mix', 'w_7', '#7 売上拡大の傾き', 'node', '0.5'::jsonb, '計画傾き50% / 下振れ傾き50%', 'conditional', 'mixture weight', 'hearing', 'pwa/bzm/SPS_2_0_PREREGISTRATION_LST_2026-08-09.md#4.6', ARRAY['T_C','q']::text[], '{}'::jsonb, '停止ノードではなく46億円ライン到達時刻の混合分布', 160),
  ('node.8.success', 'p_8', '#8 FY2030営業黒字化', 'node', '0.85'::jsonb, '85%', 'conditional', 'probability', 'hearing', 'pwa/bzm/SPS_2_0_PREREGISTRATION_LST_2026-08-09.md#4.2', ARRAY['T_C','q']::text[], '{}'::jsonb, 'すべての後に来る自走到達ノード', 170)
) AS seed(parameter_key, symbol, label, parameter_group, value_json, display_value, value_status, unit, evidence_kind, evidence_ref, affects, condition_json, note, sort_order)
WHERE revisions.project_id = 'p07' AND revisions.revision_key = 'v0.1'
ON CONFLICT (revision_id, parameter_key) DO NOTHING;
