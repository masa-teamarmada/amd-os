-- 048_llm_prompts.sql
--
-- LLM プロンプト本文を DB で管理する。AGENTS.common.md の絶対ルール:
-- 「プロンプトはコード内にハードコードしない、admin UI で編集可能であること」を実装。
--
-- 用途:
-- - tsukuyomi chat の system prompt / persona / tool descriptions
-- - monthly_report 生成 LLM の prompt
-- - protocol 抽出 LLM の prompt
-- - lane 推定 / atlas-collect 等の LLM prompt
--
-- 各レコードは prompt_key (= 機能識別子) でユニーク。バージョン履歴は updated_at で管理。
-- 旧版を保ちたい場合は別レコード化 (prompt_key に suffix) する。

CREATE TABLE IF NOT EXISTS llm_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key TEXT UNIQUE NOT NULL,             -- 'tsukuyomi.system' / 'monthly_report.generate' 等
  description TEXT,                            -- まさ向け説明 (この prompt が何を制御するか)
  body TEXT NOT NULL,                          -- プロンプト本文 (長文 OK)
  model TEXT,                                  -- 想定モデル ID (e.g. 'claude-opus-4-7')
  max_tokens INT,                              -- 想定 max_tokens (null=コード側で指定)
  is_active BOOLEAN NOT NULL DEFAULT TRUE,     -- TRUE のみ chat/cron が利用
  notes TEXT,                                  -- まさのメモ (運用上の注意点等)
  updated_by TEXT,                             -- 最後に編集した email
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE llm_prompts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON llm_prompts;
CREATE POLICY anon_read ON llm_prompts FOR SELECT USING (true);
DROP POLICY IF EXISTS service_role_bypass ON llm_prompts;
CREATE POLICY service_role_bypass ON llm_prompts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS llm_prompts_key_idx ON llm_prompts(prompt_key);

COMMENT ON TABLE llm_prompts IS
  'LLM プロンプト本文を DB で管理。AGENTS.common.md の絶対ルール = プロンプトはコードにハードコードせず admin UI で編集可能にする。';

-- 初期値: つくよみ system prompt を seed (まずは空、コード側にあるテキストを admin が DB に登録する)
INSERT INTO llm_prompts (prompt_key, description, body, model, max_tokens, is_active, notes)
VALUES (
  'tsukuyomi.system',
  'つくよみマスコットチャットの system prompt 本文。persona + tool 使用方針を含む',
  '',
  'claude-opus-4-7',
  16000,
  FALSE,
  '初期は空。admin/tsukuyomi で本文を入力し is_active=TRUE にすると DB の prompt が優先される (空のときはコード側の fallback を使う)'
) ON CONFLICT (prompt_key) DO NOTHING;

INSERT INTO llm_prompts (prompt_key, description, body, model, max_tokens, is_active, notes)
VALUES (
  'monthly_report.r313_extract',
  '月次レポート生成 R313 (AMD-Report GAS) の Slack/Drive/Calendar/Notion/Gmail 統合プロンプト',
  '',
  'claude-sonnet-4-6',
  8192,
  FALSE,
  'AMD-Report GAS 側で参照される予定。bot メッセージ (つくよみ等) を必ず除外する指示を含めること'
) ON CONFLICT (prompt_key) DO NOTHING;

INSERT INTO llm_prompts (prompt_key, description, body, model, max_tokens, is_active, notes)
VALUES (
  'protocol.extract',
  'AMD プロトコル抽出 (gas/155 nav_protocol_extractOneForYm_) の Gemini プロンプト',
  '',
  'gemini-2.0-flash',
  4000,
  FALSE,
  '4 要素 (分岐点 / 判断材料 / アクション / 結果・学習) を必ず markdown 200-400 字で出力させる'
) ON CONFLICT (prompt_key) DO NOTHING;
