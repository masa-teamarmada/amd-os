-- 299_se_continuity_document_refresh.sql
-- 2026-08-19 SE(p10)資料室の「技術と事業を続ける道」HTMLを、
-- スライド形式からドキュメント形式へ全面改稿した実体へ同期する。
-- 併せて、資料室のHTMLプレビューはCSP sandboxでJavaScriptを実行しないため、
-- ロゴをJS注入からHTML直書き(data URI)へ変更した後の実サイズ・ハッシュを反映する。
-- Storage実体は workspace-files/project/p10/bd2b4bfa-... へ upsert 済み。

BEGIN;

DO $$
DECLARE
  updated_rows integer;
BEGIN
  UPDATE public.workspace_documents
  SET display_name = 'SE_継続戦略_20260820.html',
      mime_type = 'text/html',
      file_size_bytes = 289240,
      content_sha256 = '3cb3c93fbce7ad35a7bdf28e776f2e41b005773466b5e414fd0ab536c3c02a18',
      upload_status = 'active',
      archived_at = NULL,
      updated_at = NOW()
  WHERE document_id = 'bd2b4bfa-74df-4514-9542-4112a1b81de4'
    AND project_id = 'p10'
    AND entry_kind = 'file'
    AND storage_bucket = 'workspace-files'
    AND storage_path = 'project/p10/bd2b4bfa-74df-4514-9542-4112a1b81de4';

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  IF updated_rows <> 1 THEN
    RAISE EXCEPTION 'SE continuity workspace document refresh expected 1 row, got %', updated_rows;
  END IF;
END
$$;

COMMIT;
