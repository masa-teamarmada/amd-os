-- 255_external_research_strategy_signals.sql
--
-- つくよみ外部リサーチを D-6 のレビュー候補として受け、採用済みだけを
-- PJ cockpit の採用リサーチ棚へ表示するための additive migration。

ALTER TABLE project_strategy_signals
  ADD COLUMN IF NOT EXISTS origin_kind TEXT NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS research_category TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_strategy_signals_origin_kind_chk'
  ) THEN
    ALTER TABLE project_strategy_signals
      ADD CONSTRAINT project_strategy_signals_origin_kind_chk
      CHECK (origin_kind IN ('internal', 'external_research'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_strategy_signals_research_category_chk'
  ) THEN
    ALTER TABLE project_strategy_signals
      ADD CONSTRAINT project_strategy_signals_research_category_chk
      CHECK (
        research_category IS NULL
        OR research_category IN ('industry_market', 'grant', 'partner')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_strategy_signals_external_category_chk'
  ) THEN
    ALTER TABLE project_strategy_signals
      ADD CONSTRAINT project_strategy_signals_external_category_chk
      CHECK (
        (origin_kind = 'internal' AND research_category IS NULL)
        OR (origin_kind = 'external_research' AND research_category IS NOT NULL)
      );
  END IF;
END $$;

-- 外部リサーチは status / ym / signal_type が変わっても同じ出来事を再投入しない。
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_strategy_signals_external_source
  ON project_strategy_signals(project_id, source_hash)
  WHERE origin_kind = 'external_research';

CREATE INDEX IF NOT EXISTS idx_project_strategy_signals_external_confirmed
  ON project_strategy_signals(project_id, signal_date DESC NULLS LAST, created_at DESC)
  WHERE origin_kind = 'external_research' AND status = 'confirmed';

COMMENT ON COLUMN project_strategy_signals.origin_kind IS
  'internal=既存の経営ハイライト、external_research=つくよみ外部リサーチ。候補は通知だけ、confirmedのみcockpitへ表示する。';
COMMENT ON COLUMN project_strategy_signals.research_category IS
  '外部リサーチの分類。industry_market / grant / partner。internalではNULL。';
