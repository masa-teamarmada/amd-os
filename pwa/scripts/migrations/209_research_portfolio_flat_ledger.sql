-- 209_research_portfolio_flat_ledger.sql
--
-- 研究機関カタログと個別シーズ台帳を、AMDとの契約有無に依存せず育てる。
-- 既存 projects 親と institution_projects / seed_projects の物理分離は維持し、
-- 過去の個別シーズ型PJだけを seed_projects へ補完する。
--
-- ECR（研究機関環境）とSPS（個別シーズ/PJ）は別系列のまま保持し、合算しない。

BEGIN;

-- 1. 研究機関カタログ: 根拠のない一言を撤去し、不足する2機関を補完する。
INSERT INTO public.institutions (
  institution_id, name, short_name, type, description, region,
  contract_status, identity_status, sort_order
)
VALUES
  ('inst_qst', '量子科学技術研究開発機構', 'QST', 'research_institute', NULL, NULL, 'unengaged', 'verified', 100),
  ('inst_yamaguchi', '山口大学', NULL, 'university', NULL, '山口県', 'unengaged', 'verified', 100)
ON CONFLICT (institution_id) DO UPDATE SET
  name = EXCLUDED.name,
  short_name = EXCLUDED.short_name,
  type = EXCLUDED.type,
  description = NULL,
  region = coalesce(public.institutions.region, EXCLUDED.region),
  identity_status = EXCLUDED.identity_status,
  updated_at = now();

UPDATE public.institutions
SET description = NULL,
    updated_at = CASE WHEN description IS NOT NULL THEN now() ELSE updated_at END
WHERE description IS NOT NULL;

-- 香川大学から受託済みの機関PJはなく、p26は個別シーズPJ。
-- 機関としては「PJ化検討中」に置き、active契約と誤表示しない。
UPDATE public.institutions
SET contract_status = 'prospect', updated_at = now()
WHERE institution_id = 'inst_kagawa'
  AND contract_status IS DISTINCT FROM 'prospect';

-- 2. 過去AMD関与PJのうち、個別シーズ型だけを台帳へ追加する。
-- UUIDはproject_idから決まるため再適用しても同じ行へ収束する。
CREATE TEMP TABLE historical_seed_project_map (
  project_id text PRIMARY KEY,
  seed_id uuid NOT NULL,
  title text NOT NULL,
  summary text,
  org_name text NOT NULL,
  org_type text,
  institution_id text,
  researcher_name text,
  seed_status text NOT NULL,
  commercialization_stage text NOT NULL,
  venture_name text
) ON COMMIT DROP;

