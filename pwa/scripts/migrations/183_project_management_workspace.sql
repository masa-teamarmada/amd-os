-- Reusable project management workspace for the SX COO shared surface.
--
-- The management truth is intentionally separated from raw source material.
-- This migration stores safe summaries only: no contract original, raw email
-- or meeting body, source URL, compensation, or internal negotiation memo.
--
-- Management chain:
-- objective -> outcome -> KPI / milestone -> issue -> hypothesis -> evidence
-- -> validation run -> decision -> action item.
-- Dates marked provisional are planning placeholders, not commitments.

-- -------------------------------------------------------------------------
-- Access boundary
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.amd_os_can_manage_project_shared_data(p_project_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE lower(m.email) = lower(auth.email())
      AND m.status = 'active'
      AND (m.is_admin = true OR m.os_access_scope = 'portfolio')
      AND EXISTS (SELECT 1 FROM public.projects p WHERE p.project_id = p_project_id)
  );
$$;

REVOKE ALL ON FUNCTION public.amd_os_can_manage_project_shared_data(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.amd_os_can_manage_project_shared_data(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_management_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.version = COALESCE(OLD.version, 1) + 1;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.project_management_dependency_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  predecessor_project text;
  successor_project text;
  creates_cycle boolean;
BEGIN
  SELECT project_id INTO predecessor_project
  FROM public.project_management_milestones
  WHERE id = NEW.predecessor_milestone_id;
  SELECT project_id INTO successor_project
  FROM public.project_management_milestones
  WHERE id = NEW.successor_milestone_id;
  IF predecessor_project IS NULL OR successor_project IS NULL
     OR predecessor_project <> successor_project
     OR predecessor_project <> NEW.project_id THEN
    RAISE EXCEPTION 'milestone dependency must stay inside one project' USING ERRCODE = '23514';
  END IF;

  WITH RECURSIVE reachable(milestone_id) AS (
    SELECT NEW.successor_milestone_id
    UNION
    SELECT d.successor_milestone_id
    FROM public.project_management_milestone_dependencies d
    JOIN reachable r ON r.milestone_id = d.predecessor_milestone_id
    WHERE d.project_id = NEW.project_id
      AND (TG_OP = 'INSERT' OR d.id <> NEW.id)
  )
  SELECT EXISTS (
    SELECT 1 FROM reachable WHERE milestone_id = NEW.predecessor_milestone_id
  ) INTO creates_cycle;
  IF creates_cycle THEN
    RAISE EXCEPTION 'milestone dependency would create a cycle' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.project_management_block_authenticated_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    RAISE EXCEPTION 'physical delete is disabled; use soft delete' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;

-- -------------------------------------------------------------------------
-- Objective -> outcome -> milestone / KPI
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_management_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  definition_of_done text NOT NULL,
  target_date date,
  date_certainty text NOT NULL DEFAULT 'provisional' CHECK (date_certainty IN ('confirmed', 'provisional')),
  status text NOT NULL DEFAULT 'unassessed' CHECK (status IN ('unassessed', 'active', 'completed', 'on_hold')),
  last_verified_at date NOT NULL,
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  source_kind text NOT NULL DEFAULT 'current_truth' CHECK (source_kind IN ('current_truth', 'manual', 'imported')),
  source_ref text,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, slug)
);

CREATE TABLE IF NOT EXISTS public.project_management_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  objective_id uuid NOT NULL REFERENCES public.project_management_objectives(id) ON DELETE CASCADE,
  slug text NOT NULL,
  track text NOT NULL CHECK (track IN ('business_development', 'technology_development', 'funding', 'organizational_building')),
  title text NOT NULL,
  definition_of_done text NOT NULL,
  owner_label text NOT NULL,
  status text NOT NULL DEFAULT 'unassessed' CHECK (status IN ('unassessed', 'active', 'completed', 'on_hold')),
  last_verified_at date NOT NULL,
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  source_kind text NOT NULL DEFAULT 'current_truth' CHECK (source_kind IN ('current_truth', 'manual', 'imported')),
  source_ref text,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, slug)
);

CREATE TABLE IF NOT EXISTS public.project_management_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  objective_id uuid NOT NULL REFERENCES public.project_management_objectives(id) ON DELETE CASCADE,
  outcome_id uuid NOT NULL REFERENCES public.project_management_outcomes(id) ON DELETE CASCADE,
  slug text NOT NULL,
  track text NOT NULL CHECK (track IN ('business_development', 'technology_development', 'funding', 'organizational_building')),
  title text NOT NULL,
  gate text NOT NULL,
  status text NOT NULL DEFAULT 'unassessed' CHECK (status IN ('unassessed', 'on_track', 'attention', 'at_risk', 'blocked', 'completed')),
  planned_start date,
  planned_end date,
  forecast_end date,
  actual_end date,
  progress_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  date_certainty text NOT NULL DEFAULT 'provisional' CHECK (date_certainty IN ('confirmed', 'provisional')),
  owner_member_id text REFERENCES public.members(member_id),
  owner_label text NOT NULL,
  next_deliverable text NOT NULL,
  max_issue text NOT NULL,
  completion_criteria text NOT NULL,
  completion_evidence text,
  criticality text NOT NULL DEFAULT 'high' CHECK (criticality IN ('critical', 'high', 'medium', 'low')),
  baseline_plan_version text NOT NULL DEFAULT '2026-07-14-current-truth',
  forecast_change_reason text,
  status_source text NOT NULL DEFAULT 'derived' CHECK (status_source IN ('derived', 'manual', 'override')),
  status_reason text,
  status_override_reason text,
  status_override_expires_on date,
  status_override_approved_by text,
  last_verified_at date NOT NULL,
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  source_kind text NOT NULL DEFAULT 'current_truth' CHECK (source_kind IN ('current_truth', 'manual', 'imported')),
  source_ref text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, slug),
  CHECK (
    status_source <> 'override'
    OR (
      NULLIF(trim(status_override_reason), '') IS NOT NULL
      AND status_override_expires_on IS NOT NULL
      AND NULLIF(trim(status_override_approved_by), '') IS NOT NULL
    )
  )
);

CREATE TABLE IF NOT EXISTS public.project_management_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  outcome_id uuid NOT NULL REFERENCES public.project_management_outcomes(id) ON DELETE CASCADE,
  track text NOT NULL CHECK (track IN ('business_development', 'technology_development', 'funding', 'organizational_building')),
  slug text NOT NULL,
  title text NOT NULL,
  metric_kind text NOT NULL,
  baseline numeric,
  target numeric,
  actual numeric,
  unit text NOT NULL,
  threshold numeric,
  measurement_date date,
  frequency text NOT NULL,
  source_label text NOT NULL,
  threshold_rule text NOT NULL DEFAULT 'gte' CHECK (threshold_rule IN ('gte', 'lte', 'between')),
  threshold_upper numeric,
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  last_verified_at date NOT NULL,
  source_kind text NOT NULL DEFAULT 'current_truth' CHECK (source_kind IN ('current_truth', 'manual', 'imported')),
  source_ref text,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, slug)
);

ALTER TABLE public.project_management_kpis
  ADD COLUMN IF NOT EXISTS threshold_rule text NOT NULL DEFAULT 'gte';
