-- Stable institution-scoped seed numbers and AMD's unverified additional-research
-- hypotheses. The hypothesis is a proposal for market creation, not a confirmed
-- research result or a claim that a blue ocean already exists.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';
SELECT pg_advisory_xact_lock(hashtext('seed_numbers_and_market_creation_hypotheses_20260901'));

ALTER TABLE public.seeds
  ADD COLUMN IF NOT EXISTS seed_no integer,
  ADD COLUMN IF NOT EXISTS additional_research_hypothesis text;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'seeds_seed_no_positive'
      AND conrelid = 'public.seeds'::regclass
  ) THEN
    ALTER TABLE public.seeds
      ADD CONSTRAINT seeds_seed_no_positive CHECK (seed_no IS NULL OR seed_no > 0);
  END IF;
END $constraint$;

CREATE UNIQUE INDEX IF NOT EXISTS seeds_institution_seed_no_unique
  ON public.seeds (institution_id, seed_no)
  WHERE institution_id IS NOT NULL AND seed_no IS NOT NULL;

COMMENT ON COLUMN public.seeds.seed_no IS
  '研究機関内で固定するシーズ識別番号。表示順を変えても採番し直さない。';
COMMENT ON COLUMN public.seeds.additional_research_hypothesis IS
  'AMDが提案する追加研究・用途転換と検証条件。未検証の市場創出仮説であり、研究成果や市場成立の確定情報ではない。';

CREATE TEMP TABLE kute_seed_market_creation (
  seed_id uuid PRIMARY KEY,
  seed_no integer NOT NULL UNIQUE,
  title text NOT NULL,
  hypothesis text NOT NULL
) ON COMMIT DROP;

INSERT INTO kute_seed_market_creation VALUES
  ('4ff7e277-91bc-4627-9aee-249314c36258',1,'165〜220nm次世代クリーンUV面光源','最高出力競争ではなく、低温・面発光を生かした密閉流路内の薬剤レス表面処理へ寄せる。対象材1種で照射均一性、オゾン発生、材料劣化、連続寿命を測る。'),
  ('efc941cb-79cf-4f07-9d9e-26993b76d8a5',2,'DCD歩行解析・療育現場支援ツール','歩行判定だけでなく、療育介入前後の変化を定量化する反復評価へ寄せる。年齢別基準、家庭撮影の再現性、介入反応性を追跡する。'),
  ('d9a588b7-226c-45c2-a5bf-2f9f2ee0cf60',3,'バイオガスと飼料バイオマスを同時生産する資源循環技術','エネルギー回収単独でなく、地域固有の飼料不足と糞尿処理を同時に解く小規模循環ユニットへ寄せる。飼料安全性、栄養価、ガス収支、季節変動を実証する。'),
  ('a1390f71-3d7d-4bbc-9016-ca25bc901c34',4,'フレキシブル熱電発電・センサー電源プラットフォーム','低温ウェアラブル用途に加え、需要が強い200〜400℃の工場排熱・設備異常監視用の材料系を開発する。温度勾配下の出力、熱サイクル、接合耐久、無線センサー駆動を測る。'),
  ('ed2ba973-8df1-441a-8dd2-0bea2557674f',5,'ミスト法で形成する窒化銅薄膜と銅配線への展開','安価なフィルム上の使い切り物流タグ用銅配線へ寄せる。120℃以下での銅化、印刷パターニング、密着、湿熱・酸化耐性を測り、銀ペーストと比較する。'),
  ('29f57970-48b6-47ef-b950-b4ef1735f7ed',6,'低濃度CO2吸蔵・水素化を革新する多元機能触媒の設計開発','低濃度排ガス処理だけでなく、低炭素水素を持つ小規模工場のオンサイト原料ガス化へ寄せる。湿分・酸素共存、100回再生、水素・熱・炭素収支、生成ガス品質を測る。'),
  ('cc843bad-5e10-4473-8bf0-3de8ee60014c',7,'促進酸化水と表面修飾による低ファウリング分離膜','新品膜販売ではなく、食品・発酵工場の既設膜への後処理と洗浄停止時間削減へ寄せる。実排水、反復CIP、修飾層の溶出、膜保証、処理単価を検証する。'),
  ('bc5c18b7-39bd-4ad6-b2a1-eea20e2d1421',8,'医療機器設計向け力学特性データ基盤','一般データ販売ではなく、個別医療機器の設計初期に使う境界条件・材料モデルの認証可能なデータパックへ寄せる。測定標準、ロット差、解析再現性、設計変更への追随を検証する。'),
  ('64b7f789-c25c-4f51-b788-81fd8db4c294',9,'塩水・交流電気分解による都市鉱山金回収','高濃度スクラップではなく、めっき廃液などの低濃度・変動流から現場回収する小型セルへ寄せる。共存イオン選択性、電力、電極寿命、回収純度、薬剤削減を測る。'),
  ('e38fc67a-bb70-48a6-aadf-8889bf395b62',10,'室温・紫外線プロセスによる酸化物薄膜トランジスタ','低温単素子ではなく、曲面触覚センサーの多点読み出し回路へ寄せる。50℃以下、3ロット×100素子の歩留まり、曲げ・湿熱後特性、処理時間を測る。'),
  ('746ffb85-c309-4c2e-b229-11ebe7634e34',11,'常時微動による建物診断・防災点検シーズ','耐震診断の代替ではなく、施設群の変化監視と精密診断の優先順位付けへ寄せる。季節・交通差の補正、同一建物の長期基準、改修前後差、警報閾値を検証する。'),
  ('94c27c17-c397-4cb8-8b4b-eccfd38e967d',12,'打診反発音を使う外壁タイル接着状態の診断','自動判定装置ではなく、検査会社の見逃し防止と報告根拠生成へ寄せる。打撃者、騒音、材質差を含む20枚の盲検で、危険側の見逃し率と記録自動化を測る。'),
  ('4b81f8c9-8a42-4356-a50d-0a45d470f77f',13,'構造を調整できるポリ乳酸ヒドロゲル','動物由来成分を使わない規定組成オルガノイド培養材へ寄せる。残留溶媒、硬さ再現性、分解時pH、接着ペプチドを確認し、特定オルガノイド1種でMatrigelと比較する。'),
  ('ade7d86a-4f5a-4e83-9232-9ad4118e03fc',14,'液体金属を電気的に移動させる遮光・反射素子','可視照明ではなく、赤外カメラ校正時の非機械式光路切替へ寄せる。8〜14μmの透過・反射、気泡、封止、姿勢・振動、切替寿命を測り、赤外で不成立なら見送る。'),
  ('2b3a02e3-b2e9-464e-ab27-a431f5a993e7',15,'画像処理による近距離三次元計測','汎用ロボット視覚ではなく、組立直前5〜30cmの位置合わせへ寄せる。反射、黒色、低模様を含む50部品で誤差、処理時間、把持失敗率を測る。'),
  ('f8fddf69-7fe5-4fb2-b489-dc19bf68f7eb',16,'翼のひずみを利用する小型流速・対気速度センサー','航空用ではなく、粉じんダクトの後付け詰まり監視へ寄せる。低風速感度、温度・振動・付着による誤差の分離、自己診断、既存差圧計との保守費を比較する。'),
  ('e82958c3-d2ff-4591-b69c-c31749caa073',17,'耳周囲電極による装着負担の小さい脳波計測','一般睡眠計ではなく、在宅反復計測が必要な治験向け研究機器へ寄せる。自己再装着、夜間欠測、体動・筋電、皮膚負担を測り、標準EEGと同時計測する。'),
  ('5c837d5a-8716-4bfd-98e2-84e671f3ae19',18,'表面変形から内部ひずみを推定する部品余寿命・再利用診断','老朽タービンの余寿命診断から、補修・金属3Dプリント部品の出荷判定へ広げる。1合金1工程で残留ひずみと使用損傷を分離し、参照測定との盲検・POD比較を行う。'),
  ('fc966b38-8411-40bb-a91f-7cee9e4bd3a2',19,'金属フリー透明フレキシブル導電膜','透明電極一般ではなく、金属アレルギーや腐食環境向けの柔軟センサー電極へ寄せる。汗・塩水・屈曲・摩耗後の抵抗、透明性、封止を測り、ITO・銀ナノワイヤと比較する。'),
  ('da4dc964-226f-405b-86c3-a0439cc9f57d',20,'非貴金属錯体電極による亜酸化窒素の電解浄化','大型高温設備を置けない小規模・低濃度・間欠排出源向け電解モジュールへ寄せる。ガス拡散電極、酸素・水分・CO2共存、起動停止、除去電力、金属溶出を測る。'),
  ('1c823a52-7274-4028-8e64-fc7aabe81d83',21,'音響メタマテリアル・吸遮音部材シーズ','吸音材一般ではなく、通風を妨げない低周波HVACダクト用サイレンサーへ寄せる。圧力損失、狭帯域・広帯域、汚れ、温湿度を測り、既存消音器と容積・騒音を比較する。'),
  ('e73065f7-c30d-4260-96ca-86a19eb96918',22,'鳥類音響デバイス・音響体験シーズ','録音再生ではなく、鳥種・状況別に物理発声を可変制御して馴化を遅らせる防除デバイスへ寄せる。行動専門家と複数地点で反応持続、非対象種への影響、再現性、安全性を測る。');

