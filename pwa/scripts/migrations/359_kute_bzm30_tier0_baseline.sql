-- KUTE 22 seeds: adopt the user-approved 2026-09-01 Tier 0 baseline inputs for
-- current SPS (BZM 3.0). Scores remain append-only and are calculated afterward
-- by model/tools/bzm30_score_seeds.cjs.
--
-- Scope and evidence ledger:
--   model/cases/kute_22_tier0_baseline_2026-09-01.md

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';
SELECT pg_advisory_xact_lock(hashtext('kute_bzm30_tier0_baseline_20260901'));

CREATE TEMP TABLE kute_bzm30_baseline (
  seed_id uuid PRIMARY KEY,
  title text NOT NULL,
  use_case text NOT NULL,
  market_sales_yen bigint NOT NULL,
  displacement_yen bigint NOT NULL,
  process_type text NOT NULL,
  reg_class text NOT NULL,
  evidence_stage int NOT NULL,
  placement_note text NOT NULL
) ON COMMIT DROP;

INSERT INTO kute_bzm30_baseline VALUES
  ('4ff7e277-91bc-4627-9aee-249314c36258','165〜220nm次世代クリーンUV面光源','殺菌・検査向けUV光源の国内部品市場',100000000000,0,'F2','REG1',1,'殺菌・検査向けUV光源の国内部品市場'),
  ('efc941cb-79cf-4f07-9d9e-26993b76d8a5','DCD歩行解析・療育現場支援ツール','療育事業所向け解析利用料',5000000000,0,'F3','REG0',1,'療育事業所向け解析利用料'),
  ('d9a588b7-226c-45c2-a5bf-2f9f2ee0cf60','バイオガスと飼料バイオマスを同時生産する資源循環技術','畜産バイオガス・飼料化の導入・運用工程',10000000000,0,'F1','REG0',0,'畜産バイオガス・飼料化の導入・運用工程'),
  ('a1390f71-3d7d-4bbc-9016-ca25bc901c34','フレキシブル熱電発電・センサー電源プラットフォーム','IoTセンサー電源の熱電モジュール',10000000000,0,'F2','REG0',1,'無電源センサ用電源デバイス'),
  ('ed2ba973-8df1-441a-8dd2-0bea2557674f','ミスト法で形成する窒化銅薄膜と銅配線への展開','薄膜・配線工程',20000000000,3500000000,'F1','REG0',1,'薄膜・配線工程。既存工程の半分を控除'),
  ('29f57970-48b6-47ef-b950-b4ef1735f7ed','低濃度CO2吸蔵・水素化を革新する多元機能触媒の設計開発','低濃度CO2処理・変換の反応工程',10000000000,0,'F1','REG0',1,'低濃度CO2処理・変換の反応工程'),
  ('cc843bad-5e10-4473-8bf0-3de8ee60014c','促進酸化水と表面修飾による低ファウリング分離膜','分離膜工程',30000000000,7350000000,'F1','REG0',1,'分離膜工程。既存膜の70%を控除'),
  ('bc5c18b7-39bd-4ad6-b2a1-eea20e2d1421','医療機器設計向け力学特性データ基盤','設計データ利用料',10000000000,1750000000,'F3','REG0',1,'設計データ利用料。既存解析分を半分控除'),
  ('64b7f789-c25c-4f51-b788-81fd8db4c294','塩水・交流電気分解による都市鉱山金回収','金回収プロセス',20000000000,3500000000,'F1','REG0',1,'金回収プロセス。既存回収の半分を控除'),
  ('e38fc67a-bb70-48a6-aadf-8889bf395b62','室温・紫外線プロセスによる酸化物薄膜トランジスタ','低温TFTの成膜工程',20000000000,0,'F1','REG0',1,'低温TFTの成膜工程'),
  ('746ffb85-c309-4c2e-b229-11ebe7634e34','常時微動による建物診断・防災点検シーズ','建物診断',10000000000,1750000000,'F3','REG0',1,'建物診断。既存点検の半分を控除'),
  ('94c27c17-c397-4cb8-8b4b-eccfd38e967d','打診反発音を使う外壁タイル接着状態の診断','外壁点検',5000000000,875000000,'F3','REG0',1,'外壁点検。既存点検の半分を控除'),
  ('4b81f8c9-8a42-4356-a50d-0a45d470f77f','構造を調整できるポリ乳酸ヒドロゲル','研究・再生医療周辺向け材料工程',10000000000,0,'F1','REG0',1,'研究・再生医療周辺向け材料工程'),
  ('ade7d86a-4f5a-4e83-9232-9ad4118e03fc','液体金属を電気的に移動させる遮光・反射素子','遮光・反射デバイス部品',5000000000,0,'F2','REG0',1,'遮光・反射デバイス部品'),
  ('2b3a02e3-b2e9-464e-ab27-a431f5a993e7','画像処理による近距離三次元計測','近距離3D計測ソフト・装置利用',6000000000,0,'F3','REG0',1,'近距離3D計測ソフト・装置利用'),
  ('f8fddf69-7fe5-4fb2-b489-dc19bf68f7eb','翼のひずみを利用する小型流速・対気速度センサー','小型流速センサ部品',5000000000,0,'F2','REG0',1,'小型流速センサ部品'),
  ('e82958c3-d2ff-4591-b69c-c31749caa073','耳周囲電極による装着負担の小さい脳波計測','研究・非診断の脳波計測機器',5000000000,0,'F2','REG0',1,'研究・非診断の脳波計測機器'),
  ('5c837d5a-8716-4bfd-98e2-84e671f3ae19','表面変形から内部ひずみを推定する部品余寿命・再利用診断','余寿命診断',10000000000,1750000000,'F3','REG0',1,'余寿命診断。既存検査の半分を控除'),
  ('fc966b38-8411-40bb-a91f-7cee9e4bd3a2','金属フリー透明フレキシブル導電膜','導電膜工程',20000000000,3500000000,'F1','REG0',1,'導電膜工程。既存導電膜の半分を控除'),
  ('da4dc964-226f-405b-86c3-a0439cc9f57d','非貴金属錯体電極による亜酸化窒素の電解浄化','N2O排ガス浄化の反応工程',5000000000,0,'F1','REG0',1,'N2O排ガス浄化の反応工程'),
  ('1c823a52-7274-4028-8e64-fc7aabe81d83','音響メタマテリアル・吸遮音部材シーズ','建材・移動体の吸遮音部材',20000000000,3500000000,'F2','REG1',1,'建材・移動体の吸遮音部材。既存材の半分を控除'),
  ('e73065f7-c30d-4260-96ca-86a19eb96918','鳥類音響デバイス・音響体験シーズ','体験・展示用音響デバイス',1000000000,0,'F2','REG0',1,'体験・展示用音響デバイス');

