-- KUTE (p25): existing annual-roadmap content -> the normal editable gantt ledger.
-- Data only. No API, schema, access-policy or other-project changes.
-- Source: CockpitKuteAnnualRoadmap / 6/11キックオフ資料 / PROJECT_BRIEF.
-- Month precision: first/last days are provisional drawing boundaries, not agreed day deadlines.
-- progress_pct is NOT NULL: 0 is storage only; status='unassessed' keeps progress unregistered.
-- Fixed IDs + ON CONFLICT DO NOTHING preserve later edits and soft deletions on rerun.
BEGIN;

INSERT INTO public.project_management_tracks
  (id, project_id, track_key, label, short_label, accent, sort_order)
VALUES
  ('25000000-2026-4000-8000-000000000011', 'p25', 'regulation', '制度整備', '制度', '#315f7d', 1),
  ('25000000-2026-4000-8000-000000000012', 'p25', 'seed', 'シーズ発掘・after GTIE', 'シーズ', '#38745d', 2)
ON CONFLICT DO NOTHING;

INSERT INTO public.project_management_objectives
  (id, project_id, slug, title, definition_of_done, target_date, date_certainty,
   status, last_verified_at, confidence, source_kind, source_ref)
VALUES (
  '25000000-2026-4000-8000-000000000001', 'p25', 'kute-fy2026-roadmap',
  '年度内の制度整備・シーズ支援実務の型化',
  '規程整備、桑折先生パイロット、外部連携、資金循環モデルまでを2027年3月までに型化する。合意業務: 規程策定 / シーズ掘り起こし / 自治体等とのファンド形成。after GTIEの具体論点は先に固定しすぎず、規程整備とシーズ発掘の進捗を見て具体化する。',
  '2027-03-31', 'provisional', 'unassessed', '2026-06-11', 'unknown', 'imported',
  'KUTE年度内ロードマップ / 6/11キックオフ資料 / PROJECT_BRIEF。月単位計画: 2027-03。月末は描画用の仮日程。実績未確認。'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.project_management_outcomes
  (id, project_id, objective_id, slug, track, title, definition_of_done,
   owner_label, status, last_verified_at, confidence, source_kind, source_ref)
SELECT id::uuid, 'p25', '25000000-2026-4000-8000-000000000001'::uuid,
  slug, track, title, definition_of_done, '担当未確認', 'unassessed',
  '2026-06-11'::date, 'unknown', 'imported',
  'KUTE年度内ロードマップ / 6/11キックオフ資料 / PROJECT_BRIEF。月単位計画、実績未確認。'
FROM (VALUES
  ('25000000-2026-4000-8000-000000000101', 'kute-fy2026-regulation', 'regulation',
   '規程整備', '2027年1月目途で、条文だけでなく施行版・様式・運用フロー・FAQまで揃える。'),
  ('25000000-2026-4000-8000-000000000102', 'kute-fy2026-seed', 'seed',
   'シーズ支援実務の型化', '2027年3月までに、桑折先生パイロット・ヒアリング設計・連携先マップ・資金循環モデルを通じて支援実務の型を作る。')
) AS source(id, slug, track, title, definition_of_done)
ON CONFLICT DO NOTHING;

-- Existing gantt uses phase records as hidden task containers and date-domain anchors.
-- Terminal point milestones alone would clip the June/July tasks out of the date domain.
INSERT INTO public.project_management_milestones
  (id, project_id, objective_id, outcome_id, slug, track, title, gate, timeline_kind,
   planned_start, planned_end, date_certainty, status, progress_pct, owner_label,
   next_deliverable, max_issue, completion_criteria, criticality,
   baseline_plan_version, status_source, last_verified_at, confidence, source_kind, source_ref, sort_order)
SELECT id::uuid, 'p25', '25000000-2026-4000-8000-000000000001'::uuid,
  outcome_id::uuid, slug, track, title, criteria, kind, start_on::date, end_on::date,
  'provisional', 'unassessed', 0, '担当未確認', outputs, '実績・担当未確認', criteria,
  'medium', 'kute-fy2026-roadmap-20260611', 'derived', '2026-06-11'::date,
  'unknown', 'imported',
  'KUTE年度内ロードマップ / 6/11キックオフ資料 / PROJECT_BRIEF。月単位計画の月初〜月末を描画用に登録。日単位の期限・実績は未確認。', sort_order
FROM (VALUES
  ('25000000-2026-4000-8000-000000000201', '25000000-2026-4000-8000-000000000101',
   'kute-fy2026-regulation-phase', 'regulation', '制度整備（工程管理）', 'phase',
   '2026-06-01', '2027-01-31', '条文だけでなく、運用に必要な付属物まで揃える', '施行版 / 様式 / 運用フロー / FAQ', 1),
  ('25000000-2026-4000-8000-000000000202', '25000000-2026-4000-8000-000000000102',
   'kute-fy2026-seed-phase', 'seed', 'シーズ発掘（工程管理）', 'phase',
   '2026-06-01', '2027-03-31', '規程整備と並行して支援実務の型を作る', '桑折先生パイロット / ヒアリング設計 / 連携先マップ / 資金循環モデル', 2),
  ('25000000-2026-4000-8000-000000000203', '25000000-2026-4000-8000-000000000101',
   'kute-fy2026-regulation-gate', 'regulation', '規程整備の年度内着地', 'milestone',
   '2027-01-31', '2027-01-31', '条文だけでなく、運用に必要な付属物まで揃える', '施行版 / 様式 / 運用フロー / FAQ', 3),
  ('25000000-2026-4000-8000-000000000204', '25000000-2026-4000-8000-000000000102',
   'kute-fy2026-seed-gate', 'seed', 'シーズ支援実務の型化', 'milestone',
   '2027-03-31', '2027-03-31', '規程整備と並行して支援実務の型を作る', '桑折先生パイロット / ヒアリング設計 / 連携先マップ / 資金循環モデル', 4)
) AS source(id, outcome_id, slug, track, title, kind, start_on, end_on, criteria, outputs, sort_order)
ON CONFLICT DO NOTHING;

-- One normal task per original roadmap item. Do not infer actual progress from the calendar.
INSERT INTO public.project_management_tasks
  (id, project_id, milestone_id, track, title, description, goal, next_deliverable,
   completion_criteria, planned_start, planned_end, status, progress_pct, date_certainty,
   owner_label, sort_order, last_verified_at, confidence, source_kind, source_ref)
SELECT id::uuid, 'p25', milestone_id::uuid, track, title,
  purpose || E'\n成果物: ' || outputs || E'\n月単位計画: ' || period ||
    '。月初〜月末は描画用の仮日程であり、日単位の確定期限ではない。実績・担当未確認。' ||
    CASE WHEN track = 'seed' THEN E'\nafter GTIEの具体論点は先に固定しすぎず、規程整備とシーズ発掘の進捗を見て具体化する。' ELSE '' END,
  purpose, outputs, outputs, start_on::date, end_on::date,
  'unassessed', 0, 'provisional', '担当未確認', sort_order, '2026-06-11'::date,
  'unknown', 'imported', 'KUTE年度内ロードマップ / ' || source_id ||
    ' / 6/11キックオフ資料 / PROJECT_BRIEF。月単位計画: ' || period
FROM (VALUES
  ('25000000-2026-4000-8000-000000000301', '25000000-2026-4000-8000-000000000201',
   'regulation', 'regulation-202606', '2026-06', '認定規程の着地',
   '6/22教授総会で通せる状態にする', '認定規程修正案 / 委員会規程 / 支援細則 / 想定問答',
   '2026-06-01', '2026-06-30', 1),
  ('25000000-2026-4000-8000-000000000302', '25000000-2026-4000-8000-000000000201',
   'regulation', 'regulation-202607', '2026-07', '7規程の全体設計',
   '認定制度と残り6規程の接続を整理する', '規程マップ / 既存規程突合表 / 他大学比較 / 優先順位',
   '2026-07-01', '2026-07-31', 2),
  ('25000000-2026-4000-8000-000000000303', '25000000-2026-4000-8000-000000000201',
   'regulation', 'regulation-202608', '2026-08', '残り6規程の素案化',
   '既存改訂・新規作成の条文たたきを作る', '兼業 / 新株予約権 / 共有機器 / 知財 / 共同研究 / 利益相反',
   '2026-08-01', '2026-08-31', 3),
  ('25000000-2026-4000-8000-000000000304', '25000000-2026-4000-8000-000000000201',
   'regulation', 'regulation-202609-202611', '2026-09〜11', '学内議論・修正',
   '教授総会・関係部署・法務論点を反映する', '修正版 / 論点管理表 / 学内説明資料 / 施行準備メモ',
   '2026-09-01', '2026-11-30', 4),
  ('25000000-2026-4000-8000-000000000305', '25000000-2026-4000-8000-000000000201',
   'regulation', 'regulation-202612-202701', '2026-12〜2027-01', '規程整備完了',
   '条文だけでなく、運用に必要な付属物まで揃える', '施行版 / 様式 / 運用フロー / FAQ',
   '2026-12-01', '2027-01-31', 5),
  ('25000000-2026-4000-8000-000000000306', '25000000-2026-4000-8000-000000000202',
   'seed', 'seed-202606-202703', '2026-06〜2027-03', 'シーズ発掘・after GTIE',
   '規程整備と並行して支援実務の型を作る', '桑折先生パイロット / ヒアリング設計 / 連携先マップ / 資金循環モデル',
   '2026-06-01', '2027-03-31', 6)
) AS source(id, milestone_id, track, source_id, period, title, purpose, outputs, start_on, end_on, sort_order)
ON CONFLICT DO NOTHING;

COMMIT;
