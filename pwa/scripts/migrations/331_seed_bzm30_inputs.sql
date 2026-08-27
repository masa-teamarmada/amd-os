-- BZM 3.0（産業創出価値 V）の案件ごとの入力を OS に持たせる。
--
-- まさ 2026-08-27「こんなの、それぞれのPJについてひとつずつネットで調べるだけじゃないの？
-- それをやるだけで算出できるなら、そこで止まってる理由が分からないんだけど。
-- せめてPJ化されてるものだけでもその数字入れてよ。」
--
-- モデルページ §5.3（改訂 M1・M3）と §6.A-3・§6.I-9-3 が要求する案件ごとの入力を3つに分ける。
--   1. seed_value_ceilings … 用途ごとの天井 P̄_u（国内の年額の付加価値）と置き換え分 δ_u
--   2. seed_bzm30_inputs   … 工程の型 × 規制属性、評価日の証拠水準、観測状態、案件パラメータ
--   3. seed_bzm30_scores   … 前向き計算の結果（append-only）
--
-- 用途は「市場が別かどうか」で切る（model/cases/README.md の規約 M1）。原料や作り方が違っても
-- 売り先の市場が同じなら同じ用途にする——同じ市場を二つの用途として立てると、価値の式が同じ天井を二回数える。

-- ─────────────────────────────────────────── 1. 用途ごとの天井

CREATE TABLE IF NOT EXISTS seed_value_ceilings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_id UUID NOT NULL REFERENCES seeds(id) ON DELETE CASCADE,
  -- 用途の名前。市場が別かどうかで切る
  use_case TEXT NOT NULL,
  -- 売上ベースの国内の年額（円）。付加価値へ直す前の値を必ず残す
  market_sales_yen BIGINT,
  -- その市場規模が何年の値か
  market_year INT,
  -- 付加価値率。売上ベース → 付加価値。全件 0.35 の暫定値（根拠レベル C。産業連関表の該当部門から引き直すのが宿題）
  value_added_rate NUMERIC,
  -- 天井 P̄_u（国内の年額の付加価値・円）。調査が要る用途は NULL のまま置き、note に理由を書く
  ceiling_yen BIGINT,
  -- 置き換え分 δ_u（国内の既存事業から奪う分・年額・円）。国内に既存産業がある市場へ入るときに立つ
  displacement_yen BIGINT NOT NULL DEFAULT 0,
  -- 主たる用途か。複数用途のうち、いま計算の中心に置くもの
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  note TEXT,
  evaluator TEXT,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (seed_id, use_case)
);

CREATE INDEX IF NOT EXISTS idx_seed_value_ceilings_seed ON seed_value_ceilings(seed_id);

-- ─────────────────────────────────────────── 2. 分類と観測状態

