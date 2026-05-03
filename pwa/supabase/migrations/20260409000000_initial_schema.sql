-- AMD OS PWA — Initial Database Schema
-- Faithful reproduction of GAS Spreadsheet DB structure in PostgreSQL

-- ============================================================
-- Organization & Members
-- ============================================================
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT UNIQUE NOT NULL,
  code_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  slack_id TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  join_ym TEXT,
  leave_ym TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE member_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_name TEXT NOT NULL,
  category TEXT NOT NULL, -- skills, personality, communication_style, growth_areas, work_style, interests, episodes
  summary TEXT,
  source TEXT DEFAULT 'slack_conversation',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(code_name, category)
);

-- ============================================================
-- Projects
-- ============================================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT UNIQUE NOT NULL,
  project_name TEXT NOT NULL,
  client_name TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active, sales, ended, frozen, lost
  slack_channel_id TEXT,
  drive_folder_id TEXT,
  freee_partner_id TEXT,
  start_ym TEXT,
  end_ym TEXT,
  report_emails TEXT, -- comma-separated
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  member_id TEXT NOT NULL REFERENCES members(member_id),
  role TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  join_ym TEXT,
  leave_ym TEXT,
  UNIQUE(project_id, member_id)
);

CREATE TABLE project_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  key TEXT NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, key)
);

CREATE TABLE project_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  category TEXT NOT NULL, -- people, tech, ip, org, funding, market, competitor, strategy, term
  entity_name TEXT NOT NULL,
  fact_text TEXT,
  confidence TEXT DEFAULT 'medium',
  source TEXT,
  status TEXT DEFAULT 'active',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Value Plan & Milestones
-- ============================================================
CREATE TABLE value_plan_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_cycle_id TEXT UNIQUE NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  status TEXT NOT NULL DEFAULT 'active',
  budget_yen INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  period_start_ym TEXT NOT NULL,
  period_end_ym TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE value_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id TEXT UNIQUE NOT NULL,
  plan_cycle_id TEXT NOT NULL REFERENCES value_plan_cycles(plan_cycle_id),
  title TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  tag TEXT NOT NULL DEFAULT 'normal', -- normal, buffer, routine
  goal_level TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  success_criteria TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE milestone_sub_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_item_id TEXT UNIQUE NOT NULL,
  milestone_id TEXT NOT NULL REFERENCES value_milestones(milestone_id),
  title TEXT NOT NULL,
  weight NUMERIC DEFAULT 1,
  status TEXT DEFAULT 'open',
  assignee TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE milestone_monthly_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_key TEXT NOT NULL,
  ym TEXT NOT NULL, -- TEXT format: "202604"
  progress_pct NUMERIC NOT NULL DEFAULT 0,
  consumed_pt NUMERIC NOT NULL DEFAULT 0,
  source TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(milestone_key, ym)
);

CREATE TABLE milestone_responsibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id TEXT NOT NULL REFERENCES value_milestones(milestone_id),
  member_id TEXT NOT NULL REFERENCES members(member_id),
  share NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(milestone_id, member_id)
);

-- ============================================================
-- Billing & Payments
-- ============================================================
CREATE TABLE billing_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  ym TEXT NOT NULL, -- TEXT format, NEVER numeric
  budget_yen INTEGER,
  status TEXT NOT NULL DEFAULT 'not_started',
  meeting_start_at TIMESTAMPTZ,
  report_fixed_at TIMESTAMPTZ,
  invoice_sent_at TIMESTAMPTZ,
  payment_confirmed_at TIMESTAMPTZ,
  ms_progress_summary_json JSONB,
  member_allocations_json JSONB,
  reward_summary_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, ym)
);

CREATE TABLE billing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  ym TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE monthly_reward_payout (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  ym TEXT NOT NULL,
  member_id TEXT NOT NULL,
  earned_pt NUMERIC DEFAULT 0,
  base_pay NUMERIC DEFAULT 0,
  bonus_pt NUMERIC DEFAULT 0,
  total_pay NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, ym, member_id)
);

CREATE TABLE payout_agreement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  agreed_at TIMESTAMPTZ,
  token TEXT,
  UNIQUE(project_id, member_id)
);

-- ============================================================
-- Reports
-- ============================================================
CREATE TABLE monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id TEXT UNIQUE NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  ym TEXT NOT NULL,
  draft_content TEXT,
  final_content TEXT,
  status TEXT DEFAULT 'pending',
  collection_summary_json JSONB,
  generated_at TIMESTAMPTZ,
  fixed_at TIMESTAMPTZ,
  slide_file_id TEXT,
  pdf_file_id TEXT,
  last_cron_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, ym)
);

CREATE TABLE source_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_id TEXT UNIQUE NOT NULL,
  project_id TEXT NOT NULL,
  ym TEXT NOT NULL,
  source TEXT NOT NULL, -- notion, slack, gmail, drive, calendar, gmeet
  item_id TEXT NOT NULL,
  title TEXT,
  item_date TIMESTAMPTZ,
  content_text TEXT,
  char_count INTEGER DEFAULT 0,
  metadata_json JSONB,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, source, item_id)
);

-- ============================================================
-- Tsukuyomi (AI Assistant)
-- ============================================================
CREATE TABLE tsukuyomi_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id TEXT UNIQUE NOT NULL,
  tags TEXT NOT NULL, -- comma-separated
  priority INTEGER DEFAULT 0,
  system_prompt TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tsukuyomi_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  project_id TEXT,
  member_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tsukuyomi_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id TEXT UNIQUE NOT NULL,
  project_id TEXT,
  content TEXT NOT NULL,
  source TEXT DEFAULT 'slack_conversation',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tsukuyomi_nudge_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nudge_id TEXT UNIQUE,
  project_id TEXT NOT NULL,
  ym TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'ready', -- ready, posted, error
  posted_at TIMESTAMPTZ,
  error_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Navigator (Knowledge System)
