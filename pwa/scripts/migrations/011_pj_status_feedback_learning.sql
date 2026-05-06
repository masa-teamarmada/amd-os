-- 011_pj_status_feedback_learning.sql
--
-- まさ 2026-05-06 の追加要件:
--   1. 沿革修正依頼を受け付ける narrative_feedbacks
--   2. つくよみがフィードバックから学んだ lesson を保存する tsukuyomi_learnings_status
--   3. project_venture_members に member_kind / amd_member_id 列追加
--   4. project_pl_hearings: 試算表ヒアリングログ

-- ============================================================
-- 1. narrative_feedbacks
-- ============================================================

CREATE TABLE IF NOT EXISTS narrative_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  item_date TEXT,                                 -- 対象の沿革項目の date (null = 全体へのコメント)
  item_title TEXT,                                -- 対象の沿革項目の title
  feedback TEXT NOT NULL,                         -- 修正内容
  status TEXT NOT NULL DEFAULT 'open',            -- 'open' | 'applied'
  applied_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_narrative_feedbacks_pj ON narrative_feedbacks(project_id, status);

ALTER TABLE narrative_feedbacks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON narrative_feedbacks;
CREATE POLICY anon_read ON narrative_feedbacks FOR SELECT USING (true);
DROP POLICY IF EXISTS admin_all ON narrative_feedbacks;
CREATE POLICY admin_all ON narrative_feedbacks FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS service_role_bypass ON narrative_feedbacks;
CREATE POLICY service_role_bypass ON narrative_feedbacks FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 2. tsukuyomi_learnings_status (PJ Status 系の学習)
-- ============================================================

CREATE TABLE IF NOT EXISTS tsukuyomi_learnings_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,                              -- 'narrative' | 'xrl' | 'description' | 'pl_hearing' | 'all'
  target_project_id TEXT,                           -- null = 全 PJ 共通、specific = その PJ 専用
  lesson_text TEXT NOT NULL,
  source_feedback_id UUID REFERENCES narrative_feedbacks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (scope IN ('narrative', 'xrl', 'description', 'pl_hearing', 'all'))
);
CREATE INDEX IF NOT EXISTS idx_learnings_scope ON tsukuyomi_learnings_status(scope, target_project_id);

ALTER TABLE tsukuyomi_learnings_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON tsukuyomi_learnings_status;
CREATE POLICY anon_read ON tsukuyomi_learnings_status FOR SELECT USING (true);
DROP POLICY IF EXISTS admin_all ON tsukuyomi_learnings_status;
CREATE POLICY admin_all ON tsukuyomi_learnings_status FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS service_role_bypass ON tsukuyomi_learnings_status;
CREATE POLICY service_role_bypass ON tsukuyomi_learnings_status FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 3. project_venture_members.member_kind & amd_member_id
-- ============================================================

ALTER TABLE project_venture_members
  ADD COLUMN IF NOT EXISTS member_kind TEXT NOT NULL DEFAULT 'su_internal';
DO $$ BEGIN
  ALTER TABLE project_venture_members
    ADD CONSTRAINT project_venture_members_kind_chk
    CHECK (member_kind IN ('amd_internal', 'su_internal', 'support_org'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE project_venture_members
  ADD COLUMN IF NOT EXISTS amd_member_id TEXT REFERENCES members(member_id);

-- ============================================================
-- 4. project_pl_hearings (試算表ヒアリング履歴)
-- ============================================================

CREATE TABLE IF NOT EXISTS project_pl_hearings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  q_a JSONB NOT NULL DEFAULT '[]'::jsonb,           -- [{q, a, asked_at}]
  status TEXT NOT NULL DEFAULT 'in_progress',       -- 'in_progress' | 'done'
  generated_pl JSONB,                               -- 完了時に保存する月次 PL のスナップショット
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pl_hearings_pj ON project_pl_hearings(project_id, status);

ALTER TABLE project_pl_hearings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON project_pl_hearings;
CREATE POLICY anon_read ON project_pl_hearings FOR SELECT USING (true);
DROP POLICY IF EXISTS admin_all ON project_pl_hearings;
CREATE POLICY admin_all ON project_pl_hearings FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS service_role_bypass ON project_pl_hearings;
CREATE POLICY service_role_bypass ON project_pl_hearings FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
