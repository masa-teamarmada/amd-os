-- 167_poc_matching.sql
--
-- PoCサービスで使う、企業候補リストとシーズ×企業マッチ台帳。
-- 起点: 2026-07-09 PoCサービスMTGの要約メモ
--
-- 方針:
-- - `seeds` は研究・シーズ側の正本として再利用する
-- - `poc_companies` はPoCを受けてくれそうな企業側リスト
-- - `poc_matches` はシーズ×企業の案件化・ヒアリング・謝礼/契約/収益分配メモ
-- - 議事録全文やURLは保存しない。source_ref/source_noteには短い参照名だけを入れる

CREATE TABLE IF NOT EXISTS poc_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  company_size TEXT,
  industry_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  region TEXT,
  poc_profile TEXT,
  poc_history_note TEXT,
  incentive_note TEXT,
  source_kind TEXT,
  source_ref TEXT,
  owner_member_id TEXT REFERENCES members(member_id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'candidate',
  next_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT REFERENCES members(member_id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES members(member_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_poc_companies_status ON poc_companies(status);
CREATE INDEX IF NOT EXISTS idx_poc_companies_owner ON poc_companies(owner_member_id);
CREATE INDEX IF NOT EXISTS idx_poc_companies_updated_at ON poc_companies(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_poc_companies_industry_tags ON poc_companies USING GIN(industry_tags);

COMMENT ON TABLE poc_companies IS 'PoCサービスで使う企業候補リスト。PoCを受けてくれそうな中小・事業会社候補を保持する';
COMMENT ON COLUMN poc_companies.status IS 'candidate=候補 / listed=リスト化 / contacted=接触済 / hearing=ヒアリング中 / poc_ready=PoC設計可 / archived=アーカイブ';
COMMENT ON COLUMN poc_companies.source_ref IS 'Notion/Gmail/Drive/Slack/Webなどの短い参照名。本文やURLは保存しない';

CREATE TABLE IF NOT EXISTS poc_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_id UUID REFERENCES seeds(id) ON DELETE SET NULL,
  company_id UUID REFERENCES poc_companies(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(project_id) ON DELETE SET NULL,
  match_title TEXT NOT NULL,
  fit_hypothesis TEXT,
  hearing_questions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  poc_goal TEXT,
  reward_plan TEXT,
  contract_plan TEXT,
  funding_plan TEXT,
  revenue_share_note TEXT,
  status TEXT NOT NULL DEFAULT 'candidate',
  priority TEXT NOT NULL DEFAULT 'medium',
  owner_member_id TEXT REFERENCES members(member_id) ON DELETE SET NULL,
  next_action TEXT,
  source_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT REFERENCES members(member_id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES members(member_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_poc_matches_seed ON poc_matches(seed_id);
CREATE INDEX IF NOT EXISTS idx_poc_matches_company ON poc_matches(company_id);
CREATE INDEX IF NOT EXISTS idx_poc_matches_project ON poc_matches(project_id);
CREATE INDEX IF NOT EXISTS idx_poc_matches_status ON poc_matches(status);
CREATE INDEX IF NOT EXISTS idx_poc_matches_priority ON poc_matches(priority);
CREATE INDEX IF NOT EXISTS idx_poc_matches_owner ON poc_matches(owner_member_id);
CREATE INDEX IF NOT EXISTS idx_poc_matches_updated_at ON poc_matches(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_poc_matches_hearing_questions ON poc_matches USING GIN(hearing_questions);

COMMENT ON TABLE poc_matches IS '研究シーズと企業候補のPoCマッチ台帳。ヒアリング論点、PoC条件、謝礼、契約、助成金、収益分配メモを追う';
COMMENT ON COLUMN poc_matches.status IS 'candidate=候補 / hearing_design=ヒアリング設計 / introduced=紹介済 / hearing_done=ヒアリング済 / poc_design=PoC設計中 / poc_running=PoC実施中 / deal=案件化 / archived=アーカイブ';
COMMENT ON COLUMN poc_matches.source_note IS '起点議事録やMTGカードの短い参照名。本文やURLは保存しない';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'poc_companies_status_check') THEN
    ALTER TABLE poc_companies
      ADD CONSTRAINT poc_companies_status_check
      CHECK (status IN ('candidate', 'listed', 'contacted', 'hearing', 'poc_ready', 'archived'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'poc_matches_status_check') THEN
    ALTER TABLE poc_matches
      ADD CONSTRAINT poc_matches_status_check
      CHECK (status IN ('candidate', 'hearing_design', 'introduced', 'hearing_done', 'poc_design', 'poc_running', 'deal', 'archived'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'poc_matches_priority_check') THEN
    ALTER TABLE poc_matches
      ADD CONSTRAINT poc_matches_priority_check
      CHECK (priority IN ('high', 'medium', 'low'));
  END IF;
END $$;

ALTER TABLE poc_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE poc_matches ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['poc_companies', 'poc_matches']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS anon_read ON public.%I', t);
    EXECUTE format('CREATE POLICY anon_read ON public.%I FOR SELECT USING (true)', t);

    EXECUTE format('DROP POLICY IF EXISTS authenticated_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY authenticated_all ON public.%I FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)',
      t
    );

    EXECUTE format('DROP POLICY IF EXISTS service_role_bypass ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY service_role_bypass ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
      t
    );
  END LOOP;
END $$;
