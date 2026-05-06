-- 010_pj_status_extensions.sql
--
-- PJ Status の追加要件 (まさ 2026-05-06):
--   1. AMD 支援期間 (amd_support_started_at / amd_support_ended_at)
--   2. 詳細事業概要 (long_description) — short_description より長文、つくよみがマージする
--   3. project_venture_members: SU 内メンバー (AMD 社員と SU 内の人を両方扱う)。HRL 評価のベース
--   4. project_partners: 協業先 / 顧客候補
--   5. project_pl_monthly: 月次試算表 (売上 / 売上原価 / 各種販管費)
--   6. outcome_pattern に設立前用の値 (tbd / planning / stalled) を運用追加 (CHECK 制約は元々ない)

-- ============================================================
-- 1. project_ventures に列追加
-- ============================================================

ALTER TABLE project_ventures ADD COLUMN IF NOT EXISTS amd_support_started_at DATE;
ALTER TABLE project_ventures ADD COLUMN IF NOT EXISTS amd_support_ended_at DATE;
ALTER TABLE project_ventures ADD COLUMN IF NOT EXISTS long_description TEXT;

-- ============================================================
-- 2. project_venture_members
-- ============================================================

CREATE TABLE IF NOT EXISTS project_venture_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,                 -- CEO / CTO / CFO / PI / Engineer / Advisor / Sales / etc (free)
  started_at DATE,
  ended_at DATE,                      -- NULL = 現在も参画中
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pvm_project ON project_venture_members(project_id);

ALTER TABLE project_venture_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON project_venture_members;
CREATE POLICY anon_read ON project_venture_members FOR SELECT USING (true);
DROP POLICY IF EXISTS admin_all ON project_venture_members;
CREATE POLICY admin_all ON project_venture_members FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS service_role_bypass ON project_venture_members;
CREATE POLICY service_role_bypass ON project_venture_members FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 3. project_partners (興味事業会社: 協業先 / 顧客候補)
-- ============================================================

CREATE TABLE IF NOT EXISTS project_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  partner_name TEXT NOT NULL,
  partner_type TEXT NOT NULL,           -- 'collab' | 'customer'
  -- collab 用
  partner_role TEXT,                    -- 業務分担 (協業先のみ)
  -- customer 用
  sales_target_date DATE,               -- 販売予定日
  remaining_conditions TEXT,            -- 売買契約までの残条件
  is_sold BOOLEAN NOT NULL DEFAULT FALSE,
  sales_actuals JSONB NOT NULL DEFAULT '{}'::jsonb,  -- 販売済みの場合の実績 (金額・数量・契約条件)
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (partner_type IN ('collab', 'customer'))
);
CREATE INDEX IF NOT EXISTS idx_pp_project ON project_partners(project_id);

ALTER TABLE project_partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON project_partners;
CREATE POLICY anon_read ON project_partners FOR SELECT USING (true);
DROP POLICY IF EXISTS admin_all ON project_partners;
CREATE POLICY admin_all ON project_partners FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS service_role_bypass ON project_partners;
CREATE POLICY service_role_bypass ON project_partners FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 4. project_pl_monthly (月次試算表)
-- ============================================================

CREATE TABLE IF NOT EXISTS project_pl_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  ym TEXT NOT NULL,                          -- 'YYYY-MM'
  revenue_yen BIGINT NOT NULL DEFAULT 0,
  cogs_yen BIGINT NOT NULL DEFAULT 0,
  personnel_yen BIGINT NOT NULL DEFAULT 0,
  rd_yen BIGINT NOT NULL DEFAULT 0,
  marketing_yen BIGINT NOT NULL DEFAULT 0,
  other_opex_yen BIGINT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, ym)
);
CREATE INDEX IF NOT EXISTS idx_pplm_project ON project_pl_monthly(project_id, ym);

ALTER TABLE project_pl_monthly ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON project_pl_monthly;
CREATE POLICY anon_read ON project_pl_monthly FOR SELECT USING (true);
DROP POLICY IF EXISTS admin_all ON project_pl_monthly;
CREATE POLICY admin_all ON project_pl_monthly FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS service_role_bypass ON project_pl_monthly;
CREATE POLICY service_role_bypass ON project_pl_monthly FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