ALTER TABLE public.project_management_kpis
  ADD COLUMN IF NOT EXISTS threshold_upper numeric;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_kpis_threshold_rule_check'
      AND conrelid = 'public.project_management_kpis'::regclass
  ) THEN
    ALTER TABLE public.project_management_kpis
      ADD CONSTRAINT project_management_kpis_threshold_rule_check
      CHECK (threshold_rule IN ('gte', 'lte', 'between'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_kpis_threshold_range_check'
      AND conrelid = 'public.project_management_kpis'::regclass
  ) THEN
    ALTER TABLE public.project_management_kpis
      ADD CONSTRAINT project_management_kpis_threshold_range_check
      CHECK (threshold_rule <> 'between' OR (threshold IS NOT NULL AND threshold_upper IS NOT NULL AND threshold <= threshold_upper));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.project_management_milestone_kpis (
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  milestone_id uuid NOT NULL REFERENCES public.project_management_milestones(id) ON DELETE CASCADE,
  kpi_id uuid NOT NULL REFERENCES public.project_management_kpis(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (milestone_id, kpi_id)
);

CREATE TABLE IF NOT EXISTS public.project_management_milestone_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  predecessor_milestone_id uuid NOT NULL REFERENCES public.project_management_milestones(id) ON DELETE CASCADE,
  successor_milestone_id uuid NOT NULL REFERENCES public.project_management_milestones(id) ON DELETE CASCADE,
  dependency_type text NOT NULL DEFAULT 'finish_to_start' CHECK (dependency_type IN ('finish_to_start', 'start_to_start', 'finish_to_finish')),
  required boolean NOT NULL DEFAULT true,
  lag_days integer NOT NULL DEFAULT 0 CHECK (lag_days >= 0),
  note text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (predecessor_milestone_id <> successor_milestone_id),
  UNIQUE (project_id, predecessor_milestone_id, successor_milestone_id, dependency_type)
);

CREATE TABLE IF NOT EXISTS public.project_management_milestone_issue_links (
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  milestone_id uuid NOT NULL REFERENCES public.project_management_milestones(id) ON DELETE CASCADE,
  issue_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (milestone_id, issue_id)
);

CREATE TABLE IF NOT EXISTS public.project_management_milestone_partner_links (
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  milestone_id uuid NOT NULL REFERENCES public.project_management_milestones(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (milestone_id, partner_id)
);

-- -------------------------------------------------------------------------
-- Issue -> hypothesis -> evidence -> validation -> decision -> action
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_management_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES public.project_management_milestones(id) ON DELETE SET NULL,
  outcome_id uuid REFERENCES public.project_management_outcomes(id) ON DELETE SET NULL,
  slug text NOT NULL,
  track text NOT NULL CHECK (track IN ('business_development', 'technology_development', 'funding', 'organizational_building')),
  title text NOT NULL,
  knowledge_type text NOT NULL CHECK (knowledge_type IN ('fact', 'hypothesis', 'decision')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'validating', 'closed', 'on_hold')),
  owner_label text NOT NULL,
  due_date date,
  last_verified_at date NOT NULL,
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  source_kind text NOT NULL DEFAULT 'current_truth' CHECK (source_kind IN ('current_truth', 'manual', 'imported')),
  source_ref text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, slug)
);

CREATE TABLE IF NOT EXISTS public.project_management_hypotheses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  issue_id uuid NOT NULL REFERENCES public.project_management_issues(id) ON DELETE CASCADE,
  statement text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'validating', 'validated', 'rejected', 'decided', 'on_hold')),
  owner_label text NOT NULL,
  due_date date,
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  last_verified_at date NOT NULL,
  source_kind text NOT NULL DEFAULT 'current_truth' CHECK (source_kind IN ('current_truth', 'manual', 'imported')),
  source_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Multiple hypotheses may be attached to one issue.
  CHECK (length(trim(statement)) > 0)
);

CREATE TABLE IF NOT EXISTS public.project_management_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  issue_id uuid NOT NULL REFERENCES public.project_management_issues(id) ON DELETE CASCADE,
  hypothesis_id uuid REFERENCES public.project_management_hypotheses(id) ON DELETE CASCADE,
  evidence_kind text NOT NULL CHECK (evidence_kind IN ('supporting', 'counter', 'missing', 'observation')),
  summary text NOT NULL,
  observed_on date,
  source_label text NOT NULL,
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  last_verified_at date NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_management_validation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  hypothesis_id uuid NOT NULL REFERENCES public.project_management_hypotheses(id) ON DELETE CASCADE,
  validation_kind text NOT NULL,
  planned_on date,
  due_date date,
  completed_on date,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'running', 'completed', 'blocked', 'cancelled')),
  owner_label text NOT NULL,
  method text NOT NULL,
  result_summary text,
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  source_kind text NOT NULL DEFAULT 'current_truth' CHECK (source_kind IN ('current_truth', 'manual', 'imported')),
  source_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
  -- Each run is an immutable observation in a validation history.
);

CREATE TABLE IF NOT EXISTS public.project_management_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  issue_id uuid REFERENCES public.project_management_issues(id) ON DELETE SET NULL,
  hypothesis_id uuid REFERENCES public.project_management_hypotheses(id) ON DELETE SET NULL,
  title text NOT NULL,
  context text NOT NULL,
  decision_state text NOT NULL DEFAULT 'pending' CHECK (decision_state IN ('pending', 'decided', 'deferred')),
  rationale text NOT NULL,
  decision_text text,
  decided_by text,
  decided_on date,
  owner_label text NOT NULL,
  due_date date,
  is_this_week boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  last_verified_at date NOT NULL,
  source_kind text NOT NULL DEFAULT 'current_truth' CHECK (source_kind IN ('current_truth', 'manual', 'imported')),
  source_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
  -- An issue may produce multiple decisions over time.
);

CREATE TABLE IF NOT EXISTS public.project_management_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  decision_id uuid NOT NULL REFERENCES public.project_management_decisions(id) ON DELETE CASCADE,
  title text NOT NULL,
  owner_label text NOT NULL,
  due_date date,
  completion_criteria text NOT NULL DEFAULT '完了条件未確認',
  next_review_on date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'blocked')),
  completion_note text,
  completed_at date,
  last_verified_at date NOT NULL,
  source_kind text NOT NULL DEFAULT 'current_truth' CHECK (source_kind IN ('current_truth', 'manual', 'imported')),
  source_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_management_update_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid,
  update_kind text NOT NULL,
  summary text NOT NULL,
  changed_by text NOT NULL,
  changed_on date NOT NULL,
  from_status text,
  to_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------------
-- Partners, RACI, capacity, and effort linkage
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_management_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  role_label text NOT NULL,
  primary_track text CHECK (primary_track IN ('business_development', 'technology_development', 'funding', 'organizational_building')),
  relationship_stage text NOT NULL CHECK (relationship_stage IN ('candidate', 'information_exchange', 'condition_alignment', 'meeting_coordination', 'validation_preparation', 'agreement_confirmation', 'executing', 'on_hold')),
  agreement_state text NOT NULL DEFAULT 'unagreed' CHECK (agreement_state IN ('agreed', 'partial', 'unagreed')),
  agreed_scope text NOT NULL,
  unagreed_scope text NOT NULL,
  last_contact_date date,
  next_commitment text NOT NULL,
  due_date date,
  owner_label text NOT NULL,
  last_verified_at date NOT NULL,
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  source_kind text NOT NULL DEFAULT 'current_truth' CHECK (source_kind IN ('current_truth', 'manual', 'imported')),
  source_ref text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, slug)
);

CREATE TABLE IF NOT EXISTS public.project_management_partner_tracks (
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.project_management_partners(id) ON DELETE CASCADE,
  track text NOT NULL CHECK (track IN ('business_development', 'technology_development', 'funding', 'organizational_building')),
  role_label text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  PRIMARY KEY (partner_id, track)
);

