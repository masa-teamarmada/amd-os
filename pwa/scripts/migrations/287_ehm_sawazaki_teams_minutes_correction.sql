-- 287_ehm_sawazaki_teams_minutes_correction.sql
-- Teams「無細胞たんぱくPJ」で石原先生が共有したPlaud議事録を確認し、
-- migration 286 の「Teams未確認」を訂正して共有履歴を追加する。

DO $$
DECLARE
  v_seed_id uuid;
BEGIN
  SELECT id INTO v_seed_id
  FROM seeds
  WHERE title = '植物種子による高価値タンパク質・ラビット抗体の低コスト生産';

  IF v_seed_id IS NULL THEN
    RAISE EXCEPTION '訂正対象の澤崎シーズが存在しない';
  END IF;

  IF (SELECT count(*) FROM seeds WHERE title = '植物種子による高価値タンパク質・ラビット抗体の低コスト生産') <> 1 THEN
    RAISE EXCEPTION '訂正対象の澤崎シーズが一意でない';
  END IF;

  UPDATE seeds
  SET
    source_detail = '石原先生紹介。2026-08-18 Notion議事録とTeams「無細胞たんぱくPJ」で共有されたPlaud議事録を確認。',
    internal_notes = '2026-08-18のNotion議事録と、石原先生がTeams「無細胞たんぱくPJ」で共有したPlaud議事録を確認。Plaud要約では、3カ月の生産サイクル、種子の4℃保管、ラビット抗体の低価格・大量生産仮説、研究用抗体への初期集中、年間売上1億円目標、大学設備を収益工程に使わない方針、伊予銀行重視、ミックス型シード、SHA、外部CFO、リファラル採用が整理されている。PlaudのAI要約には参加者氏名の誤認があるため、氏名マスタには採用せず、期限・担当を含むアクション項目も当事者確認前の記録として扱う。会社名候補はSeed Base Science。',
    updated_at = now(),
    updated_by = 'ID001'
  WHERE id = v_seed_id;

  IF EXISTS (
    SELECT 1 FROM seed_contact_log
    WHERE id = '5944ccad-d0ce-44d6-ac8e-301e4047a3ee'
      AND seed_id <> v_seed_id
  ) THEN
    RAISE EXCEPTION 'Teams履歴の固定IDが別シーズに使用済み';
  END IF;

  INSERT INTO seed_contact_log (
    id, seed_id, contacted_on, method, amd_member_id, note, next_action
  )
  SELECT
    '5944ccad-d0ce-44d6-ac8e-301e4047a3ee',
    v_seed_id,
    DATE '2026-08-18',
    'teams',
    'ID001',
    '石原先生がTeams「無細胞たんぱくPJ」でPlaud議事録を共有。3カ月生産、種子4℃保管、ラビット抗体の低価格・大量生産、研究用抗体への初期集中、大学設備を収益工程に使わない方針、融資・混合型シード、SHA、外部CFO等の論点を確認。PlaudのAI要約には氏名誤認があるため、人物情報は上書きしていない。',
    'BioJapanで需要感を確認し、大学設備不使用の運用、製造原価・SOP、販売計画、資金計画の期限・担当を当事者と確認する。'
  WHERE NOT EXISTS (
    SELECT 1 FROM seed_contact_log
    WHERE seed_id = v_seed_id
      AND contacted_on = DATE '2026-08-18'
      AND method = 'teams'
      AND note LIKE '石原先生がTeams「無細胞たんぱくPJ」でPlaud議事録を共有。%'
  );

  IF (SELECT count(*) FROM seed_contact_log WHERE seed_id = v_seed_id AND method = 'teams') < 1 THEN
    RAISE EXCEPTION 'Teams共有履歴の追加確認に失敗';
  END IF;
END $$;
