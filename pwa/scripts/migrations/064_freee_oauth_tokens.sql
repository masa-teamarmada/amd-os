-- 064: freee OAuth token rotation store
--
-- freee は refresh 時に refresh_token をローテするため、Vercel env 固定だけだと
-- production cron の次回実行で stale token になりうる。service_role 限定で最新 token を保存する。

CREATE TABLE IF NOT EXISTS freee_oauth_tokens (
  token_key TEXT PRIMARY KEY DEFAULT 'default',
  refresh_token TEXT NOT NULL,
  company_id TEXT,
  scope TEXT,
  external_cid TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE freee_oauth_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS freee_oauth_tokens_service_role_all ON freee_oauth_tokens;
CREATE POLICY freee_oauth_tokens_service_role_all
  ON freee_oauth_tokens
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON freee_oauth_tokens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON freee_oauth_tokens TO service_role;

COMMENT ON TABLE freee_oauth_tokens IS
  'freee refresh_token rotation store. service_role only; never expose to browser clients.';