CREATE TABLE IF NOT EXISTS public.project_management_partner_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.project_management_partners(id) ON DELETE CASCADE,
  title text NOT NULL,
  commitment_text text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'blocked', 'cancelled')),
  promised_on date,
  due_date date,
  completed_on date,
  owner_label text NOT NULL,
  counterparty_owner text,
  sx_owner text,
  evidence text,
  next_review_on date,
  last_verified_at date NOT NULL,
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  source_kind text NOT NULL DEFAULT 'current_truth' CHECK (source_kind IN ('current_truth', 'manual', 'imported')),
  source_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_management_raci (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  milestone_id uuid NOT NULL REFERENCES public.project_management_milestones(id) ON DELETE CASCADE,
  stakeholder_label text NOT NULL,
  responsibility_role text NOT NULL CHECK (responsibility_role IN ('R', 'A', 'C', 'I')),
  owner_label text NOT NULL,
  confirmed boolean NOT NULL DEFAULT false,
  last_verified_at date NOT NULL,
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  source_kind text NOT NULL DEFAULT 'current_truth' CHECK (source_kind IN ('current_truth', 'manual', 'imported')),
  source_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_management_capacity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  track text NOT NULL CHECK (track IN ('business_development', 'technology_development', 'funding', 'organizational_building')),
  milestone_id uuid REFERENCES public.project_management_milestones(id) ON DELETE SET NULL,
  role_label text NOT NULL,
  required_people numeric(6,2) NOT NULL DEFAULT 0 CHECK (required_people >= 0),
  confirmed_people numeric(6,2) NOT NULL DEFAULT 0 CHECK (confirmed_people >= 0),
  available_hours_week numeric(7,2),
  planned_hours_week numeric(7,2),
  measurement_date date NOT NULL,
  source_label text NOT NULL,
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  source_kind text NOT NULL DEFAULT 'current_truth' CHECK (source_kind IN ('current_truth', 'manual', 'imported')),
  source_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_weekly_effort_entries
  ADD COLUMN IF NOT EXISTS management_track text CHECK (management_track IN ('business_development', 'technology_development', 'funding', 'organizational_building')),
  ADD COLUMN IF NOT EXISTS management_milestone_id uuid REFERENCES public.project_management_milestones(id),
  ADD COLUMN IF NOT EXISTS deliverable_label text;

CREATE TABLE IF NOT EXISTS public.project_management_technical_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES public.project_management_milestones(id) ON DELETE SET NULL,
  outcome_id uuid REFERENCES public.project_management_outcomes(id) ON DELETE SET NULL,
  test_slug text NOT NULL,
  test_name text NOT NULL,
  test_condition text NOT NULL,
  target text,
  actual text,
  unit text NOT NULL,
  repetition integer CHECK (repetition IS NULL OR repetition >= 0),
  sample text,
  trl_criterion text NOT NULL,
  evidence text,
  status text NOT NULL DEFAULT 'unassessed' CHECK (status IN ('unassessed', 'planned', 'running', 'passed', 'failed', 'blocked')),
  measured_on date,
  owner_label text NOT NULL,
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  source_kind text NOT NULL DEFAULT 'current_truth' CHECK (source_kind IN ('current_truth', 'manual', 'imported')),
  source_ref text,
  deleted_at timestamptz,
  deleted_by text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, test_slug)
);

CREATE TABLE IF NOT EXISTS public.project_management_funding_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  required_amount numeric,
  secured_amount numeric,
  unconfirmed_amount numeric,
  use_summary text NOT NULL,
  burn_per_month numeric,
  runway_months numeric,
  probability numeric CHECK (probability IS NULL OR (probability >= 0 AND probability <= 1)),
  cash_condition text NOT NULL,
  source_label text NOT NULL,
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  source_kind text NOT NULL DEFAULT 'current_truth' CHECK (source_kind IN ('current_truth', 'manual', 'imported')),
  source_ref text,
  deleted_at timestamptz,
  deleted_by text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS public.project_management_organization_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  role_slug text NOT NULL,
  role_name text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  candidate text,
  commitment text,
  authority text,
  vacancy boolean NOT NULL DEFAULT true,
  join_condition text NOT NULL,
  due_date date,
  status text NOT NULL DEFAULT 'unassessed' CHECK (status IN ('unassessed', 'candidate', 'committed', 'filled', 'on_hold')),
  owner_label text NOT NULL,
  last_verified_at date NOT NULL,
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  source_kind text NOT NULL DEFAULT 'current_truth' CHECK (source_kind IN ('current_truth', 'manual', 'imported')),
  source_ref text,
  deleted_at timestamptz,
  deleted_by text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, role_slug)
);

CREATE TABLE IF NOT EXISTS public.project_management_field_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  field_name text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  source text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  verified_by text NOT NULL,
  next_review_on date,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'project_management_objectives', 'project_management_outcomes', 'project_management_milestones',
    'project_management_kpis', 'project_management_milestone_dependencies', 'project_management_issues',
    'project_management_hypotheses', 'project_management_evidence', 'project_management_validation_runs',
    'project_management_decisions', 'project_management_action_items', 'project_management_update_history',
    'project_management_partners', 'project_management_partner_tracks', 'project_management_partner_commitments',
    'project_management_raci', 'project_management_capacity'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at timestamptz', table_name);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_by text', table_name);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1', table_name);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_milestone_issue_links_issue_fk'
      AND conrelid = 'public.project_management_milestone_issue_links'::regclass
  ) THEN
    ALTER TABLE public.project_management_milestone_issue_links
      ADD CONSTRAINT project_management_milestone_issue_links_issue_fk
      FOREIGN KEY (issue_id) REFERENCES public.project_management_issues(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_milestone_partner_links_partner_fk'
      AND conrelid = 'public.project_management_milestone_partner_links'::regclass
  ) THEN
    ALTER TABLE public.project_management_milestone_partner_links
      ADD CONSTRAINT project_management_milestone_partner_links_partner_fk
      FOREIGN KEY (partner_id) REFERENCES public.project_management_partners(id) ON DELETE CASCADE;
  END IF;
END $$;

DROP TRIGGER IF EXISTS project_management_dependency_guard ON public.project_management_milestone_dependencies;
CREATE TRIGGER project_management_dependency_guard
  BEFORE INSERT OR UPDATE ON public.project_management_milestone_dependencies
  FOR EACH ROW EXECUTE FUNCTION public.project_management_dependency_guard();

CREATE OR REPLACE FUNCTION public.project_management_audit_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_json jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  new_json jsonb := to_jsonb(NEW);
  field_key text;
  entity_id_value uuid;
  project_id_value text;
  version_value integer;
  source_value text;
  verified_by_value text;
  next_review_value date;
BEGIN
  entity_id_value := (new_json ->> 'id')::uuid;
  project_id_value := new_json ->> 'project_id';
  version_value := COALESCE(NULLIF(new_json ->> 'version', '')::integer, 1);
  source_value := COALESCE(NULLIF(new_json ->> 'source_kind', ''), 'manual');
  verified_by_value := COALESCE(NULLIF(new_json ->> 'updated_by', ''), NULLIF(new_json ->> 'owner_label', ''), 'system');
  next_review_value := NULLIF(new_json ->> 'next_review_on', '')::date;
  FOR field_key IN SELECT jsonb_object_keys(new_json) LOOP
    IF field_key IN ('id', 'project_id', 'created_at', 'updated_at', 'version') THEN CONTINUE; END IF;
    IF old_json -> field_key IS DISTINCT FROM new_json -> field_key THEN
      INSERT INTO public.project_management_field_audit (
        project_id, entity_type, entity_id, field_name, old_value, new_value,
        source, version, verified_by, next_review_on
      ) VALUES (
        project_id_value, TG_TABLE_NAME, entity_id_value, field_key,
        old_json -> field_key, new_json -> field_key, source_value, version_value,
        verified_by_value, next_review_value
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- -------------------------------------------------------------------------
-- RLS / indexes / timestamps
-- -------------------------------------------------------------------------

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'project_management_objectives', 'project_management_outcomes', 'project_management_milestones',
    'project_management_kpis', 'project_management_milestone_kpis', 'project_management_milestone_dependencies',
    'project_management_milestone_issue_links', 'project_management_milestone_partner_links',
    'project_management_issues', 'project_management_hypotheses', 'project_management_evidence',
    'project_management_validation_runs', 'project_management_decisions', 'project_management_action_items',
    'project_management_update_history', 'project_management_partners', 'project_management_partner_tracks',
    'project_management_partner_commitments', 'project_management_raci', 'project_management_capacity'
    , 'project_management_technical_tests', 'project_management_funding_snapshots',
    'project_management_organization_roles', 'project_management_field_audit'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, service_role', table_name);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_member_select', table_name);
    IF table_name IN (
      'project_management_objectives', 'project_management_outcomes', 'project_management_milestones',
      'project_management_kpis', 'project_management_milestone_dependencies', 'project_management_issues',
      'project_management_hypotheses', 'project_management_evidence', 'project_management_validation_runs',
      'project_management_decisions', 'project_management_action_items', 'project_management_update_history',
      'project_management_partners', 'project_management_partner_tracks', 'project_management_partner_commitments',
      'project_management_raci', 'project_management_capacity', 'project_management_technical_tests',
      'project_management_funding_snapshots', 'project_management_organization_roles'
    ) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.amd_os_can_access_project(project_id) AND deleted_at IS NULL)', table_name || '_member_select', table_name);
    ELSE
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.amd_os_can_access_project(project_id))', table_name || '_member_select', table_name);
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_manager_insert', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id))', table_name || '_manager_insert', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_manager_update', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.amd_os_can_manage_project_shared_data(project_id)) WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id))', table_name || '_manager_update', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_service_all', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', table_name || '_service_all', table_name);
  END LOOP;
