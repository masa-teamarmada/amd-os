-- Atlas 政府方針シグナル対応
-- atlas_signals に metadata jsonb 列を追加
-- source_type に 'policy' を許可（CHECK 制約があれば張り替え）

-- 既存 CHECK 制約があれば DROP（名前不明なので動的に）
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'atlas_signals'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%source_type%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE atlas_signals DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

-- 新しい CHECK 制約（policy を含む）
ALTER TABLE atlas_signals
  ADD CONSTRAINT atlas_signals_source_type_check
  CHECK (source_type IS NULL OR source_type IN ('news','report','data','manual','policy'));

-- メタデータ列（省庁名・文書種別・発表日・PDFリンクなど構造化情報）
ALTER TABLE atlas_signals
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- 重複検出と検索用インデックス
CREATE INDEX IF NOT EXISTS idx_atlas_signals_source_url
  ON atlas_signals(source_url);

CREATE INDEX IF NOT EXISTS idx_atlas_signals_source_type
  ON atlas_signals(source_type);

CREATE INDEX IF NOT EXISTS idx_atlas_signals_metadata_ministry
  ON atlas_signals((metadata->>'ministry'));

CREATE INDEX IF NOT EXISTS idx_atlas_signals_metadata_announced_at
  ON atlas_signals((metadata->>'announced_at'));
