-- 187_seed_sps_assessments.sql
-- 全国全研究機関のシーズ共通 SPS (M・P・R・S) 時系列評価テーブルを新設する。
-- 併せて、migration 186 で先行導入した KUTE (工学院大学) 専用の 0-100点 kute_score_* 8列
-- (全レコード NULL のまま未使用) を検証の上で撤去し、7列の KUTE 公開面向けテキスト列を
-- 全国共通の一般名へ改名する (値は保持)。186 自体は変更しない。
-- 設計: pwa/design/seeds.md, pwa/src/lib/amd-score.ts (calculatePrsScore / PRS_ALPHA_DEFAULT)

BEGIN;

-- =====================================================================
-- 1. seed_sps_assessments (全国全研究機関共通の時系列評価)
-- =====================================================================
-- 各軸は 0-9 の生値。未評価は NULL のまま (0 と NULL を区別、捏造禁止)。
-- SPS/M/P/R/S の実際の計算は pwa/src/lib/seed-sps.ts の pure helper が
-- amd-score.ts の calculatePrsScore / PRS_ALPHA_DEFAULT をそのまま再利用して行う。
-- ここには生の評価軸のみを持たせ、別式・別重みをテーブル側に埋め込まない。

CREATE TABLE IF NOT EXISTS seed_sps_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_id UUID NOT NULL REFERENCES seeds(id) ON DELETE CASCADE,
  evaluated_at DATE NOT NULL,

  -- M = macro (σ_SU の入力 3 軸)
  mu_a SMALLINT,
  mu_i SMALLINT,
  mu_g SMALLINT,

  -- P = potential
  potential SMALLINT,

  -- R = reach (TRL/BRL/GRL/SRL/HRL)
  trl SMALLINT,
  brl SMALLINT,
  grl SMALLINT,
  srl SMALLINT,
  hrl SMALLINT,

  -- S = survival (FRL の 2 レイヤー入力 + R_net)
  f_character SMALLINT,
  f_cap SMALLINT,
  frl SMALLINT,
  r_net SMALLINT,

  shallow_tech_mode BOOLEAN NOT NULL DEFAULT FALSE,

  status TEXT NOT NULL DEFAULT 'draft',
  confidence TEXT,
  axis_evidence JSONB,
  missing_axes TEXT[],
  evaluator TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT seed_sps_assessments_seed_evaluated_at_key UNIQUE (seed_id, evaluated_at),
  CONSTRAINT seed_sps_assessments_mu_a_check CHECK (mu_a IS NULL OR mu_a BETWEEN 0 AND 9),
  CONSTRAINT seed_sps_assessments_mu_i_check CHECK (mu_i IS NULL OR mu_i BETWEEN 0 AND 9),
  CONSTRAINT seed_sps_assessments_mu_g_check CHECK (mu_g IS NULL OR mu_g BETWEEN 0 AND 9),
  CONSTRAINT seed_sps_assessments_potential_check CHECK (potential IS NULL OR potential BETWEEN 0 AND 9),
  CONSTRAINT seed_sps_assessments_trl_check CHECK (trl IS NULL OR trl BETWEEN 0 AND 9),
  CONSTRAINT seed_sps_assessments_brl_check CHECK (brl IS NULL OR brl BETWEEN 0 AND 9),
  CONSTRAINT seed_sps_assessments_grl_check CHECK (grl IS NULL OR grl BETWEEN 0 AND 9),
  CONSTRAINT seed_sps_assessments_srl_check CHECK (srl IS NULL OR srl BETWEEN 0 AND 9),
  CONSTRAINT seed_sps_assessments_hrl_check CHECK (hrl IS NULL OR hrl BETWEEN 0 AND 9),
  CONSTRAINT seed_sps_assessments_f_character_check CHECK (f_character IS NULL OR f_character BETWEEN 0 AND 9),
  CONSTRAINT seed_sps_assessments_f_cap_check CHECK (f_cap IS NULL OR f_cap BETWEEN 0 AND 9),
  CONSTRAINT seed_sps_assessments_frl_check CHECK (frl IS NULL OR frl BETWEEN 0 AND 9),
  CONSTRAINT seed_sps_assessments_r_net_check CHECK (r_net IS NULL OR r_net BETWEEN 0 AND 9),
  CONSTRAINT seed_sps_assessments_status_check CHECK (status IN ('draft', 'ready', 'incomplete', 'reviewed')),
  CONSTRAINT seed_sps_assessments_confidence_check CHECK (confidence IS NULL OR confidence IN ('low', 'medium', 'high'))
);

