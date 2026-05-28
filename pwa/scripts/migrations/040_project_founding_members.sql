-- 040_project_founding_members.sql
--
-- PJ 創業メンバー (AMD 内外含む全員) を保存するテーブル。
--
-- まさ判断 (2026-05-10): 既存の AMD メンバー (`members` table) とは別に、
-- 各 PJ の創業に関わる人物を全員 (AMD / 大学 PI / VC / 産業パートナー / 政府担当者)
-- LLM が monthly_reports / project_meeting_summaries / project_knowledge / atlas_signals 等から
-- 自動抽出して入れる。これが HRL (人材成熟度) 推定の主要根拠になる。
--
-- 例: SX (p21) の場合
--   - AMD: members.code_name に存在する AMD 伴走メンバー
--   - 愛媛大: 杉浦先生 / 中島先生 / 石原先生
--   - パートナーズファンド (PSI 推進機関): 堀淵さん (ダイキアクシス VP) / 種市さん / 黒田さん
--   - その他技術メンバー
--
-- HRL 推定:
--   メンバー数 + 役割充足度 (CEO/CTO/事業/技術 揃ってるか) + 多様性 (大学/業界/VC/政府)
--   + 経験の多さ → LLM で 0-9 に推定 (Phase 2-D 以降)
--
-- 通知: 追加・変更が起きたら l2_notifications に kind='founding_members' で投入。

CREATE TABLE IF NOT EXISTS project_founding_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      TEXT NOT NULL,                  -- projects.project_id (e.g., 'p21')
  person_name     TEXT NOT NULL,                  -- 通称・氏名 (alias は person_aliases で正規化)
  affiliation     TEXT,                           -- 所属 ('AMD' / '愛媛大学' / 'ダイキアクシスベンチャーパートナーズ' 等)
  role            TEXT,                           -- 'ceo_candidate' / 'co_founder' / 'tech_lead' / 'business_advisor' / 'investor' / 'amd_support' / 'researcher' / 'partner' / 'unknown'
  role_label_jp   TEXT,                           -- 日本語役割ラベル ('CEO 候補' / '技術アドバイザ' 等)
  category        TEXT NOT NULL DEFAULT 'unknown',-- 'amd' / 'university' / 'vc' / 'partner_company' / 'government' / 'individual' / 'unknown'
  responsibility  TEXT,                           -- 担当・責任範囲 (LLM 抽出 free text)
  contribution    TEXT,                           -- どう貢献するか / 過去貢献内容
  notes           TEXT,                           -- 自由備考
  status          TEXT NOT NULL DEFAULT 'active', -- 'active' / 'left' / 'tentative' / 'invalid'
  extracted_by    TEXT NOT NULL DEFAULT 'llm',    -- 'llm' / 'manual' / 'tsukuyomi'
  source_documents JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{type:'monthly_report', id:'...'}, {type:'meeting_summary', id:'...'}]
  first_observed_at DATE,                         -- 初観測日 (= 文脈に最初に登場した日)
  last_observed_at  DATE,                         -- 最終観測日
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, person_name)
);

CREATE INDEX IF NOT EXISTS idx_pfm_project ON project_founding_members(project_id, status);
CREATE INDEX IF NOT EXISTS idx_pfm_category ON project_founding_members(category);
CREATE INDEX IF NOT EXISTS idx_pfm_role ON project_founding_members(role);

ALTER TABLE project_founding_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON project_founding_members;
CREATE POLICY anon_read ON project_founding_members FOR SELECT USING (true);

COMMENT ON TABLE project_founding_members IS
  'PJ 創業に関わるメンバー (AMD 内外含む全員)。LLM 抽出で自動投入、HRL 推定の主要根拠。`members` table とは独立 (= 創業メンバーは AMD 内部メンバーに限らず大学 PI / VC / 産業パートナー等を含む)。';
COMMENT ON COLUMN project_founding_members.role IS
  '''ceo_candidate'' / ''co_founder'' / ''tech_lead'' / ''business_advisor'' / ''investor'' / ''amd_support'' / ''researcher'' / ''partner'' / ''unknown''';
COMMENT ON COLUMN project_founding_members.category IS
  '''amd'' / ''university'' / ''vc'' / ''partner_company'' / ''government'' / ''individual'' / ''unknown''';
COMMENT ON COLUMN project_founding_members.source_documents IS
  '抽出元ドキュメントの ID 配列。例: [{"type":"monthly_report","id":"uuid","ym":"202604"},{"type":"meeting_summary","id":"meeting-id"}]';
