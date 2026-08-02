-- 218_workspace_document_migration_evidence.sql
--
-- Project Share / Drive からの非破壊コピー移行を、移行後も内容単位で照合できるようにする。
-- URL・token・元pathnameは保持せず、SHA-256と元更新日時だけを証跡として残す。

BEGIN;

ALTER TABLE public.workspace_documents
  ADD COLUMN IF NOT EXISTS content_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ;

ALTER TABLE public.workspace_documents
  DROP CONSTRAINT IF EXISTS workspace_documents_content_sha256_format;

ALTER TABLE public.workspace_documents
  ADD CONSTRAINT workspace_documents_content_sha256_format CHECK (
    content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$'
  );

COMMENT ON COLUMN public.workspace_documents.content_sha256 IS
  '移行・upload後の内容照合用SHA-256。file以外は原則NULL。';
COMMENT ON COLUMN public.workspace_documents.source_updated_at IS
  '移行元で確認できた最終更新日時。移行元URLやtokenは保持しない。';

COMMIT;
