-- PJごとの追加Drive生データ抽出root。
-- projects.drive_folder_id は資料保存先・会議資料作成先として互換維持する。
-- 本列は読み取り専用の追加rootだけを持ち、抽出時は両方をIDで重複排除する。
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS drive_source_folder_ids text[] NOT NULL DEFAULT ARRAY[]::text[];

COMMENT ON COLUMN public.projects.drive_source_folder_ids IS
  '追加のGoogle Drive生データ抽出root。drive_folder_idは保存先として別管理し、抽出時は両者を重複排除して読む。';

-- ZMP: 既存のPJ資料保存先を変えず、指定された共有ドライブルートを追加する。
UPDATE public.projects
SET drive_source_folder_ids = ARRAY[
  '0ABeaagyKUh89Uk9PVA'
]::text[]
WHERE project_id = 'p19';
