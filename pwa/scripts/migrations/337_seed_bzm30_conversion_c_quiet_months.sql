-- BZM 3.0 の案件ごとの入力に、変換能力 c と無風期間を足す（APPROVALS #2026-08-29-1）。
--
-- まさ 2026-08-28「変換能力については、何かアクションをするたびに、そこにかかった費用と得られた戦略余力を
-- 推定して、その比率の移動平均を取るのがいいと思う」
-- まさ 2026-08-29「12か月でc=0.5、24か月でc=0.1くらいになるように落としていってほしい。
-- 2年間ニュースがないってもはや死んでるに近いよ。」
--
-- 変換能力 c: 要件1（モデルページ §3）の量。案件ごとの推定が入ると、参照実装は事前分布の中心を
--   この値へ置き換える（幅 GSD 1.65 は保つ。§6.I-9-1）。
-- 無風期間: 外から見えるポジティブな動き（調達・製品化・提携・受賞・大型採択）が最後に観測されて
--   からの月数。戦略余力の鮮度の観測量で、実現の申し出の到来率と撤退の四経路②③に乗数 m_q が掛かる。
--   記録の無い案件では c の概算にも同じ目盛りを使う（§6.I-9-1: 0か月1.0→12か月0.5→24か月0.1→36か月以上0.05）。

ALTER TABLE seed_bzm30_inputs
  -- 変換能力 c の推定値（分野の基準 = 1.0 に対する倍率）
  ADD COLUMN IF NOT EXISTS conversion_c NUMERIC,
  -- c の根拠。どの測り方か（移動平均／履歴の粗い推定／無風期間からの概算）と導出を書く
  ADD COLUMN IF NOT EXISTS conversion_c_reason TEXT,
  -- 無風期間（月数）。最後のポジティブな動きが何か・いつかを reason に書く
  ADD COLUMN IF NOT EXISTS quiet_months NUMERIC,
  ADD COLUMN IF NOT EXISTS quiet_months_reason TEXT;

COMMENT ON COLUMN seed_bzm30_inputs.conversion_c IS '変換能力 c（分野基準1.0に対する倍率。#2026-08-29-1。参照実装は事前分布の中心をこの値へ置き換える）';
COMMENT ON COLUMN seed_bzm30_inputs.conversion_c_reason IS 'c の根拠（測り方の種別と導出）';
COMMENT ON COLUMN seed_bzm30_inputs.quiet_months IS '無風期間（ポジティブな公開の動きが出ていない月数。#2026-08-29-1。申し出到来率の乗数 m_q に写る）';
COMMENT ON COLUMN seed_bzm30_inputs.quiet_months_reason IS '無風期間の根拠（最後のポジティブな動きは何か・いつか）';
