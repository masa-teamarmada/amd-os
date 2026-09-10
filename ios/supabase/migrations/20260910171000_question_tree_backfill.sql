-- 20260910171000_question_tree_backfill.sql
--
-- 既存の管理データを問いの木へ移す。20260910170000_question_tree.sql の後に走る。
-- 正本: pwa/spec/3-21-question-tree-current-spec.md（まさ確定 2026-09-10）
--
-- 方針:
--   * 旧テーブルは読むだけで、UPDATE も DELETE もしない。撤去は別途まさの確認を経て行う。
--   * 旧行の id をそのまま新テーブルの id に使う。KPI や添付など旧IDを指す既存参照を
--     あとから張り替えられるようにするため。
--   * 情報を捨てない。新しい型に対応する列が無い旧列は detail / background へ文章として残す。
--   * 決着していないものを決着済みにしない。閉じた記録が存在するのは
--     decision_state='decided' かつ decision_text がある15件中の6件だけ。
--
-- 冪等性: ON CONFLICT (id) DO NOTHING と WHERE NOT EXISTS。再実行しても二重に入らない。

BEGIN;

-- =====================================================================
-- 1. 問い
--    親が先に存在している必要があるため、目的 → 成立条件 → 論点 → 仮説 → 判断 の順に入れる。
-- =====================================================================

-- 1-1. 目的 → 根の問い
INSERT INTO public.project_questions (
  id, project_id, parent_id, contribution, title, background,
  question_kind, status, confidence, owner_label, due_date,
  origin_kind, origin_ref, sort_order, last_verified_at,
  created_by, updated_by, created_at, updated_at, deleted_at, deleted_by, version
)
SELECT
  o.id, o.project_id, NULL, NULL, o.title,
  NULLIF(concat_ws(E'\n', NULLIF('達成条件: ' || o.definition_of_done, '達成条件: ')), ''),
  'open', 'open', o.confidence, '担当未確認', o.target_date,
  'migrated', 'project_management_objectives:' || o.slug, 0, o.last_verified_at,
  o.created_by, o.updated_by, o.created_at, o.updated_at, o.deleted_at, o.deleted_by, o.version
FROM public.project_management_objectives o
ON CONFLICT (id) DO NOTHING;

-- 1-2. 成立条件 → 目的の子（必須）
INSERT INTO public.project_questions (
  id, project_id, parent_id, contribution, title, background,
  question_kind, status, confidence, owner_label,
  origin_kind, origin_ref, sort_order, last_verified_at,
  created_by, updated_by, created_at, updated_at, deleted_at, deleted_by, version
)
SELECT
  oc.id, oc.project_id, oc.objective_id, 'required', oc.title,
  NULLIF(concat_ws(E'\n',
    NULLIF('達成条件: ' || oc.definition_of_done, '達成条件: '),
    '移行前の柱: ' || oc.track), ''),
  'open', 'open', oc.confidence, COALESCE(NULLIF(oc.owner_label, ''), '担当未確認'),
  'migrated', 'project_management_outcomes:' || oc.slug, 0, oc.last_verified_at,
  oc.created_by, oc.updated_by, oc.created_at, oc.updated_at, oc.deleted_at, oc.deleted_by, oc.version
FROM public.project_management_outcomes oc
WHERE EXISTS (SELECT 1 FROM public.project_questions q WHERE q.id = oc.objective_id)
ON CONFLICT (id) DO NOTHING;

