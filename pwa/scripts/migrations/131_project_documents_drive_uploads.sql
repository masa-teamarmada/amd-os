-- 131_project_documents_drive_uploads.sql
-- PJ cockpit の資料置き場。実ファイルは Google Drive の PJ folder 配下
-- `AMD OS 資料` folder に保存し、OS には Drive metadata とリンクだけを残す。

CREATE TABLE IF NOT EXISTS public.project_documents (
  document_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  drive_file_id text NOT NULL UNIQUE,
  project_drive_folder_id text NOT NULL,
  drive_folder_id text NOT NULL,
  web_view_link text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  file_size_bytes bigint NOT NULL DEFAULT 0,
  upload_status text NOT NULL DEFAULT 'active'
    CHECK (upload_status IN ('active', 'archived')),
  source_kind text NOT NULL DEFAULT 'manual_upload',
  uploaded_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.project_documents IS
  'PJ cockpit の資料置き場。Google Drive file ID / link / metadata のみ保存し、実ファイル本体は Drive に置く。';
COMMENT ON COLUMN public.project_documents.project_drive_folder_id IS
  'projects.drive_folder_id。共有Drive上の当該PJ folder。';
COMMENT ON COLUMN public.project_documents.drive_folder_id IS
  '当該PJ folder 配下に作成した資料専用 folder (default name: AMD OS 資料)。';
COMMENT ON COLUMN public.project_documents.web_view_link IS
  'Drive file の閲覧リンク。OS ではこのリンクへ遷移する。';

CREATE INDEX IF NOT EXISTS idx_project_documents_project_created
  ON public.project_documents(project_id, created_at DESC);

DROP TRIGGER IF EXISTS project_documents_updated_at ON public.project_documents;
CREATE TRIGGER project_documents_updated_at
  BEFORE UPDATE ON public.project_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_documents_admin_select ON public.project_documents;
CREATE POLICY project_documents_admin_select
  ON public.project_documents
  FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS project_documents_admin_insert ON public.project_documents;
CREATE POLICY project_documents_admin_insert
  ON public.project_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS project_documents_admin_update ON public.project_documents;
CREATE POLICY project_documents_admin_update
  ON public.project_documents
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS project_documents_admin_delete ON public.project_documents;
CREATE POLICY project_documents_admin_delete
  ON public.project_documents
  FOR DELETE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS project_documents_service_role_all ON public.project_documents;
CREATE POLICY project_documents_service_role_all
  ON public.project_documents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