DO $guard$
BEGIN
  IF (SELECT count(*) FROM kute_bzm30_baseline) <> 22 THEN
    RAISE EXCEPTION 'Expected exactly 22 baseline rows';
  END IF;
  IF (SELECT count(*) FROM public.seeds WHERE institution_id='inst_kute') <> 22 THEN
    RAISE EXCEPTION 'Production KUTE seed count is not 22';
  END IF;
  IF EXISTS (
    SELECT 1 FROM kute_bzm30_baseline b
    LEFT JOIN public.seeds s ON s.id=b.seed_id AND s.institution_id='inst_kute'
    WHERE s.id IS NULL OR s.title IS DISTINCT FROM b.title
  ) THEN
    RAISE EXCEPTION 'KUTE seed identity/title mismatch';
  END IF;
END $guard$;

INSERT INTO public.seed_value_ceilings (
  seed_id,use_case,market_sales_yen,market_year,value_added_rate,ceiling_yen,
  displacement_yen,is_primary,source,confidence,note,evaluator,assessed_at,updated_at
)
SELECT seed_id,use_case,market_sales_yen,2026,0.35,
       round(market_sales_yen*0.35)::bigint,displacement_yen,true,
       'KUTE 22件 現行SPS（BZM 3.0）基準線 2026-09-01',
       'low',
       placement_note||'。公開情報から置いた比較用の初期SAM。自社シェアは掛けていない。一次統計で更新する。',
       'eimi',now(),now()
