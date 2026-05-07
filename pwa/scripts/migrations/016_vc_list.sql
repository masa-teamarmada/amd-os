-- 016_vc_list.sql
--
-- VC List 機能の正本スキーマ。
-- 設計議論: design_log/2026-05_vc_list.md
--
-- 構成:
--   vcs                      VC 本体 (特性 + AMD相性評価 amd_rating)
--   vc_funds                 ファンド単位 (size / status / dry_powder)
--   vc_investments           出資イベント (自社PJ なら our_project_id 紐付け)
--   vc_contacts              VC 担当者
--   project_vc_relations     PJ × VC × AMD担当 × ステータス
--   vc_news                  VC 関連ニュース (Atlas とは別系統)
--
-- 冪等性: 全て CREATE / ALTER ... IF NOT EXISTS 形式。再適用可。
-- RLS: 全テーブル anon read OK (AMD メンバーしか見ない / role gate なし)。
--      書き込みは service_role 経由 (admin client) を想定。

-- =====================================================================
-- 1. vcs (VC 本体)
-- =====================================================================

CREATE TABLE IF NOT EXISTS vcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,                  -- 表示名 ('Abies Ventures' 等)
  name_en TEXT,                                -- 英名 (重複検出用キーになる)
  slug TEXT UNIQUE,                            -- URL 用 (lower-case, ascii)
  type TEXT,                                   -- 'independent' | 'cvc' | 'gov' | 'corporate' | 'overseas'
  thesis TEXT,                                 -- 投資テーゼ (自由文)
  stage_focus TEXT[],                          -- ['pre_seed','seed','series_a',...]
  ticket_min_jpy BIGINT,                       -- 最小チケットサイズ (円)
  ticket_max_jpy BIGINT,                       -- 最大チケットサイズ (円)
  hq TEXT,                                     -- 拠点 ('東京' / 'San Francisco' 等)
  website TEXT,
  logo_url TEXT,
  notes TEXT,                                  -- 自由メモ
  -- AMD 内部評価
  amd_rating SMALLINT CHECK (amd_rating BETWEEN 1 AND 5),  -- ★1〜5、null 可
  amd_rating_note TEXT,                        -- 評価理由メモ
  amd_rating_updated_by TEXT REFERENCES members(member_id),
  amd_rating_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vcs_amd_rating ON vcs(amd_rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_vcs_type ON vcs(type);

ALTER TABLE vcs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON vcs;
CREATE POLICY anon_read ON vcs FOR SELECT USING (true);

COMMENT ON TABLE vcs IS 'VC マスタ。AMD が把握する VC 1 行 1 社。amd_rating は AMD 視点の相性評価 (1-5)';
COMMENT ON COLUMN vcs.amd_rating IS '★1〜5 で AMD 視点の相性評価。null=未評価';

-- =====================================================================
-- 2. vc_funds (ファンド単位)
-- =====================================================================

CREATE TABLE IF NOT EXISTS vc_funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vc_id UUID NOT NULL REFERENCES vcs(id) ON DELETE CASCADE,
  fund_no INT NOT NULL,                        -- 1, 2, 3 (X 号ファンド)
  name TEXT,                                   -- 正式名 ('Abies II 投資事業有限責任組合' 等)
  size_jpy BIGINT,                             -- ファンドサイズ (円、確定値) — 80億 = 8000000000
  size_jpy_low BIGINT,                         -- 募集中レンジ下限
  size_jpy_high BIGINT,                        -- 募集中レンジ上限
  vintage_year INT,                            -- ヴィンテージ (組成年)
  status TEXT NOT NULL DEFAULT 'unknown',      -- 'raising' | 'first_closed' | 'final_closed' | 'investing' | 'harvesting' | 'closed' | 'unknown'
  first_close_at DATE,
  final_close_at DATE,
  target_close_at DATE,                        -- 募集中の場合の目標クローズ日
  -- ドライパウダー
  dry_powder_jpy_low BIGINT,
  dry_powder_jpy_high BIGINT,
  dry_powder_source TEXT,                      -- 'estimated' | 'heard_from_contact' | 'public_disclosure'
  dry_powder_heard_from UUID,                  -- vc_contacts.id (誰から聞いたか) — FK は循環避けて soft ref
  dry_powder_note TEXT,
  dry_powder_updated_at TIMESTAMPTZ,
  source_url TEXT,                             -- 一次情報源 (PR / リリース URL 等)
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vc_id, fund_no)
);

CREATE INDEX IF NOT EXISTS idx_vc_funds_vc ON vc_funds(vc_id);
CREATE INDEX IF NOT EXISTS idx_vc_funds_status ON vc_funds(status);

ALTER TABLE vc_funds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON vc_funds;
CREATE POLICY anon_read ON vc_funds FOR SELECT USING (true);

COMMENT ON TABLE vc_funds IS 'VC のファンド単位レコード。Abies #1 / #2 のように号ごとに 1 行';
COMMENT ON COLUMN vc_funds.dry_powder_source IS 'estimated=推定 / heard_from_contact=担当から直接聞いた / public_disclosure=公表値';
COMMENT ON COLUMN vc_funds.dry_powder_heard_from IS 'heard_from_contact のとき、誰 (vc_contacts.id) から聞いたかを記録';

-- =====================================================================
-- 3. vc_investments (出資イベント)
-- =====================================================================

