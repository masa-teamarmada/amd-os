-- 296_sx_sier_integrated_plan_rename.sql
-- 既存のSX定例MTG添付と資料室リンクを、同じDrive file IDのまま
-- SIER（瀬戸内産業排水ラウンドテーブル）の名称・実ファイルサイズへ同期する。

BEGIN;

DO $$
DECLARE
  meeting_asset_rows integer;
  workspace_document_rows integer;
BEGIN
  UPDATE public.meeting_assets
  SET file_name = '260819_SolvioraX_SIER_NewCo_integrated_plan.html',
      file_size_bytes = 1275449,
      caption = 'SIER / NewCo統合計画',
      updated_at = NOW()
  WHERE asset_id = '0f996fb5-350c-46f8-9acf-2306b675070c'
    AND meeting_id = 'upcoming:5gnivrdogk1hreu8ni8lkqbe54_20260819T070000Z'
    AND project_id = 'p21'
    AND drive_file_id = '1p6i1UZgnij-aX-69UzE7Dqg-ohvo4LyP';

  GET DIAGNOSTICS meeting_asset_rows = ROW_COUNT;
  IF meeting_asset_rows <> 1 THEN
    RAISE EXCEPTION 'SX SIER meeting asset update expected 1 row, got %', meeting_asset_rows;
  END IF;

  UPDATE public.workspace_documents
  SET display_name = '260819_SolvioraX_SIER_NewCo_integrated_plan.html',
      mime_type = 'text/html',
      file_size_bytes = 1275449,
      updated_at = NOW()
  WHERE document_id = '1c2ae58a-8460-4687-86b7-d085593044cb'
    AND project_id = 'p21'
    AND entry_kind = 'link'
    AND source_ref = 'drive_file:1p6i1UZgnij-aX-69UzE7Dqg-ohvo4LyP';

  GET DIAGNOSTICS workspace_document_rows = ROW_COUNT;
  IF workspace_document_rows <> 1 THEN
    RAISE EXCEPTION 'SX SIER workspace document update expected 1 row, got %', workspace_document_rows;
  END IF;
END
$$;

COMMIT;