INSERT INTO historical_seed_project_map VALUES
  ('p01', md5('amd-os:historical-seed-project:p01')::uuid, 'OPTMASS 技術シーズ（技術詳細未確認）', 'AMDが関与したOPTMASSの個別シーズPJ。技術詳細は未確認。', '京都大学', 'university', 'inst_catalog_0278b48721bd', NULL, 'spun_off', 'operating_company', 'OPTMASS'),
  ('p02', md5('amd-os:historical-seed-project:p02')::uuid, '生成AI動画アプリ（紙芝居型動画生成）', '紙芝居型の動画生成アプリとしてAMDが関与した個別シーズPJ。', '慶應義塾大学', 'university', 'inst_catalog_2e634684f6dc', NULL, 'spun_off', 'operating_company', 'r3kt'),
  ('p03', md5('amd-os:historical-seed-project:p03')::uuid, '透明断熱エアロゲル SUFA', '常圧製造の透明断熱エアロゲルSUFA。', '京都大学', 'university', 'inst_catalog_0278b48721bd', '山地 正洋', 'spun_off', 'operating_company', 'ティエムファクトリ'),
  ('p04', md5('amd-os:historical-seed-project:p04')::uuid, '農業用AIロボット Adam', '農業現場向けAIロボットAdam。', '東北大学', 'university', 'inst_catalog_9ed928e1e75c', 'Tamir Blum', 'spun_off', 'operating_company', '輝翠'),
  ('p05', md5('amd-os:historical-seed-project:p05')::uuid, 'マテリアル・コンセプト 技術シーズ（技術詳細未確認）', 'AMDが関与したマテリアル・コンセプトの個別シーズPJ。技術詳細は未確認。', '東北大学', 'university', 'inst_catalog_9ed928e1e75c', NULL, 'spun_off', 'operating_company', 'マテリアル・コンセプト'),
  ('p06', md5('amd-os:historical-seed-project:p06')::uuid, '虚血性脳卒中向けレドックスナノ粒子 CTB211', '虚血性脳卒中向けレドックスナノ粒子CTB211。', '筑波大学', 'university', 'inst_catalog_7c4c7f7501f8', '丸島 愛樹', 'spun_off', 'operating_company', 'CrestecBio'),
  ('p07', md5('amd-os:historical-seed-project:p07')::uuid, '電気化学ポンピングによるリチウム回収 LISMIC', '電気化学ポンピングを用いるリチウム回収技術LISMIC。', '量子科学技術研究開発機構', 'research_institute', 'inst_qst', NULL, 'spun_off', 'operating_company', 'LiSTie'),
  ('p08', md5('amd-os:historical-seed-project:p08')::uuid, 'PDMSによるCO2吸着・分離', 'PDMSを用いるCO2吸着・分離技術。', '物質・材料研究機構 (NIMS)', 'research_institute', 'inst_nims', '一ノ瀬 泉', 'spun_off', 'operating_company', 'Carbon Cryo Capture'),
  ('p09', md5('amd-os:historical-seed-project:p09')::uuid, '流動層熱分解による廃棄物処理', '流動層熱分解による廃棄物処理技術。', '群馬大学', 'university', 'inst_catalog_75953cdd2d43', NULL, 'spun_off', 'operating_company', 'JOYCLE'),
  ('p10', md5('amd-os:historical-seed-project:p10')::uuid, 'RF/DC変換ダイオードによるマイクロ波ワイヤレス給電', 'RF/DC変換ダイオードを用いるマイクロ波ワイヤレス給電技術。', '京都大学', 'university', 'inst_catalog_0278b48721bd', NULL, 'spun_off', 'operating_company', '翔エンジニアリング'),
  ('p11', md5('amd-os:historical-seed-project:p11')::uuid, '塩分濃度差発電（逆電気透析）', '逆電気透析を用いる塩分濃度差発電技術。', '山口大学', 'university', 'inst_yamaguchi', NULL, 'spun_off', 'operating_company', 'Blue Water Energy'),
  ('p16', md5('amd-os:historical-seed-project:p16')::uuid, 'ORLIB 技術シーズ（技術詳細未確認）', 'AMDが関与したORLIBの個別シーズPJ。技術詳細は未確認。', '東京大学', 'university', 'inst_catalog_ff01bb8086e3', NULL, 'spun_off', 'operating_company', 'ORLIB'),
  ('p18', md5('amd-os:historical-seed-project:p18')::uuid, '波力発電', 'AMDが関与した波力発電の個別シーズPJ。研究機関は未確認。', '研究機関未確認', NULL, NULL, NULL, 'spun_off', 'operating_company', 'Yellow Duck'),
  ('p20', md5('amd-os:historical-seed-project:p20')::uuid, '磁気冷凍による低温冷却', '磁気冷凍を用いる低温冷却技術。会社は未設立。', '物質・材料研究機構 (NIMS)', 'research_institute', 'inst_nims', '神谷 宏治', 'discussing', 'pre_incorporation', 'CryoX（仮称）'),
  ('p22', md5('amd-os:historical-seed-project:p22')::uuid, '光量子コンピュータ', 'AMDが関与した光量子コンピュータの個別シーズPJ。研究機関は未確認。', '研究機関未確認', NULL, NULL, NULL, 'spun_off', 'operating_company', 'OptQC'),
  ('p24', md5('amd-os:historical-seed-project:p24')::uuid, 'マグナス式垂直軸風力発電', 'マグナス式垂直軸風力発電技術。研究機関は未確認。', '研究機関未確認', NULL, NULL, NULL, 'spun_off', 'operating_company', 'チャレナジー'),
  ('p29', md5('amd-os:historical-seed-project:p29')::uuid, 'SiC/SiC CMC耐熱複合材', 'SiC/SiC CMC耐熱複合材の事業化検討。研究機関は未確認。', '研究機関未確認', NULL, NULL, NULL, 'discussing', 'under_consideration', 'KENQ');

