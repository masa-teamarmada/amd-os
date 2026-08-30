-- BZM 3.0 の入力を動かしたときに産業創出価値がどう動くかを、案件ごと・パラメータごとに先に計算して置く。
--
-- まさ 2026-08-30「全案件のスコアが表形式で並んでて、右側の列にずらーっと各パラメータが並んでて、
-- それらのパラメータを変えたときにSPSが変わる様子がUI上で見れるといいかもって思った。」
--
-- 前向き計算は1件あたり10秒〜数分かかるので、画面のリクエストの中では走らせられない
-- （model/README.md (g)「前向き計算をリクエストの中で走らせない」）。
-- そこで、パラメータを1つずつ振った曲線を先に計算して行として持ち、画面はその上を滑らせる。
--
-- 約束（画面にもそのまま出すこと）:
--   * 1本ずつ動かしたときの曲線である。2つ以上を同時に動かした結果は、この表からは厳密には出せない
--   * `is_base = TRUE` の行が、いま置いてある入力そのものの結果。seed_bzm30_scores の最新行と一致する
--   * 承認済みの実装（approval_ref）で計算したものだけを画面に出す。未承認の改訂で計算した行を混ぜない

CREATE TABLE IF NOT EXISTS seed_bzm30_sensitivity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_id UUID NOT NULL REFERENCES seeds(id) ON DELETE CASCADE,
  -- どの版の実装で計算したか。seed_bzm30_scores と同じ規約
  model_version TEXT NOT NULL,
  approval_ref TEXT NOT NULL,
  -- 振ったパラメータ。画面の行に1対1で対応する
  --   free_cash      … 自由資金の残高（円）
  --   burn           … バーンレート（円／月）
  --   ceiling        … 用途の天井の合計（円／年・純増）
  --   evidence_stage … 評価日の証拠水準（段階0〜6）
  --   e              … 担い手（機能1 エバンジェリスト）の充足 0〜1
  --   c              … 変換能力
  --   quiet_months   … 無風期間（月）
  --   kappa_ip       … 専有可能性 0〜1
  --   sigma          … 産官学モメンタム -1／0／+1
  param TEXT NOT NULL CHECK (param IN (
    'free_cash', 'burn', 'ceiling', 'evidence_stage', 'e', 'c', 'quiet_months', 'kappa_ip', 'sigma'
  )),
  -- 曲線の上での位置。小さいほうから大きいほうへ並べる
  point_index INT NOT NULL,
  -- いま置いてある入力そのものの点か
  is_base BOOLEAN NOT NULL DEFAULT FALSE,
  -- そのパラメータの値。単位は param ごとに違う（円／円月／円年／段階／0〜1／月／-1〜+1）
  param_value NUMERIC NOT NULL,
  -- 画面に出す表示（「残高 3,141万円」「段階4」など）。数字の整形を画面側で二重に持たない
  param_label TEXT NOT NULL,
  -- 天井1円あたりの現在価値
  v_lower NUMERIC,
  v_median NUMERIC NOT NULL,
  v_upper NUMERIC,
  -- 天井を掛けた金額（円）。天井が未調査の案件は NULL
  score_lower_yen NUMERIC,
  score_median_yen NUMERIC,
  score_upper_yen NUMERIC,
  -- その点での自力の量産到達率と、到達までの平均月数。
  -- 「資金が効く案件」と「裾から立つ案件」を画面で見分けるのに要る
  p_reach_m4 NUMERIC,
  months_to_m4 NUMERIC,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (seed_id, model_version, approval_ref, param, point_index)
);

COMMENT ON TABLE seed_bzm30_sensitivity IS
  'BZM 3.0: 入力を1つずつ振ったときの産業創出価値の曲線。model/tools/bzm30_sensitivity.cjs が書く。手で編集しない';

CREATE INDEX IF NOT EXISTS idx_seed_bzm30_sensitivity_seed
  ON seed_bzm30_sensitivity (seed_id, approval_ref, param, point_index);
