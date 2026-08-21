-- 304_se_internal_doc_heading_and_content_fix.sql
-- 2026-08-21 SE社内合意資料の改訂を資料室へ同期する（まさ指摘の3点＋内容不足の是正）。
--  1) 見出し階層のデザインコード違反を修正: セクションタイトル(.eyebrow)を30px/900へ、
--     アイキャッチ(h2)を21px/700へ。全12章で eyecatch < section title を実測確認。
--  2) アイキャッチを全て肯定文へ書き換え（「〜ではなく」「〜ではありません」始まりを排除）。
--  3) タイトルの「社内でのご確認」→「社内確認」（社内向けに「ご」は不自然）。
--  4) 8/21の議論で詰めた具体論を追加: 賦課金の負担割合は均等にしない(06)、開発費の配分と
--     SEが独占しない理由(07・新設)、権利の設計(08)、事務局人件費を組合運営費から出す(09)。
--     11章→12章構成。

BEGIN;

DO $$
DECLARE
  n integer;
BEGIN
  UPDATE public.workspace_documents
  SET file_size_bytes = 293101,
      content_sha256 = 'b46d7574f0f086b607426631b0aae124409a519ed27d5620501983b312c82a1c',
      updated_at = NOW()
  WHERE document_id = 'f33f99fb-8e15-4d28-bba6-16bc7ad6694e'
    AND project_id = 'p10'
    AND entry_kind = 'file'
    AND storage_path = 'project/p10/f33f99fb-8e15-4d28-bba6-16bc7ad6694e'
    AND upload_status = 'active';

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'SE internal consensus doc refresh expected 1 row, got %', n;
  END IF;
END
$$;

COMMIT;
