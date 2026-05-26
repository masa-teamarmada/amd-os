-- 094: project_graduation_signals
--
-- AMD 主導の卒業フェーズ検出 (= まさ #84 確定 2026-05-26、 マニュアル 4-6 / 39 章)。
-- 各 PJ × 月で 6 シグナルを集計し、 readiness_score を 0-100 で算出。
-- 70% 以上で project_strategy_signals に candidate insert され、 まさえいMTG 議題に上がる。
--
-- 6 シグナル:
--  1. MTG main talker の遷移 (= CEO 候補 vs AMD の発言比率、 LLM 必須 → MVP では 0)
--  2. AMD member events 減少 (= member_activities の月次推移 線形回帰)
--  3. monthly_reports の AMD 寄与文言減少 (= LLM 必須 → MVP では 0)
--  4. CEO 候補の milestone 主導比率 (= milestone_responsibility 集計)
--  5. 経営判断の起点シフト (= protocols の proactive_amd vs ceo_led 比率)
--  6. 「もう大丈夫」キーワード検知 (= project_meeting_summaries 全文 grep)
--
-- 詳細仕様: pwa/manual/39-graduation-detection-spec.md
CREATE TABLE IF NOT EXISTS project_graduation_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  ym TEXT NOT NULL,

  readiness_score NUMERIC NOT NULL,          -- 0-100 総合スコア
  signal_1_talker NUMERIC,                   -- MTG main talker
  signal_2_events NUMERIC,                   -- AMD events 減少
  signal_3_reports NUMERIC,                  -- monthly_reports 寄与
  signal_4_milestones NUMERIC,               -- CEO 候補 milestone 主導
  signal_5_decisions NUMERIC,                -- 経営判断起点シフト
  signal_6_keywords NUMERIC,                 -- キーワード検知

  inputs_json JSONB NOT NULL DEFAULT '{}'::jsonb,    -- 計算根拠 (= 件数 / 比率等)
  evidence_text TEXT,                                 -- 人間が読む自然文 summary
  matched_keywords TEXT[],                            -- signal 6 で検出した語

  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_graduation_signals_ym_unique UNIQUE (project_id, ym)
);

CREATE INDEX IF NOT EXISTS project_graduation_signals_readiness
  ON project_graduation_signals (readiness_score DESC, ym DESC);

CREATE INDEX IF NOT EXISTS project_graduation_signals_ym
  ON project_graduation_signals (ym DESC, readiness_score DESC);

COMMENT ON TABLE project_graduation_signals IS
  'PJ × 月の卒業準備度スナップショット。 monthly cron で upsert、 70% 以上で project_strategy_signals に candidate insert される。 詳細仕様は pwa/manual/39-graduation-detection-spec.md';