-- 1-3. 論点 → 成立条件の子。成立条件が無いものは根に置く。
--      工程しか持たない論点は、その工程が属する成立条件へ寄せる。
INSERT INTO public.project_questions (
  id, project_id, parent_id, contribution, title, background,
  question_kind, status, confidence, owner_label, due_date,
  origin_kind, origin_ref, sort_order, last_verified_at,
  created_by, updated_by, created_at, updated_at, deleted_at, deleted_by, version
)
SELECT
  i.id, i.project_id,
  resolved.parent_id,
  CASE WHEN resolved.parent_id IS NULL THEN NULL ELSE 'required' END,
  i.title,
  NULLIF(concat_ws(E'\n', i.background, '移行前の柱: ' || i.track), ''),
  CASE WHEN i.knowledge_type IN ('decision', 'decision_needed') THEN 'decision' ELSE 'open' END,
  'open', i.confidence, COALESCE(NULLIF(i.owner_label, ''), '担当未確認'), i.due_date,
  'migrated', 'project_management_issues:' || i.slug, i.sort_order, i.last_verified_at,
  i.created_by, i.updated_by, i.created_at, i.updated_at, i.deleted_at, i.deleted_by, i.version
FROM public.project_management_issues i
CROSS JOIN LATERAL (
  SELECT (
    SELECT q.id FROM public.project_questions q
    WHERE q.id = COALESCE(
      i.outcome_id,
      (SELECT m.outcome_id FROM public.project_management_milestones m WHERE m.id = i.milestone_id)
    )
  ) AS parent_id
) resolved
ON CONFLICT (id) DO NOTHING;

-- 1-4. 仮説 → 論点の子（代替候補）
INSERT INTO public.project_questions (
  id, project_id, parent_id, contribution, title,
  question_kind, status, confidence, owner_label, due_date,
  origin_kind, origin_ref, sort_order, last_verified_at,
  created_at, updated_at, deleted_at, deleted_by, version
)
SELECT
  h.id, h.project_id, h.issue_id, 'alternative', h.statement,
  'open', 'open', h.confidence, COALESCE(NULLIF(h.owner_label, ''), '担当未確認'), h.due_date,
  'migrated', 'project_management_hypotheses', 0, h.last_verified_at,
  h.created_at, h.updated_at, h.deleted_at, h.deleted_by, h.version
FROM public.project_management_hypotheses h
WHERE EXISTS (SELECT 1 FROM public.project_questions q WHERE q.id = h.issue_id)
ON CONFLICT (id) DO NOTHING;

-- 1-5. 判断 → 仮説または論点の子。決着済みだけ answered にする。
INSERT INTO public.project_questions (
  id, project_id, parent_id, contribution, title, background,
  question_kind, status, answer, answered_on, answered_by,
  confidence, owner_label, due_date,
  origin_kind, origin_ref, sort_order, last_verified_at,
  created_at, updated_at, deleted_at, deleted_by, version
)
SELECT
  d.id, d.project_id, resolved.parent_id,
  CASE WHEN resolved.parent_id IS NULL THEN NULL ELSE 'required' END,
  d.title,
  NULLIF(concat_ws(E'\n', NULLIF(d.context, ''), NULLIF('判断の根拠: ' || d.rationale, '判断の根拠: ')), ''),
  'decision',
  CASE WHEN d.decision_state = 'decided' AND btrim(COALESCE(d.decision_text, '')) <> ''
       THEN 'answered' ELSE 'open' END,
  CASE WHEN d.decision_state = 'decided' AND btrim(COALESCE(d.decision_text, '')) <> ''
       THEN d.decision_text ELSE NULL END,
  CASE WHEN d.decision_state = 'decided' AND btrim(COALESCE(d.decision_text, '')) <> ''
       THEN d.decided_on ELSE NULL END,
  CASE WHEN d.decision_state = 'decided' AND btrim(COALESCE(d.decision_text, '')) <> ''
       THEN d.decided_by ELSE NULL END,
  d.confidence, COALESCE(NULLIF(d.owner_label, ''), '担当未確認'), d.due_date,
  'migrated', 'project_management_decisions', d.sort_order, d.last_verified_at,
  d.created_at, d.updated_at, d.deleted_at, d.deleted_by, d.version
