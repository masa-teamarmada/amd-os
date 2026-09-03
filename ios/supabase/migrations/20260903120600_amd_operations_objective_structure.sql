-- AMD (p00): 社内業務を目的構造タブで進捗管理・全体把握するための器を作る。
--
-- まさ依頼 2026-09-03: 「AMD HoldCo設立とか、決算対応とか、色々PJベースのタスクが
-- 立ち上がるので、それらの進捗を目的構造タブで進捗管理と全体把握ができるようにしたい」。
--
-- 目的構造タブ (`/project/p00/cockpit?tab=objective-structure`) は
-- project_management_objectives → outcomes → milestones(phase) → tasks を読む。
-- p00 には track も objective も outcome も無く、画面は
-- 「目的と成立条件がまだ登録されていないよ」の空表示だった。
--
-- ここで入れるのは器と、まさが名前を挙げた2つの業務ラインだけ。工程・期限・担当・
-- 完了条件は推測せず、画面から足す前提で「未確認」を明示して置く。目的とラインの
-- 文言はえいみの仮置きで、まさ確認前。
--
-- データのみ。schema・policy・通知・外部送信の変更なし。固定UUIDと
-- ON CONFLICT DO NOTHING で、後からの手編集を上書きせずに再実行できる。

BEGIN;

-- 柱 (track)。outcomes/milestones/tasks は (project_id, track) の複合FKで
-- project_management_tracks を参照するので、先に1本だけ登録する。業務の種類で
-- 分けるのは、実際にラインが増えて分類が必要になってからにする。
INSERT INTO public.project_management_tracks
  (project_id, track_key, label, short_label, accent, sort_order)
VALUES ('p00', 'amd_operations', 'AMD運営', '運営', '#315f7d', 1)
ON CONFLICT (project_id, track_key) DO NOTHING;

-- 最上位の目的。1つのPJにつき1本だけ読まれる (sx-management.ts: objectiveRows[0])。
INSERT INTO public.project_management_objectives
  (id, project_id, slug, title, definition_of_done, target_date, date_certainty,
   status, last_verified_at, confidence, source_kind, source_ref)
VALUES (
  'a0d00000-2026-4000-8000-000000001001', 'p00', 'amd-operations',
  'AMDの経営基盤を整える',
  '法人・資本、決算・税務、資金、組織など、会社を動かすための業務それぞれについて、いまどこまで進んでいて次に誰が何をするかを、同じ画面で確認できる状態にする。',
  NULL, 'provisional', 'active', '2026-09-03', 'medium', 'manual',
  'まさ依頼 2026-09-03。目的の文言はえいみの仮置きで、まさ確認前。'
)
ON CONFLICT DO NOTHING;

-- 成立条件 = 業務ライン。まさが名前を挙げた2つだけを置く。
INSERT INTO public.project_management_outcomes
  (id, project_id, objective_id, slug, track, title, definition_of_done,
   owner_label, status, last_verified_at, confidence, source_kind, source_ref)
SELECT id::uuid, 'p00', 'a0d00000-2026-4000-8000-000000001001'::uuid,
  slug, 'amd_operations', title, definition_of_done,
  '山地 正洋', 'active', '2026-09-03'::date, 'low', 'manual',
  'まさ依頼 2026-09-03。名前だけ確認済み。工程・期限・担当・完了条件は未確認。'
FROM (VALUES
  ('a0d00000-2026-4000-8000-000000001101', 'amd-holdco',
   'AMD HoldCo設立',
   '設立の目的、器の形、出資と持分、税務・法務で確認すべきこと、設立時期を確定し、登記まで進める。現時点では中身が未確認。'),
  ('a0d00000-2026-4000-8000-000000001102', 'amd-fiscal-close',
   '決算対応',
   '12月決算に向けて、必要な作業と期限、担当を確認して進める。法定の申告・納付期限そのものは管理カレンダー (/admin/schedule) が正本で、ここでは重複して持たない。')
) AS source(id, slug, title, definition_of_done)
ON CONFLICT DO NOTHING;

-- 各ラインの phase コンテナ。ガントのFKグループで、画面には出ない。目的構造の
-- タスクはこの milestone にぶら下げる (track だけで拾わせると、同じ柱の別ライン
-- へタスクが混ざる)。
INSERT INTO public.project_management_milestones
  (id, project_id, objective_id, outcome_id, slug, track, title, gate, timeline_kind,
   status, progress_pct, date_certainty, owner_label, next_deliverable, max_issue,
   completion_criteria, criticality, baseline_plan_version, status_source,
   last_verified_at, confidence, source_kind, source_ref, sort_order)
SELECT id::uuid, 'p00', 'a0d00000-2026-4000-8000-000000001001'::uuid,
  outcome_id::uuid, slug, 'amd_operations', title, '未確認', 'phase',
  'unassessed', 0, 'provisional', '山地 正洋', '未確認', '未確認',
  '未確認', 'high', 'amd-operations-20260903', 'manual',
  '2026-09-03'::date, 'low', 'manual',
  'まさ依頼 2026-09-03。工程は未登録。', sort_order
FROM (VALUES
  ('a0d00000-2026-4000-8000-000000001201', 'a0d00000-2026-4000-8000-000000001101',
   'amd-holdco-phase', 'AMD HoldCo設立', 1),
  ('a0d00000-2026-4000-8000-000000001202', 'a0d00000-2026-4000-8000-000000001102',
   'amd-fiscal-close-phase', '決算対応', 2)
) AS source(id, outcome_id, slug, title, sort_order)
ON CONFLICT DO NOTHING;

COMMIT;
