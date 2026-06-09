-- 134_meeting_assets_drive_folder.sql
-- MTGカード添付をGoogle DriveのPJフォルダ配下 `YYMMDD_会議名` に保存する。
-- 既存のprivate Storage添付はそのまま閲覧できるよう、Drive metadata列だけを非破壊追加する。

ALTER TABLE public.meeting_assets
  ADD COLUMN IF NOT EXISTS drive_file_id text,
  ADD COLUMN IF NOT EXISTS project_drive_folder_id text,
  ADD COLUMN IF NOT EXISTS drive_folder_id text,
  ADD COLUMN IF NOT EXISTS drive_folder_name text,
  ADD COLUMN IF NOT EXISTS drive_folder_web_view_link text,
  ADD COLUMN IF NOT EXISTS web_view_link text,
  ADD COLUMN IF NOT EXISTS folder_display_path text;

COMMENT ON TABLE public.meeting_assets IS
  'MTGサマリに紐づくスクショ/資料/画面キャプチャ。新規アップロード実体はGoogle DriveのPJフォルダ配下MTGフォルダ、旧添付はprivate Supabase Storage meeting-assets bucketに残る。';
COMMENT ON COLUMN public.meeting_assets.storage_bucket IS
  'legacy Storage添付は meeting-assets。Drive-backed添付は google-drive を入れる。';
COMMENT ON COLUMN public.meeting_assets.storage_path IS
  'legacy Storage path、またはDrive-backed添付の drive_file_id mirror。既存UNIQUE制約互換用。';
COMMENT ON COLUMN public.meeting_assets.drive_file_id IS
  'Google Drive file id。実ファイル本体はDBではなくDriveに保存する。';
COMMENT ON COLUMN public.meeting_assets.project_drive_folder_id IS
  'projects.drive_folder_id。共有Drive上の当該PJ folder。';
COMMENT ON COLUMN public.meeting_assets.drive_folder_id IS
  '当該PJ folder 配下に作成/再利用したMTG専用 folder。';
COMMENT ON COLUMN public.meeting_assets.drive_folder_name IS
  'Drive上のMTG専用 folder name。形式は YYMMDD_会議名。';
COMMENT ON COLUMN public.meeting_assets.drive_folder_web_view_link IS
  'Drive MTG folder の閲覧リンク。OS UIでは保存先を開くリンクとしてのみ使う。';
COMMENT ON COLUMN public.meeting_assets.web_view_link IS
  'Drive file の閲覧リンク。OS UIではファイルを開くリンクとしてのみ使う。';
COMMENT ON COLUMN public.meeting_assets.folder_display_path IS
  'UI表示用の保存先ラベル。例: PJフォルダ / 260611_KUTE kickoff。';

CREATE INDEX IF NOT EXISTS idx_meeting_assets_drive_file
  ON public.meeting_assets(drive_file_id)
  WHERE drive_file_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_assets_drive_folder
  ON public.meeting_assets(project_id, drive_folder_id, created_at DESC)
  WHERE drive_folder_id IS NOT NULL;
