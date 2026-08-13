-- 276_ehm_p30_gantt_structure.sql
--
-- p30 (石原先生の産連業務) を、p21と同じガント構造へ組み替える。
--
-- 問題: migration 274 では29業務を timeline_kind='phase' のマイルストーンとして入れたが、
-- 統合タイムラインの実装 (SxUnifiedTimeline) は次の構造を前提にしている:
--   - ガントの行として描くのは **タスク** (project_management_tasks) だけ
--   - timeline_kind='phase' のマイルストーンは「FKコンテナ」で、それ自体は描画されない
--   - timeline_kind='milestone' は期間バーではなく点(ダイヤ)のオーバーレイ
-- そのため本番のp30ガントは6レーンが出るのに全レーン「MS 0 / タスク 0」で空だった。
--
-- 修正: 29業務を「6つの領域コンテナ(phase) + 29タスク」へ組み替える。
--   1. 274で入れた29 phase マイルストーンを soft delete (deleted_at)。物理削除しない
--   2. 領域ごとに phase マイルストーンを1件ずつ新設 (期間=2026年度)
--   3. 29業務を project_management_tasks として登録し、領域コンテナへ紐づける
-- 日付・担当・次アクション・完了条件・確度は274で入れた値をそのまま引き継ぐ。
--
-- 冪等性: 既に組み替え済み (slug末尾-frame のコンテナが6件ある) なら何もしない。

DO $$
BEGIN
  IF (SELECT count(*) FROM project_management_tracks WHERE project_id = 'p30') <> 6 THEN
    RAISE EXCEPTION 'p30 の柱6本が未登録 (migration 273 未適用?)';
  END IF;
END $$;

-- =====================================================================
-- 1. 領域コンテナ (phase) を6件つくる。既にあれば何もしない。
-- =====================================================================
INSERT INTO project_management_milestones (
  project_id, objective_id, outcome_id, slug, track, title, gate, status,
  planned_start, planned_end, progress_pct, date_certainty,
  owner_label, next_deliverable, max_issue, completion_criteria, criticality,
  last_verified_at, confidence, source_kind, source_ref, timeline_kind, sort_order
)
SELECT 'p30', oc.objective_id, oc.id, oc.slug || '-frame', oc.track,
       t.label, '2026年度の枠', 'unassessed',
       DATE '2026-04-01', DATE '2027-03-31', 0, 'provisional',
       '石原先生', '領域内の各業務を参照', '2026-06末版のため現況未確認',
       oc.definition_of_done, 'medium',
       DATE '2026-06-30', 'unknown', 'imported', 'ishihara_worklist_20260630', 'phase', t.sort_order
FROM project_management_outcomes oc
JOIN project_management_tracks t ON t.project_id = 'p30' AND t.track_key = oc.track
WHERE oc.project_id = 'p30'
ON CONFLICT (project_id, slug) DO NOTHING;

-- =====================================================================
-- 2. 29業務をタスクとして登録する (274のマイルストーン値を引き継ぐ)
--    milestone_id は同じ柱の領域コンテナ。
-- =====================================================================
INSERT INTO project_management_tasks (
  project_id, milestone_id, track, title, status,
  planned_start, planned_end, progress_pct, date_certainty,
  owner_label, goal, next_deliverable, blocker, completion_criteria,
  sort_order, last_verified_at, confidence, source_kind, source_ref
)
SELECT 'p30', frame.id, m.track, m.title, 'unassessed',
       m.planned_start, m.planned_end, 0, 'provisional',
       m.owner_label, m.gate, m.next_deliverable, m.max_issue, m.completion_criteria,
       m.sort_order, DATE '2026-06-30', 'unknown', 'imported', 'ishihara_worklist_20260630'
FROM project_management_milestones m
JOIN project_management_outcomes oc ON oc.id = m.outcome_id
JOIN project_management_milestones frame
  ON frame.project_id = 'p30' AND frame.slug = oc.slug || '-frame'
WHERE m.project_id = 'p30'
  AND m.deleted_at IS NULL
  AND m.timeline_kind = 'phase'
  AND m.slug NOT LIKE '%-frame'
  AND NOT EXISTS (
    SELECT 1 FROM project_management_tasks t
    WHERE t.project_id = 'p30' AND t.title = m.title AND t.deleted_at IS NULL
  );

-- =====================================================================
-- 3. 274で入れた29業務マイルストーンを soft delete する
--    (コンテナ6件と、タスク化した29件の二重表示を避ける。物理削除はしない)
-- =====================================================================
UPDATE project_management_milestones
SET deleted_at = now(), updated_at = now()
WHERE project_id = 'p30'
  AND deleted_at IS NULL
  AND timeline_kind = 'phase'
  AND slug NOT LIKE '%-frame'
  AND EXISTS (
    SELECT 1 FROM project_management_tasks t
    WHERE t.project_id = 'p30' AND t.title = project_management_milestones.title AND t.deleted_at IS NULL
  );

-- =====================================================================
-- 4. 論点(issues)が消したマイルストーンを参照していないことを確認する
-- =====================================================================
DO $$
DECLARE v_orphan integer; v_frames integer; v_tasks integer; v_live_ms integer;
BEGIN
  SELECT count(*) INTO v_orphan
  FROM project_management_issues i
  JOIN project_management_milestones m ON m.id = i.milestone_id
  WHERE i.project_id = 'p30' AND m.deleted_at IS NOT NULL;
  IF v_orphan > 0 THEN
    RAISE EXCEPTION '論点 % 件が削除済みマイルストーンを参照している', v_orphan;
  END IF;

  SELECT count(*) INTO v_frames FROM project_management_milestones
   WHERE project_id = 'p30' AND deleted_at IS NULL AND slug LIKE '%-frame';
  SELECT count(*) INTO v_tasks FROM project_management_tasks
   WHERE project_id = 'p30' AND deleted_at IS NULL;
  SELECT count(*) INTO v_live_ms FROM project_management_milestones
   WHERE project_id = 'p30' AND deleted_at IS NULL;

  IF v_frames <> 6 THEN RAISE EXCEPTION 'p30 の領域コンテナが % 件 (想定=6)', v_frames; END IF;
  IF v_tasks <> 29 THEN RAISE EXCEPTION 'p30 のタスクが % 件 (想定=29)', v_tasks; END IF;
  IF v_live_ms <> 6 THEN RAISE EXCEPTION 'p30 の生存マイルストーンが % 件 (想定=6=コンテナのみ)', v_live_ms; END IF;
END $$;
