-- 109_amd_score_xrl_checklist.sql
-- amd_score_inputs に XRL 観測チェックリストの状態を保存する JSONB カラムを追加。
--
-- 背景 (まさ確定 2026-05-30): XRL の各レベル判定が案件ごとにブレるため、
-- 内閣府 SIP 公募要領の原典定義 (図2-6) を観測可能チェック項目に分解し、
-- スコア詳細ページでチェック形式で判定する。えいみが全PJ初期入力 → まさが修正。
--
-- 形式: { "<axis>": { "<level>": [bool, bool, ...] } }
--   axis  = trl/brl/grl/srl/hrl
--   level = "1".."9" (GRL/SRL/HRL は "1".."8")
--   配列  = そのレベルの checklist 各項目のチェック状態 (xrl-level-definitions.ts の checklist 順に対応)
-- 例: { "trl": { "3": [true, false], "4": [true, true] }, "brl": { "2": [true,true,false] } }

ALTER TABLE amd_score_inputs
  ADD COLUMN IF NOT EXISTS xrl_checklist jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN amd_score_inputs.xrl_checklist IS
  'XRL各軸×各レベルの観測チェック状態 (内閣府SIP原典 図2-6 準拠)。{axis:{level:[bool,...]}}。xrl-level-definitions.ts の checklist 順に対応。';
