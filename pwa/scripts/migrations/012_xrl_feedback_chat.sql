-- 012_xrl_feedback_chat.sql
--
-- 1. xrl_feedbacks: XRL 観測ドットへの修正依頼 (まさ → つくよみ)
-- 2. tsukuyomi_chat_logs: 右下マスコットチャットの会話履歴 + admin 表示用

-- ============================================================
-- 1. xrl_feedbacks
-- ============================================================
CREATE TABLE IF NOT EXISTS xrl_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  xrl_log_id UUID REFERENCES project_xrl_log(id) ON DELETE SET NULL,
  axis TEXT,                                  -- 'TRL' | 'BRL' | 'HRL' | null (全体)
  feedback TEXT NOT NULL,                     -- まさの修正文 ("ここはもっと TRL 高いよ、理由は…")
  status TEXT NOT NULL DEFAULT 'open',        -- 'open' | 'applied'
  applied_at TIMESTAMPTZ,
  applied_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_xrl_feedbacks_pj ON xrl_feedbacks(project_id, status);

ALTER TABLE xrl_feedbacks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON xrl_feedbacks;
CREATE POLICY anon_read ON xrl_feedbacks FOR SELECT USING (true);
DROP POLICY IF EXISTS admin_all ON xrl_feedbacks;
CREATE POLICY admin_all ON xrl_feedbacks FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS service_role_bypass ON xrl_feedbacks;
CREATE POLICY service_role_bypass ON xrl_feedbacks FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 2. tsukuyomi_chat_logs (マスコットチャット履歴)
-- ============================================================
CREATE TABLE IF NOT EXISTS tsukuyomi_chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT REFERENCES projects(project_id) ON DELETE SET NULL,  -- 画面が PJ コックピット内なら設定
  session_id UUID NOT NULL,                          -- 同一セッション内の連続会話を束ねる
  page_path TEXT,                                    -- '/project/p11/cockpit' 等
  role TEXT NOT NULL,                                -- 'user' | 'assistant' | 'tool'
  content TEXT NOT NULL,
  applied_actions JSONB,                             -- 修正適用結果 (action ごとのレコード)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (role IN ('user', 'assistant', 'tool'))
);
CREATE INDEX IF NOT EXISTS idx_tckl_pj ON tsukuyomi_chat_logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tckl_session ON tsukuyomi_chat_logs(session_id, created_at);

ALTER TABLE tsukuyomi_chat_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON tsukuyomi_chat_logs;
CREATE POLICY anon_read ON tsukuyomi_chat_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS admin_all ON tsukuyomi_chat_logs;
CREATE POLICY admin_all ON tsukuyomi_chat_logs FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS service_role_bypass ON tsukuyomi_chat_logs;
CREATE POLICY service_role_bypass ON tsukuyomi_chat_logs FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
