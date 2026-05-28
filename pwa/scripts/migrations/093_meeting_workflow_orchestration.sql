-- 093_meeting_workflow_orchestration.sql
--
-- MTG終了後の一連の流れを AMD OS 上で追えるようにする。
-- 目的:
--   1. 議事録から「次MTGまでにやること」を task 化する
--   2. 次MTGの準備カード (project_meeting_summaries source_kinds='upcoming') と紐づける
--   3. nudge / 完了検出 / ファシリ依頼 / 資料更新の状態を append-only に近い形で残す

ALTER TABLE project_meeting_summaries
  ADD COLUMN IF NOT EXISTS prep_source_meeting_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS prep_status TEXT NULL,
  ADD COLUMN IF NOT EXISTS facilitator_member_id TEXT NULL REFERENCES members(member_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS facilitator_nudge_scheduled_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS facilitator_slack_scheduled_message_id TEXT NULL;

COMMENT ON COLUMN project_meeting_summaries.prep_source_meeting_id IS
  'この upcoming MTG 準備カードを生成した直前MTGの meeting_id。通常議事録側では NULL。';
COMMENT ON COLUMN project_meeting_summaries.prep_status IS
  'upcoming row の準備状態。draft / nudging / ready / facilitator_needed / completed など。';
COMMENT ON COLUMN project_meeting_summaries.facilitator_member_id IS
  '次MTG準備の最終責任者。前日までに資料が揃わない場合のnudge先。';
COMMENT ON COLUMN project_meeting_summaries.facilitator_nudge_scheduled_at IS
  'cronを使わず、次MTG生成時に予約したファシリ向けSlack nudge予定時刻。';

CREATE TABLE IF NOT EXISTS meeting_action_items (
  action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,

  -- どの議事録から生まれ、どの次MTG準備に効くか
  source_meeting_id TEXT REFERENCES project_meeting_summaries(meeting_id) ON DELETE SET NULL,
  prep_meeting_id TEXT REFERENCES project_meeting_summaries(meeting_id) ON DELETE SET NULL,

  -- 担当。member_id が解けない外部/未確定担当もあるため code_name も保持する
  owner_member_id TEXT REFERENCES members(member_id) ON DELETE SET NULL,
  owner_code_name TEXT,

  title TEXT NOT NULL,
  detail TEXT,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'todo', -- todo | nudged | done | blocked | dropped
  source_hash TEXT,

  -- 完了検出・nudge の痕跡
  completion_source TEXT,
  completion_evidence_url TEXT,
  completed_at TIMESTAMPTZ,
  last_nudged_at TIMESTAMPTZ,
  slack_message_ts TEXT,
  scheduled_nudge_at TIMESTAMPTZ,
  slack_scheduled_message_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_action_items_project_due
  ON meeting_action_items(project_id, due_at);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_source
  ON meeting_action_items(source_meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_prep
  ON meeting_action_items(prep_meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_open
  ON meeting_action_items(project_id, status, due_at)
  WHERE status IN ('todo', 'nudged', 'blocked');
CREATE UNIQUE INDEX IF NOT EXISTS uniq_meeting_action_items_prep_source_hash
  ON meeting_action_items(prep_meeting_id, source_hash)
  WHERE source_hash IS NOT NULL;

ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_action_items_read ON meeting_action_items;
CREATE POLICY meeting_action_items_read
  ON meeting_action_items FOR SELECT
  USING (auth.role() IN ('anon', 'authenticated', 'service_role'));

DROP POLICY IF EXISTS meeting_action_items_admin_all ON meeting_action_items;
CREATE POLICY meeting_action_items_admin_all
  ON meeting_action_items FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM members
      WHERE lower(email) = lower(auth.jwt() ->> 'email')
        AND is_admin = true
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM members
      WHERE lower(email) = lower(auth.jwt() ->> 'email')
        AND is_admin = true
    )
  );

CREATE OR REPLACE FUNCTION touch_meeting_action_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS meeting_action_items_updated_at ON meeting_action_items;
CREATE TRIGGER meeting_action_items_updated_at
  BEFORE UPDATE ON meeting_action_items
  FOR EACH ROW
  EXECUTE FUNCTION touch_meeting_action_items_updated_at();

COMMENT ON TABLE meeting_action_items IS
  'MTG議事録から生成される次MTG準備用のaction item。Slack nudge、完了検出、資料更新の状態を追う。';
