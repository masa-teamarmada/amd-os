-- 206_ehm_link_sx_seed.sql
--
-- EHM (inst_ehime / 愛媛大学) に、PJ化済み (spun_off) の SX シーズを追加で紐付ける。
-- 対象: title='CO2と太陽光を資源とする排水処理 (シアノバクテリア × カーボンニュートラル)'
--       researcher_name='杉浦 美羽', org_name='愛媛大学', status='spun_off',
--       spun_off_project_id='p21' の1件を institution_id='inst_ehime' に紐付ける。
-- 204 (ゼオライトseed) と同じガード方式。204 自体は変更しない。
-- researcher_name は既存値 (杉浦 美羽) をそのまま保持し、書き換えない。

DO $$
DECLARE
  inst_name text;
  target_seed_count integer;
BEGIN
  -- inst_ehime が既に 愛媛大学 として登録されていること
  SELECT name INTO inst_name FROM institutions WHERE institution_id = 'inst_ehime';
  IF inst_name IS DISTINCT FROM '愛媛大学' THEN
    RAISE EXCEPTION 'institutions.institution_id=inst_ehime が想定の "愛媛大学" ではない (実際: %)', inst_name;
  END IF;

  -- 対象シーズが厳密に1件であること (未紐付け or 既に inst_ehime のいずれか)
  SELECT count(*) INTO target_seed_count
  FROM seeds
  WHERE title = 'CO2と太陽光を資源とする排水処理 (シアノバクテリア × カーボンニュートラル)'
    AND researcher_name = '杉浦 美羽'
    AND org_name = '愛媛大学'
    AND status = 'spun_off'
    AND spun_off_project_id = 'p21'
    AND (institution_id IS NULL OR institution_id = 'inst_ehime');
  IF target_seed_count <> 1 THEN
    RAISE EXCEPTION '対象シーズ (CO2と太陽光を資源とする排水処理 SX seed, 杉浦 美羽, 愛媛大学, spun_off, p21) が % 件 (想定=1)', target_seed_count;
  END IF;
END $$;

-- =====================================================================
-- seeds: 対象1件のみ institution_id = inst_ehime に紐付け
-- =====================================================================
DO $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE seeds
  SET institution_id = 'inst_ehime', updated_at = now()
  WHERE title = 'CO2と太陽光を資源とする排水処理 (シアノバクテリア × カーボンニュートラル)'
    AND researcher_name = '杉浦 美羽'
    AND org_name = '愛媛大学'
    AND status = 'spun_off'
    AND spun_off_project_id = 'p21'
    AND institution_id IS DISTINCT FROM 'inst_ehime';

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RAISE NOTICE 'seeds.institution_id backfill: % 件更新 (愛媛大学SX seed(杉浦 美羽, p21) -> inst_ehime)', updated_count;

  -- inst_ehime に紐付くシーズが厳密に2件、かつそれが
  -- 「本SX seed」+「既存のゼオライトseed (野村信福)」のちょうど2件であること
  IF (SELECT count(*) FROM seeds WHERE institution_id = 'inst_ehime') <> 2 THEN
    RAISE EXCEPTION 'inst_ehime に紐付くシーズが2件ではない (誤って他行を更新した可能性)';
  END IF;

  IF (SELECT count(*) FROM seeds
      WHERE institution_id = 'inst_ehime'
        AND title = 'CO2と太陽光を資源とする排水処理 (シアノバクテリア × カーボンニュートラル)'
        AND researcher_name = '杉浦 美羽') <> 1 THEN
    RAISE EXCEPTION 'inst_ehime に SX seed (杉浦 美羽) が正しく紐付いていない';
  END IF;

  IF (SELECT count(*) FROM seeds
      WHERE institution_id = 'inst_ehime'
        AND title = 'ゼオライトを共通基盤とするナトリウムイオン二次電池材料'
        AND researcher_name = '野村信福') <> 1 THEN
    RAISE EXCEPTION 'inst_ehime に既存のゼオライトseed (野村信福) が見当たらない (204の紐付けが崩れている可能性)';
  END IF;
END $$;