FROM public.project_management_decisions d
CROSS JOIN LATERAL (
  SELECT (
    SELECT q.id FROM public.project_questions q
    WHERE q.id = COALESCE(d.hypothesis_id, d.issue_id)
  ) AS parent_id
) resolved
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 2. やること
--    親子は循環ガードが親の実在を要求するため、いったん全行を親なしで入れてから
--    親を張る。旧の工程は最上位のやること、旧タスクはその子になる。
-- =====================================================================

-- 2-1. 工程・予定日MS → やること
INSERT INTO public.project_actions (
  id, project_id, parent_id, title, detail, action_kind, status, owner_label,
  planned_start, planned_end, actual_end, date_certainty, progress_pct,
  done_criteria, done_evidence,
  origin_kind, origin_ref, sort_order, last_verified_at,
  created_at, updated_at, deleted_at, deleted_by, version
)
SELECT
  m.id, m.project_id, NULL, m.title,
  NULLIF(concat_ws(E'\n',
    NULLIF('ゲート: ' || m.gate, 'ゲート: '),
    NULLIF('次の成果: ' || m.next_deliverable, '次の成果: '),
    NULLIF('最大の論点: ' || m.max_issue, '最大の論点: '),
    NULLIF('移行前の柱: ' || m.track, '移行前の柱: ')), ''),
  'work',
  CASE m.status
    WHEN 'on_track' THEN 'running'
    WHEN 'attention' THEN 'running'
    WHEN 'blocked' THEN 'blocked'
    WHEN 'not_started' THEN 'not_started'
    ELSE 'unassessed'
  END,
  COALESCE(NULLIF(m.owner_label, ''), '担当未確認'),
  m.planned_start, m.planned_end, m.actual_end,
  COALESCE(m.date_certainty, 'provisional'),
  COALESCE(m.progress_pct, 0),
  NULLIF(m.completion_criteria, ''), NULLIF(m.completion_evidence, ''),
  'migrated', 'project_management_milestones:' || m.slug, m.sort_order, m.last_verified_at,
  m.created_at, m.updated_at, m.deleted_at, m.deleted_by, m.version
FROM public.project_management_milestones m
ON CONFLICT (id) DO NOTHING;

-- 2-2. タスク → やること（親はこの後に張る）
--      完了と記録されているのに完了日が無い行は、最終確認日を充当し、
--      充当した事実を完了証跡へ明記する。日付を黙って作らない。
INSERT INTO public.project_actions (
  id, project_id, parent_id, title, detail, action_kind, status, owner_label,
  planned_start, planned_end, actual_end, date_certainty, progress_pct, blocker,
  done_criteria, done_evidence,
  origin_kind, origin_ref, sort_order, last_verified_at,
  created_by, updated_by, created_at, updated_at, deleted_at, deleted_by, version
)
SELECT
  t.id, t.project_id, NULL, t.title,
  NULLIF(concat_ws(E'\n',
    NULLIF(t.description, ''),
    NULLIF('ねらい: ' || t.goal, 'ねらい: '),
    NULLIF('次の成果: ' || t.next_deliverable, '次の成果: ')), ''),
  'work',
  CASE t.status
    WHEN 'completed' THEN 'done'
    WHEN 'on_track' THEN 'running'
    WHEN 'attention' THEN 'running'
    WHEN 'blocked' THEN 'blocked'
    WHEN 'not_started' THEN 'not_started'
    ELSE 'unassessed'
  END,
  COALESCE(NULLIF(t.owner_label, ''), '担当未確認'),
  t.planned_start, t.planned_end,
  CASE WHEN t.status = 'completed' THEN COALESCE(t.actual_end, t.last_verified_at) ELSE t.actual_end END,
  COALESCE(t.date_certainty, 'provisional'),
  COALESCE(t.progress_pct, 0), NULLIF(t.blocker, ''),
  NULLIF(t.completion_criteria, ''),
  CASE WHEN t.status = 'completed' AND t.actual_end IS NULL
       THEN '移行時に完了日が記録されていなかったため、最終確認日を充当'
       ELSE NULL END,
  'migrated', 'project_management_tasks', t.sort_order, t.last_verified_at,
  t.created_by, t.updated_by, t.created_at, t.updated_at, t.deleted_at, t.deleted_by, t.version
