-- 171_seed_deep_dive_material.sql
-- シーズごとの深掘り資料を共有ドライブ上の資料へ紐づける。

ALTER TABLE seeds
  ADD COLUMN IF NOT EXISTS deep_dive_material_url TEXT;

COMMENT ON COLUMN seeds.deep_dive_material_url IS
  'AMD内の深掘り資料リンク。共有ドライブ上の資料を指す。';

UPDATE seeds
SET
  deep_dive_material_url = 'https://drive.google.com/file/d/1d_DkzXVeQ2OB4EuM9vWaH9Ez3Co0STrP/view',
  updated_at = NOW()
WHERE title = 'DCD歩行解析・療育現場支援ツール'
  AND org_name = '工学院大学'
  AND researcher_name = '齊藤亜由子先生';
