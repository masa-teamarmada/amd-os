-- 118_management_score_company_vital_scope.sql
--
-- Management Score 会社バイタルの根本分類。
-- project_strategy_signals は PJ cockpit 用の経営ハイライトも保持するため、
-- AMD会社全体の Management Score に入れてよい signal を明示分類する。
--
-- 破壊的変更は禁止。既存 row は nullable のまま残し、backfill helper で段階的に埋める。

ALTER TABLE project_strategy_signals
  ADD COLUMN IF NOT EXISTS signal_scope TEXT
    CHECK (signal_scope IS NULL OR signal_scope IN ('company', 'project', 'cross_project')),
  ADD COLUMN IF NOT EXISTS applies_to_company_score BOOLEAN,
  ADD COLUMN IF NOT EXISTS pipeline_status TEXT
    CHECK (pipeline_status IS NULL OR pipeline_status IN ('prospect', 'high_confidence', 'contracting', 'contracted', 'lost', 'deferred')),
  ADD COLUMN IF NOT EXISTS pipeline_probability NUMERIC
    CHECK (pipeline_probability IS NULL OR (pipeline_probability >= 0 AND pipeline_probability <= 1)),
  ADD COLUMN IF NOT EXISTS expected_amount_yen NUMERIC,
  ADD COLUMN IF NOT EXISTS expected_contract_ym TEXT
    CHECK (expected_contract_ym IS NULL OR expected_contract_ym ~ '^[0-9]{6}$'),
  ADD COLUMN IF NOT EXISTS company_score_axis TEXT
    CHECK (company_score_axis IS NULL OR company_score_axis IN ('pipeline', 'funding', 'runway', 'finance', 'capacity', 'decision', 'resource_allocation', 'revenue')),
  ADD COLUMN IF NOT EXISTS scope_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_strategy_signals_company_score_scope_chk'
  ) THEN
    ALTER TABLE project_strategy_signals
      ADD CONSTRAINT project_strategy_signals_company_score_scope_chk
      CHECK (
        applies_to_company_score IS DISTINCT FROM TRUE
        OR signal_scope IN ('company', 'cross_project')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_strategy_signals_pipeline_axis_chk'
  ) THEN
    ALTER TABLE project_strategy_signals
      ADD CONSTRAINT project_strategy_signals_pipeline_axis_chk
      CHECK (
        pipeline_status IS NULL
        OR company_score_axis IS NULL
        OR company_score_axis = 'pipeline'
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_strategy_signals_company_score
  ON project_strategy_signals(applies_to_company_score, signal_scope, company_score_axis, pipeline_status, expected_contract_ym, signal_date DESC NULLS LAST, created_at DESC)
  WHERE applies_to_company_score = TRUE;

COMMENT ON COLUMN project_strategy_signals.signal_scope IS
  'Management Score分類: company / project / cross_project。PJ cockpit表示とは別に、signalが効く範囲を表す。';
COMMENT ON COLUMN project_strategy_signals.applies_to_company_score IS
  'TRUE のとき AMD会社全体の Management Score raw material に入れてよい。project-level signal は FALSE。NULL は未分類。';
COMMENT ON COLUMN project_strategy_signals.pipeline_status IS
  '契約前/契約中 pipeline の状態: prospect / high_confidence / contracting / contracted / lost / deferred。';
COMMENT ON COLUMN project_strategy_signals.pipeline_probability IS
  'pipeline の見込み確度 0.0-1.0。契約前 high_confidence は原則 0.75 以上。';
COMMENT ON COLUMN project_strategy_signals.expected_amount_yen IS
  '契約/請求/売上の見込み金額。未確認なら NULL。';
COMMENT ON COLUMN project_strategy_signals.expected_contract_ym IS
  '契約・請求・開始が見込まれる年月 YYYYMM。未確認なら NULL。';
COMMENT ON COLUMN project_strategy_signals.company_score_axis IS
  'Management Score 側の寄与軸。pipeline / funding / runway / finance / capacity / decision / resource_allocation / revenue。';
COMMENT ON COLUMN project_strategy_signals.scope_reason IS
  'company score対象/非対象にした理由。backfillや抽出時の短い根拠を残す。';
