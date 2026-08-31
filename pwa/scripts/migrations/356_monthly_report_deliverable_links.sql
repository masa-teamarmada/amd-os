-- 月報の「主要成果物」は既存のPJ Drive資料 (`project_documents`) を正本とする。
-- Storageへ複製せず、月次報告書folderへ認可付きリンクとして格納する。

CREATE OR REPLACE FUNCTION public.sync_monthly_report_deliverable_link(p_document_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_row public.project_documents%ROWTYPE;
  source_ym TEXT;
  month_name TEXT;
BEGIN
  SELECT * INTO source_row FROM public.project_documents WHERE document_id = p_document_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF source_row.upload_status <> 'active' THEN
    UPDATE public.workspace_documents
       SET upload_status = 'archived', archived_at = now()
     WHERE source_kind = 'monthly_report_deliverable' AND source_ref = source_row.document_id::TEXT;
    RETURN;
  END IF;

  -- delivered_to_client_at が無い資料は作成月へ置くが、成果日の表示では月中扱いにする。
  source_ym := to_char(COALESCE(source_row.delivered_to_client_at, source_row.created_at), 'YYYYMM');
  month_name := substring(source_ym, 1, 4) || '年' || (substring(source_ym, 5, 2)::INT)::TEXT || '月';
  PERFORM public.ensure_monthly_report_drive_folder(source_row.project_id, source_ym);

  INSERT INTO public.workspace_documents (
    scope_kind, project_id, entry_kind, visibility, folder_path, display_name,
    external_url, mime_type, file_size_bytes, upload_status, source_kind, source_ref
  ) VALUES (
    'project', source_row.project_id, 'link', 'amd_internal', '月次報告書/' || month_name,
    source_row.file_name, source_row.web_view_link, source_row.mime_type,
    source_row.file_size_bytes, 'active', 'monthly_report_deliverable', source_row.document_id::TEXT
  ) ON CONFLICT (source_kind, source_ref) WHERE source_ref IS NOT NULL DO UPDATE
    SET project_id = EXCLUDED.project_id,
        folder_path = EXCLUDED.folder_path,
        display_name = EXCLUDED.display_name,
        external_url = EXCLUDED.external_url,
        mime_type = EXCLUDED.mime_type,
        file_size_bytes = EXCLUDED.file_size_bytes,
        upload_status = 'active',
        archived_at = NULL,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_monthly_report_deliverable_link_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_monthly_report_deliverable_link(NEW.document_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_documents_sync_monthly_report_deliverable ON public.project_documents;
CREATE TRIGGER project_documents_sync_monthly_report_deliverable
AFTER INSERT OR UPDATE OF project_id, web_view_link, file_name, mime_type, file_size_bytes, upload_status, delivered_to_client_at ON public.project_documents
FOR EACH ROW EXECUTE FUNCTION public.sync_monthly_report_deliverable_link_on_change();

SELECT public.sync_monthly_report_deliverable_link(document_id)
FROM public.project_documents;