CREATE INDEX IF NOT EXISTS idx_seed_sps_assessments_seed_evaluated_at
  ON seed_sps_assessments (seed_id, evaluated_at DESC);

ALTER TABLE seed_sps_assessments ENABLE ROW LEVEL SECURITY;
-- axis_evidence / evaluator は内部根拠を含むため anon (匿名 Supabase) からの直接 SELECT は許可しない。
-- 公開面 (KUTE cockpit 等) は authenticated なアプリサーバー経由の集計値のみを見せる。
DROP POLICY IF EXISTS anon_read ON seed_sps_assessments;
DROP POLICY IF EXISTS authenticated_all ON seed_sps_assessments;
CREATE POLICY authenticated_all ON seed_sps_assessments FOR ALL
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS service_role_bypass ON seed_sps_assessments;
CREATE POLICY service_role_bypass ON seed_sps_assessments FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE seed_sps_assessments IS '全国全研究機関のシーズ共通 SPS (M・P・R・S) 時系列評価。raw/URL/個人情報/secret は持たない。生の 0-9 軸のみ保持し、計算式は pwa/src/lib/seed-sps.ts に一本化 (別式・別重み禁止)';
COMMENT ON COLUMN seed_sps_assessments.seed_id IS '評価対象シーズ (seeds.id)';
COMMENT ON COLUMN seed_sps_assessments.evaluated_at IS '評価基準日。同一シーズで日付が異なれば新しい時系列点として別行になる (seed_id, evaluated_at) unique';
COMMENT ON COLUMN seed_sps_assessments.mu_a IS 'M 軸入力: μ_A (0-9)。根拠のない間は NULL (0 と区別)';
COMMENT ON COLUMN seed_sps_assessments.mu_i IS 'M 軸入力: μ_I (0-9)。根拠のない間は NULL';
COMMENT ON COLUMN seed_sps_assessments.mu_g IS 'M 軸入力: μ_G (0-9)。根拠のない間は NULL';
COMMENT ON COLUMN seed_sps_assessments.potential IS 'P 軸: Potential (0-9)。根拠のない間は NULL';
COMMENT ON COLUMN seed_sps_assessments.trl IS 'R 軸: TRL (0-9)。shallow_tech_mode=true のときのみ NULL 許容 (それ以外の NULL は未評価扱い)';
COMMENT ON COLUMN seed_sps_assessments.brl IS 'R 軸: BRL (0-9)。根拠のない間は NULL';
COMMENT ON COLUMN seed_sps_assessments.grl IS 'R 軸: GRL (0-9)。根拠のない間は NULL';
COMMENT ON COLUMN seed_sps_assessments.srl IS 'R 軸: SRL (0-9)。根拠のない間は NULL';
COMMENT ON COLUMN seed_sps_assessments.hrl IS 'R 軸: HRL (0-9)。根拠のない間は NULL';
COMMENT ON COLUMN seed_sps_assessments.f_character IS 'S 軸入力: F_character (資質, 0-9)。computeFrlCES() の必須入力';
COMMENT ON COLUMN seed_sps_assessments.f_cap IS 'S 軸入力: F_capability (経営実行力, 0-9)。NULL なら computeFrlCES() が F_character のみで後方互換フォールバック';
COMMENT ON COLUMN seed_sps_assessments.frl IS 'computeFrlCES(f_character, f_cap) の計算結果スナップショット (0-9)。評価時点の重みで固定するため保存する';
COMMENT ON COLUMN seed_sps_assessments.r_net IS 'S 軸: R_net (0-9, 生存キャッシュ寄与)。根拠のない間は NULL';
COMMENT ON COLUMN seed_sps_assessments.shallow_tech_mode IS 'TRL 軸を評価から除外する Shallow Tech モード。true のとき trl は NULL のままで missing 扱いにしない';
COMMENT ON COLUMN seed_sps_assessments.status IS '評価の進行状態: draft(下書き)/ready(全軸揃い計算可)/incomplete(欠損あり)/reviewed(人が確認済)';
COMMENT ON COLUMN seed_sps_assessments.confidence IS '評価全体の確度: low/medium/high。未確定は NULL';
COMMENT ON COLUMN seed_sps_assessments.axis_evidence IS '軸ごとの評価根拠 (内部用、公開面へは絶対に返さない)。raw/URL/個人情報/secret を書かない';
COMMENT ON COLUMN seed_sps_assessments.missing_axes IS '欠損軸のキー配列 (アプリ側で計算済みのキャッシュ、都度再計算も可)';
COMMENT ON COLUMN seed_sps_assessments.evaluator IS '評価者 (内部用、公開面へは絶対に返さない)';

