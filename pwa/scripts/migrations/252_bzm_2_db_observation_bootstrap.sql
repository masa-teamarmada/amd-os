-- 252_bzm_2_db_observation_bootstrap.sql
--
-- SX / LST以外で現行SPSを持つ10PJについて、2026-08-10時点でAMD OSの
-- 構造化DBから確認できた事実だけをBZM 2.0観測台帳へ凍結する。
-- 既存SPS入力、終了状態、累積調達額をq、P、T_C、T_Y、H_vへ読み替えない。
-- 因果接続が未確定の値はaffectsを空にし、欠測は0へ変換しない。

ALTER TABLE public.bzm_2_model_revisions
  DROP CONSTRAINT IF EXISTS bzm_2_model_revisions_status_check;
ALTER TABLE public.bzm_2_model_revisions
  ADD CONSTRAINT bzm_2_model_revisions_status_check CHECK (
    measurement_status IN ('data_collection', 'preregistration_open', 'measurement_ready', 'measured_hypothesis')
  );

ALTER TABLE public.bzm_2_parameter_observations
  DROP CONSTRAINT IF EXISTS bzm_2_parameter_observations_group_check;
ALTER TABLE public.bzm_2_parameter_observations
  ADD CONSTRAINT bzm_2_parameter_observations_group_check CHECK (
    parameter_group IN ('result', 'clock', 'state', 'context', 'node', 'cash', 'quality')
  );

INSERT INTO public.bzm_2_model_revisions (
  project_id, revision_key, revision_order, theory_version, model_version,
  measurement_status, information_cutoff, forward_validation_count, revision_reason, source_ref
)
SELECT
  projects.project_id,
  'v0.1',
  1,
  'theory-fixed v1.1',
  'db-observation-bootstrap-v0.1',
  'data_collection',
  '2026-08-10T18:32:28+09:00'::timestamptz,
  0,
  'AMD OSの構造化DBからPJ状態、設立、支援期間、政策支援、現行SPS入力、証拠被覆、資金調達履歴を凍結。依存グラフ、時間、資金時計は未接続のためqを計算しない',
  'pwa/scripts/migrations/252_bzm_2_db_observation_bootstrap.sql'
FROM public.projects AS projects
WHERE projects.project_id IN ('p03', 'p04', 'p06', 'p09', 'p11', 'p18', 'p20', 'p24', 'p26', 'p29')
ON CONFLICT (project_id, revision_key) DO NOTHING;

