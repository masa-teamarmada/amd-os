-- 002_proactive_initial_outbox_cx_sx_nims_zmp_alignment.sql
--
-- Follow-up seed proposal for the Proactive Operating Loop.
--
-- Apply only after commander review:
--   cd pwa && python3 -X utf8 scripts/apply_ddl.py scripts/seeds/002_proactive_initial_outbox_cx_sx_nims_zmp_alignment.sql
--
-- Safety notes:
-- - This file is a seed/apply proposal. Do not apply from worker threads that
--   are not allowed to write production DB state.
-- - ZMP's canonical AMD OS project id is `p19`; `zmp` is a legacy commander
--   routing scope left in place so the already-sent outbox can be recovered.
-- - NIMS is Stage0-1 internal preparation only. The NIMS outbox below is for
--   Masa/Riri/AMD-side confirmation and must not be treated as counterpart
--   sending, login setup, or an external NIMS request.

BEGIN;

WITH commander_routes(project_id, institution_id, commander_thread_id, thread_label) AS (
  VALUES
    ('p19', NULL::text, '019e7969-cc20-7eb1-a2e1-05a6334138a5', 'ZMP / OkuDoor 司令塔'),
    ('p20', 'inst_nims', '019e7969-ce48-78d1-b838-7bc43e01bfea', 'CX 司令塔'),
    ('p21', NULL::text, '019e796a-0f94-7f13-a5ae-9226fba2f6a2', 'SX 司令塔'),
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
        'p20',
        'inst_nims',
        '019e7969-ce48-78d1-b838-7bc43e01bfea',
        'deadline_followup',
        'deadline_approaching',
        'next_action_plan',
        'shared',
        'yellow',
        TIMESTAMPTZ '2026-06-03 18:00:00+09',
        'seed:2026-05-31:cx-nims-internal-readiness-plan',
        'CX: NIMS/CryoX設立準備の内部先手整理',
        'CX司令塔で、法人設立・契約・特許・CEO候補・資金計画・NIMS側に見せる情報/AMD内部に留める情報を一枚の内部論点表にする。',
        'CXのBefore 0推進とNIMS OS導入の先行事例が分断され、NIMS側レビュー前にAMD内部の準備論点が散らばる。',
        jsonb_build_array(
          jsonb_build_object(
            'source', 'pwa/design/proactive_operating_loop.md',
            'section', 'CX example flow',
            'snippet', 'NIMS / CryoX 法人設立準備、NIMS OS導入 FY27 の先行事例として、CX の運用品質が仕組みレイヤーにも影響する。'
          ),
          jsonb_build_object(
            'source', 'pwa/design/institution_tenant_access.md',
            'section', 'Pilot gate',
            'snippet', 'NIMS Pilot 前に外部機関向けデータ分離・権限設計が必要。'
          )
        )
      ),
      (
        'p21',
        NULL::text,
        '019e796a-0f94-7f13-a5ae-9226fba2f6a2',
        'deadline_followup',
        'deadline_approaching',
        'next_action_plan',
        'amd',
        'yellow',
        TIMESTAMPTZ '2026-06-03 18:00:00+09',
        'seed:2026-05-31:sx-fy26-first-move-plan',
        'SX: FY26/愛媛大向け先手整理',
        'SX司令塔で、FY26見積・月次進捗・PSI/GAP/顧客候補・次にAMDから提示できる一手を内部用next action planとしてまとめる。',
        '国策・PoC・愛媛大連携の機会が多い中で、AMD側の先手提案が散らばり、相手からの確認待ちに寄りやすくなる。',
        jsonb_build_array(
          jsonb_build_object(
            'source', 'pwa/design/proactive_operating_loop.md',
            'section', 'Initial project coverage',
            'snippet', 'SX は愛媛大 / PSI / 国策・PoC機会が多く、先手提案の価値が高い。'
          ),
          jsonb_build_object(
            'source', 'pwa/design/project_pl_monthly.md',
            'section', 'SX FY25 / FY26 と入金タイミング',
            'snippet', 'SX FY2026 は 2026-06-01 から 2027-03-31 の業務期間として整理済み。'
          )
        )
      ),
      (
        'nims_os',
        'inst_nims',
        '019e7c8b-29a3-7fd3-955e-d7471fe883a2',
        'strategy_signal_action',
        'strategy_signal_needs_action',
        'agenda',
        'amd',
        'green',
        TIMESTAMPTZ '2026-06-05 18:00:00+09',
        'seed:2026-05-31:nims-stage0-1-internal-confirmation',
        'NIMS OS導入: Stage0-1 まさ/りり内部確認 agenda',
        'NIMS / AMD OS導入司令塔で、導入目的、Pilot対象、NIMS側準備責任者、データ分離、ログイン前提にしない内部確認項目をまさ/りり向けagendaにする。',
        'Stage0-1の確認前に外部送付やログイン前提の議論へ進むと、NIMS側の期待値・権限・データ分離が未確定のまま進んでしまう。',
        jsonb_build_array(
          jsonb_build_object(
            'source', 'docs/strategy/2026-06-nims-os-installation-gates-pricing.md',
            'section', 'NIMS install start gate',
            'snippet', 'NIMS向けAMD OS導入は、2026年中に急いで外部公開運用を始めるのではなく、開始ゲートを先に合意する。'
          ),
          jsonb_build_object(
            'source', 'pwa/scheduled-tasks/amd-os-proactive-heartbeat/SKILL.md',
            'section', 'Safety Rules',
            'snippet', 'Do not create new NIMS outbox unless due_at / agenda is explicitly decided elsewhere.'
          )
        )
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
    jsonb_build_object(
      'seeded_by', '002_proactive_initial_outbox_cx_sx_nims_zmp_alignment.sql',
      'external_send_allowed', false
    ),
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
  jsonb_build_object(
    'seeded_by', '002_proactive_initial_outbox_cx_sx_nims_zmp_alignment.sql',
    'external_send_allowed', false
  ),
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
    WHEN public.proactive_outbox.status IN ('sent_to_counterpart', 'closed', 'drafted') THEN public.proactive_outbox.status
    ELSE 'queued'
  END,
  evidence_refs = EXCLUDED.evidence_refs,
  metadata_json = public.proactive_outbox.metadata_json || EXCLUDED.metadata_json,
  updated_at = now();

COMMIT;