FROM public.project_management_tasks t
ON CONFLICT (id) DO NOTHING;

-- 2-3. 技術試験 → 確かめる行為
INSERT INTO public.project_actions (
  id, project_id, parent_id, title, detail, action_kind, status, owner_label,
  actual_end, target, actual, unit, done_evidence,
  origin_kind, origin_ref, sort_order, last_verified_at,
  created_at, updated_at, deleted_at, deleted_by, version
)
SELECT
  tt.id, tt.project_id, NULL, tt.test_name,
  NULLIF(concat_ws(E'\n',
    NULLIF('条件: ' || tt.test_condition, '条件: '),
    NULLIF('反復: ' || tt.repetition, '反復: '),
    NULLIF('試料: ' || tt.sample, '試料: '),
    NULLIF('TRL判定基準: ' || tt.trl_criterion, 'TRL判定基準: ')), ''),
  'measure',
  CASE tt.status
    WHEN 'planned' THEN 'not_started'
    WHEN 'running' THEN 'running'
    WHEN 'blocked' THEN 'blocked'
    WHEN 'failed' THEN CASE WHEN tt.measured_on IS NOT NULL THEN 'done' ELSE 'running' END
    WHEN 'passed' THEN CASE WHEN tt.measured_on IS NOT NULL THEN 'done' ELSE 'running' END
    ELSE 'unassessed'
  END,
  COALESCE(NULLIF(tt.owner_label, ''), '担当未確認'),
  CASE WHEN tt.status IN ('failed', 'passed') THEN tt.measured_on ELSE NULL END,
  NULLIF(tt.target, ''), NULLIF(tt.actual, ''), NULLIF(tt.unit, ''),
  NULLIF(concat_ws(E'\n',
    NULLIF(tt.evidence, ''),
    CASE WHEN tt.status = 'failed' THEN '移行前の試験結果: 不成立' ELSE NULL END), ''),
  'migrated', 'project_management_technical_tests:' || tt.test_slug, 0, current_date,
  tt.created_at, tt.updated_at, tt.deleted_at, tt.deleted_by, tt.version
FROM public.project_management_technical_tests tt
ON CONFLICT (id) DO NOTHING;

-- 2-4. 検証 → 確かめる行為
INSERT INTO public.project_actions (
  id, project_id, parent_id, title, detail, action_kind, status, owner_label,
  planned_start, planned_end, actual_end,
  origin_kind, origin_ref, sort_order, last_verified_at,
  created_at, updated_at, deleted_at, deleted_by, version
)
SELECT
  v.id, v.project_id, NULL,
  COALESCE(NULLIF(v.method, ''), NULLIF(v.validation_kind, ''), '検証'),
  NULLIF(v.result_summary, ''),
  'measure',
  CASE v.status
    WHEN 'planned' THEN 'not_started'
    WHEN 'running' THEN 'running'
    WHEN 'blocked' THEN 'blocked'
    WHEN 'done' THEN CASE WHEN v.completed_on IS NOT NULL THEN 'done' ELSE 'running' END
    ELSE 'unassessed'
  END,
  COALESCE(NULLIF(v.owner_label, ''), '担当未確認'),
  v.planned_on, v.due_date, v.completed_on,
  'migrated', 'project_management_validation_runs', 0, current_date,
  v.created_at, v.updated_at, v.deleted_at, v.deleted_by, v.version
FROM public.project_management_validation_runs v
ON CONFLICT (id) DO NOTHING;