DO $$
BEGIN
  IF (SELECT count(*) FROM public.projects p JOIN historical_seed_project_map h USING (project_id)) <> 17 THEN
    RAISE EXCEPTION 'migration 209: 追加対象17PJのいずれかがprojectsに存在しない';
  END IF;
  IF (SELECT count(*) FROM public.seeds WHERE id = 'f4f4e30e-35ff-4c95-b9b0-f5629237b28e') <> 1 THEN
    RAISE EXCEPTION 'migration 209: SX(p21)の既存seedが見つからない';
  END IF;
  IF (SELECT count(*) FROM public.seeds WHERE id = '8b2ec717-027c-4cb5-9760-190ccf30f71a') <> 1 THEN
    RAISE EXCEPTION 'migration 209: VasculaX(p26)の既存seedが見つからない';
  END IF;
END $$;

INSERT INTO public.seeds (
  id, title, summary, org_name, org_type, institution_id, researcher_name,
  status, is_public, source, source_detail, discovery_status
)
SELECT
  seed_id, title, summary, org_name, org_type, institution_id, researcher_name,
  seed_status, false, 'amd_project_history',
  'migration_209:project_id=' || project_id || '; relation=individual_seed_project',
  'reviewed'
FROM historical_seed_project_map
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  org_name = EXCLUDED.org_name,
  org_type = EXCLUDED.org_type,
  institution_id = EXCLUDED.institution_id,
  researcher_name = EXCLUDED.researcher_name,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  source_detail = EXCLUDED.source_detail,
  updated_at = now();

INSERT INTO public.seed_projects (
  project_id, seed_id, commercialization_stage, venture_name
)
SELECT project_id, seed_id, commercialization_stage, venture_name
FROM historical_seed_project_map
ON CONFLICT (project_id) DO UPDATE SET
  seed_id = EXCLUDED.seed_id,
  commercialization_stage = EXCLUDED.commercialization_stage,
  venture_name = EXCLUDED.venture_name,
  updated_at = now();

-- 3. 既存の設立前2シーズを正しい状態へ直し、seed_projects正本へ補完する。
UPDATE public.seeds
SET status = 'discussing', updated_at = now()
WHERE id IN (
  'f4f4e30e-35ff-4c95-b9b0-f5629237b28e',
  '8b2ec717-027c-4cb5-9760-190ccf30f71a'
)
  AND status IS DISTINCT FROM 'discussing';

-- p21とのPJ関係はseed_projectsに残る。会社設立を意味する旧列だけを解消する。
UPDATE public.seeds
SET spun_off_project_id = NULL, updated_at = now()
WHERE id = 'f4f4e30e-35ff-4c95-b9b0-f5629237b28e'
  AND spun_off_project_id IS NOT NULL;

INSERT INTO public.seed_projects (
  project_id, seed_id, commercialization_stage, venture_name
)
VALUES
  ('p21', 'f4f4e30e-35ff-4c95-b9b0-f5629237b28e', 'pre_incorporation', 'SolvioraX（仮称）'),
  ('p26', '8b2ec717-027c-4cb5-9760-190ccf30f71a', 'pre_incorporation', 'VasculaX（仮称）')
ON CONFLICT (project_id) DO UPDATE SET
  seed_id = EXCLUDED.seed_id,
  commercialization_stage = EXCLUDED.commercialization_stage,
  venture_name = EXCLUDED.venture_name,
  updated_at = now();

