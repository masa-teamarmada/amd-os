-- 306_se_union_design_consensus_form.sql
-- 2026-08-21 「技術研究組合 設計案」を合意形成用の資料へ作り替えた実体に同期する。
-- 8/20に組合設立の方向自体は合意済みで、今回必要なのは「細かい設計についてみなさんの
-- 合意を得られるベース」（まさ訂正）。規定を並べた設計文書から、論点ごとに合意・修正・保留を
-- 判断できる形へ変更した:
--   ・00「本日の位置づけ」を新設（8/20に決まったこと／今回お願いすること／合意をいただきたい11点）
--   ・01〜14の各章末に「ご確認いただきたい点」を追加（合意の単位を明示）
--   ・16「合意事項の一覧」を新設（11論点の記入欄＋その場で意見をもらう6点）
--   ・表題を「設計案」から「設計のご相談」へ

BEGIN;

DO $$
DECLARE n integer;
BEGIN
  UPDATE public.workspace_documents
  SET display_name = 'SE_技術研究組合_設計_20260821.html',
      file_size_bytes = 314488,
      content_sha256 = 'ba032c9e43bbc0337929a387cdddab935a062cd3b22f39a7b379b49bd768ea33',
      updated_at = NOW()
  WHERE document_id = '63b0a810-e49a-4fec-acdb-514a3cfb49ed'
    AND project_id = 'p10'
    AND entry_kind = 'file'
    AND storage_path = 'project/p10/63b0a810-e49a-4fec-acdb-514a3cfb49ed'
    AND upload_status = 'active';

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'SE union design consensus refresh expected 1 row, got %', n; END IF;
END
$$;

COMMIT;
