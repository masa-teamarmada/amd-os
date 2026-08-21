-- 305_se_union_design_doc.sql
-- 2026-08-21 SE(p10)資料室へ「技術研究組合 設計案」を登録する。
-- 定款・規約・事業計画に落とす前段の設計文書（15章）。
-- 目的と事業／研究テーマの層分け／組合員の資格（役割で定義・原則1層1社）／加入の4段階と承認基準／
-- 賦課金3区分と現物貢献控除／開発費の実費精算と会計分離／配分の偏り防止／知財のBG・FG分離／
-- 機関と議決／利益相反の手当て／事務局人件費／脱退と除名／設立工程／株式会社化／未決事項。
-- 実体は Drive `p10_se/260821_SE技術研究組合_設計/` が正本。

BEGIN;

INSERT INTO public.workspace_documents (
  document_id, scope_kind, project_id, entry_kind, visibility, folder_path,
  display_name, storage_bucket, storage_path, mime_type, file_size_bytes,
  content_sha256, upload_status, source_kind, created_by_member_id, published_at
)
VALUES (
  '63b0a810-e49a-4fec-acdb-514a3cfb49ed',
  'project', 'p10', 'file', 'workspace_shared', '',
  'SE_技術研究組合_設計_20260821.html',
  'workspace-files', 'project/p10/63b0a810-e49a-4fec-acdb-514a3cfb49ed',
  'text/html', 301424,
  '3501f71d1c04fa3879d9f338521203de954fd19bce8a5d9884c02a6d80ccb548',
  'active', 'manual_upload', 'ID001', NOW()
)
ON CONFLICT (document_id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    storage_bucket = EXCLUDED.storage_bucket,
    storage_path = EXCLUDED.storage_path,
    mime_type = EXCLUDED.mime_type,
    file_size_bytes = EXCLUDED.file_size_bytes,
    content_sha256 = EXCLUDED.content_sha256,
    visibility = EXCLUDED.visibility,
    upload_status = 'active',
    archived_at = NULL,
    updated_at = NOW();

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.workspace_documents
  WHERE document_id = '63b0a810-e49a-4fec-acdb-514a3cfb49ed' AND project_id = 'p10' AND upload_status = 'active';
  IF n <> 1 THEN RAISE EXCEPTION 'SE union design doc registration expected 1 row, got %', n; END IF;
END
$$;

COMMIT;