FROM kute_bzm30_baseline
ON CONFLICT (seed_id,use_case) DO UPDATE SET
  market_sales_yen=excluded.market_sales_yen,
  market_year=excluded.market_year,
  value_added_rate=excluded.value_added_rate,
  ceiling_yen=excluded.ceiling_yen,
  displacement_yen=excluded.displacement_yen,
  is_primary=excluded.is_primary,
  source=excluded.source,
  confidence=excluded.confidence,
  note=excluded.note,
  evaluator=excluded.evaluator,
  assessed_at=excluded.assessed_at,
  updated_at=excluded.updated_at;

INSERT INTO public.seed_bzm30_inputs (
  seed_id,process_type,reg_class,classification_confidence,classification_reason,
  evidence_stage,evidence_stage_reason,incorporated,free_cash_yen,free_cash_as_of,
  rights_open,under_contract,sigma,evangelist_e,kappa_ip,self_revenue_yen_month,
  self_revenue_note,unit_margin_positive,use_case_left,note,evaluator,assessed_at,
  free_cash_reason,burn_rate_yen_month,burn_rate_reason,rights_open_reason,
  under_contract_reason,kappa_ip_reason,sigma_reason,evangelist_e_reason,
  unit_margin_reason,incorporated_reason,conversion_c,conversion_c_reason,
  quiet_months,quiet_months_reason,funcs_f2,funcs_f2_reason,funcs_f3,funcs_f3_reason,
  funcs_f4,funcs_f4_reason,funcs_f5,funcs_f5_reason,funcs_f6,funcs_f6_reason,
  funcs_f7,funcs_f7_reason,burn_post_yen_month,burn_post_reason,updated_at
)
SELECT
  seed_id,process_type,reg_class,'provisional',
  placement_note||'を主用途とする比較用Tier 0分類。個別ヒアリング後に更新する。',
  evidence_stage,
  CASE WHEN evidence_stage=1
       THEN '公開された大学・JST等の技術資料で原理実証を確認。再現性・実環境検証は未確認。'
       ELSE '公開資料から原理実証の第三者検証可能な記録を確認できず、段階0に置いた。' END,
  false,0,'2026-09-01',2,false,NULL,0.50,0.55,0,
  '法人化検討前の比較基準線。事業売上・受託売上は0。',false,0,
  'KUTE 22件を法人化検討前・専任事業チームなしの同一条件で比較するTier 0基準線。未調査値を事実認定せず、明示した既定値として保存。',
  'eimi',now(),
  '法人化前で案件が自由に使える会社資金は0。大学の研究費・設備・人件費は会社資金に含めない。',
  NULL,'個別の実支出は未調査。工程型別のTier 0既定を使用する。',
  '知財帰属・実施許諾条件の確認と事業化条件の整理を未解決2件として仮置き。',
  '商用契約・有償PoC契約は未確認。',
  '個別の権利帰属・共同出願・実施許諾条件が未確認のため、単独出願済み相当のTier 0既定0.55。市場シェアではない。',
  '型×規制区分の直近24か月統計を未取得のため、分布のTier 0既定を使用する。',
  '機能1は評価日時点で未充足。探索による充足見込みのTier 0既定 e=0.50。',
  '価格・原価・顧客条件が未確認のため、黒字の単位採算は未成立として置く。',
  '法人化検討前・会社未設立。',
  NULL,'案件別の変換履歴が未取得のためTier 0既定を使用する。',
  NULL,'最後のポジティブ事象の日付を案件別に確定していないため未調査。',
  1,'シーズ登録と公開技術資料により、技術の核は存在すると置く。',
  0,'専任の用途・需要家開拓機能は未組成。',
  0,'専任の最終意思決定・説明責任機能は未組成。',
  0,'専任の資金調達実行機能は未組成。',
  0,'専任の対外交渉・契約機能は未組成。',
  0,'専任の組織構築・運営機能は未組成。',
  NULL,'会社化後の計画バーンは事業計画未作成のためTier 0既定を使用する。',
  now()
