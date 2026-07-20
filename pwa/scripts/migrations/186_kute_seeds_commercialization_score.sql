-- 186_kute_seeds_commercialization_score.sql
-- KUTE (p25, 工学院大学) PJ cockpit 向けの seeds 拡張。
-- 既存 seeds テーブルに、事業化タイプ・100点スコア内訳・KUTE公開向けの想定用途/顧客/障壁/知財/次の検証ステップ列を追加する。
-- 単一の source of truth (seeds) に列を足すだけで、別テーブルへの複製はしない。
-- 設計: pwa/design/seeds.md, pwa/manual/2-3-pj-cockpit.md

BEGIN;

-- 事業化タイプ (主 + 副、複数可)
ALTER TABLE seeds ADD COLUMN IF NOT EXISTS primary_commercialization_type text NULL;
ALTER TABLE seeds ADD COLUMN IF NOT EXISTS secondary_commercialization_types text[] NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'seeds_primary_commercialization_type_check'
      AND conrelid = 'public.seeds'::regclass
  ) THEN
    ALTER TABLE seeds
      ADD CONSTRAINT seeds_primary_commercialization_type_check
      CHECK (
        primary_commercialization_type IS NULL
        OR primary_commercialization_type IN ('large_startup', 'small_business_1b_yen', 'license', 'jv_ma', 'joint_research_poc')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'seeds_secondary_commercialization_types_check'
      AND conrelid = 'public.seeds'::regclass
  ) THEN
    ALTER TABLE seeds
      ADD CONSTRAINT seeds_secondary_commercialization_types_check
      CHECK (
        secondary_commercialization_types IS NULL
        OR secondary_commercialization_types <@ ARRAY['large_startup', 'small_business_1b_yen', 'license', 'jv_ma', 'joint_research_poc']::text[]
      );
  END IF;
END $$;

COMMENT ON COLUMN seeds.primary_commercialization_type IS 'KUTE等の事業化面談向け主タイプ: large_startup/small_business_1b_yen/license/jv_ma/joint_research_poc の1つ。未確定は NULL';
COMMENT ON COLUMN seeds.secondary_commercialization_types IS 'primary_commercialization_type と同じ enum の副タイプ配列。複数可、未確定は NULL';

-- KUTE 公開面向け項目 (internal_notes / source_detail とは別。ここに書く内容はそのまま研究機関に見せてよい前提)
ALTER TABLE seeds ADD COLUMN IF NOT EXISTS kute_envisioned_use_case text NULL;
ALTER TABLE seeds ADD COLUMN IF NOT EXISTS kute_first_customer_candidate text NULL;
ALTER TABLE seeds ADD COLUMN IF NOT EXISTS kute_market_size_range text NULL;
ALTER TABLE seeds ADD COLUMN IF NOT EXISTS kute_market_size_confidence text NULL;
ALTER TABLE seeds ADD COLUMN IF NOT EXISTS kute_biggest_bottleneck text NULL;
ALTER TABLE seeds ADD COLUMN IF NOT EXISTS kute_ip_status text NULL;
ALTER TABLE seeds ADD COLUMN IF NOT EXISTS kute_next_verification_step text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'seeds_kute_market_size_confidence_check'
      AND conrelid = 'public.seeds'::regclass
  ) THEN
    ALTER TABLE seeds
      ADD CONSTRAINT seeds_kute_market_size_confidence_check
      CHECK (kute_market_size_confidence IS NULL OR kute_market_size_confidence IN ('low', 'medium', 'high'));
  END IF;
END $$;

COMMENT ON COLUMN seeds.kute_envisioned_use_case IS 'KUTE公開面向け: 想定用途。未確定は NULL (捏造禁止)';
COMMENT ON COLUMN seeds.kute_first_customer_candidate IS 'KUTE公開面向け: 最初の顧客/連携先候補。未確定は NULL';
COMMENT ON COLUMN seeds.kute_market_size_range IS 'KUTE公開面向け: 市場規模レンジ (自由記述レンジ表現)。根拠がない間は NULL';
COMMENT ON COLUMN seeds.kute_market_size_confidence IS 'kute_market_size_range の確度: low/medium/high。根拠がない間は NULL';
COMMENT ON COLUMN seeds.kute_biggest_bottleneck IS 'KUTE公開面向け: 事業化上の最大のボトルネック';
COMMENT ON COLUMN seeds.kute_ip_status IS 'KUTE公開面向け: 知財状況の要約';
COMMENT ON COLUMN seeds.kute_next_verification_step IS 'KUTE公開面向け: 次の検証ステップ (next_action とは別。外部に見せてよい表現のみ)';

