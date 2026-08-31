-- 月次報告書はコックピットの進捗モーダルではなく、PJドライブ内へ集約する。
-- `月次報告書/YYYY年M月` はAMD内部フォルダ。成果物と社内版・提出版の仮想帳票を同じ場所で扱う。

CREATE OR REPLACE FUNCTION public.ensure_monthly_report_drive_folder(p_project_id TEXT, p_ym TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_ym TEXT := replace(coalesce(p_ym, ''), '-', '');
  month_name TEXT;
BEGIN
  IF p_project_id IS NULL OR normalized_ym !~ '^\d{6}$' THEN RETURN; END IF;
  month_name := substring(normalized_ym, 1, 4) || '年' || (substring(normalized_ym, 5, 2)::INT)::TEXT || '月';

  INSERT INTO public.workspace_documents (
    scope_kind, project_id, entry_kind, visibility, folder_path, display_name,
    mime_type, file_size_bytes, upload_status, source_kind
  ) VALUES (
    'project', p_project_id, 'folder', 'amd_internal', '', '月次報告書',
    'application/x-directory', 0, 'active', 'monthly_report_folder'
  ) ON CONFLICT (project_id, folder_path, lower(display_name))
    WHERE project_id IS NOT NULL AND upload_status IN ('pending', 'active') DO NOTHING;

  INSERT INTO public.workspace_documents (
    scope_kind, project_id, entry_kind, visibility, folder_path, display_name,
    mime_type, file_size_bytes, upload_status, source_kind, source_ref
  ) VALUES (
    'project', p_project_id, 'folder', 'amd_internal', '月次報告書', month_name,
    'application/x-directory', 0, 'active', 'monthly_report_folder', p_project_id || ':' || normalized_ym
  ) ON CONFLICT (project_id, folder_path, lower(display_name))
    WHERE project_id IS NOT NULL AND upload_status IN ('pending', 'active') DO NOTHING;
END;
$$;

SELECT public.ensure_monthly_report_drive_folder(project_id, ym)
FROM public.monthly_reports;
SELECT public.ensure_monthly_report_drive_folder(project_id, ym)
FROM public.monthly_reports_external;

CREATE OR REPLACE FUNCTION public.ensure_monthly_report_drive_folder_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_monthly_report_drive_folder(NEW.project_id, NEW.ym);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS monthly_reports_ensure_drive_folder ON public.monthly_reports;
CREATE TRIGGER monthly_reports_ensure_drive_folder
AFTER INSERT OR UPDATE OF project_id, ym ON public.monthly_reports
FOR EACH ROW EXECUTE FUNCTION public.ensure_monthly_report_drive_folder_on_change();

DROP TRIGGER IF EXISTS monthly_reports_external_ensure_drive_folder ON public.monthly_reports_external;
CREATE TRIGGER monthly_reports_external_ensure_drive_folder
AFTER INSERT OR UPDATE OF project_id, ym ON public.monthly_reports_external
FOR EACH ROW EXECUTE FUNCTION public.ensure_monthly_report_drive_folder_on_change();
