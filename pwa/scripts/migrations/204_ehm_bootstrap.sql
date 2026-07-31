-- 204_ehm_bootstrap.sql
--
-- EHM (愛媛大学 発 ナトリウムイオン二次電池材料) 案件のブートストラップ登録。
-- 投入内容:
--   1. projects に p30 (project_name='EHM', status='draft', project_category='ecosystem') を追加
--      ※ fee/contract/terms/start_ym 等の未確定項目は一切投入しない
--   2. institutions に inst_ehime (愛媛大学) を追加
--   3. seeds のうち title='ゼオライトを共通基盤とするナトリウムイオン二次電池材料' AND org_name='愛媛大学'
--      の1件を institution_id='inst_ehime' に紐付け (他行には触れない)
--
-- 安全性: RAISE EXCEPTION による事前/事後assert (migration 188/202 と同じガード方式)。

DO $$
DECLARE
  existing_project_name text;
  existing_inst_id text;
  target_seed_count integer;
BEGIN
  -- p30 が既に別プロジェクトとして使われていないか
  SELECT project_name INTO existing_project_name FROM projects WHERE project_id = 'p30';
  IF existing_project_name IS NOT NULL AND existing_project_name <> 'EHM' THEN
    RAISE EXCEPTION 'projects.project_id=p30 は既に別プロジェクト "%" として使用されている', existing_project_name;
  END IF;

  -- inst_ehime が既に別機関として使われていないか
  SELECT name INTO existing_inst_id FROM institutions WHERE institution_id = 'inst_ehime';
  IF existing_inst_id IS NOT NULL AND existing_inst_id <> '愛媛大学' THEN
    RAISE EXCEPTION 'institutions.institution_id=inst_ehime は既に別機関 "%" として使用されている', existing_inst_id;
  END IF;

  -- 対象シーズが厳密に1件であること
  SELECT count(*) INTO target_seed_count
  FROM seeds
  WHERE title = 'ゼオライトを共通基盤とするナトリウムイオン二次電池材料'
    AND org_name = '愛媛大学';
  IF target_seed_count <> 1 THEN
    RAISE EXCEPTION '対象シーズ (title=ゼオライトを共通基盤とするナトリウムイオン二次電池材料, org_name=愛媛大学) が % 件 (想定=1)', target_seed_count;
  END IF;
END $$;

-- =====================================================================
-- 1. projects: p30 = EHM
-- =====================================================================
INSERT INTO projects (
  project_id, project_name, status, project_category, client_name
)
VALUES (
  'p30', 'EHM', 'draft', 'ecosystem', '国立大学法人愛媛大学'
)
ON CONFLICT (project_id) DO UPDATE SET
  project_name     = EXCLUDED.project_name,
  status            = EXCLUDED.status,
  project_category  = EXCLUDED.project_category,
  client_name       = EXCLUDED.client_name,
  updated_at        = NOW();

-- =====================================================================
-- 2. institutions: inst_ehime = 愛媛大学
-- =====================================================================
INSERT INTO institutions (
  institution_id, name, short_name, type, description, region, contract_status, sort_order
)
VALUES (
  'inst_ehime', '愛媛大学', '愛媛大', 'university',
  'EHM (ゼオライト基盤ナトリウムイオン二次電池材料) の起源機関。',
  '愛媛', 'draft', 4
)
ON CONFLICT (institution_id) DO UPDATE SET
  name            = EXCLUDED.name,
  short_name      = EXCLUDED.short_name,
  type            = EXCLUDED.type,
  description     = EXCLUDED.description,
  region          = EXCLUDED.region,
  contract_status = EXCLUDED.contract_status,
  updated_at      = NOW();

-- =====================================================================
-- 3. seeds: 対象1件のみ institution_id = inst_ehime に紐付け
-- =====================================================================
DO $$
DECLARE
  updated_count integer;
  other_updated_count integer;
BEGIN
  UPDATE seeds
  SET institution_id = 'inst_ehime', updated_at = now()
  WHERE title = 'ゼオライトを共通基盤とするナトリウムイオン二次電池材料'
    AND org_name = '愛媛大学'
    AND institution_id IS DISTINCT FROM 'inst_ehime';

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  -- 対象シーズが厳密に1件、かつ inst_ehime に紐付いていること
  IF (SELECT count(*) FROM seeds
      WHERE title = 'ゼオライトを共通基盤とするナトリウムイオン二次電池材料'
        AND org_name = '愛媛大学'
        AND institution_id = 'inst_ehime') <> 1 THEN
    RAISE EXCEPTION '対象シーズが inst_ehime に正しく紐付いていない';
  END IF;

  -- inst_ehime に紐付いているシーズが対象1件のみであること (他行を巻き込んでいないか)
  IF (SELECT count(*) FROM seeds WHERE institution_id = 'inst_ehime') <> 1 THEN
    RAISE EXCEPTION 'inst_ehime に紐付くシーズが1件ではない (他行を誤って更新した可能性)';
  END IF;

  RAISE NOTICE 'seeds.institution_id backfill: % 件更新 (愛媛大学ゼオライトseed -> inst_ehime)', updated_count;
END $$;