DO $guard$
BEGIN
  IF (SELECT count(*) FROM kute_seed_market_creation) <> 22 THEN
    RAISE EXCEPTION 'Expected exactly 22 KUTE seed hypotheses';
  END IF;
  IF (SELECT count(*) FROM public.seeds WHERE institution_id = 'inst_kute') <> 22 THEN
    RAISE EXCEPTION 'Production KUTE seed count is not 22';
  END IF;
  IF EXISTS (
    SELECT 1 FROM kute_seed_market_creation k
    LEFT JOIN public.seeds s ON s.id = k.seed_id AND s.institution_id = 'inst_kute'
    WHERE s.id IS NULL OR s.title IS DISTINCT FROM k.title
  ) THEN
    RAISE EXCEPTION 'KUTE seed identity/title mismatch';
  END IF;
END $guard$;

UPDATE public.seeds s
SET seed_no = k.seed_no,
    additional_research_hypothesis = k.hypothesis,
    updated_at = now()
FROM kute_seed_market_creation k
WHERE s.id = k.seed_id;

DO $verify$
BEGIN
  IF (SELECT count(*) FROM public.seeds WHERE institution_id = 'inst_kute' AND seed_no IS NOT NULL) <> 22 THEN
    RAISE EXCEPTION 'Expected 22 numbered KUTE seeds';
  END IF;
  IF (SELECT count(DISTINCT seed_no) FROM public.seeds WHERE institution_id = 'inst_kute') <> 22 THEN
    RAISE EXCEPTION 'KUTE seed numbers are not unique';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.seeds
    WHERE institution_id = 'inst_kute'
      AND coalesce(btrim(additional_research_hypothesis), '') = ''
  ) THEN
    RAISE EXCEPTION 'A KUTE market-creation hypothesis is blank';
  END IF;
END $verify$;

COMMIT;
