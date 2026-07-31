-- 207_institution_seed_project_domains.sql
--
-- 研究機関 / シーズを AMD の契約有無に依存しない正本カタログとして維持しつつ、
-- 契約後に増える運用情報を projects 親 + 種別別の子テーブルへ分離する。
--
--   institutions       研究機関カタログ + ECR（機関環境）
--   seeds              個別シーズカタログ + SPS（個別シーズ）
--   projects           契約・月次・タスク等の共通運用親
--   institution_projects 研究機関全体を対象にする PJ
--   seed_projects        個別シーズの事業化を対象にする PJ
--
-- ECR と SPS は別系列のまま保持し、ここでは合算・再計算しない。
-- p30 EHM は愛媛大学全体のエコシステム構築 PJ。ゼオライトシーズの PJ ではない。

BEGIN;

-- =====================================================================
-- 1. 研究機関カタログを「契約中だけの表」から独立させる
-- =====================================================================

ALTER TABLE public.institutions
  ALTER COLUMN contract_status SET DEFAULT 'unengaged';

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS identity_status text NOT NULL DEFAULT 'verified';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'institutions_contract_status_check'
      AND conrelid = 'public.institutions'::regclass
  ) THEN
    ALTER TABLE public.institutions
      ADD CONSTRAINT institutions_contract_status_check
      CHECK (contract_status IN ('unengaged', 'draft', 'prospect', 'active', 'past'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'institutions_identity_status_check'
      AND conrelid = 'public.institutions'::regclass
  ) THEN
    ALTER TABLE public.institutions
      ADD CONSTRAINT institutions_identity_status_check
      CHECK (identity_status IN ('verified', 'candidate'));
  END IF;
END $$;

COMMENT ON COLUMN public.institutions.contract_status IS
  'AMDとの関係状態。カタログ掲載とは独立: unengaged/draft/prospect/active/past。';
COMMENT ON COLUMN public.institutions.identity_status IS
  '機関名称の確認状態。candidate は推定名称を含み、確認前に verified と扱わない。';

-- university / national_lab の全シーズから研究機関カタログを作る。
-- 既存4機関は既存IDを正本として使い、その他は org_name の md5 から安定IDを作る。
CREATE TEMP TABLE institution_catalog_map ON COMMIT DROP AS
SELECT
  org_name,
  CASE org_name
    WHEN '香川大学' THEN 'inst_kagawa'
    WHEN '工学院大学' THEN 'inst_kute'
    WHEN '物質・材料研究機構' THEN 'inst_nims'
    WHEN '愛媛大学' THEN 'inst_ehime'
    ELSE 'inst_catalog_' || substr(md5(org_name), 1, 12)
  END AS institution_id,
  CASE WHEN bool_or(org_type = 'national_lab') THEN 'research_institute' ELSE 'university' END AS institution_type,
  min(nullif(btrim(org_region), '')) AS region,
  CASE WHEN org_name LIKE '%(推定)%' OR org_name LIKE '%（推定）%' THEN 'candidate' ELSE 'verified' END AS identity_status
FROM public.seeds
WHERE org_type IN ('university', 'national_lab')
GROUP BY org_name;

DO $$
DECLARE
  org_count integer;
  seed_count integer;
BEGIN
  SELECT count(*) INTO org_count FROM institution_catalog_map;
  SELECT count(*) INTO seed_count
  FROM public.seeds WHERE org_type IN ('university', 'national_lab');

  IF org_count <> 46 THEN
    RAISE EXCEPTION '研究機関候補が % 件 (監査時想定=46)。追加・削除を確認して migration を更新すること', org_count;
  END IF;
  IF seed_count <> 141 THEN
    RAISE EXCEPTION '大学/国研シーズが % 件 (監査時想定=141)。追加・削除を確認して migration を更新すること', seed_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.seeds s
    JOIN institution_catalog_map m ON m.org_name = s.org_name
    WHERE s.org_type IN ('university', 'national_lab')
      AND s.institution_id IS NOT NULL
      AND s.institution_id IS DISTINCT FROM m.institution_id
  ) THEN
    RAISE EXCEPTION '既存 seeds.institution_id に org_name と矛盾する紐付けがあるため自動移行を中止';
  END IF;
END $$;