END $$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'project_management_objectives', 'project_management_outcomes', 'project_management_milestones',
    'project_management_kpis', 'project_management_validation_runs', 'project_management_decisions',
    'project_management_action_items', 'project_management_partners', 'project_management_partner_commitments',
    'project_management_raci', 'project_management_capacity', 'project_management_technical_tests',
    'project_management_funding_snapshots', 'project_management_organization_roles'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', table_name || '_touch_updated_at', table_name);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.project_management_touch_updated_at()', table_name || '_touch_updated_at', table_name);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS project_management_milestones_dates_idx ON public.project_management_milestones(project_id, planned_end, forecast_end, sort_order);
CREATE INDEX IF NOT EXISTS project_management_kpis_measurement_idx ON public.project_management_kpis(project_id, outcome_id, measurement_date);
CREATE INDEX IF NOT EXISTS project_management_dependencies_successor_idx ON public.project_management_milestone_dependencies(project_id, successor_milestone_id);
CREATE INDEX IF NOT EXISTS project_management_issues_due_idx ON public.project_management_issues(project_id, due_date, sort_order);
CREATE INDEX IF NOT EXISTS project_management_hypotheses_issue_idx ON public.project_management_hypotheses(project_id, issue_id);
CREATE INDEX IF NOT EXISTS project_management_validation_due_idx ON public.project_management_validation_runs(project_id, due_date);
CREATE INDEX IF NOT EXISTS project_management_actions_due_idx ON public.project_management_action_items(project_id, due_date, status);
CREATE INDEX IF NOT EXISTS project_management_partner_commitments_due_idx ON public.project_management_partner_commitments(project_id, due_date, status);
CREATE INDEX IF NOT EXISTS project_management_capacity_track_idx ON public.project_management_capacity(project_id, track, measurement_date);
CREATE INDEX IF NOT EXISTS project_weekly_effort_management_idx ON public.project_weekly_effort_entries(project_id, management_track, management_milestone_id, week_start DESC);

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'project_management_objectives', 'project_management_outcomes', 'project_management_milestones',
    'project_management_kpis', 'project_management_milestone_dependencies', 'project_management_issues',
    'project_management_hypotheses', 'project_management_evidence', 'project_management_validation_runs',
    'project_management_decisions', 'project_management_action_items', 'project_management_partners',
    'project_management_partner_commitments', 'project_management_raci', 'project_management_capacity',
    'project_management_technical_tests', 'project_management_funding_snapshots', 'project_management_organization_roles'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', table_name || '_block_delete', table_name);
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.project_management_block_authenticated_delete()', table_name || '_block_delete', table_name);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', table_name || '_field_audit', table_name);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.project_management_audit_fields()', table_name || '_field_audit', table_name);
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- p21 current-truth seed (2026-07-14).  All planning dates are provisional.
-- -------------------------------------------------------------------------

INSERT INTO public.project_management_objectives (
  project_id, slug, title, definition_of_done, target_date, date_certainty, status,
  last_verified_at, confidence, source_kind, source_ref
)
SELECT 'p21', 'sx-2027-founding', '2027年3月のNewCo設立ゲート',
  'PoC/TRL5・資金・体制・設立条件を分けて判定し、未解決アクションを残した状態で設立可否を決める',
  DATE '2027-03-31', 'provisional', 'unassessed', DATE '2026-07-14', 'low',
  'current_truth', 'SX現状・設立目標'
WHERE EXISTS (SELECT 1 FROM public.projects WHERE project_id = 'p21')
ON CONFLICT (project_id, slug) DO NOTHING;

WITH objective AS (
  SELECT id FROM public.project_management_objectives WHERE project_id = 'p21' AND slug = 'sx-2027-founding'
)
INSERT INTO public.project_management_outcomes (
  project_id, objective_id, slug, track, title, definition_of_done, owner_label,
  status, last_verified_at, confidence, source_kind, source_ref
)
SELECT 'p21', objective.id, seed.slug, seed.track, seed.title, seed.definition_of_done,
  seed.owner_label, 'unassessed', DATE '2026-07-14', seed.confidence, 'current_truth', '7/14経営会議・SX現状'
FROM objective
CROSS JOIN (VALUES
  ('business-outcome', 'business_development', 'PoC候補から実証へ進める', '候補先の受入条件・原価前提・EWIRの約束を揃え、実証計画へ進める', 'SX経営担当 / 研究側担当未確認', 'medium'),
  ('technology-outcome', 'technology_development', 'TRL4からTRL5へ進める', '性能・再現性・スケール・封じ込め・回収の検証条件とPoC完了条件を揃える', '研究側担当未確認 / SX経営担当', 'low'),
  ('funding-outcome', 'funding', '設立前の資金余力を確保する', '必要額・確保額・runwayを分け、未合意の資金関係を過大評価せずに次の手段を決める', 'SX経営担当', 'low'),
  ('organization-outcome', 'organizational_building', 'NewCoの役割と体制を決める', '必須役割の充足、RACI、大学側条件、知財と設立主体を分けて判定する', 'SX経営担当 / 研究側担当未確認', 'low')
) AS seed(slug, track, title, definition_of_done, owner_label, confidence)
ON CONFLICT (project_id, slug) DO NOTHING;

WITH objective AS (SELECT id FROM public.project_management_objectives WHERE project_id = 'p21' AND slug = 'sx-2027-founding'),
outcomes AS (SELECT id, slug, track FROM public.project_management_outcomes WHERE project_id = 'p21')
INSERT INTO public.project_management_milestones (
  project_id, objective_id, outcome_id, slug, track, title, gate, status,
  planned_start, planned_end, forecast_end, progress_pct, date_certainty, owner_label,
  next_deliverable, max_issue, completion_criteria, criticality, baseline_plan_version,
  forecast_change_reason, status_source, status_reason, last_verified_at, confidence,
  source_kind, source_ref, sort_order
)
SELECT 'p21', objective.id, outcomes.id, seed.slug, seed.track, seed.title, seed.gate, 'unassessed',
  seed.planned_start, seed.planned_end, seed.forecast_end, 0, 'provisional', seed.owner_label,
  seed.next_deliverable, seed.max_issue, seed.completion_criteria, seed.criticality,
  '2026-07-14-current-truth', '初期Seed。予測日は仮置きで、変更理由は未確認', 'derived',
  '初期Seedは未評価。手入力の進捗だけで順調にはしない', DATE '2026-07-14', seed.confidence,
  'current_truth', seed.source_ref, seed.sort_order
