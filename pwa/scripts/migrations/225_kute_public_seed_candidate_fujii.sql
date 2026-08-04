-- 225_kute_public_seed_candidate_fujii.sql
-- KUTE公開情報追加調査 (2026-08-04) で確認した藤井先生の1件を、
-- 既存の公開情報候補3件と同じ review-first の候補として global Seeds に追加する。
--
-- 大学・研究者による事業化シーズとしての確認前であり、SPS評価は投入しない。
-- raw本文、一次ソースURL、連絡先、個人情報、secret は保存しない。

BEGIN;

INSERT INTO seeds (
  title, summary, org_name, org_type, org_region,
  researcher_name, researcher_title, domain_lane, industry_target, keywords,
  trl, brl, hrl, status, amd_rating, amd_rating_note, next_action,
  public_summary, is_public, source, source_detail, discovery_status,
  primary_commercialization_type, secondary_commercialization_types,
  envisioned_use_case, first_customer_candidate, market_size_range,
  market_size_confidence, biggest_bottleneck, ip_status, next_verification_step
)
SELECT
  'バイオガスと飼料バイオマスを同時生産する資源循環技術',
  '下水汚泥や食品残渣を嫌気菌叢で分解してバイオガスを生産し、ガス中のCO₂を微細藻類で固定して飼料バイオマスも得る資源循環シーズ。大学公式上は基礎研究段階のため、下水処理・廃棄物処理・養殖のいずれを最初の顧客とするか、一貫した収支と運用を検証する。',
  '工学院大学', 'university', '東京都',
  '藤井克彦先生', '教授', 'gx_circular',
  ARRAY['下水処理','食品廃棄物処理','バイオガス','養殖飼料']::text[],
  ARRAY['嫌気消化','バイオガス','微細藻類','CO2固定','下水汚泥','食品残渣','資源循環']::text[],
  NULL, NULL, NULL, 'candidate', 3,
  '公開情報追加調査の候補。大学公式の進捗は基礎研究段階で、事業化シーズとしての優先度、最初の顧客、設備・運用コスト、知財範囲は要確認。',
  '自治体または下水処理・食品廃棄物処理事業者1者と、処理量、バイオガス品質、藻類生産量、飼料利用要件、運転コストを既存設備と同じ前提で比較する。',
  '下水汚泥や食品残渣からバイオガスを生産し、そのCO₂を固定した藻類バイオマスを飼料に使う資源循環システム。',
  FALSE, 'web_search', 'KUTE公開情報追加シーズ調査 20260804', 'discovered',
  'joint_research_poc', ARRAY['license','small_business_1b_yen']::text[],
  '下水処理・食品廃棄物処理におけるバイオガス改質と、養殖・畜産向け飼料バイオマスの生産',
  '下水処理場または食品廃棄物処理事業者と連携する、養殖飼料・バイオガス利用事業者',
  NULL,
  NULL,
  '廃棄物の受入・衛生要件、ガス改質と藻類培養の一貫運転、飼料利用の品質要件、既存処理法との総コスト比較が未確認。',
  '公開情報に特許第7695683号、特願2024-141143の記載あり。請求項、帰属、海外出願、廃棄物処理・飼料利用に関わる権利と規制は未確認。',
  '候補顧客1者の実廃棄物を前提に、投入量当たりのガス量・CO₂固定量・飼料品質・運転費を既存処理と同じ勘定で比較する。'
WHERE NOT EXISTS (
  SELECT 1
  FROM seeds existing
  WHERE existing.org_name = '工学院大学'
    AND existing.title = 'バイオガスと飼料バイオマスを同時生産する資源循環技術'
);

DO $$
DECLARE
  found_count integer;
BEGIN
  SELECT count(*) INTO found_count
  FROM seeds
  WHERE org_name = '工学院大学'
    AND title = 'バイオガスと飼料バイオマスを同時生産する資源循環技術';

  IF found_count <> 1 THEN
    RAISE EXCEPTION '工学院大学の追加候補「バイオガスと飼料バイオマスを同時生産する資源循環技術」が exactly 1 件ではありません (見つかった件数: %)。', found_count;
  END IF;
END $$;

COMMIT;
