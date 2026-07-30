-- 202_soil_seeds_institution_link.sql
-- 目的: 「土壌×シーズ」タブ (研究機関ECR × 所属シーズSPS の観測時点断面) のための
--       最小スキーマ追加。新規テーブルは作らない (既存 institutions / seeds / institution_assessments /
--       seed_sps_assessments を再利用)。
--
-- 追加1: seeds.institution_id (nullable FK -> institutions.institution_id)
--   既存の org_name 文字列一致 (KUTE cockpit の researchInstitutionSeedsOrgNameForProject) を
--   institution_id 直接参照へ移行するための列。既存行は全て NULL のまま、KUTE分だけ本migrationで backfill する。
--
-- 追加2: institution_assessments.evaluation_version (NOT NULL, default 'v1')
--   ECR評価のバージョン管理列。既存 assessment は全て rubric v1 のもの (v0の履歴なし) なので 'v1' 一括付与。
--
-- 安全性: RAISE EXCEPTION による存在 assert (migration 188 と同じガード方式)。
--   backfill対象は「工学院大学」の seeds 全件 (cron発見分の未レビューseedsも含め institution_id は付与してよい。
--   SPS評価値そのものは 188 backfill 済み6件のみ、新規発見3件はSPS未評価のまま=このmigrationでは弄らない)。

DO $$
DECLARE
  kute_seed_count integer;
BEGIN
  SELECT count(*) INTO kute_seed_count FROM seeds WHERE org_name = '工学院大学';
  IF kute_seed_count < 1 THEN
    RAISE EXCEPTION 'seeds.org_name=工学院大学 が0件 (想定外)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM institutions WHERE institution_id = 'inst_kute') THEN
    RAISE EXCEPTION 'institutions.institution_id=inst_kute が存在しない';
  END IF;
END $$;

ALTER TABLE seeds
  ADD COLUMN IF NOT EXISTS institution_id text REFERENCES institutions(institution_id);

ALTER TABLE institution_assessments
  ADD COLUMN IF NOT EXISTS evaluation_version text NOT NULL DEFAULT 'v1';

CREATE INDEX IF NOT EXISTS idx_seeds_institution_id
  ON seeds (institution_id)
  WHERE institution_id IS NOT NULL;

COMMENT ON COLUMN seeds.institution_id IS
  '所属研究機関。ECRは機関、SPSはシーズ評価として別系列のまま institution_id で観測整列する。';

COMMENT ON COLUMN institution_assessments.evaluation_version IS
  'ECR rubric / scoring definition version at evaluation time.';

DO $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE seeds
  SET institution_id = 'inst_kute', updated_at = now()
  WHERE org_name = '工学院大学' AND institution_id IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  -- 再実行時 (既に backfill 済み) は 0 件更新もありうるので、org_name 側の件数と一致するかで再確認する
  IF (SELECT count(*) FROM seeds WHERE org_name = '工学院大学' AND institution_id = 'inst_kute')
     <> (SELECT count(*) FROM seeds WHERE org_name = '工学院大学') THEN
    RAISE EXCEPTION 'institution_id backfill後、工学院大学の全件が inst_kute に紐付いていない';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM seeds
    WHERE org_name = '工学院大学'
      AND institution_id IS DISTINCT FROM 'inst_kute'
  ) THEN
    RAISE EXCEPTION '工学院大学シーズに inst_kute 以外の所属が残っている';
  END IF;

  RAISE NOTICE 'seeds.institution_id backfill: % 件更新 (工学院大学 -> inst_kute)', updated_count;
END $$;
