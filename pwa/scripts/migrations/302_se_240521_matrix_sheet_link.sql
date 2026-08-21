-- 302_se_240521_matrix_sheet_link.sql
-- 2026-08-21 SE(p10)資料室へ、2024-05作成のGoogleスプレッドシート「SE_240521」を
-- リンクとして登録する。Drive直下に置かれており埋もれて発見できなくなっていたため（まさ報告）。
-- 中身: 周波数帯×出力の星取り表（ダイオード/整流器、現状・2024-2025・2025-2027の3面）、
-- ワイヤレス給電の競合28社一覧、SE保有・共有特許の一覧、VCリスト。
-- 競合評価とVCリストを含むためAMD内部限定（amd_internal）で登録する。

BEGIN;

INSERT INTO public.workspace_documents (
  document_id,
  scope_kind,
  project_id,
  entry_kind,
  visibility,
  folder_path,
  display_name,
  external_url,
  mime_type,
  file_size_bytes,
  upload_status,
  source_kind,
  source_ref,
  created_by_member_id
)
VALUES (
  '64e37757-57f7-4546-8afd-35bfa59910c9',
  'project',
  'p10',
  'link',
  'amd_internal',
  'AMD内部/Drive資料',
  'SE_240521 周波数×出力 星取り表・競合28社・特許一覧（2024-05）',
  'https://docs.google.com/spreadsheets/d/1WMX0X9j07maO3Yy2YRQCTeDzr32hgoyiFqtVAbXayQY/edit',
  'application/vnd.google-apps.spreadsheet',
  0,
  'active',
  'manual_link',
  'drive_file:1WMX0X9j07maO3Yy2YRQCTeDzr32hgoyiFqtVAbXayQY',
  'ID001'
)
ON CONFLICT (document_id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    external_url = EXCLUDED.external_url,
    folder_path = EXCLUDED.folder_path,
    visibility = EXCLUDED.visibility,
    mime_type = EXCLUDED.mime_type,
    upload_status = 'active',
    archived_at = NULL,
    updated_at = NOW();

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.workspace_documents
  WHERE document_id = '64e37757-57f7-4546-8afd-35bfa59910c9' AND project_id = 'p10' AND upload_status = 'active';
  IF n <> 1 THEN
    RAISE EXCEPTION 'SE_240521 link registration expected 1 row, got %', n;
  END IF;
END
$$;

COMMIT;
