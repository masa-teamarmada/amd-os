-- 001_proactive_commander_threads_seed.sql
--
-- Initial routing and minimal manual outbox seed for the Proactive Operating
-- Loop / 先手力維持ループ.
--
-- Apply with:
--   cd pwa && python3 -X utf8 scripts/apply_ddl.py scripts/seeds/001_proactive_commander_threads_seed.sql
--
-- Notes:
-- - project_commander_threads.project_id is intentionally TEXT without a
--   projects FK, so `zmp` and `nims_os` can be routed as commander scopes.
-- - `nims` is not the live institution id in the current DB. The live row is
--   `inst_nims`, so NIMS-related routes use that id.
-- - Initial outbox rows are limited to cases where a due_at can be placed from
--   the design/current seed context without inventing a counterpart schedule.

BEGIN;

WITH commander_routes(project_id, institution_id, commander_thread_id, thread_label) AS (
  VALUES
    ('p25', NULL::text, '019e7969-cd0a-7fd1-bc66-d70dc49be6f8', 'KUTE 司令塔'),
    ('zmp', NULL::text, '019e7969-cc20-7eb1-a2e1-05a6334138a5', 'ZMP / OkuDoor 司令塔'),
    ('p20', 'inst_nims', '019e7969-ce48-78d1-b838-7bc43e01bfea', 'CX 司令塔'),
    ('p21', NULL::text, '019e796a-0f94-7f13-a5ae-9226fba2f6a2', 'SX 司令塔'),
    ('p26', NULL::text, '019e7969-cf89-7742-9935-f91b90e61062', 'VSX / 香川大 司令塔'),
    ('nims_os', 'inst_nims', '019e7c8b-29a3-7fd3-955e-d7471fe883a2', 'NIMS / AMD OS導入 司令塔')
)
INSERT INTO public.project_commander_threads (
  project_id,
  institution_id,
  commander_thread_id,
  thread_label,
  status,
  created_by
)
SELECT
  route.project_id,
  route.institution_id,
  route.commander_thread_id,
  route.thread_label,
  'active',
  'codex_worker'
FROM commander_routes route
WHERE route.institution_id IS NULL
  OR EXISTS (
    SELECT 1
    FROM public.institutions inst
    WHERE inst.institution_id = route.institution_id
  )
ON CONFLICT (project_id, commander_thread_id)
DO UPDATE SET
  institution_id = EXCLUDED.institution_id,
  thread_label = EXCLUDED.thread_label,
  status = 'active',
  updated_at = now();

