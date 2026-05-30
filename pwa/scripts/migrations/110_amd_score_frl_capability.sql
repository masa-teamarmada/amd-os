-- 110_amd_score_frl_capability.sql
-- FRL 2 レイヤー化 (2026-05-30 確定): FRL = CES(F_character, F_capability)
--   F_character = 既存 frl 列 (= 0.6·ALQ4 + 0.2·Grit + 0.2·Resilience, 資質・委譲不可)
--   F_capability = 経営実行力 (経験 ≫ 知識, CxO/AMD で補完可) ← 新規
--   合成は CES (補完性 ρ<0): どちらかが一定以下なら FRL が大きく崩れる
-- 正本: knowledge/before_zero_theory.md「FRL を F_char × F_cap に分離」/ pwa/bzm/4-1 §4 / pwa/manual/4-4
--
-- 後方互換: frl_cap が NULL の行は従来どおり frl (= F_character) をそのまま最終 FRL に使う。

ALTER TABLE amd_score_inputs
  ADD COLUMN IF NOT EXISTS frl_cap       float4,  -- F_capability (経営実行力 0-9, チーム best-of)
  ADD COLUMN IF NOT EXISTS frl_cap_amd   float4,  -- うち AMD メンバー寄与分 (= AMD 提供価値の定量化)
  ADD COLUMN IF NOT EXISTS frl_cap_notes text,    -- F_capability の根拠 (誰のどの経験か, AMD 由来か)
  ADD COLUMN IF NOT EXISTS frl_ces_a     float4,  -- CES 重み a (資質側比重, 既定 0.6)
  ADD COLUMN IF NOT EXISTS frl_ces_rho   float4;  -- CES ρ (補完性, 既定 -2, ρ→0=代替/ρ→-∞=min)

COMMENT ON COLUMN amd_score_inputs.frl_cap IS 'F_capability 経営実行力 0-9 (経験≫知識, CxO/AMDで補完可). NULL なら最終FRL=frl(F_character)';
COMMENT ON COLUMN amd_score_inputs.frl_cap_amd IS 'F_capability のうち AMD メンバー寄与分. AMD提供価値 = frl_cap - (AMD抜きのbest-of)';
COMMENT ON COLUMN amd_score_inputs.frl_ces_a IS 'CES 資質側重み a (既定 0.6). FRL+1=[a(F_char+1)^ρ+(1-a)(F_cap+1)^ρ]^(1/ρ)';
COMMENT ON COLUMN amd_score_inputs.frl_ces_rho IS 'CES ρ 補完性 (既定 -2). ρ<0で「両方必要」, ρ→0でCobb-Douglas, ρ→-∞でmin';