CREATE TABLE IF NOT EXISTS seed_bzm30_inputs (
  seed_id UUID PRIMARY KEY REFERENCES seeds(id) ON DELETE CASCADE,
  -- 工程の型（§6.A-3）。作るものの物理で決める
  process_type TEXT CHECK (process_type IN ('F1', 'F2', 'F3', 'F4')),
  -- 規制属性（§6.A-3）。工程の型と直交する
  reg_class TEXT CHECK (reg_class IN ('REG0', 'REG1', 'REG2')),
  -- 型・規制の判定の確からしさ。'confirmed' = 個別に確認した / 'provisional' = 分野からの推定
  classification_confidence TEXT CHECK (classification_confidence IN ('confirmed', 'provisional')),
  classification_reason TEXT,
  -- 評価日の証拠水準（0〜6。§6.I-1-4）。NULL は Tier 0 既定（段階0）
  evidence_stage INT CHECK (evidence_stage BETWEEN 0 AND 6),
  evidence_stage_reason TEXT,
  -- 観測状態（§5.2）。NULL は Tier 0 既定
  incorporated BOOLEAN,
  free_cash_yen BIGINT,
  free_cash_as_of DATE,
  rights_open INT CHECK (rights_open BETWEEN 0 AND 2),
  under_contract BOOLEAN,
  -- 案件パラメータのうち、案件ごとに置ける成分（§5.3）
  sigma INT CHECK (sigma IN (-1, 0, 1)),
  evangelist_e NUMERIC CHECK (evangelist_e BETWEEN 0 AND 1),
  kappa_ip NUMERIC CHECK (kappa_ip BETWEEN 0 AND 1),
  -- 自走力の実額（円／月）。改訂 M3。その案件が実際に何を受託するのかを書いたうえで置く
  self_revenue_yen_month BIGINT,
  self_revenue_note TEXT,
  -- 単位採算が黒字で立つ用途が一つでもあるか（経済性の乗数 m_θ に効く）
  unit_margin_positive BOOLEAN,
  -- 未着手の用途がどれだけ残るか（0〜1）。撤退の四経路の①用途転換に効く
  use_case_left NUMERIC CHECK (use_case_left BETWEEN 0 AND 1),
  note TEXT,
  evaluator TEXT,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────── 3. 計算結果

CREATE TABLE IF NOT EXISTS seed_bzm30_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_id UUID NOT NULL REFERENCES seeds(id) ON DELETE CASCADE,
  -- どの版のモデル・どの承認で計算したか
  model_version TEXT NOT NULL,
  approval_ref TEXT NOT NULL,
  -- 天井を1に正規化した現在価値（無次元）。10%点・中央・90%点
  v_lower NUMERIC NOT NULL,
  v_median NUMERIC NOT NULL,
  v_upper NUMERIC NOT NULL,
  -- 天井を掛けた金額（円）。天井が未調査なら NULL
  score_lower_yen BIGINT,
  score_median_yen BIGINT,
  score_upper_yen BIGINT,
  -- 計算に使った天井の合計（円／年）。Σ_u (P̄_u − δ_u)
  ceiling_total_yen BIGINT,
  -- 導出量（§5.8）
  p_reach_m4 NUMERIC,
  months_to_m4 NUMERIC,
  continuation_ratio NUMERIC,
  outcome JSONB,
  -- 計算に使った入力の写し（再現のため）
  inputs JSONB,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seed_bzm30_scores_seed ON seed_bzm30_scores(seed_id, computed_at DESC);

-- ─────────────────────────────────────────── RLS（seeds と同じ規律）

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['seed_value_ceilings', 'seed_bzm30_inputs', 'seed_bzm30_scores']
  LOOP
    EXECUTE format('alter table %I enable row level security', t);
    EXECUTE format('drop policy if exists %I on %I', t || '_member_read', t);
    EXECUTE format('drop policy if exists %I on %I', t || '_admin_all', t);
    EXECUTE format('drop policy if exists %I on %I', t || '_service_role', t);
    EXECUTE format('create policy %I on %I for select to authenticated using (amd_os_is_member())', t || '_member_read', t);
    EXECUTE format('create policy %I on %I for all to authenticated using (is_admin()) with check (is_admin())', t || '_admin_all', t);
    EXECUTE format('create policy %I on %I for all to service_role using (true) with check (true)', t || '_service_role', t);
  END LOOP;
END $$;
INSERT INTO seed_value_ceilings (seed_id, use_case, market_sales_yen, market_year, value_added_rate, ceiling_yen, displacement_yen, is_primary, source, confidence, note, evaluator) VALUES
  ('00bb86dd-e1e3-9a69-4861-280b04424273', 'CO2の分離回収', 140000000000, 2030, 0.35, 49000000000, 0, true, '資源エネルギー庁 CCS 2030年 2,340億円のうち分離回収工程を6割と置いた', 'medium', '分離回収がCCSのコストの大半を占めるという通説から6割と置いた。内訳の出典が要る', 'amie'),
  ('01f2dfcb-5ed8-83e7-c560-1be48459c7fa', '虚血性脳卒中の急性期治療', 88500000000, 2035, 0.35, 31000000000, 0, true, '世界市場 56億ドル × 日本比率10%（暫定）', 'low', '日本比率10%は暫定。国内の患者数と薬価から積み直すのが宿題', 'amie'),
  ('091afcac-a7c8-1b04-1690-2af19ea85a2f', '窓の熱線遮蔽フィルム', 114000000000, 2030, 0.35, 39900000000, 0, true, '世界の窓用フィルム 2030年 252.5億ドル × 日本10% × 遮熱用途3割（暫定）', 'low', '遮熱用途の比率3割は暫定', 'amie'),
  ('091afcac-a7c8-1b04-1690-2af19ea85a2f', '建材一体型太陽光（透明型）', 57000000000, 2030, 0.35, 19900000000, 0, false, '世界のBIPV 2030年 383.3億ドル × 日本10% × 透明型1割（暫定）', 'low', '透明型の比率1割は暫定。東京都の新築住宅への設置義務化が効く分は織り込んでいない', 'amie'),
  ('24c43617-8c3a-5b10-95e3-5fa16e4718fb', '塩分濃度差発電', null, null, null, null, 0, true, null, null, '天井を保留。国内は福岡市の実証（110kW・年88万kWh）のみで、海水淡水化センターに併設する形なので設置できる場所に上限がある。国内の淡水化プラント数から積み上げる調査が要る', 'amie'),
  ('25f814a6-c151-098e-651f-6f23288fd829', '水素液化設備', 40000000000, 2030, 0.35, 14000000000, 0, true, '世界の水素液化設備 2025年 26.1億ドル × 日本10%（暫定）', 'low', '国内の水素関連市場 3,963億円（富士経済・2030年度）の内数。液化工程がそのうちどれだけを占めるかが未確定', 'amie'),
  ('2d289848-9278-b741-3437-5856d8dce6ff', 'リチウムイオン電池のシリコン負極', 171000000000, 2030, 0.35, 59800000000, 0, true, '世界のLiB負極 2030年 761.5億ドル × 日本10% × シリコン負極比率15%（暫定）', 'low', 'シリコン負極比率15%は暫定。黒鉛が主流の市場でどこまで置き換わるかが未確定', 'amie'),
  ('39585700-88a6-70f1-8e6a-fccb03641204', '高性能断熱建材', 19000000000, 2025, 0.35, 6600000000, 0, true, '矢野経済研究所 住宅用断熱建材 2025年度 1,897億円の1割（暫定）', 'low', 'エアロゲルが入りうる高性能領域を1割と置いた。産業用断熱は別の用途として立て直す必要がある', 'amie'),
  ('3c5cdae2-cd9a-6c4c-b7e1-c381df4e1343', '農業用ロボット', 138000000000, 2030, 0.35, 48300000000, 0, true, 'Report Ocean 日本の農業ロボット市場 2033年 14.4億ドルを CAGR16.1% で2030年へ逆算', 'medium', 'スマート農業のセンサ（VasculaX）とは売り先の市場が別なので、別の用途として立てている', 'amie'),
  ('3c6c774d-4f8e-4d99-aa00-f149a75f98d5', 'ナトリウムイオン電池の材料', 9000000000, 2030, 0.35, 3200000000, 0, true, '世界のナトリウムイオン電池 2030年 20億ドル × 日本10% × 材料比率3割（暫定）', 'low', '市場そのものがまだ小さい。リチウムの価格高騰が続けば大きく動く', 'amie'),
  ('50fffaf7-8ab4-77fb-41c6-0e44d4ff890a', '国内のリチウム化合物供給', 163000000000, 2030, 0.35, 57000000000, 0, true, '経済産業省 蓄電池産業戦略（150GWh に年10万トン）× 炭酸リチウム価格', 'high', '国内に製造がほぼ無く8割が中国からの輸入なので、既存事業から奪う分がなく市場がそのまま国内の純増になる', 'amie'),
  ('5a1f4784-414f-47e4-d716-4988aee6cd40', '動画制作', 540000000000, 2027, null, null, 0, true, '按分による推定（5,400億円）', 'low', '天井を保留。置き換え型。純増は制作コストの削減分と、これまで費用が見合わず作られなかった動画が作られるようになる分', 'amie'),
  ('6c1ced6c-33b0-130b-4ced-99c79fc68243', '量子コンピュータ', 1129100000000, 2035, 0.35, 395200000000, 0, true, 'Report Ocean（国内 1兆1,291億円／2035年）', 'medium', '内閣府CSTP の量子技術 国内付加価値 1.2兆円（2030年）の内数として整合する', 'amie'),
  ('8050097b-1d38-3a3b-c877-49f30794312c', '銅ペーストによる導電材料', 225000000000, 2026, 0.35, 78700000000, 39350000000, true, '世界の導電性銀ペースト 2026年 150億ドル × 日本10%', 'low', '銀の置き換えなので置き換え分を天井の5割と置いた（暫定）。銀は輸入なので輸入代替の分は純増に残るが、国内の銀ペースト事業の売上は置き換わる。この線引きの精査が要る', 'amie'),
  ('8b2ec717-027c-4cb5-9760-190ccf30f71a', 'スマート農業のセンサ', 78800000000, 2030, 0.35, 27600000000, 0, true, '矢野経済研究所（2030年度 788億円）', 'medium', 'スマート農業市場全体。センサに絞ると小さくなる可能性がある', 'amie'),
  ('9a077ec6-79b7-051b-7a2e-b47401511cf0', '陸上の風力発電設備', 113800000000, 2035, 0.35, 39800000000, 0, true, '富士経済（2035年度 新設6,778億円のうち洋上5,640億円を除く）', 'medium', '洋上は別の市場なので除いた', 'amie'),
  ('a1390f71-3d7d-4bbc-9016-ca25bc901c34', 'IoTセンサー電源の熱電モジュール', 50000000000, 2035, 0.35, 17500000000, 0, true, '日本熱電学会の試算（独立電源シェア5%で2.5兆円）は将来像なので採らず、2035年の国内を500億円と保守的に置いた', 'low', '1兆個のセンサーという前提が実現するかで桁が変わる。保守側に置いている', 'amie'),
  ('b7ece08e-24c9-fd7c-c841-8f37aab8673f', '波力発電設備', 50000000000, 2035, 0.35, 17500000000, 0, true, '世界の波力・潮力 2032年 298億ドル。日本は実証段階なので2035年の国内を500億円と保守的に置いた', 'low', 'NEDO の実証段階で、国内の導入目標が数字で置かれていない', 'amie'),
  ('bebf442f-fa5b-cdc9-de31-0d3fdf3e140d', 'SiC/SiC セラミックス基複合材', 59400000000, 2025, 0.35, 20800000000, 0, true, '世界市場 68.1億ドル × SiC/SiC 55.2% × 日本10%（暫定）', 'low', '世界市場からの按分なので確度は低い。用途が航空機なら市場も規制も変わる', 'amie'),
  ('eeba1bfd-6020-225f-af8b-ed7717fc134e', '小型分散型の廃棄物処理装置', 10000000000, 2030, 0.35, 3500000000, 0, true, '産業廃棄物処理の国内市場 約5兆円のうち装置の更新・新設を年2%、小型分散型を1割と置いた', 'low', '装置市場の直接の統計が見つからなかったので積み上げで置いた。離島・遠隔地向けという狙いから市場は小さめ', 'amie'),
  ('f18b5a65-9bed-ade4-7ed7-59d3d08ab86a', '空間伝送型ワイヤレス給電', 442700000000, 2036, 0.35, 154900000000, 0, true, '総務省（2030年 1,685億円 → 2040年 8,418億円を対数補間した2036年値）', 'medium', '量産到達の時期に対応する年の市場を採る規約に従い2036年を採った', 'amie'),
  ('f4f4e30e-35ff-4c95-b9b0-f5629237b28e', '産業排水の処理', 189000000000, 2030, null, null, 0, true, '按分による推定（1,890億円）', 'low', '天井を保留。国内に既存の産業（栗田工業ほか）がある置き換え型なので、市場の大きさをそのまま天井に置くと純増を大きく見誤る。純増は薬剤が要らなくなること・CO2を固定すること・汚泥の減量・副産物が売れることの差分だが、薬剤費の消滅は国内の薬剤産業の売上の消滅でもある。この線引きがまさの判断待ち', 'amie')
ON CONFLICT (seed_id, use_case) DO NOTHING;

INSERT INTO seed_bzm30_inputs (seed_id, process_type, reg_class, classification_confidence, classification_reason, evidence_stage, evidence_stage_reason, incorporated, free_cash_yen, free_cash_as_of, rights_open, under_contract, sigma, evangelist_e, kappa_ip, self_revenue_yen_month, self_revenue_note, unit_margin_positive, use_case_left, note, evaluator) VALUES
  ('00bb86dd-e1e3-9a69-4861-280b04424273', 'F1', 'REG0', 'provisional', 'PDMS 膜の製造。素材のプロセス型', null, '現在地が未入力', true, null, null, null, null, null, null, null, null, null, null, 0, null, 'amie'),
  ('01f2dfcb-5ed8-83e7-c560-1be48459c7fa', 'F1', 'REG2', 'confirmed', '医薬品。承認審査が律速。製造はバイオ生産', 2, '治験に入る前。再現性の確認まで', true, null, null, null, null, null, null, null, null, null, null, 0, null, 'amie'),
  ('091afcac-a7c8-1b04-1690-2af19ea85a2f', 'F1', 'REG0', 'provisional', '薄膜・光学材料のプロセス型。透明太陽電池も熱線遮蔽材も、成膜の均一性と面積のスケールが難所', null, '現在地が未入力', true, null, null, null, null, null, null, null, null, null, null, 0.5, null, 'amie'),
  ('24c43617-8c3a-5b10-95e3-5fa16e4718fb', 'F2', 'REG1', 'provisional', '膜と発電機の組立。系統連系の規格が要る', null, '現在地が未入力', true, null, null, null, null, null, null, null, null, null, null, 0, null, 'amie'),
  ('25f814a6-c151-098e-651f-6f23288fd829', 'F2', 'REG0', 'confirmed', '装置。部品統合と歩留まりが難所', null, '現在地が未入力', false, null, null, null, null, null, null, null, null, null, null, 0, null, 'amie'),
  ('2d289848-9278-b741-3437-5856d8dce6ff', 'F1', 'REG0', 'provisional', '負極材の製造。素材のプロセス型', null, '現在地が未入力', true, null, null, null, null, null, null, null, null, null, null, 0, null, 'amie'),
  ('39585700-88a6-70f1-8e6a-fccb03641204', 'F1', 'REG0', 'provisional', 'エアロゲルの製造。素材のプロセス型で、乾燥工程のスケールが難所', null, '現在地が未入力', true, null, null, null, null, null, null, null, null, null, null, 0, null, 'amie'),
  ('3c5cdae2-cd9a-6c4c-b7e1-c381df4e1343', 'F2', 'REG0', 'provisional', '機構と制御の組立。農業用ロボットに事前承認は要らない', null, '現在地が未入力', true, null, null, null, null, null, null, null, null, null, null, 0, null, 'amie'),
  ('3c6c774d-4f8e-4d99-aa00-f149a75f98d5', 'F1', 'REG0', 'provisional', 'ゼオライトを基盤にした電池材料。素材のプロセス型', null, '現在地が未入力', false, null, null, null, null, null, null, null, null, null, null, 0, null, 'amie'),
  ('50fffaf7-8ab4-77fb-41c6-0e44d4ff890a', 'F1', 'REG0', 'confirmed', '電気化学プロセスと膜。化学プロセスとプラントで、リチウム化合物の製造に事前承認は要らない', 3, '実証段階', true, 150000000, '2026-08-01', null, null, null, null, null, null, null, null, 0, null, 'amie'),
  ('5a1f4784-414f-47e4-d716-4988aee6cd40', 'F3', 'REG0', 'confirmed', 'ソフトウェア。技術ゲートより市場ゲートが律速', null, '現在地が未入力', true, null, null, null, null, null, null, null, null, null, null, 0, null, 'amie'),
  ('6c1ced6c-33b0-130b-4ced-99c79fc68243', 'F2', 'REG0', 'confirmed', '光学部品の統合と歩留まりが難所の装置。量子コンピュータに監督官庁の事前承認は要らない', 3, '2026年7月に実証機が産総研で稼働。実環境・実規模の検証にあたる。商用機の公開は2026年4月予定でまだ有償PoCの完了に達していない', true, 7000000000, '2026-08-01', null, null, null, null, null, null, null, null, 0, null, 'amie'),
  ('8050097b-1d38-3a3b-c877-49f30794312c', 'F1', 'REG0', 'provisional', 'ペーストの調製。化学プロセスで、粒径分布と焼成条件のスケールが難所', null, '現在地が未入力', true, null, null, null, null, null, null, null, null, null, null, 0, null, 'amie'),
  ('8b2ec717-027c-4cb5-9760-190ccf30f71a', 'F2', 'REG0', 'provisional', '半導体センサ。農業用途に事前承認は不要', null, '現在地が未入力', false, null, null, null, null, null, null, null, null, null, null, 0, null, 'amie'),
  ('9a077ec6-79b7-051b-7a2e-b47401511cf0', 'F2', 'REG1', 'confirmed', '装置。風力発電設備の型式認証・系統連系の規格が要る', 4, 'TRL8 / BRL8。9件のうち最も実用に近く、対価を伴う検証の実績がある', true, null, null, null, null, null, null, null, null, null, null, 0, null, 'amie'),
  ('a1390f71-3d7d-4bbc-9016-ca25bc901c34', 'F2', 'REG0', 'provisional', 'フレキシブル熱電モジュール。素材とデバイスの統合で、組立・デバイス型に置いた', null, '現在地が未入力', false, null, null, null, null, null, null, null, null, null, null, 0, null, 'amie'),
  ('b7ece08e-24c9-fd7c-c841-8f37aab8673f', 'F2', 'REG1', 'provisional', '発電装置。系統連系の規格と、海域の占用許可が要る', null, '現在地が未入力', true, null, null, null, null, null, null, null, null, null, null, 0, null, 'amie'),
  ('bebf442f-fa5b-cdc9-de31-0d3fdf3e140d', 'F1', 'REG1', 'provisional', '素材のプロセス型。用途が航空機なら耐空証明で REG-2 まで上がる（用途の確定待ち）', null, '現在地が未入力', false, null, null, null, null, null, null, null, null, null, null, 0, null, 'amie'),
  ('eeba1bfd-6020-225f-af8b-ed7717fc134e', 'F2', 'REG2', 'provisional', '装置。ただし廃棄物処理施設は廃棄物処理法で都道府県知事の設置許可が要るため、監督官庁の承認が律速する側に置いた。小型で許可不要の規模に収まるなら REG-0 へ下がる', null, '現在地が未入力', true, null, null, null, null, null, null, null, null, null, null, 0, null, 'amie'),
  ('f18b5a65-9bed-ade4-7ed7-59d3d08ab86a', 'F2', 'REG1', 'provisional', '半導体デバイス。無線設備なので電波法の技術基準適合証明が要る', null, '現在地が未入力。先頭のゲートから計算している', true, null, null, null, null, null, null, null, null, null, null, 0, null, 'amie'),
  ('f4f4e30e-35ff-4c95-b9b0-f5629237b28e', 'F1', 'REG0', 'confirmed', '生物プロセスとプラント。排水処理装置に型式認定の制度は無く、水質汚濁防止法が課すのは特定施設の設置の届出（60日前）と排水基準への適合であって監督官庁の事前承認ではない', null, '現在地が未入力', false, null, null, null, null, null, null, null, null, null, null, 0, null, 'amie')
ON CONFLICT (seed_id) DO NOTHING;