-- 4. SXのSPSは同日付のamd_score_inputsを、軸の意味を変えずに移す。
-- f_character=6 は当時入力 ALQ平均5.5 / grit7 / resilience6 から
-- 0.6*ALQ + 0.2*grit + 0.2*resilience = 5.9 を整数化した値。
INSERT INTO public.seed_sps_assessments (
  seed_id, evaluated_at,
  mu_a, mu_i, mu_g, potential,
  trl, brl, grl, srl, hrl,
  f_character, f_cap, frl, r_net,
  shallow_tech_mode, status, confidence, axis_evidence, missing_axes, evaluator
)
VALUES (
  'f4f4e30e-35ff-4c95-b9b0-f5629237b28e', DATE '2026-04-30',
  6, 5, 7, 8,
  4, 4, 7, 5, 4,
  6, 4, 5, 2,
  false, 'ready', 'medium',
  '{"source":"amd_score_inputs","project_id":"p21","evaluated_at":"2026-04-30","method":"field-preserving migration; f_character derived from ALQ/grit/resilience"}'::jsonb,
  ARRAY[]::text[], 'migration_209_from_amd_score_inputs'
)
ON CONFLICT (seed_id, evaluated_at) DO UPDATE SET
  mu_a = EXCLUDED.mu_a,
  mu_i = EXCLUDED.mu_i,
  mu_g = EXCLUDED.mu_g,
  potential = EXCLUDED.potential,
  trl = EXCLUDED.trl,
  brl = EXCLUDED.brl,
  grl = EXCLUDED.grl,
  srl = EXCLUDED.srl,
  hrl = EXCLUDED.hrl,
  f_character = EXCLUDED.f_character,
  f_cap = EXCLUDED.f_cap,
  frl = EXCLUDED.frl,
  r_net = EXCLUDED.r_net,
  shallow_tech_mode = EXCLUDED.shallow_tech_mode,
  status = EXCLUDED.status,
  confidence = EXCLUDED.confidence,
  axis_evidence = EXCLUDED.axis_evidence,
  missing_axes = EXCLUDED.missing_axes,
  evaluator = EXCLUDED.evaluator,
  updated_at = now();

-- 5. 対象限定の不変条件。ECRテーブルには触らない。
DO $$
DECLARE
  target_ids CONSTANT text[] := ARRAY[
    'p01','p02','p03','p04','p05','p06','p07','p08','p09','p10','p11',
    'p16','p18','p20','p21','p22','p24','p26','p29'
  ];
BEGIN
  IF (SELECT count(*) FROM public.seed_projects WHERE project_id = ANY(target_ids)) <> 19 THEN
    RAISE EXCEPTION 'migration 209: 個別シーズ型PJ 19件がseed_projectsへ揃っていない';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.seed_projects sp
    JOIN public.institution_projects ip USING (project_id)
    WHERE sp.project_id = ANY(target_ids)
  ) THEN
    RAISE EXCEPTION 'migration 209: 同一PJがinstitution/seed両方に重複した';
  END IF;
  IF EXISTS (SELECT 1 FROM public.institutions WHERE description IS NOT NULL) THEN
    RAISE EXCEPTION 'migration 209: institutions.descriptionがNULLへ正規化されていない';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.seeds s
    JOIN public.seed_projects sp ON sp.seed_id = s.id
    WHERE sp.project_id = 'p21'
      AND s.status = 'discussing'
      AND s.spun_off_project_id IS NULL
      AND sp.commercialization_stage = 'pre_incorporation'
      AND sp.venture_name = 'SolvioraX（仮称）'
  ) THEN
    RAISE EXCEPTION 'migration 209: SXが会社未設立の状態へ揃っていない';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.seed_sps_assessments
    WHERE seed_id = 'f4f4e30e-35ff-4c95-b9b0-f5629237b28e'
      AND evaluated_at = DATE '2026-04-30'
      AND status = 'ready'
      AND cardinality(missing_axes) = 0
  ) THEN
    RAISE EXCEPTION 'migration 209: SXのSPS評価がreadyでない';
  END IF;
END $$;

COMMIT;