-- 2-5. 決定後の行動 → やること
INSERT INTO public.project_actions (
  id, project_id, parent_id, title, action_kind, status, owner_label,
  planned_end, actual_end, done_criteria, done_evidence,
  origin_kind, origin_ref, sort_order, last_verified_at,
  created_at, updated_at, deleted_at, deleted_by, version
)
SELECT
  a.id, a.project_id, NULL, a.title, 'work',
  CASE a.status
    WHEN 'in_progress' THEN 'running'
    WHEN 'open' THEN 'not_started'
    WHEN 'blocked' THEN 'blocked'
    WHEN 'done' THEN CASE WHEN a.completed_at IS NOT NULL THEN 'done' ELSE 'running' END
    ELSE 'unassessed'
  END,
  COALESCE(NULLIF(a.owner_label, ''), '担当未確認'),
  a.due_date, a.completed_at::date,
  NULLIF(a.completion_criteria, ''), NULLIF(a.completion_note, ''),
  'migrated', 'project_management_action_items', 0, a.last_verified_at,
  a.created_at, a.updated_at, a.deleted_at, a.deleted_by, a.version
FROM public.project_management_action_items a
ON CONFLICT (id) DO NOTHING;

-- 2-6. やることの親を張る。タスクは親タスク、無ければ工程の下へ。
UPDATE public.project_actions a
SET parent_id = COALESCE(t.parent_task_id, t.milestone_id)
FROM public.project_management_tasks t
WHERE a.id = t.id
  AND a.parent_id IS NULL
  AND COALESCE(t.parent_task_id, t.milestone_id) IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.project_actions p WHERE p.id = COALESCE(t.parent_task_id, t.milestone_id));

-- =====================================================================
-- 3. 分かったこと
-- =====================================================================

INSERT INTO public.project_findings (
  id, project_id, summary, finding_kind, observed_on, source_label, confidence,
  sort_order, last_verified_at, created_by, created_at, deleted_at, deleted_by, version
)
SELECT
  e.id, e.project_id, e.summary,
  CASE e.evidence_kind
    WHEN 'supporting' THEN 'supports'
    WHEN 'counter' THEN 'contradicts'
    WHEN 'missing' THEN 'missing'
    ELSE 'neutral'
  END,
  e.observed_on, COALESCE(NULLIF(e.source_label, ''), '出どころ未確認'), e.confidence,
  0, e.last_verified_at, e.created_by, e.created_at, e.deleted_at, e.deleted_by, e.version
FROM public.project_management_evidence e
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 4. つなぎ
-- =====================================================================

-- 4-1. 工程 → 成立条件の問い
INSERT INTO public.project_question_actions (project_id, question_id, action_id)
SELECT m.project_id, m.outcome_id, m.id
FROM public.project_management_milestones m
WHERE m.outcome_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.project_questions q WHERE q.id = m.outcome_id)
  AND EXISTS (SELECT 1 FROM public.project_actions a WHERE a.id = m.id)
ON CONFLICT (question_id, action_id) DO NOTHING;

-- 4-2. 工程 ↔ 論点の既存リンク
INSERT INTO public.project_question_actions (project_id, question_id, action_id)
SELECT l.project_id, l.issue_id, l.milestone_id
FROM public.project_management_milestone_issue_links l
WHERE EXISTS (SELECT 1 FROM public.project_questions q WHERE q.id = l.issue_id)
  AND EXISTS (SELECT 1 FROM public.project_actions a WHERE a.id = l.milestone_id)
ON CONFLICT (question_id, action_id) DO NOTHING;

-- 4-3. 技術試験 → 成立条件の問い
INSERT INTO public.project_question_actions (project_id, question_id, action_id)
SELECT tt.project_id, tt.outcome_id, tt.id
FROM public.project_management_technical_tests tt
WHERE tt.outcome_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.project_questions q WHERE q.id = tt.outcome_id)
  AND EXISTS (SELECT 1 FROM public.project_actions a WHERE a.id = tt.id)
ON CONFLICT (question_id, action_id) DO NOTHING;

-- 4-4. 検証 → 仮説の問い
INSERT INTO public.project_question_actions (project_id, question_id, action_id)
SELECT v.project_id, v.hypothesis_id, v.id
FROM public.project_management_validation_runs v
WHERE v.hypothesis_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.project_questions q WHERE q.id = v.hypothesis_id)
  AND EXISTS (SELECT 1 FROM public.project_actions a WHERE a.id = v.id)
