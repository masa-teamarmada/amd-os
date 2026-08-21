-- 307_se_union_design_document_only.sql
-- 2026-08-21 資料室のSE組合資料を「設計だけを書いた設計書」へ差し替える（まさ指示）。
-- 合意を特定箇所へ誘導する作りはハレーションのもとになるため、次を削除した:
--   ・00「本日の位置づけ」（8/20に決まったこと／お願いすること／合意をいただきたい11点）
--   ・各章末の「ご確認いただきたい点」
--   ・16「合意事項の一覧」（記入欄）
-- 残したのは01〜15の設計（目的と事業／研究テーマ／組合員の資格／加入手続き／賦課金／
-- 開発費の流れ／配分／成果と権利／機関と議決／利益相反／事務局と会計／脱退と除名／
-- 設立手続き／将来／未決事項）。全体を通して読んでもらう前提とする。
-- 印刷はデザインコードに従い、ページ区切りを作らず1枚の連続ページ（実測12,360px→13,000px）。
-- ファイル名を SE_技術研究組合_設計書_20260821.html に変更（旧版は途中成果物としてDriveに残す）。

BEGIN;

DO $$
DECLARE n integer;
BEGIN
  UPDATE public.workspace_documents
  SET display_name = 'SE_技術研究組合_設計書_20260821.html',
      file_size_bytes = 301629,
      content_sha256 = '0f6677ab2901e643c04067582effc629ec94c05423c853fd4e301500799aa638',
      updated_at = NOW()
  WHERE document_id = '63b0a810-e49a-4fec-acdb-514a3cfb49ed'
    AND project_id = 'p10'
    AND entry_kind = 'file'
    AND storage_path = 'project/p10/63b0a810-e49a-4fec-acdb-514a3cfb49ed'
    AND upload_status = 'active';

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'SE union design document refresh expected 1 row, got %', n; END IF;
END
$$;

COMMIT;
