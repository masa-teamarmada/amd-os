-- 313_workspace_folder_visibility_cascade.sql
--
-- folderをAMD内部へ変えるとき、外部共有中の配下資料をまとめて内部化するための
-- 1トランザクションRPC。PWA routeが409で影響件数を確認し、まさの明示同意を
-- 受け取った場合だけservice_roleが呼ぶ。workspace_sharedへの一括変更は対象外
-- (内部化専用。外部共有化は既存のinternal_parent判定を維持する)。

BEGIN;

CREATE OR REPLACE FUNCTION public.workspace_set_folder_visibility_cascade(
  p_document_id UUID,
  p_visibility TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.workspace_documents%ROWTYPE;
  full_path TEXT;
BEGIN
  IF p_visibility <> 'amd_internal' THEN
    RAISE EXCEPTION 'unsupported visibility cascade target: %', p_visibility;
  END IF;

  SELECT * INTO target
  FROM public.workspace_documents
  WHERE document_id = p_document_id
    AND upload_status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'workspace document not found';
  END IF;

  IF target.entry_kind <> 'folder' THEN
    RAISE EXCEPTION 'visibility cascade target must be a folder';
  END IF;

  full_path := CASE
    WHEN target.folder_path = '' THEN target.display_name
    ELSE target.folder_path || '/' || target.display_name
  END;

  UPDATE public.workspace_documents
  SET visibility = p_visibility
  WHERE document_id = target.document_id;

  UPDATE public.workspace_documents
  SET visibility = p_visibility
  WHERE upload_status = 'active'
    AND scope_kind = target.scope_kind
    AND institution_workspace_id IS NOT DISTINCT FROM target.institution_workspace_id
    AND project_id IS NOT DISTINCT FROM target.project_id
    AND (folder_path = full_path OR folder_path LIKE full_path || '/%');
END;
$$;

REVOKE ALL ON FUNCTION public.workspace_set_folder_visibility_cascade(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_set_folder_visibility_cascade(UUID, TEXT) TO service_role;

COMMIT;
