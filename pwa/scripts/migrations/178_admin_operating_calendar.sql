-- 178_admin_operating_calendar.sql
--
-- AMD運営カレンダーの派生読み取りモデル。
-- facts / occurrences / notifications は service_role writer のみが更新し、
-- actions は admin API から append-only で記録する。

CREATE TABLE IF NOT EXISTS public.company_operating_facts (
  fact_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_key        text NOT NULL,
  value_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_kind     text NOT NULL,
  source_ref      text,
  source_hash     text NOT NULL,
  confidence      numeric(4,3) NOT NULL DEFAULT 0.500
    CHECK (confidence >= 0 AND confidence <= 1),
  valid_from      date,
  valid_to        date,
  observed_at     timestamptz NOT NULL DEFAULT now(),
  verified_at     timestamptz,
  superseded_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_operating_facts_valid_range_check
    CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  CONSTRAINT company_operating_facts_source_uniq
    UNIQUE (fact_key, source_kind, source_hash)
);

CREATE INDEX IF NOT EXISTS company_operating_facts_current_idx
  ON public.company_operating_facts(fact_key, observed_at DESC)
  WHERE superseded_at IS NULL;

CREATE TABLE IF NOT EXISTS public.company_schedule_rule_checks (
  rule_check_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key        text NOT NULL,
  rule_version    text NOT NULL,
  official_url    text NOT NULL,
  checked_at      timestamptz NOT NULL DEFAULT now(),
  content_hash    text NOT NULL,
  previous_hash   text,
  status          text NOT NULL DEFAULT 'clean'
    CHECK (status IN ('clean', 'changed', 'error', 'reviewed')),
  review_after    date,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_key, content_hash)
);

CREATE INDEX IF NOT EXISTS company_schedule_rule_checks_review_idx
  ON public.company_schedule_rule_checks(rule_key, checked_at DESC);