FROM objective
CROSS JOIN (VALUES
  ('business-poc-conditions', 'business_development', 'PoC候補の受入条件を揃える', '候補先の条件確認 → 実証計画', DATE '2026-07-20', DATE '2026-08-07', DATE '2026-08-14', 'SX経営担当 / 研究側担当未確認', '候補先ごとの排水・サンプル・受入条件を1枚にする', '候補先の条件と契約主体が未確認', '候補先別に排水・サンプル・受入条件・契約主体が記録され、実証計画の開始条件を判定できる', 'high', 'medium', '7/14経営会議・SX現状', 'business-outcome', 1),
  ('ewir-internal-definition', 'business_development', 'EWIRの定義と参画メリットを固める', '地域連携の説明 → 面談・検証', DATE '2026-08-01', DATE '2026-08-31', DATE '2026-09-07', 'SX経営担当', '内部定義・説明資料・候補先訪問日程を確定する', '誰を協力機関として扱うか、合意範囲が未確定', 'EWIRの定義・参画メリット・候補機関別の未合意事項が確認されている', 'high', 'medium', '7/14経営会議・SX現状', 'business-outcome', 2),
  ('cost-model-refinement', 'business_development', '処理コストを用途別に精緻化する', '原価比較 → PoC判断', DATE '2026-07-21', DATE '2026-08-28', DATE '2026-09-11', 'SX経営担当 / 技術側担当未確認', '前提値と測定方法を揃え、候補用途を比較する', '実測条件とスケール前提が不足', '用途別の処理コスト前提・実測項目・比較表が確認されている', 'high', 'low', '7/14経営会議・SX現状', 'business-outcome', 3),
  ('tech-reactor-recheck', 'technology_development', 'リアクター構成を再検証する', '構成再設計 → 実験条件', DATE '2026-07-20', DATE '2026-09-30', DATE '2026-10-16', '研究側担当未確認', 'チューブ巻き構成と評価条件を確認する', '研究側の責任者・検証条件が未確認', '再設計リアクターの評価条件・責任者・結果記録が確認されている', 'high', 'medium', '7/14経営会議・SX現状', 'technology-outcome', 4),
  ('tech-poc-gate', 'technology_development', 'オンサイトPoCをTRL5ゲートへ接続する', 'オンサイトPoC完了 → TRL5', DATE '2026-09-01', DATE '2026-12-18', DATE '2027-01-15', '研究側担当未確認 / SX経営担当', 'PoCの完了条件と評価記録を確認する', 'PoC候補・評価指標・実施主体が未確定', 'オンサイトPoCの完了条件とTRL5判定証跡が確認されている', 'critical', 'low', '7/14経営会議・SX現状', 'technology-outcome', 5),
  ('funding-step2-runway', 'funding', 'PSI STEP2と設立前資金を整理する', '研究実証の継続 → 設立前資金', DATE '2026-07-20', DATE '2026-12-25', DATE '2027-01-29', 'SX経営担当', '必要資金・支出前提・次の資金手段を並べる', '資金需要と調達条件が未確定', '必要額・確保額・runwayの定義と未合意資金の区別が確認されている', 'high', 'medium', '7/14経営会議・SX現状', 'funding-outcome', 6),
  ('funding-investor-conditions', 'funding', '投資家候補との条件を整理する', '情報交換 → 条件整理', DATE '2026-08-03', DATE '2026-11-27', DATE '2026-12-18', 'SX経営担当', '参画・リード投資・着金を分けて確認する', 'PFを含め全て未合意、投資条件が未確認', '参画・リード投資・着金・条件の段階が相手ごとに確認されている', 'high', 'low', '7/14経営会議・SX現状', 'funding-outcome', 7),
  ('org-newco-conditions', 'organizational_building', 'NewCoの設立条件と役割を整理する', '役割・知財・大学発認定 → 設立判断', DATE '2026-08-03', DATE '2027-01-29', DATE '2027-02-26', 'SX経営担当 / 研究側担当未確認', '設立主体・役割・知財・大学側条件を論点化する', 'NewCoの役割と契約主体が未合意', 'NewCoの役割・設立主体・知財・大学側条件が論点別に確認されている', 'critical', 'low', '7/14経営会議・SX現状', 'organization-outcome', 8),
  ('org-founding-gate', 'organizational_building', 'NewCo設立ゲートを判定する', 'TRL5 / PoC → 2027年3月設立', DATE '2027-02-01', DATE '2027-03-31', DATE '2027-03-31', 'SX経営担当 / 研究側担当未確認', '設立可否と未解決論点を経営会議で判定する', 'TRL5・体制・資金の必須条件が未評価', 'PoC/TRL5・資金・必須役割・設立条件の未解決アクションを含めて判定できる', 'critical', 'low', 'SX現状・設立目標', 'organization-outcome', 9)
) AS seed(slug, track, title, gate, planned_start, planned_end, forecast_end, owner_label, next_deliverable, max_issue, completion_criteria, criticality, confidence, source_ref, outcome_slug, sort_order)
JOIN outcomes ON seed.outcome_slug = outcomes.slug
ON CONFLICT (project_id, slug) DO NOTHING;

-- The dependency graph is deliberately acyclic: business/technology inputs
-- feed the PoC gate, then NewCo conditions, then the founding gate.
INSERT INTO public.project_management_milestone_dependencies (project_id, predecessor_milestone_id, successor_milestone_id, note, created_by)
SELECT 'p21', predecessor.id, successor.id, seed.note, 'current_truth'
FROM (VALUES
  ('business-poc-conditions', 'tech-poc-gate', 'PoC条件を揃えてからTRL5ゲートへ進む'),
  ('tech-reactor-recheck', 'tech-poc-gate', '構成再検証をPoCゲートへ接続する'),
  ('business-poc-conditions', 'ewir-internal-definition', '候補条件をEWIRの説明・面談へ接続する'),
  ('tech-poc-gate', 'org-newco-conditions', 'PoC/TRL5を設立条件へ接続する'),
  ('funding-step2-runway', 'org-newco-conditions', '設立前資金を設立条件へ接続する'),
  ('org-newco-conditions', 'org-founding-gate', '設立条件整理を最終ゲートへ接続する')
) AS seed(predecessor_slug, successor_slug, note)
JOIN public.project_management_milestones predecessor ON predecessor.project_id = 'p21' AND predecessor.slug = seed.predecessor_slug
JOIN public.project_management_milestones successor ON successor.project_id = 'p21' AND successor.slug = seed.successor_slug
ON CONFLICT DO NOTHING;

WITH outcome_map AS (SELECT id, slug, track FROM public.project_management_outcomes WHERE project_id = 'p21')
INSERT INTO public.project_management_kpis (
  project_id, outcome_id, track, slug, title, metric_kind, baseline, target, actual, unit,
  threshold, measurement_date, frequency, source_label, confidence, last_verified_at,
  source_kind, source_ref
)
SELECT 'p21', outcome_map.id, seed.track, seed.slug, seed.title, seed.metric_kind, seed.baseline,
  seed.target, seed.actual, seed.unit, seed.threshold, seed.measurement_date, seed.frequency,
  seed.source_label, 'unknown', DATE '2026-07-14', 'current_truth', seed.source_ref
FROM outcome_map
JOIN (VALUES
  ('business-outcome', 'business-poc-requirements', 'PoC必要条件充足率', 'poc_requirement', NULL::numeric, 100::numeric, NULL::numeric, '%', 100::numeric, NULL::date, '週次', '候補先条件確認', '7/14経営会議・PoC候補', 'business_development'),
  ('business-outcome', 'business-cost-comparison', '用途別の処理コスト比較', 'processing_cost', NULL::numeric, NULL::numeric, NULL::numeric, '円/単位', NULL::numeric, NULL::date, '月次', '原価精緻化', '7/14経営会議・原価精緻化', 'business_development'),
  ('technology-outcome', 'tech-performance', '処理性能', 'performance', NULL::numeric, NULL::numeric, NULL::numeric, '未設定', NULL::numeric, NULL::date, '検証ごと', '技術評価', '技術評価条件未確認', 'technology_development'),
  ('technology-outcome', 'tech-reproducibility', '再現性', 'reproducibility', NULL::numeric, NULL::numeric, NULL::numeric, '%', NULL::numeric, NULL::date, '検証ごと', '技術評価', '技術評価条件未確認', 'technology_development'),
  ('technology-outcome', 'tech-scale', 'スケール成立性', 'scale', NULL::numeric, NULL::numeric, NULL::numeric, '未設定', NULL::numeric, NULL::date, '検証ごと', '技術評価', '技術評価条件未確認', 'technology_development'),
  ('technology-outcome', 'tech-containment', '封じ込め', 'containment', NULL::numeric, NULL::numeric, NULL::numeric, '%', NULL::numeric, NULL::date, '検証ごと', '技術評価', '技術評価条件未確認', 'technology_development'),
  ('technology-outcome', 'tech-recovery', '回収率', 'recovery', NULL::numeric, NULL::numeric, NULL::numeric, '%', NULL::numeric, NULL::date, '検証ごと', '技術評価', '技術評価条件未確認', 'technology_development'),
  ('funding-outcome', 'funding-required-amount', '必要額', 'required_amount', NULL::numeric, NULL::numeric, NULL::numeric, '円', NULL::numeric, NULL::date, '月次', '資金計画', '資金需要未確認', 'funding'),
  ('funding-outcome', 'funding-secured-amount', '確保額', 'secured_amount', NULL::numeric, NULL::numeric, NULL::numeric, '円', NULL::numeric, NULL::date, '月次', '資金計画', '資金合意未確認', 'funding'),
  ('funding-outcome', 'funding-runway', 'runway', 'runway', NULL::numeric, NULL::numeric, NULL::numeric, '月', NULL::numeric, NULL::date, '月次', '資金計画', '資金需要未確認', 'funding'),
  ('organization-outcome', 'organization-required-role-coverage', '必須役割充足率', 'required_role_coverage', NULL::numeric, 100::numeric, NULL::numeric, '%', 100::numeric, NULL::date, '週次', 'RACI・体制確認', '研究側メンバー未確認', 'organizational_building')
) AS seed(outcome_slug, slug, title, metric_kind, baseline, target, actual, unit, threshold, measurement_date, frequency, source_label, source_ref, track)
  ON seed.outcome_slug = outcome_map.slug