WITH project_seed(project_id, payload) AS (
  VALUES
    ('p03', '{
      "lifecycle":{"value":{"status":"ended","start_ym":"202204","end_ym":null},"display":"終了 / 終了月未登録","status":"partial"},
      "incorporation":{"value":{"founded_at":"2012-11-02","temporal_status":"incorporated"},"display":"設立 2012-11-02","status":"observed"},
      "support":{"value":{"amd_role":"founder_studio","started_at":null,"ended_at":null},"display":"founder_studio / 支援期間未登録","status":"partial"},
      "policy":{"value":{"state":"past_support_only","adopted_or_active":0,"completed":2,"applied":0,"known_amount_yen":0},"display":"過去の公的支援2件 / 現行はDB上未確認","status":"partial"},
      "score":{"value":{"evaluated_at":"2024-09-01","trl":6,"brl":3,"grl":5,"srl":4,"hrl":2,"frl":4,"prs_potential":8,"prs_r_net":0,"evaluator":"cron_l2_extract"},"display":"TRL 6 / BRL 3 / GRL 5 / SRL 4 / HRL 2 / FRL 4"},
      "coverage":{"value":{"project_knowledge":0,"meetings":0,"documents":0,"xrl_evidence":{},"founding_members":0,"strategy_signals":{},"events":1,"valuation_rounds":5,"pl_months":0},"display":"知識0 / 会議0 / 文書0 / XRL証拠0 / 調達5"},
      "funding":{"value":{"rounds":5,"known_raised_yen":1420000000},"display":"5件 / 既知合計14.2億円","status":"observed"}
    }'::jsonb),
    ('p04', '{
      "lifecycle":{"value":{"status":"ended","start_ym":"202304","end_ym":null},"display":"終了 / 終了月未登録","status":"partial"},
      "incorporation":{"value":{"founded_at":"2022-04-01","temporal_status":"incorporated"},"display":"設立 2022-04-01","status":"observed"},
      "support":{"value":{"amd_role":"studio","started_at":null,"ended_at":null},"display":"studio / 支援期間未登録","status":"partial"},
      "policy":{"value":{"state":"past_support_only","adopted_or_active":0,"completed":1,"applied":0,"known_amount_yen":0},"display":"過去の公的支援1件 / 現行はDB上未確認","status":"partial"},
      "score":{"value":{"evaluated_at":"2026-01-01","trl":6,"brl":5,"grl":4,"srl":5,"hrl":4,"frl":8,"prs_potential":6,"prs_r_net":4,"evaluator":"tsukuyomi"},"display":"TRL 6 / BRL 5 / GRL 4 / SRL 5 / HRL 4 / FRL 8"},
      "coverage":{"value":{"project_knowledge":0,"meetings":0,"documents":0,"xrl_evidence":{},"founding_members":0,"strategy_signals":{},"events":0,"valuation_rounds":2,"pl_months":0},"display":"知識0 / 会議0 / 文書0 / XRL証拠0 / 調達2"},
      "funding":{"value":{"rounds":2,"known_raised_yen":150000000},"display":"2件 / 既知合計1.5億円","status":"observed"}
    }'::jsonb),
    ('p06', '{
      "lifecycle":{"value":{"status":"active","start_ym":"202306","end_ym":"202702"},"display":"Active / AMD契約 2023-06〜2027-02","status":"observed"},
      "incorporation":{"value":{"founded_at":"2023-04-01","temporal_status":"incorporated"},"display":"設立 2023-04-01","status":"observed"},
      "support":{"value":{"amd_role":"studio","started_at":"2023-06-01","ended_at":null},"display":"studio / 2023-06-01〜継続中","status":"observed"},
      "policy":{"value":{"state":"present","adopted_or_active":1,"completed":3,"applied":0,"known_current_amount_yen":300000000},"display":"現行の公的支援1件 / 既知3.0億円","status":"observed"},
      "score":{"value":{"evaluated_at":"2026-05-07","trl":6,"brl":4,"grl":8,"srl":7,"hrl":6,"frl":6,"prs_potential":8,"prs_r_net":0,"evaluator":"cron_l2_extract"},"display":"TRL 6 / BRL 4 / GRL 8 / SRL 7 / HRL 6 / FRL 6"},
      "coverage":{"value":{"project_knowledge":154,"meetings":24,"documents":0,"xrl_evidence":{"candidate":4},"founding_members":0,"strategy_signals":{"candidate":12},"events":0,"valuation_rounds":2,"pl_months":0},"display":"知識154 / 会議24 / 文書0 / XRL証拠4 / 調達2"},
      "funding":{"value":{"rounds":2,"known_raised_yen":250000000},"display":"2件 / 既知合計2.5億円","status":"observed"}
    }'::jsonb),
    ('p09', '{
      "lifecycle":{"value":{"status":"ended","start_ym":"202312","end_ym":"202603"},"display":"終了 / 2023-12〜2026-03","status":"observed"},
      "incorporation":{"value":{"founded_at":"2023-07-01","temporal_status":"incorporated"},"display":"設立 2023-07-01","status":"observed"},
      "support":{"value":{"amd_role":"support","started_at":"2025-11-01","ended_at":null},"display":"support / 終了日未登録","status":"partial"},
      "policy":{"value":{"state":"present","adopted_or_active":4,"completed":0,"applied":1,"known_applied_amount_yen":55812120},"display":"採択4件 + 申請1件","status":"observed"},
      "score":{"value":{"evaluated_at":"2026-07-01","trl":6.5,"brl":8,"grl":6,"srl":7,"hrl":6,"frl":5.5,"prs_potential":6,"prs_r_net":4,"evaluator":"えいみ"},"display":"TRL 6.5 / BRL 8 / GRL 6 / SRL 7 / HRL 6 / FRL 5.5"},
      "coverage":{"value":{"project_knowledge":636,"meetings":24,"documents":2,"xrl_evidence":{"confirmed":5},"founding_members":8,"strategy_signals":{"confirmed":4},"events":4,"valuation_rounds":3,"pl_months":1},"display":"知識636 / 会議24 / 文書2 / XRL証拠5 / 調達3"},
      "funding":{"value":{"rounds":3,"known_raised_yen":152956740},"display":"3件 / 既知合計1.53億円","status":"observed"}
    }'::jsonb),
    ('p11', '{
      "lifecycle":{"value":{"status":"ended","start_ym":"202404","end_ym":"202603"},"display":"終了 / 2024-04〜2026-03","status":"observed"},
      "incorporation":{"value":{"founded_at":"2019-04-01","temporal_status":"incorporated"},"display":"設立 2019-04-01","status":"observed"},
      "support":{"value":{"amd_role":"studio","started_at":"2026-02-01","ended_at":null},"display":"studio / 終了日未登録","status":"partial"},
      "policy":{"value":{"state":"present","adopted_or_active":2,"completed":1,"applied":0,"known_current_amount_yen":110000000},"display":"現行の公的支援2件 / 既知1.1億円","status":"observed"},
      "score":{"value":{"evaluated_at":"2026-04-30","trl":6,"brl":6,"grl":8,"srl":7,"hrl":5,"frl":6,"prs_potential":8,"prs_r_net":0,"evaluator":"l2_extract_sonnet"},"display":"TRL 6 / BRL 6 / GRL 8 / SRL 7 / HRL 5 / FRL 6"},
      "coverage":{"value":{"project_knowledge":140,"meetings":31,"documents":0,"xrl_evidence":{},"founding_members":1,"strategy_signals":{},"events":1,"valuation_rounds":0,"pl_months":0},"display":"知識140 / 会議31 / 文書0 / XRL証拠0 / 調達0"},
      "funding":{"value":{"rounds":0,"known_raised_yen":0},"display":"調達ラウンドDB記録なし","status":"partial"}
    }'::jsonb),
    ('p18', '{
      "lifecycle":{"value":{"status":"ended","start_ym":"202505","end_ym":"202509"},"display":"終了 / 2025-05〜2025-09","status":"observed"},
      "incorporation":{"value":{"founded_at":"2019-01-01","temporal_status":"incorporated"},"display":"設立 2019-01-01","status":"observed"},
      "support":{"value":{"amd_role":"studio","started_at":null,"ended_at":null},"display":"studio / 支援期間未登録","status":"partial"},
      "policy":{"value":{"state":"not_observed_in_db","adopted_or_active":0,"completed":0,"applied":0,"known_amount_yen":0},"display":"公的支援記録なし（欠測扱い）","status":"partial"},
      "score":{"value":{"evaluated_at":"2025-09-30","trl":4,"brl":1,"grl":4,"srl":4,"hrl":2,"frl":3,"prs_potential":2,"prs_r_net":0,"evaluator":"l2_extract_sonnet"},"display":"TRL 4 / BRL 1 / GRL 4 / SRL 4 / HRL 2 / FRL 3"},
      "coverage":{"value":{"project_knowledge":0,"meetings":1,"documents":0,"xrl_evidence":{},"founding_members":0,"strategy_signals":{},"events":0,"valuation_rounds":0,"pl_months":0},"display":"知識0 / 会議1 / 文書0 / XRL証拠0 / 調達0"},
      "funding":{"value":{"rounds":0,"known_raised_yen":0},"display":"調達ラウンドDB記録なし","status":"partial"}
    }'::jsonb),
    ('p20', '{
      "lifecycle":{"value":{"status":"active","start_ym":"202606","end_ym":"202609"},"display":"Active / AMD契約 2026-06〜2026-09","status":"observed"},
      "incorporation":{"value":{"founded_at":"2027-04-01","temporal_status":"planned"},"display":"設立予定 2027-04-01","status":"partial"},
      "support":{"value":{"amd_role":"founder_studio","started_at":"2025-11-01","ended_at":null},"display":"founder_studio / 2025-11-01〜継続中","status":"observed"},
      "policy":{"value":{"state":"application_only","adopted_or_active":0,"completed":0,"applied":1,"withdrawn":1},"display":"申請1件・撤回1件 / 採択はDB上未確認","status":"partial"},
      "score":{"value":{"evaluated_at":"2026-08-01","trl":4,"brl":5,"grl":6,"srl":6,"hrl":6,"frl":7,"prs_potential":null,"prs_r_net":null,"evaluator":"l2_extract_sonnet"},"display":"TRL 4 / BRL 5 / GRL 6 / SRL 6 / HRL 6 / FRL 7"},
      "coverage":{"value":{"project_knowledge":70,"meetings":39,"documents":5,"xrl_evidence":{"candidate":11,"confirmed":8,"rejected":12},"founding_members":4,"strategy_signals":{"candidate":17},"events":0,"valuation_rounds":0,"pl_months":0},"display":"知識70 / 会議39 / 文書5 / XRL証拠31 / 資本計画1"},
      "funding":{"value":{"rounds":0,"known_raised_yen":0},"display":"調達ラウンドDB記録なし","status":"partial"}
    }'::jsonb),
    ('p24', '{
      "lifecycle":{"value":{"status":"active","start_ym":"202604","end_ym":null},"display":"Active / 2026-04〜","status":"observed"},
      "incorporation":{"value":{"founded_at":"2014-10-01","temporal_status":"incorporated"},"display":"設立 2014-10-01","status":"observed"},
      "support":{"value":{"amd_role":"support","started_at":null,"ended_at":null},"display":"support / 支援期間未登録","status":"partial"},
      "policy":{"value":{"state":"present","adopted_or_active":2,"completed":3,"applied":0,"known_current_amount_yen":0},"display":"現行の公的支援・選定2件","status":"observed"},
      "score":{"value":{"evaluated_at":"2026-05-24T15:00:00Z","trl":6,"brl":2.5,"grl":4.5,"srl":4,"hrl":2.5,"frl":4.5,"prs_potential":null,"prs_r_net":null,"evaluator":"codex_manual_clg_public_drive_review_20260525"},"display":"TRL 6 / BRL 2.5 / GRL 4.5 / SRL 4 / HRL 2.5 / FRL 4.5"},
      "coverage":{"value":{"project_knowledge":0,"meetings":5,"documents":0,"xrl_evidence":{"candidate":6,"confirmed":1},"founding_members":0,"strategy_signals":{"archived":1,"candidate":3,"confirmed":5},"events":0,"valuation_rounds":5,"pl_months":0},"display":"知識0 / 会議5 / 文書0 / XRL証拠7 / 調達5"},
      "funding":{"value":{"rounds":5,"known_raised_yen":1980000000},"display":"5件 / 既知合計19.8億円","status":"observed"}
    }'::jsonb),
    ('p26', '{
      "lifecycle":{"value":{"status":"active","start_ym":"202605","end_ym":null},"display":"Active / 2026-05〜","status":"observed"},
      "incorporation":{"value":{"founded_at":null,"temporal_status":"not_observed"},"display":"設立日未登録","status":"partial"},
      "support":{"value":{"amd_role":"founder_studio","started_at":"2026-05-27","ended_at":null},"display":"founder_studio / 2026-05-27〜継続中","status":"observed"},
      "policy":{"value":{"state":"present","adopted_or_active":2,"completed":1,"applied":0,"known_historical_amount_yen":17030000},"display":"現行の公的支援2件","status":"observed"},
      "score":{"value":{"evaluated_at":"2026-05-27T03:00:00Z","trl":4,"brl":1.5,"grl":1,"srl":1.5,"hrl":2.5,"frl":5,"prs_potential":null,"prs_r_net":null,"evaluator":"amie_session_2026-05-27"},"display":"TRL 4 / BRL 1.5 / GRL 1 / SRL 1.5 / HRL 2.5 / FRL 5"},
      "coverage":{"value":{"project_knowledge":0,"meetings":16,"documents":0,"xrl_evidence":{"candidate":2},"founding_members":4,"strategy_signals":{"candidate":5},"events":0,"valuation_rounds":0,"pl_months":0},"display":"知識0 / 会議16 / 文書0 / XRL証拠2 / 調達0"},
      "funding":{"value":{"rounds":0,"known_raised_yen":0},"display":"調達ラウンドDB記録なし","status":"partial"}
    }'::jsonb),
    ('p29', '{
      "lifecycle":{"value":{"status":"sales","start_ym":"202606","end_ym":null},"display":"営業中 / 2026-06〜","status":"observed"},
      "incorporation":{"value":{"founded_at":null,"temporal_status":"not_observed"},"display":"設立日未登録","status":"partial"},
      "support":{"value":{"amd_role":"support","started_at":"2026-06-17","ended_at":null},"display":"support / 2026-06-17〜継続中","status":"observed"},
      "policy":{"value":{"state":"not_observed_in_db","adopted_or_active":0,"completed":0,"applied":0,"known_amount_yen":0},"display":"公的支援記録なし（欠測扱い）","status":"partial"},
      "score":{"value":{"evaluated_at":"2026-07-16T03:30:00Z","trl":2,"brl":1,"grl":1,"srl":0,"hrl":1,"frl":4,"prs_potential":7,"prs_r_net":3,"evaluator":"eimi_xrl_rnet_review_2026-07-16"},"display":"TRL 2 / BRL 1 / GRL 1 / SRL 0 / HRL 1 / FRL 4"},
      "coverage":{"value":{"project_knowledge":0,"meetings":7,"documents":0,"xrl_evidence":{},"founding_members":0,"strategy_signals":{},"events":0,"valuation_rounds":0,"pl_months":0},"display":"知識0 / 会議7 / 文書0 / XRL証拠0 / 調達0"},
      "funding":{"value":{"rounds":0,"known_raised_yen":0},"display":"調達ラウンドDB記録なし","status":"partial"}
    }'::jsonb)
), revision_seed AS (
  SELECT revisions.revision_id, project_seed.project_id, project_seed.payload
  FROM project_seed
  JOIN public.bzm_2_model_revisions AS revisions
    ON revisions.project_id = project_seed.project_id
   AND revisions.revision_key = 'v0.1'
)
INSERT INTO public.bzm_2_parameter_observations (
  revision_id, parameter_key, symbol, label, parameter_group, value_json, display_value,
  value_status, unit, evidence_kind, evidence_ref, affects, condition_json, note, sort_order
)
SELECT
  revision_seed.revision_id,
  observation.parameter_key,
  observation.symbol,
  observation.label,
  observation.parameter_group,
  observation.value_json,
  observation.display_value,
  observation.value_status,
  observation.unit,
  observation.evidence_kind,
  observation.evidence_ref,
  observation.affects,
  observation.condition_json,
  observation.note,
  observation.sort_order
