-- 303_se_internal_union_consensus_doc.sql
-- 2026-08-21 SE(p10)資料室へ、社内合意用資料「技術研究組合をつくる ― 社内でのご確認」を登録する。
-- 8/20泉岳寺MTGで方向は合意済みだが、それは藤原社長・小林さん・及川先生との場での合意であり、
-- 社内（西鳥羽さん・岸本COO・北村取締役ほか）への説明と合意取得は別途必要なため作成した資料（まさ指示）。
-- 実体は Drive `p10_se/260821_SE社内合意_組合の仕組み/` が正本。Storageへは閲覧用に同一実体を保存済み。

BEGIN;

INSERT INTO public.workspace_documents (
  document_id,
  scope_kind,
  project_id,
  entry_kind,
  visibility,
  folder_path,
  display_name,
  storage_bucket,
  storage_path,
  mime_type,
  file_size_bytes,
  content_sha256,
  upload_status,
  source_kind,
  created_by_member_id,
  published_at
)
VALUES (
  'f33f99fb-8e15-4d28-bba6-16bc7ad6694e',
  'project',
  'p10',
  'file',
  'workspace_shared',
  '',
  'SE_社内合意_組合の仕組み_20260821.html',
  'workspace-files',
  'project/p10/f33f99fb-8e15-4d28-bba6-16bc7ad6694e',
  'text/html',
  288098,
  '594b69b053b4e0b998af3e2fb95c876ffbe8db9376c0623a311cf99d88134603',
  'active',
  'manual_upload',
  'ID001',
  NOW()
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
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.workspace_documents
  WHERE document_id = 'f33f99fb-8e15-4d28-bba6-16bc7ad6694e' AND project_id = 'p10' AND upload_status = 'active';
  IF n <> 1 THEN
    RAISE EXCEPTION 'SE internal consensus doc registration expected 1 row, got %', n;
  END IF;
END
$$;

COMMIT;