CREATE TABLE IF NOT EXISTS public.company_schedule_occurrences (
  occurrence_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_key      text NOT NULL,
  source_hash         text NOT NULL,
  current_version     boolean NOT NULL DEFAULT true,
  scope               text NOT NULL
    CHECK (scope IN ('company', 'project')),
  category            text NOT NULL
    CHECK (category IN ('tax', 'labor', 'contract', 'report', 'invoice', 'receipt', 'payment', 'governance')),
  event_kind          text NOT NULL,
  title               text NOT NULL,
  period_key          text,
  due_on              date,
  due_ym              text,
  date_precision      text NOT NULL DEFAULT 'unknown'
    CHECK (date_precision IN ('day', 'month', 'period', 'unknown')),
  date_kind           text NOT NULL DEFAULT '期限',
  amount_yen          bigint CHECK (amount_yen IS NULL OR amount_yen >= 0),
  amount_status       text NOT NULL DEFAULT 'unknown'
    CHECK (amount_status IN ('exact', 'estimated', 'unknown', 'not_applicable')),
  amount_role         text NOT NULL DEFAULT 'informational'
    CHECK (amount_role IN ('outgoing', 'incoming', 'contract_reference', 'informational')),
  project_id          text REFERENCES public.projects(project_id) ON DELETE SET NULL,
  owner_member_id     text REFERENCES public.members(member_id) ON DELETE SET NULL,
  source_kind         text NOT NULL,
  source_id           text,
  source_refs_json    jsonb NOT NULL DEFAULT '[]'::jsonb,
  rule_key            text,
  rule_version        text,
  official_refs_json  jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolution_href     text,
  missing_reason      text,
  source_observed_at  timestamptz,
  rule_review_after   date,
  lifecycle_status    text NOT NULL DEFAULT 'open'
    CHECK (lifecycle_status IN ('open', 'completed', 'cancelled', 'needs_source', 'superseded')),
  generation_state    text NOT NULL DEFAULT 'generated'
    CHECK (generation_state IN ('generated', 'needs_source', 'source_stale', 'generation_stale', 'rule_stale', 'superseded')),
  notification_owner text NOT NULL DEFAULT 'none'
    CHECK (notification_owner IN ('payment_obligation', 'company_schedule', 'none')),
  metadata_json       jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at        timestamptz NOT NULL DEFAULT now(),
  last_seen_at        timestamptz NOT NULL DEFAULT now(),
  superseded_at       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_schedule_occurrences_source_uniq
    UNIQUE (occurrence_key, source_hash),
  CONSTRAINT company_schedule_occurrences_day_check
    CHECK (date_precision <> 'day' OR due_on IS NOT NULL),
  CONSTRAINT company_schedule_occurrences_month_check
    CHECK (date_precision <> 'month' OR due_ym IS NOT NULL),
  CONSTRAINT company_schedule_occurrences_due_ym_check
    CHECK (due_ym IS NULL OR due_ym ~ '^[0-9]{6}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS company_schedule_occurrences_current_uniq
  ON public.company_schedule_occurrences(occurrence_key)
  WHERE current_version;
CREATE INDEX IF NOT EXISTS company_schedule_occurrences_due_idx
  ON public.company_schedule_occurrences(current_version, due_on, due_ym);
CREATE INDEX IF NOT EXISTS company_schedule_occurrences_filter_idx
  ON public.company_schedule_occurrences(current_version, category, lifecycle_status, project_id);

CREATE TABLE IF NOT EXISTS public.company_schedule_actions (
  action_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id      uuid NOT NULL REFERENCES public.company_schedule_occurrences(occurrence_id) ON DELETE RESTRICT,
  action             text NOT NULL
    CHECK (action IN ('completed', 'not_applicable', 'reopened')),
  acted_at           timestamptz NOT NULL DEFAULT now(),
  acted_by_member_id text NOT NULL REFERENCES public.members(member_id) ON DELETE RESTRICT,
  evidence_ref       text,
  reason             text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_schedule_actions_occurrence_idx
  ON public.company_schedule_actions(occurrence_id, acted_at DESC);

CREATE TABLE IF NOT EXISTS public.company_schedule_notifications (
  notification_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id      uuid NOT NULL REFERENCES public.company_schedule_occurrences(occurrence_id) ON DELETE CASCADE,
  recipient_member_id text REFERENCES public.members(member_id) ON DELETE SET NULL,
  recipient_slack_id text NOT NULL,
  schedule_key       text NOT NULL,
  stage              text NOT NULL,
  status             text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'suppressed')),
  slack_channel_id   text,
  slack_ts           text,
  error_message      text,
  attempted_at       timestamptz,
  sent_at            timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (occurrence_id, recipient_slack_id, schedule_key, stage)
);

CREATE INDEX IF NOT EXISTS company_schedule_notifications_status_idx
  ON public.company_schedule_notifications(status, attempted_at DESC);

-- The generated read model is never a browser write surface.
ALTER TABLE public.company_operating_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_schedule_rule_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_schedule_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_schedule_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_schedule_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_operating_facts_admin_select ON public.company_operating_facts;
CREATE POLICY company_operating_facts_admin_select
  ON public.company_operating_facts FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS company_operating_facts_service_all ON public.company_operating_facts;
CREATE POLICY company_operating_facts_service_all
  ON public.company_operating_facts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS company_schedule_rule_checks_admin_select ON public.company_schedule_rule_checks;
CREATE POLICY company_schedule_rule_checks_admin_select
  ON public.company_schedule_rule_checks FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS company_schedule_rule_checks_service_all ON public.company_schedule_rule_checks;
CREATE POLICY company_schedule_rule_checks_service_all
  ON public.company_schedule_rule_checks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS company_schedule_occurrences_admin_select ON public.company_schedule_occurrences;
CREATE POLICY company_schedule_occurrences_admin_select
  ON public.company_schedule_occurrences FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS company_schedule_occurrences_service_all ON public.company_schedule_occurrences;
CREATE POLICY company_schedule_occurrences_service_all
  ON public.company_schedule_occurrences FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS company_schedule_actions_admin_select ON public.company_schedule_actions;
CREATE POLICY company_schedule_actions_admin_select
  ON public.company_schedule_actions FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS company_schedule_actions_admin_insert ON public.company_schedule_actions;
DROP POLICY IF EXISTS company_schedule_actions_service_all ON public.company_schedule_actions;
CREATE POLICY company_schedule_actions_service_all
  ON public.company_schedule_actions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS company_schedule_notifications_admin_select ON public.company_schedule_notifications;
CREATE POLICY company_schedule_notifications_admin_select
  ON public.company_schedule_notifications FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS company_schedule_notifications_service_all ON public.company_schedule_notifications;
CREATE POLICY company_schedule_notifications_service_all
  ON public.company_schedule_notifications FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON public.company_operating_facts FROM anon;
REVOKE ALL ON public.company_schedule_rule_checks FROM anon;
REVOKE ALL ON public.company_schedule_occurrences FROM anon;
REVOKE ALL ON public.company_schedule_actions FROM anon;
REVOKE ALL ON public.company_schedule_notifications FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.company_operating_facts,
  public.company_schedule_rule_checks, public.company_schedule_occurrences,
  public.company_schedule_actions, public.company_schedule_notifications
  FROM authenticated;
GRANT SELECT ON public.company_operating_facts, public.company_schedule_rule_checks,
  public.company_schedule_occurrences, public.company_schedule_actions,
  public.company_schedule_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_operating_facts,
  public.company_schedule_rule_checks, public.company_schedule_occurrences,
  public.company_schedule_actions, public.company_schedule_notifications TO service_role;

COMMENT ON TABLE public.company_schedule_occurrences IS
  'Contracts, reports, invoices, payments and rules rendered into a versioned derived read model. Browser writes are prohibited.';
COMMENT ON COLUMN public.company_schedule_occurrences.amount_role IS
  'outgoing/incoming are cash totals; contract_reference and informational are never included in cash totals.';
COMMENT ON TABLE public.company_schedule_actions IS
  'Append-only execution history for occurrences whose source of truth has no completion field.';
COMMENT ON TABLE public.company_schedule_notifications IS
  'Exact-once notification ledger for notification_owner=company_schedule. Payment obligations use their existing ledger.';
