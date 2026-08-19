-- 300_se_continuity_seat_section_refresh.sql
-- 2026-08-20 SE(p10)資料室「技術と事業を続ける道」に、
-- 新章03「組合が売るのは、製品ではなく『将来の席』」
-- （席の予約権・税制優遇・WiPoTの教訓・売り物の階段4段表）を追加した
-- 9章構成の実体へ同期する。Storageはupsert済み。

BEGIN;

DO $$
DECLARE
  updated_rows integer;
BEGIN
  UPDATE public.workspace_documents
  SET file_size_bytes = 294107,
      content_sha256 = 'c5972d3e43212b4dd3dfe9351ca71eb2c4e154f50a150a8af22b7c6743794af1',
      updated_at = NOW()
  WHERE document_id = 'bd2b4bfa-74df-4514-9542-4112a1b81de4'
    AND project_id = 'p10'
    AND entry_kind = 'file'
    AND storage_bucket = 'workspace-files'
    AND storage_path = 'project/p10/bd2b4bfa-74df-4514-9542-4112a1b81de4'
    AND upload_status = 'active';

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  IF updated_rows <> 1 THEN
    RAISE EXCEPTION 'SE continuity seat section refresh expected 1 row, got %', updated_rows;
  END IF;
END
$$;

COMMIT;
