-- 024_seeds_overhaul.sql
--
-- 旧 seeds (Venture Map 予兆 4 件用、006_venture_map.sql で作られた最小スキーマ) を破棄し、
-- AMD の Before 0 起点となる本格的な研究シーズマスタとして再構築する。
--
-- 設計議論: pwa/design/seeds.md
--
-- 構成:
--   seeds                 シーズ本体 (機関 + 研究者 + シーズ情報を 1 行に統合)
--   seed_funding          補助金履歴 (NEDO/AMED/JST など)
--   seed_news             関連ニュース・論文・プレス (Atlas とは別系統)
--   seed_contact_log      AMD メンバー × シーズ の接触履歴
--
-- ステータス遷移: candidate → investigating → contacted → discussing → spun_off / declined
--
-- 冪等性: DROP TABLE IF EXISTS ... CASCADE で旧スキーマ破棄、CREATE TABLE は IF NOT EXISTS。
-- RLS: anon read 全開 + authenticated 全権 + service_role bypass (016/017 vc_list と同じパターン)。

-- =====================================================================
-- 0. 旧 seeds 廃棄 (Venture Map 予兆プロット用の 4 行は捨てる)
-- =====================================================================

DROP TABLE IF EXISTS seeds CASCADE;

-- =====================================================================
-- 1. seeds (シーズ本体 — 機関・研究者・シーズ情報を 1 行に統合)
-- =====================================================================

