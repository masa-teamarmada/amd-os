-- 269_ehm_zeo_project_bootstrap.sql
--
-- EHM OS 第2テーマ: ゼオライト (ナトリウムイオン二次電池材料) シーズの PJ化。
-- EHM_OS_DESIGN_DRAFT_20260813.md 論点2-A (まさ承認 2026-08-13) の実装。
--
-- 投入内容:
--   1. projects に p31 (project_name='ZEO', status='draft', project_category='dtsu') を追加
--      ※ fee/contract/start_ym 等の未確定項目は投入しない (204 p30 と同じ方針)
--   2. seed_projects に p31 × ゼオライトseed (commercialization_stage='under_consideration')
--   3. institution_workspace_project_scopes に ehime ワークスペース × p31 (summary共有)
--
-- 触らないもの:
--   - seeds.researcher_name (現登録: 野村信福教授)。まさ発言では「中島先生のテーマ」であり
--     不一致が未解決のため、既存値を書き換えない (206 と同じ原則)。確認後に別migrationで直す。
--   - seeds.status / spun_off_project_id (設立を意味する列は触らない。209 の整理に従う)
--   - p21 の扱い (機関ワークスペースに含めない方針は 212 のまま)
--
-- 安全性: RAISE EXCEPTION による事前 assert (204/206/212 と同じガード方式)。

DO $$
DECLARE
  existing_project_name text;
  target_seed_count integer;
BEGIN
  -- p31 が既に別プロジェクトとして使われていないか
  SELECT project_name INTO existing_project_name FROM projects WHERE project_id = 'p31';
  IF existing_project_name IS NOT NULL AND existing_project_name <> 'ZEO' THEN
    RAISE EXCEPTION 'projects.project_id=p31 は既に別プロジェクト "%" として使用されている', existing_project_name;
  END IF;

  -- 対象シーズが厳密に1件であること (id + title + institution の三重一致)
  SELECT count(*) INTO target_seed_count
  FROM seeds
  WHERE id = '3c6c774d-4f8e-4d99-aa00-f149a75f98d5'
    AND title = 'ゼオライトを共通基盤とするナトリウムイオン二次電池材料'
    AND org_name = '愛媛大学'
    AND institution_id = 'inst_ehime';
  IF target_seed_count <> 1 THEN
    RAISE EXCEPTION '対象ゼオライトシーズ (id=3c6c774d..., inst_ehime) が % 件 (想定=1)', target_seed_count;
  END IF;

  -- ehime ワークスペースが存在すること (212 適用済みの前提)
  IF NOT EXISTS (SELECT 1 FROM institution_workspaces WHERE slug = 'ehime') THEN
    RAISE EXCEPTION 'institution_workspaces に slug=ehime が存在しない (migration 212 未適用?)';
  END IF;
END $$;

-- =====================================================================
-- 1. projects: p31 = ZEO (ゼオライトテーマ)
-- =====================================================================
INSERT INTO projects (
  project_id, project_name, status, project_category, client_name
)
VALUES (
  'p31', 'ZEO', 'draft', 'dtsu', '国立大学法人愛媛大学'
)
ON CONFLICT (project_id) DO UPDATE SET
  project_name     = EXCLUDED.project_name,
  project_category = EXCLUDED.project_category,
  client_name      = EXCLUDED.client_name,
  updated_at       = NOW();
-- status は ON CONFLICT で更新しない: admin が active へ上げた後、
-- migration 再実行で draft に巻き戻る事故を防ぐ (212 §10 と同じ不変条件)。

-- =====================================================================
-- 2. seed_projects: p31 × ゼオライトシーズ
-- =====================================================================
INSERT INTO seed_projects (
  project_id, seed_id, commercialization_stage, venture_name
)
VALUES (
  'p31', '3c6c774d-4f8e-4d99-aa00-f149a75f98d5', 'under_consideration', NULL
)
ON CONFLICT (project_id) DO UPDATE SET
  seed_id                 = EXCLUDED.seed_id,
  commercialization_stage = EXCLUDED.commercialization_stage,
  updated_at              = now();

-- =====================================================================
-- 3. ehime ワークスペースの project scope へ p31 を summary 共有で追加
--    ON CONFLICT DO NOTHING: admin が pause/revoke した状態を再実行で戻さない (212 §10)。
-- =====================================================================
INSERT INTO institution_workspace_project_scopes (workspace_id, project_id, status, shared_surface)
SELECT w.id, 'p31', 'active', 'summary'
FROM institution_workspaces w
WHERE w.slug = 'ehime'
ON CONFLICT (workspace_id, project_id) DO NOTHING;

-- =====================================================================
-- 事後 assert
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM seed_projects sp
    JOIN projects p ON p.project_id = sp.project_id
    WHERE sp.project_id = 'p31'
      AND sp.seed_id = '3c6c774d-4f8e-4d99-aa00-f149a75f98d5'
      AND p.project_name = 'ZEO'
  ) THEN
    RAISE EXCEPTION 'p31 と ゼオライトシーズの seed_projects 接続が成立していない';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM institution_workspace_project_scopes s
    JOIN institution_workspaces w ON w.id = s.workspace_id
    WHERE w.slug = 'ehime' AND s.project_id = 'p31'
  ) THEN
    RAISE EXCEPTION 'ehime ワークスペースの p31 scope が成立していない';
  END IF;
END $$;
