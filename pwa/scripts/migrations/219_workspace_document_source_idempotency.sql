-- 219_workspace_document_source_idempotency.sql
--
-- 移行元の同一資料を並行実行・再実行しても二重登録しないための一意境界。

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_documents_source_ref
  ON public.workspace_documents (source_kind, source_ref)
  WHERE source_ref IS NOT NULL;

COMMIT;
