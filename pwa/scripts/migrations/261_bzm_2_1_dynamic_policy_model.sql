-- 261_bzm_2_1_dynamic_policy_model.sql
--
-- BZM 2.1の動的方針評価を、BZM 2.0の観測台帳を変更せずに追加する。
-- 現行運用SPSとも別の追記型台帳であり、会社・BZSF・公的支援者の
-- 目的関数、および固定方針・最適化方針を別行として保持する。
-- 欠測値を0へ補完せず、入力が閉じない評価はnot_computableのまま残す。

BEGIN;

CREATE TABLE IF NOT EXISTS public.bzm_2_1_model_revisions (
  revision_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  revision_key             text NOT NULL,
  revision_order           integer NOT NULL,
  theory_version           text NOT NULL,
  model_version            text NOT NULL,
  data_mode                text NOT NULL DEFAULT 'project',
  currency                 text NOT NULL DEFAULT 'JPY',
  valuation_date           date,
  initial_state_key        text,
  plan_deadline_months     double precision,
  evaluation_horizon_months double precision,
  discount_rate_by_objective_json jsonb,
  valuation_rule_by_objective_json jsonb,
  decision_criterion_by_objective_json jsonb,
  tie_break_rule_json      jsonb,
  uncertainty_rule_json    jsonb,
  public_fiscal_rule_ref   text,
  public_social_mandate_ref text,
  public_social_conversion_rule_ref text,
  public_aggregation_rule_ref text,
  baseline_policy_id       text,
  baseline_policy_json     jsonb,
  policy_definition_ref    text,
  measurement_status       text NOT NULL,
  information_cutoff       timestamptz NOT NULL,
  forward_validation_count integer NOT NULL DEFAULT 0,
  revision_reason          text NOT NULL,
  source_ref               text NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bzm_2_1_model_revisions_project_key_uniq
    UNIQUE (project_id, revision_key),
  CONSTRAINT bzm_2_1_model_revisions_project_order_uniq
    UNIQUE (project_id, revision_order),
  CONSTRAINT bzm_2_1_model_revisions_project_id_revision_id_uniq
    UNIQUE (project_id, revision_id),
  CONSTRAINT bzm_2_1_model_revisions_order_check CHECK (revision_order > 0),
  CONSTRAINT bzm_2_1_model_revisions_validation_count_check
    CHECK (forward_validation_count >= 0),
  CONSTRAINT bzm_2_1_model_revisions_mode_currency_check CHECK (
    data_mode IN ('project', 'synthetic') AND currency = 'JPY'
  ),
  CONSTRAINT bzm_2_1_model_revisions_horizon_check CHECK (
    (plan_deadline_months IS NULL OR plan_deadline_months >= 0)
    AND (evaluation_horizon_months IS NULL OR evaluation_horizon_months > 0)
    AND (
      plan_deadline_months IS NULL
      OR evaluation_horizon_months IS NULL
      OR plan_deadline_months <= evaluation_horizon_months
    )
    AND (
      valuation_date IS NULL
      OR valuation_date <= (information_cutoff AT TIME ZONE 'Asia/Tokyo')::date
    )
  ),
  CONSTRAINT bzm_2_1_model_revisions_json_check CHECK (
    (discount_rate_by_objective_json IS NULL OR jsonb_typeof(discount_rate_by_objective_json) = 'object')
    AND (valuation_rule_by_objective_json IS NULL OR jsonb_typeof(valuation_rule_by_objective_json) = 'object')
    AND (decision_criterion_by_objective_json IS NULL OR jsonb_typeof(decision_criterion_by_objective_json) = 'object')
    AND (tie_break_rule_json IS NULL OR jsonb_typeof(tie_break_rule_json) = 'object')
    AND (uncertainty_rule_json IS NULL OR jsonb_typeof(uncertainty_rule_json) = 'object')
    AND (baseline_policy_json IS NULL OR jsonb_typeof(baseline_policy_json) = 'object')
  ),
  CONSTRAINT bzm_2_1_model_revisions_status_check CHECK (
    measurement_status IN (
      'incomplete',
      'measurement_ready',
      'evaluated_hypothesis',
      'prospectively_validated'
    )
  ),
  CONSTRAINT bzm_2_1_model_revisions_ready_contract_check CHECK (
    measurement_status = 'incomplete'
    OR (
      valuation_date IS NOT NULL
      AND initial_state_key IS NOT NULL AND btrim(initial_state_key) <> ''
      AND plan_deadline_months IS NOT NULL
      AND evaluation_horizon_months IS NOT NULL
      AND discount_rate_by_objective_json IS NOT NULL
      AND discount_rate_by_objective_json ?& ARRAY['company', 'bzsf', 'public']
      AND valuation_rule_by_objective_json IS NOT NULL
      AND valuation_rule_by_objective_json ?& ARRAY['company', 'bzsf', 'public']
      AND valuation_rule_by_objective_json -> 'company' ->> 'taxBasis'
        IN ('pre_tax_plus_explicit_tax_payments', 'post_tax_inclusive', 'tax_exempt')
      AND valuation_rule_by_objective_json -> 'bzsf' ->> 'taxBasis'
        IN ('pre_tax_plus_explicit_tax_payments', 'post_tax_inclusive', 'tax_exempt')
      AND valuation_rule_by_objective_json -> 'public' ->> 'taxBasis'
        IN ('pre_tax_plus_explicit_tax_payments', 'post_tax_inclusive', 'tax_exempt')
      AND decision_criterion_by_objective_json IS NOT NULL
      AND decision_criterion_by_objective_json ?& ARRAY['company', 'bzsf', 'public']
      AND tie_break_rule_json IS NOT NULL
      AND uncertainty_rule_json IS NOT NULL
      AND public_fiscal_rule_ref IS NOT NULL AND btrim(public_fiscal_rule_ref) <> ''
      AND public_social_mandate_ref IS NOT NULL AND btrim(public_social_mandate_ref) <> ''
      AND public_social_conversion_rule_ref IS NOT NULL AND btrim(public_social_conversion_rule_ref) <> ''
      AND public_aggregation_rule_ref IS NOT NULL AND btrim(public_aggregation_rule_ref) <> ''
      AND baseline_policy_id IS NOT NULL AND btrim(baseline_policy_id) <> ''
      AND baseline_policy_json IS NOT NULL
      AND policy_definition_ref IS NOT NULL AND btrim(policy_definition_ref) <> ''
    )
  ),
  CONSTRAINT bzm_2_1_model_revisions_nonempty_check CHECK (
    btrim(revision_key) <> ''
    AND btrim(theory_version) <> ''
    AND btrim(model_version) <> ''
    AND btrim(revision_reason) <> ''
    AND btrim(source_ref) <> ''
  )
);