-- ============================================================
CREATE TABLE navigator_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id TEXT UNIQUE NOT NULL,
  project_id TEXT NOT NULL,
  block_type TEXT,
  content TEXT,
  tags TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE navigator_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  history_id TEXT UNIQUE NOT NULL,
  item_id TEXT NOT NULL,
  action TEXT NOT NULL,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Tasks & Issues
-- ============================================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT UNIQUE NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo', -- pending, todo, doing, done
  assignee TEXT,
  priority TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id TEXT UNIQUE NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  severity TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Protocols
-- ============================================================
CREATE TABLE protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id TEXT UNIQUE NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL,
  content TEXT,
  status TEXT DEFAULT 'candidate', -- candidate, confirmed, archived
  importance INTEGER DEFAULT 1, -- 1-3
  source TEXT DEFAULT 'manual', -- manual, notion, gmail, slack
  tags TEXT, -- comma-separated
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Settings & Config
-- ============================================================
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE llm_model_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id TEXT UNIQUE NOT NULL,
  model_name TEXT NOT NULL,
  provider TEXT NOT NULL, -- anthropic, openai
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_member ON project_members(member_id);
CREATE INDEX idx_billing_cycles_ym ON billing_cycles(ym);
CREATE INDEX idx_billing_cycles_project_ym ON billing_cycles(project_id, ym);
CREATE INDEX idx_milestone_progress_ym ON milestone_monthly_progress(ym);
CREATE INDEX idx_monthly_reports_project_ym ON monthly_reports(project_id, ym);
CREATE INDEX idx_source_cache_project_ym ON source_cache(project_id, ym);
CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX idx_nudge_queue_project_ym ON tsukuyomi_nudge_queue(project_id, ym);
CREATE INDEX idx_protocols_status ON protocols(status);

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_plan_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_sub_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_monthly_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_responsibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reward_payout ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tsukuyomi_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE tsukuyomi_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE tsukuyomi_nudge_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE navigator_items ENABLE ROW LEVEL SECURITY;

-- Helper function: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE email = auth.jwt() ->> 'email'
    AND is_admin = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get current member_id
CREATE OR REPLACE FUNCTION current_member_id()
RETURNS TEXT AS $$
  SELECT member_id FROM members
  WHERE email = auth.jwt() ->> 'email'
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Admin can see everything
CREATE POLICY "admin_all" ON members FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON projects FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON project_members FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON project_config FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON project_knowledge FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON value_plan_cycles FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON value_milestones FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON milestone_sub_items FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON milestone_monthly_progress FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON milestone_responsibility FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON billing_cycles FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON billing_log FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON monthly_reward_payout FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON monthly_reports FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON source_cache FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON tasks FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON issues FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON protocols FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON settings FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON tsukuyomi_context FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON tsukuyomi_memory FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON tsukuyomi_nudge_queue FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON member_knowledge FOR ALL USING (is_admin());
CREATE POLICY "admin_all" ON navigator_items FOR ALL USING (is_admin());

-- Non-admin: can see own member record
CREATE POLICY "member_self_read" ON members FOR SELECT
  USING (email = auth.jwt() ->> 'email');

-- Non-admin: can see projects they belong to
CREATE POLICY "member_project_read" ON projects FOR SELECT
  USING (
    project_id IN (
      SELECT pm.project_id FROM project_members pm
      WHERE pm.member_id = current_member_id() AND pm.is_active = true
    )
  );

-- Non-admin: project-scoped read access
CREATE POLICY "member_pm_read" ON project_members FOR SELECT
  USING (project_id IN (
    SELECT pm2.project_id FROM project_members pm2
    WHERE pm2.member_id = current_member_id() AND pm2.is_active = true
  ));

CREATE POLICY "member_read" ON billing_cycles FOR SELECT
  USING (project_id IN (
    SELECT pm.project_id FROM project_members pm
    WHERE pm.member_id = current_member_id() AND pm.is_active = true
  ));

CREATE POLICY "member_read" ON value_plan_cycles FOR SELECT
  USING (project_id IN (
    SELECT pm.project_id FROM project_members pm
    WHERE pm.member_id = current_member_id() AND pm.is_active = true
  ));

CREATE POLICY "member_read" ON monthly_reports FOR SELECT
  USING (project_id IN (
    SELECT pm.project_id FROM project_members pm
    WHERE pm.member_id = current_member_id() AND pm.is_active = true
  ));

CREATE POLICY "member_read" ON tasks FOR SELECT
  USING (project_id IN (
    SELECT pm.project_id FROM project_members pm
    WHERE pm.member_id = current_member_id() AND pm.is_active = true
  ));

-- Service role bypass for GAS writes (service_role key)
-- GAS uses SUPABASE_SERVICE_KEY which bypasses RLS automatically

-- ============================================================
-- Updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_billing_cycles_updated_at BEFORE UPDATE ON billing_cycles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_issues_updated_at BEFORE UPDATE ON issues FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_protocols_updated_at BEFORE UPDATE ON protocols FOR EACH ROW EXECUTE FUNCTION update_updated_at();
