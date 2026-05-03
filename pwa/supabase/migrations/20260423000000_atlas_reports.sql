-- AMD Atlas Phase 3 — Report Storage
-- 生成済みレポートを保存するテーブル
-- 2026-04-23

CREATE TABLE atlas_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- レポート種別
  type TEXT NOT NULL CHECK (type IN ('daily', 'weekly', 'monthly', 'instant')),
  title TEXT NOT NULL,

  -- 期間
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,

  -- 集計
  signal_count INT DEFAULT 0,
  high_count INT DEFAULT 0,
  medium_count INT DEFAULT 0,
  low_count INT DEFAULT 0,

  -- コンテンツ
  signals_json JSONB DEFAULT '[]',   -- 対象シグナルのスナップショット
  macro_summary TEXT,                -- AI生成のマクロ気流セクション（weekly/monthly）

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- インデックス（種別・日付でよく絞る）
CREATE INDEX idx_atlas_reports_type_created ON atlas_reports(type, created_at DESC);

-- RLS
ALTER TABLE atlas_reports ENABLE ROW LEVEL SECURITY;

-- anon: 読み取り可（アプリ内表示用）
CREATE POLICY "anon read atlas_reports" ON atlas_reports FOR SELECT USING (true);

-- service_role: 書き込み（Vercel cron経由）
CREATE POLICY "service_role all atlas_reports" ON atlas_reports
  FOR ALL TO service_role USING (true) WITH CHECK (true);
