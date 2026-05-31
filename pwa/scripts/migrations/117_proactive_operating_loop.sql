-- 117_proactive_operating_loop.sql
--
-- Proactive Operating Loop / 先手力維持ループ control layer.
-- 設計正本: pwa/design/proactive_operating_loop.md
--
-- OS は検知・期限・outbox・状態管理までを担い、重い draft 生成は
-- Codex / えいみ / PJ 司令塔 worker に渡す。

CREATE TABLE IF NOT EXISTS public.project_commander_threads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          TEXT NOT NULL,
  institution_id      TEXT REFERENCES public.institutions(institution_id) ON DELETE SET NULL,
  commander_thread_id TEXT NOT NULL,
  thread_label        TEXT,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'unknown')),
  created_by          TEXT NOT NULL DEFAULT 'codex_worker',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, commander_thread_id)
);

CREATE TABLE IF NOT EXISTS public.proactive_loops (
  loop_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          TEXT NOT NULL,
  institution_id      TEXT REFERENCES public.institutions(institution_id) ON DELETE SET NULL,
  commander_thread_id TEXT,
  loop_kind           TEXT NOT NULL CHECK (
    loop_kind IN (
      'post_meeting',
      'ambiguous_ball',
      'next_meeting_preparation',
      'counterpart_nudge',
      'deadline_followup',
      'strategy_signal_action',
      'report_only_gap'
    )
  ),
  source_kind         TEXT NOT NULL,
  source_id           TEXT,
  source_hash         TEXT,
  meeting_id          TEXT,
  calendar_event_id   TEXT,
  title               TEXT NOT NULL,
  summary             TEXT,
  ball_owner          TEXT NOT NULL DEFAULT 'ambiguous' CHECK (ball_owner IN ('amd', 'counterpart', 'shared', 'ambiguous')),
  priority            TEXT NOT NULL DEFAULT 'yellow' CHECK (priority IN ('red', 'yellow', 'green')),
  sla_due_at          TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'watching', 'closed', 'blocked')),
  evidence_refs       JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by          TEXT NOT NULL DEFAULT 'codex_automation',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at           TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.proactive_outbox (
  outbox_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loop_id                UUID REFERENCES public.proactive_loops(loop_id) ON DELETE SET NULL,
  project_id             TEXT NOT NULL,
  institution_id         TEXT REFERENCES public.institutions(institution_id) ON DELETE SET NULL,
  meeting_id             TEXT,
  calendar_event_id      TEXT,
  source_kind            TEXT NOT NULL,
  source_id              TEXT,
  source_hash            TEXT,
  trigger_type           TEXT NOT NULL CHECK (
    trigger_type IN (
      'meeting_ended',
      'minutes_added',
      'ball_ambiguous',
      'next_meeting_due',
      'counterpart_nudge_detected',
      'deadline_approaching',
      'strategy_signal_needs_action',
      'report_only_gap'
    )
  ),
  ball_owner             TEXT NOT NULL DEFAULT 'ambiguous' CHECK (ball_owner IN ('amd', 'counterpart', 'shared', 'ambiguous')),
  priority               TEXT NOT NULL DEFAULT 'yellow' CHECK (priority IN ('red', 'yellow', 'green')),
  draft_type             TEXT NOT NULL CHECK (draft_type IN ('email', 'slack', 'agenda', 'proposal', 'roadmap', 'next_action_plan')),
  recommended_first_move TEXT NOT NULL,
  risk_if_late           TEXT NOT NULL,
  due_at                 TIMESTAMPTZ NOT NULL,
  commander_thread_id    TEXT,
  status                 TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'sent_to_commander', 'drafted', 'sent_to_counterpart', 'closed', 'blocked')
  ),
  sent_at                TIMESTAMPTZ,
  drafted_at             TIMESTAMPTZ,
  sent_to_counterpart_at TIMESTAMPTZ,
  closed_at              TIMESTAMPTZ,
  blocked_reason         TEXT,
  evidence_refs          JSONB NOT NULL DEFAULT '[]'::jsonb,
  draft_artifact_refs    JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata_json          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by             TEXT NOT NULL DEFAULT 'codex_automation',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.proactive_loop_events (
  event_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loop_id        UUID REFERENCES public.proactive_loops(loop_id) ON DELETE SET NULL,
  outbox_id      UUID REFERENCES public.proactive_outbox(outbox_id) ON DELETE SET NULL,
  project_id     TEXT NOT NULL,
  event_type     TEXT NOT NULL CHECK (
    event_type IN (
      'detected',
      'queued',
      'sent_to_commander',
      'drafted',
      'sent_to_counterpart',
      'closed',
      'blocked',
      'sla_breached',
      'counterpart_nudge_detected',
      'deduped'
    )
  ),
  event_summary  TEXT NOT NULL,
  actor_kind     TEXT NOT NULL DEFAULT 'system' CHECK (actor_kind IN ('system', 'codex', 'commander', 'human', 'service')),
  actor_id       TEXT,
  metadata_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_commander_threads_project
  ON public.project_commander_threads(project_id);
CREATE INDEX IF NOT EXISTS idx_project_commander_threads_institution
  ON public.project_commander_threads(institution_id)
  WHERE institution_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_commander_threads_thread
  ON public.project_commander_threads(commander_thread_id);
CREATE INDEX IF NOT EXISTS idx_project_commander_threads_status
  ON public.project_commander_threads(status);

CREATE INDEX IF NOT EXISTS idx_proactive_loops_status_due
  ON public.proactive_loops(status, sla_due_at);
CREATE INDEX IF NOT EXISTS idx_proactive_loops_project
  ON public.proactive_loops(project_id);
CREATE INDEX IF NOT EXISTS idx_proactive_loops_institution
  ON public.proactive_loops(institution_id)
  WHERE institution_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proactive_loops_commander_thread
  ON public.proactive_loops(commander_thread_id)
  WHERE commander_thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proactive_loops_source
  ON public.proactive_loops(source_kind, source_id)
  WHERE source_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_proactive_loops_source
  ON public.proactive_loops(project_id, loop_kind, source_kind, source_id)
  WHERE source_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_proactive_loops_source_hash
  ON public.proactive_loops(project_id, loop_kind, source_hash)
  WHERE source_id IS NULL AND source_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proactive_outbox_status_due
  ON public.proactive_outbox(status, due_at);
CREATE INDEX IF NOT EXISTS idx_proactive_outbox_project
  ON public.proactive_outbox(project_id);
CREATE INDEX IF NOT EXISTS idx_proactive_outbox_institution
  ON public.proactive_outbox(institution_id)
  WHERE institution_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proactive_outbox_commander_thread
  ON public.proactive_outbox(commander_thread_id)
  WHERE commander_thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proactive_outbox_loop
  ON public.proactive_outbox(loop_id)
  WHERE loop_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proactive_outbox_trigger
  ON public.proactive_outbox(trigger_type, priority, due_at);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_proactive_outbox_source
  ON public.proactive_outbox(project_id, trigger_type, source_id, draft_type)
  WHERE source_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_proactive_outbox_calendar
  ON public.proactive_outbox(project_id, calendar_event_id, draft_type)
  WHERE source_id IS NULL AND calendar_event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_proactive_outbox_source_hash
  ON public.proactive_outbox(project_id, trigger_type, source_hash, draft_type)
  WHERE source_id IS NULL AND calendar_event_id IS NULL AND source_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proactive_loop_events_loop
  ON public.proactive_loop_events(loop_id)
  WHERE loop_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proactive_loop_events_outbox
  ON public.proactive_loop_events(outbox_id)
  WHERE outbox_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proactive_loop_events_project
  ON public.proactive_loop_events(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proactive_loop_events_type
  ON public.proactive_loop_events(event_type, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_proactive_operating_loop_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS project_commander_threads_updated_at ON public.project_commander_threads;
CREATE TRIGGER project_commander_threads_updated_at
  BEFORE UPDATE ON public.project_commander_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_proactive_operating_loop_updated_at();

DROP TRIGGER IF EXISTS proactive_loops_updated_at ON public.proactive_loops;
CREATE TRIGGER proactive_loops_updated_at
  BEFORE UPDATE ON public.proactive_loops
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_proactive_operating_loop_updated_at();

DROP TRIGGER IF EXISTS proactive_outbox_updated_at ON public.proactive_outbox;
CREATE TRIGGER proactive_outbox_updated_at
  BEFORE UPDATE ON public.proactive_outbox
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_proactive_operating_loop_updated_at();

ALTER TABLE public.project_commander_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proactive_loops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proactive_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proactive_loop_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.project_commander_threads FROM anon;
REVOKE ALL ON public.proactive_loops FROM anon;
REVOKE ALL ON public.proactive_outbox FROM anon;
REVOKE ALL ON public.proactive_loop_events FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_commander_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proactive_loops TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proactive_outbox TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proactive_loop_events TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_commander_threads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proactive_loops TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proactive_outbox TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proactive_loop_events TO service_role;

DROP POLICY IF EXISTS project_commander_threads_admin_all ON public.project_commander_threads;
CREATE POLICY project_commander_threads_admin_all
  ON public.project_commander_threads
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS project_commander_threads_service_role_all ON public.project_commander_threads;
CREATE POLICY project_commander_threads_service_role_all
  ON public.project_commander_threads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS proactive_loops_admin_all ON public.proactive_loops;
CREATE POLICY proactive_loops_admin_all
  ON public.proactive_loops
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS proactive_loops_service_role_all ON public.proactive_loops;
CREATE POLICY proactive_loops_service_role_all
  ON public.proactive_loops
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS proactive_outbox_admin_all ON public.proactive_outbox;
CREATE POLICY proactive_outbox_admin_all
  ON public.proactive_outbox
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS proactive_outbox_service_role_all ON public.proactive_outbox;
CREATE POLICY proactive_outbox_service_role_all
  ON public.proactive_outbox
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS proactive_loop_events_admin_all ON public.proactive_loop_events;
CREATE POLICY proactive_loop_events_admin_all
  ON public.proactive_loop_events
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS proactive_loop_events_service_role_all ON public.proactive_loop_events;
CREATE POLICY proactive_loop_events_service_role_all
  ON public.proactive_loop_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.project_commander_threads IS
  '先手力維持ループ用の PJ / institution と Codex commander thread の routing table。初期は admin/service_role only。';
COMMENT ON TABLE public.proactive_loops IS
  '先手力維持ループの親レコード。L2ではなく control layer として source refs / SLA / ball_owner / priority を保持する。';
COMMENT ON TABLE public.proactive_outbox IS
  'heartbeat が拾う先手力 outbox。OSは検知・期限・queueまで、draft生成は Codex/えいみ/司令塔 worker が担う。';
COMMENT ON TABLE public.proactive_loop_events IS
  '先手力維持ループの監査ログ / SLA違反ログ。責めるためでなく trigger/SLA/routing 改善に使う。';
COMMENT ON COLUMN public.proactive_loops.evidence_refs IS
  '根拠参照。table / row id / date / short snippet / hash / URL 程度に留め、メール全文・議事録全文・Slack全文を保存しない。';
COMMENT ON COLUMN public.proactive_outbox.draft_artifact_refs IS
  'Codex/司令塔 worker が生成した draft artifact の参照。本文全文ではなく path/thread/url/summary/hash を保持する。';
COMMENT ON COLUMN public.proactive_outbox.sent_to_counterpart_at IS
  'OSが外部送信した時刻ではなく、人間または司令塔が相手送付済みと確認した時刻。';
