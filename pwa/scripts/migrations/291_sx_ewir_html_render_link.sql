-- 291_sx_ewir_html_render_link.sql
-- SX資料室のEWIR / NewCo統合計画を一般URLではなく、
-- AMD OSのHTML rendererで開く資料として認識させる。

BEGIN;

DO $$
DECLARE
  affected_rows integer;
BEGIN
  UPDATE public.workspace_documents
  SET display_name = '260818_SolvioraX_EWIR_NewCo_integrated_plan.html',
      mime_type = 'text/html',
      file_size_bytes = 1271345,
      updated_at = NOW()
  WHERE document_id = '1c2ae58a-8460-4687-86b7-d085593044cb'
    AND project_id = 'p21'
    AND entry_kind = 'link'
    AND source_ref = 'drive_file:1p6i1UZgnij-aX-69UzE7Dqg-ohvo4LyP';

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION 'SX EWIR workspace document update expected 1 row, got %', affected_rows;
  END IF;
END
$$;

COMMIT;
