import "server-only";

import {
  buildBzm21PolicyModelLedger,
  type Bzm21ActionEvaluationRow,
  type Bzm21ActionRow,
  type Bzm21CashflowEventRow,
  type Bzm21DecisionStateRow,
  type Bzm21InputObservationRow,
  type Bzm21InterventionRow,
  type Bzm21ModelRevisionRow,
  type Bzm21PolicyEvaluationRow,
  type Bzm21PolicyModelLedger,
  type Bzm21TransitionRow,
} from "@/lib/bzm-2-1-policy-model";
import {
  computeBzm21PolicyLedgerInputHash,
  computeBzm21PublicAggregationInputHash,
} from "@/lib/bzm-2-1-policy-engine-adapter";
import { createAdminClient } from "@/lib/supabase/admin";

const REVISION_SELECT = [
  "revision_id",
  "project_id",
  "revision_key",
  "revision_order",
  "theory_version",
  "model_version",
  "data_mode",
  "currency",
  "valuation_date",
  "initial_state_key",
  "plan_deadline_months",
  "evaluation_horizon_months",
  "discount_rate_by_objective_json",
  "valuation_rule_by_objective_json",
  "decision_criterion_by_objective_json",
  "tie_break_rule_json",
  "uncertainty_rule_json",
  "public_fiscal_rule_ref",
  "public_social_mandate_ref",
  "public_social_conversion_rule_ref",
  "public_aggregation_rule_ref",
  "baseline_policy_id",
  "baseline_policy_json",
  "policy_definition_ref",
  "measurement_status",
  "information_cutoff",
  "forward_validation_count",
  "revision_reason",
  "source_ref",
  "created_at",
].join(",");

const STATE_SELECT = [
  "state_id",
  "revision_id",
  "state_key",
  "label",
  "decision_order",
  "is_initial",
  "elapsed_months",
  "current_state_json",
  "beliefs_json",
  "reachability_history_json",
  "decision_controller_json",
  "sunk_cost_million_jpy",
  "remaining_cost_million_jpy",
  "remaining_time_months",
  "available_information_json",
  "evidence_json",
  "created_at",
].join(",");

const ACTION_SELECT = [
  "action_id",
  "state_id",
  "action_key",
  "bundle_id",
  "action_type",
  "component_types",
  "custom_components",
  "sequence_json",
  "shared_resources_json",
  "label",
  "action_order",
  "availability_status",
  "availability_reason",
  "feasibility_gate_json",
  "authority_gate_json",
  "consents_json",
  "financing_feasibility_json",
  "duration_months",
  "immediate_cost_by_objective_json",
  "immediate_benefit_by_objective_json",
  "required_funding_million_jpy",
  "cashflow_event_keys",
  "information_gain_json",
  "evidence_json",
  "created_at",
].join(",");

const TRANSITION_SELECT = [
  "transition_id",
  "action_id",
  "transition_key",
  "label",
  "next_state_id",
  "terminal_outcome",
  "probability",
  "goal_reached_at_months",
  "slack_lost_at_months",
  "transition_cash_flow_by_objective_json",
  "terminal_value_by_objective_json",
  "failure_loss_by_objective_json",
  "cashflow_event_keys",
  "evidence_json",
  "transition_order",
  "created_at",
].join(",");

const INTERVENTION_SELECT = [
  "intervention_id",
  "revision_id",
  "intervention_key",
  "label",
  "enabled",
  "effects_json",
  "evidence_json",
  "created_at",
].join(",");

const INPUT_SELECT = [
  "observation_id",
  "revision_id",
  "scope_kind",
  "scope_key",
  "parameter_key",
  "symbol",
  "label",
  "value_json",
  "display_value",
  "value_status",
  "unit",
  "evidence_kind",
  "evidence_ref",
  "information_cutoff",
  "condition_json",
  "note",
  "sort_order",
  "created_at",
].join(",");

