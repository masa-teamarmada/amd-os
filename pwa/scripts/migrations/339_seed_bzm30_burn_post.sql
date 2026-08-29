-- BZM 3.0 の案件ごとの入力に、会社化後の計画バーンを足す（APPROVALS #2026-08-29-3）。
--
-- 会社化前の案件は、評価日のバーン（burn_rate_yen_month）が会社化前の μ を差し替えるだけで、
-- シナリオ内で会社化した後の μ は型の既定値になっていた。スモールスタートの計画
-- （人員は研究機関に残置・最低限の機能・本社は自宅など。まさ 2026-08-29「設立後いきなり
-- バーンレートを550万まで一気に上げるなんて一切考えてないよ。そんなの自殺行為だよ」）を
-- 型の既定で上書きしないための口。会社化済みの案件では使わない。

ALTER TABLE seed_bzm30_inputs
  ADD COLUMN IF NOT EXISTS burn_post_yen_month BIGINT,
  ADD COLUMN IF NOT EXISTS burn_post_reason TEXT;

COMMENT ON COLUMN seed_bzm30_inputs.burn_post_yen_month IS '会社化後の計画バーン（円／月。#2026-08-29-3。会社化前の案件のみ。適用は max(計画値, 評価日の観測) で単調性を保つ)';
COMMENT ON COLUMN seed_bzm30_inputs.burn_post_reason IS '会社化後の計画バーンの根拠（計画の出どころと内訳）';
