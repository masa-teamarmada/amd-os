-- 297_sx_sier_integrated_plan_content_refresh.sql
-- SIER統合計画HTMLの文言修正と静的矢印追加後の実ファイルサイズを、
-- 既存のMTGカード添付・資料室リンクへ同期する。Drive file IDは維持する。

BEGIN;

DO $$
DECLARE
  meeting_asset_rows integer;
  workspace_document_rows integer;
BEGIN
  UPDATE public.meeting_assets
  SET file_size_bytes = 1281872,
      updated_at = NOW()
  WHERE asset_id = '0f996fb5-350c-46f8-9acf-2306b675070c'
    AND meeting_id = 'upcoming:5gnivrdogk1hreu8ni8lkqbe54_20260819T070000Z'
    AND project_id = 'p21'
    AND drive_file_id = '1p6i1UZgnij-aX-69UzE7Dqg-ohvo4LyP'
    AND file_name = '260819_SolvioraX_SIER_NewCo_integrated_plan.html';

  GET DIAGNOSTICS meeting_asset_rows = ROW_COUNT;
  IF meeting_asset_rows <> 1 THEN
    RAISE EXCEPTION 'SX SIER meeting asset refresh expected 1 row, got %', meeting_asset_rows;
  END IF;

  UPDATE public.workspace_documents
  SET display_name = '260819_SolvioraX_SIER_NewCo_integrated_plan.html',
      file_size_bytes = 1281872,
      updated_at = NOW()
  WHERE document_id = '1c2ae58a-8460-4687-86b7-d085593044cb'
    AND project_id = 'p21'
    AND entry_kind = 'link'
    AND source_ref = 'drive_file:1p6i1UZgnij-aX-69UzE7Dqg-ohvo4LyP';

  GET DIAGNOSTICS workspace_document_rows = ROW_COUNT;
  IF workspace_document_rows <> 1 THEN
    RAISE EXCEPTION 'SX SIER workspace document refresh expected 1 row, got %', workspace_document_rows;
  END IF;
END
$$;

COMMIT;