ON CONFLICT (question_id, action_id) DO NOTHING;

-- 4-5. 決定後の行動 → 判断の問い
INSERT INTO public.project_question_actions (project_id, question_id, action_id)
SELECT a.project_id, a.decision_id, a.id
FROM public.project_management_action_items a
WHERE a.decision_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.project_questions q WHERE q.id = a.decision_id)
  AND EXISTS (SELECT 1 FROM public.project_actions x WHERE x.id = a.id)
ON CONFLICT (question_id, action_id) DO NOTHING;

-- 4-6. 分かったこと → 仮説または論点の問い
INSERT INTO public.project_question_findings (project_id, question_id, finding_id)
SELECT e.project_id, COALESCE(e.hypothesis_id, e.issue_id), e.id
FROM public.project_management_evidence e
WHERE COALESCE(e.hypothesis_id, e.issue_id) IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.project_questions q WHERE q.id = COALESCE(e.hypothesis_id, e.issue_id))
  AND EXISTS (SELECT 1 FROM public.project_findings f WHERE f.id = e.id)
ON CONFLICT (question_id, finding_id) DO NOTHING;

-- 4-7. 工程どうしの前後関係
INSERT INTO public.project_action_dependencies (project_id, predecessor_action_id, successor_action_id)
SELECT d.project_id, d.predecessor_milestone_id, d.successor_milestone_id
FROM public.project_management_milestone_dependencies d
WHERE d.predecessor_milestone_id <> d.successor_milestone_id
  AND EXISTS (SELECT 1 FROM public.project_actions a WHERE a.id = d.predecessor_milestone_id)
  AND EXISTS (SELECT 1 FROM public.project_actions a WHERE a.id = d.successor_milestone_id)
ON CONFLICT (predecessor_action_id, successor_action_id) DO NOTHING;

-- 4-8. 工程・タスクをまたぐ前後関係
INSERT INTO public.project_action_dependencies (project_id, predecessor_action_id, successor_action_id)
SELECT s.project_id,
       COALESCE(s.predecessor_task_id, s.predecessor_milestone_id),
       COALESCE(s.successor_task_id, s.successor_milestone_id)
FROM public.project_management_schedule_dependencies s
WHERE s.deleted_at IS NULL
  AND COALESCE(s.predecessor_task_id, s.predecessor_milestone_id) IS NOT NULL
  AND COALESCE(s.successor_task_id, s.successor_milestone_id) IS NOT NULL
  AND COALESCE(s.predecessor_task_id, s.predecessor_milestone_id)
      <> COALESCE(s.successor_task_id, s.successor_milestone_id)
  AND EXISTS (SELECT 1 FROM public.project_actions a
              WHERE a.id = COALESCE(s.predecessor_task_id, s.predecessor_milestone_id))
  AND EXISTS (SELECT 1 FROM public.project_actions a
              WHERE a.id = COALESCE(s.successor_task_id, s.successor_milestone_id))
ON CONFLICT (predecessor_action_id, successor_action_id) DO NOTHING;

COMMIT;

-- 検算（適用後に手で確認する）:
--   SELECT count(*) FROM public.project_questions WHERE deleted_at IS NULL;   -- 期待 120
--   SELECT count(*) FROM public.project_actions   WHERE deleted_at IS NULL;   -- 期待 233
--   SELECT count(*) FROM public.project_findings  WHERE deleted_at IS NULL;   -- 期待 11
--   SELECT count(*) FROM public.project_questions WHERE status = 'answered';  -- 期待 6
--   SELECT count(*) FROM public.project_questions q                            -- 親を失った子が無いこと
--     WHERE q.parent_id IS NOT NULL
--       AND NOT EXISTS (SELECT 1 FROM public.project_questions p WHERE p.id = q.parent_id);