const CASHFLOW_EVENT_SELECT = [
  "cashflow_event_id",
  "revision_id",
  "state_id",
  "action_id",
  "transition_id",
  "event_key",
  "economic_event_group_key",
  "perspective_leg",
  "label",
  "owner_kind",
  "owner_ref",
  "counterparty_kind",
  "counterparty_ref",
  "scope_kind",
  "scope_key",
  "timing_kind",
  "timing_months",
  "amount",
  "currency",
  "model_amount_million_jpy",
  "conversion_rule_ref",
  "conversion_rate_to_jpy",
  "conversion_rate_date",
  "conversion_rate_source_ref",
  "value_status",
  "nominal_or_real",
  "price_base_date",
  "tax_treatment",
  "tax_subject_ref",
  "evidence_kind",
  "evidence_ref",
  "information_cutoff",
  "included_in",
  "perspective_attribution_json",
  "public_aggregation_status",
  "public_fiscal_amount_million_jpy",
  "public_social_benefit_vector_json",
  "public_social_converted_amount_million_jpy",
  "public_aggregated_amount_million_jpy",
  "public_aggregation_input_hash",
  "public_transfer_treatment",
  "public_transfer_deduplication_ref",
  "semantic_duplicate_review_ref",
  "condition_json",
  "note",
  "created_at",
].join(",");

const ACTION_EVALUATION_SELECT = [
  "action_evaluation_id",
  "action_id",
  "objective_kind",
  "selection_objective",
  "is_selected",
  "exclusion_reason",
  "evaluation_status",
  "goal_probability",
  "plan_deadline_goal_probability",
  "conditional_goal_value",
  "value_unit",
  "expected_cumulative_funding_million_jpy",
  "expected_failure_loss_million_jpy",
  "expected_exit_value_million_jpy",
  "expected_terminal_value_million_jpy",
  "expected_cost_million_jpy",
  "expected_benefit_million_jpy",
  "expected_net_value",
  "public_aggregation_status",
  "public_fiscal_value_million_jpy",
  "public_social_components_json",
  "public_social_monetized_value_million_jpy",
  "public_aggregated_value_million_jpy",
  "public_aggregation_input_hash",
  "uncertainty_json",
  "issues_json",
  "missing_inputs",
  "engine_version",
  "input_hash",
  "information_cutoff",
  "created_at",
].join(",");

const POLICY_EVALUATION_SELECT = [
  "policy_evaluation_id",
  "revision_id",
  "objective_kind",
  "policy_kind",
  "selection_objective",
  "evaluation_status",
  "action_coverage_status",
  "goal_probability",
  "plan_deadline_goal_probability",
  "conditional_goal_value",
  "expected_net_value",
  "value_difference_from_baseline",
  "controller_option_value",
  "value_unit",
  "expected_cumulative_funding_million_jpy",
  "expected_failure_loss_million_jpy",
  "expected_exit_value_million_jpy",
  "expected_terminal_value_million_jpy",
  "expected_cost_million_jpy",
  "expected_benefit_million_jpy",
  "public_aggregation_status",
  "public_fiscal_value_million_jpy",
  "public_social_components_json",
  "public_social_monetized_value_million_jpy",
  "public_aggregated_value_million_jpy",
  "public_aggregation_input_hash",
  "controller_by_state_json",
  "selected_action_by_state_json",
  "state_decisions_json",
  "uncertainty_json",
  "issues_json",
  "missing_inputs",
  "engine_version",
  "input_hash",
  "information_cutoff",
  "created_at",
].join(",");

function unavailable(projectId: string, message: string): Bzm21PolicyModelLedger {
  return buildBzm21PolicyModelLedger({
    projectId,
    storageState: "unavailable",
    storageMessage: message,
  });
}