CREATE INDEX IF NOT EXISTS bzm_2_1_model_revisions_project_order_idx
  ON public.bzm_2_1_model_revisions(project_id, revision_order DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.bzm_2_1_decision_states (
  state_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id            uuid NOT NULL REFERENCES public.bzm_2_1_model_revisions(revision_id) ON DELETE CASCADE,
  state_key              text NOT NULL,
  label                  text NOT NULL,
  decision_order         integer NOT NULL DEFAULT 100,
  is_initial             boolean NOT NULL DEFAULT false,
  elapsed_months         double precision,
  current_state_json     jsonb NOT NULL DEFAULT '{}'::jsonb,
  beliefs_json           jsonb NOT NULL DEFAULT '[]'::jsonb,
  reachability_history_json jsonb NOT NULL,
  decision_controller_json jsonb NOT NULL,
  sunk_cost_million_jpy  double precision,
  remaining_cost_million_jpy double precision,
  remaining_time_months  double precision,
  available_information_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_json          jsonb NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bzm_2_1_decision_states_revision_key_uniq
    UNIQUE (revision_id, state_key),
  CONSTRAINT bzm_2_1_decision_states_state_json_check
    CHECK (
      jsonb_typeof(current_state_json) = 'object'
      AND jsonb_typeof(beliefs_json) = 'array'
      AND jsonb_typeof(reachability_history_json) = 'object'
      AND jsonb_typeof(decision_controller_json) = 'object'
      AND jsonb_typeof(available_information_json) = 'array'
      AND jsonb_typeof(evidence_json) = 'object'
    ),
  CONSTRAINT bzm_2_1_decision_states_reachability_history_check CHECK (
    reachability_history_json ?& ARRAY['goal', 'strategicSlack']
    AND jsonb_typeof(reachability_history_json -> 'goal') = 'object'
    AND jsonb_typeof(reachability_history_json -> 'strategicSlack') = 'object'
    AND (reachability_history_json -> 'goal') ?& ARRAY[
      'status', 'firstReachedAtMonths', 'evidence'
    ]
    AND (reachability_history_json -> 'strategicSlack') ?& ARRAY[
      'status', 'firstLostAtMonths', 'evidence'
    ]
    AND reachability_history_json -> 'goal' ->> 'status' IN (
      'not_reached', 'reached', 'unknown'
    )
    AND reachability_history_json -> 'strategicSlack' ->> 'status' IN (
      'available', 'lost', 'unknown'
    )
    AND jsonb_typeof(reachability_history_json -> 'goal' -> 'evidence') = 'object'
    AND jsonb_typeof(reachability_history_json -> 'strategicSlack' -> 'evidence') = 'object'
    AND (
      (
        reachability_history_json -> 'goal' ->> 'status' = 'reached'
        AND jsonb_typeof(
          reachability_history_json -> 'goal' -> 'firstReachedAtMonths'
        ) = 'number'
        AND (
          reachability_history_json -> 'goal' ->> 'firstReachedAtMonths'
        )::double precision >= 0
      )
      OR (
        reachability_history_json -> 'goal' ->> 'status' <> 'reached'
        AND jsonb_typeof(
          reachability_history_json -> 'goal' -> 'firstReachedAtMonths'
        ) = 'null'
      )
    )
    AND (
      (
        reachability_history_json -> 'strategicSlack' ->> 'status' = 'lost'
        AND jsonb_typeof(
          reachability_history_json -> 'strategicSlack' -> 'firstLostAtMonths'
        ) = 'number'
        AND (
          reachability_history_json -> 'strategicSlack' ->> 'firstLostAtMonths'
        )::double precision >= 0
      )
      OR (
        reachability_history_json -> 'strategicSlack' ->> 'status' <> 'lost'
        AND jsonb_typeof(
          reachability_history_json -> 'strategicSlack' -> 'firstLostAtMonths'
        ) = 'null'
      )
    )
  ),
  CONSTRAINT bzm_2_1_decision_states_controller_check CHECK (
    decision_controller_json ?& ARRAY[
      'controllerId', 'kind', 'objective', 'evidence'
    ]
    AND jsonb_typeof(decision_controller_json -> 'controllerId') = 'string'
    AND btrim(decision_controller_json ->> 'controllerId') <> ''
    AND decision_controller_json ->> 'kind' IN (
      'company', 'bzsf', 'public', 'joint', 'external'
    )
    AND (
      jsonb_typeof(decision_controller_json -> 'objective') = 'null'
      OR decision_controller_json ->> 'objective' IN ('company', 'bzsf', 'public')
    )
    AND jsonb_typeof(decision_controller_json -> 'evidence') = 'object'
  ),
  CONSTRAINT bzm_2_1_decision_states_number_check CHECK (
    (elapsed_months IS NULL OR elapsed_months >= 0)
    AND (sunk_cost_million_jpy IS NULL OR sunk_cost_million_jpy >= 0)
    AND (remaining_cost_million_jpy IS NULL OR remaining_cost_million_jpy >= 0)
    AND (remaining_time_months IS NULL OR remaining_time_months >= 0)
  ),
  CONSTRAINT bzm_2_1_decision_states_nonempty_check CHECK (
    btrim(state_key) <> '' AND btrim(label) <> '' AND decision_order >= 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS bzm_2_1_decision_states_one_initial_idx
  ON public.bzm_2_1_decision_states(revision_id)
  WHERE is_initial;
CREATE INDEX IF NOT EXISTS bzm_2_1_decision_states_revision_order_idx
  ON public.bzm_2_1_decision_states(revision_id, decision_order, created_at);

CREATE TABLE IF NOT EXISTS public.bzm_2_1_actions (
  action_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id              uuid NOT NULL REFERENCES public.bzm_2_1_decision_states(state_id) ON DELETE CASCADE,
  action_key            text NOT NULL,
  bundle_id             text NOT NULL,
  action_type           text NOT NULL,
  component_types       text[] NOT NULL,
  custom_components     text[] NOT NULL DEFAULT '{}',
  sequence_json         jsonb NOT NULL DEFAULT '[]'::jsonb,
  shared_resources_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  label                 text NOT NULL,
  action_order          integer NOT NULL DEFAULT 100,
  availability_status  text NOT NULL,
  availability_reason  text,
  feasibility_gate_json jsonb NOT NULL,
  authority_gate_json   jsonb NOT NULL,
  consents_json         jsonb NOT NULL DEFAULT '[]'::jsonb,
  financing_feasibility_json jsonb NOT NULL,
  duration_months       double precision,
  immediate_cost_by_objective_json jsonb NOT NULL,
  immediate_benefit_by_objective_json jsonb NOT NULL,
  required_funding_million_jpy double precision,
  cashflow_event_keys   text[] NOT NULL DEFAULT '{}',
  information_gain_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_json         jsonb NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bzm_2_1_actions_state_key_uniq UNIQUE (state_id, action_key),
  CONSTRAINT bzm_2_1_actions_type_check CHECK (
    action_type IN (
      'continue',
      'wait',
      'retry',
      'pivot',
      'scale_down',
      'scale_up',
      'license',
      'abandon'
    )
  ),
  CONSTRAINT bzm_2_1_actions_availability_check CHECK (
    availability_status IN ('available', 'unavailable', 'unknown')
  ),
  CONSTRAINT bzm_2_1_actions_bundle_check CHECK (
    cardinality(component_types) > 0
    AND action_type = ANY(component_types)
    AND component_types <@ ARRAY[
      'continue', 'wait', 'retry', 'pivot',
      'scale_down', 'scale_up', 'license', 'abandon'
    ]::text[]
    AND jsonb_typeof(sequence_json) = 'array'
    AND jsonb_typeof(shared_resources_json) = 'array'
    AND jsonb_typeof(feasibility_gate_json) = 'object'
    AND jsonb_typeof(authority_gate_json) = 'object'
    AND jsonb_typeof(consents_json) = 'array'
    AND jsonb_typeof(financing_feasibility_json) = 'object'
    AND jsonb_typeof(immediate_cost_by_objective_json) = 'object'
    AND jsonb_typeof(immediate_benefit_by_objective_json) = 'object'
    AND jsonb_typeof(information_gain_json) = 'array'
    AND jsonb_typeof(evidence_json) = 'object'
  ),
  CONSTRAINT bzm_2_1_actions_number_check CHECK (
    (duration_months IS NULL OR duration_months >= 0)
    AND (required_funding_million_jpy IS NULL OR required_funding_million_jpy >= 0)
  ),
  CONSTRAINT bzm_2_1_actions_nonempty_check CHECK (
    btrim(action_key) <> ''
    AND btrim(bundle_id) <> ''
    AND btrim(label) <> ''
    AND action_order >= 0
    AND (
      availability_status = 'available'
      OR (availability_reason IS NOT NULL AND btrim(availability_reason) <> '')
    )
  )
);

CREATE INDEX IF NOT EXISTS bzm_2_1_actions_state_order_idx
  ON public.bzm_2_1_actions(state_id, action_order, created_at);

CREATE TABLE IF NOT EXISTS public.bzm_2_1_transitions (
  transition_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id          uuid NOT NULL REFERENCES public.bzm_2_1_actions(action_id) ON DELETE CASCADE,
  transition_key     text NOT NULL,
  label              text NOT NULL,
  next_state_id      uuid REFERENCES public.bzm_2_1_decision_states(state_id) ON DELETE CASCADE,
  terminal_outcome   text,
  probability        double precision,
  goal_reached_at_months double precision,
  slack_lost_at_months double precision,
  transition_cash_flow_by_objective_json jsonb NOT NULL,
  terminal_value_by_objective_json jsonb NOT NULL,
  failure_loss_by_objective_json jsonb NOT NULL,
  cashflow_event_keys text[] NOT NULL DEFAULT '{}',
  evidence_json      jsonb NOT NULL,
  transition_order   integer NOT NULL DEFAULT 100,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bzm_2_1_transitions_action_key_uniq
    UNIQUE (action_id, transition_key),
  CONSTRAINT bzm_2_1_transitions_destination_check CHECK (
    num_nonnulls(next_state_id, terminal_outcome) = 1
    AND (terminal_outcome IS NULL OR btrim(terminal_outcome) <> '')
  ),
  CONSTRAINT bzm_2_1_transitions_terminal_outcome_check CHECK (
    terminal_outcome IS NULL OR terminal_outcome IN (
      'capital_independent', 'licensed', 'transferred', 'abandoned',
      'liquidated', 'failed', 'unresolved'
    )
  ),
  CONSTRAINT bzm_2_1_transitions_value_check CHECK (
    (probability IS NULL OR (probability >= 0 AND probability <= 1))
    AND (goal_reached_at_months IS NULL OR goal_reached_at_months >= 0)
    AND (slack_lost_at_months IS NULL OR slack_lost_at_months >= 0)
    AND jsonb_typeof(transition_cash_flow_by_objective_json) = 'object'
    AND jsonb_typeof(terminal_value_by_objective_json) = 'object'
    AND jsonb_typeof(failure_loss_by_objective_json) = 'object'
    AND jsonb_typeof(evidence_json) = 'object'
  ),
  CONSTRAINT bzm_2_1_transitions_nonempty_check CHECK (
    btrim(transition_key) <> ''
    AND btrim(label) <> ''
    AND transition_order >= 0
  )
);

CREATE INDEX IF NOT EXISTS bzm_2_1_transitions_action_order_idx
  ON public.bzm_2_1_transitions(action_id, transition_order, created_at);

-- next_stateは同じrevision内だけに閉じる。FKだけでは別版のstateを
-- 指せるため、動的方針グラフへ過去版を混ぜないよう親版を検査する。
CREATE OR REPLACE FUNCTION public.bzm_2_1_validate_transition_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  source_revision_id uuid;
  target_revision_id uuid;
BEGIN
  SELECT states.revision_id
    INTO source_revision_id
  FROM public.bzm_2_1_actions AS actions
  JOIN public.bzm_2_1_decision_states AS states
    ON states.state_id = actions.state_id
  WHERE actions.action_id = NEW.action_id;

  IF source_revision_id IS NULL THEN
    RAISE EXCEPTION 'BZM 2.1 transition source action is missing';
  END IF;

  IF NEW.next_state_id IS NOT NULL THEN
    SELECT states.revision_id
      INTO target_revision_id
    FROM public.bzm_2_1_decision_states AS states
    WHERE states.state_id = NEW.next_state_id;
    IF target_revision_id IS NULL OR target_revision_id <> source_revision_id THEN
      RAISE EXCEPTION 'BZM 2.1 transition must stay inside one revision';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bzm_2_1_transitions_revision_guard
  ON public.bzm_2_1_transitions;
CREATE TRIGGER bzm_2_1_transitions_revision_guard
BEFORE INSERT OR UPDATE OF action_id, next_state_id
ON public.bzm_2_1_transitions
FOR EACH ROW EXECUTE FUNCTION public.bzm_2_1_validate_transition_revision();

-- 支援はqや価値への独立加点ではなく、行動の費用・必要資金・遷移・
-- 終端価値を変える差分として保存する。
CREATE TABLE IF NOT EXISTS public.bzm_2_1_interventions (
  intervention_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id          uuid NOT NULL REFERENCES public.bzm_2_1_model_revisions(revision_id) ON DELETE CASCADE,
  intervention_key     text NOT NULL,
  label                text NOT NULL,
  enabled              boolean NOT NULL DEFAULT false,
  effects_json         jsonb NOT NULL,
  evidence_json        jsonb NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bzm_2_1_interventions_revision_key_uniq
    UNIQUE (revision_id, intervention_key),
  CONSTRAINT bzm_2_1_interventions_json_check CHECK (
    jsonb_typeof(effects_json) = 'array'
    AND jsonb_typeof(evidence_json) = 'object'
  ),
  CONSTRAINT bzm_2_1_interventions_nonempty_check CHECK (
    btrim(intervention_key) <> '' AND btrim(label) <> ''
  )
);

CREATE INDEX IF NOT EXISTS bzm_2_1_interventions_revision_idx
  ON public.bzm_2_1_interventions(revision_id, created_at);

-- 数値、レンジ、状態、残り費用・時間、情報獲得、遷移確率、各視点の
-- 費用・便益は、スコープ付きの行として保存する。新しい変数を列追加で
-- 発明せず、各値の欠測・根拠・情報締切を独立に追跡する。
CREATE TABLE IF NOT EXISTS public.bzm_2_1_input_observations (
  observation_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id          uuid NOT NULL REFERENCES public.bzm_2_1_model_revisions(revision_id) ON DELETE CASCADE,
  scope_kind           text NOT NULL,
  scope_key            text NOT NULL,
  parameter_key        text NOT NULL,
  symbol               text NOT NULL,
  label                text NOT NULL,
  value_json           jsonb,
  display_value        text NOT NULL,
  value_status         text NOT NULL,
  unit                 text,
  evidence_kind        text NOT NULL,
  evidence_ref         text,
  information_cutoff   timestamptz NOT NULL,
  condition_json       jsonb NOT NULL DEFAULT '{}'::jsonb,
  note                 text,
  sort_order           integer NOT NULL DEFAULT 100,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bzm_2_1_input_observations_scope_key_uniq
    UNIQUE (revision_id, scope_kind, scope_key, parameter_key),
  CONSTRAINT bzm_2_1_input_observations_scope_check CHECK (
    scope_kind IN (
      'revision', 'objective', 'state', 'action', 'transition', 'intervention'
    )
  ),
  CONSTRAINT bzm_2_1_input_observations_status_check CHECK (
    value_status IN (
      'calculated',
      'observed',
      'conditional',
      'estimated',
      'partial',
      'missing',
      'not_started',
      'not_applicable'
    )
  ),
  CONSTRAINT bzm_2_1_input_observations_evidence_check CHECK (
    evidence_kind IN (
      'calculation', 'document', 'record', 'structured_hearing',
      'synthetic', 'mixed', 'none'
    )
  ),
  CONSTRAINT bzm_2_1_input_observations_value_check CHECK (
    (
      value_status IN ('missing', 'not_started', 'not_applicable')
      AND value_json IS NULL
    )
    OR (
      value_status NOT IN ('missing', 'not_started', 'not_applicable')
      AND value_json IS NOT NULL
    )
  ),
  CONSTRAINT bzm_2_1_input_observations_source_check CHECK (
    (evidence_kind = 'none' AND evidence_ref IS NULL)
    OR (
      evidence_kind <> 'none'
      AND evidence_ref IS NOT NULL
      AND btrim(evidence_ref) <> ''
    )
  ),
  CONSTRAINT bzm_2_1_input_observations_condition_object_check
    CHECK (jsonb_typeof(condition_json) = 'object'),
  CONSTRAINT bzm_2_1_input_observations_nonempty_check CHECK (
    btrim(scope_key) <> ''
    AND btrim(parameter_key) <> ''
    AND btrim(symbol) <> ''
    AND btrim(label) <> ''
    AND btrim(display_value) <> ''
    AND sort_order >= 0
  )
);

CREATE INDEX IF NOT EXISTS bzm_2_1_input_observations_revision_scope_idx
  ON public.bzm_2_1_input_observations(
    revision_id, scope_kind, scope_key, sort_order, created_at
  );
CREATE INDEX IF NOT EXISTS bzm_2_1_input_observations_parameter_idx
  ON public.bzm_2_1_input_observations(parameter_key, created_at DESC);

-- BZM 2.1の費用・便益・資金投入・補助・税・終端価値は、このCF事象台帳を
-- 唯一の計算元にする。同じ事象を即時費用、遷移CF、終端価値へ重ねない。
-- actions/transitions/evaluationsにある金額列は、この台帳から作る派生cacheである。
CREATE OR REPLACE FUNCTION public.bzm_2_1_public_social_vector_is_valid(
  vector_json jsonb,
  parent_cutoff timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  component jsonb;
  evidence jsonb;
  status text;
BEGIN
  IF jsonb_typeof(vector_json) <> 'array' THEN
    RETURN false;
  END IF;
  FOR component IN SELECT value FROM jsonb_array_elements(vector_json)
  LOOP
    IF jsonb_typeof(component) <> 'object'
      OR NOT component ?& ARRAY[
        'componentKey', 'label', 'unit', 'quantity', 'valueStatus',
        'conversionRuleRef', 'convertedAmountMillionJpy',
        'transferTreatment', 'evidence', 'condition'
      ]
      OR jsonb_typeof(component -> 'componentKey') <> 'string'
      OR btrim(component ->> 'componentKey') = ''
      OR jsonb_typeof(component -> 'label') <> 'string'
      OR btrim(component ->> 'label') = ''
      OR jsonb_typeof(component -> 'unit') <> 'string'
      OR btrim(component ->> 'unit') = ''
      OR jsonb_typeof(component -> 'quantity') NOT IN ('number', 'null')
      OR jsonb_typeof(component -> 'convertedAmountMillionJpy') NOT IN ('number', 'null')
      OR jsonb_typeof(component -> 'condition') <> 'object'
      OR component ->> 'transferTreatment' NOT IN (
        'resource_effect', 'externality', 'distributional', 'not_applicable'
      )
    THEN
      RETURN false;
    END IF;

    status := component ->> 'valueStatus';
    evidence := component -> 'evidence';
    IF status NOT IN (
      'calculated', 'observed', 'conditional', 'estimated', 'partial',
      'missing', 'not_started', 'not_applicable'
    ) OR jsonb_typeof(evidence) <> 'object'
      OR NOT evidence ?& ARRAY['kind', 'ref', 'informationCutoff']
      OR jsonb_typeof(evidence -> 'informationCutoff') <> 'string'
      OR (evidence ->> 'informationCutoff')::timestamptz > parent_cutoff
    THEN
      RETURN false;
    END IF;

    IF status IN ('calculated', 'observed', 'conditional', 'estimated') THEN
      IF jsonb_typeof(component -> 'quantity') <> 'number'
        OR jsonb_typeof(component -> 'conversionRuleRef') <> 'string'
        OR btrim(component ->> 'conversionRuleRef') = ''
        OR jsonb_typeof(component -> 'convertedAmountMillionJpy') <> 'number'
        OR evidence ->> 'kind' = 'none'
        OR jsonb_typeof(evidence -> 'ref') <> 'string'
        OR btrim(evidence ->> 'ref') = ''
      THEN
        RETURN false;
      END IF;
    ELSE
      IF jsonb_typeof(component -> 'convertedAmountMillionJpy') <> 'null' THEN
        RETURN false;
      END IF;
    END IF;

    IF status = 'conditional' AND jsonb_object_length(component -> 'condition') = 0 THEN
      RETURN false;
    END IF;
    IF status = 'not_applicable'
      AND component ->> 'transferTreatment' <> 'not_applicable'
    THEN
      RETURN false;
    END IF;
  END LOOP;

  IF (
    SELECT count(*)
    FROM jsonb_array_elements(vector_json) AS component_a
  ) <> (
    SELECT count(DISTINCT component_a ->> 'componentKey')
    FROM jsonb_array_elements(vector_json) AS component_a
  ) THEN
    RETURN false;
  END IF;
  RETURN true;
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.bzm_2_1_public_social_vector_sum_million_jpy(
  vector_json jsonb
)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  component jsonb;
  total double precision := 0;
BEGIN
  IF jsonb_typeof(vector_json) <> 'array' THEN
    RETURN NULL;
  END IF;
  FOR component IN SELECT value FROM jsonb_array_elements(vector_json)
  LOOP
    IF component ->> 'valueStatus' = 'not_applicable' THEN
      CONTINUE;
    END IF;
    IF jsonb_typeof(component -> 'convertedAmountMillionJpy') <> 'number' THEN
      RETURN NULL;
    END IF;
    total := total + (component ->> 'convertedAmountMillionJpy')::double precision;
  END LOOP;
  RETURN total;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE TABLE IF NOT EXISTS public.bzm_2_1_cashflow_events (
  cashflow_event_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id             uuid NOT NULL REFERENCES public.bzm_2_1_model_revisions(revision_id) ON DELETE CASCADE,
  state_id                uuid REFERENCES public.bzm_2_1_decision_states(state_id) ON DELETE CASCADE,
  action_id               uuid REFERENCES public.bzm_2_1_actions(action_id) ON DELETE CASCADE,
  transition_id           uuid REFERENCES public.bzm_2_1_transitions(transition_id) ON DELETE CASCADE,
  event_key               text NOT NULL,
  economic_nature         text NOT NULL,
  economic_event_group_key text,
  perspective_leg         text,
  label                   text NOT NULL,
  owner_kind              text NOT NULL,
  owner_ref               text NOT NULL,
  counterparty_kind       text NOT NULL,
  counterparty_ref        text NOT NULL,
  scope_kind              text NOT NULL,
  scope_key               text NOT NULL,
  timing_kind             text NOT NULL,
  timing_months           double precision,
  amount                  numeric,
  currency                text NOT NULL DEFAULT 'JPY',
  model_amount_million_jpy double precision,
  conversion_rule_ref     text,
  conversion_rate_to_jpy  numeric,
  conversion_rate_date    date,
  conversion_rate_source_ref text,
  value_status            text NOT NULL,
  nominal_or_real         text NOT NULL,
  price_base_date         date,
  tax_treatment           text NOT NULL,
  tax_subject_ref         text,
  evidence_kind           text NOT NULL,
  evidence_ref            text,
  information_cutoff      timestamptz NOT NULL,
  included_in             text NOT NULL,
  perspective_attribution_json jsonb NOT NULL,
  public_aggregation_status text NOT NULL DEFAULT 'not_computable',
  public_fiscal_amount_million_jpy double precision,
  public_social_benefit_vector_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  public_social_converted_amount_million_jpy double precision,
  public_aggregated_amount_million_jpy double precision,
  public_aggregation_input_hash text,
  public_transfer_treatment text NOT NULL DEFAULT 'not_applicable',
  public_transfer_deduplication_ref text,
  semantic_duplicate_review_ref text,
  condition_json          jsonb NOT NULL DEFAULT '{}'::jsonb,
  note                    text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bzm_2_1_cashflow_events_revision_key_uniq
    UNIQUE (revision_id, event_key),
  CONSTRAINT bzm_2_1_cashflow_events_economic_nature_check CHECK (
    economic_nature IN (
      'operating', 'investing', 'financing', 'tax', 'transfer', 'social'
    )
    AND (
      economic_nature <> 'financing'
      OR NOT COALESCE(
        (perspective_attribution_json -> 'company' ->> 'included')::boolean,
        false
      )
    )
  ),
  CONSTRAINT bzm_2_1_cashflow_events_transfer_leg_check CHECK (
    (
      economic_event_group_key IS NULL
      AND perspective_leg IS NULL
      AND (
        (perspective_attribution_json -> 'company' ->> 'included')::boolean::integer
        + (perspective_attribution_json -> 'bzsf' ->> 'included')::boolean::integer
        + (perspective_attribution_json -> 'public' ->> 'included')::boolean::integer
      ) >= 0
      AND (
        NOT (perspective_attribution_json -> 'company' ->> 'included')::boolean
        OR NOT (perspective_attribution_json -> 'bzsf' ->> 'included')::boolean
        OR perspective_attribution_json -> 'company' ->> 'sign'
          = perspective_attribution_json -> 'bzsf' ->> 'sign'
      )
      AND (
        NOT (perspective_attribution_json -> 'company' ->> 'included')::boolean
        OR NOT (perspective_attribution_json -> 'public' ->> 'included')::boolean
        OR perspective_attribution_json -> 'company' ->> 'sign'
          = perspective_attribution_json -> 'public' ->> 'sign'
      )
      AND (
        NOT (perspective_attribution_json -> 'bzsf' ->> 'included')::boolean
        OR NOT (perspective_attribution_json -> 'public' ->> 'included')::boolean
        OR perspective_attribution_json -> 'bzsf' ->> 'sign'
          = perspective_attribution_json -> 'public' ->> 'sign'
      )
    )
    OR (
      economic_event_group_key IS NOT NULL
      AND btrim(economic_event_group_key) <> ''
      AND perspective_leg IN ('company', 'bzsf', 'public')
      AND (
        (perspective_attribution_json -> 'company' ->> 'included')::boolean::integer
        + (perspective_attribution_json -> 'bzsf' ->> 'included')::boolean::integer
        + (perspective_attribution_json -> 'public' ->> 'included')::boolean::integer
      ) = 1
      AND (
        perspective_attribution_json -> perspective_leg ->> 'included'
      )::boolean
    )
  ),
  CONSTRAINT bzm_2_1_cashflow_events_owner_check CHECK (
    owner_kind IN (
      'company', 'bzsf', 'public_fund', 'customer', 'supplier', 'employee',
      'university', 'investor', 'government', 'tax_authority', 'other'
    )
    AND counterparty_kind IN (
      'company', 'bzsf', 'public_fund', 'customer', 'supplier', 'employee',
      'university', 'investor', 'government', 'tax_authority', 'other'
    )
  ),
  CONSTRAINT bzm_2_1_cashflow_events_scope_check CHECK (
    scope_kind IN ('revision', 'state', 'action', 'transition', 'terminal')
    AND timing_kind IN ('action_start', 'action_end')
    AND (timing_months IS NULL OR timing_months >= 0)
    AND (
      (
        included_in IN ('immediate_cost', 'immediate_benefit')
        AND state_id IS NOT NULL
        AND action_id IS NOT NULL
        AND transition_id IS NULL
        AND scope_kind = 'action'
        AND timing_kind = 'action_start'
      )
      OR (
        included_in IN ('transition_cash_flow', 'terminal_value', 'failure_loss')
        AND state_id IS NOT NULL
        AND action_id IS NOT NULL
        AND transition_id IS NOT NULL
        AND scope_kind = 'transition'
        AND timing_kind = 'action_end'
      )
      OR included_in IN (
        'funding_constraint_only', 'sunk_cost_report_only', 'excluded'
      )
    )
  ),
  CONSTRAINT bzm_2_1_cashflow_events_status_check CHECK (
    value_status IN (
      'calculated', 'observed', 'conditional', 'estimated', 'partial',
      'missing', 'not_started', 'not_applicable'
    )
  ),
  CONSTRAINT bzm_2_1_cashflow_events_amount_check CHECK (
    (
      value_status IN ('missing', 'not_started', 'not_applicable')
      AND amount IS NULL
      AND model_amount_million_jpy IS NULL
    )
    OR (
      value_status NOT IN ('missing', 'not_started', 'not_applicable')
      AND amount IS NOT NULL
      AND amount >= 0
      AND model_amount_million_jpy IS NOT NULL
      AND model_amount_million_jpy >= 0
    )
  ),
  CONSTRAINT bzm_2_1_cashflow_events_currency_check CHECK (
    currency ~ '^[A-Z]{3}$'
    AND (
      (
        value_status IN ('missing', 'not_started', 'not_applicable')
        AND conversion_rate_to_jpy IS NULL
        AND conversion_rate_date IS NULL
        AND conversion_rate_source_ref IS NULL
        AND conversion_rule_ref IS NULL
      )
      OR (
        value_status NOT IN ('missing', 'not_started', 'not_applicable')
        AND currency = 'JPY'
        AND conversion_rate_to_jpy IS NULL
        AND conversion_rate_date IS NULL
        AND conversion_rate_source_ref IS NULL
        AND conversion_rule_ref IS NULL
        AND abs(
          model_amount_million_jpy - amount::double precision / 1000000.0
        ) <= greatest(
          0.000000001,
          abs(amount::double precision / 1000000.0) * 0.000000001
        )
      )
      OR (
        value_status NOT IN ('missing', 'not_started', 'not_applicable')
        AND currency <> 'JPY'
        AND conversion_rate_to_jpy IS NOT NULL
        AND conversion_rate_to_jpy > 0
        AND conversion_rate_date IS NOT NULL
        AND conversion_rate_date <= (
          information_cutoff AT TIME ZONE 'Asia/Tokyo'
        )::date
        AND conversion_rate_source_ref IS NOT NULL
        AND btrim(conversion_rate_source_ref) <> ''
        AND conversion_rule_ref IS NOT NULL
        AND btrim(conversion_rule_ref) <> ''
        AND abs(
          model_amount_million_jpy
          - amount::double precision * conversion_rate_to_jpy::double precision / 1000000.0
        ) <= greatest(
          0.000000001,
          abs(
            amount::double precision * conversion_rate_to_jpy::double precision / 1000000.0
          ) * 0.000000001
        )
      )
    )
  ),
  CONSTRAINT bzm_2_1_cashflow_events_price_check CHECK (
    nominal_or_real IN ('nominal', 'real', 'not_applicable', 'unknown')
    AND (nominal_or_real <> 'real' OR price_base_date IS NOT NULL)
    AND tax_treatment IN (
      'pre_tax', 'post_tax', 'tax_payment', 'tax_exempt',
      'not_applicable', 'unknown'
    )
    AND (
      value_status NOT IN ('calculated', 'observed', 'conditional')
      OR (
        nominal_or_real <> 'unknown'
        AND tax_treatment <> 'unknown'
      )
    )
    AND (
      nominal_or_real <> 'unknown'
      OR value_status IN ('missing', 'not_started', 'partial')
    )
    AND (
      tax_treatment <> 'unknown'
      OR value_status IN ('missing', 'not_started', 'partial')
    )
    AND (
      tax_treatment <> 'tax_payment'
      OR (
        tax_subject_ref IS NOT NULL
        AND btrim(tax_subject_ref) <> ''
      )
    )
    AND (
      (
        nominal_or_real <> 'not_applicable'
        AND tax_treatment <> 'not_applicable'
        AND value_status <> 'not_applicable'
      )
      OR (
        note IS NOT NULL
        AND btrim(note) <> ''
        AND evidence_kind <> 'none'
      )
    )
  ),
  CONSTRAINT bzm_2_1_cashflow_events_evidence_check CHECK (
    evidence_kind IN (
      'calculation', 'document', 'record', 'structured_hearing',
      'synthetic', 'mixed', 'none'
    )
    AND (
      (evidence_kind = 'none' AND evidence_ref IS NULL)
      OR (
        evidence_kind <> 'none'
        AND evidence_ref IS NOT NULL
        AND btrim(evidence_ref) <> ''
      )
    )
    AND (
      value_status IN ('missing', 'not_started')
      OR evidence_kind <> 'none'
    )
  ),
  CONSTRAINT bzm_2_1_cashflow_events_included_once_check CHECK (
    included_in IN (
      'immediate_cost', 'immediate_benefit', 'transition_cash_flow',
      'terminal_value', 'failure_loss',
      'funding_constraint_only', 'sunk_cost_report_only', 'excluded'
    )
  ),
  CONSTRAINT bzm_2_1_cashflow_events_attribution_check CHECK (
    jsonb_typeof(perspective_attribution_json) = 'object'
    AND perspective_attribution_json ?& ARRAY['company', 'bzsf', 'public']
    AND jsonb_typeof(perspective_attribution_json -> 'company') = 'object'
    AND jsonb_typeof(perspective_attribution_json -> 'bzsf') = 'object'
    AND jsonb_typeof(perspective_attribution_json -> 'public') = 'object'
    AND (perspective_attribution_json -> 'company') ?& ARRAY['included', 'sign', 'attribution']
    AND (perspective_attribution_json -> 'bzsf') ?& ARRAY['included', 'sign', 'attribution']
    AND (perspective_attribution_json -> 'public') ?& ARRAY['included', 'sign', 'attribution']
    AND jsonb_typeof(perspective_attribution_json -> 'company' -> 'included') = 'boolean'
    AND jsonb_typeof(perspective_attribution_json -> 'bzsf' -> 'included') = 'boolean'
    AND jsonb_typeof(perspective_attribution_json -> 'public' -> 'included') = 'boolean'
    AND jsonb_typeof(perspective_attribution_json -> 'company' -> 'sign') IN ('number', 'null')
    AND jsonb_typeof(perspective_attribution_json -> 'bzsf' -> 'sign') IN ('number', 'null')
    AND jsonb_typeof(perspective_attribution_json -> 'public' -> 'sign') IN ('number', 'null')
    AND jsonb_typeof(perspective_attribution_json -> 'company' -> 'attribution') = 'string'
    AND jsonb_typeof(perspective_attribution_json -> 'bzsf' -> 'attribution') = 'string'
    AND jsonb_typeof(perspective_attribution_json -> 'public' -> 'attribution') = 'string'
    AND (
      (
        (perspective_attribution_json -> 'company' ->> 'included')::boolean
        AND perspective_attribution_json -> 'company' ->> 'sign' IN ('-1', '1')
      )
      OR (
        NOT (perspective_attribution_json -> 'company' ->> 'included')::boolean
        AND jsonb_typeof(perspective_attribution_json -> 'company' -> 'sign') = 'null'
      )
    )
    AND (
      (
        (perspective_attribution_json -> 'bzsf' ->> 'included')::boolean
        AND perspective_attribution_json -> 'bzsf' ->> 'sign' IN ('-1', '1')
      )
      OR (
        NOT (perspective_attribution_json -> 'bzsf' ->> 'included')::boolean
        AND jsonb_typeof(perspective_attribution_json -> 'bzsf' -> 'sign') = 'null'
      )
    )
    AND (
      (
        (perspective_attribution_json -> 'public' ->> 'included')::boolean
        AND perspective_attribution_json -> 'public' ->> 'sign' IN ('-1', '1')
      )
      OR (
        NOT (perspective_attribution_json -> 'public' ->> 'included')::boolean
        AND jsonb_typeof(perspective_attribution_json -> 'public' -> 'sign') = 'null'
      )
    )
    AND btrim(perspective_attribution_json -> 'company' ->> 'attribution') <> ''
    AND btrim(perspective_attribution_json -> 'bzsf' ->> 'attribution') <> ''
    AND btrim(perspective_attribution_json -> 'public' ->> 'attribution') <> ''
    AND (
      included_in NOT IN ('immediate_cost', 'immediate_benefit', 'failure_loss')
      OR NOT (perspective_attribution_json -> 'company' ->> 'included')::boolean
      OR (
        included_in = 'immediate_benefit'
        AND perspective_attribution_json -> 'company' ->> 'sign' = '1'
      )
      OR (
        included_in IN ('immediate_cost', 'failure_loss')
        AND perspective_attribution_json -> 'company' ->> 'sign' = '-1'
      )
    )
    AND (
      included_in NOT IN ('immediate_cost', 'immediate_benefit', 'failure_loss')
      OR NOT (perspective_attribution_json -> 'bzsf' ->> 'included')::boolean
      OR (
        included_in = 'immediate_benefit'
        AND perspective_attribution_json -> 'bzsf' ->> 'sign' = '1'
      )
      OR (
        included_in IN ('immediate_cost', 'failure_loss')
        AND perspective_attribution_json -> 'bzsf' ->> 'sign' = '-1'
      )
    )
    AND (
      included_in NOT IN ('immediate_cost', 'immediate_benefit', 'failure_loss')
      OR NOT (perspective_attribution_json -> 'public' ->> 'included')::boolean
      OR (
        included_in = 'immediate_benefit'
        AND perspective_attribution_json -> 'public' ->> 'sign' = '1'
      )
      OR (
        included_in IN ('immediate_cost', 'failure_loss')
        AND perspective_attribution_json -> 'public' ->> 'sign' = '-1'
      )
    )
  ),
  CONSTRAINT bzm_2_1_cashflow_events_json_check CHECK (
    jsonb_typeof(condition_json) = 'object'
    AND (
      value_status <> 'conditional'
      OR jsonb_object_length(condition_json) > 0
    )
  ),
  CONSTRAINT bzm_2_1_cashflow_events_public_components_check CHECK (
    public_aggregation_status IN ('not_applicable', 'not_computable', 'complete')
    AND public_transfer_treatment IN (
      'not_applicable', 'not_transfer',
      'fiscal_transfer_excluded_from_social',
      'real_resource_effect', 'externality'
    )
    AND public.bzm_2_1_public_social_vector_is_valid(
      public_social_benefit_vector_json,
      information_cutoff
    )
    AND (
      (
        NOT (perspective_attribution_json -> 'public' ->> 'included')::boolean
        AND public_aggregation_status = 'not_applicable'
        AND public_fiscal_amount_million_jpy IS NULL
        AND jsonb_array_length(public_social_benefit_vector_json) = 0
        AND public_social_converted_amount_million_jpy IS NULL
        AND public_aggregated_amount_million_jpy IS NULL
        AND public_aggregation_input_hash IS NULL
        AND public_transfer_treatment = 'not_applicable'
        AND public_transfer_deduplication_ref IS NULL
      )
      OR (
        (perspective_attribution_json -> 'public' ->> 'included')::boolean
        AND public_aggregation_status = 'not_computable'
        AND public_aggregated_amount_million_jpy IS NULL
        AND public_aggregation_input_hash IS NULL
      )
      OR (
        (perspective_attribution_json -> 'public' ->> 'included')::boolean
        AND public_aggregation_status = 'complete'
        AND public_fiscal_amount_million_jpy IS NOT NULL
        AND public_social_converted_amount_million_jpy IS NOT NULL
        AND public_aggregated_amount_million_jpy IS NOT NULL
        AND public_aggregation_input_hash ~ '^[0-9a-f]{64}$'
        AND (
          public_aggregated_amount_million_jpy = 0
          OR (
            perspective_attribution_json -> 'public' ->> 'sign' = '1'
            AND public_aggregated_amount_million_jpy > 0
          )
          OR (
            perspective_attribution_json -> 'public' ->> 'sign' = '-1'
            AND public_aggregated_amount_million_jpy < 0
          )
        )
        AND abs(
          public_social_converted_amount_million_jpy
          - public.bzm_2_1_public_social_vector_sum_million_jpy(
              public_social_benefit_vector_json
            )
        ) <= greatest(
          0.000000001,
          abs(public_social_converted_amount_million_jpy) * 0.000000001
        )
        AND abs(
          public_aggregated_amount_million_jpy
          - (
              public_fiscal_amount_million_jpy
              + public_social_converted_amount_million_jpy
            )
        ) <= greatest(
          0.000000001,
          abs(public_aggregated_amount_million_jpy) * 0.000000001
        )
        AND NOT jsonb_path_exists(
          public_social_benefit_vector_json,
          '$[*] ? (@.valueStatus != "calculated" && @.valueStatus != "observed" && @.valueStatus != "conditional" && @.valueStatus != "estimated" && @.valueStatus != "not_applicable")'
        )
      )
    )
    AND (
      public_transfer_treatment <> 'fiscal_transfer_excluded_from_social'
      OR (
        jsonb_array_length(public_social_benefit_vector_json) = 0
        AND public_social_converted_amount_million_jpy = 0
        AND public_transfer_deduplication_ref IS NOT NULL
        AND btrim(public_transfer_deduplication_ref) <> ''
      )
    )
    AND (
      public_fiscal_amount_million_jpy IS NULL
      OR public_fiscal_amount_million_jpy = 0
      OR jsonb_array_length(public_social_benefit_vector_json) = 0
      OR (
        public_transfer_deduplication_ref IS NOT NULL
        AND btrim(public_transfer_deduplication_ref) <> ''
      )
    )
    AND (
      semantic_duplicate_review_ref IS NULL
      OR btrim(semantic_duplicate_review_ref) <> ''
    )
  ),
  CONSTRAINT bzm_2_1_cashflow_events_nonempty_check CHECK (
    btrim(event_key) <> ''
    AND btrim(label) <> ''
    AND btrim(owner_ref) <> ''
    AND btrim(counterparty_ref) <> ''
    AND btrim(scope_key) <> ''
  )
);

CREATE INDEX IF NOT EXISTS bzm_2_1_cashflow_events_revision_scope_idx
  ON public.bzm_2_1_cashflow_events(
    revision_id, scope_kind, scope_key, timing_months, created_at
  );
CREATE INDEX IF NOT EXISTS bzm_2_1_cashflow_events_event_key_idx
  ON public.bzm_2_1_cashflow_events(event_key, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS bzm_2_1_cashflow_events_group_leg_uniq
  ON public.bzm_2_1_cashflow_events(
    revision_id, economic_event_group_key, perspective_leg
  )
  WHERE economic_event_group_key IS NOT NULL;

-- CF事象のrevision → state → action → transitionを同じ親鎖へ固定する。
-- 個別FKだけでは別revision・別actionのIDを組み合わせられるため、計算前に拒否する。
CREATE OR REPLACE FUNCTION public.bzm_2_1_validate_cashflow_parent_chain()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  parent_revision_id uuid;
  parent_state_id uuid;
  parent_action_id uuid;
BEGIN
  IF NEW.state_id IS NOT NULL THEN
    SELECT states.revision_id
      INTO parent_revision_id
    FROM public.bzm_2_1_decision_states AS states
    WHERE states.state_id = NEW.state_id;
    IF parent_revision_id IS NULL OR parent_revision_id <> NEW.revision_id THEN
      RAISE EXCEPTION 'BZM 2.1 CF state must belong to the event revision';
    END IF;
  END IF;

  IF NEW.action_id IS NOT NULL THEN
    SELECT actions.state_id
      INTO parent_state_id
    FROM public.bzm_2_1_actions AS actions
    WHERE actions.action_id = NEW.action_id;
    IF NEW.state_id IS NULL OR parent_state_id IS NULL OR parent_state_id <> NEW.state_id THEN
      RAISE EXCEPTION 'BZM 2.1 CF action must belong to the event state';
    END IF;
  END IF;

  IF NEW.transition_id IS NOT NULL THEN
    SELECT transitions.action_id
      INTO parent_action_id
    FROM public.bzm_2_1_transitions AS transitions
    WHERE transitions.transition_id = NEW.transition_id;
    IF NEW.action_id IS NULL OR parent_action_id IS NULL OR parent_action_id <> NEW.action_id THEN
      RAISE EXCEPTION 'BZM 2.1 CF transition must belong to the event action';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bzm_2_1_cashflow_parent_chain_guard
  ON public.bzm_2_1_cashflow_events;
CREATE TRIGGER bzm_2_1_cashflow_parent_chain_guard
BEFORE INSERT OR UPDATE OF revision_id, state_id, action_id, transition_id
ON public.bzm_2_1_cashflow_events
FOR EACH ROW EXECUTE FUNCTION public.bzm_2_1_validate_cashflow_parent_chain();

-- 公的scalarを保存する場合だけ、同じ版に4規則が事前登録済みであることを要求する。
CREATE OR REPLACE FUNCTION public.bzm_2_1_validate_public_aggregation_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  revision_record public.bzm_2_1_model_revisions%ROWTYPE;
BEGIN
  IF NEW.public_aggregation_status <> 'complete' THEN
    RETURN NEW;
  END IF;
  SELECT * INTO revision_record
  FROM public.bzm_2_1_model_revisions
  WHERE revision_id = NEW.revision_id;
  IF revision_record.public_fiscal_rule_ref IS NULL
    OR btrim(revision_record.public_fiscal_rule_ref) = ''
    OR revision_record.public_social_mandate_ref IS NULL
    OR btrim(revision_record.public_social_mandate_ref) = ''
    OR revision_record.public_social_conversion_rule_ref IS NULL
    OR btrim(revision_record.public_social_conversion_rule_ref) = ''
    OR revision_record.public_aggregation_rule_ref
      <> 'bzm2.1:public=fiscal+social_converted:v0.1'
  THEN
    RAISE EXCEPTION 'BZM 2.1 public scalar requires all four preregistered public rules';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bzm_2_1_cashflow_public_aggregation_guard
  ON public.bzm_2_1_cashflow_events;
CREATE TRIGGER bzm_2_1_cashflow_public_aggregation_guard
BEFORE INSERT OR UPDATE OF
  revision_id,
  public_aggregation_status,
  public_aggregated_amount_million_jpy,
  public_aggregation_input_hash
ON public.bzm_2_1_cashflow_events
FOR EACH ROW EXECUTE FUNCTION public.bzm_2_1_validate_public_aggregation_rules();

-- 各行は「ある状態で、ある行動を選んだとき」の評価であり、三つの
-- 目的関数を混ぜない。条件付き会社価値、必要資金、失敗損失、撤退・
-- 転用・ライセンス価値を同じ行で明示的に分ける。
CREATE TABLE IF NOT EXISTS public.bzm_2_1_action_evaluations (
  action_evaluation_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id                           uuid NOT NULL REFERENCES public.bzm_2_1_actions(action_id) ON DELETE CASCADE,
  objective_kind                      text NOT NULL,
  selection_objective                 text,
  is_selected                         boolean NOT NULL DEFAULT false,
  exclusion_reason                    text,
  evaluation_status                   text NOT NULL,
  goal_probability                    double precision,
  plan_deadline_goal_probability      double precision,
  conditional_goal_value              double precision,
  value_unit                          text,
  expected_cumulative_funding_million_jpy double precision,
  expected_failure_loss_million_jpy   double precision,
  expected_exit_value_million_jpy     double precision,
  expected_terminal_value_million_jpy double precision,
  expected_cost_million_jpy           double precision,
  expected_benefit_million_jpy        double precision,
  expected_net_value                  double precision,
  public_aggregation_status           text NOT NULL DEFAULT 'not_applicable',
  public_fiscal_value_million_jpy      double precision,
  public_social_components_json       jsonb NOT NULL DEFAULT '[]'::jsonb,
  public_social_monetized_value_million_jpy double precision,
  public_aggregated_value_million_jpy double precision,
  public_aggregation_input_hash       text,
  uncertainty_json                    jsonb NOT NULL DEFAULT '{}'::jsonb,
  issues_json                         jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_inputs                      text[] NOT NULL DEFAULT '{}',
  engine_version                      text,
  input_hash                          text,
  information_cutoff                  timestamptz NOT NULL,
  created_at                          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bzm_2_1_action_evaluations_action_objective_uniq
    UNIQUE (action_id, objective_kind),
  CONSTRAINT bzm_2_1_action_evaluations_objective_check CHECK (
    objective_kind IN ('company', 'bzsf', 'public')
    AND (
      selection_objective IS NULL
      OR selection_objective IN ('company', 'bzsf', 'public')
    )
    AND (NOT is_selected OR selection_objective IS NOT NULL)
    AND (
      exclusion_reason IS NULL
      OR btrim(exclusion_reason) <> ''
    )
  ),
  CONSTRAINT bzm_2_1_action_evaluations_status_check CHECK (
    evaluation_status IN (
      'not_computable', 'partial', 'computed', 'decision_indeterminate'
    )
  ),
  CONSTRAINT bzm_2_1_action_evaluations_q_check CHECK (
    (goal_probability IS NULL OR (goal_probability >= 0 AND goal_probability <= 1))
    AND (
      plan_deadline_goal_probability IS NULL
      OR (plan_deadline_goal_probability >= 0 AND plan_deadline_goal_probability <= 1)
    )
    AND (
      goal_probability IS NULL
      OR plan_deadline_goal_probability IS NULL
      OR plan_deadline_goal_probability <= goal_probability
    )
    AND (
      evaluation_status <> 'computed'
      OR (goal_probability = 0 AND conditional_goal_value IS NULL)
      OR (goal_probability > 0 AND conditional_goal_value IS NOT NULL)
    )
  ),
  CONSTRAINT bzm_2_1_action_evaluations_nonnegative_check CHECK (
    (
      expected_cumulative_funding_million_jpy IS NULL
      OR expected_cumulative_funding_million_jpy >= 0
    )
    AND (expected_failure_loss_million_jpy IS NULL OR expected_failure_loss_million_jpy >= 0)
    AND (expected_cost_million_jpy IS NULL OR expected_cost_million_jpy >= 0)
    AND (expected_benefit_million_jpy IS NULL OR expected_benefit_million_jpy >= 0)
    AND jsonb_typeof(uncertainty_json) = 'object'
    AND jsonb_typeof(issues_json) = 'array'
  ),
  CONSTRAINT bzm_2_1_action_evaluations_public_check CHECK (
    public_aggregation_status IN ('not_applicable', 'not_computable', 'complete')
    AND public.bzm_2_1_public_social_vector_is_valid(
      public_social_components_json,
      information_cutoff
    )
    AND (
      (
        objective_kind <> 'public'
        AND public_aggregation_status = 'not_applicable'
        AND public_fiscal_value_million_jpy IS NULL
        AND jsonb_array_length(public_social_components_json) = 0
        AND public_social_monetized_value_million_jpy IS NULL
        AND public_aggregated_value_million_jpy IS NULL
        AND public_aggregation_input_hash IS NULL
      )
      OR (
        objective_kind = 'public'
        AND evaluation_status <> 'computed'
        AND public_aggregation_status = 'not_computable'
        AND public_aggregated_value_million_jpy IS NULL
        AND public_aggregation_input_hash IS NULL
      )
      OR (
        objective_kind = 'public'
        AND evaluation_status = 'computed'
        AND public_aggregation_status = 'complete'
        AND public_fiscal_value_million_jpy IS NOT NULL
        AND public_social_monetized_value_million_jpy IS NOT NULL
        AND public_aggregated_value_million_jpy IS NOT NULL
        AND public_aggregation_input_hash ~ '^[0-9a-f]{64}$'
        AND abs(
          public_social_monetized_value_million_jpy
          - public.bzm_2_1_public_social_vector_sum_million_jpy(
              public_social_components_json
            )
        ) <= greatest(
          0.000000001,
          abs(public_social_monetized_value_million_jpy) * 0.000000001
        )
        AND abs(
          public_aggregated_value_million_jpy
          - (
              public_fiscal_value_million_jpy
              + public_social_monetized_value_million_jpy
            )
        ) <= greatest(
          0.000000001,
          abs(public_aggregated_value_million_jpy) * 0.000000001
        )
        AND abs(expected_net_value - public_aggregated_value_million_jpy)
          <= greatest(0.000000001, abs(expected_net_value) * 0.000000001)
      )
    )
  ),
  CONSTRAINT bzm_2_1_action_evaluations_completeness_check CHECK (
    (
      evaluation_status = 'not_computable'
      AND conditional_goal_value IS NULL
      AND expected_net_value IS NULL
      AND value_unit IS NULL
      AND expected_cumulative_funding_million_jpy IS NULL
      AND expected_failure_loss_million_jpy IS NULL
      AND expected_exit_value_million_jpy IS NULL
      AND expected_terminal_value_million_jpy IS NULL
      AND expected_cost_million_jpy IS NULL
      AND expected_benefit_million_jpy IS NULL
      AND cardinality(missing_inputs) > 0
      AND (
        (goal_probability IS NULL AND plan_deadline_goal_probability IS NULL)
        OR (
          objective_kind IN ('bzsf', 'public')
          AND goal_probability IS NOT NULL
          AND plan_deadline_goal_probability IS NOT NULL
          AND selection_objective IS NOT NULL
          AND engine_version IS NOT NULL
          AND btrim(engine_version) <> ''
          AND input_hash IS NOT NULL
          AND btrim(input_hash) <> ''
        )
      )
    )
    OR (
      evaluation_status = 'partial'
      AND cardinality(missing_inputs) > 0
    )
    OR (
      evaluation_status = 'decision_indeterminate'
      AND expected_net_value IS NULL
      AND jsonb_array_length(issues_json) > 0
    )
    OR (
      evaluation_status = 'computed'
      AND goal_probability IS NOT NULL
      AND plan_deadline_goal_probability IS NOT NULL
      AND value_unit IS NOT NULL
      AND btrim(value_unit) <> ''
      AND expected_net_value IS NOT NULL
      AND expected_cumulative_funding_million_jpy IS NOT NULL
      AND expected_failure_loss_million_jpy IS NOT NULL
      AND expected_exit_value_million_jpy IS NOT NULL
      AND expected_terminal_value_million_jpy IS NOT NULL
      AND expected_cost_million_jpy IS NOT NULL
      AND expected_benefit_million_jpy IS NOT NULL
      AND cardinality(missing_inputs) = 0
      AND engine_version IS NOT NULL
      AND btrim(engine_version) <> ''
      AND input_hash IS NOT NULL
      AND btrim(input_hash) <> ''
    )
  )
);

CREATE INDEX IF NOT EXISTS bzm_2_1_action_evaluations_action_idx
  ON public.bzm_2_1_action_evaluations(action_id, objective_kind, created_at);

-- 方針全体の評価。fixed_baselineは現行方針を固定した基準線、optimizedは
-- 実際の意思決定者の目的で一度だけ選ぶ。同じ選択方針を三視点で再評価し、
-- 選択基準と評価視点を混同しない。
CREATE TABLE IF NOT EXISTS public.bzm_2_1_policy_evaluations (
  policy_evaluation_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id                         uuid NOT NULL REFERENCES public.bzm_2_1_model_revisions(revision_id) ON DELETE CASCADE,
  objective_kind                      text NOT NULL,
  policy_kind                         text NOT NULL,
  selection_objective                 text,
  evaluation_status                   text NOT NULL,
  action_coverage_status              text NOT NULL,
  goal_probability                    double precision,
  plan_deadline_goal_probability      double precision,
  conditional_goal_value              double precision,
  expected_net_value                  double precision,
  value_difference_from_baseline      double precision,
  controller_option_value             double precision,
  value_unit                          text,
  expected_cumulative_funding_million_jpy double precision,
  expected_failure_loss_million_jpy   double precision,
  expected_exit_value_million_jpy     double precision,
  expected_terminal_value_million_jpy double precision,
  expected_cost_million_jpy           double precision,
  expected_benefit_million_jpy        double precision,
  public_aggregation_status           text NOT NULL DEFAULT 'not_applicable',
  public_fiscal_value_million_jpy      double precision,
  public_social_components_json       jsonb NOT NULL DEFAULT '[]'::jsonb,
  public_social_monetized_value_million_jpy double precision,
  public_aggregated_value_million_jpy double precision,
  public_aggregation_input_hash       text,
  controller_by_state_json            jsonb NOT NULL DEFAULT '{}'::jsonb,
  selected_action_by_state_json       jsonb NOT NULL DEFAULT '{}'::jsonb,
  state_decisions_json                jsonb NOT NULL DEFAULT '[]'::jsonb,
  uncertainty_json                    jsonb NOT NULL DEFAULT '{}'::jsonb,
  issues_json                         jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_inputs                      text[] NOT NULL DEFAULT '{}',
  engine_version                      text,
  input_hash                          text,
  information_cutoff                  timestamptz NOT NULL,
  created_at                          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bzm_2_1_policy_evaluations_revision_view_uniq
    UNIQUE (revision_id, objective_kind, policy_kind),
  CONSTRAINT bzm_2_1_policy_evaluations_objective_check CHECK (
    objective_kind IN ('company', 'bzsf', 'public')
  ),
  CONSTRAINT bzm_2_1_policy_evaluations_policy_check CHECK (
    policy_kind IN ('fixed_baseline', 'optimized')
  ),
  CONSTRAINT bzm_2_1_policy_evaluations_selection_check CHECK (
    (policy_kind = 'fixed_baseline' AND selection_objective IS NULL)
    OR (
      policy_kind = 'optimized'
      AND (
        selection_objective IN ('company', 'bzsf', 'public')
        OR evaluation_status IN ('not_computable', 'decision_indeterminate')
      )
    )
  ),
  CONSTRAINT bzm_2_1_policy_evaluations_coverage_check CHECK (
    action_coverage_status IN ('complete', 'partial_action_set', 'unknown')
  ),
  CONSTRAINT bzm_2_1_policy_evaluations_status_check CHECK (
    evaluation_status IN (
      'not_computable', 'partial', 'computed', 'decision_indeterminate'
    )
  ),
  CONSTRAINT bzm_2_1_policy_evaluations_q_check CHECK (
    (goal_probability IS NULL OR (goal_probability >= 0 AND goal_probability <= 1))
    AND (
      plan_deadline_goal_probability IS NULL
      OR (plan_deadline_goal_probability >= 0 AND plan_deadline_goal_probability <= 1)
    )
    AND (
      goal_probability IS NULL
      OR plan_deadline_goal_probability IS NULL
      OR plan_deadline_goal_probability <= goal_probability
    )
    AND (
      evaluation_status <> 'computed'
      OR (goal_probability = 0 AND conditional_goal_value IS NULL)
      OR (goal_probability > 0 AND conditional_goal_value IS NOT NULL)
    )
  ),
  CONSTRAINT bzm_2_1_policy_evaluations_nonnegative_check CHECK (
    (
      expected_cumulative_funding_million_jpy IS NULL
      OR expected_cumulative_funding_million_jpy >= 0
    )
    AND (
      expected_failure_loss_million_jpy IS NULL
      OR expected_failure_loss_million_jpy >= 0
    )
    AND (expected_cost_million_jpy IS NULL OR expected_cost_million_jpy >= 0)
    AND (expected_benefit_million_jpy IS NULL OR expected_benefit_million_jpy >= 0)
  ),
  CONSTRAINT bzm_2_1_policy_evaluations_value_semantics_check CHECK (
    controller_option_value IS NULL OR controller_option_value >= 0
  ),
  CONSTRAINT bzm_2_1_policy_evaluations_json_check CHECK (
    jsonb_typeof(controller_by_state_json) = 'object'
    AND jsonb_typeof(selected_action_by_state_json) = 'object'
    AND jsonb_typeof(state_decisions_json) = 'array'
    AND jsonb_typeof(uncertainty_json) = 'object'
    AND jsonb_typeof(issues_json) = 'array'
  ),
  CONSTRAINT bzm_2_1_policy_evaluations_public_check CHECK (
    public_aggregation_status IN ('not_applicable', 'not_computable', 'complete')
    AND public.bzm_2_1_public_social_vector_is_valid(
      public_social_components_json,
      information_cutoff
    )
    AND (
      (
        objective_kind <> 'public'
        AND public_aggregation_status = 'not_applicable'
        AND public_fiscal_value_million_jpy IS NULL
        AND jsonb_array_length(public_social_components_json) = 0
        AND public_social_monetized_value_million_jpy IS NULL
        AND public_aggregated_value_million_jpy IS NULL
        AND public_aggregation_input_hash IS NULL
      )
      OR (
        objective_kind = 'public'
        AND evaluation_status <> 'computed'
        AND public_aggregation_status = 'not_computable'
        AND public_aggregated_value_million_jpy IS NULL
        AND public_aggregation_input_hash IS NULL
      )
      OR (
        objective_kind = 'public'
        AND evaluation_status = 'computed'
        AND public_aggregation_status = 'complete'
        AND public_fiscal_value_million_jpy IS NOT NULL
        AND public_social_monetized_value_million_jpy IS NOT NULL
        AND public_aggregated_value_million_jpy IS NOT NULL
        AND public_aggregation_input_hash ~ '^[0-9a-f]{64}$'
        AND abs(
          public_social_monetized_value_million_jpy
          - public.bzm_2_1_public_social_vector_sum_million_jpy(
              public_social_components_json
            )
        ) <= greatest(
          0.000000001,
          abs(public_social_monetized_value_million_jpy) * 0.000000001
        )
        AND abs(
          public_aggregated_value_million_jpy
          - (
              public_fiscal_value_million_jpy
              + public_social_monetized_value_million_jpy
            )
        ) <= greatest(
          0.000000001,
          abs(public_aggregated_value_million_jpy) * 0.000000001
        )
        AND abs(expected_net_value - public_aggregated_value_million_jpy)
          <= greatest(0.000000001, abs(expected_net_value) * 0.000000001)
      )
    )
  ),
  CONSTRAINT bzm_2_1_policy_evaluations_completeness_check CHECK (
    (
      evaluation_status = 'not_computable'
      AND conditional_goal_value IS NULL
      AND expected_net_value IS NULL
      AND value_difference_from_baseline IS NULL
      AND controller_option_value IS NULL
      AND value_unit IS NULL
      AND expected_cumulative_funding_million_jpy IS NULL
      AND expected_failure_loss_million_jpy IS NULL
      AND expected_exit_value_million_jpy IS NULL
      AND expected_terminal_value_million_jpy IS NULL
      AND expected_cost_million_jpy IS NULL
      AND expected_benefit_million_jpy IS NULL
      AND cardinality(missing_inputs) > 0
      AND (
        (goal_probability IS NULL AND plan_deadline_goal_probability IS NULL)
        OR (
          objective_kind IN ('bzsf', 'public')
          AND goal_probability IS NOT NULL
          AND plan_deadline_goal_probability IS NOT NULL
          AND jsonb_object_length(controller_by_state_json) > 0
          AND jsonb_object_length(selected_action_by_state_json) > 0
          AND engine_version IS NOT NULL
          AND btrim(engine_version) <> ''
          AND input_hash IS NOT NULL
          AND btrim(input_hash) <> ''
        )
      )
    )
    OR (
      evaluation_status = 'partial'
      AND cardinality(missing_inputs) > 0
    )
    OR (
      evaluation_status = 'decision_indeterminate'
      AND expected_net_value IS NULL
      AND value_difference_from_baseline IS NULL
      AND controller_option_value IS NULL
      AND jsonb_array_length(issues_json) > 0
    )
    OR (
      evaluation_status = 'computed'
      AND goal_probability IS NOT NULL
      AND plan_deadline_goal_probability IS NOT NULL
      AND expected_net_value IS NOT NULL
      AND value_difference_from_baseline IS NOT NULL
      AND (
        (
          policy_kind = 'fixed_baseline'
          AND value_difference_from_baseline = 0
          AND controller_option_value IS NULL
        )
        OR (
          policy_kind = 'optimized'
          AND selection_objective IS NOT NULL
          AND (
            (
              objective_kind = selection_objective
              AND controller_option_value = value_difference_from_baseline
            )
            OR (
              objective_kind <> selection_objective
              AND controller_option_value IS NULL
            )
          )
        )
      )
      AND value_unit IS NOT NULL
      AND btrim(value_unit) <> ''
      AND expected_cumulative_funding_million_jpy IS NOT NULL
      AND expected_failure_loss_million_jpy IS NOT NULL
      AND expected_exit_value_million_jpy IS NOT NULL
      AND expected_terminal_value_million_jpy IS NOT NULL
      AND expected_cost_million_jpy IS NOT NULL
      AND expected_benefit_million_jpy IS NOT NULL
      AND jsonb_object_length(selected_action_by_state_json) > 0
      AND cardinality(missing_inputs) = 0
      AND engine_version IS NOT NULL
      AND btrim(engine_version) <> ''
      AND input_hash IS NOT NULL
      AND btrim(input_hash) <> ''
    )
  )
);

CREATE INDEX IF NOT EXISTS bzm_2_1_policy_evaluations_revision_idx
  ON public.bzm_2_1_policy_evaluations(
    revision_id, objective_kind, policy_kind, created_at
  );

CREATE OR REPLACE FUNCTION public.bzm_2_1_validate_evaluation_public_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  evaluation_revision_id uuid;
  aggregation_rule_ref text;
  evaluation_data_mode text;
BEGIN
  IF NEW.objective_kind <> 'public' OR NEW.public_aggregation_status <> 'complete' THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'bzm_2_1_policy_evaluations' THEN
    evaluation_revision_id := NEW.revision_id;
  ELSE
    SELECT states.revision_id INTO evaluation_revision_id
    FROM public.bzm_2_1_actions AS actions
    JOIN public.bzm_2_1_decision_states AS states
      ON states.state_id = actions.state_id
    WHERE actions.action_id = NEW.action_id;
  END IF;
  SELECT revisions.public_aggregation_rule_ref, revisions.data_mode
    INTO aggregation_rule_ref, evaluation_data_mode
  FROM public.bzm_2_1_model_revisions AS revisions
  WHERE revisions.revision_id = evaluation_revision_id;
  IF evaluation_data_mode <> 'synthetic' THEN
    RAISE EXCEPTION 'BZM 2.1 project-mode public path decomposition is not implemented in v0.1';
  END IF;
  IF aggregation_rule_ref <> 'bzm2.1:public=fiscal+social_converted:v0.1' THEN
    RAISE EXCEPTION 'BZM 2.1 public evaluation requires the executable v0.1 aggregation rule';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bzm_2_1_action_evaluations_public_rule_guard
  ON public.bzm_2_1_action_evaluations;
CREATE TRIGGER bzm_2_1_action_evaluations_public_rule_guard
BEFORE INSERT OR UPDATE OF
  objective_kind, public_aggregation_status, public_aggregated_value_million_jpy
ON public.bzm_2_1_action_evaluations
FOR EACH ROW EXECUTE FUNCTION public.bzm_2_1_validate_evaluation_public_rules();

DROP TRIGGER IF EXISTS bzm_2_1_policy_evaluations_public_rule_guard
  ON public.bzm_2_1_policy_evaluations;
CREATE TRIGGER bzm_2_1_policy_evaluations_public_rule_guard
BEFORE INSERT OR UPDATE OF
  revision_id, objective_kind, public_aggregation_status,
  public_aggregated_value_million_jpy
ON public.bzm_2_1_policy_evaluations
FOR EACH ROW EXECUTE FUNCTION public.bzm_2_1_validate_evaluation_public_rules();

-- 未来の情報を過去版へ戻さない。revision_idを直接持つ追記台帳は
-- 共通triggerで版の情報締切以下に固定する。
CREATE OR REPLACE FUNCTION public.bzm_2_1_validate_direct_revision_cutoff()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  revision_cutoff timestamptz;
BEGIN
  SELECT revisions.information_cutoff
    INTO revision_cutoff
  FROM public.bzm_2_1_model_revisions AS revisions
  WHERE revisions.revision_id = NEW.revision_id;
  IF revision_cutoff IS NULL OR NEW.information_cutoff > revision_cutoff THEN
    RAISE EXCEPTION 'BZM 2.1 row information cutoff exceeds revision cutoff';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bzm_2_1_inputs_cutoff_guard
  ON public.bzm_2_1_input_observations;
CREATE TRIGGER bzm_2_1_inputs_cutoff_guard
BEFORE INSERT OR UPDATE OF revision_id, information_cutoff
ON public.bzm_2_1_input_observations
FOR EACH ROW EXECUTE FUNCTION public.bzm_2_1_validate_direct_revision_cutoff();

DROP TRIGGER IF EXISTS bzm_2_1_cashflow_cutoff_guard
  ON public.bzm_2_1_cashflow_events;
CREATE TRIGGER bzm_2_1_cashflow_cutoff_guard
BEFORE INSERT OR UPDATE OF revision_id, information_cutoff
ON public.bzm_2_1_cashflow_events
FOR EACH ROW EXECUTE FUNCTION public.bzm_2_1_validate_direct_revision_cutoff();

DROP TRIGGER IF EXISTS bzm_2_1_policy_evaluations_cutoff_guard
  ON public.bzm_2_1_policy_evaluations;
CREATE TRIGGER bzm_2_1_policy_evaluations_cutoff_guard
BEFORE INSERT OR UPDATE OF revision_id, information_cutoff
ON public.bzm_2_1_policy_evaluations
FOR EACH ROW EXECUTE FUNCTION public.bzm_2_1_validate_direct_revision_cutoff();

CREATE OR REPLACE FUNCTION public.bzm_2_1_validate_action_evaluation_cutoff()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  revision_cutoff timestamptz;
BEGIN
  SELECT revisions.information_cutoff
    INTO revision_cutoff
  FROM public.bzm_2_1_actions AS actions
  JOIN public.bzm_2_1_decision_states AS states
    ON states.state_id = actions.state_id
  JOIN public.bzm_2_1_model_revisions AS revisions
    ON revisions.revision_id = states.revision_id
  WHERE actions.action_id = NEW.action_id;
  IF revision_cutoff IS NULL OR NEW.information_cutoff > revision_cutoff THEN
    RAISE EXCEPTION 'BZM 2.1 action evaluation cutoff exceeds revision cutoff';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bzm_2_1_action_evaluations_cutoff_guard
  ON public.bzm_2_1_action_evaluations;
CREATE TRIGGER bzm_2_1_action_evaluations_cutoff_guard
BEFORE INSERT OR UPDATE OF action_id, information_cutoff
ON public.bzm_2_1_action_evaluations
FOR EACH ROW EXECUTE FUNCTION public.bzm_2_1_validate_action_evaluation_cutoff();

COMMENT ON TABLE public.bzm_2_1_model_revisions IS
  'PJ別BZM 2.1動的方針モデルの追記台帳。BZM 2.0と現行運用SPSを置換しない';
COMMENT ON TABLE public.bzm_2_1_input_observations IS
  '状態・行動・遷移・支援の入力を、欠測と情報締切を保ったまま保存するBZM 2.1台帳。scope_keyは完全パス';
COMMENT ON TABLE public.bzm_2_1_cashflow_events IS
  'BZM 2.1の費用・便益・資金・税・終端価値を一度だけ置くevent正本。revision内event_key一意';
COMMENT ON COLUMN public.bzm_2_1_actions.immediate_cost_by_objective_json IS
  'bzm_2_1_cashflow_eventsから再現生成する派生cache。直接入力の正本にしない';
COMMENT ON COLUMN public.bzm_2_1_actions.immediate_benefit_by_objective_json IS
  'bzm_2_1_cashflow_eventsから再現生成する派生cache。直接入力の正本にしない';
COMMENT ON COLUMN public.bzm_2_1_transitions.terminal_value_by_objective_json IS
  'bzm_2_1_cashflow_eventsから再現生成する派生cache。eventを別経路へ重複投入しない';
COMMENT ON COLUMN public.bzm_2_1_transitions.failure_loss_by_objective_json IS
  'bzm_2_1_cashflow_eventsから再現生成する派生cache。別入力の感覚値にしない';
COMMENT ON TABLE public.bzm_2_1_interventions IS
  '支援を独立加点せず、行動費用・資金・遷移・終端値への根拠付き差分として保存する';
COMMENT ON TABLE public.bzm_2_1_action_evaluations IS
  '各行動の到達見込み、条件付き価値、必要資金、失敗損失、出口価値を目的別に分離した評価';
COMMENT ON TABLE public.bzm_2_1_policy_evaluations IS
  '固定方針と、意思決定者の目的で一度だけ選んだ方針を、会社・BZSF・公的支援者から別々に再評価して保存する';
COMMENT ON COLUMN public.bzm_2_1_policy_evaluations.selection_objective IS
  'optimized方針を選んだ単一の目的。objective_kindは同じ方針を再評価する視点であり、両者を混同しない';
COMMENT ON COLUMN public.bzm_2_1_policy_evaluations.expected_net_value IS
  '各方針の絶対的な期待正味値。目的間の合算・順位化を禁止する';
COMMENT ON COLUMN public.bzm_2_1_policy_evaluations.value_difference_from_baseline IS
  '同じ評価視点での固定方針との差。非controller視点では負になり得るためオプション価値とは呼ばない';
COMMENT ON COLUMN public.bzm_2_1_policy_evaluations.controller_option_value IS
  '意思決定者の目的に限った柔軟性の価値。非controller視点とfixed_baselineではNULL';

ALTER TABLE public.bzm_2_1_model_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bzm_2_1_decision_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bzm_2_1_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bzm_2_1_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bzm_2_1_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bzm_2_1_input_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bzm_2_1_cashflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bzm_2_1_action_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bzm_2_1_policy_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bzm_2_1_model_revisions_members_read"
  ON public.bzm_2_1_model_revisions;
CREATE POLICY "bzm_2_1_model_revisions_members_read"
  ON public.bzm_2_1_model_revisions FOR SELECT TO authenticated
  USING (public.amd_os_is_member());
DROP POLICY IF EXISTS "bzm_2_1_model_revisions_service"
  ON public.bzm_2_1_model_revisions;
CREATE POLICY "bzm_2_1_model_revisions_service"
  ON public.bzm_2_1_model_revisions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bzm_2_1_decision_states_members_read"
  ON public.bzm_2_1_decision_states;
CREATE POLICY "bzm_2_1_decision_states_members_read"
  ON public.bzm_2_1_decision_states FOR SELECT TO authenticated
  USING (public.amd_os_is_member());
DROP POLICY IF EXISTS "bzm_2_1_decision_states_service"
  ON public.bzm_2_1_decision_states;
CREATE POLICY "bzm_2_1_decision_states_service"
  ON public.bzm_2_1_decision_states FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bzm_2_1_actions_members_read" ON public.bzm_2_1_actions;
CREATE POLICY "bzm_2_1_actions_members_read"
  ON public.bzm_2_1_actions FOR SELECT TO authenticated
  USING (public.amd_os_is_member());
DROP POLICY IF EXISTS "bzm_2_1_actions_service" ON public.bzm_2_1_actions;
CREATE POLICY "bzm_2_1_actions_service"
  ON public.bzm_2_1_actions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bzm_2_1_transitions_members_read"
  ON public.bzm_2_1_transitions;
CREATE POLICY "bzm_2_1_transitions_members_read"
  ON public.bzm_2_1_transitions FOR SELECT TO authenticated
  USING (public.amd_os_is_member());
DROP POLICY IF EXISTS "bzm_2_1_transitions_service"
  ON public.bzm_2_1_transitions;
CREATE POLICY "bzm_2_1_transitions_service"
  ON public.bzm_2_1_transitions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bzm_2_1_interventions_members_read"
  ON public.bzm_2_1_interventions;
CREATE POLICY "bzm_2_1_interventions_members_read"
  ON public.bzm_2_1_interventions FOR SELECT TO authenticated
  USING (public.amd_os_is_member());
DROP POLICY IF EXISTS "bzm_2_1_interventions_service"
  ON public.bzm_2_1_interventions;
CREATE POLICY "bzm_2_1_interventions_service"
  ON public.bzm_2_1_interventions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bzm_2_1_input_observations_members_read"
  ON public.bzm_2_1_input_observations;
CREATE POLICY "bzm_2_1_input_observations_members_read"
  ON public.bzm_2_1_input_observations FOR SELECT TO authenticated
  USING (public.amd_os_is_member());
DROP POLICY IF EXISTS "bzm_2_1_input_observations_service"
  ON public.bzm_2_1_input_observations;
CREATE POLICY "bzm_2_1_input_observations_service"
  ON public.bzm_2_1_input_observations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bzm_2_1_cashflow_events_members_read"
  ON public.bzm_2_1_cashflow_events;
CREATE POLICY "bzm_2_1_cashflow_events_members_read"
  ON public.bzm_2_1_cashflow_events FOR SELECT TO authenticated
  USING (public.amd_os_is_member());
DROP POLICY IF EXISTS "bzm_2_1_cashflow_events_service"
  ON public.bzm_2_1_cashflow_events;
CREATE POLICY "bzm_2_1_cashflow_events_service"
  ON public.bzm_2_1_cashflow_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bzm_2_1_action_evaluations_members_read"
  ON public.bzm_2_1_action_evaluations;
CREATE POLICY "bzm_2_1_action_evaluations_members_read"
  ON public.bzm_2_1_action_evaluations FOR SELECT TO authenticated
  USING (public.amd_os_is_member());
DROP POLICY IF EXISTS "bzm_2_1_action_evaluations_service"
  ON public.bzm_2_1_action_evaluations;
CREATE POLICY "bzm_2_1_action_evaluations_service"
  ON public.bzm_2_1_action_evaluations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bzm_2_1_policy_evaluations_members_read"
  ON public.bzm_2_1_policy_evaluations;
CREATE POLICY "bzm_2_1_policy_evaluations_members_read"
  ON public.bzm_2_1_policy_evaluations FOR SELECT TO authenticated
  USING (public.amd_os_is_member());
DROP POLICY IF EXISTS "bzm_2_1_policy_evaluations_service"
  ON public.bzm_2_1_policy_evaluations;
CREATE POLICY "bzm_2_1_policy_evaluations_service"
  ON public.bzm_2_1_policy_evaluations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 現在BZM 2.0が表示されている12PJに、数値を持たないBZM 2.1の初版を
-- 追加する。2.0のq/Pや現行SPSを転記しない。
INSERT INTO public.bzm_2_1_model_revisions (
  project_id, revision_key, revision_order, theory_version, model_version,
  measurement_status, information_cutoff, forward_validation_count,
  revision_reason, source_ref
)
SELECT
  projects.project_id,
  'bzm21-dynamic-open-v0.1',
  1,
  'theory-open v2.1 / implementation-prototype',
  'bzm-2.1-dynamic-policy-v0.1',
  'incomplete',
  '2026-08-11T22:00:00+09:00'::timestamptz,
  0,
  'BZM 2.0を保持したまま、固定方針と動的方針評価を分離して開始。意思決定グラフと費用・遷移・出口価値は未入力',
  'pwa/bzm/bzm-2-1-dynamic-business-value-model.md'
FROM public.projects AS projects
WHERE projects.project_id IN (
  'p03', 'p04', 'p06', 'p07', 'p09', 'p11',
  'p18', 'p20', 'p21', 'p24', 'p26', 'p29'
)
ON CONFLICT (project_id, revision_key) DO NOTHING;

-- 初版で「何も無い」ように見せず、BZM 2.1の共通必須入力を全12PJへ
-- 明示する。値は全てNULL、状態はnot_started、根拠はnoneであり、0や
-- 既存BZM 2.0値を代入しない。行動固有入力は判断ノード作成後に追加する。
WITH required_inputs(
  parameter_key, symbol, label, unit, note, sort_order
) AS (
  VALUES
    ('valuation_date', 'd_0', '評価日', 'date', '評価版で日付を事前固定する', 10),
    ('initial_state', 'n_0', '初期判断ノード', 'state', '情報締切時点の未実行判断を固定する', 20),
    ('plan_deadline', 'H_v', '計画期限', 'month', '承認済み計画から評価日後の月数を抽出する', 30),
    ('evaluation_horizon', 'H_{\mathrm{econ}}', '共通経済評価地平', 'month', 'PJ比較前に共通地平を事前登録する', 40),
    ('reachability_history', '\mathcal H_{\mathrm{reach}}', '到達・余力喪失の履歴', 'history', '既到達と既喪失の初回時点を証拠付きで固定する', 50),
    ('decision_controller', 'u_d', '意思決定者', 'controller', '定款・規程・契約から実権限主体を確認する', 60),
    ('controller_objective', '\operatorname{objective}(u_d)', '意思決定者の選択目的', 'objective', 'この版で方針を選ぶ目的を一つに固定する', 70),
    ('baseline_policy', '\pi_0', '完全固定方針', 'policy', 'off-pathを含む全到達可能ノードの行動を閉じる', 80),
    ('policy_definition_ref', '\operatorname{ref}(\pi_0)', '固定方針の根拠', 'reference', '承認済み計画または意思決定記録へ結ぶ', 90),
    ('action_coverage', '\mathcal A', '行動集合の被覆', 'status', '利用可・利用不可・未確認を含めて列挙範囲を固定する', 100),
    ('discount_rate_company', '\delta_{\mathrm{company}}', '会社の割引規則', 'rate', '確率測度と重複しない割引方式を固定する', 110),
    ('discount_rate_bzsf', '\delta_{\mathrm{BZSF}}', 'BZSFの割引規則', 'rate', '投資家CFの割引方式を固定する', 120),
    ('discount_rate_public', '\delta_{\mathrm{public}}', '公的支援者の割引規則', 'rate', '財政と社会便益の割引方式を固定する', 130),
    ('valuation_rule_company', 'w_{\mathrm{company}}', '会社の価値規則', 'rule', 'PJ増分価値の範囲と税・価格づけを固定する', 140),
    ('valuation_rule_bzsf', 'w_{\mathrm{BZSF}}', 'BZSFの価値規則', 'rule', '投資支出・証券分配・希薄化の範囲を固定する', 150),
    ('valuation_rule_public', 'w_{\mathrm{public}}', '公的支援者の価値規則', 'rule', '基金財政と社会目的を別に定義してから集約する', 160),
    ('decision_criterion_company', 'c_{\mathrm{company}}', '会社の判断基準', 'rule', '会社視点を権限主体にする場合の事前基準を固定する', 170),
    ('decision_criterion_bzsf', 'c_{\mathrm{BZSF}}', 'BZSFの判断基準', 'rule', 'BZSF視点を権限主体にする場合の事前基準を固定する', 180),
    ('decision_criterion_public', 'c_{\mathrm{public}}', '公的支援者の判断基準', 'rule', '公的視点を権限主体にする場合の事前基準を固定する', 190),
    ('near_tie_tolerance', '\varepsilon_{\mathrm{tie}}', '近接解の許容幅', 'million JPY', '入力誤差と評価者差から事前固定する', 200),
    ('tie_break_rule', '\rho_{\mathrm{tie}}', '同率時の事前規則', 'rule', '結果を見る前に順位規則を固定する', 210),
    ('uncertainty_rule', '\mathcal U', '不確実性判定規則', 'rule', '入力幅で選択が変わる場合の停止規則を固定する', 220),
    ('public_fiscal_rule', 'R_{\mathrm{fiscal}}', '基金財政規則', 'reference', '公的基金の支出・回収・予算境界を固定する', 230),
    ('public_social_mandate', 'R_{\mathrm{mandate}}', '法的な社会目的', 'reference', '公的支援者の法的使命と便益境界を固定する', 240),
    ('public_social_conversion', 'R_{\mathrm{conversion}}', '社会便益の換算規則', 'reference', 'シャドー価格・分配ウェイト・社会的割引を固定する', 250),
    ('public_aggregation', 'R_{\mathrm{aggregation}}', '公的目的の集約規則', 'reference', '基金財政と社会便益を合成する事前規則を固定する', 260),
    ('single_cashflow_ledger', '\mathcal{CF}', '単一キャッシュフロー台帳', 'status', 'CF事象IDごとに費用・便益・税・終端価値を一度だけ置く', 270)
)
INSERT INTO public.bzm_2_1_input_observations (
  revision_id, scope_kind, scope_key, parameter_key, symbol, label,
  value_json, display_value, value_status, unit, evidence_kind, evidence_ref,
  information_cutoff, condition_json, note, sort_order
)
SELECT
  revisions.revision_id,
  'revision',
  'revision',
  required_inputs.parameter_key,
  required_inputs.symbol,
  required_inputs.label,
  NULL,
  '未着手（0ではない）',
  'not_started',
  required_inputs.unit,
  'none',
  NULL,
  revisions.information_cutoff,
  '{}'::jsonb,
  required_inputs.note,
  required_inputs.sort_order
FROM public.bzm_2_1_model_revisions AS revisions
CROSS JOIN required_inputs
WHERE revisions.revision_key = 'bzm21-dynamic-open-v0.1'
  AND revisions.project_id IN (
    'p03', 'p04', 'p06', 'p07', 'p09', 'p11',
    'p18', 'p20', 'p21', 'p24', 'p26', 'p29'
  )
ON CONFLICT (revision_id, scope_kind, scope_key, parameter_key) DO NOTHING;

-- 冪等再実行でも、対象12PJに数値なしの初版が一つずつ存在し、2.0表を
-- 書き換えていないことを検査する。評価行は入力が揃って計算を試みた時だけ追加する。
DO $$
DECLARE
  target_project text;
  target_revision_count integer;
  target_required_input_count integer;
  target_invalid_seed_input_count integer;
BEGIN
  FOREACH target_project IN ARRAY ARRAY[
    'p03', 'p04', 'p06', 'p07', 'p09', 'p11',
    'p18', 'p20', 'p21', 'p24', 'p26', 'p29'
  ]::text[]
  LOOP
    SELECT count(*)
    INTO target_revision_count
    FROM public.bzm_2_1_model_revisions AS revisions
    WHERE revisions.project_id = target_project
      AND revisions.revision_key = 'bzm21-dynamic-open-v0.1'
      AND revisions.measurement_status = 'incomplete'
      AND revisions.forward_validation_count = 0;

    IF target_revision_count <> 1 THEN
      RAISE EXCEPTION
        'BZM 2.1 empty initial revision is missing for project %',
        target_project;
    END IF;

    SELECT
      count(*),
      count(*) FILTER (
        WHERE inputs.value_json IS NOT NULL
          OR inputs.value_status <> 'not_started'
          OR inputs.evidence_kind <> 'none'
          OR inputs.evidence_ref IS NOT NULL
      )
    INTO target_required_input_count, target_invalid_seed_input_count
    FROM public.bzm_2_1_input_observations AS inputs
    JOIN public.bzm_2_1_model_revisions AS revisions
      ON revisions.revision_id = inputs.revision_id
    WHERE revisions.project_id = target_project
      AND revisions.revision_key = 'bzm21-dynamic-open-v0.1'
      AND inputs.scope_kind = 'revision'
      AND inputs.scope_key = 'revision';

    IF target_required_input_count <> 27 OR target_invalid_seed_input_count <> 0 THEN
      RAISE EXCEPTION
        'BZM 2.1 required missing-input roster is invalid for project %',
        target_project;
    END IF;
  END LOOP;
END
$$;

COMMIT;
