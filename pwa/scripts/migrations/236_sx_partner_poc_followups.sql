-- 236: PoC台帳統合のフォローアップ (2026-08-06 まさ確定3点)
--
-- 1. 「いづつ」(poc-talk-09-x) は「株式会社ハピックいづつ」(poc-talk-08-x) と同一企業の重複行。
--    従属レコード0件を確認済み。統合承認 (まさ 2026-08-06「統合していいよ」) により soft delete。
-- 2. 接点の経緯 (connection_context) に行動テキストが入っていた3行を「経緯 未登録」へ戻す。
--    経緯の実データはスプシにも無いため、推測で埋めず未登録のまま扱う (紹介者=伊予銀行は保持)。
-- 3. スプシ全体メモ H-0038〜H-0040 を論点・仮説リスト (issues) へ登録
--    (まさ 2026-08-06「そっちにいれといて」)。

BEGIN;

-- 1) いづつ重複行の統合 (soft delete)
UPDATE project_management_partners
SET deleted_at = now(), deleted_by = 'eimi:merge-into-poc-talk-08-x', updated_at = now()
WHERE project_id = 'p21' AND slug = 'poc-talk-09-x' AND deleted_at IS NULL;

-- 2) 行動テキスト化していた接点の経緯を未登録へ
UPDATE project_management_partners
SET connection_context = NULL, updated_at = now()
WHERE project_id = 'p21' AND deleted_at IS NULL
  AND slug IN ('poc-contact-okabe', 'poc-contact-marutomo', 'poc-contact-yamaki')
  AND connection_context IN ('PoC相談と訪問日程の調整', 'PoC相談の初回メール');

-- 3) H-0038〜H-0040 を論点として登録 (8/5 SX定例議事録が出典、全社的方針のため関係先に紐付かない)
INSERT INTO project_management_issues
  (project_id, slug, track, title, knowledge_type, status, owner_label,
   last_verified_at, confidence, source_kind, source_ref, sort_order)
SELECT v.project_id, v.slug, v.track, v.title, v.knowledge_type, v.status, v.owner_label,
       v.last_verified_at, v.confidence, v.source_kind, v.source_ref, v.sort_order
FROM (VALUES
  ('p21', 'poc-management-handover', 'organizational_building',
   'PoC候補先対応を山地らアルマダ中心の管理へ移す（8/5定例合意。候補別の主担当・副担当と大学側からの紹介手順が未確定）',
   'fact', 'open', '山地／石原先生／杉浦先生／中島先生',
   DATE '2026-08-05', 'high', 'current_truth', '8/5 SX定例議事録 (H-0038)', 80),
  ('p21', 'metallothionein-strain-ready', 'technology_development',
   'メタラチオネイン超発現の強化株が完成し、廃液で金属取り込み速度を測る実験へ進む（実験条件・対象廃液・比較系・結果時期は未確定）',
   'fact', 'open', '杉浦先生／中島先生',
   DATE '2026-08-05', 'high', 'current_truth', '8/5 SX定例議事録 (H-0039)', 90),
  ('p21', 'waste-liquid-sourcing-nationwide', 'business_development',
   '廃液調達候補を愛媛県内に限定せず大阪・東京・名古屋等へ広げ、地理より技術連携適合性を優先する（探索チャネル・優先業種・候補評価基準は未確定）',
   'fact', 'open', '山地／杉浦先生',
   DATE '2026-08-05', 'high', 'current_truth', '8/5 SX定例議事録 (H-0040)', 100)
) AS v(project_id, slug, track, title, knowledge_type, status, owner_label,
       last_verified_at, confidence, source_kind, source_ref, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM project_management_issues e
  WHERE e.project_id = v.project_id AND e.slug = v.slug
);

COMMIT;