WITH outbox_seed AS (
  SELECT *
  FROM (
    VALUES
      (
        'p25',
        NULL::text,
        '019e7969-cd0a-7fd1-bc66-d70dc49be6f8',
        'next_meeting_preparation',
        'next_meeting_due',
        'roadmap',
        'amd',
        'red',
        TIMESTAMPTZ '2026-06-08 18:00:00+09',
        'seed:2026-05-31:kute-kickoff-roadmap',
        'KUTE: キックオフMTG前の年間スケジュール案',
        '6/11 キックオフ前に、6月の認定規程だけでなく、7規程・シーズ発掘・after GTIEまでを一本の制度設計ロードマップとして先に提示する。',
        '規程作成業者に見え、KUTE PJ の本来価値である大学発SUエコシステム設計者としての主導権が弱くなる。',
        jsonb_build_array(jsonb_build_object(
          'source', 'pwa/design/proactive_operating_loop.md',
          'section', 'KUTE example flow',
          'snippet', '6/11 キックオフ用 agenda と、6月から2027年1月までの制度設計ロードマップを AMD 側から提示する。'
        ))
      ),
      (
        'zmp',
        NULL::text,
        '019e7969-cc20-7eb1-a2e1-05a6334138a5',
        'strategy_signal_action',
        'strategy_signal_needs_action',
        'proposal',
        'ambiguous',
        'yellow',
        TIMESTAMPTZ '2026-06-03 18:00:00+09',
        'seed:2026-05-31:zmp-tus-next-action',
        'ZMP: 理科大連携の次アクション案',
        '理科大連携について、堂脇先生への接続判断に必要な論点、葛飾ロード側の関心、次回打診文面案をこたさんへ先手共有する。',
        '葛飾ロード側から催促され、AMD が ZeMA プロジェクト統括として先に動けていない印象になる。',
        jsonb_build_array(jsonb_build_object(
          'source', 'pwa/design/proactive_operating_loop.md',
          'section', 'ZMP / 理科大 example flow',
          'snippet', 'こたさんから聞かれる前に、AMD から連携提案を進める必要がある。'
        ))
      ),
      (
        'p26',
        NULL::text,
        '019e7969-cf89-7742-9935-f91b90e61062',
        'ambiguous_ball',
        'ball_ambiguous',
        'next_action_plan',
        'ambiguous',
        'red',
        TIMESTAMPTZ '2026-05-30 18:00:00+09',
        'seed:2026-05-31:vsx-kagawa-next-action-plan',
        'VSX: 初回顔合わせ後の次の進め方案',
        '初回顔合わせ後の熱が残っているうちに、称号・クロアポ・株式・赤字補填・GAP候補・下川案件 next action・香川大エコシステム構築の扱いを一枚に整理して提示する。',
        '初回訪問で得た信頼とスコープ拡大の熱が落ち、香川大側から次の整理を待つ状態になる。',
        jsonb_build_array(jsonb_build_object(
          'source', 'pwa/design/proactive_operating_loop.md',
          'section', '香川大 / VSX example flow',
          'snippet', 'ボールは曖昧。AMD から次の進め方を提示できる。'
        ))
      )
  ) AS seed(
    project_id,
    institution_id,
    commander_thread_id,
    loop_kind,
    trigger_type,
    draft_type,
    ball_owner,
    priority,
    due_at,
    source_id,
    title,
    recommended_first_move,
    risk_if_late,
    evidence_refs
  )
),
upserted_loops AS (
  INSERT INTO public.proactive_loops (
    project_id,
    institution_id,
    commander_thread_id,
    loop_kind,
    source_kind,
    source_id,
    title,
    summary,
    ball_owner,
    priority,
    sla_due_at,
    status,
    evidence_refs,
    metadata_json,
    created_by
  )
  SELECT
    seed.project_id,
    seed.institution_id,
    seed.commander_thread_id,
    seed.loop_kind,
    'manual_seed',
    seed.source_id,
    seed.title,
    seed.recommended_first_move,
    seed.ball_owner,
    seed.priority,
    seed.due_at,
    'open',
    seed.evidence_refs,
    jsonb_build_object('seeded_by', '001_proactive_commander_threads_seed.sql'),
    'codex_worker'
  FROM outbox_seed seed
  ON CONFLICT (project_id, loop_kind, source_kind, source_id)
    WHERE source_id IS NOT NULL
  DO UPDATE SET
    institution_id = EXCLUDED.institution_id,
    commander_thread_id = EXCLUDED.commander_thread_id,
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    ball_owner = EXCLUDED.ball_owner,
    priority = EXCLUDED.priority,
    sla_due_at = EXCLUDED.sla_due_at,
    status = CASE
      WHEN public.proactive_loops.status = 'closed' THEN public.proactive_loops.status
      ELSE 'open'
    END,
    evidence_refs = EXCLUDED.evidence_refs,
    metadata_json = public.proactive_loops.metadata_json || EXCLUDED.metadata_json,
    updated_at = now()
  RETURNING loop_id, project_id, loop_kind, source_id
)
INSERT INTO public.proactive_outbox (
  loop_id,
  project_id,
  institution_id,
  source_kind,
  source_id,
  trigger_type,
  ball_owner,
  priority,
  draft_type,
  recommended_first_move,
  risk_if_late,
  due_at,
  commander_thread_id,
  status,
  evidence_refs,
  metadata_json,
  created_by
)
SELECT
  loop.loop_id,
  seed.project_id,
  seed.institution_id,
  'manual_seed',
  seed.source_id,
  seed.trigger_type,
  seed.ball_owner,
  seed.priority,
  seed.draft_type,
  seed.recommended_first_move,
  seed.risk_if_late,
  seed.due_at,
  seed.commander_thread_id,
  'queued',
  seed.evidence_refs,
  jsonb_build_object('seeded_by', '001_proactive_commander_threads_seed.sql'),
  'codex_worker'
FROM outbox_seed seed
JOIN upserted_loops loop
  ON loop.project_id = seed.project_id
 AND loop.source_id = seed.source_id
ON CONFLICT (project_id, trigger_type, source_id, draft_type)
  WHERE source_id IS NOT NULL
DO UPDATE SET
  loop_id = EXCLUDED.loop_id,
  institution_id = EXCLUDED.institution_id,
  ball_owner = EXCLUDED.ball_owner,
  priority = EXCLUDED.priority,
  recommended_first_move = EXCLUDED.recommended_first_move,
  risk_if_late = EXCLUDED.risk_if_late,
  due_at = EXCLUDED.due_at,
  commander_thread_id = EXCLUDED.commander_thread_id,
  status = CASE
    WHEN public.proactive_outbox.status IN ('sent_to_counterpart', 'closed') THEN public.proactive_outbox.status
    ELSE 'queued'
  END,
  evidence_refs = EXCLUDED.evidence_refs,
  metadata_json = public.proactive_outbox.metadata_json || EXCLUDED.metadata_json,
  updated_at = now();

COMMIT;
