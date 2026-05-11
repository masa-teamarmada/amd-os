-- 049_protocol_examples.sql
--
-- プロトコル設計改修 (まさ要望 2026-05-11):
--
-- ★ 旧設計の問題:
--   - protocols テーブルに「Dグローバル申請見送り → 2027年4月起業方針」のような PJ 固有事例が
--     プロトコルとして直接保存されていた → 普遍性がない、複数事例で重複
--   - 「p03 は 2022-03-01 に事業を終了していない」「p21 の設立日は 2027-04」 のような
--     「事実」が プロトコル として誤抽出されている → これは PJ ナレッジ (project_knowledge)
--
-- ★ 新設計:
--   protocols = 普遍的な意思決定パターン (具体 PJ 名は本文に出さない)
--     title:    「設立タイミングを GAP ファンド系活用で延ばすか、即時で進めるか」
--     content:  ① 分岐点 ② 判断材料 ③ アクション ④ 結果・学習 (普遍的に書く)
--
--   protocol_examples = そのプロトコルが現実に起きた具体事例 (1 protocol : N examples)
--     project_id + occurred_on で「いつ、どの PJ で」を識別
--     summary: 短文 (「2026-05 CX: D グローバル申請見送り、2027/4 設立で決着」)
--     source_meeting_id: 出典 meeting (= 監査可能)
--
-- ★ 期待効果:
--   - 同じ意思決定パターンが複数 PJ で繰り返されたとき、protocols 1 行に
--     examples が積み上がる構造 → プロトコル知財の価値が高まる
--   - 単なる「事実」は PJ ナレッジに正しく誘導され、プロトコルが純化される

CREATE TABLE IF NOT EXISTS protocol_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id TEXT NOT NULL REFERENCES protocols(protocol_id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  occurred_on DATE,                       -- いつ起きたか (= meeting_date or 判断日)
  summary TEXT NOT NULL,                  -- 50-150 字: 「2026-05 CX: D グローバル申請見送り、2027/4 設立で決着」
  branch_point TEXT,                      -- 具体事例での ① 分岐点
  criteria TEXT,                          -- 具体事例での ② 判断材料
  action_taken TEXT,                      -- 具体事例での ③ アクション
  result TEXT,                            -- 具体事例での ④ 結果・学習
  source_meeting_id TEXT,                 -- 出典 project_meeting_summaries.meeting_id
  source_url TEXT,                        -- Notion / Slack / Calendar URL
  llm_model TEXT,                         -- 抽出 LLM
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE protocol_examples ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON protocol_examples;
CREATE POLICY anon_read ON protocol_examples FOR SELECT USING (true);
DROP POLICY IF EXISTS service_role_bypass ON protocol_examples;
CREATE POLICY service_role_bypass ON protocol_examples FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS protocol_examples_protocol_idx
  ON protocol_examples(protocol_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS protocol_examples_project_idx
  ON protocol_examples(project_id, occurred_on DESC);

COMMENT ON TABLE protocol_examples IS
  'プロトコル (= 普遍的意思決定パターン) に紐づく具体事例。1 プロトコル : N 事例。事例ベースの監査と類似判断パターンの参照を可能にする。';

-- protocols テーブルにも is_universal フラグと kind 列を追加 (= 既存の誤抽出を識別)
ALTER TABLE protocols
  ADD COLUMN IF NOT EXISTS is_universal BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'pattern';

COMMENT ON COLUMN protocols.is_universal IS
  '普遍的プロトコルなら TRUE。固有事例 (= 旧設計で誤抽出) は FALSE + kind=''legacy_specific''';
COMMENT ON COLUMN protocols.kind IS
  '''pattern'' = 普遍的意思決定パターン (現役) / ''legacy_specific'' = 旧抽出の PJ 固有事例 (要分離)';
