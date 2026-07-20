-- 189_kute_public_seed_candidates.sql
-- KUTE公開情報追加調査 (2026-07-20) の上位3件を、研究者・大学による確認前の
-- review-first 候補として global Seeds に追加する。
-- 1行は「技術 × 応用先」の1案件。researcher_name は一意キーではなく、同じPIが
-- 複数シーズを持てる既存設計をそのまま使う。
--
-- raw本文、一次ソースURL、連絡先、個人情報、secret は保存しない。
-- 旧100点スクリーニングの TRL/BRL/HRL は全国共通SPSの軸へ流用せず、
-- seed_sps_assessments は研究者確認・再評価まで未登録のままにする。

BEGIN;

WITH candidate (
  title, summary, researcher_name, researcher_title, domain_lane,
  industry_target, keywords, amd_rating, amd_rating_note, next_action,
  primary_commercialization_type, secondary_commercialization_types,
  envisioned_use_case, first_customer_candidate, market_size_range,
  market_size_confidence, biggest_bottleneck, ip_status, next_verification_step
) AS (
  VALUES
    (
      '165〜220nm次世代クリーンUV面光源',
      '岩塩構造MgZnO半導体を使い、水銀を使わず真空紫外から深紫外を面発光させる光源シーズ。殺菌、水処理、半導体成膜の共同開発候補として、出力、寿命、安全性、量産再現性を検証する。',
      '尾沼猛儀先生', '教授', 'materials',
      ARRAY['殺菌装置','水処理','半導体製造装置','食品製造','医療機器']::text[],
      ARRAY['真空紫外','深紫外','MgZnO','水銀フリー','面光源','ミストCVD']::text[],
      4,
      '公開情報追加調査の上位候補。大学・研究者による事業化シーズとしての確認前で、性能・用途・知財範囲は要確認。',
      '光源メーカーまたは殺菌装置メーカー1社に、必要波長、照度、寿命、照射面積、安全規格の最低要件を確認し、現試作の実測値との差を表にする。',
      'license', ARRAY['joint_research_poc','jv_ma']::text[],
      '医療・食品・工場・公共空間の殺菌、高度水処理、半導体の微細加工・新材料成膜',
      '真空紫外またはUV-Cの光源・殺菌装置メーカーの研究開発部門',
      '500億〜6,000億円（水銀灯関連市場の置換可能部分を粗く仮置き。売上予測ではない）',
      'low',
      '出力密度、寿命、熱設計、オゾン等の安全性、量産面積、既存エキシマランプやLEDとの総コスト比較が未確認。',
      '公開シーズ資料に特願2025-119206、特願2025-119207の記載あり。請求項、帰属、海外出願、他方式への非侵害性は未確認。',
      '187nmでの光出力・効率・連続寿命・照射面積を確認し、最初に勝てる用途の要求仕様と比較する。'
    ),
    (
      '金属フリー透明フレキシブル導電膜',
      'CNTとSiO2の前駆体溶液をPET等へ塗布し、酸処理で形成する透明導電膜。曲面、紫外から赤外の透過、溶液塗工を活かし、透明ヒーターまたはウェアラブル電極で有償評価を目指す。',
      '永井裕己先生', '准教授', 'materials',
      ARRAY['透明ヒーター','ウェアラブル','ディスプレイ','太陽電池','光学センサー']::text[],
      ARRAY['透明導電膜','フレキシブル','金属フリー','CNT','溶液塗工','PET']::text[],
      4,
      '公開情報追加調査の上位候補。大学・研究者による事業化シーズとしての確認前で、量産性能・用途・知財範囲は要確認。',
      '透明ヒーター用途を仮の第一市場にし、面抵抗、透過率、曲げ耐久、発熱均一性、屋外耐久を顧客仕様と同じ条件で測る。',
      'license', ARRAY['joint_research_poc','jv_ma']::text[],
      '防曇・融雪用の透明ヒーター、皮膚貼付型ウェアラブルセンサー、曲面ディスプレイ、太陽電池・光学部材',
      '車載、カメラ、屋外センサー向け透明ヒーター部材メーカーの材料開発部門',
      '100億〜1,000億円（用途別の公開一次統計を未確認のボトムアップ概算。売上予測ではない）',
      'low',
      '面抵抗と透過率の両立、湿熱・屈曲の長期耐久、大面積均一性、CNTコスト、既存ITOや銀ナノワイヤとの総コスト比較が未確認。',
      '公開シーズ資料に特許第7477889号、特願2024-192440の記載あり。権利範囲、共同発明・帰属、海外権利、用途クレームは未確認。',
      '透明ヒーター用途で波長別透過率、面抵抗、曲げ耐久、発熱温度、湿熱寿命、大面積均一性を顧客条件で測る。'
    ),
    (
      '塩水・交流電気分解による都市鉱山金回収',
      '電子基板等を塩化物イオン水溶液に入れ、交流電気分解で金を溶解する都市鉱山プロセス。王水を使わない点を活かし、前処理から金回収、電解液再利用までの一貫収支を小規模リサイクラーと検証する。',
      '高見知秀先生', '教授', 'gx_circular',
      ARRAY['電子廃棄物リサイクル','貴金属精錬','電子部品製造','都市鉱山']::text[],
      ARRAY['金回収','交流電気分解','塩水','都市鉱山','電子廃棄物','湿式精錬']::text[],
      4,
      '公開情報追加調査の上位候補。大学・研究者による事業化シーズとしての確認前で、一貫プロセス・原価・知財範囲は要確認。',
      '基板リサイクラー1社から実廃材を受け、金収率、選択性、電力量、薬液再利用、残渣処理を王水法と同じ勘定で比較する。',
      'joint_research_poc', ARRAY['license','jv_ma','small_business_1b_yen']::text[],
      '廃基板、めっき廃材、金電極からの金回収と、小規模分散型の都市鉱山処理',
      '既存の王水処理費、安全対策費、外部精錬委託費を持つ中小リサイクル事業者',
      '500億〜5,000億円（電子廃棄物の未回収資源価値から金関連の対象部分を粗く按分。売上予測ではない）',
      'low',
      '溶解後の選択回収、実基板での不純物耐性、収率、処理速度、電力、電解液再生、残渣の法規対応を含む一貫プロセスが未実証。',
      '公開シーズ資料に特願2025-112603の記載あり。請求項の対象工程、PCT出願、共同発明・帰属、既存塩化物電解法との差分は未確認。',
      '実基板1kg当たりの金収率、処理時間、電力量、薬液費、選択性、電解液再利用、残渣処理を既存法と同じ勘定で比較する。'
    )
)
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
  candidate.title, candidate.summary, '工学院大学', 'university', '東京都',
  candidate.researcher_name, candidate.researcher_title, candidate.domain_lane,
  candidate.industry_target, candidate.keywords,
  NULL, NULL, NULL, 'candidate', candidate.amd_rating, candidate.amd_rating_note, candidate.next_action,
  candidate.summary, FALSE, 'web_search', 'KUTE公開情報追加シーズ調査 20260720', 'discovered',
  candidate.primary_commercialization_type, candidate.secondary_commercialization_types,
  candidate.envisioned_use_case, candidate.first_customer_candidate, candidate.market_size_range,
  candidate.market_size_confidence, candidate.biggest_bottleneck, candidate.ip_status, candidate.next_verification_step
FROM candidate
WHERE NOT EXISTS (
  SELECT 1
  FROM seeds existing
  WHERE existing.org_name = '工学院大学'
    AND existing.title = candidate.title
);

DO $$
DECLARE
  expected_title text;
  found_count integer;
  expected_titles CONSTANT text[] := ARRAY[
    '165〜220nm次世代クリーンUV面光源',
    '金属フリー透明フレキシブル導電膜',
    '塩水・交流電気分解による都市鉱山金回収'
  ];
BEGIN
  FOREACH expected_title IN ARRAY expected_titles LOOP
    SELECT count(*) INTO found_count
    FROM seeds
    WHERE org_name = '工学院大学' AND title = expected_title;

    IF found_count <> 1 THEN
      RAISE EXCEPTION '工学院大学の追加候補「%」が exactly 1 件ではありません (見つかった件数: %)。', expected_title, found_count;
    END IF;
  END LOOP;
END $$;

COMMIT;
