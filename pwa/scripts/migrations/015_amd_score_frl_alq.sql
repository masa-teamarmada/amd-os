-- 015_amd_score_frl_alq.sql
--
-- amd_score_inputs に FRL の構造化評価を追加。
-- Walumbwa et al. (2008) ALQ (Authentic Leadership Questionnaire) の 4 次元を保存する。
--
-- frl は最終値 (0-9)、alq_* は内訳 (0-9)、frl_notes は自由記述。
-- frl は alq の平均で自動算出されるが、ユーザーが override 可。

ALTER TABLE amd_score_inputs
  ADD COLUMN IF NOT EXISTS alq_self_awareness REAL,             -- 自己認識
  ADD COLUMN IF NOT EXISTS alq_relational_transparency REAL,    -- 関係透明性
  ADD COLUMN IF NOT EXISTS alq_balanced_processing REAL,        -- 均衡的処理
  ADD COLUMN IF NOT EXISTS alq_internalized_moral REAL,         -- 内在化された道徳観
  ADD COLUMN IF NOT EXISTS frl_notes TEXT;                       -- 自由備考 (CEO 像、不足項目、外部評価など)

COMMENT ON COLUMN amd_score_inputs.alq_self_awareness IS
  'ALQ Self-awareness 0-9. Walumbwa et al. (2008) Journal of Management';
COMMENT ON COLUMN amd_score_inputs.alq_relational_transparency IS
  'ALQ Relational transparency 0-9';
COMMENT ON COLUMN amd_score_inputs.alq_balanced_processing IS
  'ALQ Balanced processing 0-9';
COMMENT ON COLUMN amd_score_inputs.alq_internalized_moral IS
  'ALQ Internalized moral perspective 0-9';
COMMENT ON COLUMN amd_score_inputs.frl_notes IS
  'FRL 自由備考。ALQ 4 次元では拾えない要素 (チーム外評価、過去実績、Founder Network 等)';
