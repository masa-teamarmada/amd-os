-- 030_amd_score_axis_notes.sql
--
-- amd_score_inputs に各軸の評価根拠 (notes) を追加。
-- まさフィードバック (2026-05-09): 「XRL / μ / FRL の値の根拠が UI で見たい」。
--
-- mu_notes:  Triple Helix μ_A/I/G の根拠 (JSONB: {a, i, g})
-- xrl_notes: 5 XRL の根拠 (JSONB: {trl, brl, grl, srl, hrl})
--
-- frl_notes は 015 で既に追加済み。
-- 全体自由記述用の notes (TEXT) も既存。
--
-- JSONB 採用理由: 軸数が将来増減する可能性 (Cobb-Douglas 拡張軸) を考慮、
-- かつ UI からの読み書きが {key} 単位で済むため。検索用途は薄い。

ALTER TABLE amd_score_inputs
  ADD COLUMN IF NOT EXISTS mu_notes JSONB,
  ADD COLUMN IF NOT EXISTS xrl_notes JSONB;

COMMENT ON COLUMN amd_score_inputs.mu_notes IS
  'Triple Helix μ_A/I/G の評価根拠 (JSONB: {a: "...", i: "...", g: "..."}). 例: a="Adv. Mater. 2024 で N 件論文急増、関連特許も成長中"';
COMMENT ON COLUMN amd_score_inputs.xrl_notes IS
  '5 XRL の評価根拠 (JSONB: {trl, brl, grl, srl, hrl}). 内閣府 SIP 9 段階定義に対する position 説明';
