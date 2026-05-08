-- 024: project_meeting_summaries
--
-- 各 PJ × 各 MTG (Notion 議事録ページ単位) のサマリを保管する正本テーブル。
-- 仕様: pwa/design/meeting_summaries.md
--
-- 流入元: GAS daily cron 03:00 JST が Notion 議事録 1 ページごとに Gemini Flash で
--         summary_short + decided/progress/next_actions/risks を抽出して upsert。
--         source_hash (Notion 本文 sha256) で差分検知し、変わってない議事録はスキップ。
-- 流出先: PWA CockpitMeetingSummary が直読み。R313 monthly_reports cron も
--         このテーブルを集約して draft_content / final_content を組み立てる。

CREATE TABLE IF NOT EXISTS project_meeting_summaries (
  meeting_id          TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL,
  ym                  TEXT NOT NULL,
  meeting_date        DATE NOT NULL,
  meeting_start_at    TIMESTAMPTZ,
  title               TEXT NOT NULL,
  notion_url          TEXT,
  calendar_event_id   TEXT,

  summary_short       TEXT NOT NULL DEFAULT '',
  decided             JSONB NOT NULL DEFAULT '[]'::jsonb,
  progress            JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_actions        JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks               JSONB NOT NULL DEFAULT '[]'::jsonb,

  source_hash         TEXT,
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by_model  TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pms_project_date
  ON project_meeting_summaries(project_id, meeting_date DESC);

CREATE INDEX IF NOT EXISTS idx_pms_project_ym
  ON project_meeting_summaries(project_id, ym);

CREATE OR REPLACE FUNCTION trg_pms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pms_updated_at ON project_meeting_summaries;
CREATE TRIGGER pms_updated_at
  BEFORE UPDATE ON project_meeting_summaries
  FOR EACH ROW EXECUTE FUNCTION trg_pms_updated_at();

ALTER TABLE project_meeting_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pms_read_authenticated ON project_meeting_summaries;
CREATE POLICY pms_read_authenticated
  ON project_meeting_summaries
  FOR SELECT
  TO authenticated
  USING (true);