INSERT INTO public.institutions (
  institution_id, name, short_name, type, description, region,
  contract_status, identity_status, sort_order
)
SELECT
  m.institution_id,
  m.org_name,
  NULL,
  m.institution_type,
  CASE WHEN m.identity_status = 'candidate'
    THEN 'シーズ台帳の機関表記から抽出。正式名称は未確認。'
    ELSE 'シーズ台帳から研究機関カタログへ追加。'
  END,
  m.region,
  'unengaged',
  m.identity_status,
  100 + row_number() OVER (ORDER BY m.org_name)
FROM institution_catalog_map m
ON CONFLICT (institution_id) DO UPDATE SET
  name = CASE
    WHEN public.institutions.institution_id LIKE 'inst_catalog_%' THEN EXCLUDED.name
    ELSE public.institutions.name
  END,
  type = CASE
    WHEN public.institutions.institution_id LIKE 'inst_catalog_%' THEN EXCLUDED.type
    ELSE public.institutions.type
  END,
  region = coalesce(public.institutions.region, EXCLUDED.region),
  identity_status = CASE
    WHEN public.institutions.institution_id LIKE 'inst_catalog_%' THEN EXCLUDED.identity_status
    ELSE public.institutions.identity_status
  END,
  updated_at = CASE
    WHEN public.institutions.institution_id LIKE 'inst_catalog_%' THEN now()
    ELSE public.institutions.updated_at
  END;

UPDATE public.seeds s
SET institution_id = m.institution_id,
    updated_at = now()
FROM institution_catalog_map m
WHERE s.org_name = m.org_name
  AND s.org_type IN ('university', 'national_lab')
  AND s.institution_id IS DISTINCT FROM m.institution_id;

-- =====================================================================
-- 2. PJ 共通親に対する、性格の違う2種の子テーブル
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.institution_projects (
  project_id text PRIMARY KEY REFERENCES public.projects(project_id) ON DELETE CASCADE,
  institution_id text NOT NULL REFERENCES public.institutions(institution_id) ON DELETE RESTRICT,
  engagement_scope text,
  target_unit text,
  ecosystem_goal text,
  seed_discovery_in_scope boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seed_projects (
  project_id text PRIMARY KEY REFERENCES public.projects(project_id) ON DELETE CASCADE,
  seed_id uuid NOT NULL REFERENCES public.seeds(id) ON DELETE RESTRICT,
  commercialization_stage text,
  commercialization_route text,
  venture_name text,
  target_market text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_institution_projects_institution_id
  ON public.institution_projects (institution_id);
CREATE INDEX IF NOT EXISTS idx_seed_projects_seed_id
  ON public.seed_projects (seed_id);

-- 同じ projects 行が両方の子テーブルへ入ることを、並行書込みでも防ぐ。
CREATE OR REPLACE FUNCTION public.guard_project_domain_exclusivity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.project_id));

  IF TG_TABLE_NAME = 'institution_projects' THEN
    IF EXISTS (SELECT 1 FROM public.seed_projects WHERE project_id = NEW.project_id) THEN
      RAISE EXCEPTION 'project_id=% は既に seed_projects に登録済み', NEW.project_id;
    END IF;
  ELSIF EXISTS (SELECT 1 FROM public.institution_projects WHERE project_id = NEW.project_id) THEN
    RAISE EXCEPTION 'project_id=% は既に institution_projects に登録済み', NEW.project_id;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS institution_projects_domain_exclusivity ON public.institution_projects;
CREATE TRIGGER institution_projects_domain_exclusivity
  BEFORE INSERT OR UPDATE OF project_id ON public.institution_projects
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_domain_exclusivity();

DROP TRIGGER IF EXISTS seed_projects_domain_exclusivity ON public.seed_projects;
CREATE TRIGGER seed_projects_domain_exclusivity
  BEFORE INSERT OR UPDATE OF project_id ON public.seed_projects
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_domain_exclusivity();

DROP TRIGGER IF EXISTS institution_projects_set_updated_at ON public.institution_projects;
CREATE TRIGGER institution_projects_set_updated_at
  BEFORE UPDATE ON public.institution_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS seed_projects_set_updated_at ON public.seed_projects;
CREATE TRIGGER seed_projects_set_updated_at
  BEFORE UPDATE ON public.seed_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.institution_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seed_projects ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['institution_projects', 'seed_projects']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_anon_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_service_role', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (true)', t || '_anon_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (is_admin()) WITH CHECK (is_admin())', t || '_admin_all', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t || '_service_role', t);
  END LOOP;
END $$;

