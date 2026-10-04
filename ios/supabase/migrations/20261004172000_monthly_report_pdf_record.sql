-- Record PDF placement only when the saved report still matches its source.
-- Parameters use the POST RPC body, avoiding long Japanese text in a URL filter.
BEGIN;

CREATE OR REPLACE FUNCTION public.monthly_report_pdf_record(
  p_project_id text,
  p_ym text,
  p_report_kind text,
  p_expected_content text,
  p_pdf_file_id text,
  p_version text DEFAULT 'final'
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF current_user <> 'service_role' AND NOT COALESCE(public.is_admin(), false) THEN
    RAISE EXCEPTION 'admin role is required' USING ERRCODE = '42501';
  END IF;
  IF p_ym !~ '^[0-9]{6}$' OR p_expected_content IS NULL
      OR p_pdf_file_id IS NULL OR p_pdf_file_id !~ '^[A-Za-z0-9_-]+$'
      OR p_report_kind NOT IN ('internal', 'external')
      OR p_version NOT IN ('draft', 'final') THEN
    RAISE EXCEPTION 'invalid report PDF record';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'monthly_report_' || p_report_kind || ':' || p_project_id || ':' || p_ym, 0));
  IF p_report_kind = 'external' THEN
    UPDATE public.monthly_reports_external
       SET pdf_drive_url = 'https://drive.google.com/file/d/' || p_pdf_file_id || '/view'
     WHERE project_id = p_project_id AND ym = left(p_ym, 4) || '-' || right(p_ym, 2)
       AND body_md IS NOT DISTINCT FROM p_expected_content;
  ELSIF p_version = 'draft' THEN
    UPDATE public.monthly_reports SET pdf_file_id = p_pdf_file_id
     WHERE project_id = p_project_id AND ym = p_ym
       AND draft_content IS NOT DISTINCT FROM p_expected_content;
  ELSE
    UPDATE public.monthly_reports SET pdf_file_id = p_pdf_file_id
     WHERE project_id = p_project_id AND ym = p_ym
       AND final_content IS NOT DISTINCT FROM p_expected_content;
  END IF;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.monthly_report_pdf_record(text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.monthly_report_pdf_record(text,text,text,text,text,text) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
