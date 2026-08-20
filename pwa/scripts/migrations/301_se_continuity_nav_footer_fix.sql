-- 301_se_continuity_nav_footer_fix.sql
-- 2026-08-20 SE(p10)資料室「技術と事業を続ける道」の左ナビ構造修正を反映。
-- 03章追加でナビリンクが9本になり、画面高が低い環境（720px級）では
-- 「文言編集ON」等の操作ボタンがナビ内スクロール領域の下に隠れてクリックできなくなっていた
-- （まさ報告）。ナビをスクロール領域(.nav-scroll)と常時可視のフッター(.nav-footer)に分離し、
-- ボタンが画面高に関わらず常に見える位置に固定されるよう修正した後の実サイズを同期する。

BEGIN;

DO $$
DECLARE
  updated_rows integer;
BEGIN
  UPDATE public.workspace_documents
  SET file_size_bytes = 294514,
      content_sha256 = '28656e17fa44a60dc7b02ae1a7c162936a7127b15ae431fa1d6b5f9a68414b02',
      updated_at = NOW()
  WHERE document_id = 'bd2b4bfa-74df-4514-9542-4112a1b81de4'
    AND project_id = 'p10'
    AND entry_kind = 'file'
    AND storage_bucket = 'workspace-files'
    AND storage_path = 'project/p10/bd2b4bfa-74df-4514-9542-4112a1b81de4'
    AND upload_status = 'active';

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  IF updated_rows <> 1 THEN
    RAISE EXCEPTION 'SE continuity nav footer fix refresh expected 1 row, got %', updated_rows;
  END IF;
END
$$;

COMMIT;
