-- 061: project freeze/restart period history
--
-- projects.freeze_from_ym / restart_expected_ym は「現在の表示用キャッシュ」だけを
-- 持つ。CTB のように凍結 → 再開 → 再凍結が起きる PJ では履歴を失うため、
-- 期間履歴の正本として project_freeze_periods を追加する。

CREATE TABLE IF NOT EXISTS project_freeze_periods (
  period_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  freeze_from_ym TEXT NOT NULL,
  restart_ym TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'closed', 'planned')),
  reason TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  source_ref JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'codex',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (freeze_from_ym ~ '^[0-9]{6}$'),
  CHECK (restart_ym IS NULL OR restart_ym ~ '^[0-9]{6}$'),
  CHECK (restart_ym IS NULL OR restart_ym > freeze_from_ym)
);

CREATE UNIQUE INDEX IF NOT EXISTS project_freeze_periods_unique_period
  ON project_freeze_periods(project_id, freeze_from_ym);

CREATE UNIQUE INDEX IF NOT EXISTS project_freeze_periods_one_active
  ON project_freeze_periods(project_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS project_freeze_periods_project_idx
  ON project_freeze_periods(project_id, freeze_from_ym DESC);

ALTER TABLE project_freeze_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON project_freeze_periods;
CREATE POLICY anon_read ON project_freeze_periods FOR SELECT USING (true);
DROP POLICY IF EXISTS service_role_bypass ON project_freeze_periods;
CREATE POLICY service_role_bypass ON project_freeze_periods
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE project_freeze_periods IS
  'PJの凍結/再開期間履歴。projects.freeze_from_ym は現在状態キャッシュで、複数回の凍結履歴はこのテーブルを正とする。';
COMMENT ON COLUMN project_freeze_periods.freeze_from_ym IS
  'この ym から凍結扱い。前月までは通常/再開中として扱う。';
COMMENT ON COLUMN project_freeze_periods.restart_ym IS
  'この ym から再開。NULL の active row は現在凍結中。';

-- 既存の現在状態カラムを履歴テーブルに移す。source_ref に既存カラム由来を残す。
INSERT INTO project_freeze_periods (
  project_id,
  freeze_from_ym,
  restart_ym,
  status,
  reason,
  source,
  source_ref,
  created_by
)
SELECT
  project_id,
  freeze_from_ym,
  restart_expected_ym,
  CASE WHEN restart_expected_ym IS NULL THEN 'active' ELSE 'planned' END,
  'Backfilled from projects.freeze_from_ym / restart_expected_ym',
  'projects_current_columns',
  jsonb_build_object(
    'freeze_from_ym', freeze_from_ym,
    'restart_expected_ym', restart_expected_ym
  ),
  'migration_061'
FROM projects
WHERE freeze_from_ym IS NOT NULL
ON CONFLICT (project_id, freeze_from_ym) DO UPDATE SET
  restart_ym = EXCLUDED.restart_ym,
  status = EXCLUDED.status,
  source_ref = project_freeze_periods.source_ref || EXCLUDED.source_ref,
  updated_at = NOW();
