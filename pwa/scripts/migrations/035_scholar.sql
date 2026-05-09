-- 035_scholar.sql
--
-- AMD Score μ_A (学術) の根拠データ DB。
-- atlas_signals は政府/産業 domain しか持たないため、論文・grant・award を独立に蓄積する。
--
-- Phase 1 (本 migration): Crossref API ingest cron で毎日 5 lane × 20 件 upsert。
-- Phase 2 (次セッション以降): KAKEN / NEDO / SIP / JST 採択リスト追加。

CREATE TABLE IF NOT EXISTS scholar (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  authors         TEXT[],
  journal         TEXT,                              -- 学術誌 / 助成 program / 賞名
  doi             TEXT,                              -- 論文 DOI (UNIQUE)
  published_at    DATE,
  lane            TEXT,                              -- gx_energy / gx_circular / materials / life / robo
  suggested_tags  TEXT[],
  source_type     TEXT NOT NULL DEFAULT 'paper',     -- 'paper' / 'grant' / 'patent' / 'award'
  source_url      TEXT,
  status          TEXT NOT NULL DEFAULT 'auto',      -- 'auto' / 'verified' / 'rejected'
  notes           TEXT,
  metadata        JSONB,                             -- raw API response
  ingested_by     TEXT NOT NULL DEFAULT 'crossref',  -- 'crossref' / 'kaken' / 'manual'
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS scholar_doi_uq
  ON scholar(doi)
  WHERE doi IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scholar_lane_pub
  ON scholar(lane, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_scholar_status
  ON scholar(status);

CREATE INDEX IF NOT EXISTS idx_scholar_source_type
  ON scholar(source_type);

ALTER TABLE scholar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_read ON scholar;
CREATE POLICY anon_read ON scholar FOR SELECT USING (true);

COMMENT ON TABLE scholar IS
  'μ_A (学術) の根拠データ。論文 / grant / patent / award を一元管理し、AmdScoreView の μ_A 行 fallback で引用する。書き込みは cron (service_role) のみ。';
COMMENT ON COLUMN scholar.lane IS
  'project_ventures.lane と整合 (gx_energy / gx_circular / materials / life / robo)。NULL 可 (lane 不確定の論文)。';
COMMENT ON COLUMN scholar.source_type IS
  '''paper'' (Crossref/OpenAlex/Semantic Scholar) / ''grant'' (KAKEN/NEDO/SIP/JST) / ''patent'' / ''award''';
COMMENT ON COLUMN scholar.status IS
  '''auto'' (cron 自動投入) / ''verified'' (まさ確認済) / ''rejected'' (μ_A 根拠として不適切と判断)';