export async function fetchBzm21PolicyModelLedger(
  projectId: string,
): Promise<Bzm21PolicyModelLedger> {
  try {
    const db = createAdminClient();
    const revisionsResult = await db
      .from("bzm_2_1_model_revisions")
      .select(REVISION_SELECT)
      .eq("project_id", projectId)
      .order("revision_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (revisionsResult.error) {
      return unavailable(
        projectId,
        "BZM 2.1動的方針台帳をまだ読み出せない。BZM 2.0の値を代入していない。",
      );
    }

    const revisionRows = (revisionsResult.data ?? []) as unknown as Bzm21ModelRevisionRow[];
    const revisionIds = revisionRows.map((row) => row.revision_id);
    if (revisionIds.length === 0) {
      return buildBzm21PolicyModelLedger({ projectId, revisionRows });
    }

    const [
      statesResult,
      interventionsResult,
      inputsResult,
      cashflowEventsResult,
      policyEvaluationsResult,
    ] = await Promise.all([
      db
        .from("bzm_2_1_decision_states")
        .select(STATE_SELECT)
        .in("revision_id", revisionIds)
        .order("decision_order", { ascending: true })
        .order("created_at", { ascending: true }),
      db
        .from("bzm_2_1_interventions")
        .select(INTERVENTION_SELECT)
        .in("revision_id", revisionIds)
        .order("created_at", { ascending: true }),
      db
        .from("bzm_2_1_input_observations")
        .select(INPUT_SELECT)
        .in("revision_id", revisionIds)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      db
        .from("bzm_2_1_cashflow_events")
        .select(CASHFLOW_EVENT_SELECT)
        .in("revision_id", revisionIds)
        .order("timing_months", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      db
        .from("bzm_2_1_policy_evaluations")
        .select(POLICY_EVALUATION_SELECT)
        .in("revision_id", revisionIds)
        .order("created_at", { ascending: true }),
    ]);

    if (
      statesResult.error ||
      interventionsResult.error ||
      inputsResult.error ||
      cashflowEventsResult.error ||
      policyEvaluationsResult.error
    ) {
      return unavailable(
        projectId,
        "BZM 2.1の版は確認できたが、状態・入力・方針評価の一部を読み出せなかった。欠測を0へ補完していない。",
      );
    }

    const stateRows = (statesResult.data ?? []) as unknown as Bzm21DecisionStateRow[];
    const stateIds = stateRows.map((row) => row.state_id);
    let actionRows: Bzm21ActionRow[] = [];
    let transitionRows: Bzm21TransitionRow[] = [];
    let actionEvaluationRows: Bzm21ActionEvaluationRow[] = [];

    if (stateIds.length > 0) {
      const actionsResult = await db
        .from("bzm_2_1_actions")
        .select(ACTION_SELECT)
        .in("state_id", stateIds)
        .order("action_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (actionsResult.error) {
        return unavailable(
          projectId,
          "BZM 2.1の状態は確認できたが、利用可能な行動を読み出せなかった。",
        );
      }
      actionRows = (actionsResult.data ?? []) as unknown as Bzm21ActionRow[];
      const actionIds = actionRows.map((row) => row.action_id);
      if (actionIds.length > 0) {
        const [transitionsResult, actionEvaluationsResult] = await Promise.all([
          db
            .from("bzm_2_1_transitions")
            .select(TRANSITION_SELECT)
            .in("action_id", actionIds)
            .order("transition_order", { ascending: true })
            .order("created_at", { ascending: true }),
          db
            .from("bzm_2_1_action_evaluations")
            .select(ACTION_EVALUATION_SELECT)
            .in("action_id", actionIds)
            .order("created_at", { ascending: true }),
        ]);
        if (transitionsResult.error || actionEvaluationsResult.error) {
          return unavailable(
            projectId,
            "BZM 2.1の行動は確認できたが、遷移または目的別評価を読み出せなかった。",
          );
        }
        transitionRows = (transitionsResult.data ?? []) as unknown as Bzm21TransitionRow[];
        actionEvaluationRows = (actionEvaluationsResult.data ??
          []) as unknown as Bzm21ActionEvaluationRow[];
      }
    }

    const ledgerArgs = {
      projectId,
      revisionRows,
      stateRows,
      actionRows,
      transitionRows,
      interventionRows: (interventionsResult.data ?? []) as unknown as Bzm21InterventionRow[],
      inputRows: (inputsResult.data ?? []) as unknown as Bzm21InputObservationRow[],
      cashflowEventRows: (cashflowEventsResult.data ??
        []) as unknown as Bzm21CashflowEventRow[],
      actionEvaluationRows,
      policyEvaluationRows: (policyEvaluationsResult.data ??
        []) as unknown as Bzm21PolicyEvaluationRow[],
    };
    const unhashedLedger = buildBzm21PolicyModelLedger(ledgerArgs);
    const expectedInputHash = computeBzm21PolicyLedgerInputHash(unhashedLedger);
    const expectedPublicAggregationHashes = Object.fromEntries(
      unhashedLedger.currentRevision
        ? unhashedLedger.cashflowEvents
            .filter((event) => event.publicAggregationStatus === "complete")
            .map((event) => [
              event.cashflowEventId,
              computeBzm21PublicAggregationInputHash(
                event,
                unhashedLedger.currentRevision!,
              ),
            ])
        : [],
    );
    return buildBzm21PolicyModelLedger({
      ...ledgerArgs,
      expectedInputHash,
      expectedPublicAggregationHashes,
    });
  } catch {
    return unavailable(
      projectId,
      "BZM 2.1動的方針台帳へ接続できなかった。BZM 2.0または現行SPSで穴埋めしていない。",
    );
  }
}