-- =====================================================================
-- 2. migration 186 の kute_score_* 8列を撤去 (seed_sps_assessments に置き換え)
-- =====================================================================
-- 186 は変更しない。ここでは 186 が作った列に対して安全確認の上で DROP するのみ。
-- 1件でも値が入っていたら実データ損失を避けるため RAISE EXCEPTION で停止する。

DO $$
DECLARE
  non_null_count integer;
BEGIN
  SELECT count(*) INTO non_null_count
  FROM seeds
  WHERE kute_score_future_need IS NOT NULL
     OR kute_score_future_market IS NOT NULL
     OR kute_score_future_technical_advantage IS NOT NULL
     OR kute_score_future_ip_barrier IS NOT NULL
     OR kute_score_current_trl IS NOT NULL
     OR kute_score_current_brl IS NOT NULL
     OR kute_score_current_hrl IS NOT NULL
     OR kute_score_support IS NOT NULL;

  IF non_null_count > 0 THEN
    RAISE EXCEPTION 'seeds.kute_score_* に % 件の非NULL行があります。データ損失を避けるため 187 の DROP を中止しました。先に値を seed_sps_assessments へ移行してください。', non_null_count;
  END IF;

  ALTER TABLE seeds
    DROP COLUMN IF EXISTS kute_score_future_need,
    DROP COLUMN IF EXISTS kute_score_future_market,
    DROP COLUMN IF EXISTS kute_score_future_technical_advantage,
    DROP COLUMN IF EXISTS kute_score_future_ip_barrier,
    DROP COLUMN IF EXISTS kute_score_current_trl,
    DROP COLUMN IF EXISTS kute_score_current_brl,
    DROP COLUMN IF EXISTS kute_score_current_hrl,
    DROP COLUMN IF EXISTS kute_score_support;
END $$;

-- =====================================================================
-- 3. KUTE 公開面向け 7 列を全国共通の一般名へ改名 (値は保持)
-- =====================================================================
-- 冪等性: 旧列名が存在するときだけ RENAME する (再実行対応)。

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seeds' AND column_name = 'kute_envisioned_use_case') THEN
    ALTER TABLE seeds RENAME COLUMN kute_envisioned_use_case TO envisioned_use_case;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seeds' AND column_name = 'kute_first_customer_candidate') THEN
    ALTER TABLE seeds RENAME COLUMN kute_first_customer_candidate TO first_customer_candidate;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seeds' AND column_name = 'kute_market_size_range') THEN
    ALTER TABLE seeds RENAME COLUMN kute_market_size_range TO market_size_range;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seeds' AND column_name = 'kute_market_size_confidence') THEN
    ALTER TABLE seeds RENAME COLUMN kute_market_size_confidence TO market_size_confidence;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seeds' AND column_name = 'kute_biggest_bottleneck') THEN
    ALTER TABLE seeds RENAME COLUMN kute_biggest_bottleneck TO biggest_bottleneck;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seeds' AND column_name = 'kute_ip_status') THEN
    ALTER TABLE seeds RENAME COLUMN kute_ip_status TO ip_status;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seeds' AND column_name = 'kute_next_verification_step') THEN
    ALTER TABLE seeds RENAME COLUMN kute_next_verification_step TO next_verification_step;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seeds_kute_market_size_confidence_check' AND conrelid = 'public.seeds'::regclass) THEN
    ALTER TABLE seeds RENAME CONSTRAINT seeds_kute_market_size_confidence_check TO seeds_market_size_confidence_check;
  END IF;
END $$;

COMMENT ON COLUMN seeds.envisioned_use_case IS '公開面向け: 想定用途。未確定は NULL (捏造禁止)。旧列名 kute_envisioned_use_case (186) を全国共通名へ改名';
COMMENT ON COLUMN seeds.first_customer_candidate IS '公開面向け: 最初の顧客/連携先候補。未確定は NULL';
COMMENT ON COLUMN seeds.market_size_range IS '公開面向け: 市場規模レンジ (自由記述レンジ表現)。根拠がない間は NULL';
COMMENT ON COLUMN seeds.market_size_confidence IS 'market_size_range の確度: low/medium/high。根拠がない間は NULL';
COMMENT ON COLUMN seeds.biggest_bottleneck IS '公開面向け: 事業化上の最大のボトルネック';
COMMENT ON COLUMN seeds.ip_status IS '公開面向け: 知財状況の要約';
COMMENT ON COLUMN seeds.next_verification_step IS '公開面向け: 次の検証ステップ (next_action とは別。外部に見せてよい表現のみ)';

COMMIT;
