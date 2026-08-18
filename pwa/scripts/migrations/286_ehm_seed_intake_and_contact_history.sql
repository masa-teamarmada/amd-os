-- 286_ehm_seed_intake_and_contact_history.sql
-- EHM: 2026-08-18 intake 2件と、初回のMTG / Slack接触履歴を登録する。
-- 再実行時に既存scopeの paused/revoked を activeへ戻さない。

COMMENT ON COLUMN seed_contact_log.method IS
  'email / phone / slack / teams / meeting / event / referral / visit / other';

DO $$
DECLARE
  v_workspace_id uuid;
  v_sawazaki_seed_id uuid;
  v_rejuvida_seed_id uuid;
BEGIN
  IF (SELECT count(*) FROM institutions WHERE institution_id = 'inst_ehime' AND name = '愛媛大学') <> 1 THEN
    RAISE EXCEPTION 'inst_ehime=愛媛大学 が一意に存在しない';
  END IF;

  SELECT id INTO v_workspace_id
  FROM institution_workspaces
  WHERE slug = 'ehime';
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'ehime workspace が存在しない';
  END IF;

  IF (SELECT count(*) FROM members WHERE member_id = 'ID001' AND code_name = 'まさ') <> 1 THEN
    RAISE EXCEPTION '接触担当 ID001=まさ が一意に存在しない';
  END IF;

  IF (SELECT count(*) FROM seeds WHERE title = '植物種子による高価値タンパク質・ラビット抗体の低コスト生産') > 1
     OR (SELECT count(*) FROM seeds WHERE title = 'Rejuvida：介護AI実装・定着プラットフォーム') > 1 THEN
    RAISE EXCEPTION '対象シーズと同名の行が複数あり、投入対象を一意に決められない';
  END IF;

  IF EXISTS (
    SELECT 1 FROM seeds
    WHERE id = '98e35133-f6d9-42de-8ce9-cb84c70b770f'
      AND title <> '植物種子による高価値タンパク質・ラビット抗体の低コスト生産'
  ) OR EXISTS (
    SELECT 1 FROM seeds
    WHERE id = 'acab7084-0c48-4cc9-be02-34a860772ec0'
      AND title <> 'Rejuvida：介護AI実装・定着プラットフォーム'
  ) THEN
    RAISE EXCEPTION 'migration固定IDが別シーズに使用済み';
  END IF;

  INSERT INTO seeds (
    id, title, summary, org_name, org_type, org_region, institution_id,
    researcher_name, researcher_title, lab_name, domain_lane, industry_target, keywords,
    status, amd_owner_member_id, next_action, internal_notes, is_public,
    source, source_detail, discovery_status, created_by, updated_by
  )
  SELECT
    '98e35133-f6d9-42de-8ce9-cb84c70b770f',
    '植物種子による高価値タンパク質・ラビット抗体の低コスト生産',
    '小麦無細胞合成系由来の設計技術と植物工場を組み合わせ、植物種子で研究用ラビット抗体などの高価値タンパク質を低コスト・大量生産する愛媛大学発事業化シーズ。第一市場は研究用抗体試薬。',
    '愛媛大学', 'university', '愛媛県', 'inst_ehime',
    '澤崎 佑太', '特定研究員', 'プロテオサイエンスセンター 無細胞生命科学部門',
    'life',
    ARRAY['研究用試薬','バイオ医薬品','動物用医薬品']::text[],
    ARRAY['植物種子','植物工場','ラビット抗体','タンパク質生産','小麦無細胞合成系']::text[],
    'discussing', 'ID001',
    '10月のBioJapanで需要感を確認し、伊予銀行との融資交渉を並行する。石原先生経由で継続相談の連絡体制を整える。',
    '2026-08-18のNotion議事録を確認。Teamsの議事録本文はMicrosoft側のサインインエラーにより未確認。会社名候補はSeed Base Science。',
    false, 'introduction',
    '石原先生紹介。2026-08-18 Notion議事録確認。Teams議事録はサインインエラーで未確認。',
    'reviewed', 'ID001', 'ID001'
  WHERE NOT EXISTS (
    SELECT 1 FROM seeds WHERE title = '植物種子による高価値タンパク質・ラビット抗体の低コスト生産'
  );

  INSERT INTO seeds (
    id, title, summary, org_name, org_type, org_region, institution_id,
    researcher_name, domain_lane, industry_target, keywords,
    status, amd_owner_member_id, next_action, internal_notes, is_public,
    source, source_detail, discovery_status, created_by, updated_by
  )
  SELECT
    'acab7084-0c48-4cc9-be02-34a860772ec0',
    'Rejuvida：介護AI実装・定着プラットフォーム',
    '介護施設・在宅介護等の分散情報と専門知活用不足を対象に、医学・老年薬学の知見を基盤としてAI導入前診断、実装、職員育成、定着、効果・安全性評価、自走化までを一体提供する構想。現行プロトタイプRejuvidaを松山市の実証で検証中。',
    '愛媛大学', 'university', '愛媛県', 'inst_ehime',
    '劉先生', 'ict',
    ARRAY['介護施設','在宅介護事業所','地域包括支援センター','病院']::text[],
    ARRAY['Rejuvida','介護AI','AI実装','定着支援','老年医学','老年薬学','職員育成']::text[],
    'investigating', 'ID001',
    '2026-08-24 14:00の初回MTGで、事業の本体、経営・BizDev体制、最初の支払顧客、成長範囲、KPIを確認する。',
    '研究者の氏名・職位は「劉先生」以外未確認。特願2026-188169・商願2026-75863、まつやま未来コネクト採択、病院・介護施設2件でのPoC、来年STEP2応募予定、ソーシャル枠1.5年3,000万円は2026-08-18時点の当事者申告・計画で、独立確認未実施。Drive p30_ehm/劉先生の事業プラン論点整理Wordを確認済み。',
    false, 'referral',
    '石原先生からSlack DMで紹介。Drive p30_ehm/劉先生の2026-08-18論点整理Wordを確認。',
    'reviewed', 'ID001', 'ID001'
  WHERE NOT EXISTS (
    SELECT 1 FROM seeds WHERE title = 'Rejuvida：介護AI実装・定着プラットフォーム'
  );

  SELECT id INTO v_sawazaki_seed_id
  FROM seeds WHERE title = '植物種子による高価値タンパク質・ラビット抗体の低コスト生産';
  SELECT id INTO v_rejuvida_seed_id
  FROM seeds WHERE title = 'Rejuvida：介護AI実装・定着プラットフォーム';

  IF EXISTS (SELECT 1 FROM seeds WHERE id IN (v_sawazaki_seed_id, v_rejuvida_seed_id) AND institution_id <> 'inst_ehime') THEN
    RAISE EXCEPTION '対象シーズが inst_ehime 以外に紐づいている';
  END IF;

  INSERT INTO seed_contact_log (id, seed_id, contacted_on, method, amd_member_id, note, next_action)
  SELECT
    '4311a5a1-4373-46bd-b135-c8919a99518c', v_sawazaki_seed_id, DATE '2026-08-18', 'meeting', 'ID001',
    '石原先生の紹介で初回MTG。研究用ラビット抗体を入口に需要感の確認と地銀融資を並行し、当面は澤崎さん自身が事業化を進める方針を整理。継続相談の連絡体制を整える。',
    '10月のBioJapanで需要感を確認し、伊予銀行との融資交渉を並行する。'
  WHERE NOT EXISTS (
    SELECT 1 FROM seed_contact_log
    WHERE seed_id = v_sawazaki_seed_id AND contacted_on = DATE '2026-08-18' AND method = 'meeting'
      AND note = '石原先生の紹介で初回MTG。研究用ラビット抗体を入口に需要感の確認と地銀融資を並行し、当面は澤崎さん自身が事業化を進める方針を整理。継続相談の連絡体制を整える。'
  );

  INSERT INTO seed_contact_log (id, seed_id, contacted_on, method, amd_member_id, note, next_action)
  SELECT
    'bf5a5ca5-db96-4f45-b846-59f179759b8e', v_rejuvida_seed_id, DATE '2026-08-18', 'slack', 'ID001',
    '石原先生から事業相談。Rejuvidaを介護AI単体ではなく、診断・導入・人材育成・定着・効果安全性評価まで含む実装基盤として検討。初回MTGを設定。',
    '2026-08-24 14:00の初回MTGで、事業の本体、経営・BizDev体制、最初の支払顧客、成長範囲、KPIを確認する。'
  WHERE NOT EXISTS (
    SELECT 1 FROM seed_contact_log
    WHERE seed_id = v_rejuvida_seed_id AND contacted_on = DATE '2026-08-18' AND method = 'slack'
      AND note = '石原先生から事業相談。Rejuvidaを介護AI単体ではなく、診断・導入・人材育成・定着・効果安全性評価まで含む実装基盤として検討。初回MTGを設定。'
  );

  INSERT INTO institution_workspace_seed_scopes (workspace_id, seed_id, status)
  VALUES
    (v_workspace_id, v_sawazaki_seed_id, 'active'),
    (v_workspace_id, v_rejuvida_seed_id, 'active')
  ON CONFLICT (workspace_id, seed_id) DO NOTHING;

  IF (SELECT count(*) FROM seeds WHERE id IN (v_sawazaki_seed_id, v_rejuvida_seed_id)) <> 2 THEN
    RAISE EXCEPTION 'EHM対象シーズ2件の投入確認に失敗';
  END IF;
  IF (SELECT count(*) FROM seed_contact_log WHERE id IN ('4311a5a1-4373-46bd-b135-c8919a99518c', 'bf5a5ca5-db96-4f45-b846-59f179759b8e')) <> 2 THEN
    RAISE EXCEPTION 'EHM対象シーズの初回接触履歴2件の投入確認に失敗';
  END IF;
  IF (SELECT count(*) FROM institution_workspace_seed_scopes WHERE workspace_id = v_workspace_id AND seed_id IN (v_sawazaki_seed_id, v_rejuvida_seed_id)) <> 2 THEN
    RAISE EXCEPTION 'ehime workspace seed scopeへの追加確認に失敗';
  END IF;
END $$;
