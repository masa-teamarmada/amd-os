-- 309_se_union_design_two_stage_contract.sql
-- 2026-08-21 組合設計書の04「加入の手続き」に、二段構えの契約設計を明記する（まさ指摘）。
-- 従来はMOUが加入手続きの第1段階として列挙されるだけで、「軽い合意で入ってもらい、
-- 内容が固まってから権利と対価を含む本契約に進む」という設計思想が書かれていなかった。
--   ・第一段（MOU）= 参加・情報共有・共同提案の検討まで。費用負担なし・法的拘束力なし・
--     秘密保持のみ実効的に。相手の事業部判断で締結できる水準に収める。
--   ・第二段（加入契約）= 担当層と人員設備、賦課金の額と負担割合、成果の持分と実施権、
--     脱退時の扱いを確定。ここで初めて義務が生じる。
--   ・二段に分ける理由（MOU時点では研究計画も参加企業も未確定で、権利と対価を決める前提がない。
--     前提が揃う前に金額を出すとその数字が一人歩きする）を明記。
--   ・手続きを4段階→5段階にし、条件提示の段を追加。14章の設立工程とも整合させた。

BEGIN;

DO $$
DECLARE n integer;
BEGIN
  UPDATE public.workspace_documents
  SET file_size_bytes = 310968,
      content_sha256 = '15ded9f9a0047573d9970e289668171e4a2f2cd7d854f0d70c23d6265fbf2bc4',
      updated_at = NOW()
  WHERE document_id = '63b0a810-e49a-4fec-acdb-514a3cfb49ed'
    AND project_id = 'p10'
    AND entry_kind = 'file'
    AND storage_path = 'project/p10/63b0a810-e49a-4fec-acdb-514a3cfb49ed'
    AND upload_status = 'active';

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'SE union design two-stage contract refresh expected 1 row, got %', n; END IF;
END
$$;

COMMIT;