FROM kute_bzm30_baseline
ON CONFLICT (seed_id) DO UPDATE SET
  process_type=excluded.process_type,reg_class=excluded.reg_class,
  classification_confidence=excluded.classification_confidence,
  classification_reason=excluded.classification_reason,evidence_stage=excluded.evidence_stage,
  evidence_stage_reason=excluded.evidence_stage_reason,incorporated=excluded.incorporated,
  free_cash_yen=excluded.free_cash_yen,free_cash_as_of=excluded.free_cash_as_of,
  rights_open=excluded.rights_open,under_contract=excluded.under_contract,sigma=excluded.sigma,
  evangelist_e=excluded.evangelist_e,kappa_ip=excluded.kappa_ip,
  self_revenue_yen_month=excluded.self_revenue_yen_month,
  self_revenue_note=excluded.self_revenue_note,unit_margin_positive=excluded.unit_margin_positive,
  use_case_left=excluded.use_case_left,note=excluded.note,evaluator=excluded.evaluator,
  assessed_at=excluded.assessed_at,free_cash_reason=excluded.free_cash_reason,
  burn_rate_yen_month=excluded.burn_rate_yen_month,burn_rate_reason=excluded.burn_rate_reason,
  rights_open_reason=excluded.rights_open_reason,under_contract_reason=excluded.under_contract_reason,
  kappa_ip_reason=excluded.kappa_ip_reason,sigma_reason=excluded.sigma_reason,
  evangelist_e_reason=excluded.evangelist_e_reason,unit_margin_reason=excluded.unit_margin_reason,
  incorporated_reason=excluded.incorporated_reason,conversion_c=excluded.conversion_c,
  conversion_c_reason=excluded.conversion_c_reason,quiet_months=excluded.quiet_months,
  quiet_months_reason=excluded.quiet_months_reason,funcs_f2=excluded.funcs_f2,
  funcs_f2_reason=excluded.funcs_f2_reason,funcs_f3=excluded.funcs_f3,
  funcs_f3_reason=excluded.funcs_f3_reason,funcs_f4=excluded.funcs_f4,
  funcs_f4_reason=excluded.funcs_f4_reason,funcs_f5=excluded.funcs_f5,
  funcs_f5_reason=excluded.funcs_f5_reason,funcs_f6=excluded.funcs_f6,
  funcs_f6_reason=excluded.funcs_f6_reason,funcs_f7=excluded.funcs_f7,
  funcs_f7_reason=excluded.funcs_f7_reason,burn_post_yen_month=excluded.burn_post_yen_month,
  burn_post_reason=excluded.burn_post_reason,updated_at=excluded.updated_at;

DO $verify$
BEGIN
  IF (SELECT count(*) FROM public.seed_bzm30_inputs i JOIN kute_bzm30_baseline b USING(seed_id)) <> 22 THEN
    RAISE EXCEPTION 'Expected 22 KUTE BZM input rows';
  END IF;
  IF (SELECT count(*) FROM public.seed_value_ceilings c JOIN kute_bzm30_baseline b USING(seed_id)) <> 22 THEN
    RAISE EXCEPTION 'Expected 22 KUTE ceiling rows';
  END IF;
  IF EXISTS (
    SELECT 1 FROM kute_bzm30_baseline b
    JOIN public.seed_bzm30_inputs i USING(seed_id)
    WHERE (i.process_type,i.reg_class,i.evidence_stage,i.incorporated,i.free_cash_yen,
           i.rights_open,i.under_contract,i.evangelist_e,i.kappa_ip,
           i.self_revenue_yen_month,i.unit_margin_positive,i.funcs_f2,
           i.funcs_f3,i.funcs_f4,i.funcs_f5,i.funcs_f6,i.funcs_f7)
      IS DISTINCT FROM
          (b.process_type,b.reg_class,b.evidence_stage,false,0::bigint,
           2,false,0.50::numeric,0.55::numeric,0::bigint,false,1::numeric,
           0::numeric,0::numeric,0::numeric,0::numeric,0::numeric)
  ) THEN
    RAISE EXCEPTION 'Stored KUTE BZM input values do not match the approved baseline';
  END IF;
END $verify$;

COMMIT;