FROM revision_seed
CROSS JOIN LATERAL (VALUES
  ('q', 'q', '期限内到達見込み', 'result', NULL::jsonb,
   '依存グラフ・時間・資金未接続', 'missing', 'probability'::text, 'none', NULL::text,
   ARRAY[]::text[], '{}'::jsonb, '観測データはあるが、qを出せる結合構造になっていない', 10),
  ('P', 'P', '潜在価値ベクトル', 'result', NULL::jsonb,
   '未着手', 'not_started', NULL::text, 'none', NULL::text,
   ARRAY[]::text[], '{}'::jsonb, '現行SPSのprs_potentialをBZM 2.0のPへ読み替えない', 20),
  ('T_C', 'T_C', '到達時間', 'clock', NULL::jsonb,
   '工程時間分布 未取得', 'missing', 'months', 'none', NULL::text,
   ARRAY['q']::text[], '{}'::jsonb, '工程の直列・並列・分岐と時間三点幅が未接続', 30),
  ('T_Y', 'T_Y', '戦略余力の喪失時間', 'clock', NULL::jsonb,
   '資金・非資金時計 未接続', 'missing', 'months', 'none', NULL::text,
   ARRAY['q']::text[], '{}'::jsonb, '累積調達額を現在現金C0または戦略余力と同一視しない', 40),
  ('H_v', 'H_v', '計画上の期限', 'clock', NULL::jsonb,
   '共通到達目標の期限 未設定', 'missing', 'date', 'none', NULL::text,
   ARRAY['q']::text[], '{}'::jsonb, 'AMD契約終了月をBZM 2.0の計画期限へ流用しない', 50),
  ('Z_policy', 'Z_policy', '政策支援状態', 'state', revision_seed.payload #> '{policy,value}',
   revision_seed.payload #>> '{policy,display}', revision_seed.payload #>> '{policy,status}', 'state', 'record',
   'AMD OS project_grants snapshot 2026-08-10', ARRAY[]::text[],
   '{"mapping_status":"unmapped","independent_bonus":false}'::jsonb,
   '公的支援の存在は認識するが、影響工程を確定するまで独立加点もqへの接続もしない。DBに行が無いことを不在証明にしない', 60),
  ('context.lifecycle', 'status_PJ', 'PJの現行状態', 'context', revision_seed.payload #> '{lifecycle,value}',
   revision_seed.payload #>> '{lifecycle,display}', revision_seed.payload #>> '{lifecycle,status}', NULL::text, 'record',
   'AMD OS projects snapshot 2026-08-10', ARRAY[]::text[],
   '{"use_as_predictor":false}'::jsonb,
   '現時点の状態。過去時点のqへ戻して使うと後知恵になるため、予測入力にはしない', 70),
  ('context.incorporation', 't_0', '設立状態', 'context', revision_seed.payload #> '{incorporation,value}',
   revision_seed.payload #>> '{incorporation,display}', revision_seed.payload #>> '{incorporation,status}', 'date', 'record',
   'AMD OS project_ventures snapshot 2026-08-10', ARRAY[]::text[], '{}'::jsonb,
   '情報締切より後のfounded_atは実績ではなく設立予定として扱う', 71),
  ('context.amd_support', 'AMD_role', 'AMD支援状態', 'context', revision_seed.payload #> '{support,value}',
   revision_seed.payload #>> '{support,display}', revision_seed.payload #>> '{support,status}', NULL::text, 'record',
   'AMD OS project_ventures snapshot 2026-08-10', ARRAY[]::text[], '{}'::jsonb,
   'AMDの介入は内生的なので、支援期間だけで介入効果を主張しない', 72),
  ('quality.current_sps_input', 'XRL_legacy', '現行SPS入力（BZM未接続）', 'quality', revision_seed.payload #> '{score,value}',
   revision_seed.payload #>> '{score,display}', 'observed', 'level', 'record',
   'AMD OS amd_score_inputs latest at cutoff', ARRAY[]::text[],
   '{"mapping_status":"unmapped","prs_potential_is_not_bzm_P":true}'::jsonb,
   '既存XRLは観測済みの代理情報として保持するが、BZM 2.0の条件付き確率や時計へ自動変換しない', 300),
  ('quality.evidence_coverage', 'coverage', '再構成可能な証拠の被覆', 'quality', revision_seed.payload #> '{coverage,value}',
   revision_seed.payload #>> '{coverage,display}', 'observed', 'record count', 'record',
   'AMD OS structured tables snapshot 2026-08-10', ARRAY[]::text[],
   '{"cutoff":"2026-08-10T18:32:28+09:00"}'::jsonb,
   '件数は証拠の量であり、真偽・成功確率・独立観測数を意味しない', 310),
  ('cash.funding_history', 'F_hist', '既知の資金調達履歴（C0ではない）', 'cash', revision_seed.payload #> '{funding,value}',
   revision_seed.payload #>> '{funding,display}', revision_seed.payload #>> '{funding,status}', 'JPY', 'record',
   'AMD OS project_valuation_rounds snapshot 2026-08-10', ARRAY[]::text[],
   '{"mapping_status":"unmapped","is_current_cash":false}'::jsonb,
   '累積調達額から現在現金、バーン、runway、T_Yを推定しない', 210)
) AS observation(
  parameter_key, symbol, label, parameter_group, value_json, display_value,
  value_status, unit, evidence_kind, evidence_ref, affects, condition_json, note, sort_order
)
ON CONFLICT (revision_id, parameter_key) DO NOTHING;
-- JCには2026-05末の現金とrunwayが手動記録されている。現在値へ外挿せず、
-- 当該時点の資金時計観測としてのみ接続する。
INSERT INTO public.bzm_2_parameter_observations (
  revision_id, parameter_key, symbol, label, parameter_group, value_json, display_value,
  value_status, unit, evidence_kind, evidence_ref, affects, condition_json, note, sort_order
)
SELECT
  revisions.revision_id, 'cash.snapshot.2026-05-31', 'C_0^{2026-05}', '現金・runwayスナップショット', 'cash',
  '{"as_of":"2026-05-31","cash_yen":141000000,"runway_months":17}'::jsonb,
  '2026-05末 1.41億円 / runway 17か月', 'observed', 'JPY / months', 'record',
  'AMD OS project_events p09 occurred_on=2026-05-31', ARRAY['T_Y','q']::text[],
  '{"as_of":"2026-05-31","extrapolated_to_cutoff":false}'::jsonb,
  '情報締切時点の現在現金ではない。支出内訳と月次更新が無いため、qは未計算のまま', 220
