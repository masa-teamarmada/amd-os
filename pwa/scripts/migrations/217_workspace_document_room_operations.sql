-- 217_workspace_document_room_operations.sql
--
-- folderの改名・移動とarchiveを、子孫資料を含む1トランザクションで行う。
-- PWA routeがmembershipを検証した後、service_roleだけが呼ぶ。

BEGIN;

CREATE OR REPLACE FUNCTION public.workspace_move_document(
  p_document_id UUID,
  p_folder_path TEXT,
  p_display_name TEXT,
  p_visibility TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.workspace_documents%ROWTYPE;
  old_full_path TEXT;
  new_full_path TEXT;
BEGIN
  SELECT * INTO target
  FROM public.workspace_documents
  WHERE document_id = p_document_id
    AND upload_status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'workspace document not found';
  END IF;

  IF target.entry_kind = 'folder' THEN
    old_full_path := CASE
      WHEN target.folder_path = '' THEN target.display_name
      ELSE target.folder_path || '/' || target.display_name
    END;
    new_full_path := CASE
      WHEN p_folder_path = '' THEN p_display_name
      ELSE p_folder_path || '/' || p_display_name
    END;

    IF p_folder_path = old_full_path OR p_folder_path LIKE old_full_path || '/%' THEN
      RAISE EXCEPTION 'folder cannot be moved into itself';
    END IF;

    UPDATE public.workspace_documents
    SET folder_path = new_full_path || substr(folder_path, length(old_full_path) + 1)
    WHERE upload_status = 'active'
      AND scope_kind = target.scope_kind
      AND institution_workspace_id IS NOT DISTINCT FROM target.institution_workspace_id
      AND project_id IS NOT DISTINCT FROM target.project_id
      AND (folder_path = old_full_path OR folder_path LIKE old_full_path || '/%');
  END IF;

  UPDATE public.workspace_documents
  SET folder_path = p_folder_path,
      display_name = p_display_name,
      visibility = p_visibility
  WHERE document_id = p_document_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.workspace_archive_document(p_document_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.workspace_documents%ROWTYPE;
  full_path TEXT;
BEGIN
  SELECT * INTO target
  FROM public.workspace_documents
  WHERE document_id = p_document_id
    AND upload_status IN ('pending', 'active')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'workspace document not found';
  END IF;

  UPDATE public.workspace_documents
  SET upload_status = 'archived', archived_at = NOW()
  WHERE document_id = p_document_id;

  IF target.entry_kind = 'folder' THEN
    full_path := CASE
      WHEN target.folder_path = '' THEN target.display_name
      ELSE target.folder_path || '/' || target.display_name
    END;

    UPDATE public.workspace_documents
    SET upload_status = 'archived', archived_at = NOW()
    WHERE upload_status IN ('pending', 'active')
      AND scope_kind = target.scope_kind
      AND institution_workspace_id IS NOT DISTINCT FROM target.institution_workspace_id
      AND project_id IS NOT DISTINCT FROM target.project_id
      AND (folder_path = full_path OR folder_path LIKE full_path || '/%');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.workspace_move_document(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.workspace_archive_document(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_move_document(UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.workspace_archive_document(UUID) TO service_role;

COMMIT;
