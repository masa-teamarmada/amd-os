-- 216_workspace_document_rooms.sql
--
-- 目的:
--   Project Share のPJ別BOXと、研究機関ワークスペースの資料置き場を
--   AMD OS内の共通「資料室」へ統合するためのメタデータ正本とprivate Storageを追加する。
--
-- 不変条件:
--   - 1資料 = 1主所有者。institution_workspace または project のどちらか一方だけに属する。
--   - 機関所属はPJ資料へのアクセスを自動付与しない。アクセス判定はPWAのserver routeで
--     institution_workspace_memberships / project_access_memberships を個別に再検証する。
--   - private Storageの生URLをDB/UIへ保存・返却しない。閲覧時に短期署名URLを発行する。
--   - ECR / SPS は参照も再計算も更新もしない。
--
-- 冪等性:
--   CREATE TABLE/Bucket/INDEXはIF NOT EXISTS、policy/triggerはDROP+CREATE。
--   本番適用後は dump_schema.py で design/db_schema.md を再生成する。

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('workspace-files', 'workspace-files', FALSE, 104857600)
ON CONFLICT (id) DO UPDATE
SET public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit;

CREATE TABLE IF NOT EXISTS public.workspace_documents (
  document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_kind TEXT NOT NULL CHECK (scope_kind IN ('institution', 'project')),
  institution_workspace_id UUID REFERENCES public.institution_workspaces(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES public.projects(project_id) ON DELETE CASCADE,
  entry_kind TEXT NOT NULL CHECK (entry_kind IN ('file', 'link', 'folder')),
  visibility TEXT NOT NULL DEFAULT 'workspace_shared'
    CHECK (visibility IN ('amd_internal', 'workspace_shared')),
  folder_path TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL,
  storage_bucket TEXT,
  storage_path TEXT,
  external_url TEXT,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  file_size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (file_size_bytes >= 0),
  upload_status TEXT NOT NULL DEFAULT 'active'
    CHECK (upload_status IN ('pending', 'active', 'failed', 'archived')),
  source_kind TEXT NOT NULL DEFAULT 'manual_upload',
  source_ref TEXT,
  created_by_account_id UUID REFERENCES public.workspace_user_accounts(id) ON DELETE SET NULL,
  created_by_member_id TEXT REFERENCES public.members(member_id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workspace_documents_exactly_one_owner CHECK (
    (scope_kind = 'institution' AND institution_workspace_id IS NOT NULL AND project_id IS NULL)
    OR
    (scope_kind = 'project' AND project_id IS NOT NULL AND institution_workspace_id IS NULL)
  ),
  CONSTRAINT workspace_documents_safe_folder_path CHECK (
    folder_path = ''
    OR (
      folder_path !~ '(^/|/$|//)'
      AND folder_path !~ '(^|/)\\.{1,2}(/|$)'
      AND position(chr(92) IN folder_path) = 0
    )
  ),
  CONSTRAINT workspace_documents_safe_display_name CHECK (
    length(btrim(display_name)) BETWEEN 1 AND 240
    AND btrim(display_name) NOT IN ('.', '..')
    AND position('/' IN display_name) = 0
    AND position(chr(92) IN display_name) = 0
  ),
  CONSTRAINT workspace_documents_entry_payload CHECK (
    (entry_kind = 'file' AND storage_bucket IS NOT NULL AND storage_path IS NOT NULL AND external_url IS NULL)
    OR
    (entry_kind = 'link' AND storage_bucket IS NULL AND storage_path IS NULL AND external_url ~ '^https?://')
    OR
    (entry_kind = 'folder' AND storage_bucket IS NULL AND storage_path IS NULL AND external_url IS NULL)
  )
);

COMMENT ON TABLE public.workspace_documents IS
  'AMD OS資料室の共通メタデータ。1行は研究機関またはPJのどちらか一方に属し、private Storageの生URLは保持しない。';
COMMENT ON COLUMN public.workspace_documents.visibility IS
  'amd_internal=AMD内部だけ / workspace_shared=明示membershipを持つ機関・PJ関係者にも共有。';
COMMENT ON COLUMN public.workspace_documents.folder_path IS
  '資料室内の表示用相対folder。所有scopeや権限境界をfolder階層で表現しない。';
COMMENT ON COLUMN public.workspace_documents.source_ref IS
  '移行元識別子。token・署名URL・秘密値は保存しない。';

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_documents_storage_object
  ON public.workspace_documents (storage_bucket, storage_path)
  WHERE storage_path IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_documents_project_active_name
  ON public.workspace_documents (project_id, folder_path, lower(display_name))
  WHERE project_id IS NOT NULL AND upload_status IN ('pending', 'active');

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_documents_institution_active_name
  ON public.workspace_documents (institution_workspace_id, folder_path, lower(display_name))
  WHERE institution_workspace_id IS NOT NULL AND upload_status IN ('pending', 'active');

CREATE INDEX IF NOT EXISTS idx_workspace_documents_project_listing
  ON public.workspace_documents (project_id, folder_path, entry_kind, updated_at DESC)
  WHERE upload_status = 'active';

CREATE INDEX IF NOT EXISTS idx_workspace_documents_institution_listing
  ON public.workspace_documents (institution_workspace_id, folder_path, entry_kind, updated_at DESC)
  WHERE upload_status = 'active';

DROP TRIGGER IF EXISTS workspace_documents_touch_updated_at ON public.workspace_documents;
CREATE TRIGGER workspace_documents_touch_updated_at
  BEFORE UPDATE ON public.workspace_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_workspace_access_updated_at();

ALTER TABLE public.workspace_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_documents_admin_all ON public.workspace_documents;
CREATE POLICY workspace_documents_admin_all
  ON public.workspace_documents
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS workspace_documents_service_role_all ON public.workspace_documents;
CREATE POLICY workspace_documents_service_role_all
  ON public.workspace_documents
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_documents TO authenticated, service_role;

-- Storageはservice_role経由またはserver発行の短期signed tokenだけで操作する。
-- authenticated/anonへ恒久的なobject policyは付与しない。

COMMIT;

-- 安全なロールバックは削除ではなく機能停止で行う:
--   UPDATE public.workspace_documents SET upload_status='archived', archived_at=NOW()
--   WHERE upload_status IN ('pending','active');
-- bucket/tableのDROPやobject一括削除は自動ロールバックに含めない。