-- 100点スコア内訳 (future 60 = need/market/technical_advantage/ip_barrier 各15、current 30 = trl/brl/hrl 各10、kute_support 10)
-- 全列 NULL 許容。根拠のない値は NULL のまま (捏造禁止)。amd_rating からの変換もしない。
ALTER TABLE seeds ADD COLUMN IF NOT EXISTS kute_score_future_need smallint NULL;
ALTER TABLE seeds ADD COLUMN IF NOT EXISTS kute_score_future_market smallint NULL;
ALTER TABLE seeds ADD COLUMN IF NOT EXISTS kute_score_future_technical_advantage smallint NULL;
ALTER TABLE seeds ADD COLUMN IF NOT EXISTS kute_score_future_ip_barrier smallint NULL;
ALTER TABLE seeds ADD COLUMN IF NOT EXISTS kute_score_current_trl smallint NULL;
ALTER TABLE seeds ADD COLUMN IF NOT EXISTS kute_score_current_brl smallint NULL;
ALTER TABLE seeds ADD COLUMN IF NOT EXISTS kute_score_current_hrl smallint NULL;
ALTER TABLE seeds ADD COLUMN IF NOT EXISTS kute_score_support smallint NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seeds_kute_score_future_need_check' AND conrelid = 'public.seeds'::regclass) THEN
    ALTER TABLE seeds ADD CONSTRAINT seeds_kute_score_future_need_check CHECK (kute_score_future_need IS NULL OR kute_score_future_need BETWEEN 0 AND 15);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seeds_kute_score_future_market_check' AND conrelid = 'public.seeds'::regclass) THEN
    ALTER TABLE seeds ADD CONSTRAINT seeds_kute_score_future_market_check CHECK (kute_score_future_market IS NULL OR kute_score_future_market BETWEEN 0 AND 15);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seeds_kute_score_future_technical_advantage_check' AND conrelid = 'public.seeds'::regclass) THEN
    ALTER TABLE seeds ADD CONSTRAINT seeds_kute_score_future_technical_advantage_check CHECK (kute_score_future_technical_advantage IS NULL OR kute_score_future_technical_advantage BETWEEN 0 AND 15);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seeds_kute_score_future_ip_barrier_check' AND conrelid = 'public.seeds'::regclass) THEN
    ALTER TABLE seeds ADD CONSTRAINT seeds_kute_score_future_ip_barrier_check CHECK (kute_score_future_ip_barrier IS NULL OR kute_score_future_ip_barrier BETWEEN 0 AND 15);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seeds_kute_score_current_trl_check' AND conrelid = 'public.seeds'::regclass) THEN
    ALTER TABLE seeds ADD CONSTRAINT seeds_kute_score_current_trl_check CHECK (kute_score_current_trl IS NULL OR kute_score_current_trl BETWEEN 0 AND 10);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seeds_kute_score_current_brl_check' AND conrelid = 'public.seeds'::regclass) THEN
    ALTER TABLE seeds ADD CONSTRAINT seeds_kute_score_current_brl_check CHECK (kute_score_current_brl IS NULL OR kute_score_current_brl BETWEEN 0 AND 10);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seeds_kute_score_current_hrl_check' AND conrelid = 'public.seeds'::regclass) THEN
    ALTER TABLE seeds ADD CONSTRAINT seeds_kute_score_current_hrl_check CHECK (kute_score_current_hrl IS NULL OR kute_score_current_hrl BETWEEN 0 AND 10);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seeds_kute_score_support_check' AND conrelid = 'public.seeds'::regclass) THEN
    ALTER TABLE seeds ADD CONSTRAINT seeds_kute_score_support_check CHECK (kute_score_support IS NULL OR kute_score_support BETWEEN 0 AND 10);
  END IF;
END $$;

COMMENT ON COLUMN seeds.kute_score_future_need IS '100点スコア future 群 (need, 0-15)。根拠のない間は NULL';
COMMENT ON COLUMN seeds.kute_score_future_market IS '100点スコア future 群 (market, 0-15)。根拠のない間は NULL';
COMMENT ON COLUMN seeds.kute_score_future_technical_advantage IS '100点スコア future 群 (technical_advantage, 0-15)。根拠のない間は NULL';
COMMENT ON COLUMN seeds.kute_score_future_ip_barrier IS '100点スコア future 群 (ip_barrier, 0-15)。根拠のない間は NULL';
COMMENT ON COLUMN seeds.kute_score_current_trl IS '100点スコア current 群 (trl, 0-10)。既存 trl (0-9生値) とは別の得点化列。根拠のない間は NULL';
COMMENT ON COLUMN seeds.kute_score_current_brl IS '100点スコア current 群 (brl, 0-10)。既存 brl (0-9生値) とは別の得点化列。根拠のない間は NULL';
COMMENT ON COLUMN seeds.kute_score_current_hrl IS '100点スコア current 群 (hrl, 0-10)。既存 hrl (0-9生値) とは別の得点化列。根拠のない間は NULL';
COMMENT ON COLUMN seeds.kute_score_support IS '100点スコア kute_support 群 (0-10)。根拠のない間は NULL';