COMMENT ON TABLE public.institution_projects IS
  '研究機関全体を対象にしたAMD受託PJ。契約/月次/タスクはprojects系、機関固有の対象範囲は本表に置く。';
COMMENT ON TABLE public.seed_projects IS
  '個別シーズの事業化を対象にしたAMD受託PJ。SPSはseed_sps_assessmentsに保持し、ECRと合算しない。';
COMMENT ON COLUMN public.institution_projects.engagement_scope IS
  '機関PJの対象範囲。例: university_wide。個別シーズIDは置かない。';
COMMENT ON COLUMN public.seed_projects.commercialization_route IS
  'シーズ事業化PJの経路。未確認はNULL。研究機関ECRは置かない。';
COMMENT ON COLUMN public.seeds.spun_off_project_id IS
  '旧AMD-PJ参照列。207以降の正本はseed_projects。既存値は互換性のため保持し、新規関係判定には使わない。';

-- =====================================================================
-- 3. 確定済みPJだけを移行。p20/p26 は未確認なので入れない
-- =====================================================================

DO $$
BEGIN
  IF (SELECT count(*) FROM public.projects WHERE project_id IN ('p25', 'p28', 'p30')) <> 3 THEN
    RAISE EXCEPTION '確定済み研究機関PJ p25/p28/p30 のいずれかが projects に存在しない';
  END IF;
  IF (SELECT count(*) FROM public.seeds WHERE spun_off_project_id = 'p21') <> 1 THEN
    RAISE EXCEPTION 'p21 に対応する旧シーズ参照が厳密に1件ではない';
  END IF;
END $$;

INSERT INTO public.institution_projects (
  project_id, institution_id, engagement_scope, ecosystem_goal
)
VALUES
  ('p25', 'inst_kute', NULL, NULL),
  ('p28', 'inst_nims', NULL, NULL),
  ('p30', 'inst_ehime', 'university_wide', '愛媛大学全体のエコシステム構築')
ON CONFLICT (project_id) DO UPDATE SET
  institution_id = EXCLUDED.institution_id,
  engagement_scope = EXCLUDED.engagement_scope,
  ecosystem_goal = EXCLUDED.ecosystem_goal;

INSERT INTO public.seed_projects (project_id, seed_id)
SELECT 'p21', id
FROM public.seeds
WHERE spun_off_project_id = 'p21'
ON CONFLICT (project_id) DO UPDATE SET seed_id = EXCLUDED.seed_id;

-- =====================================================================
-- 4. 移行後の不変条件
-- =====================================================================

DO $$
BEGIN
  IF (SELECT count(*) FROM public.institutions) <> 46 THEN
    RAISE EXCEPTION 'institutions が46件ではない';
  END IF;
  IF (SELECT count(*) FROM public.seeds
      WHERE org_type IN ('university', 'national_lab') AND institution_id IS NOT NULL) <> 141 THEN
    RAISE EXCEPTION '大学/国研シーズ141件が全件 institution_id に紐付いていない';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.seeds s
    JOIN public.institutions i ON i.institution_id = s.institution_id
    WHERE s.org_type IN ('university', 'national_lab')
      AND NOT (
        s.org_name = i.name
        OR (s.org_name = '物質・材料研究機構' AND i.institution_id = 'inst_nims')
      )
  ) THEN
    RAISE EXCEPTION '研究機関とシーズの機関名対応に不整合がある';
  END IF;
  IF (SELECT count(*) FROM public.institution_projects WHERE project_id IN ('p25', 'p28', 'p30')) <> 3 THEN
    RAISE EXCEPTION '研究機関PJ p25/p28/p30 の移行が不完全';
  END IF;
  IF (SELECT count(*) FROM public.seed_projects WHERE project_id = 'p21') <> 1 THEN
    RAISE EXCEPTION 'シーズPJ p21 の移行が不完全';
  END IF;
  IF EXISTS (SELECT 1 FROM public.institution_projects WHERE project_id IN ('p20', 'p26'))
     OR EXISTS (SELECT 1 FROM public.seed_projects WHERE project_id IN ('p20', 'p26')) THEN
    RAISE EXCEPTION '未確認PJ p20/p26 を自動分類してはいけない';
  END IF;
  IF EXISTS (
    SELECT project_id FROM public.institution_projects
    INTERSECT
    SELECT project_id FROM public.seed_projects
  ) THEN
    RAISE EXCEPTION '同一PJが研究機関PJとシーズPJに二重登録されている';
  END IF;
END $$;

COMMIT;
