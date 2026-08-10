-- 226_link_kute_fujii_public_seed.sql
-- migration 225 で追加した藤井先生の公開情報候補を、KUTEの機関スコープへ紐付ける。
-- 202 の全件backfill後に追加した行のため、既存行を再走査せず対象1件だけを補完する。

BEGIN;

UPDATE seeds
SET institution_id = 'inst_kute', updated_at = now()
WHERE org_name = '工学院大学'
  AND title = 'バイオガスと飼料バイオマスを同時生産する資源循環技術'
  AND institution_id IS DISTINCT FROM 'inst_kute';

DO $$
DECLARE
  found_count integer;
BEGIN
  SELECT count(*) INTO found_count
  FROM seeds
  WHERE org_name = '工学院大学'
    AND title = 'バイオガスと飼料バイオマスを同時生産する資源循環技術'
    AND institution_id = 'inst_kute';

  IF found_count <> 1 THEN
    RAISE EXCEPTION '藤井先生の公開情報候補が inst_kute に exactly 1 件紐付いていません (見つかった件数: %)。', found_count;
  END IF;
END $$;

COMMIT;