-- 公開安全なバックフィル (工学院大学 6シーズのみ。まさ確定の一次情報のみ、それ以外は NULL のまま)
-- 桑折先生: フレキシブル熱電発電・センサー電源プラットフォーム
UPDATE seeds SET
  primary_commercialization_type = 'joint_research_poc',
  secondary_commercialization_types = ARRAY['license', 'small_business_1b_yen'],
  kute_envisioned_use_case = 'ファクトリー/FA・予兆保全・防災IoT等での自己給電センサー電源としての活用',
  kute_biggest_bottleneck = '初期の実証フィールド (最初の顧客) が未確定、要求される出力・耐久性の実証、知財の整理',
  kute_ip_status = 'PCT出願の優先権主張期限は経過。国内の周辺特許出願を検討中',
  kute_next_verification_step = '用途候補・PoC要件・知財整理の方針を確定する'
WHERE id = 'a1390f71-3d7d-4bbc-9016-ca25bc901c34' AND org_name = '工学院大学';

-- 須賀先生: 医療機器設計向け力学特性データ基盤
UPDATE seeds SET
  primary_commercialization_type = 'joint_research_poc',
  secondary_commercialization_types = ARRAY['license', 'small_business_1b_yen'],
  kute_envisioned_use_case = '医療機器設計向けの組織力学特性データの提供',
  kute_first_customer_candidate = '医療機器メーカー (臨床データの連携先は医療機関)',
  kute_biggest_bottleneck = '検体・倫理審査・契約、データ権利の整理、対象疾患/機器の絞り込み',
  kute_ip_status = '測定手法・データ生成・標準化が権利化候補だが未確定',
  kute_next_verification_step = '対象疾患・対象機器・検体入手経路・契約形態を絞り込む'
WHERE id = 'bc5c18b7-39bd-4ad6-b2a1-eea20e2d1421' AND org_name = '工学院大学';

-- 齊藤先生: DCD歩行解析・療育現場支援ツール
UPDATE seeds SET
  primary_commercialization_type = 'joint_research_poc',
  secondary_commercialization_types = ARRAY['small_business_1b_yen', 'license'],
  kute_envisioned_use_case = 'DCD (発達性協調運動症) の療育現場でのモニタリング支援 (診断用途ではない)',
  kute_biggest_bottleneck = '検証データ、対象年齢範囲、規制上の位置づけ、支払者、同意取得の整理',
  kute_next_verification_step = '小規模PoCを設計する'
WHERE id = 'efc941cb-79cf-4f07-9d9e-26993b76d8a5' AND org_name = '工学院大学';

-- 高橋先生 (Crow Whistle): 鳥類音響デバイス・音響体験シーズ
UPDATE seeds SET
  primary_commercialization_type = 'small_business_1b_yen',
  secondary_commercialization_types = ARRAY['joint_research_poc'],
  kute_envisioned_use_case = '教育・展示・趣味・研究用途の候補',
  kute_biggest_bottleneck = '録音再生に対する優位性の証明',
  kute_ip_status = '出願前',
  kute_next_verification_step = '比較検証を行う'
WHERE id = 'e73065f7-c30d-4260-96ca-86a19eb96918' AND org_name = '工学院大学';

-- 高橋先生: 常時微動による建物診断・防災点検シーズ (既存 summary/next_action のスコープのみ、それ以外は未確定)
UPDATE seeds SET
  primary_commercialization_type = 'joint_research_poc'
WHERE id = '746ffb85-c309-4c2e-b229-11ebe7634e34' AND org_name = '工学院大学';

-- 高橋先生: 音響メタマテリアル・吸遮音部材シーズ (既存 summary/next_action のスコープのみ、それ以外は未確定)
UPDATE seeds SET
  primary_commercialization_type = 'license',
  secondary_commercialization_types = ARRAY['joint_research_poc']
WHERE id = '1c823a52-7274-4028-8e64-fc7aabe81d83' AND org_name = '工学院大学';

COMMIT;
