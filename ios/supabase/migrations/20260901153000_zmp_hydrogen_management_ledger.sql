-- ZMP (p19): normalize the reviewed hydrogen history into the existing gantt and partner ledgers.
--
-- The former project_theme_profiles.history_rows mixed workstreams, counterparties and grants in
-- one presentation-oriented JSON array. This migration keeps the same reviewed facts but gives
-- each kind of record one canonical home:
--   * gantt: workstreams, the completed seed-list task, station-plan changes and grant follow-up;
--   * partner ledger: Dowaki / Tokyo University of Science and pHydrogen, including interactions;
--   * theme profile: only the theme-level purpose, current state and next focus.
--
-- Data only. No policy, schema, notification or external-send change. Fixed UUIDs and
-- ON CONFLICT DO NOTHING make the seed repeat-safe without overwriting later manual edits.

BEGIN;

-- The objective is the user-confirmed top-level goal. No target date is inferred.
INSERT INTO public.project_management_objectives
  (id, project_id, slug, title, definition_of_done, target_date, date_certainty,
   status, last_verified_at, confidence, source_kind, source_ref)
VALUES (
  '19000000-2026-4000-8000-000000001001', 'p19', 'zmp-hydrogen-cycle',
  '都内で水素をつくる・ためる・つかう',
  '都内で水素をつくる・ためる・つかう循環を成立させる。供給元、貯蔵・供給拠点、利用側を接続し、各成立条件を確認できる状態にする。',
  NULL, 'provisional', 'active', '2026-09-01', 'high', 'manual',
  'まさ確認 2026-09-01。目標日は未確認。'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.project_management_outcomes
  (id, project_id, objective_id, slug, track, title, definition_of_done,
   owner_label, status, last_verified_at, confidence, source_kind, source_ref)
SELECT id::uuid, 'p19', '19000000-2026-4000-8000-000000001001'::uuid,
  slug, 'katsushika_hydrogen', title, definition_of_done,
  '担当未確認', status, '2026-09-01'::date, confidence, 'manual', 'まさ確認 2026-09-01'
FROM (VALUES
  ('19000000-2026-4000-8000-000000001101', 'zmp-hydrogen-supplier',
   '水素供給元の確保', '供給候補ごとの現在地、ボール、次の行動が確認でき、供給量・時期・単価・稼働枠の成立条件を比較できる。', 'active', 'high'),
  ('19000000-2026-4000-8000-000000001102', 'zmp-hydrogen-station',
   '水素ステーション建設', '設置方式、場所、総費用、補助対象、自己負担、判断時期を確認し、現行計画を判断できる。', 'active', 'low'),
  ('19000000-2026-4000-8000-000000001103', 'zmp-hydrogen-funding',
   '助成金・整備資金の確保', '各制度について準備、提出、受付、採否、入金を混同せず、現在の状態と次の確認を追える。', 'active', 'low')
) AS source(id, slug, title, definition_of_done, status, confidence)
ON CONFLICT DO NOTHING;

-- Hidden phase containers are the existing gantt's FK grouping mechanism. The visible rows are
-- the tasks below; these records only supply track, outcome and related-work linkage.
INSERT INTO public.project_management_milestones
  (id, project_id, objective_id, outcome_id, slug, track, title, gate, timeline_kind,
   status, progress_pct, date_certainty, owner_label, next_deliverable, max_issue,
   completion_criteria, criticality, baseline_plan_version, status_source,
   last_verified_at, confidence, source_kind, source_ref, sort_order)
SELECT id::uuid, 'p19', '19000000-2026-4000-8000-000000001001'::uuid,
  outcome_id::uuid, slug, 'katsushika_hydrogen', title, gate, 'phase',
  status, 0, 'provisional', '担当未確認', next_deliverable, max_issue,
  completion_criteria, 'high', 'zmp-hydrogen-normalized-20260901', 'manual',
  '2026-09-01'::date, confidence, 'manual', source_ref, sort_order
FROM (VALUES
  ('19000000-2026-4000-8000-000000001201', '19000000-2026-4000-8000-000000001101',
   'zmp-hydrogen-supplier-phase', '水素供給元の確保', '供給条件の確認', 'attention',
   'pHydrogenとの供給条件とH2購入型PoCの成功条件を整理する',
   'pHydrogenはAMD側の次アクション待ち。堂脇先生は一旦停止。',
   '供給候補ごとの供給量・時期・単価・稼働枠が確認できる', 'high',
   '水素循環PJの関係先整理。堂脇先生・pHydrogenの経緯を関係先台帳へ移行。', 1),
  ('19000000-2026-4000-8000-000000001202', '19000000-2026-4000-8000-000000001102',
   'zmp-hydrogen-station-phase', '水素ステーション建設', '現行計画の判断条件', 'attention',
   '現行案・総費用・補助対象・自己負担・判断時期を揃える',
   '設置方式・場所・採算は再検討中。着工確定は未確認。',
   '設置方式・場所・費用・資金・判断時期が揃う', 'low',
   '1/21〜8/7のMTG記録。以降の計画確定は未確認。', 2),
  ('19000000-2026-4000-8000-000000001203', '19000000-2026-4000-8000-000000001103',
   'zmp-hydrogen-funding-phase', '助成金・整備資金の確保', '申請・採否の照合', 'attention',
   '制度ごとの提出控え・受付・採否・入金を確認する',
   '方針や書類作成の記録はあるが、提出・採否が未確認の制度がある。',
   '各制度の現在状態と根拠が揃う', 'low',
   '水素循環PJの補助金・助成金4対象の確認済み経緯。', 3)
) AS source(id, outcome_id, slug, title, gate, status, next_deliverable, max_issue, completion_criteria, confidence, source_ref, sort_order)
ON CONFLICT DO NOTHING;

-- Three visible parent rows. Dates stay NULL because the source history confirms events, not a
-- current agreed schedule.
INSERT INTO public.project_management_tasks
  (id, project_id, milestone_id, parent_task_id, track, title, description, status,
   progress_pct, date_certainty, owner_label, goal, next_deliverable, blocker,
   completion_criteria, sort_order, last_verified_at, confidence, source_kind, source_ref)
SELECT id::uuid, 'p19', milestone_id::uuid, NULL, 'katsushika_hydrogen', title,
  description, status, progress_pct, 'provisional', '担当未確認', goal,
  next_deliverable, blocker, completion_criteria, sort_order, '2026-09-01'::date,
  confidence, 'manual', source_ref
FROM (VALUES
  ('19000000-2026-4000-8000-000000001301', '19000000-2026-4000-8000-000000001201',
   '水素供給元の確保',
   'シーズリストを起点に候補ごとのアプローチと現在地を関係先台帳で追う。堂脇先生とpHydrogenを別レーンで管理する。',
   'attention', 40, '供給元候補を比較し、PoCに必要な供給条件を確認する',
   'pHydrogenの供給量・時期・単価・稼働枠とH2購入型PoCの成功条件を確認する',
   'pHydrogenはAMD側にボール。堂脇先生は一旦停止。',
   '供給量・時期・単価・稼働枠を確認した候補を1つ以上持つ', 1, 'high',
   'まさ確認 2026-09-01。相手別の経緯は関係先台帳が正本。'),
  ('19000000-2026-4000-8000-000000001302', '19000000-2026-4000-8000-000000001202',
   '水素ステーション建設',
   E'当初は現敷地のA2案。2階建て仕様は障壁・セットバックが制約。\n1/21 隣地拡張＋水電解のB案へ変更。\n5/20 別の候補地も検討。\n7/8 建設費・補助条件を再整理。\n8/7 実証の場と組み合わせる案。',
   'attention', 0, '設置方式・場所・費用・資金・判断時期を揃える',
   '現行案・総費用・補助対象・自己負担・判断時期を揃える',
   '設置方式・場所・採算は再検討中。着工確定は未確認。',
   '現行案と判断条件が確認済みの根拠とともに揃う', 2, 'low',
   'MTG: slack-C08VBBE9KNE-1768964868_475999 / bivl92dr7vhaa1fmi7325lnlis_20260520T000000Z / bivl92dr7vhaa1fmi7325lnlis_20260708T000000Z / 4mkigsei16s2pjmhphjnu0e02o'),
  ('19000000-2026-4000-8000-000000001303', '19000000-2026-4000-8000-000000001203',
   '助成金・整備資金の確保',
   '制度ごとに、調査・方針・書類作成・提出・受付・採否・入金を別状態として追う。',
   'attention', 0, '水素循環とステーション整備に必要な資金の現在地を確認する',
   '4対象の提出控え・受付番号・採否通知を照合する',
   '方針や書類作成の記録はあるが、提出・採否が未確認の制度がある。',
   '各制度の状態と根拠が揃う', 3, 'low',
   '水素循環PJの補助金・助成金4対象。応募・採否を推測しない。')
) AS source(id, milestone_id, title, description, status, progress_pct, goal, next_deliverable, blocker, completion_criteria, sort_order, confidence, source_ref)
ON CONFLICT DO NOTHING;

-- Reviewed child work. The completed seed-list task has no fabricated completion date.
INSERT INTO public.project_management_tasks
  (id, project_id, milestone_id, parent_task_id, track, title, description, status,
   progress_pct, date_certainty, owner_label, goal, next_deliverable, blocker,
   completion_criteria, sort_order, last_verified_at, confidence, source_kind, source_ref)
SELECT id::uuid, 'p19', milestone_id::uuid, parent_id::uuid, 'katsushika_hydrogen', title,
  description, status, progress_pct, 'provisional', '担当未確認', goal,
  next_deliverable, blocker, completion_criteria, sort_order, verified_on::date,
  confidence, 'manual', source_ref
FROM (VALUES
  ('19000000-2026-4000-8000-000000001401', '19000000-2026-4000-8000-000000001201', '19000000-2026-4000-8000-000000001301',
   'シーズリスト作成',
   '水素供給元候補を整理し、堂脇先生とpHydrogenへのアプローチ候補を決めた。',
   'completed', 100, '供給候補を比較できる一覧を作る',
   '候補ごとのアプローチ結果は関係先台帳で追う', NULL,
   '候補一覧から具体的な接触先を選べる', 1, '2026-09-01', 'high',
   'まさ確認 2026-09-01。完了日は未確認。'),
  ('19000000-2026-4000-8000-000000001402', '19000000-2026-4000-8000-000000001202', '19000000-2026-4000-8000-000000001302',
   '現行計画・費用・着工条件の再整理',
   '設置方式、候補地、総費用、補助対象、自己負担、判断時期を現行案として揃える。',
   'attention', 0, '水素ステーションの現行計画を判断できる状態にする',
   '現行案・総費用・補助対象・自己負担・判断時期の一覧',
   '設置方式・場所・採算は再検討中。着工確定は未確認。',
   '現行案の各条件に確認済み根拠が付く', 1, '2026-08-07', 'low',
   '1/21〜8/7のMTG記録。以降の計画確定は未確認。'),
  ('19000000-2026-4000-8000-000000001403', '19000000-2026-4000-8000-000000001203', '19000000-2026-4000-8000-000000001303',
   '給電車・外部給電機の補助',
   E'5/20 2台中1台は申請済み、残り1台は準備。\n6/10 外部給電機の書類補完を確認。給電車と外部給電機の申請が同一制度かは未確認。',
   'attention', 0, '2台分の給電用途を補助金で整備する',
   '制度正式名、車両・機器別の受付、交付通知を照合する',
   '2台目の提出・交付・入金は未確認。',
   '制度正式名、対象、受付、交付、入金が機器別に確認できる', 1, '2026-06-10', 'low',
   'MTG: bivl92dr7vhaa1fmi7325lnlis_20260520T000000Z / bivl92dr7vhaa1fmi7325lnlis_20260610T000000Z'),
  ('19000000-2026-4000-8000-000000001404', '19000000-2026-4000-8000-000000001203', '19000000-2026-4000-8000-000000001303',
   '整備補助（NEV・東京都）',
   E'2〜3月 NEVへ名義・年度内完了条件を確認。\n7/8 対象費用・上限を整理。\n7/15 都の後払いによる着工資金リスクを確認。',
   'attention', 0, '国と都の補助を使い、水素ステーションの整備負担を抑える',
   '国・都それぞれの申請状況と、補助前の資金手当てを確認する',
   '国・都とも応募・採否は未確認。',
   '国・都それぞれの提出・受付・採否と自己資金条件が確認できる', 2, '2026-07-15', 'low',
   'MTG: slack-C08VBBE9KNE-1774195852_840389 / bivl92dr7vhaa1fmi7325lnlis_20260708T000000Z / bivl92dr7vhaa1fmi7325lnlis_20260715T000000Z'),
  ('19000000-2026-4000-8000-000000001405', '19000000-2026-4000-8000-000000001203', '19000000-2026-4000-8000-000000001303',
   '水素サプライチェーン構築技術開発事業',
   '6/10 定例で申請を進める方針。説明会・計画・書類準備を分担。MTG上の事業名であり、正式公募名との照合が必要。',
   'attention', 0, '水素循環の開発資金を公募で確保する',
   '正式公募名、最終提出版、受付番号、審査結果、FS公募との対応を確認する',
   '申請方針まで確認。提出済み・採否は未確認。',
   '正式公募名と提出・受付・採否の根拠が揃う', 3, '2026-06-10', 'low',
   'MTG: bivl92dr7vhaa1fmi7325lnlis_20260610T000000Z'),
  ('19000000-2026-4000-8000-000000001406', '19000000-2026-4000-8000-000000001203', '19000000-2026-4000-8000-000000001303',
   '課題解決型・試作品開発助成',
   '資料室に7/1版の申請書（v1.3）がある。申請書の存在を応募完了とはみなさない。',
   'attention', 0, '葛飾ロードの水素作業車開発で活用する',
   '最終提出版と受付・採否通知を確認する',
   '書類作成まで確認。提出・採否は未確認。',
   '最終提出版、受付、採否の根拠が揃う', 4, '2026-07-01', 'low',
   '資料: 6328125c-bc07-4508-92d1-e75950d058a0')
) AS source(id, milestone_id, parent_id, title, description, status, progress_pct, goal, next_deliverable, blocker, completion_criteria, sort_order, verified_on, confidence, source_ref)
ON CONFLICT DO NOTHING;

-- Counterparties are separate relationship lanes. pHydrogen is active with the ball on AMD;
-- Dowaki is explicitly paused with no current ball.
INSERT INTO public.project_management_partners
  (id, project_id, slug, name, role_label, primary_track, relationship_stage,
   activity_state, classifications, agreement_state, agreed_scope, unagreed_scope,
   last_contact_date, next_commitment, due_date, due_date_precision, owner_label,
   current_ball_side, current_ball_owner, target_state, last_verified_at,
   confidence, source_kind, source_ref, connection_context, sort_order)
VALUES
  ('19000000-2026-4000-8000-000000001501', 'p19', 'tokyo-university-science-dowaki',
   '東京理科大学・堂脇先生', '水素技術・研究連携候補', 'katsushika_hydrogen',
   'on_hold', 'on_hold', ARRAY['tech_partner']::text[], 'unagreed',
   '未確認', '研究協力は未成立', '2026-06-10',
   '一旦停止。再開条件が生じた場合に再評価する', NULL, 'unknown', '担当未確認',
   'none', NULL, '研究協力を再開する条件が確認できる', '2026-09-01',
   'high', 'manual', '5/26・6/10のMTGと、まさ確認 2026-09-01',
   'シーズリスト作成後、水素供給元・研究連携候補として産学連携部門経由でアプローチした。', 1),
  ('19000000-2026-4000-8000-000000001502', 'p19', 'phydrogen',
   'pHydrogen', '水素サプライヤー候補', 'katsushika_hydrogen',
   'information_exchange', 'waiting_internal', ARRAY['tech_partner']::text[], 'unagreed',
   '未確認', '供給量・時期・単価・稼働枠とPoC条件は未合意', '2026-06-23',
   'H2購入型PoCの成功条件と、本社訪問後の進展を確認する', NULL, 'unknown', '担当未確認',
   'sx', NULL, '供給量・時期・単価・稼働枠を確認し、H2購入型PoCの成立条件を揃える', '2026-09-01',
   'low', 'manual', '6/23 MTG・準備資料と、まさ確認 2026-09-01。契約成立ではない。',
   'シーズリスト作成後、水素のつくり手候補として供給・実証への参加を相談した。', 2)
ON CONFLICT DO NOTHING;

INSERT INTO public.project_management_partner_tracks
  (project_id, partner_id, track, role_label, is_primary)
VALUES
  ('p19', '19000000-2026-4000-8000-000000001501', 'katsushika_hydrogen', '水素技術・研究連携候補', true),
  ('p19', '19000000-2026-4000-8000-000000001502', 'katsushika_hydrogen', '水素サプライヤー候補', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.project_management_partner_roles
  (id, project_id, partner_id, role_kind, relationship_state, role_label,
   is_primary, sort_order, source_kind, source_ref)
VALUES
  ('19000000-2026-4000-8000-000000001511', 'p19', '19000000-2026-4000-8000-000000001501',
   'university_research', 'on_hold', '水素技術・研究連携候補', true, 1, 'manual', 'まさ確認 2026-09-01'),
  ('19000000-2026-4000-8000-000000001512', 'p19', '19000000-2026-4000-8000-000000001502',
   'other', 'in_progress', '水素サプライヤー候補', true, 1, 'manual', 'まさ確認 2026-09-01')
ON CONFLICT DO NOTHING;

INSERT INTO public.project_management_partner_work_items
  (id, project_id, partner_id, side, item_kind, title, detail, owner_label,
   status, due_date, due_date_precision, completion_criteria, related_milestone_id,
   last_verified_at, confidence, source_kind, source_ref, sort_order)
VALUES (
  '19000000-2026-4000-8000-000000001521', 'p19', '19000000-2026-4000-8000-000000001502',
  'sx', 'task', 'pHydrogenの供給条件とPoC成功条件を確認',
  '供給量・時期・単価・稼働枠、本社訪問後の進展、H2購入型PoCの成功条件を確認する。',
  NULL, 'in_progress', NULL, 'unknown',
  '供給条件とPoC成功条件が確認済みの根拠とともに揃う',
  '19000000-2026-4000-8000-000000001201', '2026-09-01', 'high', 'manual',
  'まさ確認 2026-09-01。期限・担当者は未確認。', 1
)
ON CONFLICT DO NOTHING;

INSERT INTO public.project_management_partner_interactions
  (id, project_id, partner_id, interaction_kind, occurred_on, occurred_on_precision,
   summary, outcome_summary, ball_side_after, ball_owner_after, actor_side, actor_label,
   confidence, source_kind, source_ref, detail_md)
VALUES
  ('19000000-2026-4000-8000-000000001601', 'p19', '19000000-2026-4000-8000-000000001501',
   'meeting', '2026-05-26', 'day', '東京理科大学の産学連携部門へ相談',
   '堂脇先生・他の水素/GX研究者への接続を依頼', 'partner', NULL, 'sx', NULL,
   'medium', 'imported', 'MTG: 0q5lelucq7hf5fdteo7p1b5d1i',
   '下水汚泥由来水素・貯蔵技術を地域実装へつなぐため、産学連携部門へ相談した。'),
  ('19000000-2026-4000-8000-000000001602', 'p19', '19000000-2026-4000-8000-000000001501',
   'status_update', '2026-06-10', 'day', '返答が停滞',
   '再連絡する方針を確認したが、研究協力は未成立', 'sx', NULL, 'sx', NULL,
   'medium', 'imported', 'MTG: bivl92dr7vhaa1fmi7325lnlis_20260610T000000Z', NULL),
  ('19000000-2026-4000-8000-000000001603', 'p19', '19000000-2026-4000-8000-000000001501',
   'status_update', '2026-09-01', 'day', '一旦停止',
   '今回の確認でも進展なし。研究協力は未成立のまま、一旦停止とした。', 'none', NULL, 'shared', NULL,
   'high', 'manual', 'まさ確認 2026-09-01', NULL),
  ('19000000-2026-4000-8000-000000001611', 'p19', '19000000-2026-4000-8000-000000001502',
   'note', '2026-06-17', 'day', '初回相談の準備',
   '実際の合意は未確認', 'shared', NULL, 'sx', NULL,
   'low', 'imported', '資料: f1557790-9fd4-445a-a014-96aa5eeb123a', NULL),
  ('19000000-2026-4000-8000-000000001612', 'p19', '19000000-2026-4000-8000-000000001502',
   'meeting', '2026-06-23', 'day', '飛田CEOがZeMAを訪問',
   '本社訪問とPoC具体化へ進む方向を確認', 'sx', NULL, 'shared', NULL,
   'medium', 'imported', 'MTG: 7pubrfitd4dfb9hsn1dv7kmj9f',
   '水素のつくり手として供給・実証への参加を相談した。供給条件と契約成立は未確認。'),
  ('19000000-2026-4000-8000-000000001613', 'p19', '19000000-2026-4000-8000-000000001502',
   'status_update', '2026-09-01', 'day', 'AMD側の次アクション待ち',
   '前向きな感触はあるが、供給量・時期・単価・稼働枠は未確定。AMD側で確認を進める。',
   'sx', NULL, 'shared', NULL, 'high', 'manual', 'まさ確認 2026-09-01', NULL)
ON CONFLICT DO NOTHING;

INSERT INTO public.project_management_milestone_partner_links
  (project_id, milestone_id, partner_id)
VALUES
  ('p19', '19000000-2026-4000-8000-000000001201', '19000000-2026-4000-8000-000000001501'),
  ('p19', '19000000-2026-4000-8000-000000001201', '19000000-2026-4000-8000-000000001502')
ON CONFLICT DO NOTHING;

-- The theme profile becomes the overview; the same seven rows are no longer edited here after
-- their facts have canonical gantt/partner records. Only replace the known seed shape so later
-- manual profile edits are not overwritten.
UPDATE public.project_theme_profiles
SET purpose_md = COALESCE(NULLIF(purpose_md, ''), '都内で水素をつくる・ためる・つかう'),
    current_state_md = COALESCE(NULLIF(current_state_md, ''), '供給元はpHydrogenを継続確認、堂脇先生は一旦停止。水素ステーション計画と助成金4対象は確認事項をガントで追う。'),
    next_focus_note = COALESCE(NULLIF(next_focus_note, ''), 'pHydrogenの供給条件とH2購入型PoCの成功条件を確認する。'),
    history_rows = '[]'::jsonb,
    version = version + 1,
    updated_at = now()
WHERE project_id = 'p19'
  AND track_key = 'katsushika_hydrogen'
  AND jsonb_typeof(history_rows) = 'array'
  AND jsonb_array_length(history_rows) = 7
  AND history_rows @> '[{"id":"19000000-2026-4000-8000-000000000501"},{"id":"19000000-2026-4000-8000-000000000502"}]'::jsonb;

DO $$
DECLARE
  task_count integer;
  partner_count integer;
  interaction_count integer;
BEGIN
  SELECT count(*) INTO task_count
  FROM public.project_management_tasks
  WHERE project_id = 'p19' AND track = 'katsushika_hydrogen' AND deleted_at IS NULL;
  IF task_count < 9 THEN
    RAISE EXCEPTION 'ZMP hydrogen gantt normalization incomplete: expected at least 9 tasks, got %', task_count;
  END IF;

  SELECT count(*) INTO partner_count
  FROM public.project_management_partners
  WHERE project_id = 'p19' AND slug IN ('tokyo-university-science-dowaki', 'phydrogen') AND deleted_at IS NULL;
  IF partner_count <> 2 THEN
    RAISE EXCEPTION 'ZMP hydrogen partner normalization incomplete: expected 2, got %', partner_count;
  END IF;

  SELECT count(*) INTO interaction_count
  FROM public.project_management_partner_interactions
  WHERE project_id = 'p19'
    AND partner_id IN ('19000000-2026-4000-8000-000000001501', '19000000-2026-4000-8000-000000001502')
    AND deleted_at IS NULL;
  IF interaction_count <> 6 THEN
    RAISE EXCEPTION 'ZMP hydrogen interaction normalization incomplete: expected 6, got %', interaction_count;
  END IF;
END $$;

COMMIT;