ON CONFLICT (project_id, slug) DO NOTHING;

INSERT INTO public.project_management_milestone_kpis (project_id, milestone_id, kpi_id)
SELECT m.project_id, m.id, k.id
FROM public.project_management_milestones m
JOIN public.project_management_kpis k ON k.project_id = m.project_id
WHERE m.project_id = 'p21'
  AND ((m.slug IN ('business-poc-conditions', 'ewir-internal-definition') AND k.slug = 'business-poc-requirements')
    OR (m.slug = 'cost-model-refinement' AND k.slug = 'business-cost-comparison')
    OR (m.slug IN ('tech-reactor-recheck', 'tech-poc-gate') AND k.track = 'technology_development')
    OR (m.slug IN ('funding-step2-runway', 'funding-investor-conditions') AND k.track = 'funding')
    OR (m.slug IN ('org-newco-conditions', 'org-founding-gate') AND k.track = 'organizational_building'))
ON CONFLICT DO NOTHING;

WITH seed(slug, track, milestone_slug, title, knowledge_type, status, owner_label, due_date, confidence, source_ref, sort_order) AS (VALUES
  ('poc-acceptance', 'business_development', 'business-poc-conditions', 'PoC候補の受入条件は実証計画に落とせるか', 'hypothesis', 'validating', 'SX経営担当 / 研究側担当未確認', DATE '2026-07-31', 'medium', '7/14経営会議・SX現状', 10),
  ('cost-model', 'business_development', 'cost-model-refinement', '処理コストを用途別に比較できるか', 'hypothesis', 'validating', 'SX経営担当 / 技術側担当未確認', DATE '2026-08-14', 'low', '7/14経営会議・SX現状', 20),
  ('reactor-configuration', 'technology_development', 'tech-reactor-recheck', '再設計したリアクター構成で評価条件を再現できるか', 'hypothesis', 'open', '研究側担当未確認', DATE '2026-08-28', 'medium', 'SX現状・技術論点', 30),
  ('trl5-gate', 'technology_development', 'tech-poc-gate', 'オンサイトPoC完了をTRL5判定に接続できるか', 'decision', 'open', 'SX経営担当 / 研究側担当未確認', DATE '2026-09-30', 'low', 'SX現状・設立目標', 40),
  ('ewir-scope', 'business_development', 'ewir-internal-definition', 'EWIRは誰に何を約束する枠組みか', 'hypothesis', 'open', 'SX経営担当', DATE '2026-08-31', 'medium', '7/14経営会議・EWIR', 50),
  ('funding-stance', 'funding', 'funding-investor-conditions', '資金関係の現在地', 'fact', 'open', 'SX経営担当', DATE '2026-08-07', 'high', 'SX現状・資金調達', 60),
  ('newco-governance', 'organizational_building', 'org-newco-conditions', 'NewCoの役割・知財・大学側条件を決められるか', 'decision', 'open', 'SX経営担当 / 研究側担当未確認', DATE '2026-10-30', 'low', '7/14経営会議・SX現状', 70)
)
INSERT INTO public.project_management_issues (
  project_id, milestone_id, outcome_id, slug, track, title, knowledge_type, status,
  owner_label, due_date, last_verified_at, confidence, source_kind, source_ref, sort_order
)
SELECT 'p21', m.id, m.outcome_id, seed.slug, seed.track, seed.title, seed.knowledge_type,
  seed.status, seed.owner_label, seed.due_date, DATE '2026-07-14', seed.confidence,
  'current_truth', seed.source_ref, seed.sort_order
FROM seed
JOIN public.project_management_milestones m ON m.project_id = 'p21' AND m.slug = seed.milestone_slug
ON CONFLICT (project_id, slug) DO NOTHING;

WITH statements(slug, statement, next_validation) AS (VALUES
  ('poc-acceptance', '候補先の排水・サンプル・受入条件が揃えば、オンサイトPoCの完了条件を定義できる', '候補先ごとに受入条件と不足情報を確認する'),
  ('cost-model', '実測条件とスケール前提を揃えれば、候補用途の経済性を比較できる', '測定項目と前提値を技術側と確認する'),
  ('reactor-configuration', 'チューブ巻き構成の再検証で、次の実証に必要な評価条件を確定できる', '構成・評価指標・責任者を確認する'),
  ('ewir-scope', '内部定義と参画メリットが揃えば、候補企業との面談を検証へ進められる', '内部定義案と候補機関ごとの未合意を分ける')
)
INSERT INTO public.project_management_hypotheses (
  project_id, issue_id, statement, status, owner_label, due_date, confidence, last_verified_at, source_kind, source_ref
)
SELECT 'p21', i.id, statements.statement, CASE WHEN i.status = 'validating' THEN 'validating' ELSE 'open' END,
  i.owner_label, i.due_date, i.confidence, i.last_verified_at, i.source_kind, i.source_ref
FROM statements JOIN public.project_management_issues i ON i.project_id = 'p21' AND i.slug = statements.slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_management_hypotheses existing
  WHERE existing.project_id = 'p21' AND existing.issue_id = i.id AND existing.statement = statements.statement
);

WITH evidence(slug, kind, summary) AS (VALUES
  ('poc-acceptance', 'supporting', '7/14時点でPoC候補が主要論点になっている'),
  ('poc-acceptance', 'missing', '候補先ごとの条件、契約主体、実証データが未確認'),
  ('cost-model', 'supporting', '原価精緻化が7/14の経営論点として明示された'),
  ('cost-model', 'missing', '実測値・スケール前提・用途別の境界が不足'),
  ('reactor-configuration', 'supporting', 'マニホールド180kg案を外し構成を再設計している'),
  ('reactor-configuration', 'missing', '検証責任者・試験条件・結果が未確認'),
  ('ewir-scope', 'supporting', 'EWIRの定義・メリット・資料・訪問日程が7/14論点になっている'),
  ('ewir-scope', 'missing', '参画機関、約束の範囲、合意状態が未確定')
)
INSERT INTO public.project_management_evidence (
  project_id, issue_id, hypothesis_id, evidence_kind, summary, observed_on, source_label, confidence, last_verified_at, created_by
)
SELECT 'p21', i.id, h.id, evidence.kind, evidence.summary, DATE '2026-07-14', '7/14経営会議・SX現状', i.confidence, DATE '2026-07-14', 'current_truth'
FROM evidence
JOIN public.project_management_issues i ON i.project_id = 'p21' AND i.slug = evidence.slug
JOIN public.project_management_hypotheses h ON h.project_id = i.project_id AND h.issue_id = i.id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.project_management_evidence existing
  WHERE existing.project_id = 'p21'
    AND existing.issue_id = i.id
    AND existing.hypothesis_id = h.id
    AND existing.evidence_kind = evidence.kind
    AND existing.summary = evidence.summary
);

INSERT INTO public.project_management_validation_runs (
  project_id, hypothesis_id, validation_kind, planned_on, due_date, status, owner_label,
  method, confidence, source_kind, source_ref
)
SELECT 'p21', h.id, '次の検証', DATE '2026-07-19', i.due_date, CASE WHEN i.status = 'validating' THEN 'running' ELSE 'planned' END,
  i.owner_label, CASE i.slug
    WHEN 'poc-acceptance' THEN '候補先別の受入条件確認'
    WHEN 'cost-model' THEN '測定項目と前提値のすり合わせ'
    WHEN 'reactor-configuration' THEN '構成・評価指標・責任者の確認'
    ELSE '内部定義と候補機関別の未合意確認'
  END, i.confidence, 'current_truth', i.source_ref
FROM public.project_management_hypotheses h
JOIN public.project_management_issues i ON i.id = h.issue_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_management_validation_runs existing
  WHERE existing.project_id = 'p21' AND existing.hypothesis_id = h.id AND existing.validation_kind = '次の検証'
);