CREATE TABLE IF NOT EXISTS vc_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vc_id UUID NOT NULL REFERENCES vcs(id) ON DELETE CASCADE,
  fund_id UUID REFERENCES vc_funds(id) ON DELETE SET NULL,  -- どのファンドから出したか (不明可)
  target_company TEXT NOT NULL,                -- 投資先企業名 (string)
  target_company_en TEXT,
  our_project_id TEXT REFERENCES projects(project_id) ON DELETE SET NULL,  -- 自社 PJ なら紐付け
  amount_jpy BIGINT,                           -- 投資額 (円、ラウンド合計ではなく当該 VC 単独額)
  round TEXT,                                  -- 'pre_seed' | 'seed' | 'series_a' | ... | 'unknown'
  invested_at DATE,
  is_lead BOOLEAN NOT NULL DEFAULT FALSE,
  source_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vc_investments_vc ON vc_investments(vc_id);
CREATE INDEX IF NOT EXISTS idx_vc_investments_fund ON vc_investments(fund_id);
CREATE INDEX IF NOT EXISTS idx_vc_investments_pj ON vc_investments(our_project_id);
CREATE INDEX IF NOT EXISTS idx_vc_investments_target ON vc_investments(target_company);

ALTER TABLE vc_investments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON vc_investments;
CREATE POLICY anon_read ON vc_investments FOR SELECT USING (true);

COMMENT ON TABLE vc_investments IS '出資イベント。target_company は文字列、自社 PJ なら our_project_id を埋める';

-- =====================================================================
-- 4. vc_contacts (VC 担当者)
-- =====================================================================

CREATE TABLE IF NOT EXISTS vc_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vc_id UUID NOT NULL REFERENCES vcs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_en TEXT,
  role TEXT,                                   -- 'GP' | 'Partner' | 'Principal' | 'Associate' | 'Analyst' | ...
  email TEXT,
  phone TEXT,
  linkedin TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vc_contacts_vc ON vc_contacts(vc_id);

ALTER TABLE vc_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON vc_contacts;
CREATE POLICY anon_read ON vc_contacts FOR SELECT USING (true);

COMMENT ON TABLE vc_contacts IS 'VC 担当者。投資家としての関係。GAP ファンド事業化推進機関で参画する場合は project_venture_members を使う';

-- =====================================================================
-- 5. project_vc_relations (PJ × VC × AMD担当 × ステータス)
-- =====================================================================

CREATE TABLE IF NOT EXISTS project_vc_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  vc_id UUID NOT NULL REFERENCES vcs(id) ON DELETE CASCADE,
  vc_contact_id UUID REFERENCES vc_contacts(id) ON DELETE SET NULL,  -- 主担当
  amd_owner_member_id TEXT REFERENCES members(member_id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'not_contacted',
  -- status ∈ 'not_contacted' | 'pitching' | 'evaluating' | 'dd' | 'term_sheet' | 'invested' | 'passed' | 'declined'
  first_contact_at DATE,
  last_touch_at DATE,
  expected_amount_jpy BIGINT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, vc_id)
);

CREATE INDEX IF NOT EXISTS idx_pvr_project ON project_vc_relations(project_id);
CREATE INDEX IF NOT EXISTS idx_pvr_vc ON project_vc_relations(vc_id);
CREATE INDEX IF NOT EXISTS idx_pvr_status ON project_vc_relations(status);
CREATE INDEX IF NOT EXISTS idx_pvr_last_touch ON project_vc_relations(last_touch_at DESC NULLS LAST);

ALTER TABLE project_vc_relations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON project_vc_relations;
CREATE POLICY anon_read ON project_vc_relations FOR SELECT USING (true);

COMMENT ON TABLE project_vc_relations IS 'PJ × VC の検討〜投資ステータス管理。投資成立時は vc_investments.our_project_id にもイベントとして残す';

-- =====================================================================
-- 6. vc_news (VC 関連ニュース、Atlas とは独立系統)
-- =====================================================================

CREATE TABLE IF NOT EXISTS vc_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vc_id UUID NOT NULL REFERENCES vcs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                          -- 'fundraise' | 'investment' | 'personnel' | 'fund_close' | 'thesis_change' | 'press' | 'other'
  title TEXT NOT NULL,
  body TEXT,
  occurred_on DATE,
  source_url TEXT,
  ingested_by TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'tsukuyomi' | 'web_search_cron'
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  related_fund_id UUID REFERENCES vc_funds(id) ON DELETE SET NULL,
  suggested_fund_patch JSONB,                  -- web_search_cron が ファンド更新候補を提案するとき
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vc_id, source_url)                   -- 同 URL 重複投入を防止 (source_url null の場合は unique 制約効かない、許容)
);

CREATE INDEX IF NOT EXISTS idx_vc_news_vc ON vc_news(vc_id);
CREATE INDEX IF NOT EXISTS idx_vc_news_occurred ON vc_news(occurred_on DESC);
CREATE INDEX IF NOT EXISTS idx_vc_news_verified ON vc_news(verified, dismissed);
CREATE INDEX IF NOT EXISTS idx_vc_news_kind ON vc_news(kind);

ALTER TABLE vc_news ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON vc_news;
CREATE POLICY anon_read ON vc_news FOR SELECT USING (true);

COMMENT ON TABLE vc_news IS 'VC 関連ニュース。Atlas (世界マクロ) とは別系統。/api/cron/vc-news-ingest が web_search で取得し、人が verify する';
COMMENT ON COLUMN vc_news.suggested_fund_patch IS 'cron が「このニュースに基づいて vc_funds を更新したらどうか」を提案する JSON。{fund_no, status, size_jpy, ...} 形式';
