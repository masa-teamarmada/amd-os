-- 047_tsukuyomi_token_usage.sql
--
-- つくよみの 1 ターン毎の token 使用量を保存する usage log。
--
-- 用途: weekly コスト集計 + Mascot に「今週の累積コスト (円)」表示。
-- 旧仕様: 1 ターン max_tokens=2000 で打ち切り (= まさ要望「制限解除」)。
-- 新仕様: max_tokens を 16,000 まで拡大 + 各ターンの usage を本テーブルに記録。
--
-- 価格 (2026-05 時点、Anthropic 公開価格):
--   Claude Opus 4.7: input $15 / MTok, output $75 / MTok
--   USD→JPY 換算: 150 JPY/USD (= settings で動的にしてもよい)

CREATE TABLE IF NOT EXISTS tsukuyomi_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
  member_id TEXT,
  model TEXT NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  cache_read_tokens INT NOT NULL DEFAULT 0,
  cache_write_tokens INT NOT NULL DEFAULT 0,
  cost_usd NUMERIC NOT NULL DEFAULT 0,
  cost_jpy NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tsukuyomi_usage_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON tsukuyomi_usage_log;
CREATE POLICY anon_read ON tsukuyomi_usage_log FOR SELECT USING (true);
DROP POLICY IF EXISTS service_role_bypass ON tsukuyomi_usage_log;
CREATE POLICY service_role_bypass ON tsukuyomi_usage_log FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS tsukuyomi_usage_log_created_idx
  ON tsukuyomi_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS tsukuyomi_usage_log_session_idx
  ON tsukuyomi_usage_log(session_id, created_at DESC);

COMMENT ON TABLE tsukuyomi_usage_log IS
  'つくよみの 1 ターン毎の Anthropic token usage + コスト。Mascot に weekly 累積 (円) を表示。';
