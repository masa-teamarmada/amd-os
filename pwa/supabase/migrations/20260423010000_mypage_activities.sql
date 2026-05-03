-- ============================================================
-- マイページ「今月の活動」機能
-- 1. milestone_responsibility に role / task_description 追加
-- 2. member_activities テーブル新設（PWA版・TEXT外部キー）
-- ============================================================

-- 1a. カラム追加（既存レコードは role = '担当' でデフォルト埋め）
ALTER TABLE milestone_responsibility
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT '担当',
  ADD COLUMN IF NOT EXISTS task_description TEXT;

-- 1b. 既存 UNIQUE(milestone_id, member_id) を削除して
--     UNIQUE(milestone_id, member_id, role) に張り直す
--     ※ 既存制約名は initial_schema で自動付与された名前を使う
DO $$
BEGIN
  -- 制約が存在すれば削除
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'milestone_responsibility'::regclass
      AND contype = 'u'
      AND conname LIKE '%milestone_id%member_id%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE milestone_responsibility DROP CONSTRAINT ' || conname
      FROM pg_constraint
      WHERE conrelid = 'milestone_responsibility'::regclass
        AND contype = 'u'
        AND conname NOT LIKE '%milestone_id%member_id%role%'
      LIMIT 1
    );
  END IF;
END $$;

-- 新 UNIQUE 制約追加
ALTER TABLE milestone_responsibility
  DROP CONSTRAINT IF EXISTS milestone_responsibility_milestone_id_member_id_key;

ALTER TABLE milestone_responsibility
  ADD CONSTRAINT milestone_responsibility_ms_member_role_key
  UNIQUE (milestone_id, member_id, role);

-- ============================================================
-- 2. member_activities テーブル
--    GAS が LLM 推論して書き込む or PWA cron が書き込む
--    外部キーは TEXT（PWA 本流のパターンに統一）
-- ============================================================
CREATE TABLE IF NOT EXISTS member_activities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id        TEXT NOT NULL REFERENCES members(member_id),
  project_id       TEXT NOT NULL REFERENCES projects(project_id),
  ym               TEXT NOT NULL,   -- 例: '202604'
  source           TEXT NOT NULL CHECK (source IN ('slack','notion','gmail','gmeet','drive','inferred')),
  source_item_id   TEXT NOT NULL,   -- 一意キー（推論結果なら 'llm-{ym}-{ms_id}' 等）
  milestone_id     TEXT REFERENCES value_milestones(milestone_id),
  title            TEXT,
  content_preview  TEXT,
  item_date        TIMESTAMPTZ,
  raw_metadata     JSONB,
  extracted_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (member_id, project_id, source, source_item_id)
);

CREATE INDEX IF NOT EXISTS idx_member_activities_member_ym
  ON member_activities (member_id, ym);

CREATE INDEX IF NOT EXISTS idx_member_activities_project_ym
  ON member_activities (project_id, ym);

-- RLS: DEV_MODE は anon_read(USING true) で開放
ALTER TABLE member_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read" ON member_activities;
CREATE POLICY "anon_read"
  ON member_activities FOR SELECT
  USING (true);