CREATE TABLE IF NOT EXISTS seeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 識別
  title TEXT NOT NULL,                         -- シーズ名 (技術 × 応用先) "シアノバクテリア排水処理" 等
  summary TEXT,                                -- 1〜3 文の概要

  -- 機関 (文字列で保持。表記ゆれ正規化は将来課題)
  org_name TEXT NOT NULL,                      -- "愛媛大学", "NIMS", "産総研"
  org_type TEXT,                               -- 'university' | 'national_lab' | 'kosen' | 'private_lab' | 'other'
  org_region TEXT,                             -- 都道府県 or 地域
  org_url TEXT,

  -- 研究者
  researcher_name TEXT,                        -- "杉浦美羽"
  researcher_title TEXT,                       -- "教授" / "主任研究員"
  lab_name TEXT,
  researcher_url TEXT,                         -- researchmap など

  -- 分類
  domain_lane TEXT,                            -- 'gx_energy' | 'gx_circular' | 'life' | 'materials' | 'robo' | 'ict' | 'other'
  industry_target TEXT[],                      -- 応用先業界
  keywords TEXT[],                             -- 検索用タグ

  -- 成熟度 (TRL/BRL/HRL は 1-9)
  trl SMALLINT CHECK (trl BETWEEN 0 AND 9),
  brl SMALLINT CHECK (brl BETWEEN 0 AND 9),
  hrl SMALLINT CHECK (hrl BETWEEN 0 AND 9),

  -- AMD 視点 (この列群がコア)
  status TEXT NOT NULL DEFAULT 'candidate',
  -- candidate(候補) → investigating(調査中) → contacted(接触済) → discussing(協議中) → spun_off(PJ化) / declined(見送り)
  amd_rating SMALLINT CHECK (amd_rating BETWEEN 1 AND 5),
  amd_rating_note TEXT,
  amd_owner_member_id TEXT REFERENCES members(member_id) ON DELETE SET NULL,
  next_action TEXT,                            -- 次の一手
  internal_notes TEXT,                         -- 社内メモ (非公開前提)
  public_summary TEXT,                         -- 将来 URA/EIR 公開用要約
  is_public BOOLEAN NOT NULL DEFAULT FALSE,    -- Phase 2/3 で URA に開放するときの公開フラグ

  -- 関連
  spun_off_project_id TEXT REFERENCES projects(project_id) ON DELETE SET NULL,
  source TEXT,                                 -- 'introduction' | 'web_search' | 'conference' | 'referral' | 'cold' | 'grant_db' | 'researchmap' | 'other'
  source_detail TEXT,                          -- 経路詳細 ("田中先生からの紹介" 等)

  -- 監査
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT REFERENCES members(member_id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES members(member_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_seeds_status ON seeds(status);
CREATE INDEX IF NOT EXISTS idx_seeds_domain_lane ON seeds(domain_lane);
CREATE INDEX IF NOT EXISTS idx_seeds_org_name ON seeds(org_name);
CREATE INDEX IF NOT EXISTS idx_seeds_amd_rating ON seeds(amd_rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_seeds_amd_owner ON seeds(amd_owner_member_id);
CREATE INDEX IF NOT EXISTS idx_seeds_spun_off ON seeds(spun_off_project_id);
CREATE INDEX IF NOT EXISTS idx_seeds_updated_at ON seeds(updated_at DESC);

ALTER TABLE seeds ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE seeds IS '研究シーズマスタ。AMD の Before 0 起点となる外部技術シーズ。VC List の研究機関版';
COMMENT ON COLUMN seeds.status IS 'candidate=候補 / investigating=調査中 / contacted=接触済 / discussing=協議中 / spun_off=PJ化 / declined=見送り';
COMMENT ON COLUMN seeds.amd_rating IS '★1-5 で AMD 視点の事業化適性評価。null=未評価';
COMMENT ON COLUMN seeds.is_public IS 'Phase 2/3 で URA/EIR に開放する場合のフラグ。Phase 1 は false 固定運用';

-- =====================================================================
-- 2. seed_funding (補助金履歴)
-- =====================================================================

CREATE TABLE IF NOT EXISTS seed_funding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_id UUID NOT NULL REFERENCES seeds(id) ON DELETE CASCADE,
  program TEXT NOT NULL,                       -- "NEDO 課題解決型ハイテクスタートアップ", "AMED 橋渡し研究プログラム", "JST GAP", "JST A-STEP", etc
  program_short TEXT,                          -- "NEDO", "AMED", "JST GAP" のような略号
  amount_jpy BIGINT,                           -- 採択金額 (円)
  fiscal_year INT,                             -- 採択年度
  status TEXT,                                 -- 'awarded' | 'ongoing' | 'completed' | 'rejected' | 'pending'
  source_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seed_funding_seed ON seed_funding(seed_id);
CREATE INDEX IF NOT EXISTS idx_seed_funding_year ON seed_funding(fiscal_year DESC);

ALTER TABLE seed_funding ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE seed_funding IS 'シーズに紐づく補助金・助成金の採択履歴。Phase 2 で NEDO/AMED/JST GAP 等の cron ingest 投入先';

-- =====================================================================
-- 3. seed_news (関連ニュース・論文・プレス)
-- =====================================================================

CREATE TABLE IF NOT EXISTS seed_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_id UUID NOT NULL REFERENCES seeds(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                          -- 'publication' | 'press' | 'grant' | 'patent' | 'event' | 'other'
  title TEXT NOT NULL,
  body TEXT,
  occurred_on DATE,
  source_url TEXT,
  ingested_by TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'tsukuyomi' | 'web_search_cron'
  verified BOOLEAN NOT NULL DEFAULT TRUE,      -- 手入力デフォルト true。cron 投入時は false
  dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (seed_id, source_url)
);

CREATE INDEX IF NOT EXISTS idx_seed_news_seed ON seed_news(seed_id);
CREATE INDEX IF NOT EXISTS idx_seed_news_occurred ON seed_news(occurred_on DESC);
CREATE INDEX IF NOT EXISTS idx_seed_news_verified ON seed_news(verified, dismissed);

ALTER TABLE seed_news ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE seed_news IS 'シーズに紐づくニュース・論文・プレスリリース。Atlas (世界マクロ) とは別系統';

-- =====================================================================
-- 4. seed_contact_log (AMD メンバー × シーズ の接触履歴)
-- =====================================================================

CREATE TABLE IF NOT EXISTS seed_contact_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_id UUID NOT NULL REFERENCES seeds(id) ON DELETE CASCADE,
  contacted_on DATE NOT NULL,
  method TEXT,                                 -- 'email' | 'phone' | 'meeting' | 'event' | 'referral' | 'visit' | 'other'
  amd_member_id TEXT REFERENCES members(member_id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  next_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seed_contact_log_seed ON seed_contact_log(seed_id);
CREATE INDEX IF NOT EXISTS idx_seed_contact_log_date ON seed_contact_log(contacted_on DESC);
CREATE INDEX IF NOT EXISTS idx_seed_contact_log_member ON seed_contact_log(amd_member_id);

ALTER TABLE seed_contact_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE seed_contact_log IS 'AMD メンバーがシーズに接触した履歴。誰がいつ何の方法で接触したか';

-- =====================================================================
-- 5. RLS write policies (017_vc_rls_writes.sql と同じパターン)
--    AMD メンバーは全員フルアクセス + cron route が service_role で書き込める
-- =====================================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'seeds',
    'seed_funding',
    'seed_news',
    'seed_contact_log'
  ]) LOOP
    -- anon read
    EXECUTE format('DROP POLICY IF EXISTS anon_read ON public.%I', t);
    EXECUTE format('CREATE POLICY anon_read ON public.%I FOR SELECT USING (true)', t);
    -- authenticated all
    EXECUTE format('DROP POLICY IF EXISTS authenticated_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY authenticated_all ON public.%I FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)',
      t
    );
    -- service_role bypass
    EXECUTE format('DROP POLICY IF EXISTS service_role_bypass ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY service_role_bypass ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
      t
    );
  END LOOP;
END $$;
