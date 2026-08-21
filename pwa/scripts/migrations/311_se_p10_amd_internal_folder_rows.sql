-- 311_se_p10_amd_internal_folder_rows.sql
-- 2026-08-21 p10資料室で「SE_240521 星取り表」が一覧に現れない不具合を修正する（まさ報告）。
-- 原因: migration 302で folder_path='AMD内部/Drive資料' を指定したが、p10には該当フォルダの
-- 実体（entry_kind='folder' の行）が存在しなかった。p21/p25/p20 には 'AMD内部'（path='')と
-- 'Drive資料'（path='AMD内部'）の2行があり、それがあって初めて階層として表示される。
-- p10ではフォルダ行がないためどの階層にも現れず、件数（AMD内部1件）にだけ数えられていた。
-- 対処: 他PJと同じ構成のフォルダ行2件を作成する。

BEGIN;

INSERT INTO public.workspace_documents
  (document_id, scope_kind, project_id, entry_kind, visibility, folder_path, display_name, mime_type, file_size_bytes, upload_status, source_kind, created_by_member_id)
VALUES
  ('445e6eff-530a-472f-92da-156a33690f6f', 'project', 'p10', 'folder', 'amd_internal', '',         'AMD内部',   'application/x-directory', 0, 'active', 'manual_folder', 'ID001'),
  ('98768521-fb08-452d-bc0f-4e9adb28337b', 'project', 'p10', 'folder', 'amd_internal', 'AMD内部', 'Drive資料', 'application/x-directory', 0, 'active', 'manual_folder', 'ID001')
ON CONFLICT (document_id) DO NOTHING;

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.workspace_documents
  WHERE project_id = 'p10' AND entry_kind = 'folder' AND upload_status = 'active'
    AND display_name IN ('AMD内部','Drive資料');
  IF n <> 2 THEN
    RAISE EXCEPTION 'p10 AMD internal folder rows expected 2, got %', n;
  END IF;
END
$$;

COMMIT;