WITH decision_seed(slug, title, context, rationale, due_date, owner_label, is_this_week, sort_order) AS (VALUES
  ('decision-poc-conditions', 'PoC候補の不足条件を誰がいつ確認するか', '候補先の条件が揃わないまま実証計画を確定しない', '候補先・契約主体・必要条件が未確認', DATE '2026-07-31', 'SX経営担当 / 研究側担当未確認', true, 10),
  ('decision-cost-model', '処理コストの比較前提を決める', '用途別の原価精緻化に必要な実測・スケール前提を揃える', '実測条件とスケール前提が不足', DATE '2026-08-14', 'SX経営担当 / 技術側担当未確認', true, 20),
  ('decision-newco-role', 'NewCoの役割と設立判断の必須条件を分ける', 'NewCo、大学発ベンチャー認定、研究側の役割が未合意', '契約主体・知財・研究側の役割が未合意', DATE '2026-08-31', 'SX経営担当 / 研究側担当未確認', true, 30),
  ('decision-trl5-gate', 'TRL5判定に必要な証跡を決める', '未決定のTRL5を決定済みとして扱わず、必要条件を先に定義する', 'PoC候補・評価指標・実施主体が未確定', DATE '2026-09-30', 'SX経営担当 / 研究側担当未確認', false, 40)
)
INSERT INTO public.project_management_decisions (
  project_id, issue_id, hypothesis_id, title, context, decision_state, rationale,
  owner_label, due_date, is_this_week, sort_order, confidence, last_verified_at, source_kind, source_ref
)
SELECT 'p21', i.id, h.id, decision_seed.title, decision_seed.context, 'pending', decision_seed.rationale,
  decision_seed.owner_label, decision_seed.due_date, decision_seed.is_this_week, decision_seed.sort_order,
  i.confidence, DATE '2026-07-14', 'current_truth', '7/14経営会議・SX現状'
FROM decision_seed
JOIN public.project_management_issues i ON i.project_id = 'p21' AND i.slug = CASE decision_seed.slug
  WHEN 'decision-poc-conditions' THEN 'poc-acceptance'
  WHEN 'decision-cost-model' THEN 'cost-model'
  WHEN 'decision-newco-role' THEN 'newco-governance'
  WHEN 'decision-trl5-gate' THEN 'trl5-gate'
END
LEFT JOIN public.project_management_hypotheses h ON h.issue_id = i.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_management_decisions existing
  WHERE existing.project_id = 'p21' AND existing.title = decision_seed.title
);

INSERT INTO public.project_management_action_items (
  project_id, decision_id, title, owner_label, due_date, completion_criteria, next_review_on,
  status, last_verified_at, source_kind, source_ref
)
SELECT d.project_id, d.id, action.title, d.owner_label, d.due_date, action.completion_criteria, d.due_date,
  'open', DATE '2026-07-14', 'current_truth', '7/14経営会議・次アクション'
FROM (VALUES
  ('decision-poc-conditions', '候補先ごとの不足条件を一覧化する', '候補先ごとに受入条件・不足情報・確認担当が記録されている'),
  ('decision-cost-model', '処理コストの測定項目と前提値を並べる', '用途別に測定項目と前提値を比較できる'),
  ('decision-newco-role', 'NewCoの役割・設立主体・大学側条件を分ける', '役割・設立主体・大学側条件が論点別に確認されている')
) AS action(decision_slug, title, completion_criteria)
JOIN public.project_management_decisions d ON d.project_id = 'p21' AND d.title = CASE action.decision_slug
  WHEN 'decision-poc-conditions' THEN 'PoC候補の不足条件を誰がいつ確認するか'
  WHEN 'decision-cost-model' THEN '処理コストの比較前提を決める'
  ELSE 'NewCoの役割と設立判断の必須条件を分ける'
END
WHERE NOT EXISTS (SELECT 1 FROM public.project_management_action_items a WHERE a.decision_id = d.id);

INSERT INTO public.project_management_update_history (
  project_id, entity_type, update_kind, summary, changed_by, changed_on, to_status
)
SELECT 'p21', 'project', 'meeting_current_truth', '7/14経営会議でPoC候補・原価精緻化・EWIR・NewCoを現在の論点として確認した', 'current_truth', DATE '2026-07-14', 'unassessed'
WHERE EXISTS (SELECT 1 FROM public.projects WHERE project_id = 'p21')
  AND NOT EXISTS (SELECT 1 FROM public.project_management_update_history WHERE project_id = 'p21' AND update_kind = 'meeting_current_truth' AND changed_on = DATE '2026-07-14');

WITH partner_seed(slug, name, role_label, primary_track, stage, agreement_state, agreed_scope, unagreed_scope, last_contact_date, next_commitment, due_date, owner_label, confidence, sort_order) AS (VALUES
  ('ehime-university', '愛媛大学', '研究実証・大学側接続', 'technology_development', 'validation_preparation', 'partial', 'PSI STEP2の研究実証を進める関係', 'NewCoの契約主体・知財・大学発ベンチャー条件', DATE '2026-07-14', 'PoC条件と研究側責任者を確認する', DATE '2026-08-28', 'SX経営担当 / 研究側担当未確認', 'medium', 10),
  ('fc-hokuriku', 'FC北陸', 'PoC候補・受入条件確認', 'business_development', 'candidate', 'unagreed', '候補先として確認対象', '排水情報、実証条件、契約主体、実施可否', DATE '2026-07-14', '不足している候補条件を確認する', DATE '2026-07-31', 'SX経営担当 / 研究側担当未確認', 'low', 20),
  ('ewir-candidate-a', 'EWIR候補機関A', '地域連携・候補企業訪問', 'business_development', 'candidate', 'unagreed', '候補機関としての情報整理', '参画機関、約束の範囲、訪問日程、合意状態', NULL, 'EWIR定義と候補先別の次の約束を作る', DATE '2026-08-31', 'SX経営担当', 'low', 30),
  ('partners-fund', 'Partners Fund', '資金調達・事業連携の情報交換', 'funding', 'information_exchange', 'unagreed', '情報交換と候補関係', '参画、リード投資、着金、条件', DATE '2026-07-14', '調達段階と次の確認事項を分けて更新する', DATE '2026-08-07', 'SX経営担当', 'low', 40)
)
INSERT INTO public.project_management_partners (
  project_id, slug, name, role_label, primary_track, relationship_stage, agreement_state,
  agreed_scope, unagreed_scope, last_contact_date, next_commitment, due_date, owner_label,
  last_verified_at, confidence, source_kind, source_ref, sort_order
)
SELECT 'p21', partner_seed.slug, partner_seed.name, partner_seed.role_label, partner_seed.primary_track, partner_seed.stage,
  partner_seed.agreement_state, partner_seed.agreed_scope, partner_seed.unagreed_scope, partner_seed.last_contact_date,
  partner_seed.next_commitment, partner_seed.due_date, partner_seed.owner_label, DATE '2026-07-14', partner_seed.confidence,
  'current_truth', CASE partner_seed.slug WHEN 'partners-fund' THEN 'SX現状・資金調達' ELSE 'SX現状・協力機関' END, partner_seed.sort_order
FROM partner_seed
ON CONFLICT (project_id, slug) DO NOTHING;

INSERT INTO public.project_management_partner_tracks (project_id, partner_id, track, role_label, is_primary)
SELECT p.project_id, p.id, seed.track, seed.role_label, seed.is_primary
FROM (VALUES
  ('ehime-university', 'technology_development', '研究実証', true),
  ('ehime-university', 'organizational_building', '大学側条件・設立接続', false),
  ('fc-hokuriku', 'business_development', 'PoC候補', true),
  ('fc-hokuriku', 'technology_development', '受入条件・技術検証', false),
  ('ewir-candidate-a', 'business_development', '地域連携候補', true),
  ('partners-fund', 'funding', '資金調達候補', true)
) AS seed(partner_slug, track, role_label, is_primary)
JOIN public.project_management_partners p ON p.project_id = 'p21' AND p.slug = seed.partner_slug
ON CONFLICT DO NOTHING;

INSERT INTO public.project_management_partner_commitments (
  project_id, partner_id, title, commitment_text, status, promised_on, due_date,
  owner_label, counterparty_owner, sx_owner, evidence, next_review_on,
  last_verified_at, confidence, source_kind, source_ref
)
SELECT p.project_id, p.id, '次の約束', p.next_commitment, 'open', p.last_contact_date, p.due_date,
  p.owner_label, NULL, p.owner_label, p.agreed_scope, p.due_date, p.last_verified_at,
  p.confidence, p.source_kind, p.source_ref
