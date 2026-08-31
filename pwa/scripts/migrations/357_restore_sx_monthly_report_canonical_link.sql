-- SX 2026-08「本書」を汎用Markdown表示ではなく既存の提出版帳票へ戻す。
-- 既存ID・名称・保管folder・可視性・本文・帳票CSSは変更しない。
-- 対象1件だけ。想定外の現物は上書きせず停止する。
BEGIN;
DO $$
DECLARE target public.workspace_documents%ROWTYPE;
BEGIN
  SELECT * INTO STRICT target FROM public.workspace_documents
   WHERE document_id = 'd70b243d-2ad9-423e-b0f1-716b8c91f237' FOR UPDATE;
  IF target.project_id <> 'p21'
     OR target.source_ref <> 'p21:202608:report'
     OR target.entry_kind <> 'link'
     OR target.visibility <> 'amd_internal'
     OR target.folder_path <> '月次報告書/2026年8月'
     OR target.upload_status <> 'active' THEN
    RAISE EXCEPTION 'SX monthly report link precondition failed';
  END IF;
  IF target.external_url = 'https://amd-os-pwa.vercel.app/project/p21/report/202608/print?template=submission'
     AND target.mime_type = 'text/uri-list' THEN RETURN; END IF;
  IF target.external_url <> 'https://drive.google.com/file/d/1qKnnTiZmvG-C_f1oWkfbV6l2d-gqW7_B/view'
     OR target.mime_type <> 'text/markdown' THEN
    RAISE EXCEPTION 'SX monthly report link changed since inspection';
  END IF;
  UPDATE public.workspace_documents
     SET external_url = 'https://amd-os-pwa.vercel.app/project/p21/report/202608/print?template=submission',
         mime_type = 'text/uri-list', updated_at = now()
   WHERE document_id = target.document_id;
END;
$$;
COMMIT;