FROM public.bzm_2_model_revisions AS revisions
WHERE revisions.project_id = 'p09' AND revisions.revision_key = 'v0.1'
ON CONFLICT (revision_id, parameter_key) DO NOTHING;

-- CXには作業中の資本政策があるがfreezeされていない。存在だけを記録し、
-- 計画内の数値を到達時計や資金時計へ自動接続しない。
INSERT INTO public.bzm_2_parameter_observations (
  revision_id, parameter_key, symbol, label, parameter_group, value_json, display_value,
  value_status, unit, evidence_kind, evidence_ref, affects, condition_json, note, sort_order
)
SELECT
  revisions.revision_id, 'cash.capital_plan', 'F_plan', '資本政策プラン', 'cash',
  '{"name":"IPOまでの標準プラン","status":"active","revision":2,"latest_frozen_version":null,"updated_at":"2026-07-23T12:55:33.811Z"}'::jsonb,
  '作業中 rev.2 / 未freeze', 'partial', NULL::text, 'record',
  'AMD OS project_capital_plans p20', ARRAY[]::text[],
  '{"mapping_status":"unmapped","candidate_affects":["T_C","T_Y","q"]}'::jsonb,
  '未freezeの作業計画。入力を検証してから時計へ接続する', 221
FROM public.bzm_2_model_revisions AS revisions
WHERE revisions.project_id = 'p20' AND revisions.revision_key = 'v0.1'
ON CONFLICT (revision_id, parameter_key) DO NOTHING;
