-- ============================================================
-- マイページ改善: monthly_reports に section_members 追加
--                + member_activities テーブル新設
-- ============================================================

-- 1. monthly_reports に section_members カラム追加
ALTER TABLE monthly_reports
  ADD COLUMN IF NOT EXISTS section_members TEXT;

-- 2. member_activities テーブル新設
-- 各メンバーが各PJで今月やったこと（L2 cron で生データから抽出）
CREATE TABLE IF NOT EXISTS member_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID NOT NULL REFERENCES members(id),
  project_id      UUID NOT NULL REFERENCES projects(id),
  ym              TEXT NOT NULL,
  source          TEXT NOT NULL CHECK (source IN ('slack', 'notion', 'gmail', 'gmeet', 'drive')),
  source_item_id  TEXT NOT NULL,
  title           TEXT,
  content_preview TEXT,
  item_date       TIMESTAMPTZ,
  raw_metadata    JSONB,
  extracted_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (member_id, project_id, source, source_item_id)
);

-- インデックス（マイページクエリ: member_id × ym で高速検索）
CREATE INDEX IF NOT EXISTS idx_member_activities_member_ym
  ON member_activities (member_id, ym);

CREATE INDEX IF NOT EXISTS idx_member_activities_project_ym
  ON member_activities (project_id, ym);

-- RLS（自分のデータのみ読み取り可能）
ALTER TABLE member_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_activities_select"
  ON member_activities FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM members WHERE email = auth.jwt()->>'email'
    )
    OR
    (auth.jwt()->>'email') IN ('masa@team-armada.jp', 'kyoko@team-armada.jp')
  );

-- service_role は RLS をバイパスするため INSERT/UPDATE は制限なし
