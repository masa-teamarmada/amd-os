-- 308_se_union_design_workflow_and_allocation.sql
-- 2026-08-21 組合設計書に、抜けていた2点を追加する（まさ指摘）。
--   ・07「受託から支払いまで」を新設: 外部から委託・共同研究が来たとき、事務局が一元的に受け、
--     可否判断→体制と積算→理事会決議→契約→実施と報告→確認と支払い→完了と開示、の8段階を規定。
--   ・08「開発費の行き先」を新設: 開発費がどの企業へいくらいくのかを、案件が層を決める→層が担当を
--     決める→実費が金額を決める、の3段階で説明。3,000万円受託時の配分例（組合の管理費450万、
--     翔エンジ900万、センシング500万、通信300万、実装450万、大学400万）を掲載。旧「配分の決め方」は
--     内容が重複するため08へ統合し、以降の章を繰り上げて16章構成にした。
-- あわせて文体を常体（である調）へ統一し、自動変換で生じた語尾の破損（「従いる」「集まりる」等）を修正。
-- 印刷はページ区切りなしの1枚連続ページ（@page 1200×15200px、PDF1ページで全16章を確認）。

BEGIN;

DO $$
DECLARE n integer;
BEGIN
  UPDATE public.workspace_documents
  SET file_size_bytes = 308015,
      content_sha256 = 'd4648a5874400e71b2447cf3f8bd4d461f8fc99f72746f7d636d7f30bb2e8370',
      updated_at = NOW()
  WHERE document_id = '63b0a810-e49a-4fec-acdb-514a3cfb49ed'
    AND project_id = 'p10'
    AND entry_kind = 'file'
    AND storage_path = 'project/p10/63b0a810-e49a-4fec-acdb-514a3cfb49ed'
    AND upload_status = 'active';

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'SE union design workflow refresh expected 1 row, got %', n; END IF;
END
$$;

COMMIT;