FROM public.project_management_partners p
WHERE p.project_id = 'p21'
  AND NOT EXISTS (SELECT 1 FROM public.project_management_partner_commitments c WHERE c.partner_id = p.id);

INSERT INTO public.project_management_milestone_issue_links (project_id, milestone_id, issue_id)
SELECT i.project_id, i.milestone_id, i.id FROM public.project_management_issues i WHERE i.project_id = 'p21' AND i.milestone_id IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO public.project_management_milestone_partner_links (project_id, milestone_id, partner_id)
SELECT m.project_id, m.id, p.id
FROM public.project_management_milestones m
JOIN public.project_management_partners p ON p.project_id = m.project_id
WHERE m.project_id = 'p21' AND ((m.slug IN ('business-poc-conditions', 'tech-poc-gate') AND p.slug IN ('fc-hokuriku', 'ehime-university')) OR (m.slug = 'ewir-internal-definition' AND p.slug = 'ewir-candidate-a') OR (m.slug IN ('funding-step2-runway', 'funding-investor-conditions') AND p.slug = 'partners-fund') OR (m.slug = 'org-newco-conditions' AND p.slug = 'ehime-university'))
ON CONFLICT DO NOTHING;

INSERT INTO public.project_management_raci (
  project_id, milestone_id, stakeholder_label, responsibility_role, owner_label, confirmed,
  last_verified_at, confidence, source_kind, source_ref
)
SELECT m.project_id, m.id, m.owner_label, CASE WHEN m.owner_label LIKE '%未確認%' THEN 'R' ELSE 'A' END,
  m.owner_label, NOT (m.owner_label LIKE '%未確認%'), m.last_verified_at, m.confidence, m.source_kind, m.source_ref
FROM public.project_management_milestones m
WHERE m.project_id = 'p21'
  AND NOT EXISTS (SELECT 1 FROM public.project_management_raci r WHERE r.milestone_id = m.id AND r.stakeholder_label = m.owner_label);

INSERT INTO public.project_management_capacity (
  project_id, track, milestone_id, role_label, required_people, confirmed_people,
  available_hours_week, planned_hours_week, measurement_date, source_label, confidence, source_kind, source_ref
)
SELECT m.project_id, m.track, m.id, '研究側責任者', 1, 0, NULL, NULL, DATE '2026-07-14',
  '研究側メンバー未確認', 'unknown', 'current_truth', '7/14経営会議・体制未確認'
FROM public.project_management_milestones m
WHERE m.project_id = 'p21' AND m.sort_order IN (1, 4, 6, 8)
  AND NOT EXISTS (SELECT 1 FROM public.project_management_capacity c WHERE c.milestone_id = m.id AND c.role_label = '研究側責任者');

INSERT INTO public.project_management_technical_tests (
  project_id, milestone_id, outcome_id, test_slug, test_name, test_condition, target, actual,
  unit, repetition, sample, trl_criterion, evidence, status, measured_on, owner_label,
  confidence, source_kind, source_ref
)
SELECT 'p21', m.id, m.outcome_id, seed.test_slug, seed.test_name, seed.test_condition, NULL, NULL,
  seed.unit, NULL, NULL, seed.trl_criterion, NULL, 'unassessed', NULL, '研究側担当未確認',
  'unknown', 'current_truth', '技術評価条件未確認'
FROM (VALUES
  ('tech-performance-test', '処理性能の確認', '次のPoCで使う条件を定義', '未設定', 'TRL5に必要な性能基準を確認'),
  ('tech-reproducibility-test', '再現性の確認', '同一条件の反復試験', '%', 'TRL5に必要な再現性基準を確認'),
  ('tech-scale-test', 'スケール成立性の確認', '処理量と装置条件の対応', '未設定', 'TRL5に必要なスケール基準を確認'),
  ('tech-containment-test', '封じ込めの確認', '閉鎖系プロセス・菌体回収条件', '%', '封じ込め基準を確認'),
  ('tech-recovery-test', '回収の確認', '回収工程と回収率', '%', '回収基準を確認')
) AS seed(test_slug, test_name, test_condition, unit, trl_criterion)
JOIN public.project_management_milestones m ON m.project_id = 'p21' AND m.slug = 'tech-reactor-recheck'
ON CONFLICT (project_id, test_slug) DO NOTHING;

INSERT INTO public.project_management_funding_snapshots (
  project_id, snapshot_date, required_amount, secured_amount, unconfirmed_amount,
  use_summary, burn_per_month, runway_months, probability, cash_condition,
  source_label, confidence, source_kind, source_ref
)
SELECT 'p21', DATE '2026-07-14', NULL, NULL, NULL,
  'PSI STEP2継続・PoC・設立準備に必要な用途を確認中', NULL, NULL, NULL,
  '必要額・確保額・着金条件は未確認。PFを含む資金関係は未合意',
  '7/14経営会議・資金論点', 'unknown', 'current_truth', '資金需要・合意状態未確認'
WHERE EXISTS (SELECT 1 FROM public.projects WHERE project_id = 'p21')
ON CONFLICT (project_id, snapshot_date) DO NOTHING;

INSERT INTO public.project_management_organization_roles (
  project_id, role_slug, role_name, required, candidate, commitment, authority, vacancy,
  join_condition, due_date, status, owner_label, last_verified_at, confidence, source_kind, source_ref
)
SELECT 'p21', seed.role_slug, seed.role_name, true, NULL, NULL, seed.authority, true,
  seed.join_condition, seed.due_date, 'unassessed', 'SX経営担当 / 研究側担当未確認', DATE '2026-07-14',
  'unknown', 'current_truth', '研究側メンバー未確認'
FROM (VALUES
  ('research-owner', '研究側責任者', '技術検証・TRL5判定の責任範囲を確定', '研究側の実在メンバーと役割を確認', DATE '2026-08-28'),
  ('poc-owner', 'PoC実施責任者', '候補先条件・試験・完了条件を接続', 'PoC候補と実施主体を確認', DATE '2026-07-31'),
  ('newco-operator', 'NewCo運営責任者', '設立後の経営・大学側接続・資金判断', 'NewCoの役割と設立主体を確認', DATE '2026-10-30')
) AS seed(role_slug, role_name, authority, join_condition, due_date)
ON CONFLICT (project_id, role_slug) DO NOTHING;

COMMENT ON TABLE public.project_management_objectives IS 'Reusable project objective layer for shared management workspaces.';
COMMENT ON TABLE public.project_management_outcomes IS 'Four-track outcomes connected to an objective.';
COMMENT ON TABLE public.project_management_kpis IS 'KPI values with baseline, target, actual, unit, threshold, measurement date, frequency, source, and confidence.';
COMMENT ON TABLE public.project_management_milestone_dependencies IS 'Normalized milestone dependency DAG; a database trigger rejects cross-project edges and cycles.';
COMMENT ON TABLE public.project_management_hypotheses IS 'Hypotheses separated from issue records.';
COMMENT ON TABLE public.project_management_evidence IS 'Safe evidence summaries separated from hypotheses; no raw body or URL.';
COMMENT ON TABLE public.project_management_validation_runs IS 'Validation plans and results linked to hypotheses.';
COMMENT ON TABLE public.project_management_decisions IS 'Decision records with rationale, decision maker/date, and pending/decided state.';
COMMENT ON TABLE public.project_management_action_items IS 'Decision follow-through with owner, due date, and completion.';
COMMENT ON TABLE public.project_management_partner_commitments IS 'Partner promise history, separate from current partner stage.';
COMMENT ON TABLE public.project_management_raci IS 'Milestone RACI and confirmation status.';
COMMENT ON TABLE public.project_management_capacity IS 'Measured required/confirmed people and weekly capacity by track/milestone.';
COMMENT ON TABLE public.project_management_technical_tests IS 'Technical test conditions, targets, actuals, repetitions, samples, TRL criteria, and evidence.';
COMMENT ON TABLE public.project_management_funding_snapshots IS 'Funding snapshots for required/secured/unconfirmed cash, use, burn, runway, probability, and conditions.';
COMMENT ON TABLE public.project_management_organization_roles IS 'Required roles, candidate/commitment/authority/vacancy/join condition, and due date.';
COMMENT ON TABLE public.project_management_field_audit IS 'Field-level change audit with source, version, verifier, and next review date.';
