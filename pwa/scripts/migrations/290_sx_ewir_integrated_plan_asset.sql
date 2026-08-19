-- 290_sx_ewir_integrated_plan_asset.sql
-- 2026-08-19 SX定例MTGへEWIR / NewCo統合計画を添付し、
-- SX資料室には同じDrive実体へのリンクを登録する。

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.project_meeting_summaries
    WHERE meeting_id = 'upcoming:5gnivrdogk1hreu8ni8lkqbe54_20260819T070000Z'
      AND project_id = 'p21'
  ) THEN
    RAISE EXCEPTION 'SX定例MTG card not found';
  END IF;
END
$$;

INSERT INTO public.meeting_assets (
  asset_id,
  meeting_id,
  project_id,
  storage_bucket,
  storage_path,
  drive_file_id,
  project_drive_folder_id,
  drive_folder_id,
  drive_folder_name,
  drive_folder_web_view_link,
  web_view_link,
  folder_display_path,
  file_name,
  media_type,
  file_size_bytes,
  asset_kind,
  caption,
  source_url,
  sort_order,
  created_by
)
VALUES (
  '0f996fb5-350c-46f8-9acf-2306b675070c',
  'upcoming:5gnivrdogk1hreu8ni8lkqbe54_20260819T070000Z',
  'p21',
  'google-drive',
  '1p6i1UZgnij-aX-69UzE7Dqg-ohvo4LyP',
  '1p6i1UZgnij-aX-69UzE7Dqg-ohvo4LyP',
  '1xI-g2nPE8fAeWa-9MrPlFtV0518EfNry',
  '1LvWxspk7i5fzYbjDEYicm4s460G57oCA',
  '260819_SX定例MTG',
  'https://drive.google.com/drive/folders/1LvWxspk7i5fzYbjDEYicm4s460G57oCA',
  'https://drive.google.com/file/d/1p6i1UZgnij-aX-69UzE7Dqg-ohvo4LyP/view?usp=drivesdk',
  'PJフォルダ / 260819_SX定例MTG',
  '260818_SolvioraX_EWIR_NewCo_integrated_plan.html',
  'text/html',
  1271345,
  'upload',
  'EWIR / NewCo統合計画',
  'https://drive.google.com/file/d/1p6i1UZgnij-aX-69UzE7Dqg-ohvo4LyP/view?usp=drivesdk',
  10,
  'eimi'
)
ON CONFLICT (storage_path) DO UPDATE
SET meeting_id = EXCLUDED.meeting_id,
    project_id = EXCLUDED.project_id,
    storage_bucket = EXCLUDED.storage_bucket,
    drive_file_id = EXCLUDED.drive_file_id,
    project_drive_folder_id = EXCLUDED.project_drive_folder_id,
    drive_folder_id = EXCLUDED.drive_folder_id,
    drive_folder_name = EXCLUDED.drive_folder_name,
    drive_folder_web_view_link = EXCLUDED.drive_folder_web_view_link,
    web_view_link = EXCLUDED.web_view_link,
    folder_display_path = EXCLUDED.folder_display_path,
    file_name = EXCLUDED.file_name,
    media_type = EXCLUDED.media_type,
    file_size_bytes = EXCLUDED.file_size_bytes,
    asset_kind = EXCLUDED.asset_kind,
    caption = EXCLUDED.caption,
    source_url = EXCLUDED.source_url,
    updated_at = NOW();

INSERT INTO public.workspace_documents (
  document_id,
  scope_kind,
  project_id,
  entry_kind,
  visibility,
  folder_path,
  display_name,
  external_url,
  mime_type,
  file_size_bytes,
  upload_status,
  source_kind,
  source_ref
)
VALUES (
  '1c2ae58a-8460-4687-86b7-d085593044cb',
  'project',
  'p21',
  'link',
  'amd_internal',
  'AMD内部/Drive資料',
  'EWIR・NewCo統合計画（2026-08-18版）',
  'https://drive.google.com/file/d/1p6i1UZgnij-aX-69UzE7Dqg-ohvo4LyP/view?usp=drivesdk',
  'text/uri-list',
  0,
  'active',
  'meeting_asset_drive_link',
  'drive_file:1p6i1UZgnij-aX-69UzE7Dqg-ohvo4LyP'
)
ON CONFLICT (document_id) DO UPDATE
SET external_url = EXCLUDED.external_url,
    display_name = EXCLUDED.display_name,
    folder_path = EXCLUDED.folder_path,
    visibility = EXCLUDED.visibility,
    upload_status = 'active',
    archived_at = NULL,
    updated_at = NOW();

COMMIT;
