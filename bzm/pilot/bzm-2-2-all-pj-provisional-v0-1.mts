import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const PARAMETER_SECTIONS: Record<string, string[]> = {
  version_horizon_rules: [
    "model_id", "model_version", "valuation_date", "information_cutoff", "currency",
    "forward_validation_count", "initial_state_id", "H_v", "H_econ", "valuation_rule",
    "decision_criterion", "near_tie_tolerance", "tie_break_rule", "public_value_rule",
  ],
  decision_state: [
    "state_id", "decision_order", "elapsed_months", "technical_state", "manufacturing_state",
    "market_state", "rights_state", "organization_state", "cash_state", "slack_state",
    "belief_state", "decision_controller", "controller_objective", "sunk_cost", "remaining_cost",
    "remaining_time", "available_information",
  ],
  action_bundle: [
    "action_id_bundle_id", "component_kinds", "custom_components", "sequence", "shared_resources",
    "availability", "feasibility", "authority", "consents", "financing_status",
    "committed_funding", "duration", "C_now", "benefit_now", "required_funding", "information_gain",
  ],
  transition: [
    "transition_id", "p_phys", "next_state_id", "terminal_outcome", "T_C", "T_Y",
    "terminal_value", "failure_loss", "transition_cf",
  ],
  cashflow_ledger: [
    "cashflow_event_id", "economic_event_group_key", "perspective_leg", "owner", "counterparty",
    "scope", "amount_currency", "model_amount_million_jpy", "conversion_rate_to_jpy",
    "conversion_rate_date", "conversion_rate_source_ref", "conversion_rule_ref", "timing",
    "nominal_or_real", "price_base_date", "tax_treatment", "tax_subject_ref", "source_ref",
    "information_cutoff", "included_in", "perspective_attribution", "public_fiscal_amount",
    "public_social_benefit_vector", "public_social_converted_amount", "public_aggregated_amount",
    "public_aggregation_input_hash",
  ],
  intervention: [
    "intervention_id", "enabled", "cost_effect", "funding_effect", "action_set_effect",
    "transition_effect", "terminal_effect", "information_effect",
  ],
  derived_outputs: [
    "J_r", "E_V_net_given_G_a", "q_plan_pi0_Hv", "V_r_pi0", "pi_d_star",
    "q_G_pi_d_star", "V_r_pi_d_star", "E_V_net_pi_given_G", "Omega_d",
    "Delta_V_r_given_d", "expected_cumulative_funding", "expected_failure_loss", "expected_exit_value",
  ],
};

const PROJECT_ORDER = [
  "ティエム", "輝翠TECH", "CrestecBio", "LST", "JOYCLE", "BWE",
  "Yellow Duck", "CryoX", "SX", "チャレナジー", "VasculaX", "KENQ",
];

const PROJECT_IDS = new Map([
  ["ティエム", "p03"], ["輝翠TECH", "p04"], ["CrestecBio", "p06"], ["LST", "p07"],
  ["JOYCLE", "p09"], ["BWE", "p11"], ["Yellow Duck", "p18"], ["CryoX", "p20"],
  ["SX", "p21"], ["チャレナジー", "p24"], ["VasculaX", "p26"], ["KENQ", "p29"],
]);

const BZM22_STATE_KEYS = ["x", "r", "c_hat", "k", "n", "l", "e", "b"];
const REQUIRED_SLOT_FIELDS = [
  "observedStatus", "imputed", "unit", "rule", "sourceRefs", "confidenceDriver", "usedInCalculation",
];
const SOURCE_NAMES = ["gmail", "drive", "calendar", "slack", "notion", "os_db"];
const REQUIRED_INVENTORY_FIELDS = [
  "enumerationMode", "fetchedItems", "uniqueItems", "dateMin", "dateMax", "paginationComplete", "limitations",
];

// Gate months are part of the registered project path. Cash-feasibility
// diagnostics must never move a technical, commercial, rights, or financing
// gate earlier just to make a cash-cliff assertion pass.
const REGISTERED_GATE_MONTHS: Record<string, Record<string, number>> = {
  "ティエム": { current_cash_and_governance_reconciliation: 4, product_margin_and_repeatability: 15, channel_and_anchor_customer: 30, scale_cash_feasibility: 48 },
  "輝翠TECH": { field_reliability_and_serviceability: 9, repeatable_paid_orders: 18, channel_partner_conversion: 30, production_scale_economics: 48 },
  CrestecBio: { drug_substance_remediation: 6, nonclinical_package: 18, pmda_and_clinical_supply: 30, series_a_or_veco_to_clinic: 48 },
  LST: { tyk_bench_uptime_and_recovery: 8, membrane_life_and_cost: 18, kawasaki_scale_and_feedstock: 32, commercial_contract_and_repeatability: 48 },
  JOYCLE: { pipeline_binding_conversion: 12, unit_economics_and_reliability: 24, scale_financing: 36 },
  BWE: { large_poc_to_contract: 12, scale_engineering: 24, followon_financing: 30 },
  "Yellow Duck": { relaunch_or_asset_transfer: 12, orderly_maintenance: 3 },
  CryoX: { nims_rights_and_licensing: 9, multi_customer_validation: 15, financing_and_public_funding_bridge: 18, prototype_performance: 30 },
  SX: { real_effluent_reproducibility: 9, paid_poc_and_unit_economics: 18, company_rights_team_and_funding: 30, repeatable_scaled_deployment: 48 },
  "チャレナジー": { liquidity_extension: 4, repeatable_small_turbine_sales: 15, magnus_deployment_economics: 30, growth_financing_and_scale: 48 },
  VasculaX: { gap_or_equivalent_funding: 9, field_sensor_reproducibility: 18, paid_academic_or_tea_pilot: 30, rights_team_and_incorporation: 48 },
  KENQ: { consortium_and_application: 6, cmc_technical_feasibility: 18, rights_team_and_project_vehicle: 30, anchor_customer_or_nonspace_market: 48 },
};
const LIQUIDITY_GATE_KEY = "full_horizon_liquidity_package_proxy_before_first_cliff";

// The unit is part of the parameter contract. A project builder may not replace it
// with a generic "structured" or "mixed" label.
const UNIT_GROUPS: Record<string, string[]> = {
  id: [
    "version_horizon_rules.model_id", "version_horizon_rules.initial_state_id",
    "decision_state.state_id", "action_bundle.action_id_bundle_id",
    "transition.transition_id", "transition.next_state_id", "cashflow_ledger.cashflow_event_id",
    "cashflow_ledger.economic_event_group_key", "intervention.intervention_id",
  ],
  version: ["version_horizon_rules.model_version"],
  date: [
    "version_horizon_rules.valuation_date", "cashflow_ledger.conversion_rate_date",
    "cashflow_ledger.price_base_date",
  ],
  datetime: ["version_horizon_rules.information_cutoff", "cashflow_ledger.information_cutoff"],
  ISO4217: ["version_horizon_rules.currency", "cashflow_ledger.amount_currency"],
  count: ["version_horizon_rules.forward_validation_count"],
  months: [
    "version_horizon_rules.H_v", "version_horizon_rules.H_econ", "decision_state.elapsed_months",
    "decision_state.remaining_time", "action_bundle.duration", "transition.T_C", "transition.T_Y",
  ],
  rule: [
    "version_horizon_rules.valuation_rule", "version_horizon_rules.decision_criterion",
    "version_horizon_rules.tie_break_rule", "version_horizon_rules.public_value_rule",
    "cashflow_ledger.conversion_rule_ref",
  ],
  million_jpy: [
    "version_horizon_rules.near_tie_tolerance", "decision_state.sunk_cost", "decision_state.remaining_cost",
    "action_bundle.committed_funding", "action_bundle.C_now", "action_bundle.benefit_now",
    "action_bundle.required_funding", "transition.terminal_value", "transition.failure_loss",
    "cashflow_ledger.model_amount_million_jpy", "cashflow_ledger.public_fiscal_amount",
    "cashflow_ledger.public_social_converted_amount", "cashflow_ledger.public_aggregated_amount",
    "derived_outputs.J_r", "derived_outputs.V_r_pi0", "derived_outputs.V_r_pi_d_star",
    "derived_outputs.Omega_d", "derived_outputs.Delta_V_r_given_d",
    "derived_outputs.expected_cumulative_funding", "derived_outputs.expected_failure_loss",
    "derived_outputs.expected_exit_value",
  ],
  million_jpy_or_not_applicable: [
    "derived_outputs.E_V_net_given_G_a", "derived_outputs.E_V_net_pi_given_G",
  ],
  million_jpy_pv: ["transition.transition_cf"],
  probability: ["derived_outputs.q_plan_pi0_Hv", "derived_outputs.q_G_pi_d_star"],
  DAG_order: ["decision_state.decision_order"],
  typed_feature_vector: [
    "decision_state.technical_state", "decision_state.manufacturing_state", "decision_state.market_state",
    "decision_state.rights_state", "decision_state.organization_state",
    "cashflow_ledger.public_social_benefit_vector",
  ],
  typed_cash_feature_vector: ["decision_state.cash_state"],
  vector_not_score: ["decision_state.slack_state"],
  typed_probability_vector: ["decision_state.belief_state", "transition.p_phys"],
  actor: ["decision_state.decision_controller", "cashflow_ledger.owner", "cashflow_ledger.counterparty"],
  objective: ["decision_state.controller_objective"],
  hash: ["decision_state.available_information", "cashflow_ledger.public_aggregation_input_hash"],
  set: ["action_bundle.component_kinds", "action_bundle.custom_components", "action_bundle.consents", "cashflow_ledger.included_in"],
  ordered_steps: ["action_bundle.sequence"],
  typed_resource_vector: ["action_bundle.shared_resources"],
  availability_class: ["action_bundle.availability"],
  constraint_vector: ["action_bundle.feasibility"],
  authority: ["action_bundle.authority"],
  financing_stage: ["action_bundle.financing_status"],
  outcome_set: ["action_bundle.information_gain"],
  exclusive_path_set: ["transition.terminal_outcome"],
  JPY_per_currency_unit: ["cashflow_ledger.conversion_rate_to_jpy"],
  timing: ["cashflow_ledger.timing"],
  enum: [
    "cashflow_ledger.perspective_leg", "cashflow_ledger.scope", "cashflow_ledger.nominal_or_real",
    "cashflow_ledger.tax_treatment", "cashflow_ledger.perspective_attribution",
  ],
  source_locator: [
    "cashflow_ledger.conversion_rate_source_ref", "cashflow_ledger.tax_subject_ref",
    "cashflow_ledger.source_ref",
  ],
  boolean: ["intervention.enabled"],
  typed_effect_spec: [
    "intervention.cost_effect", "intervention.funding_effect", "intervention.action_set_effect",
    "intervention.transition_effect", "intervention.terminal_effect", "intervention.information_effect",
  ],
  policy: ["derived_outputs.pi_d_star"],
};

const PARAMETER_UNITS = new Map<string, string>();
for (const [unit, paths] of Object.entries(UNIT_GROUPS)) {
  for (const parameterPath of paths) {
    if (PARAMETER_UNITS.has(parameterPath)) throw new Error(`duplicate unit contract: ${parameterPath}`);
    PARAMETER_UNITS.set(parameterPath, unit);
  }
}
const allParameterPaths = Object.entries(PARAMETER_SECTIONS)
  .flatMap(([section, keys]) => keys.map((key) => `${section}.${key}`));
const unitContractMissing = allParameterPaths.filter((parameterPath) => !PARAMETER_UNITS.has(parameterPath));
const unitContractExtra = [...PARAMETER_UNITS.keys()].filter((parameterPath) => !allParameterPaths.includes(parameterPath));
if (unitContractMissing.length || unitContractExtra.length || PARAMETER_UNITS.size !== 103) {
  throw new Error(`invalid parameter unit contract: missing=${unitContractMissing.join(",")}; extra=${unitContractExtra.join(",")}`);
}

const argv = process.argv.slice(2);
const buildFromMode = argv.includes("--build-from");
const writeUiMode = argv.includes("--write-ui");
const checkMode = argv.includes("--check") || (!buildFromMode && !writeUiMode);
if ([checkMode, buildFromMode, writeUiMode].filter(Boolean).length !== 1) {
  throw new Error("--check, --build-from and --write-ui are mutually exclusive");
}
const positional = argv.filter((arg) => !["--check", "--build-from", "--write-ui"].includes(arg));
const scriptDirectory = path.dirname(import.meta.filename);
const inputPath = path.resolve(positional[0] ?? path.join(scriptDirectory, "bzm-2-2-all-pj-provisional-v0-1.json"));
const outputDirectory = path.resolve(positional[1] ?? scriptDirectory);
const jsonOutput = path.join(outputDirectory, "bzm-2-2-all-pj-provisional-v0-1.json");
const markdownOutput = path.resolve(positional[2] ?? (checkMode
  ? path.join(scriptDirectory, "..", "BZM_2_2_ALL_PJ_PARAMETER_LEDGER_2026-08-12.md")
  : path.join(outputDirectory, "BZM_2_2_ALL_PJ_PARAMETER_LEDGER_2026-08-12.md")));
const auditOutput = path.resolve(positional[3] ?? path.join(outputDirectory, "bzm-2-2-all-pj-provisional-v0-1.audit.json"));
const uiProjectionOutputDirectory = path.resolve(scriptDirectory, "../../pwa/src/generated/bzm-2-2-pilot");

const raw = fs.readFileSync(inputPath);
const source = JSON.parse(raw.toString("utf8"));
if (!Array.isArray(source.projects) || source.projects.length !== 12) {
  throw new Error(`expected 12 projects, got ${source.projects?.length ?? "missing"}`);
}

const sha256 = (value: string | Buffer) =>
  crypto.createHash("sha256").update(value).digest("hex");
const normalizeIso = (value: unknown, label: string) => {
  if (typeof value !== "string") throw new Error(`${label}: expected ISO timestamp string`);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error(`${label}: invalid ISO timestamp ${value}`);
  return new Date(milliseconds).toISOString();
};
const valueOr = (...values: unknown[]) => values.find((value) => value !== undefined);
const asInputs = (project: any) => project.normalized_inputs ?? project.normalizedInputs;
const asResult = (project: any) => project.provisionalBzm22 ?? project.provisionalSPS ?? project.sps22;
const asLedger = (project: any) => project.parameter_ledger ?? project.parameterLedger;
const canonicalizeLedgerUnits = (project: any) => {
  const ledger = asLedger(project);
  for (const [section, keys] of Object.entries(PARAMETER_SECTIONS)) {
    for (const key of keys) {
      if (!ledger?.[section]?.[key]) continue;
      ledger[section][key].unit = PARAMETER_UNITS.get(`${section}.${key}`);
    }
  }
};
function recursivelyRenamePilotFields(value: any): any {
  if (Array.isArray(value)) return value.map(recursivelyRenamePilotFields);
  if (typeof value === "string") return value
    .replaceAll("qRobust", "qStressProxy")
    .replaceAll("q_rob_minus", "q_stress_proxy_minus")
    .replaceAll("named-stress q_rob", "named-stress q_stress_proxy")
    .replaceAll("not a calibrated propulsion probability", "not calibrated as a propulsion outcome probability")
    .replaceAll("propulsion probability", "gate-product proxy")
    .replaceAll("confirmed_policy_argmax", "registered_current_control_shadow_not_argmax")
    .replaceAll("argmax_confirmed_executable", "registered_current_control_shadow_not_argmax")
    .replaceAll("single_confirmed_policy", "registered_current_control_shadow_not_argmax")
    .replaceAll("confirmed_executable", "shadow_only");
  if (!value || typeof value !== "object") return value;
  const output: any = {};
  for (const [key, child] of Object.entries(value)) {
    let renamed = key
      .replaceAll("qRobust", "qStressProxy")
      .replaceAll("qRob", "qStressProxy")
      .replaceAll("robustScenario", "stressProxyScenario")
      .replaceAll("strategicRobustness", "stressProxyDiagnostics")
      .replaceAll("propulsionProbability", "qGateProductProxy")
      .replaceAll("qModifier", "qGateProductProxyModifier")
      .replaceAll("optimizationStatus", "controlRegistrationStatus")
      .replaceAll("selectionStatus", "controlRegistrationStatus")
      .replaceAll("selectedPolicyDescription", "registeredCurrentControlDescription")
      .replaceAll("selectedPolicyId", "registeredCurrentControlId")
      .replaceAll("selectedPolicy", "registeredCurrentControl")
      .replaceAll("selectedControl", "registeredCurrentControlMetadata")
      .replaceAll("authorityConfirmedExecutableActionCount", "authorityApprovedActionCount")
      .replaceAll("confirmedFeasibleActionCount", "authorityApprovedActionCount")
      .replaceAll("confirmedFeasible", "authorityApproved")
      .replaceAll("confirmedCount", "authorityApprovedActionCount")
      .replaceAll("confirmedActions", "authorityApprovedActions")
      .replaceAll("possibleActions", "shadowActions");
    if (renamed === "q") renamed = "qGateProductProxy";
    output[renamed] = recursivelyRenamePilotFields(child);
  }
  return output;
}
const FORBIDDEN_LEGACY_METADATA_KEYS = new Set([
  "possibleActionIds",
  "confirmedActionIds",
  "liquidity_continuity_before_cliff",
]);
function recursivelyDeleteExactKeys(value: any, forbidden = FORBIDDEN_LEGACY_METADATA_KEYS): any {
  if (Array.isArray(value)) {
    value.forEach((child) => recursivelyDeleteExactKeys(child, forbidden));
    return value;
  }
  if (!value || typeof value !== "object") return value;
  for (const key of Object.keys(value)) {
    if (forbidden.has(key)) {
      delete value[key];
      continue;
    }
    recursivelyDeleteExactKeys(value[key], forbidden);
  }
  return value;
}
function recursivelyFindExactKeyPaths(value: any, forbidden = FORBIDDEN_LEGACY_METADATA_KEYS) {
  const paths: string[] = [];
  const visit = (child: any, currentPath: string) => {
    if (Array.isArray(child)) {
      child.forEach((item, index) => visit(item, `${currentPath}[${index}]`));
      return;
    }
    if (!child || typeof child !== "object") return;
    for (const [key, item] of Object.entries(child)) {
      const nextPath = currentPath ? `${currentPath}.${key}` : key;
      if (forbidden.has(key)) paths.push(nextPath);
      visit(item, nextPath);
    }
  };
  visit(value, "");
  return paths;
}
const asSlack = (project: any) => {
  const inputs = asInputs(project);
  const result = asResult(project);
  return inputs?.strategicSlack ?? project.bzm22?.stressProxyDiagnostics ??
    project.bzm22?.strategicRobustness ?? result?.strategicSlack ?? {};
};
const asActionEvaluations = (project: any) => {
  const inputs = asInputs(project);
  return inputs?.actionEvaluations ?? project.actionEvaluations ?? [];
};
const actionId = (evaluation: any) => evaluation.actionId ?? evaluation.id;
const scenarioTitle = (scenario: string) => scenario[0].toUpperCase() + scenario.slice(1);
const product = (values: number[]) => values.reduce((accumulator, value) => accumulator * value, 1);
const round6 = (value: number) => Math.round(value * 1e6) / 1e6;
const finite = (value: unknown): value is number => Number.isFinite(value);
const approx = (left: unknown, right: unknown, tolerance = 1e-5) =>
  finite(left) && finite(right) && Math.abs(left - right) <= tolerance;
const selectedPolicy = (project: any) => {
  const inputs = asInputs(project);
  const result = asResult(project);
  return result?.registeredCurrentControl ?? result?.selectedPolicy ??
    inputs?.registeredCurrentControlId ?? inputs?.selectedPolicyId ?? inputs?.selectedControl?.actionId ?? null;
};

const scenarioNumber = (row: any, key: string, scenario: string) => {
  const title = scenarioTitle(scenario);
  const candidate = valueOr(row?.[`${key}${title}`], row?.[key]?.[scenario], row?.[key]);
  return finite(candidate) ? candidate : 0;
};

function probabilityMap(evaluation: any, scenario: string) {
  if (Array.isArray(evaluation.namedGateProbabilities)) {
    return Object.fromEntries(evaluation.namedGateProbabilities.map((gate: any) => [gate.key, gate[scenario]]));
  }
  return evaluation.gateProbabilities?.[scenario] ?? {};
}

function gateMonth(inputs: any, evaluation: any, key: string) {
  const explicit = evaluation.gates?.find((gate: any) => gate.key === key)?.month;
  if (finite(explicit)) return explicit;
  const baseline = inputs.gates?.find((gate: any) => gate.key === key)?.month;
  if (finite(baseline)) return baseline;
  const custom: Record<string, number> = {
    rights_holder_consent: 6,
    counterparty_binding_offer: 12,
    governance_and_rights_exit_consent: 3,
    orderly_maintenance: 3,
    historical_terminal_settlement: 3,
  };
  return custom[key] ?? null;
}

function storedActionScenario(evaluation: any, scenario: string) {
  if (evaluation.scenarioCalculations?.[scenario]) return evaluation.scenarioCalculations[scenario];
  if (evaluation.scenarios?.[scenario]) return evaluation.scenarios[scenario];
  if (evaluation.J && evaluation.calculation && scenario === "base") {
    return {
      qGateProductProxy: evaluation.qGateProductProxy?.base ?? evaluation.q?.base,
      pathPV: evaluation.calculation.pathPV,
      successContribution: evaluation.calculation.successContribution,
      failureContribution: evaluation.calculation.failureContribution,
      J: evaluation.J.base,
    };
  }
  return {
    qGateProductProxy: evaluation.qGateProductProxy?.[scenario] ?? evaluation.q?.[scenario],
    J: evaluation.J?.[scenario],
  };
}

function forecastEconomicCF(forecast: any[], scenario: string) {
  return (forecast ?? []).map((row: any) => round6(
    scenarioNumber(row, "revenue", scenario) -
    scenarioNumber(row, "opex", scenario) -
    scenarioNumber(row, "capex", scenario) -
    scenarioNumber(row, "nwcDelta", scenario) +
    scenarioNumber(row, "businessGrantCash", scenario),
  ));
}

function scenarioDiscountRate(inputs: any, scenario: string) {
  const explicit = inputs?.discountRateByScenario?.[scenario];
  return finite(explicit) ? explicit : null;
}

function scenarioTerminalValue(evaluation: any, scenario: string) {
  const candidate = evaluation?.terminalValueAtHMillionJpy;
  if (!candidate || typeof candidate !== "object") return null;
  return finite(candidate[scenario]) ? candidate[scenario] : null;
}

function scenarioEconomicCF(evaluation: any, inputs: any, scenario: string) {
  const explicit = evaluation?.monthlyEconomicCFByScenario?.[scenario];
  return Array.isArray(explicit) ? explicit : forecastEconomicCF(
    evaluation?.monthlyForecast ?? inputs?.monthlyForecast ?? [], scenario,
  );
}

function noFinancingFirstCliff(inputs: any, evaluation: any, scenario: string) {
  const openingCash = scenarioNumber(inputs, "openingUnrestrictedCash", scenario);
  const minimumCash = scenarioNumber(inputs, "minimumCash", scenario);
  const economicCF = scenarioEconomicCF(evaluation, inputs, scenario);
  if (!finite(openingCash) || !finite(minimumCash) || !economicCF.length) return null;
  let cash = openingCash;
  for (let index = 0; index < economicCF.length; index += 1) {
    cash += economicCF[index];
    if (cash < minimumCash) return index + 1;
  }
  return null;
}

function minimumCashDrawSchedule(inputs: any, evaluation: any, scenario: string) {
  const openingCash = scenarioNumber(inputs, "openingUnrestrictedCash", scenario);
  const minimumCash = scenarioNumber(inputs, "minimumCash", scenario);
  const economicCF = scenarioEconomicCF(evaluation, inputs, scenario);
  const forecast = evaluation?.monthlyForecast ?? inputs?.monthlyForecast ?? [];
  if (!finite(openingCash) || !finite(minimumCash) || !economicCF.length) return [];
  let cash = openingCash;
  let cumulativeRequired = 0;
  const draws: any[] = [];
  for (let index = 0; index < economicCF.length; index += 1) {
    cash += economicCF[index];
    if (cash < minimumCash) {
      const amount = minimumCash - cash;
      cumulativeRequired += amount;
      draws.push({
        monthNumber: index + 1,
        month: forecast[index]?.month ?? index + 1,
        amountMillionJpy: round6(amount),
        cumulativeRequiredMillionJpy: round6(cumulativeRequired),
      });
      cash = minimumCash;
    }
  }
  return draws;
}

function fundingGateKey(probabilityByKey: Record<string, unknown>) {
  const keys = Object.keys(probabilityByKey);
  return keys.find((key) =>
    /fund|financ|cash|capital|liquidity|round|series|grant|award|investment|runway/i.test(key));
}

function pipelineTimingMonthNumber(timing: unknown, valuationDate: string) {
  if (typeof timing !== "string") return null;
  const match = timing.match(/(20\d{2})[-/]?(0[1-9]|1[0-2])/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const valuationYear = Number(valuationDate.slice(0, 4));
  const valuationMonth = Number(valuationDate.slice(5, 7));
  return (year - valuationYear) * 12 + month - valuationMonth + 1;
}

function datedCapacityAtDeadline(events: any[], deadlineMonth: number, valuationDate: string) {
  return events.reduce((sum: number, row: any) => {
    const availableMonth = pipelineTimingMonthNumber(row.cashEventDate ?? row.timing, valuationDate);
    const amount = Number(valueOr(row.amountMillionJpy, row.amount, 0));
    return finite(availableMonth) && availableMonth >= 1 && availableMonth <= deadlineMonth && finite(amount) && amount > 0
      ? sum + amount
      : sum;
  }, 0);
}

function bottleneckCoverage(draws: any[], events: any[], valuationDate: string) {
  if (!draws.length) return { ratio: 1, deadlines: [] };
  const deadlines = draws.map((draw: any) => {
    const availableCapacityMillionJpy = datedCapacityAtDeadline(events, draw.monthNumber, valuationDate);
    const cumulativeRequiredMillionJpy = Number(draw.cumulativeRequiredMillionJpy);
    return {
      monthNumber: draw.monthNumber,
      month: draw.month,
      cumulativeRequiredMillionJpy,
      availableCapacityMillionJpy: round6(availableCapacityMillionJpy),
      coverageRatio: cumulativeRequiredMillionJpy > 0
        ? round6(Math.min(1, availableCapacityMillionJpy / cumulativeRequiredMillionJpy))
        : 1,
    };
  });
  return {
    ratio: Math.min(...deadlines.map((row: any) => row.coverageRatio)),
    deadlines,
  };
}

function imputedLiquidityGate(inputs: any, evaluation: any, earliestCliff: number) {
  const valuationDate = String(inputs.valuationDate ?? "2026-08-12");
  const candidates = (inputs.financingPipeline ?? []).filter((row: any) => {
    const classification = String(row.classification ?? row.cashStatus ?? "");
    const timingMonth = pipelineTimingMonthNumber(row.cashEventDate ?? row.timing, valuationDate);
    return /conditional/i.test(classification) &&
      finite(row.probability) && row.probability > 0 && row.probability <= 1 &&
      finite(timingMonth) && timingMonth >= 1 && timingMonth <= earliestCliff;
  });
  const priors: Record<string, number> = { low: 0.25, base: 0.45, high: 0.65 };
  const committedEvents = (inputs.financingPipeline ?? []).filter((row: any) =>
    /committed/i.test(String(row.classification ?? row.cashStatus ?? "")) &&
    finite(Number(valueOr(row.amountMillionJpy, row.amount))) &&
    Number(valueOr(row.amountMillionJpy, row.amount)) > 0 &&
    finite(pipelineTimingMonthNumber(row.cashEventDate ?? row.timing, valuationDate)) &&
    Number(pipelineTimingMonthNumber(row.cashEventDate ?? row.timing, valuationDate)) >= 1);
  const coverageByScenario: any = {};
  const probabilities: any = {};
  const selectedCandidates: any[] = [];
  for (const scenario of ["low", "base", "high"]) {
    const draws = minimumCashDrawSchedule(inputs, evaluation, scenario);
    const required = draws.at(-1)?.cumulativeRequiredMillionJpy ?? 0;
    const binding = bottleneckCoverage(draws, committedEvents, valuationDate);
    const candidateRows = candidates.map((candidate: any) => {
      const withCandidate = bottleneckCoverage(draws, [...committedEvents, candidate], valuationDate);
      const candidateProbability = Number(candidate.probability);
      return {
        candidate,
        withCandidate,
        expectedCoverage: (1 - candidateProbability) * binding.ratio + candidateProbability * withCandidate.ratio,
      };
    });
    const selected = candidateRows.reduce((best: any, row: any) =>
      !best || row.expectedCoverage > best.expectedCoverage ? row : best, null);
    const highest = selected?.candidate ?? null;
    const candidateAmount = highest ? Number(valueOr(highest.amountMillionJpy, highest.amount, 0)) : 0;
    const candidateProbability = highest ? Number(highest.probability) : 0;
    const rhoi = selected?.withCandidate?.ratio ?? binding.ratio;
    const expectedCandidateCoverage = selected?.expectedCoverage ?? binding.ratio;
    selectedCandidates.push(highest);
    probabilities[scenario] = round6(Math.min(1, Math.max(priors[scenario], binding.ratio, expectedCandidateCoverage)));
    coverageByScenario[scenario] = {
      fullHorizonRequiredMillionJpy: round6(required),
      bindingCommittedCapacityMillionJpy: round6(datedCapacityAtDeadline(committedEvents, draws.at(-1)?.monthNumber ?? 0, valuationDate)),
      selectedConditionalCandidateCapacityMillionJpy: round6(candidateAmount),
      selectedConditionalCandidateProbability: round6(candidateProbability),
      selectedConditionalCandidateEventId: highest?.cashEventId ?? highest?.stage ?? null,
      bindingCoverageRatio: round6(binding.ratio),
      candidateCoverageRatio: round6(rhoi),
      expectedBottleneckCoverageProxy: round6(expectedCandidateCoverage),
      registeredPriorProxy: priors[scenario],
      bindingCapacityByDeadline: binding.deadlines,
      candidateCapacityByDeadline: selected?.withCandidate?.deadlines ?? binding.deadlines,
      draws,
    };
  }
  const selectedUnique: any[] = [...new Map(selectedCandidates.filter(Boolean)
    .map((row: any) => [row.cashEventId ?? row.stage, row])).values()];
  const sourceRefs = selectedUnique.length
    ? selectedUnique.flatMap((row: any) => [
        ...(row.evidence?.sourceRefs ?? []),
        `financingPipeline:${row.cashEventId ?? row.stage ?? "conditional_candidate"}`,
      ])
    : ["calculation:pre_registered_missing-liquidity-evidence-prior:v0.1"];
  return {
    key: LIQUIDITY_GATE_KEY,
    probabilities,
    coverageByScenario,
    sourceRefs: [...new Set(sourceRefs.map(String))],
    rule: selectedUnique.length
      ? "Full-horizon liquidity package proxy: max of preregistered prior, binding-capacity bottleneck coverage, and the expected bottleneck coverage of the single strongest cliff-timed conditional candidate. It covers every minimum-cash top-up deadline; correlated candidates are not summed."
      : "Full-horizon liquidity package proxy with no eligible cliff-timed conditional candidate: max of preregistered prior 0.25/0.45/0.65 and binding-capacity bottleneck coverage.",
    evidenceStatus: selectedUnique.length ? "pipeline_derived_imputation" : "pre_registered_missing_evidence_prior",
  };
}

function financialCompositeGateKey(key: string) {
  return key !== LIQUIDITY_GATE_KEY &&
    /fund|financ|cash|capital|liquidity|round|series|grant|award|investment|runway/i.test(key);
}

function neutralizeSubsumedFinancialGates(evaluation: any) {
  evaluation.subsumedCompositeGateAudit ??= [];
  if (Array.isArray(evaluation.namedGateProbabilities)) {
    for (const row of evaluation.namedGateProbabilities) {
      if (!financialCompositeGateKey(row.key)) continue;
      const original = Object.fromEntries(["low", "base", "high"].map((scenario) => [scenario, row[scenario]]));
      row.originalCompositeProbabilityForAudit = original;
      row.low = 1;
      row.base = 1;
      row.high = 1;
      row.effectiveProbabilityInProxyProduct = { low: 1, base: 1, high: 1 };
      row.includedInProxyProduct = false;
      row.nonFinancialResidualStatus = "not_separately_estimable_omitted_from_proxy_product";
      row.financialComponentSubsumedBy = LIQUIDITY_GATE_KEY;
      evaluation.subsumedCompositeGateAudit.push({
        key: row.key,
        originalCompositeProbabilityForAudit: original,
        effectiveProbabilityInProxyProduct: { low: 1, base: 1, high: 1 },
        includedInProxyProduct: false,
        nonFinancialResidualStatus: row.nonFinancialResidualStatus,
      });
    }
  } else if (evaluation.gateProbabilities) {
    const keys = new Set<string>();
    for (const scenario of ["low", "base", "high"]) {
      for (const key of Object.keys(evaluation.gateProbabilities?.[scenario] ?? {})) {
        if (financialCompositeGateKey(key)) keys.add(key);
      }
    }
    for (const key of keys) {
      const original = Object.fromEntries(["low", "base", "high"].map((scenario) => [
        scenario, evaluation.gateProbabilities?.[scenario]?.[key],
      ]));
      for (const scenario of ["low", "base", "high"]) evaluation.gateProbabilities[scenario][key] = 1;
      evaluation.subsumedCompositeGateAudit.push({
        key,
        originalCompositeProbabilityForAudit: original,
        effectiveProbabilityInProxyProduct: { low: 1, base: 1, high: 1 },
        includedInProxyProduct: false,
        nonFinancialResidualStatus: "not_separately_estimable_omitted_from_proxy_product",
        financialComponentSubsumedBy: LIQUIDITY_GATE_KEY,
      });
    }
  }
}

function addLiquidityGateProbability(evaluation: any, gate: any) {
  if (Array.isArray(evaluation.namedGateProbabilities)) {
    evaluation.namedGateProbabilities = evaluation.namedGateProbabilities.filter((row: any) =>
      row.key !== "liquidity_continuity_before_cliff" && row.key !== LIQUIDITY_GATE_KEY);
  }
  if (evaluation.gateProbabilities) {
    for (const scenario of ["low", "base", "high"]) {
      delete evaluation.gateProbabilities?.[scenario]?.liquidity_continuity_before_cliff;
      delete evaluation.gateProbabilities?.[scenario]?.[LIQUIDITY_GATE_KEY];
    }
  }
  if (Array.isArray(evaluation.namedGateProbabilities)) {
    if (!evaluation.namedGateProbabilities.some((row: any) => row.key === gate.key)) {
      evaluation.namedGateProbabilities.push({
        key: gate.key,
        ...gate.probabilities,
        multiplier: 1,
        evidenceStatus: gate.evidenceStatus,
        rule: gate.rule,
        sourceRefs: gate.sourceRefs,
      });
    }
    return;
  }
  evaluation.gateProbabilities ??= { low: {}, base: {}, high: {} };
  for (const scenario of ["low", "base", "high"]) {
    evaluation.gateProbabilities[scenario] ??= {};
    if (!(gate.key in evaluation.gateProbabilities[scenario])) {
      evaluation.gateProbabilities[scenario][gate.key] = gate.probabilities[scenario];
    }
  }
  evaluation.gateProbabilityEvidence ??= {};
  evaluation.gateProbabilityEvidence[gate.key] = {
    evidenceStatus: gate.evidenceStatus,
    rule: gate.rule,
    sourceRefs: gate.sourceRefs,
  };
}

function independentActionScenario(project: any, evaluation: any, scenario: string) {
  const inputs = asInputs(project);
  const ledger = asLedger(project);
  const registeredCurrentControl = actionId(evaluation) === selectedPolicy(project);
  const probabilityByKey = probabilityMap(evaluation, scenario);
  const gates = Object.entries(probabilityByKey).map(([key, probability], originalIndex) => ({
    key,
    originalIndex,
    probability: Number(probability),
    month: gateMonth(inputs, evaluation, key),
    definition: evaluation.gates?.find((gate: any) => gate.key === key),
  }));
  if (!gates.length || gates.some((gate) => !finite(gate.month) || !finite(gate.probability))) {
    return { calculable: false, reason: "gate probability/month missing" };
  }
  const forecast = evaluation.monthlyForecast ?? inputs.monthlyForecast;
  const economicCFSeries = registeredCurrentControl
    ? ledger?.transition?.transition_cf?.imputed?.[scenario]
    : scenarioEconomicCF(evaluation, inputs, scenario);
  const discountRate = registeredCurrentControl
    ? ledger?.version_horizon_rules?.valuation_rule?.imputed?.[scenario]?.discountRate
    : scenarioDiscountRate(inputs, scenario);
  const horizon = inputs.horizonMonths;
  const terminalValue = registeredCurrentControl
    ? ledger?.transition?.terminal_value?.imputed?.[scenario]
    : scenarioTerminalValue(evaluation, scenario);
  if (!Array.isArray(forecast) || forecast.length !== economicCFSeries.length ||
      !finite(discountRate) || !finite(horizon) || !finite(terminalValue)) {
    return { calculable: false, reason: "scenario forecast/discount/horizon/terminal bundle missing" };
  }
  const qGateProductProxy = product(gates.map((gate) => gate.probability));
  let pathPV = 0;
  let fullPathPV = 0;
  const economicCF: any[] = [];
  for (let index = 0; index < forecast.length; index += 1) {
    const month = index + 1;
    const row = forecast[index];
    const cf = economicCFSeries[index];
    const survival = product(gates
      .filter((gate) => Number(gate.month) <= month)
      .map((gate) => gate.probability));
    const discount = Math.pow(1 + discountRate, month / 12);
    pathPV += survival * cf / discount;
    fullPathPV += cf / discount;
    economicCF.push({
      month: row.month,
      economicCF: round6(cf),
      gateSurvival: round6(survival),
      financingCash: (row.committedFundingCash ?? 0) + (row.conditionalFundingCash ?? 0),
    });
  }
  const terminalPV = terminalValue / Math.pow(1 + discountRate, horizon / 12);
  const successContribution = qGateProductProxy * terminalPV;
  let failureContribution = 0;
  let prior = 1;
  const gateTrace: any[] = [];
  const chronologicalGates = [...gates].sort((left, right) =>
    Number(left.month) - Number(right.month) || left.originalIndex - right.originalIndex);
  for (const gate of chronologicalGates) {
    let signedExit: unknown;
    if (finite(gate.definition?.signedFailureNetSettlementByScenario?.[scenario])) {
      signedExit = gate.definition.signedFailureNetSettlementByScenario[scenario];
    } else if (Array.isArray(evaluation.signedFailureNetSettlementAtGateMillionJpy)) {
      signedExit = evaluation.signedFailureNetSettlementAtGateMillionJpy[gate.originalIndex];
    } else if (evaluation.failureExitNetSettlementMillionJpy) {
      signedExit = evaluation.failureExitNetSettlementMillionJpy[scenario];
    } else {
      const title = scenarioTitle(scenario);
      const gross = inputs.exitInputs?.[`licenseValue${title}`] ??
        inputs.exitInputs?.licenseValueBase ??
        inputs.exitInputs?.grossExitValueAtGateMillionJpy?.[gate.originalIndex];
      const closure = inputs.exitInputs?.closureCost ??
        inputs.exitInputs?.closureCostAtGateMillionJpy?.[gate.originalIndex];
      signedExit = finite(gross) && finite(closure) ? gross - closure : null;
    }
    if (!finite(signedExit)) return { calculable: false, reason: "signed exit missing" };
    const failureBranchWeight = prior * (1 - gate.probability);
    failureContribution += failureBranchWeight * signedExit /
      Math.pow(1 + discountRate, Number(gate.month) / 12);
    prior *= gate.probability;
    gateTrace.push({
      key: gate.key,
      month: gate.month,
      probability: round6(gate.probability),
      cumulativeSurvival: round6(prior),
      failureBranchWeight: round6(failureBranchWeight),
      signedFailureSettlementMillionJpy: round6(Number(signedExit)),
    });
  }
  return {
    calculable: true,
    qGateProductProxy: round6(qGateProductProxy),
    pathPV: round6(pathPV),
    fullPathPV: round6(fullPathPV),
    terminalPV: round6(terminalPV),
    successContribution: round6(successContribution),
    failureContribution: round6(failureContribution),
    J: round6(pathPV + successContribution + failureContribution),
    conditionalSuccess: round6(fullPathPV + terminalPV),
    economicCF,
    scenarioInputs: {
      discountRate,
      terminalValue,
      monthlyEconomicCF: economicCFSeries,
    },
    chronologicalGateOrder: chronologicalGates.map((gate) => ({
      key: gate.key,
      month: gate.month,
      registeredOrder: gate.originalIndex,
    })),
    gateTrace,
    terminalGateSurvival: round6(qGateProductProxy),
    failureStopsFutureEconomicCFAndTerminal: true,
  };
}

function selectedFundingNeed(project: any, selectedEvaluation: any, scenario: string) {
  const inputs = asInputs(project);
  const forecast = selectedEvaluation?.monthlyForecast ?? inputs?.monthlyForecast;
  const economicCFSeries = scenarioEconomicCF(selectedEvaluation, inputs, scenario);
  const openingCash = scenarioNumber(inputs, "openingUnrestrictedCash", scenario);
  const minimumCash = scenarioNumber(inputs, "minimumCash", scenario);
  const probabilityByKey = probabilityMap(selectedEvaluation, scenario);
  const gates = Object.entries(probabilityByKey).map(([key, probability]) => ({
    key,
    probability: Number(probability),
    month: gateMonth(inputs, selectedEvaluation, key),
  }));
  if (!Array.isArray(forecast) || forecast.length !== economicCFSeries.length ||
      !finite(openingCash) || !finite(minimumCash) ||
      gates.some((gate) => !finite(gate.probability) || !finite(gate.month))) {
    return { calculable: false, reason: "forecast, opening cash, minimum cash, or gate timing missing" };
  }
  let counterfactualCash = openingCash;
  let requiredFunding = 0;
  let survivalWeightedMinimumCashTopUpNeed = 0;
  const draws: any[] = [];
  for (let index = 0; index < forecast.length; index += 1) {
    const row = forecast[index];
    const monthNumber = index + 1;
    const economicCF = economicCFSeries[index];
    // Financing cash is intentionally absent from this counterfactual path.
    counterfactualCash += economicCF;
    if (counterfactualCash < minimumCash) {
      const draw = minimumCash - counterfactualCash;
      const survival = product(gates
        .filter((gate) => Number(gate.month) <= monthNumber)
        .map((gate) => gate.probability));
      requiredFunding += draw;
      survivalWeightedMinimumCashTopUpNeed += draw * survival;
      draws.push({
        month: row.month ?? monthNumber,
        monthNumber,
        drawMillionJpy: round6(draw),
        survivalImmediatelyBeforeDraw: round6(survival),
        weightedDrawMillionJpy: round6(draw * survival),
      });
      counterfactualCash = minimumCash;
    }
  }
  return {
    calculable: true,
    openingCash: round6(openingCash),
    minimumCash: round6(minimumCash),
    requiredFunding: round6(requiredFunding),
    survivalWeightedMinimumCashTopUpNeed: round6(survivalWeightedMinimumCashTopUpNeed),
    draws,
  };
}

const structuralPi0NA = {
  status: "structurally_not_computable",
  reason: "A complete explicitly registered off-path baseline policy pi0 is absent; do not invent a counterfactual policy or reverse-solve it from the selected path.",
};

function setSlotImputed(slot: any, values: any, options: any = {}) {
  slot.value = values.base;
  slot.imputed = values;
  if (options.observedStatus) slot.observedStatus = options.observedStatus;
  if (options.rule) slot.rule = options.rule;
  if (options.confidenceDriver) slot.confidenceDriver = options.confidenceDriver;
  if (options.usedInCalculation !== undefined) slot.usedInCalculation = options.usedInCalculation;
  if (options.sourceRef) {
    slot.sourceRefs ??= [];
    if (!slot.sourceRefs.includes(options.sourceRef)) slot.sourceRefs.push(options.sourceRef);
  }
}

function canonicalizeDerivedContracts(project: any) {
  const inputs = asInputs(project);
  const result = asResult(project);
  const ledger = asLedger(project);
  const historicalTerminal = project.projectName === "Yellow Duck";
  const selectedId = selectedPolicy(project);
  inputs.registeredCurrentControlId = selectedId;
  const evaluations = asActionEvaluations(project);

  // Rebuild from registered path dates before adding any liquidity diagnostic.
  // A previous pilot revision improperly moved existing gates to the cash cliff.
  for (const candidate of evaluations) {
    if (Array.isArray(candidate.namedGateProbabilities)) {
      candidate.namedGateProbabilities = candidate.namedGateProbabilities.filter((row: any) =>
        row.key !== "liquidity_continuity_before_cliff" && row.key !== LIQUIDITY_GATE_KEY);
    }
    if (candidate.gateProbabilities) {
      for (const scenario of ["low", "base", "high"]) {
        delete candidate.gateProbabilities?.[scenario]?.liquidity_continuity_before_cliff;
        delete candidate.gateProbabilities?.[scenario]?.[LIQUIDITY_GATE_KEY];
      }
    }
    candidate.gates = (candidate.gates ?? []).filter((gate: any) =>
      gate.key !== "liquidity_continuity_before_cliff" && gate.key !== LIQUIDITY_GATE_KEY);
    for (const gate of candidate.gates) {
      const registeredMonth = REGISTERED_GATE_MONTHS[project.projectName]?.[gate.key];
      if (finite(registeredMonth)) gate.month = registeredMonth;
    }
  }
  inputs.gates = (inputs.gates ?? []).filter((gate: any) =>
    gate.key !== "liquidity_continuity_before_cliff" && gate.key !== LIQUIDITY_GATE_KEY);
  for (const gate of inputs.gates) {
    const registeredMonth = REGISTERED_GATE_MONTHS[project.projectName]?.[gate.key];
    if (finite(registeredMonth)) gate.month = registeredMonth;
  }

  for (const evaluation of evaluations) {
    const currentControl = actionId(evaluation) === selectedId;
    evaluation.decisionAvailability = historicalTerminal && currentControl
      ? "historical_terminal_shadow_only"
      : currentControl ? "provisional_current_control" : "shadow_only";
    evaluation.feasibilityClass = "shadow_only";
    evaluation.optimizationUse = "shadow_only";
    evaluation.executionStatus = historicalTerminal
      ? "historical_terminal_or_alternative_shadow_only"
      : currentControl
        ? "registered_current_control_shadow_authority_unverified"
        : "unregistered_alternative_shadow_only";
  }
  for (const action of inputs.actions ?? []) {
    const currentControl = action.id === selectedId;
    action.decisionAvailability = historicalTerminal && currentControl
      ? "historical_terminal_shadow_only"
      : currentControl ? "provisional_current_control" : "shadow_only";
    action.feasibilityClass = "shadow_only";
    action.optimizationUse = "shadow_only";
    action.executionStatus = historicalTerminal
      ? "historical_terminal_or_alternative_shadow_only"
      : currentControl
        ? "registered_current_control_shadow_authority_unverified"
        : "unregistered_alternative_shadow_only";
  }
  if (!historicalTerminal) {
    inputs.controlRegistrationStatus = "registered_current_control_shadow_not_argmax";
    delete inputs.optimizationStatus;
    if (inputs.selectedControl) {
      inputs.selectedControl.controlRegistrationStatus = "registered_current_control_shadow_not_argmax";
      delete inputs.selectedControl.selectionStatus;
    }
    result.controlRegistrationStatus = "registered_current_control_shadow_not_argmax";
    delete result.optimizationStatus;
    delete result.selectionStatus;
    result.authorityConfirmedExecutableActionCount = 0;
    result.shadowActionCount = evaluations.length;
    delete result.confirmedFeasibleActionCount;
    delete result.possibleFeasibleActionCount;
  }
  const renamedSlack = recursivelyRenamePilotFields(asSlack(project));
  if (inputs.strategicSlack) {
    inputs.strategicSlack = renamedSlack;
    if (!historicalTerminal) {
      inputs.strategicSlack.authorityConfirmedExecutableActionCount = 0;
      inputs.strategicSlack.shadowActionCount = evaluations.length;
      delete inputs.strategicSlack.confirmedFeasibleActionCount;
      delete inputs.strategicSlack.confirmedCount;
      delete inputs.strategicSlack.possibleFeasibleActionCount;
      delete inputs.strategicSlack.possibleCount;
    }
  }
  if (project.bzm22?.strategicRobustness) {
    project.bzm22.stressProxyDiagnostics = recursivelyRenamePilotFields(project.bzm22.strategicRobustness);
    delete project.bzm22.strategicRobustness;
  }
  if (project.bzm22?.stressProxyDiagnostics) {
    project.bzm22.stressProxyDiagnostics.authorityApprovedActionCount = 0;
    project.bzm22.stressProxyDiagnostics.shadowActionCount = evaluations.length;
    delete project.bzm22.stressProxyDiagnostics.possibleFeasibleActionCount;
    delete project.bzm22.stressProxyDiagnostics.confirmedFeasibleActionCount;
  }
  if (project.bzm22?.feasibility) {
    project.bzm22.feasibility.authorityApprovedActionCount = 0;
    project.bzm22.feasibility.shadowActionCount = evaluations.length;
    project.bzm22.feasibility.shadowActionIds = evaluations.map(actionId);
    delete project.bzm22.feasibility.confirmedActionIds;
    delete project.bzm22.feasibility.possibleCount;
    delete project.bzm22.feasibility.violatedCount;
  }
  if (result.strategicSlack) result.strategicSlack = recursivelyRenamePilotFields(result.strategicSlack);
  for (const key of Object.keys(result)) {
    if (key.includes("qRobust")) {
      result[key.replaceAll("qRobust", "qStressProxy")] = result[key];
      delete result[key];
    }
  }
  const zeroAuthority = (value: any): any => {
    if (Array.isArray(value)) return value.map(zeroAuthority);
    if (!value || typeof value !== "object") return value;
    for (const key of Object.keys(value)) {
      if (/^authorityApproved(ActionCount|Actions)$/.test(key)) value[key] = 0;
      if (key === "confirmedActionIds") {
        value.shadowActionIds = evaluations.map(actionId);
        delete value[key];
        continue;
      }
      value[key] = zeroAuthority(value[key]);
    }
    return value;
  };
  zeroAuthority(project.bzm22);
  zeroAuthority(ledger.decision_state.slack_state);

  setSlotImputed(ledger.version_horizon_rules.model_id, {
    low: "BZM", base: "BZM", high: "BZM",
  }, {
    observedStatus: "design_choice",
    rule: "BZM 2.2 provisional internal pilot. q_gate_product_proxy, q_stress_proxy and J are separate diagnostics, not the current operating SPS 9-axis score.",
    usedInCalculation: true,
  });
  setSlotImputed(ledger.version_horizon_rules.decision_criterion, {
    low: "not_applicable_registered_current_control_shadow_only",
    base: "not_applicable_registered_current_control_shadow_only",
    high: "not_applicable_registered_current_control_shadow_only",
  }, {
    observedStatus: "not_applicable_no_action_optimization",
    rule: "No optimizer-selected decision is claimed in this pilot. The registered current control is evaluated as a shadow diagnostic only.",
    usedInCalculation: false,
  });
  setSlotImputed(ledger.version_horizon_rules.near_tie_tolerance, {
    low: 0, base: 0, high: 0,
  }, {
    observedStatus: "not_applicable_no_action_optimization",
    rule: "No action optimization or near-tie classification is performed for the current-control shadow.",
    usedInCalculation: false,
  });
  setSlotImputed(ledger.version_horizon_rules.tie_break_rule, {
    low: "not_applicable_no_argmax_shadow_only",
    base: "not_applicable_no_argmax_shadow_only",
    high: "not_applicable_no_argmax_shadow_only",
  }, {
    observedStatus: "not_applicable_no_action_optimization",
    rule: "No action argmax is performed; therefore no tie-break rule is used.",
    usedInCalculation: false,
  });
  if (/^imputed(?:_|$)/.test(inputs.openingCashStatus ?? "")) {
    inputs.openingCashStatus = "imputed";
    inputs.openingCashProvenance = valueOr(
      inputs.openingCashProvenance,
      "not bank-reconciled; low-precision opening-balance imputation",
    );
  }
  const forecasts = [inputs.monthlyForecast, ...asActionEvaluations(project).map((row: any) => row.monthlyForecast)];
  for (const forecast of forecasts) {
    for (const row of forecast ?? []) {
      if (!Array.isArray(row.financingEvents)) row.financingEvents = [];
      row.financingEvents = row.financingEvents.map((event: any) => {
        const rawClassification = event.classification ?? event.cashStatus;
        const classification = /committed/.test(rawClassification ?? "") ? "committed" :
          /conditional/.test(rawClassification ?? "") ? "conditional" : rawClassification;
        const cashStatus = classification === "committed" ? "committed_future" :
          classification === "conditional" ? "conditional_future" : event.cashStatus;
        return {
          ...event,
          cashStatus,
          classification,
          amountMillionJpy: valueOr(event.amountMillionJpy, event.amount),
        };
      });
    }
  }
  const evaluation = evaluations.find((candidate: any) => actionId(candidate) === selectedId);
  if (!evaluation) throw new Error(`${project.projectName}: selected action evaluation missing`);
  setSlotImputed(ledger.action_bundle.availability, {
    low: "shadow_only", base: "shadow_only", high: "shadow_only",
  }, {
    observedStatus: historicalTerminal
      ? "historical_terminal_shadow_only"
      : "registered_current_control_shadow_only",
    rule: historicalTerminal
      ? "Historical terminal closeout is retained only as a shadow reconstruction and is not a current execution authorization."
      : "The registered current control is evaluated only as an internal low-precision shadow. Authority, consent, rights, and feasibility are incomplete, so this is neither an execution authorization nor an optimality claim.",
    usedInCalculation: true,
  });
  for (const candidateAction of inputs.actions ?? []) {
    candidateAction.decisionAvailability = historicalTerminal && candidateAction.id === selectedId
      ? "historical_terminal_shadow_only"
      : candidateAction.id === selectedId ? "provisional_current_control" : "shadow_only";
    candidateAction.feasibilityClass = "shadow_only";
    candidateAction.optimizationUse = "shadow_only";
  }

  const originalTerminalRange = ledger.transition.terminal_value.imputed;
  const originalTerminalBase = Number(originalTerminalRange?.base);
  const terminalMultiplier = Object.fromEntries(["low", "base", "high"].map((scenario) => [
    scenario,
    finite(originalTerminalRange?.[scenario]) && finite(originalTerminalBase) && originalTerminalBase !== 0
      ? originalTerminalRange[scenario] / originalTerminalBase
      : 1,
  ]));
  const rawDiscount = inputs.successValueInputs?.WACC;
  inputs.discountRateByScenario = Object.fromEntries(["low", "base", "high"].map((scenario) => [
    scenario,
    finite(rawDiscount?.[scenario]) ? rawDiscount[scenario] : rawDiscount,
  ]));
  if (!["low", "base", "high"].every((scenario) => finite(inputs.discountRateByScenario[scenario]))) {
    throw new Error(`${project.projectName}: explicit discountRateByScenario is incomplete`);
  }
  setSlotImputed(ledger.version_horizon_rules.valuation_rule, Object.fromEntries(
    ["low", "base", "high"].map((scenario) => [scenario, {
      formula: "company economic CF; financing excluded; gate-survival weighted path and terminal",
      discountRate: inputs.discountRateByScenario[scenario],
      discountRateUnit: "annual_decimal",
      scenarioBundle: scenario,
    }]),
  ), {
    observedStatus: "design_choice_with_explicit_scenario_bundle",
    rule: "Each low/base/high calculation reads its own explicit discount-rate bundle. Equal values mean no evidenced scenario spread, not a fallback to base.",
    usedInCalculation: true,
  });

  for (const candidate of evaluations) {
    const terminalCandidate = candidate.terminalValueAtHMillionJpy ?? inputs.successValueInputs?.terminalValueAtHMillionJpy;
    candidate.terminalValueAtHMillionJpy = Object.fromEntries(["low", "base", "high"].map((scenario) => [
      scenario,
      finite(terminalCandidate?.[scenario])
        ? terminalCandidate[scenario]
        : finite(terminalCandidate)
          ? round6(terminalCandidate * terminalMultiplier[scenario])
          : null,
    ]));
    if (!["low", "base", "high"].every((scenario) => finite(candidate.terminalValueAtHMillionJpy[scenario]))) {
      throw new Error(`${project.projectName}/${actionId(candidate)}: terminal scenario bundle incomplete`);
    }
    const forecast = candidate.monthlyForecast ?? inputs.monthlyForecast;
    candidate.monthlyEconomicCFByScenario = Object.fromEntries(
      ["low", "base", "high"].map((scenario) => [scenario, forecastEconomicCF(forecast, scenario)]),
    );
    const cliffByScenario = Object.fromEntries(["low", "base", "high"].map((scenario) => [
      scenario, noFinancingFirstCliff(inputs, candidate, scenario),
    ]));
    const cliffs = Object.values(cliffByScenario).filter(finite);
    // The liquidity package is a separate joint event: by the first cliff it
    // must cover every dated minimum-cash top-up through the horizon. Existing
    // project gates retain their registered dates and meanings.
    let cashGateKey: string | undefined;
    let liquidityGate: any = null;
    if (cliffs.length) {
      liquidityGate = imputedLiquidityGate(inputs, candidate, Math.min(...cliffs));
      addLiquidityGateProbability(candidate, liquidityGate);
      cashGateKey = liquidityGate.key;
    }
    neutralizeSubsumedFinancialGates(candidate);
    const earliestCliff = cliffs.length ? Math.min(...cliffs) : null;
    const probabilityKeys = Object.keys(probabilityMap(candidate, "base"));
    const existingGates = [...(inputs.gates ?? []), ...(candidate.gates ?? [])];
    candidate.gates = probabilityKeys.map((key) => {
      const existing = [...existingGates].reverse().find((gate: any) => gate.key === key) ?? { key };
      return {
        ...existing,
        key,
        month: key === liquidityGate?.key ? earliestCliff : gateMonth(inputs, candidate, key),
        ...(key === liquidityGate?.key ? {
          evidenceStatus: liquidityGate.evidenceStatus,
          probabilityDerivationRule: liquidityGate.rule,
          sourceRefs: liquidityGate.sourceRefs,
          coverageByScenario: liquidityGate.coverageByScenario,
          signedFailureNetSettlementByScenario: Object.fromEntries(
            ["low", "base", "high"].map((scenario) => [
              scenario,
              Array.isArray(candidate.signedFailureNetSettlementAtGateMillionJpy)
                ? candidate.signedFailureNetSettlementAtGateMillionJpy[0]
                : candidate.failureExitNetSettlementMillionJpy?.[scenario],
            ]),
          ),
          settlementRule: "Reuse the earliest registered failure settlement for an earlier liquidity-continuity failure; do not index the appended gate into the original signed-failure array.",
        } : {}),
      };
    });
    for (const gate of candidate.gates) {
      if (financialCompositeGateKey(gate.key)) {
        const audit = candidate.subsumedCompositeGateAudit?.find((row: any) => row.key === gate.key);
        gate.financialComponentSubsumedBy = LIQUIDITY_GATE_KEY;
        gate.originalCompositeProbabilityForAudit = audit?.originalCompositeProbabilityForAudit;
        gate.effectiveProbabilityInProxyProduct = { low: 1, base: 1, high: 1 };
        gate.includedInProxyProduct = false;
        gate.failureContributionInProxyProduct = 0;
        gate.nonFinancialResidualStatus = "not_separately_estimable_omitted_from_proxy_product";
        gate.probabilityInterpretation = "Composite financial/non-financial probability is audit-only. Its financial component is represented once in the full-horizon liquidity-package proxy; the non-financial residual is not separately identifiable and is omitted rather than invented.";
        const probabilityRow = candidate.namedGateProbabilities?.find((row: any) => row.key === gate.key);
        if (probabilityRow) {
          probabilityRow.financialComponentSubsumedBy = LIQUIDITY_GATE_KEY;
          probabilityRow.probabilityInterpretation = gate.probabilityInterpretation;
        }
      }
    }
    if (cliffs.length && cashGateKey) {
      const gate = candidate.gates.find((row: any) => row.key === cashGateKey);
      gate.month = earliestCliff;
      gate.cashFeasibilityGate = true;
      gate.cashFeasibilityTimingRule = "first_cliff_month_open_before_economic_cf_and_minimum_cash_test";
      gate.fullHorizonCoverageRequired = true;
    }
    candidate.cashCliffControl = {
      noFinancingFirstCliffMonthByScenario: cliffByScenario,
      designatedLiquidityPackageProxyGateKey: cashGateKey,
      designatedGateMonth: cashGateKey
        ? candidate.gates.find((row: any) => row.key === cashGateKey)?.month ?? null
        : null,
      failureStopsFutureEconomicCFAndTerminal: true,
      status: "internal_unvalidated_full_horizon_liquidity_package_proxy",
    };
  }
  inputs.gates = evaluation.gates.map((gate: any) => ({ ...gate }));

  // Canonical 103-slot values must describe the calculation inputs, not a
  // stale pre-canonical builder shape.
  const scenarioCashState = Object.fromEntries(["low", "base", "high"].map((scenario) => [
    scenario,
    {
      openingUnrestrictedCash: scenarioNumber(inputs, "openingUnrestrictedCash", scenario),
      openingRestrictedCash: scenarioNumber(inputs, "openingRestrictedCash", scenario) ?? 0,
      minimumCash: scenarioNumber(inputs, "minimumCash", scenario),
      noFinancingFirstCliffMonth: noFinancingFirstCliff(inputs, evaluation, scenario),
    },
  ]));
  setSlotImputed(ledger.decision_state.cash_state, scenarioCashState, {
    observedStatus: "scenario_bundled_typed_cash_state",
    rule: "Typed cash state used by the no-financing first-passage calculation; financing cash is excluded from the counterfactual cliff.",
    usedInCalculation: true,
  });
  setSlotImputed(ledger.cashflow_ledger.amount_currency, { low: "JPY", base: "JPY", high: "JPY" }, {
    observedStatus: "design_choice",
    rule: "ISO 4217 currency code. Economic CF amounts remain in model_amount_million_jpy.",
    usedInCalculation: false,
  });
  setSlotImputed(ledger.action_bundle.benefit_now, { low: 0, base: 0, high: 0 }, {
    observedStatus: "design_choice_no_immediate_cash_benefit",
    rule: "No immediate cash benefit is registered. Spend-linked benefits are represented once as state/gate transitions, not as positive cash.",
    usedInCalculation: true,
  });
  setSlotImputed(ledger.transition.p_phys, Object.fromEntries(["low", "base", "high"].map((scenario) => [
    scenario,
    Object.entries(probabilityMap(evaluation, scenario)).map(([key, probability]) => ({
      gateKey: key,
      conditionalProbability: probability,
      month: gateMonth(inputs, evaluation, key),
      includedInProxyProduct: evaluation.gates?.find((gate: any) => gate.key === key)?.includedInProxyProduct !== false,
      probabilityStatus: evaluation.gates?.find((gate: any) => gate.key === key)?.includedInProxyProduct === false
        ? "multiplicative_identity_audit_only"
        : "active_proxy_input",
    })),
  ])), {
    observedStatus: "mixed_document_and_imputation_gate_vector",
    rule: "Conditional named-gate probability vector used by the current-control shadow. The product is reported separately in q_G_pi_d_star.",
    usedInCalculation: true,
  });

  const gateRegistryByScenario = Object.fromEntries(["low", "base", "high"].map((scenario) => [
    scenario,
    Object.entries(probabilityMap(evaluation, scenario)).map(([key, probability]) => ({
      gateKey: key,
      transitionId: `${project.projectName}:${selectedId}:${key}`,
      nextStateId: key === LIQUIDITY_GATE_KEY
        ? `${project.projectName}:liquidity_package_feasible`
        : `${project.projectName}:${key}:passed`,
      conditionalProbability: probability,
      month: gateMonth(inputs, evaluation, key),
      informationGain: key === LIQUIDITY_GATE_KEY ? "none" : "registered_gate_outcome",
    })),
  ]));
  setSlotImputed(ledger.transition.transition_id, Object.fromEntries(["low", "base", "high"].map((scenario) => [
    scenario, gateRegistryByScenario[scenario].map((row: any) => row.transitionId),
  ])), {
    observedStatus: "mechanically_derived_canonical_gate_registry",
    rule: "One transition ID per p_phys gate, including the separate liquidity-package proxy gate.",
    usedInCalculation: true,
  });
  setSlotImputed(ledger.transition.next_state_id, Object.fromEntries(["low", "base", "high"].map((scenario) => [
    scenario, gateRegistryByScenario[scenario].map((row: any) => row.nextStateId),
  ])), {
    observedStatus: "mechanically_derived_canonical_gate_registry",
    rule: "One next-state ID per p_phys gate in the same order as transition_id.",
    usedInCalculation: true,
  });
  setSlotImputed(ledger.action_bundle.information_gain, Object.fromEntries(["low", "base", "high"].map((scenario) => [
    scenario, gateRegistryByScenario[scenario].map((row: any) => ({
      gateKey: row.gateKey,
      outcome: row.nextStateId,
      informationGain: row.informationGain,
    })),
  ])), {
    observedStatus: "mechanically_derived_canonical_gate_registry",
    rule: "Canonical gate registry alignment. The liquidity-package proxy changes feasibility but has no separately claimed information gain.",
    usedInCalculation: true,
  });

  const selectedProbabilityKeys = Object.keys(probabilityMap(evaluation, "base"));
  for (const family of asSlack(project).stressFamilies ?? asSlack(project).stressFamily ?? []) {
    const nestedMultipliers = family.gateMultipliers?.low &&
      typeof family.gateMultipliers.low === "object";
    family.gateMultipliers ??= {};
    family.adjustedProbabilities ??= {};
    family.qGateProductProxy = {};
    for (const scenario of ["low", "base", "high"]) {
      if (nestedMultipliers) family.gateMultipliers[scenario] ??= {};
      const multipliers = nestedMultipliers
        ? family.gateMultipliers[scenario]
        : family.gateMultipliers;
      for (const key of selectedProbabilityKeys) {
        const auditOnly = evaluation.gates?.find((gate: any) => gate.key === key)?.includedInProxyProduct === false;
        if (auditOnly) {
          family.originalCompositeGateStressMultiplierForAudit ??= {};
          family.originalCompositeGateStressMultiplierForAudit[scenario] ??= {};
          if (!(key in family.originalCompositeGateStressMultiplierForAudit[scenario])) {
            family.originalCompositeGateStressMultiplierForAudit[scenario][key] = finite(multipliers[key])
              ? multipliers[key]
              : null;
          }
          multipliers[key] = 1;
        } else if (!finite(multipliers[key])) multipliers[key] = 1;
      }
      const selectedProbabilities = probabilityMap(evaluation, scenario);
      family.adjustedProbabilities[scenario] = Object.fromEntries(selectedProbabilityKeys.map((key) => [
        key,
        round6(Number(selectedProbabilities[key]) * Number(multipliers[key])),
      ]));
      family.qGateProductProxy[scenario] = round6(product(
        Object.values(family.adjustedProbabilities[scenario]).map(Number),
      ));
    }
    delete family.q;
  }

  setSlotImputed(ledger.transition.terminal_value, Object.fromEntries(
    ["low", "base", "high"].map((scenario) => [scenario, evaluation.terminalValueAtHMillionJpy[scenario]]),
  ), {
    observedStatus: "scenario_bundled_project_specific_imputation",
    rule: "Selected current-control terminal input. Each scenario calculation reads the matching low/base/high ledger value.",
    usedInCalculation: true,
  });
  const selectedEconomicCFRange = Object.fromEntries(["low", "base", "high"].map((scenario) => [
    scenario, evaluation.monthlyEconomicCFByScenario[scenario],
  ]));
  setSlotImputed(ledger.transition.transition_cf, selectedEconomicCFRange, {
    observedStatus: "mechanically_derived_scenario_bundle",
    rule: "Monthly economic CF by scenario = revenue - opex - capex - nwcDelta + newly received business grant; financing cash excluded.",
    usedInCalculation: true,
  });
  setSlotImputed(ledger.cashflow_ledger.model_amount_million_jpy, selectedEconomicCFRange, {
    observedStatus: "mechanically_derived_scenario_bundle",
    rule: "The selected current-control monthly economic CF ledger, bundled explicitly for low/base/high and excluding financing cash.",
    usedInCalculation: true,
  });

  for (const candidate of evaluations) {
    const actionScenarios = Object.fromEntries(["low", "base", "high"].map((scenario) => {
      const calculation = independentActionScenario(project, candidate, scenario);
      if (!calculation.calculable) {
        throw new Error(`${project.projectName}/${actionId(candidate)}/${scenario}: ${calculation.reason}`);
      }
      return [scenario, calculation];
    }));
    candidate.scenarioCalculations = actionScenarios;
    candidate.qGateProductProxy = Object.fromEntries(["low", "base", "high"].map((scenario) => [
      scenario, actionScenarios[scenario].qGateProductProxy,
    ]));
    candidate.J = Object.fromEntries(["low", "base", "high"].map((scenario) => [
      scenario, actionScenarios[scenario].J,
    ]));
    candidate.monthlyEconomicCF = actionScenarios.base.economicCF;
    candidate.calculation = actionScenarios.base;
    delete candidate.q;
    delete candidate.scenarios;
  }

  const scenarios: Record<string, any> = {};
  const funding: Record<string, any> = {};
  for (const scenario of ["low", "base", "high"]) {
    scenarios[scenario] = independentActionScenario(project, evaluation, scenario);
    funding[scenario] = selectedFundingNeed(project, evaluation, scenario);
    if (!scenarios[scenario].calculable) {
      throw new Error(`${project.projectName}: ${scenario} selected scenario is not independently calculable`);
    }
    if (!funding[scenario].calculable) {
      throw new Error(`${project.projectName}: ${scenario} funding need is not independently calculable`);
    }
  }
  const range = (selector: (row: any, scenario: string) => any) => Object.fromEntries(
    ["low", "base", "high"].map((scenario) => [scenario, selector(scenarios[scenario], scenario)]),
  );
  const fundingRange = (key: string) => Object.fromEntries(
    ["low", "base", "high"].map((scenario) => [scenario, funding[scenario][key]]),
  );
  const derived = ledger.derived_outputs;
  setSlotImputed(derived.J_r, range((row) => row.J));
  if (project.projectName !== "Yellow Duck") {
    setSlotImputed(derived.E_V_net_given_G_a, range((row) => row.conditionalSuccess));
    setSlotImputed(derived.E_V_net_pi_given_G, range((row) => row.conditionalSuccess));
  }
  setSlotImputed(derived.q_plan_pi0_Hv, {
    low: { ...structuralPi0NA }, base: { ...structuralPi0NA }, high: { ...structuralPi0NA },
  }, {
    observedStatus: "structurally_not_computable",
    rule: "Legacy 103-slot key. A complete off-path pi0 is absent, so no q_plan(pi0) number is fabricated. The current-control gate-product proxy is reported separately in q_G_pi_d_star.",
    confidenceDriver: "definition requires a complete registered off-path pi0",
    usedInCalculation: false,
  });
  for (const key of ["V_r_pi0", "Omega_d", "Delta_V_r_given_d"]) {
    setSlotImputed(derived[key], {
      low: { ...structuralPi0NA }, base: { ...structuralPi0NA }, high: { ...structuralPi0NA },
    }, {
      observedStatus: "structurally_not_computable",
      rule: structuralPi0NA.reason,
      confidenceDriver: "definition requires a complete off-path pi0",
      usedInCalculation: false,
    });
  }
  setSlotImputed(derived.pi_d_star, { low: selectedId, base: selectedId, high: selectedId }, {
    observedStatus: historicalTerminal ? "historical_terminal" : "registered_current_control_shadow",
    rule: "Legacy 103-slot key. This is the registered current control used for shadow calculation, not an optimizer-selected or authority-approved policy.",
  });
  setSlotImputed(derived.q_G_pi_d_star, range((row) => row.qGateProductProxy), {
    observedStatus: "mechanically_derived_gate_product_proxy",
    rule: "Legacy 103-slot key. Value is q_gate_product_proxy, the product of registered named-gate probabilities for the current-control shadow; it is not a calibrated propulsion probability.",
  });
  setSlotImputed(derived.V_r_pi_d_star, range((row) => row.J));
  setSlotImputed(derived.expected_cumulative_funding, fundingRange("survivalWeightedMinimumCashTopUpNeed"), {
    observedStatus: "mechanically_derived_low_precision",
    rule: "Legacy slot label. Semantic name is survival_weighted_minimum_cash_top_up_need. For each explicit low/base/high bundle, exclude financing cash, apply monthly economic CF, top up only to minimumCash, weight each top-up by gate survival immediately before the month, and sum.",
    confidenceDriver: "monthly economic CF and opening/minimum cash are low-precision estimates",
  });
  derived.expected_cumulative_funding.semanticAlias = "survival_weighted_minimum_cash_top_up_need";
  derived.expected_cumulative_funding.scenarioBundle = "explicit_low_base_high";
  setSlotImputed(ledger.action_bundle.required_funding, fundingRange("requiredFunding"), {
    observedStatus: "mechanically_derived_low_precision",
    rule: "Same minimum-cash counterfactual draw schedule as expected_cumulative_funding, but sum draws without survival weighting. Financing cash is excluded; this is the cash need of the selected policy, not a pipeline nominal amount.",
    confidenceDriver: "monthly economic CF and opening/minimum cash are low-precision estimates",
  });
  const committedScheduled = (evaluation.monthlyForecast ?? inputs.monthlyForecast ?? [])
    .reduce((sum: number, row: any) => sum + Number(row.committedFundingCash ?? 0), 0);
  setSlotImputed(ledger.action_bundle.committed_funding, {
    low: round6(committedScheduled), base: round6(committedScheduled), high: round6(committedScheduled),
  }, {
    observedStatus: committedScheduled > 0 ? "document_extracted_future_cash" : "mechanically_derived_zero_future_commitment",
    rule: "Sum only dated post-valuation financingEvents classified committed/committed_future on the selected policy. Conditional funding, prior receipts, closed rounds, nominal awards, interest and term sheets are excluded.",
    confidenceDriver: committedScheduled > 0 ? "dated post-valuation cash-event contract" : "no dated post-valuation committed cash event registered",
  });
  const storedScenario = (scenario: string) => evaluation.scenarios?.[scenario] ??
    evaluation.scenarioCalculations?.[scenario] ?? {};
  setSlotImputed(derived.expected_failure_loss, Object.fromEntries(
    ["low", "base", "high"].map((scenario) => [
      scenario,
      valueOr(storedScenario(scenario).failureLoss, Math.max(0, -scenarios[scenario].failureContribution)),
    ]),
  ));
  setSlotImputed(derived.expected_exit_value, range((row) => row.failureContribution));
  result.registeredCurrentControl = selectedId;
  delete result.selectedPolicy;
  result.qGateProductProxyLow = scenarios.low.qGateProductProxy;
  result.qGateProductProxyBase = scenarios.base.qGateProductProxy;
  result.qGateProductProxyHigh = scenarios.high.qGateProductProxy;
  for (const scenario of ["low", "base", "high"]) {
    const stress = stressProxyScenario(project, scenario, evaluation);
    if (!stress.ok || !finite(stress.qStressProxy)) {
      throw new Error(`${project.projectName}/${scenario}: q_stress_proxy is not calculable`);
    }
    result[`qStressProxy${scenarioTitle(scenario)}`] = round6(stress.qStressProxy);
    if (inputs.strategicSlack) {
      inputs.strategicSlack[`qStressProxy${scenarioTitle(scenario)}`] = round6(stress.qStressProxy);
    }
  }
  const canonicalSlack = recursivelyRenamePilotFields(inputs.strategicSlack ?? asSlack(project));
  canonicalSlack.authorityApprovedActionCount = 0;
  canonicalSlack.shadowActionCount = evaluations.length;
  for (const scenario of ["low", "base", "high"]) {
    canonicalSlack[`qStressProxy${scenarioTitle(scenario)}`] = result[`qStressProxy${scenarioTitle(scenario)}`];
  }
  inputs.strategicSlack = canonicalSlack;
  result.strategicSlack = JSON.parse(JSON.stringify(canonicalSlack));
  project.bzm22 ??= {};
  project.bzm22.stressProxyDiagnostics = JSON.parse(JSON.stringify(canonicalSlack));
  const priorSlackRange = ledger.decision_state.slack_state.imputed ?? {};
  const canonicalSlackRange = Object.fromEntries(["low", "base", "high"].map((scenario) => [
    scenario,
    {
      ...Object.fromEntries(Object.entries(
        priorSlackRange[scenario] && typeof priorSlackRange[scenario] === "object"
          ? recursivelyRenamePilotFields(priorSlackRange[scenario])
          : {},
      ).filter(([key]) => !/^(?:qStressProxy(?:Low|Base|High)|possibleFeasibleActionCount|confirmedFeasibleActionCount|confirmedCount|authorityApprovedActionCount|authorityApprovedActions|shadowActionCount|shadowActions)$/.test(key))),
      qStressProxy: result[`qStressProxy${scenarioTitle(scenario)}`],
      authorityApprovedActionCount: 0,
      authorityApprovedActions: 0,
      shadowActionCount: evaluations.length,
      shadowActions: evaluations.length,
    },
  ]));
  setSlotImputed(ledger.decision_state.slack_state, canonicalSlackRange, {
    observedStatus: "typed_vector_shadow_diagnostic",
    rule: "Strategic-slack diagnostics remain a vector. q_stress_proxy is included as an uncalibrated named-stress product proxy; current-control authority is unverified and all actions remain shadow-only.",
    usedInCalculation: true,
  });
  delete result.propulsionProbabilityLow;
  delete result.propulsionProbabilityBase;
  delete result.propulsionProbabilityHigh;
  result.dynamicNetProjectValueMillionJpy = scenarios.base.J;
  result.conditionalSuccessValueMillionJpy = historicalTerminal ? null : scenarios.base.conditionalSuccess;
  if (historicalTerminal) result.conditionalSuccessValueStatus = "not_applicable_historical_terminal";
  result.pathPVmillionJpy = scenarios.base.pathPV;
  result.successContributionMillionJpy = scenarios.base.successContribution;
  result.failureContributionMillionJpy = scenarios.base.failureContribution;
  result.scenarioCalculations = scenarios;
  result.firstPathLossMonth = funding.base.draws[0]?.month ?? null;
  result.actionEvaluations = evaluations;
  result.status = "internal_unvalidated_low_precision_shadow_only";
  result.allocationUse = "prohibited";
  project.provisionalBzm22 = result;
  delete project.provisionalSPS;
  delete project.sps22;
  const canonicalProject = recursivelyRenamePilotFields(project);
  recursivelyDeleteExactKeys(canonicalProject);
  for (const key of Object.keys(project)) delete project[key];
  Object.assign(project, canonicalProject);
}

function stressProxyScenario(project: any, scenario: string, selectedEvaluation: any) {
  const inputs = asInputs(project);
  const slack = asSlack(project);
  const families = slack.stressFamilies ?? slack.stressFamily ?? [];
  const title = scenarioTitle(scenario);
  const selectedProbabilityByKey = selectedEvaluation
    ? probabilityMap(selectedEvaluation, scenario)
    : Object.fromEntries((inputs.gates ?? []).map((gate: any) => [gate.key, gate[`probability${title}`]]));
  const selectedKeys = Object.keys(selectedProbabilityByKey).sort();
  const rows = families.map((family: any) => {
    let probabilityByKey = family.adjustedProbabilities?.[scenario] ?? family.gateProbabilitiesByScenario?.[scenario] ?? null;
    const multipliers = family.gateMultipliers?.[scenario] ?? family.gateMultipliers ?? null;
    const expectedAdjusted = multipliers
      ? Object.fromEntries(Object.entries(selectedProbabilityByKey).map(([key, probability]) => [
          key, Number(probability) * multipliers[key],
        ]))
      : null;
    if (!probabilityByKey && expectedAdjusted) probabilityByKey = expectedAdjusted;
    if (!probabilityByKey) return { key: family.key ?? family.name, ok: false, reason: "probabilities missing" };
    const keys = Object.keys(probabilityByKey).sort();
    const gateSetOk = JSON.stringify(keys) === JSON.stringify(selectedKeys);
    const derivationOk = !expectedAdjusted || (gateSetOk && selectedKeys.every((key) =>
      approx(probabilityByKey[key], expectedAdjusted[key])));
    const gateProductProxy = round6(product(Object.values(probabilityByKey).map(Number)));
    const storedMetric = family.qGateProductProxy ?? family.q;
    const storedGateProductProxy = typeof storedMetric === "object"
      ? storedMetric[scenario]
      : storedMetric;
    const storedMetricOk = storedGateProductProxy === undefined ||
      approx(storedGateProductProxy, gateProductProxy);
    return {
      key: family.key ?? family.name,
      ok: gateSetOk && derivationOk && storedMetricOk,
      gateProductProxy,
    };
  });
  return {
    ok: rows.length > 0 && rows.every((row: any) => row.ok),
    rows,
    qStressProxy: rows.length
      ? Math.min(...rows.map((row: any) => row.gateProductProxy))
      : null,
  };
}

function privacyFailures(text: string) {
  const checks: Record<string, RegExp> = {
    raw_body_key: /"(?:rawBody|raw_body|body|fullText|full_text|transcript)"\s*:/i,
    email_address: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    url_value: /"https?:\/\//i,
    bearer: /bearer\s+[a-z0-9._-]+/i,
    token_secret: /(?:xox[baprs]-|sk-[A-Za-z0-9_-]{12,}|service_role[^\n]{0,40}[=:])/i,
  };
  return Object.entries(checks).filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

function futureFinancingTimingChecks(project: any) {
  const inputs = asInputs(project);
  const valuationDate = String(project.valuationDate ?? inputs?.valuationDate ?? "2026-08-12");
  const valuationMonth = valuationDate.slice(0, 7);
  const openingCashAsOf = inputs?.openingCashAsOf;
  const openingCashStatus = inputs?.openingCashStatus;
  const openingCashIncludedEventIds = inputs?.openingCashIncludedEventIds;
  const openingViolations: string[] = [];
  if (typeof openingCashAsOf !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(openingCashAsOf)) {
    openingViolations.push("openingCashAsOf must be an exact YYYY-MM-DD date");
  } else if (openingCashAsOf > valuationDate) {
    openingViolations.push("openingCashAsOf is after valuationDate");
  }
  if (!/^(observed|imputed|rolled_forward)$/.test(openingCashStatus ?? "")) {
    openingViolations.push("openingCashStatus must be observed, imputed, or rolled_forward");
  }
  if (!Array.isArray(openingCashIncludedEventIds)) {
    openingViolations.push("openingCashIncludedEventIds must be an array");
  }
  const openingEventIds = new Set(Array.isArray(openingCashIncludedEventIds) ? openingCashIncludedEventIds : []);
  const rows: any[] = [];
  const forecasts = [
    { actionId: "baseline", forecast: inputs?.monthlyForecast },
    ...asActionEvaluations(project).map((evaluation: any) => ({
      actionId: actionId(evaluation), forecast: evaluation.monthlyForecast,
    })),
  ];
  for (const { actionId: evaluationId, forecast } of forecasts) {
    const seenEventIds = new Set<string>();
    for (const row of forecast ?? []) {
      const committed = row.committedFundingCash ?? 0;
      const conditional = row.conditionalFundingCash ?? 0;
      if (!committed && !conditional) continue;
      const futureMonth = typeof row.month === "string" && row.month >= valuationMonth;
      const violations: string[] = [];
      if (!futureMonth) violations.push("financing row is before valuation month");
      const events = row.financingEvents;
      if (!Array.isArray(events) || events.length === 0) {
        violations.push("non-zero future financing requires financingEvents[]");
      } else {
        let committedSum = 0;
        let conditionalSum = 0;
        for (const event of events) {
          const eventId = event.cashEventId;
          const eventDate = event.cashEventDate;
          const cashStatus = event.cashStatus;
          const classification = event.classification;
          const amount = event.amountMillionJpy;
          if (typeof eventId !== "string" || !eventId) violations.push("cashEventId missing");
          else {
            if (seenEventIds.has(eventId)) violations.push(`duplicate cashEventId within action forecast: ${eventId}`);
            seenEventIds.add(eventId);
            if (openingEventIds.has(eventId)) violations.push(`cashEventId already included in opening cash: ${eventId}`);
          }
          if (typeof eventDate !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(eventDate)) {
            violations.push(`${eventId ?? "event"}: cashEventDate must be YYYY-MM-DD`);
          } else if (eventDate <= valuationDate) {
            violations.push(`${eventId ?? "event"}: pre-valuation cash event is scheduled as future cash`);
          }
          if (!finite(amount) || amount <= 0) violations.push(`${eventId ?? "event"}: amountMillionJpy must be positive`);
          if (classification === "committed") {
            committedSum += finite(amount) ? amount : 0;
            if (cashStatus !== "committed_future") violations.push(`${eventId ?? "event"}: committed event must have committed_future status`);
          } else if (classification === "conditional") {
            conditionalSum += finite(amount) ? amount : 0;
            if (cashStatus !== "conditional_future") violations.push(`${eventId ?? "event"}: conditional event must have conditional_future status`);
          } else {
            violations.push(`${eventId ?? "event"}: classification must be committed or conditional`);
          }
          if (/^(received|closed_historical|nominal_only|interest_only|term_sheet)$/.test(cashStatus ?? "")) {
            violations.push(`${eventId ?? "event"}: ${cashStatus} must carry zero future cash`);
          }
        }
        if (!approx(committedSum, committed)) violations.push(`committed event sum ${committedSum} != row ${committed}`);
        if (!approx(conditionalSum, conditional)) violations.push(`conditional event sum ${conditionalSum} != row ${conditional}`);
      }
      rows.push({
        actionId: evaluationId,
        month: row.month,
        committedFundingCash: committed,
        conditionalFundingCash: conditional,
        financingEvents: events,
        violations,
      });
    }
  }
  return {
    valuationDate,
    openingCashAsOf,
    openingCashStatus,
    openingCashIncludedEventIds,
    openingUnrestrictedCash: inputs?.openingUnrestrictedCash,
    openingRestrictedCash: inputs?.openingRestrictedCash,
    openingViolations,
    rows,
    ok: openingViolations.length === 0 && rows.every((row) => row.violations.length === 0),
    rule: "cash-event date <= valuation date belongs once in opening cash/roll-forward; only later dated cash may enter the future schedule; nominal award, interest and term sheet carry zero cash",
  };
}

function cashCliffGateChecks(project: any) {
  const inputs = asInputs(project);
  const errors: string[] = [];
  const actions: any[] = [];
  for (const evaluation of asActionEvaluations(project)) {
    const row: any = { actionId: actionId(evaluation), scenarios: {} };
    const control = evaluation.cashCliffControl;
    const key = control?.designatedLiquidityPackageProxyGateKey;
    const matchingGates = (evaluation.gates ?? []).filter((gate: any) => gate.key === key);
    const fundingKeyOk = !key ||
      /fund|financ|cash|capital|liquidity|round|series|grant|award|investment|runway/i.test(key);
    if (!fundingKeyOk) errors.push(`${row.actionId}: non-funding path gate used as cash-feasibility gate`);
    if (key && matchingGates.length !== 1) {
      errors.push(`${row.actionId}: designated funding gate must exist exactly once`);
    }
    if (key === LIQUIDITY_GATE_KEY) {
      const gate = matchingGates[0];
      if (!Array.isArray(gate?.sourceRefs) || gate.sourceRefs.length === 0 ||
          typeof gate?.probabilityDerivationRule !== "string" || !gate.probabilityDerivationRule ||
          !gate?.coverageByScenario || gate?.fullHorizonCoverageRequired !== true) {
        errors.push(`${row.actionId}: imputed liquidity gate requires sourceRefs and derivation rule`);
      }
    }
    for (const scenario of ["low", "base", "high"]) {
      const cliff = noFinancingFirstCliff(inputs, evaluation, scenario);
      const gateMonthValue = matchingGates[0]?.month ?? null;
      const timingOk = cliff === null || (finite(gateMonthValue) && gateMonthValue === cliff);
      const coverage = matchingGates[0]?.coverageByScenario?.[scenario];
      const valuationDate = String(inputs.valuationDate ?? "2026-08-12");
      const expectedDraws = minimumCashDrawSchedule(inputs, evaluation, scenario);
      const committedEvents = (inputs.financingPipeline ?? []).filter((event: any) =>
        /committed/i.test(String(event.classification ?? event.cashStatus ?? "")) &&
        finite(Number(valueOr(event.amountMillionJpy, event.amount))) &&
        Number(valueOr(event.amountMillionJpy, event.amount)) > 0 &&
        finite(pipelineTimingMonthNumber(event.cashEventDate ?? event.timing, valuationDate)) &&
        Number(pipelineTimingMonthNumber(event.cashEventDate ?? event.timing, valuationDate)) >= 1);
      const expectedBinding = bottleneckCoverage(expectedDraws, committedEvents, valuationDate);
      const selectedCandidateEventId = coverage?.selectedConditionalCandidateEventId ?? null;
      const selectedCandidate = selectedCandidateEventId === null ? null :
        (inputs.financingPipeline ?? []).find((event: any) =>
          (event.cashEventId ?? event.stage ?? null) === selectedCandidateEventId);
      const expectedCandidate = bottleneckCoverage(
        expectedDraws,
        selectedCandidate ? [...committedEvents, selectedCandidate] : committedEvents,
        valuationDate,
      );
      const deadlineRowsOk = (actual: any[], expected: any[]) =>
        Array.isArray(actual) && actual.length === expected.length && actual.every((row: any, index: number) =>
          row.monthNumber === expected[index].monthNumber &&
          approx(row.cumulativeRequiredMillionJpy, expected[index].cumulativeRequiredMillionJpy) &&
          approx(row.availableCapacityMillionJpy, expected[index].availableCapacityMillionJpy) &&
          approx(row.coverageRatio, expected[index].coverageRatio));
      const expectedCandidateProbability = selectedCandidate ? Number(selectedCandidate.probability) : 0;
      const expectedCoverageProxy = (1 - expectedCandidateProbability) * expectedBinding.ratio +
        expectedCandidateProbability * expectedCandidate.ratio;
      const coverageOk = cliff === null || (
        JSON.stringify(coverage?.draws) === JSON.stringify(expectedDraws) &&
        expectedDraws.every((draw: any) => finite(draw.monthNumber) && draw.monthNumber >= cliff) &&
        approx(coverage.fullHorizonRequiredMillionJpy,
          expectedDraws.at(-1)?.cumulativeRequiredMillionJpy ?? 0) &&
        approx(coverage.bindingCoverageRatio, expectedBinding.ratio) &&
        approx(coverage.candidateCoverageRatio, expectedCandidate.ratio) &&
        approx(coverage.expectedBottleneckCoverageProxy, expectedCoverageProxy) &&
        deadlineRowsOk(coverage.bindingCapacityByDeadline, expectedBinding.deadlines) &&
        deadlineRowsOk(coverage.candidateCapacityByDeadline, expectedCandidate.deadlines)
      );
      const calculation = independentActionScenario(project, evaluation, scenario);
      const expectedOrder = Object.keys(probabilityMap(evaluation, scenario))
        .map((gateKey, registeredOrder) => ({
          key: gateKey,
          month: gateMonth(inputs, evaluation, gateKey),
          registeredOrder,
        }))
        .sort((left, right) => Number(left.month) - Number(right.month) ||
          left.registeredOrder - right.registeredOrder);
      const chronologyOk = calculation.calculable &&
        JSON.stringify(calculation.chronologicalGateOrder) === JSON.stringify(expectedOrder);
      const pathSurvivalOk = calculation.calculable && Array.isArray(calculation.economicCF) &&
        calculation.economicCF.every((cashflow: any, index: number) => {
        const month = index + 1;
        const expected = round6(product(expectedOrder
          .filter((gate) => Number(gate.month) <= month)
          .map((gate) => Number(probabilityMap(evaluation, scenario)[gate.key]))));
        return approx(cashflow.gateSurvival, expected);
      });
      const terminalStopOk = calculation.calculable &&
        approx(calculation.terminalGateSurvival, calculation.qGateProductProxy) &&
        calculation.failureStopsFutureEconomicCFAndTerminal === true &&
        control?.failureStopsFutureEconomicCFAndTerminal === true;
      const registeredMonthsOk = (evaluation.gates ?? [])
        .filter((gate: any) => gate.key !== LIQUIDITY_GATE_KEY)
        .every((gate: any) => REGISTERED_GATE_MONTHS[project.projectName]?.[gate.key] === undefined ||
          REGISTERED_GATE_MONTHS[project.projectName][gate.key] === gate.month);
      const subsumedGates = (evaluation.gates ?? []).filter((gate: any) => financialCompositeGateKey(gate.key));
      const subsumptionOk = subsumedGates.every((gate: any) =>
        gate.includedInProxyProduct === false &&
        gate.nonFinancialResidualStatus === "not_separately_estimable_omitted_from_proxy_product" &&
        gate.failureContributionInProxyProduct === 0 &&
        ["low", "base", "high"].every((bundle) =>
          approx(probabilityMap(evaluation, bundle)[gate.key], 1) &&
          finite(gate.originalCompositeProbabilityForAudit?.[bundle])) &&
        (asSlack(project).stressFamilies ?? asSlack(project).stressFamily ?? []).every((family: any) =>
          approx(family.adjustedProbabilities?.[scenario]?.[gate.key], 1)));
      const ok = fundingKeyOk && timingOk && coverageOk && registeredMonthsOk && subsumptionOk &&
        chronologyOk && pathSurvivalOk && terminalStopOk;
      if (!ok) {
        errors.push(`${row.actionId}.${scenario}: cash-cliff timing or chronological stop contract failed`);
      }
      row.scenarios[scenario] = {
        noFinancingFirstCliffMonth: cliff,
        designatedLiquidityPackageProxyGateKey: key,
        designatedGateMonth: gateMonthValue,
        timingOk,
        coverageOk,
        subsumptionOk,
        registeredMonthsOk,
        chronologyOk,
        pathSurvivalOk,
        terminalStopOk,
      };
    }
    actions.push(row);
  }
  return {
    ok: errors.length === 0,
    errors,
    actions,
    rule: "Do not move registered project gates. At the first no-financing cliff month, test a separate full-horizon liquidity-package proxy that covers every minimum-cash top-up deadline, then stop same-month and future economic CF and terminal on failure in chronological first-passage order.",
  };
}

function derivedContractChecks(project: any, selectedEvaluation: any) {
  const ledger = asLedger(project);
  const derived = ledger?.derived_outputs;
  const errors: string[] = [];
  const scenarios: Record<string, any> = {};
  const funding: Record<string, any> = {};
  for (const scenario of ["low", "base", "high"]) {
    scenarios[scenario] = independentActionScenario(project, selectedEvaluation, scenario);
    funding[scenario] = selectedFundingNeed(project, selectedEvaluation, scenario);
    if (!scenarios[scenario].calculable) errors.push(`${scenario}: selected policy value not calculable`);
    if (!funding[scenario].calculable) errors.push(`${scenario}: funding need not calculable`);
  }
  const checkScenarioRange = (key: string, expected: (scenario: string) => unknown) => {
    const slot = derived?.[key];
    for (const scenario of ["low", "base", "high"]) {
      if (!approx(slot?.imputed?.[scenario], expected(scenario))) {
        errors.push(`${key}.${scenario}: stored ${JSON.stringify(slot?.imputed?.[scenario])} != ${JSON.stringify(expected(scenario))}`);
      }
    }
  };
  checkScenarioRange("J_r", (scenario) => scenarios[scenario].J);
  checkScenarioRange("q_G_pi_d_star", (scenario) => scenarios[scenario].qGateProductProxy);
  checkScenarioRange("V_r_pi_d_star", (scenario) => scenarios[scenario].J);
  if (project.projectName !== "Yellow Duck") {
    checkScenarioRange("E_V_net_given_G_a", (scenario) => scenarios[scenario].conditionalSuccess);
    checkScenarioRange("E_V_net_pi_given_G", (scenario) => scenarios[scenario].conditionalSuccess);
  } else {
    for (const key of ["E_V_net_given_G_a", "E_V_net_pi_given_G"]) {
      if (derived?.[key]?.observedStatus !== "not_applicable") errors.push(`${key}: Yellow Duck must be not_applicable`);
    }
  }
  const selectedId = selectedPolicy(project);
  for (const scenario of ["low", "base", "high"]) {
    if (derived?.pi_d_star?.imputed?.[scenario] !== selectedId) {
      errors.push(`pi_d_star.${scenario}: does not match selected policy`);
    }
  }
  const q0 = derived?.q_plan_pi0_Hv;
  if (q0?.observedStatus !== "structurally_not_computable" || q0?.usedInCalculation !== false) {
    errors.push("q_plan_pi0_Hv: must be typed structurally_not_computable and unused for every project");
  }
  for (const scenario of ["low", "base", "high"]) {
    const value = q0?.imputed?.[scenario];
    if (value?.status !== "structurally_not_computable" || !/off-path.*pi0/i.test(value?.reason ?? "")) {
      errors.push(`q_plan_pi0_Hv.${scenario}: must carry typed off-path pi0 N/A reason`);
    }
  }
  for (const key of ["V_r_pi0", "Omega_d", "Delta_V_r_given_d"]) {
    const slot = derived?.[key];
    if (slot?.observedStatus !== "structurally_not_computable" || slot?.usedInCalculation !== false) {
      errors.push(`${key}: must be typed structurally_not_computable and unused`);
    }
    for (const scenario of ["low", "base", "high"]) {
      const value = slot?.imputed?.[scenario];
      if (value?.status !== "structurally_not_computable" || !/off-path.*pi0/i.test(value?.reason ?? "")) {
        errors.push(`${key}.${scenario}: must carry typed off-path pi0 N/A reason`);
      }
    }
  }
  const requiredFunding = ledger?.action_bundle?.required_funding;
  const expectedFunding = derived?.expected_cumulative_funding;
  for (const scenario of ["low", "base", "high"]) {
    if (!approx(requiredFunding?.imputed?.[scenario], funding[scenario].requiredFunding)) {
      errors.push(`required_funding.${scenario}: not equal to unweighted counterfactual minimum-cash draws`);
    }
    if (!approx(expectedFunding?.imputed?.[scenario], funding[scenario].survivalWeightedMinimumCashTopUpNeed)) {
      errors.push(`expected_cumulative_funding.${scenario}: not equal to survival-weighted minimum-cash top-up need`);
    }
  }
  if (expectedFunding?.semanticAlias !== "survival_weighted_minimum_cash_top_up_need" ||
      expectedFunding?.scenarioBundle !== "explicit_low_base_high") {
    errors.push("expected_cumulative_funding: legacy label must expose semantic alias and explicit L/B/H bundle");
  }

  const discountSlot = ledger?.version_horizon_rules?.valuation_rule;
  const terminalSlot = ledger?.transition?.terminal_value;
  const forecastSlot = ledger?.transition?.transition_cf;
  for (const scenario of ["low", "base", "high"]) {
    const discountRate = discountSlot?.imputed?.[scenario]?.discountRate;
    const terminalValue = terminalSlot?.imputed?.[scenario];
    const monthlyEconomicCF = forecastSlot?.imputed?.[scenario];
    if (!approx(discountRate, scenarios[scenario]?.scenarioInputs?.discountRate)) {
      errors.push(`scenarioInputs.${scenario}.discountRate: calculation did not use matching ledger bundle`);
    }
    if (!approx(terminalValue, scenarios[scenario]?.scenarioInputs?.terminalValue)) {
      errors.push(`scenarioInputs.${scenario}.terminalValue: calculation did not use matching ledger bundle`);
    }
    if (JSON.stringify(monthlyEconomicCF) !== JSON.stringify(scenarios[scenario]?.scenarioInputs?.monthlyEconomicCF)) {
      errors.push(`scenarioInputs.${scenario}.monthlyEconomicCF: calculation did not use matching ledger bundle`);
    }
    const independentlyDerivedCF = forecastEconomicCF(
      selectedEvaluation?.monthlyForecast ?? asInputs(project)?.monthlyForecast ?? [], scenario,
    );
    if (JSON.stringify(monthlyEconomicCF) !== JSON.stringify(independentlyDerivedCF)) {
      errors.push(`scenarioInputs.${scenario}.monthlyEconomicCF: ledger differs from scenario forecast components`);
    }
  }
  const committedScheduled = (selectedEvaluation?.monthlyForecast ?? asInputs(project)?.monthlyForecast ?? [])
    .reduce((sum: number, row: any) => sum + Number(row.committedFundingCash ?? 0), 0);
  if (!approx(ledger?.action_bundle?.committed_funding?.imputed?.base, committedScheduled)) {
    errors.push("committed_funding.base: does not equal selected future schedule committed cash");
  }
  return {
    ok: errors.length === 0,
    errors,
    formula: {
      requiredFunding: "sum(max(0, minimumCash - counterfactualCashAfterEconomicCF))",
      survivalWeightedMinimumCashTopUpNeed: "sum(draw_t * selectedGateSurvivalImmediatelyBefore_t)",
      financingCashIncludedInCounterfactual: false,
    },
    scenarios: Object.fromEntries(["low", "base", "high"].map((scenario) => [scenario, funding[scenario]])),
  };
}

function slotStatusCounts(project: any) {
  const ledger = asLedger(project);
  const counts: Record<string, number> = {};
  for (const [section, keys] of Object.entries(PARAMETER_SECTIONS)) {
    for (const key of keys) {
      const status = ledger?.[section]?.[key]?.observedStatus ?? "missing_slot";
      counts[status] = (counts[status] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function precisionLossDrivers(project: any) {
  const ledger = asLedger(project);
  const drivers = new Map<string, { slots: number; usedInCalculation: number; parameters: string[] }>();
  for (const [section, keys] of Object.entries(PARAMETER_SECTIONS)) {
    for (const key of keys) {
      const slot = ledger?.[section]?.[key];
      if (!slot || !/missing|estimated|partial|imputed|conditional|hearing/i.test(slot.observedStatus ?? "")) continue;
      const driver = String(slot.confidenceDriver ?? "unspecified uncertainty");
      const row = drivers.get(driver) ?? { slots: 0, usedInCalculation: 0, parameters: [] };
      row.slots += 1;
      if (slot.usedInCalculation) row.usedInCalculation += 1;
      row.parameters.push(`${section}.${key}`);
      drivers.set(driver, row);
    }
  }
  return [...drivers.entries()]
    .map(([driver, row]) => ({ driver, ...row }))
    .sort((a, b) => b.usedInCalculation - a.usedInCalculation || b.slots - a.slots || a.driver.localeCompare(b.driver));
}

function projectSummary(project: any) {
  const inputs = asInputs(project);
  const result = asResult(project);
  const slack = asSlack(project);
  const counts = slotStatusCounts(project);
  const confirmed = valueOr(
    result?.authorityConfirmedExecutableActionCount,
    slack?.authorityConfirmedExecutableActionCount,
    0,
  );
  const possible = valueOr(
    result?.shadowActionCount,
    slack?.shadowActionCount,
    asActionEvaluations(project).length,
  );
  return {
    projectIdAux: project.projectIdAux,
    projectName: project.projectName,
    modelVersion: project.version ?? project.modelVersion ?? "2.2",
    registeredCurrentControl: selectedPolicy(project),
    controlRegistrationStatus: result?.controlRegistrationStatus ??
      inputs?.controlRegistrationStatus ?? inputs?.selectedControl?.controlRegistrationStatus ?? null,
    qGateProductProxy: {
      low: result?.qGateProductProxyLow,
      base: result?.qGateProductProxyBase,
      high: result?.qGateProductProxyHigh,
    },
    qStressProxy: {
      low: valueOr(result?.qStressProxyLow, slack?.qStressProxyLow),
      base: valueOr(result?.qStressProxyBase, slack?.qStressProxyBase),
      high: valueOr(result?.qStressProxyHigh, slack?.qStressProxyHigh),
    },
    JmillionJpy: result?.dynamicNetProjectValueMillionJpy,
    conditionalSuccessValueMillionJpy: result?.conditionalSuccessValueMillionJpy,
    conditionalSuccessValueStatus: result?.conditionalSuccessValueStatus ?? "calculated",
    firstPathLossMonth: valueOr(
      result?.firstPathLossMonth,
      slack?.firstPathLossMonth,
      slack?.firstPathLossMonthConfirmed,
      slack?.confirmedCashPath?.firstPathLossMonth,
    ),
    actionBoundaryCounts: {
      authorityApproved: confirmed,
      shadow: possible,
    },
    parameterStatusCounts: counts,
    precisionLossDrivers: precisionLossDrivers(project),
    totalParameterSlots: Object.values(counts).reduce((sum, count) => sum + count, 0),
    precisionStatus: result?.status ?? "forced_full_imputation_low_precision_not_calibrated",
    allocationUse: result?.allocationUse ?? "prohibited",
  };
}

const UI_SECTION_LABELS: Record<string, string> = {
  version_horizon_rules: "版・地平・評価規則",
  decision_state: "意思決定状態",
  action_bundle: "行動束",
  transition: "状態遷移",
  cashflow_ledger: "キャッシュフロー台帳",
  intervention: "介入",
  derived_outputs: "派生出力",
};

const UI_TIMELINE_CONTROL_LABELS: Record<string, string> = {
  abandon: "撤退・事業終了",
  asset_transfer_scan: "資産移管先の探索",
  continue_large_poc_and_scale: "大型PoC継続・スケール検証",
  current_integrated_policy: "現行統合方針",
  continue_and_resolve_gates: "開発継続・残ゲート解消",
  fundraise_and_partner_parallel: "資金調達・事業提携の並行推進",
  fundraise_and_public_program_parallel: "資金調達・公的制度の並行推進",
  fundraise_and_strategic_partner_parallel: "資金調達・戦略提携の並行推進",
  historical_terminal_maintenance: "歴史的終端の維持管理",
  historical_terminal_closeout: "歴史的終端・整理済み",
  license_or_asset_transfer: "ライセンスまたは資産移管",
  license_or_joint_venture: "ライセンスまたは共同事業",
  partner_or_license_alternative: "提携またはライセンス代替案",
  relaunch: "事業再立上げ",
  staged_capital_light_policy: "段階的・資本軽量方針",
  continue_prototype_and_customer_validation: "試作・顧客検証の継続",
};

const UI_TIMELINE_GATE_LABELS: Record<string, { label: string; category: "technical" | "facility" | "commercial" }> = {
  anchor_customer_or_nonspace_market: { label: "アンカー顧客または非宇宙市場", category: "commercial" },
  channel_and_anchor_customer: { label: "販売チャネル・アンカー顧客", category: "commercial" },
  channel_partner_conversion: { label: "チャネルパートナーの契約転換", category: "commercial" },
  cmc_technical_feasibility: { label: "CMC技術成立性", category: "technical" },
  commercial_contract_and_repeatability: { label: "商用契約・再現性", category: "commercial" },
  company_rights_team_and_funding: { label: "会社・権利・チーム・資金体制", category: "commercial" },
  consortium_and_application: { label: "コンソーシアム組成・申請", category: "commercial" },
  counterparty_binding_offer: { label: "相手方の拘束力ある提案", category: "commercial" },
  current_cash_and_governance_reconciliation: { label: "現預金・統治情報の照合", category: "commercial" },
  drug_substance_remediation: { label: "原薬課題の是正", category: "technical" },
  field_reliability_and_serviceability: { label: "現場信頼性・保守性", category: "technical" },
  field_sensor_reproducibility: { label: "現場センサー再現性", category: "technical" },
  financing_and_public_funding_bridge: { label: "資金調達・公的資金のつなぎ", category: "commercial" },
  followon_financing: { label: "追加資金調達", category: "commercial" },
  full_horizon_liquidity_package_proxy_before_first_cliff: { label: "最初の資金経路喪失前の全期間資金パッケージ", category: "commercial" },
  gap_or_equivalent_funding: { label: "GAP等の資金確保", category: "commercial" },
  growth_financing_and_scale: { label: "成長資金・量産拡大", category: "facility" },
  governance_and_rights_exit_consent: { label: "統治・権利上の整理同意", category: "commercial" },
  historical_terminal_settlement: { label: "歴史的終端の整理", category: "commercial" },
  kawasaki_scale_and_feedstock: { label: "川崎拠点の拡張・原料確保", category: "facility" },
  large_poc_to_contract: { label: "大型PoCから契約への転換", category: "commercial" },
  liquidity_extension: { label: "資金余命の延長", category: "commercial" },
  magnus_deployment_economics: { label: "マグナス風車の導入経済性", category: "commercial" },
  membrane_life_and_cost: { label: "膜寿命・コスト", category: "technical" },
  nonclinical_package: { label: "非臨床パッケージ", category: "technical" },
  nims_rights_and_licensing: { label: "NIMS権利・ライセンス", category: "commercial" },
  orderly_maintenance: { label: "秩序ある維持管理", category: "commercial" },
  paid_academic_or_tea_pilot: { label: "大学・茶園での有償実証", category: "commercial" },
  paid_poc_and_unit_economics: { label: "有償PoC・単位経済性", category: "commercial" },
  pmda_and_clinical_supply: { label: "PMDA対応・治験供給", category: "facility" },
  pipeline_binding_conversion: { label: "案件パイプラインの拘束力ある契約転換", category: "commercial" },
  product_margin_and_repeatability: { label: "製品粗利・再現性", category: "commercial" },
  production_scale_economics: { label: "量産規模の経済性", category: "facility" },
  prototype_performance: { label: "試作品性能", category: "technical" },
  real_effluent_reproducibility: { label: "実排水での再現性", category: "technical" },
  relaunch_or_asset_transfer: { label: "再立上げまたは資産移管", category: "commercial" },
  repeatable_paid_orders: { label: "反復する有償受注", category: "commercial" },
  repeatable_scaled_deployment: { label: "反復可能な大規模導入", category: "facility" },
  repeatable_small_turbine_sales: { label: "小型風車の反復販売", category: "commercial" },
  rights_holder_consent: { label: "権利者の同意", category: "commercial" },
  rights_team_and_incorporation: { label: "権利・チーム・法人化", category: "commercial" },
  rights_team_and_project_vehicle: { label: "権利・チーム・事業主体", category: "commercial" },
  scale_cash_feasibility: { label: "拡大量産時の資金成立性", category: "facility" },
  scale_engineering: { label: "スケールアップ設計", category: "facility" },
  scale_financing: { label: "拡大資金調達", category: "commercial" },
  series_a_or_veco_to_clinic: { label: "シリーズAまたはVECOによる臨床移行", category: "commercial" },
  tyk_bench_uptime_and_recovery: { label: "TYKベンチの稼働率・復旧性", category: "technical" },
  unit_economics_and_reliability: { label: "単位経済性・信頼性", category: "commercial" },
  multi_customer_validation: { label: "複数顧客での検証", category: "commercial" },
};

const UI_TIMELINE_FINANCING_LABELS: Record<string, string> = {
  active: "実施中と記録された外部資金制度",
  adopted: "採択済みと記録された外部制度",
  amed_award_nominal: "AMED採択枠",
  application_first_tranche: "申請採択時の初回資金枠",
  applied: "申請済みと記録された外部資金候補",
  capital_business_alliance_t: "T社との資本業務提携候補",
  closed: "完了済みと記録された資金調達",
  completed: "完了済みと記録された外部制度",
  corporate_codevelopment: "事業会社との共同開発候補",
  corporate_investment_g: "G社の出資候補",
  current_cash_estimate: "評価日時点の現預金推定",
  customer_development_funding: "顧客開発資金候補",
  gap_fund: "GAPファンド候補",
  gogin_jkiss_conditional: "ごうぎんJ-KISS候補",
  high_confidence: "確度が高いと記録された資金候補",
  industrial_consortium: "産業コンソーシアム資金候補",
  j_kiss_bridge: "J-KISSブリッジ候補",
  j_kiss_closed_prevaluation: "評価日前に完了したJ-KISS",
  jfc_loan_completed: "評価日前に実行済みの公庫融資",
  monthly_sbir_bridge_facility: "評価日前の月次SBIRつなぎ融資",
  nedo_dtsu_cap: "NEDO DTSU採択上限",
  production_round: "量産ラウンド候補",
  positive_discussion: "前向き協議中と記録された資金候補",
  prospect: "初期候補と記録された資金調達",
  restricted_award: "使途制限付き研究費",
  sbir_phase3_cap: "SBIRフェーズ3採択上限",
  seed_closed: "評価日前に完了したシード",
  seed_or_partner: "シードまたは事業提携候補",
  series_a_historical: "過去のシリーズA",
  series_a_or_veco: "シリーズAまたはVECO候補",
  space_strategy_fund: "宇宙戦略基金の制度上限",
  strategic_equity_round: "戦略投資ラウンド候補",
  sushi_tech_cap: "Sushi Tech採択上限",
  university_cross_appointment: "大学クロスアポイント費",
  vc_dd: "VCデューデリジェンス中の候補",
  withdrawn: "取下げ済みの外部資金候補",
};

const UI_STRESS_FAMILY_LABELS: Record<string, string> = {
  baseline: "通常想定",
  customer_budget_and_conversion_delay: "顧客予算・契約転換の遅延",
  evidence_failure: "技術・市場根拠の再現失敗",
  funding_delay: "資金到着の遅延",
  funding_delay_and_cost_overrun: "資金遅延・費用超過",
  shared_resource_shock: "共通資源への外部ショック",
  technical_rights_and_reliability_delay: "技術・権利・信頼性の遅延",
};

function requireUiTimelineLabel<T>(map: Record<string, T>, key: unknown, kind: string): T {
  const normalized = String(key ?? "");
  const label = map[normalized];
  if (!label) throw new Error(`${kind} has no reviewed Japanese timeline label: ${normalized || "<empty>"}`);
  return label;
}

function addUtcMonths(dateValue: string, monthCount: number) {
  const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`timeline date must be YYYY-MM-DD: ${dateValue}`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + monthCount, Number(match[3])));
  return date.toISOString().slice(0, 10);
}

function addUtcDays(dateValue: string, dayCount: number) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + dayCount);
  return date.toISOString().slice(0, 10);
}

function timelineTiming(timing: unknown) {
  const text = String(timing ?? "").trim();
  let match = text.match(/^(\d{4})-(\d{2})\.\.(\d{4})-(\d{2})$/);
  if (match) {
    const startDate = `${match[1]}-${match[2]}-01`;
    const lastMonth = `${match[3]}-${match[4]}-01`;
    return { startDate, endDate: addUtcMonths(lastMonth, 1), dateRole: "source_month_range", datePrecision: "month", dateLabel: text };
  }
  match = text.match(/^received (\d{4}-\d{2}-\d{2})$/);
  if (match) return { startDate: match[1], endDate: addUtcDays(match[1], 1), dateRole: "source_observed_day", datePrecision: "day", dateLabel: text };
  match = text.match(/^through (\d{4})-(\d{2})$/);
  if (match) {
    const startDate = `${match[1]}-${match[2]}-01`;
    return { startDate, endDate: addUtcMonths(startDate, 1), dateRole: "source_through_month", datePrecision: "month", dateLabel: text };
  }
  match = text.match(/^(\d{4})Q([1-4])$/);
  if (match) {
    const startDate = `${match[1]}-${String((Number(match[2]) - 1) * 3 + 1).padStart(2, "0")}-01`;
    return { startDate, endDate: addUtcMonths(startDate, 3), dateRole: "source_quarter", datePrecision: "quarter", dateLabel: text };
  }
  match = text.match(/^(\d{4})-(\d{2})(?: imputed)?$/);
  if (match) {
    const startDate = `${match[1]}-${match[2]}-01`;
    return { startDate, endDate: addUtcMonths(startDate, 1), dateRole: text.endsWith(" imputed") ? "imputed_month" : "source_month", datePrecision: "month", dateLabel: text };
  }
  match = text.match(/^(\d{4})$/);
  if (match) return { startDate: `${match[1]}-01-01`, endDate: `${Number(match[1]) + 1}-01-01`, dateRole: "source_year", datePrecision: "year", dateLabel: text };
  return { startDate: null, endDate: null, dateRole: "source_undated", datePrecision: "unknown", dateLabel: text || "日付未登録" };
}

function timelinePrecision(status: unknown) {
  const value = String(status ?? "");
  if (/^observed$|document_extracted/.test(value)) return "observed_or_documented";
  if (/hearing_plus_document|mixed/.test(value)) return "mixed";
  if (/imputed|missing_evidence|prior/.test(value)) return "imputed_or_assumed";
  return "unknown";
}

function buildUiTimeline(project: any, summary: any, valuationDate: string) {
  const inputs = asInputs(project) ?? {};
  const ledger = asLedger(project);
  const selectedControl = String(summary.registeredCurrentControl ?? "");
  const registeredControlLabel = requireUiTimelineLabel(UI_TIMELINE_CONTROL_LABELS, selectedControl, "registered control");
  const horizonMonths = finite(inputs.horizonMonths) ? Number(inputs.horizonMonths) : null;
  if (!horizonMonths || horizonMonths <= 0) throw new Error(`${project.projectName}: timeline horizonMonths missing`);
  const registeredEnd = addUtcMonths(valuationDate, horizonMonths);
  const registeredItem = {
    id: "registered-policy-1",
    kind: "registered_current_control_shadow",
    label: registeredControlLabel,
    category: "registered_policy",
    startDate: valuationDate,
    endDate: registeredEnd,
    dateRole: "registered_evaluation_horizon_band",
    datePrecision: "valuation_day_plus_month_horizon",
    dateLabel: `評価日 ${valuationDate} から評価地平${horizonMonths}か月`,
    status: summary.controlRegistrationStatus === "historical_terminal_classification_not_current_recommendation"
      ? "historical_terminal_not_current_recommendation"
      : "fixed_shadow_not_optimized",
    precision: "registered_shadow",
    authorityStatus: "unconfirmed_not_executable_recommendation",
    choiceRole: "registered_evaluation_policy",
    choiceLabel: `評価に用いた登録方針: ${registeredControlLabel}`,
    sourceRefCount: new Set(ledger?.derived_outputs?.pi_d_star?.sourceRefs ?? []).size,
    description: summary.controlRegistrationStatus === "historical_terminal_classification_not_current_recommendation"
      ? "歴史的終端の分類記録。現在の推奨行動ではない。"
      : "登録済み固定方針。shadow比較のみで、最適化結果でも権限確認済みの実行推奨でもない。",
  };

  const gates = Array.isArray(inputs.gates) ? inputs.gates : [];
  const businessItems = gates
    .filter((gate: any) => gate?.key !== LIQUIDITY_GATE_KEY)
    .map((gate: any, gateIndex: number) => {
      const mapped = requireUiTimelineLabel(UI_TIMELINE_GATE_LABELS, gate.key, "gate");
      if (!finite(gate.month)) throw new Error(`${project.projectName}/${gate.key}: timeline gate month missing`);
      const startDate = addUtcMonths(valuationDate, Number(gate.month));
      return {
        id: `business-event-${gateIndex + 1}`,
        kind: "planned_or_assumed_event",
        label: mapped.label,
        category: mapped.category,
        startDate,
        endDate: addUtcMonths(startDate, 1),
        dateRole: "month_offset_from_valuation",
        datePrecision: "month_offset",
        dateLabel: `評価日から${gate.month}か月後（${startDate.slice(0, 7)}）`,
        status: "registered_path_gate",
        precision: timelinePrecision(gate.evidenceStatus),
        sourceStatus: String(gate.evidenceStatus ?? "unknown"),
        sourceRefCount: new Set(gate.sourceRefs ?? []).size,
        choiceRole: "inherited_registered_policy",
        choiceLabel: `前提にした登録方針: ${registeredControlLabel}`,
        description: "登録済み固定方針に紐づく計画ゲート。表示月は意思決定日ではない。",
      };
    });

  const financingItems = (Array.isArray(inputs.financingPipeline) ? inputs.financingPipeline : [])
    .map((event: any, eventIndex: number) => {
      const label = requireUiTimelineLabel(UI_TIMELINE_FINANCING_LABELS, event.stage, "financing stage");
      const classification = event.classification ?? null;
      const occurred = classification === "prevaluation_closed" || classification === "prevaluation_closed_unknown_amount" || ["closed", "completed"].includes(event.stage);
      const recorded = classification === "nominal_award" || ["restricted_award", "adopted", "active", "withdrawn"].includes(event.stage);
      const imputed = classification === "opening_stock_imputation";
      const conditional = classification === "future_conditional" || ["applied", "high_confidence", "positive_discussion", "prospect"].includes(event.stage);
      const occurrenceRole = occurred ? "occurred" : recorded ? "recorded" : imputed ? "imputed" : conditional ? "conditional" : "unknown";
      const commitmentStatus = occurred
        ? "historically_closed"
        : recorded
          ? "recorded_award_disbursement_unconfirmed"
          : imputed
            ? "imputed_not_reconciled"
            : conditional
              ? "conditional_uncommitted"
              : "commitment_unregistered";
      const availabilityStatus = occurred
        ? "historically_occurred_current_availability_not_inferred"
        : recorded
          ? "recorded_not_available_as_unrestricted_cash"
          : imputed
            ? "imputed_availability_unconfirmed"
            : "not_available_or_unconfirmed";
      return {
        id: `funding-event-${eventIndex + 1}`,
        kind: occurred || recorded ? "confirmed_external_event" : "planned_or_assumed_event",
        label,
        category: "funding_external",
        ...timelineTiming(event.timing),
        status: commitmentStatus,
        precision: timelinePrecision(event.evidence?.status),
        sourceStatus: String(event.evidence?.status ?? "unknown"),
        sourceRefCount: new Set(event.evidence?.sourceRefs ?? []).size,
        occurrenceRole,
        commitmentStatus,
        availabilityStatus,
        amountMillionJpy: finite(event.amount) ? event.amount : null,
        probability: finite(event.probability) ? event.probability : null,
        choiceRole: "not_a_choice",
        choiceLabel: "方針選択ではない（資金・外部事実）",
        description: occurred
          ? "評価日前に発生した外部資金イベント。評価日時点の利用可能額は推定しない。"
          : recorded
            ? "採択・制度枠の記録。入金または自由に使える資金とは扱わない。"
            : imputed
              ? "評価日時点の残高推定。銀行照合済み残高ではない。"
              : "将来または条件付きの外部資金候補。契約済み・入金済みとは扱わない。",
      };
    });

  const liquidityItems = gates
    .filter((gate: any) => gate?.key === LIQUIDITY_GATE_KEY)
    .map((gate: any) => {
      const mapped = requireUiTimelineLabel(UI_TIMELINE_GATE_LABELS, gate.key, "liquidity gate");
      if (!finite(gate.month)) throw new Error(`${project.projectName}/${gate.key}: liquidity timeline month missing`);
      const startDate = addUtcMonths(valuationDate, Number(gate.month));
      return {
        id: "funding-liquidity-proxy-1",
        kind: "planned_or_assumed_event",
        label: mapped.label,
        category: "funding_external",
        startDate,
        endDate: addUtcMonths(startDate, 1),
        dateRole: "month_offset_from_valuation",
        datePrecision: "month_offset",
        dateLabel: `評価日から${gate.month}か月後（${startDate.slice(0, 7)}）`,
        status: "liquidity_proxy_not_commitment",
        precision: timelinePrecision(gate.evidenceStatus),
        sourceStatus: String(gate.evidenceStatus ?? "unknown"),
        sourceRefCount: new Set(gate.sourceRefs ?? []).size,
        occurrenceRole: "conditional",
        commitmentStatus: "proxy_not_commitment",
        availabilityStatus: "not_cash_receipt",
        amountMillionJpy: null,
        probability: null,
        choiceRole: "inherited_registered_policy",
        choiceLabel: `前提にした登録方針: ${registeredControlLabel}`,
        description: "資金パッケージ成立性の計算用ゲート。資金調達の決定、契約、入金ではない。",
      };
    });
  const fundingItems = [...financingItems, ...liquidityItems];
  const dated = [registeredItem, ...businessItems, ...fundingItems]
    .flatMap((item: any) => [item.startDate, item.endDate])
    .filter((date): date is string => typeof date === "string");
  const axisStartDate = dated.slice().sort()[0] ?? valuationDate;
  const axisEndDate = dated.slice().sort().at(-1) ?? registeredEnd;

  return {
    axis: {
      startDate: axisStartDate,
      endDate: axisEndDate,
      valuationDate,
      dateRole: "shared_calendar_axis",
    },
    lanes: [
      { key: "confirmed_decisions", label: "根拠付きの実行済み意思決定", emptyMessage: "根拠付きの実行済み意思決定は未収載", items: [] },
      { key: "registered_policy", label: "登録済み固定方針", emptyMessage: null, items: [registeredItem] },
      { key: "future_decisions", label: "将来の意思決定点", emptyMessage: "根拠付きの将来意思決定点は未収載。計画ゲートを意思決定へ読み替えない。", items: [] },
      { key: "business_events", label: "事業・技術・設備・資金イベント", emptyMessage: businessItems.length || fundingItems.length ? null : "登録済み固定方針に紐づく計画イベントは未収載", items: [...businessItems, ...fundingItems] },
      { key: "external_events", label: "外部イベント", emptyMessage: "現版では独立した外部イベントは未収載", items: [] },
    ],
  };
}

function buildUiSimulation(project: any, summary: any, valuationDate: string) {
  const inputs = asInputs(project) ?? {};
  const actions = Array.isArray(inputs.actions) ? inputs.actions : [];
  const evaluations = asActionEvaluations(project);
  const selectedId = String(summary.registeredCurrentControl ?? "");
  const scenarios = ["low", "base", "high"];
  const policyOptions = actions.map((action: any) => {
    const id = String(action.id ?? "");
    const label = requireUiTimelineLabel(UI_TIMELINE_CONTROL_LABELS, id, "simulation policy");
    const evaluation = evaluations.find((candidate: any) => actionId(candidate) === id);
    const scenarioValues = (selector: (row: any, scenario: string) => unknown) => Object.fromEntries(
      scenarios.map((scenario) => [scenario, jsonValueOrNull(selector(storedActionScenario(evaluation, scenario), scenario))]),
    );
    const j = scenarioValues((row) => row.J);
    const p = project.projectName === "Yellow Duck"
      ? { low: null, base: null, high: null }
      : scenarioValues((row) => row.conditionalSuccess);
    const q = scenarioValues((row) => row.qGateProductProxy);
    const s = Object.fromEntries(scenarios.map((scenario) => {
      const stress = evaluation ? stressProxyScenario(project, scenario, evaluation) : null;
      return [scenario, stress?.ok ? stress.qStressProxy : null];
    }));
    const metricEnvelope = (values: any, unavailableStatus = "not_calculable") => ({
      status: Boolean(evaluation) && [values.low, values.base, values.high].every(finite)
        ? "precomputed"
        : unavailableStatus,
      values: Boolean(evaluation) && [values.low, values.base, values.high].every(finite) ? values : null,
    });
    return {
      id,
      label,
      registrationRole: id === selectedId
        ? (summary.controlRegistrationStatus === "historical_terminal_classification_not_current_recommendation"
          ? "historical_terminal_shadow"
          : "registered_current")
        : "unregistered_shadow_alternative",
      authorityStatus: "unconfirmed",
      sourceRefCount: new Set([...(action.sourceRefs ?? []), ...(evaluation?.sourceRefs ?? [])]).size,
      metrics: {
        J: metricEnvelope(j),
        P: project.projectName === "Yellow Duck"
          ? { status: "not_applicable_historical_terminal", values: null }
          : metricEnvelope(p),
        Q: metricEnvelope(q),
        S: metricEnvelope(s),
      },
    };
  });
  if (!policyOptions.some((option: any) => option.id === selectedId)) {
    throw new Error(`${project.projectName}: registered simulation policy option missing`);
  }
  return {
    mode: "frozen_snapshot_comparison",
    saveMode: "browser_only_not_saved",
    valuationDate,
    currentPolicyId: selectedId,
    policyOptions,
    comparisonOptionIds: policyOptions
      .filter((option: any) => option.id !== selectedId)
      .map((option: any) => option.id),
    engineConnection: {
      policySwitch: "precomputed_only",
      policyDateChange: "not_connected",
      parameterOverride: "not_connected",
      futureDecisionDate: "not_connected",
    },
  };
}

function buildUiCalculationTrace(project: any, summary: any) {
  const inputs = asInputs(project) ?? {};
  const selectedId = String(summary.registeredCurrentControl ?? "");
  const evaluation = asActionEvaluations(project).find((candidate: any) => actionId(candidate) === selectedId);
  if (!evaluation) throw new Error(`${project.projectName}: calculation trace selected policy missing`);
  const scenarios = ["low", "base", "high"];
  const calculations = Object.fromEntries(scenarios.map((scenario) => {
    const calculation: any = independentActionScenario(project, evaluation, scenario);
    if (!calculation.calculable) {
      throw new Error(`${project.projectName}/${selectedId}/${scenario}: calculation trace ${calculation.reason}`);
    }
    return [scenario, calculation];
  }));
  const baseGates = calculations.base.gateTrace ?? [];
  const gates = baseGates.map((baseGate: any) => {
    const id = String(baseGate.key ?? "");
    const mapped = requireUiTimelineLabel(UI_TIMELINE_GATE_LABELS, id, "calculation trace gate");
    const byScenario = Object.fromEntries(scenarios.map((scenario) => {
      const gate = (calculations[scenario].gateTrace ?? []).find((row: any) => row.key === id);
      if (!gate) throw new Error(`${project.projectName}/${selectedId}/${scenario}: trace gate ${id} missing`);
      return [scenario, gate];
    }));
    return {
      id,
      label: mapped.label,
      category: mapped.category,
      month: baseGate.month,
      probabilities: Object.fromEntries(scenarios.map((scenario) => [scenario, byScenario[scenario].probability])),
      cumulativeSurvival: Object.fromEntries(scenarios.map((scenario) => [scenario, byScenario[scenario].cumulativeSurvival])),
      failureBranchWeight: Object.fromEntries(scenarios.map((scenario) => [scenario, byScenario[scenario].failureBranchWeight])),
      signedFailureSettlementMillionJpy: Object.fromEntries(scenarios.map((scenario) => [scenario, byScenario[scenario].signedFailureSettlementMillionJpy])),
    };
  });
  const stressByScenario = Object.fromEntries(scenarios.map((scenario) => [scenario, stressProxyScenario(project, scenario, evaluation)]));
  const stressKeys = stressByScenario.base.rows.map((row: any) => String(row.key ?? ""));
  const stressDefinitions = asSlack(project).stressFamilies ?? asSlack(project).stressFamily ?? [];
  const stressFamilies = stressKeys.map((id: string) => ({
    id,
    label: requireUiTimelineLabel(UI_STRESS_FAMILY_LABELS, id, "stress family"),
    gateProduct: Object.fromEntries(scenarios.map((scenario) => {
      const row = stressByScenario[scenario].rows.find((candidate: any) => candidate.key === id);
      return [scenario, row?.ok ? row.gateProductProxy : null];
    })),
    gateMultipliers: Object.fromEntries(gates.map((gate: any) => [gate.id, Object.fromEntries(scenarios.map((scenario) => {
      const family = stressDefinitions.find((candidate: any) => (candidate.key ?? candidate.name) === id);
      const nested = family?.gateMultipliers?.[scenario] && typeof family.gateMultipliers[scenario] === "object";
      const value = nested ? family.gateMultipliers[scenario]?.[gate.id] : family?.gateMultipliers?.[gate.id];
      return [scenario, finite(value) ? value : 1];
    }))])),
  }));
  const historicalTerminal = summary.controlRegistrationStatus === "historical_terminal_classification_not_current_recommendation";
  const outputs = Object.fromEntries(scenarios.map((scenario) => {
    const row = calculations[scenario];
    const q = row.qGateProductProxy;
    const p = historicalTerminal ? null : row.conditionalSuccess;
    const s = stressByScenario[scenario].ok ? stressByScenario[scenario].qStressProxy : null;
    const output = {
      Q: q,
      S: s,
      fullPathPV: row.fullPathPV,
      pathPV: row.pathPV,
      terminalPV: row.terminalPV,
      successContribution: row.successContribution,
      failureContribution: row.failureContribution,
      P: p,
      J: row.J,
      qTimesP: finite(p) ? round6(q * p) : null,
    };
    if (!approx(output.Q, product(gates.map((gate: any) => gate.probabilities[scenario])))) {
      throw new Error(`${project.projectName}/${scenario}: calculation trace Q mismatch`);
    }
    if (finite(output.P) && !approx(output.P, output.fullPathPV + output.terminalPV)) {
      throw new Error(`${project.projectName}/${scenario}: calculation trace P mismatch`);
    }
    if (!approx(output.J, output.pathPV + output.successContribution + output.failureContribution)) {
      throw new Error(`${project.projectName}/${scenario}: calculation trace J mismatch`);
    }
    return [scenario, output];
  }));
  return {
    policyId: selectedId,
    policyLabel: requireUiTimelineLabel(UI_TIMELINE_CONTROL_LABELS, selectedId, "calculation trace policy"),
    inputs: {
      horizonMonths: inputs.horizonMonths,
      discountRate: Object.fromEntries(scenarios.map((scenario) => [scenario, calculations[scenario].scenarioInputs.discountRate])),
      cashFlow: {
        monthCount: calculations.base.scenarioInputs.monthlyEconomicCF.length,
        totalMillionJpy: Object.fromEntries(scenarios.map((scenario) => [scenario, round6(calculations[scenario].scenarioInputs.monthlyEconomicCF.reduce((sum: number, value: number) => sum + value, 0))])),
        monthlyEconomicCFMillionJpy: Object.fromEntries(scenarios.map((scenario) => [scenario, calculations[scenario].scenarioInputs.monthlyEconomicCF])),
      },
      gates,
      terminalValueMillionJpy: Object.fromEntries(scenarios.map((scenario) => [scenario, calculations[scenario].scenarioInputs.terminalValue])),
      stressFamilies,
    },
    outputs,
    identities: {
      Q: "product_of_gate_probabilities",
      S: "minimum_stress_family_gate_product",
      P: "full_path_pv_plus_terminal_pv",
      J: "path_pv_plus_success_contribution_plus_failure_contribution",
      qTimesPRelation: "comparison_only_not_identity_with_J",
    },
  };
}

const jsonValueOrNull = (value: unknown) => value === undefined ? null : value;

function buildUiProjectProjection(
  project: any,
  summary: any,
  artifactSha256: string,
  rootArtifact: any,
) {
  const ledger = asLedger(project);
  const inputs = asInputs(project) ?? {};
  const projectCutoff = project.cutoff ?? project.informationCutoff ??
    asInputs(project)?.cutoff ?? rootArtifact.informationCutoff;
  let index = 0;
  const groups = Object.entries(PARAMETER_SECTIONS).map(([section, keys]) => ({
    key: section,
    label: UI_SECTION_LABELS[section],
    count: keys.length,
    parameters: keys.map((key) => {
      index += 1;
      const slot = ledger[section][key];
      return {
        index,
        id: `${section}.${key}`,
        section,
        key,
        value: jsonValueOrNull(slot.value),
        observedStatus: slot.observedStatus,
        imputed: {
          low: jsonValueOrNull(slot.imputed?.low),
          base: jsonValueOrNull(slot.imputed?.base),
          high: jsonValueOrNull(slot.imputed?.high),
        },
        unit: slot.unit,
        rule: slot.rule,
        sourceRefs: slot.sourceRefs,
        confidenceDriver: slot.confidenceDriver,
        usedInCalculation: slot.usedInCalculation,
        precisionLossContribution: jsonValueOrNull(slot.precisionLossContribution),
        cutoff: projectCutoff,
      };
    }),
  }));
  if (index !== 103) throw new Error(`${project.projectName}: UI projection expected 103 parameters, got ${index}`);
  const derived = ledger.derived_outputs;
  return {
    schemaVersion: "bzm2.2-pilot-ui/v1",
    artifactSha256,
    projectId: project.projectIdAux,
    projectName: project.projectName,
    modelVersion: summary.modelVersion,
    valuationDate: rootArtifact.valuationDate,
    informationCutoff: rootArtifact.informationCutoff,
    claimBoundary: rootArtifact.claimBoundary,
    sourceCoverage: {
      allComplete: SOURCE_NAMES.every((key) => rootArtifact.sourceInventory?.[key]?.paginationComplete === true),
      sources: SOURCE_NAMES.map((key) => ({
        key,
        paginationComplete: rootArtifact.sourceInventory?.[key]?.paginationComplete === true,
        fetchedItems: rootArtifact.sourceInventory?.[key]?.fetchedItems ?? 0,
        uniqueItems: rootArtifact.sourceInventory?.[key]?.uniqueItems ?? 0,
      })),
    },
    summary: {
      registeredCurrentControl: summary.registeredCurrentControl,
      controlRegistrationStatus: summary.controlRegistrationStatus,
      qGateProductProxy: summary.qGateProductProxy,
      qStressProxy: summary.qStressProxy,
      jValueMillionJpy: derived.J_r.imputed,
      conditionalSuccessValueMillionJpy: derived.E_V_net_given_G_a.imputed,
      conditionalSuccessValueStatus: summary.conditionalSuccessValueStatus,
      firstPathLossMonth: summary.firstPathLossMonth,
      actionBoundaryCounts: summary.actionBoundaryCounts,
      precisionStatus: summary.precisionStatus,
    },
    timeline: buildUiTimeline(project, summary, rootArtifact.valuationDate),
    simulation: buildUiSimulation(project, summary, rootArtifact.valuationDate),
    calculationTrace: buildUiCalculationTrace(project, summary),
    ...(project.projectIdAux === "p20" ? { monthlyFinancePlan: (Array.isArray(inputs.monthlyForecast) ? inputs.monthlyForecast : []).flatMap((row: any) => {
      if (typeof row?.month !== "string") return [];
      return [{
        ym: row.month,
        revenueMillionJpy: Number(row.revenue ?? 0),
        opexMillionJpy: Number(row.opex ?? 0),
        capexMillionJpy: Number(row.capex ?? 0),
        committedFundingMillionJpy: Number(row.committedFundingCash ?? 0),
        conditionalFundingMillionJpy: Number(row.conditionalFundingCash ?? 0),
        grantCashMillionJpy: Number(row.businessGrantCash ?? 0),
        status: typeof row.status === "string" ? row.status : "unknown",
      }];
    }) } : {}),
    groups,
  };
}

const projects = source.projects
  .slice()
  .sort((a: any, b: any) => PROJECT_ORDER.indexOf(a.projectName) - PROJECT_ORDER.indexOf(b.projectName));
if (buildFromMode) {
  for (const project of projects) {
    canonicalizeLedgerUnits(project);
    canonicalizeDerivedContracts(project);
  }
  Object.assign(source.claimBoundary ??= {}, {
    status: "internal_unvalidated_low_precision_shadow_only",
    calibratedPrediction: false,
    causalEffect: false,
    allocationUse: "prohibited",
    crossProjectRankingUse: "prohibited",
    forwardValidationCount: 0,
    currentControlStatus: "registered_current_control_shadow_not_argmax",
    qGateProductProxyStatus: "named_gate_product_proxy_not_calibrated_propulsion_probability",
    qStressProxyStatus: "named_stress_minimum_gate_product_proxy_not_theoretical_q_rob",
  });
  source.dualCriticalAudit = {
    status: "completed_with_p0_fixed_and_p1_open",
    economist: "completed",
    management: "completed",
    p0Fixes: [
      "proxy naming",
      "registered gate dates remain immutable",
      "full-horizon liquidity-package first-passage stop",
      "repeated top-up coverage without financing-value double count",
      "pi0 N/A",
      "scenario ledger sync",
      "canonical 103-slot runtime types",
      "authority and action-copy synchronization",
      "shadow-only",
    ],
    openP1: [
      "uncalibrated gates/evidence dependence",
      "non-separable non-financial residual omitted from composite funding gates",
      "portfolio shared resources missing",
      "spend-state causal effect unvalidated",
      "source body/remote incomplete",
    ],
    publication: "internal_pilot_only",
  };
  // The Slack checkpoint completed all 135 accessible channel histories after
  // the source-contract snapshot was emitted.  Keep thread and DM/MPIM
  // incompleteness separate from channel-history completion.
  const slackInventory = source.sourceInventory?.slack;
  if (slackInventory) {
    const limitations = Array.isArray(slackInventory.limitations)
      ? slackInventory.limitations.filter((item: unknown) => {
        const value = String(item);
        return !value.includes("accessible channels") && !value.includes("4287 discovered parents");
      })
      : [];
    slackInventory.limitations = [
      "All 135 accessible channel histories reached cursor EOF; exhaustive thread-reply enumeration remains incomplete (125/7026 parents complete, 6901 remain).",
      ...limitations,
    ];
    Object.assign(slackInventory.subCompletion ??= {}, {
      accessibleConversationEnumerationComplete: true,
      accessibleConversationCount: 135,
      channelHistoriesComplete: true,
      channelsCompleted: 135,
      channelsTotal: 135,
      threadRepliesComplete: false,
      threadParentsDiscovered: 7026,
      threadParentsCompleted: 125,
      threadParentsRemaining: 6901,
    });
  }
}
const names = projects.map((project: any) => project.projectName);
if (new Set(names).size !== 12 || JSON.stringify(names) !== JSON.stringify(PROJECT_ORDER)) {
  throw new Error(`project names must be unique and exactly match canonical order: ${JSON.stringify(names)}`);
}
for (const project of projects) {
  if (project.projectIdAux !== PROJECT_IDS.get(project.projectName)) {
    throw new Error(`${project.projectName}: expected auxiliary id ${PROJECT_IDS.get(project.projectName)}, got ${project.projectIdAux}`);
  }
}
normalizeIso(source.informationCutoff, "root.informationCutoff");
for (const project of projects) {
  normalizeIso(project.cutoff ?? project.informationCutoff ?? asInputs(project)?.cutoff, `${project.projectName}.cutoff`);
}
const summaries = projects.map(projectSummary);
for (const summary of summaries) {
  if (summary.totalParameterSlots !== 103) {
    throw new Error(`${summary.projectName}: expected 103 slots, got ${summary.totalParameterSlots}`);
  }
}
const requiredClaimBoundary = {
  status: "internal_unvalidated_low_precision_shadow_only",
  calibratedPrediction: false,
  causalEffect: false,
  allocationUse: "prohibited",
  crossProjectRankingUse: "prohibited",
  forwardValidationCount: 0,
  currentControlStatus: "registered_current_control_shadow_not_argmax",
  qGateProductProxyStatus: "named_gate_product_proxy_not_calibrated_propulsion_probability",
  qStressProxyStatus: "named_stress_minimum_gate_product_proxy_not_theoretical_q_rob",
};
for (const [key, value] of Object.entries(requiredClaimBoundary)) {
  if (source.claimBoundary?.[key] !== value) {
    throw new Error(`claimBoundary.${key} must be ${JSON.stringify(value)}`);
  }
}
const requiredDualCriticalAudit = {
  status: "completed_with_p0_fixed_and_p1_open",
  economist: "completed",
  management: "completed",
  p0Fixes: [
    "proxy naming",
    "registered gate dates remain immutable",
    "full-horizon liquidity-package first-passage stop",
    "repeated top-up coverage without financing-value double count",
    "pi0 N/A",
    "scenario ledger sync",
    "canonical 103-slot runtime types",
    "authority and action-copy synchronization",
    "shadow-only",
  ],
  openP1: [
    "uncalibrated gates/evidence dependence",
    "non-separable non-financial residual omitted from composite funding gates",
    "portfolio shared resources missing",
    "spend-state causal effect unvalidated",
    "source body/remote incomplete",
  ],
  publication: "internal_pilot_only",
};
if (JSON.stringify(source.dualCriticalAudit) !== JSON.stringify(requiredDualCriticalAudit)) {
  throw new Error("dualCriticalAudit contract differs from the fixed independent-review boundary");
}
for (const summary of summaries) {
  if (summary.allocationUse !== "prohibited") {
    throw new Error(`${summary.projectName}: allocationUse must be prohibited`);
  }
}
for (const sourceName of SOURCE_NAMES) {
  const row = source.sourceInventory?.[sourceName];
  if (!row) throw new Error(`sourceInventory.${sourceName} missing`);
  for (const field of REQUIRED_INVENTORY_FIELDS) {
    if (!(field in row)) throw new Error(`sourceInventory.${sourceName}.${field} missing`);
  }
  if (!Number.isInteger(row.fetchedItems) || row.fetchedItems < 0 ||
      !Number.isInteger(row.uniqueItems) || row.uniqueItems < 0 || row.uniqueItems > row.fetchedItems) {
    throw new Error(`sourceInventory.${sourceName}: invalid fetched/unique counts`);
  }
  if (typeof row.paginationComplete !== "boolean" || !Array.isArray(row.limitations)) {
    throw new Error(`sourceInventory.${sourceName}: completion and limitations must be explicit`);
  }
  if (!row.paginationComplete && row.limitations.length === 0) {
    throw new Error(`sourceInventory.${sourceName}: incomplete source requires a limitation`);
  }
}

const sourceExtractHashes = Object.fromEntries(
  Object.entries(source.sourceExtractHashes ?? {}).map(([key, value]) => [path.basename(key), value]),
);
const artifact: any = buildFromMode
  ? {
      ...Object.fromEntries(Object.entries(source).filter(([key]) => ![
        "generatedBy", "sourceArtifact", "sourceArtifactSha256", "projectSummary", "auditSummary",
      ].includes(key))),
      generatedBy: "bzm-2-2-all-pj-provisional-v0-1.mts",
      sourceExtractHashes,
      projectSummary: summaries,
      projects,
    }
  : source;
const audit: any = {
  schema: "bzm2.2-all-pj-self-contained-audit/v1",
  valuationDate: source.valuationDate,
  informationCutoff: normalizeIso(source.informationCutoff, "root.informationCutoff"),
  sourceExtractHashes,
  parameterContract: {
    inputs: 90,
    derived: 13,
    total: 103,
    units: Object.fromEntries(PARAMETER_UNITS),
  },
  checksRequired: [
    "canonical 12-project order and 103-slot required-field contract",
    "parameter-specific canonical units",
    "BZM 2.2 state layers are vectors, not scalar scores",
    "q_gate_product_proxy is the product of named gate probabilities and is not a calibrated propulsion probability",
    "q_stress_proxy low/base/high is the minimum product across named stress families and is not BZM 2.2 robust capture q_rob",
    "registered project-gate dates are immutable and a separate full-horizon liquidity-package proxy is evaluated at the first no-financing cash cliff",
    "gate failure stops subsequent economic CF and terminal value in chronological first-passage order while signed-failure arrays retain registered-order indexing",
    "financing cash is excluded from economic CF and J",
    "pre-valuation funding is rolled once into opening cash and never scheduled again",
    "nominal award, investment interest and term sheet carry zero financing cash",
    "required_funding is the unweighted minimum-cash draw sum on a no-financing counterfactual monthly CF path",
    "legacy expected_cumulative_funding means survival_weighted_minimum_cash_top_up_need in an explicit low/base/high bundle",
    "q_plan_pi0_Hv and all other off-path pi0 outputs remain typed N/A for every project because no complete pi0 is registered",
    "terminal, discount rate and monthly economic CF are explicit low/base/high ledger bundles actually used by each scenario calculation",
    "canonical 103-slot runtime types, gate vectors, cash-state vectors, action-evaluation copies and zero-authority shadow boundary match the calculation",
    "legacy possible/confirmed action-id registries and the retired liquidity_continuity_before_cliff key are absent from every project namespace",
    "J identity and independent action-value recomputation",
    "registered current control is an honestly named provisional shadow, not an executable-set argmax or an authority-approved action",
    "abandon is not implicitly executable",
    "privacy guard",
    "cross-project ranking and investment allocation are prohibited; all outputs are internal unvalidated diagnostics",
    "Markdown is the deterministic complete render of the frozen source JSON",
  ],
  privacy: { failures: privacyFailures(JSON.stringify(source)) },
  projects: [],
  ok: true,
};
audit.privacy.ok = audit.privacy.failures.length === 0;
if (!audit.privacy.ok) audit.ok = false;

for (const project of projects) {
  const inputs = asInputs(project);
  const result = asResult(project);
  const ledger = asLedger(project);
  const checks: any[] = [];
  const failures: string[] = [];
  const add = (name: string, ok: boolean, detail: any = {}) => {
    checks.push({ name, ok, ...detail });
    if (!ok) failures.push(name);
  };

  const slotErrors: string[] = [];
  let slotCount = 0;
  for (const [section, keys] of Object.entries(PARAMETER_SECTIONS)) {
    for (const key of keys) {
      slotCount += 1;
      const slot = ledger?.[section]?.[key];
      if (!slot) {
        slotErrors.push(`${section}.${key}:missing`);
        continue;
      }
      for (const field of REQUIRED_SLOT_FIELDS) {
        if (!(field in slot)) slotErrors.push(`${section}.${key}.${field}:missing`);
      }
      if (!slot.imputed || !["low", "base", "high"].every((scenario) => scenario in slot.imputed)) {
        slotErrors.push(`${section}.${key}.imputed:missing`);
      }
      const expectedUnit = PARAMETER_UNITS.get(`${section}.${key}`);
      if (slot.unit !== expectedUnit) slotErrors.push(`${section}.${key}.unit:${slot.unit}!=${expectedUnit}`);
    }
  }
  add("parameterContractAndUnits", slotCount === 103 && slotErrors.length === 0, { slotCount, errors: slotErrors });

  const runtimeTypeErrors: string[] = [];
  for (const scenario of ["low", "base", "high"]) {
    if (ledger.cashflow_ledger.amount_currency.imputed[scenario] !== "JPY") {
      runtimeTypeErrors.push(`amount_currency.${scenario}:not_JPY`);
    }
    if (!finite(ledger.action_bundle.benefit_now.imputed[scenario])) {
      runtimeTypeErrors.push(`benefit_now.${scenario}:not_number`);
    }
    const cashState = ledger.decision_state.cash_state.imputed[scenario];
    if (!cashState || typeof cashState !== "object" ||
        !["openingUnrestrictedCash", "openingRestrictedCash", "minimumCash", "noFinancingFirstCliffMonth"]
          .every((key) => finite(cashState[key]))) {
      runtimeTypeErrors.push(`cash_state.${scenario}:invalid_typed_object`);
    }
    const pVector = ledger.transition.p_phys.imputed[scenario];
    const selected = asActionEvaluations(project).find((row: any) => actionId(row) === selectedPolicy(project));
    const expectedProbabilityMap = selected ? probabilityMap(selected, scenario) : {};
    if (!Array.isArray(pVector) ||
        JSON.stringify(pVector.map((row: any) => row.gateKey).sort()) !==
          JSON.stringify(Object.keys(expectedProbabilityMap).sort()) ||
        pVector.some((row: any) => !approx(row.conditionalProbability, expectedProbabilityMap[row.gateKey]))) {
      runtimeTypeErrors.push(`p_phys.${scenario}:gate_vector_mismatch`);
    }
    const transitionIds = ledger.transition.transition_id.imputed[scenario];
    const nextStateIds = ledger.transition.next_state_id.imputed[scenario];
    const informationGain = ledger.action_bundle.information_gain.imputed[scenario];
    if (!Array.isArray(transitionIds) || !Array.isArray(nextStateIds) || !Array.isArray(informationGain) ||
        transitionIds.length !== pVector?.length || nextStateIds.length !== pVector?.length ||
        informationGain.length !== pVector?.length ||
        informationGain.some((row: any, index: number) => row.gateKey !== pVector[index]?.gateKey) ||
        !informationGain.some((row: any) => row.gateKey === LIQUIDITY_GATE_KEY && row.informationGain === "none")) {
      runtimeTypeErrors.push(`canonical_gate_registry.${scenario}:mismatch`);
    }
    const slackState = ledger.decision_state.slack_state.imputed[scenario];
    const staleSlackKeys = Object.keys(slackState ?? {}).filter((key) =>
      /^(?:qStressProxy(?:Low|Base|High)|possibleFeasibleActionCount|confirmedFeasibleActionCount|confirmedCount)$/.test(key));
    if (staleSlackKeys.length || !approx(slackState?.qStressProxy, result[`qStressProxy${scenarioTitle(scenario)}`])) {
      runtimeTypeErrors.push(`slack_state.${scenario}:stale_or_mismatched`);
    }
  }
  const actionCopiesEqual = JSON.stringify(result.actionEvaluations ?? null) ===
    JSON.stringify(asActionEvaluations(project));
  if (!actionCopiesEqual) runtimeTypeErrors.push("result.actionEvaluations:stale_copy");
  const authorityErrors: string[] = [];
  const inspectAuthority = (value: any, currentPath = "project") => {
    if (Array.isArray(value)) return value.forEach((child, index) => inspectAuthority(child, `${currentPath}.${index}`));
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      const nextPath = `${currentPath}.${key}`;
      if (/^authorityApproved(ActionCount|Actions)$/.test(key) && child !== 0) {
        authorityErrors.push(`${nextPath}:${String(child)}`);
      }
      if (key === "confirmedActionIds") authorityErrors.push(`${nextPath}:forbidden`);
      inspectAuthority(child, nextPath);
    }
  };
  inspectAuthority(project);
  runtimeTypeErrors.push(...authorityErrors);
  const actionCopies = [
    ...(asActionEvaluations(project) ?? []),
    ...(inputs.actions ?? []),
    ...(result.actionEvaluations ?? []),
  ];
  for (const action of actionCopies) {
    if (action.feasibilityClass !== "shadow_only") {
      runtimeTypeErrors.push(`${actionId(action)}:feasibility_not_shadow_only`);
    }
    if (action.optimizationUse !== "shadow_only") {
      runtimeTypeErrors.push(`${actionId(action)}:optimization_not_shadow_only`);
    }
    if (!/^(?:provisional_current_control|historical_terminal_shadow_only|shadow_only)$/.test(String(action.decisionAvailability))) {
      runtimeTypeErrors.push(`${actionId(action)}:availability_not_shadow`);
    }
  }
  add("canonicalRuntimeTypesActionSyncAndShadowAuthority", runtimeTypeErrors.length === 0, {
    errors: runtimeTypeErrors,
    actionCopiesEqual,
  });

  const forbiddenLegacyMetadataPaths = recursivelyFindExactKeyPaths(project);
  add("canonicalLegacyMetadataCleanup", forbiddenLegacyMetadataPaths.length === 0, {
    forbiddenKeys: [...FORBIDDEN_LEGACY_METADATA_KEYS],
    paths: forbiddenLegacyMetadataPaths,
  });

  const state = project.bzm22?.state ?? inputs?.bzm22State;
  const stateErrors: string[] = [];
  for (const key of BZM22_STATE_KEYS) {
    const layer = state?.[key];
    if (!layer || !Array.isArray(layer.features) || !layer.features.length) stateErrors.push(`${key}:feature vector missing`);
    for (const [property, value] of Object.entries(layer ?? {})) {
      if (property !== "features" && typeof value === "number") stateErrors.push(`${key}.${property}:numeric layer scalar`);
    }
  }
  const scalarLeakText = JSON.stringify(project);
  const scalarLeakPatterns = ["posteriorSummary0to1", "score0to100", "strategicSlackScore0to100"];
  const scalarLeaks = scalarLeakPatterns.filter((key) => scalarLeakText.includes(`\"${key}\"`));
  add("stateVectorNoScalarAggregation", stateErrors.length === 0 && scalarLeaks.length === 0, { stateErrors, scalarLeaks });

  const evaluations = asActionEvaluations(project);
  const actionRows: any[] = [];
  for (const evaluation of evaluations) {
    const scenarios: any = {};
    let ok = evaluation.qGateProductProxyModifier === undefined ||
      evaluation.qGateProductProxyModifier === null;
    for (const scenario of ["low", "base", "high"]) {
      const independent: any = independentActionScenario(project, evaluation, scenario);
      const stored: any = storedActionScenario(evaluation, scenario);
      const qExpected = round6(product(Object.values(probabilityMap(evaluation, scenario)).map(Number)));
      const qOk = approx(stored.qGateProductProxy, qExpected) && independent.calculable &&
        approx(independent.qGateProductProxy, qExpected);
      const storedIdentityOk = (scenario === "base" || evaluation.scenarios?.[scenario])
        ? approx(stored.J, stored.pathPV + stored.successContribution + stored.failureContribution)
        : finite(stored.J);
      const JOk = independent.calculable && approx(stored.J, independent.J);
      const storedEconomicCFOk = !Array.isArray(evaluation.monthlyEconomicCF) || (
        evaluation.monthlyEconomicCF.length === independent.economicCF?.length &&
        evaluation.monthlyEconomicCF.every((row: any, index: number) =>
          approx(row.economicCF, independent.economicCF[index].economicCF, 1e-3))
      );
      ok = ok && qOk && storedIdentityOk && JOk && storedEconomicCFOk;
      scenarios[scenario] = {
        qGateProductProxyExpected: qExpected,
        storedQGateProductProxy: stored.qGateProductProxy,
        qGateProductProxyOk: qOk,
        storedJ: stored.J,
        independentJ: independent.J,
        JOk,
      };
    }
    actionRows.push({
      actionId: actionId(evaluation),
      decisionAvailability: evaluation.decisionAvailability,
      feasibilityClass: evaluation.feasibilityClass,
      ok,
      scenarios,
    });
  }
  add("actionGateProductProxiesAndJIdentity", evaluations.length >= 2 && actionRows.every((row) => row.ok), { actionRows });

  const selectedId = selectedPolicy(project);
  const selectedEvaluation = evaluations.find((evaluation: any) => actionId(evaluation) === selectedId);
  const selectedBase: any = selectedEvaluation
    ? independentActionScenario(project, selectedEvaluation, "base")
    : { calculable: false };
  const controlRegistrationStatus = result.controlRegistrationStatus ?? inputs.controlRegistrationStatus ??
    inputs.selectedControl?.controlRegistrationStatus;
  const conditionalNA = project.projectName === "Yellow Duck" &&
    result.conditionalSuccessValueStatus === "not_applicable_historical_terminal" &&
    result.conditionalSuccessValueMillionJpy === null;
  const selectedOutputsOk = selectedBase.calculable &&
    approx(result.qGateProductProxyBase, selectedBase.qGateProductProxy) &&
    approx(result.dynamicNetProjectValueMillionJpy, selectedBase.J) &&
    (conditionalNA || approx(result.conditionalSuccessValueMillionJpy, selectedBase.conditionalSuccess)) &&
    approx(result.pathPVmillionJpy, selectedBase.pathPV) &&
    approx(result.successContributionMillionJpy, selectedBase.successContribution) &&
    approx(result.failureContributionMillionJpy, selectedBase.failureContribution);
  const historicalTerminal = project.projectName === "Yellow Duck";
  const actionBoundaryOk = historicalTerminal
    ? selectedId === "historical_terminal_closeout"
    : Boolean(selectedEvaluation) &&
      selectedEvaluation.decisionAvailability === "provisional_current_control" &&
      selectedEvaluation.feasibilityClass === "shadow_only" &&
      evaluations.filter((candidate: any) => candidate !== selectedEvaluation)
        .every((candidate: any) => candidate.decisionAvailability === "shadow_only" &&
          candidate.feasibilityClass === "shadow_only") &&
      controlRegistrationStatus === "registered_current_control_shadow_not_argmax";
  const availabilitySlot = ledger?.action_bundle?.availability;
  const availabilityShadowOnly = ["low", "base", "high"].every((scenario) =>
    availabilitySlot?.imputed?.[scenario] === "shadow_only");
  add("registeredCurrentControlShadowBoundary", actionBoundaryOk &&
    availabilityShadowOnly && selectedOutputsOk, {
    registeredCurrentControl: selectedId,
    controlRegistrationStatus,
    actionBoundaryOk,
    availabilityShadowOnly,
    selectedOutputsOk,
  });

  const robustRows: any = {};
  let robustOk = true;
  for (const scenario of ["low", "base", "high"]) {
    const row: any = stressProxyScenario(project, scenario, selectedEvaluation);
    const stored = asSlack(project)?.[`qStressProxy${scenarioTitle(scenario)}`] ?? result?.[`qStressProxy${scenarioTitle(scenario)}`];
    const ok = row.ok && approx(stored, row.qStressProxy);
    robustRows[scenario] = { ...row, stored, ok };
    robustOk = robustOk && ok;
  }
  add("qStressProxyNamedStressProducts", robustOk, { scenarios: robustRows });

  const cashCliff = cashCliffGateChecks(project);
  add("cashCliffGateBeforeFailureStop", cashCliff.ok, cashCliff);

  const timing = futureFinancingTimingChecks(project);
  add("financingTimingAndNoLiquidityDoubleCount", timing.ok, timing);

  const derivedContracts = selectedEvaluation
    ? derivedContractChecks(project, selectedEvaluation)
    : { ok: false, errors: ["selected evaluation missing"] };
  add("derivedPi0AndFundingContracts", derivedContracts.ok, derivedContracts);

  const abandon = (inputs.actions ?? []).filter((action: any) => /abandon|withdraw|撤退/i.test(action.id));
  const implicit = abandon.filter((action: any) =>
    action.decisionAvailability === "available" ||
    (action.feasibilityClass === "confirmed" && !/historical|forced|approved/.test(action.executionStatus ?? "")));
  add("noImplicitImmediateAbandon", implicit.length === 0, { abandon: abandon.map((action: any) => action.id), implicit: implicit.map((action: any) => action.id) });

  const projectAudit = { projectIdAux: project.projectIdAux, projectName: project.projectName, ok: failures.length === 0, checks, failures };
  audit.projects.push(projectAudit);
  if (!projectAudit.ok) audit.ok = false;
}

audit.summary = {
  projectCount: audit.projects.length,
  passingProjects: audit.projects.filter((project: any) => project.ok).length,
  failingProjects: audit.projects.filter((project: any) => !project.ok).map((project: any) => ({ projectName: project.projectName, failures: project.failures })),
  privacyOk: audit.privacy.ok,
};
audit.summary.dualCriticalAuditStatus = source.dualCriticalAudit.status;
if (checkMode || writeUiMode) {
  if (JSON.stringify(artifact.projectSummary) !== JSON.stringify(summaries)) {
    throw new Error("frozen JSON projectSummary differs from recomputed summary");
  }
  if (JSON.stringify(artifact.auditSummary) !== JSON.stringify(audit.summary)) {
    throw new Error("frozen JSON auditSummary differs from recomputed audit summary");
  }
} else {
  artifact.auditSummary = audit.summary;
}
const canonicalJson = `${JSON.stringify(artifact, null, 2)}\n`;
const frozenJsonSha256 = sha256(canonicalJson);
const uiProjectFiles = projects.map((project: any) => {
  const summary = summaries.find((candidate: any) => candidate.projectIdAux === project.projectIdAux);
  if (!summary) throw new Error(`${project.projectName}: UI projection summary missing`);
  const projection = buildUiProjectProjection(project, summary, frozenJsonSha256, artifact);
  const canonical = `${JSON.stringify(projection, null, 2)}\n`;
  const bytes = Buffer.byteLength(canonical);
  if (bytes > 512 * 1024) {
    throw new Error(`${project.projectName}: UI projection exceeds 512 KiB (${bytes} bytes)`);
  }
  const privacy = privacyFailures(canonical);
  if (privacy.length) {
    throw new Error(`${project.projectName}: UI projection privacy guard failed: ${privacy.join(", ")}`);
  }
  return {
    projectId: project.projectIdAux,
    projectName: project.projectName,
    file: `${project.projectIdAux}.json`,
    parameterCount: projection.groups.reduce((sum: number, group: any) => sum + group.count, 0),
    bytes,
    sha256: sha256(canonical),
    canonical,
  };
});
const uiManifest = {
  schemaVersion: "bzm2.2-pilot-ui-manifest/v1",
  artifactSha256: frozenJsonSha256,
  projects: uiProjectFiles.map((item: any) => {
    const { canonical, ...row } = item;
    void canonical;
    return row;
  }),
};
const canonicalUiManifest = `${JSON.stringify(uiManifest, null, 2)}\n`;
audit.frozenArtifact = path.basename(jsonOutput);
audit.frozenArtifactSha256 = frozenJsonSha256;
const canonicalAudit = `${JSON.stringify(audit, null, 2)}\n`;
const forbiddenAnchorPatterns = [
  /8\.84\s*%/iu,
  /0\.0884(?!\d)/u,
  /(?:fixed|固定)[ _-]*q[ _-]*(?:anchor|アンカー)/iu,
  /q[ _-]*(?:anchor|アンカー)/iu,
];
const anchorScanText = canonicalJson.replace(/fixed q anchors?[^"\n]*/giu, "guardrail");
const forbiddenAnchorHits = forbiddenAnchorPatterns
  .filter((pattern) => pattern.test(anchorScanText))
  .map((pattern) => pattern.source);
if (forbiddenAnchorHits.length) {
  throw new Error(`forbidden q-anchor pattern(s): ${forbiddenAnchorHits.join(", ")}`);
}

const escapeCell = (value: unknown) => String(value ?? "—")
  .replaceAll("|", "\\|")
  .replaceAll("\r", " ")
  .replaceAll("\n", " ");
const fmtNumber = (value: unknown, digits = 3) => {
  if (value === null || value === undefined) return "—";
  if (typeof value !== "number") return String(value);
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: digits }).format(value);
};
const fmtProbability = (value: unknown) =>
  typeof value === "number" ? `${fmtNumber(value * 100, 2)}%` : "—";

function compactValue(value: unknown, maxLength = 180) {
  if (value === null) return "null";
  if (value === undefined) return "—";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text.length <= maxLength) return text;
  const shape = Array.isArray(value)
    ? `array len=${value.length}`
    : value && typeof value === "object"
      ? `object keys=${Object.keys(value as Record<string, unknown>).length}`
      : `string len=${text.length}`;
  return `[${shape}; sha256=${sha256(text).slice(0, 16)}; preview=${text.slice(0, maxLength - 60)}…]`;
}

function inventoryLimitations(row: any) {
  const limitations = row?.limitations;
  if (!Array.isArray(limitations)) return compactValue(limitations, 220);
  return limitations.map((item) =>
    typeof item === "string" ? item : `${item.name ?? "item"}: ${item.error ?? compactValue(item)}`,
  ).join(" / ");
}

const markdown: string[] = [];
markdown.push("# BZM 2.2 全PJ暫定パラメータ台帳（OS内情報＋強制推定 v0.1）", "");
markdown.push(
  `- 評価日: ${escapeCell(artifact.valuationDate)}`,
  `- 情報カットオフ: ${escapeCell(artifact.informationCutoff)}`,
  `- PJ数: ${projects.length}`,
  `- パラメータ: 1PJあたり入力90＋派生13＝103、全PJ合計${projects.length * 103}スロット`,
  `- 凍結JSON SHA-256: \`${frozenJsonSha256}\``,
  "- 地位: BZM 2.2内部暫定影試算。q_gate_product_proxy（登録gate確率の直積）、q_stress_proxy（登録named stressに対するgate積の最小値）、J（動的正味PJ価値）を別々に示す。現行運用SPS 9軸でも、校正済み推進確率でも、理論上のrobust capture q_robでもない。",
  "- 精度境界: 低精度の強制推定。校正済み予測・因果効果・投資配分値ではない。PJ横断順位と投資配分には使わない。",
  `- 独立二重批判監査: ${escapeCell(artifact.dualCriticalAudit.status)}（P0修正済み、P1未解決、内部pilot限定）`,
  "- Yellow Duckは現行推奨ではなくhistorical terminal分類。成功条件付き価値はN/A。",
  "",
);

markdown.push("## ソース母集団・到達境界", "");
markdown.push("| Source | Enumeration mode | Fetched | Unique | Date range | Pagination complete | Limitations |", "|---|---|---:|---:|---|---|---|");
for (const sourceName of ["gmail", "drive", "calendar", "slack", "notion", "os_db"]) {
  const row = artifact.sourceInventory?.[sourceName] ?? {};
  markdown.push(`| ${escapeCell(sourceName)} | ${escapeCell(row.enumerationMode)} | ${escapeCell(row.fetchedItems)} | ${escapeCell(row.uniqueItems)} | ${escapeCell(`${row.dateMin ?? "—"} – ${row.dateMax ?? "—"}`)} | ${escapeCell(row.paginationComplete)} | ${escapeCell(inventoryLimitations(row))} |`);
}
markdown.push("");

markdown.push("## 全PJ BZM 2.2 暫定試算一覧", "");
  markdown.push("| PJname | q_gate_product_proxy Low / Base / High | q_stress_proxy Low / Base / High | J（百万円） | 成功条件付き価値（百万円） | 最初のpath-loss月 | authority-approved / shadow actions | 登録中の現行control | 地位 |", "|---|---:|---:|---:|---:|---:|---:|---|---|");
for (const summary of summaries) {
  markdown.push(`| ${escapeCell(summary.projectName)} | ${fmtProbability(summary.qGateProductProxy.low)} / ${fmtProbability(summary.qGateProductProxy.base)} / ${fmtProbability(summary.qGateProductProxy.high)} | ${fmtProbability(summary.qStressProxy.low)} / ${fmtProbability(summary.qStressProxy.base)} / ${fmtProbability(summary.qStressProxy.high)} | ${fmtNumber(summary.JmillionJpy)} | ${summary.conditionalSuccessValueStatus === "not_applicable_historical_terminal" ? "N/A" : fmtNumber(summary.conditionalSuccessValueMillionJpy)} | ${escapeCell(summary.firstPathLossMonth)} | ${escapeCell(summary.actionBoundaryCounts.authorityApproved)} / ${escapeCell(summary.actionBoundaryCounts.shadow)} | ${escapeCell(summary.registeredCurrentControl)} | ${escapeCell(summary.controlRegistrationStatus)} |`);
}
markdown.push("");

markdown.push("## 精度低下の主因（計算使用スロット優先）", "");
markdown.push("| PJname | Driver | Uncertain slots | Used in calculation | Main affected parameters |", "|---|---|---:|---:|---|");
for (const summary of summaries) {
  const drivers = summary.precisionLossDrivers.slice(0, 3);
  if (!drivers.length) {
    markdown.push(`| ${escapeCell(summary.projectName)} | — | 0 | 0 | — |`);
    continue;
  }
  for (const [index, driver] of drivers.entries()) {
    markdown.push(`| ${index === 0 ? escapeCell(summary.projectName) : ""} | ${escapeCell(compactValue(driver.driver, 220))} | ${driver.slots} | ${driver.usedInCalculation} | ${escapeCell(compactValue(driver.parameters, 240))} |`);
  }
}
markdown.push("");

markdown.push("## 読み方", "");
markdown.push(
  "- `observedStatus`は観測、文書抽出、ヒアリング、推定、派生、設計選択、欠測を区別する。欠測スロットも欠測のまま表示し、計算に必要なlow/base/highは`imputed`へ明示的に置く。",
  "- `q_gate_product_proxy`は登録中の現行controlに紐づく個別gate確率の直積。固定anchorやterminalからの逆算は使わず、校正済み推進確率とは呼ばない。",
  "- `q_stress_proxy`はnamed stress familyごとに調整後gate確率を直積し、scenario別の最小値を採る低精度pilot指標。実行可能集合、頑健捕捉領域、共有資源制約を閉じていないため、BZM 2.2理論の`q_rob`とは呼ばない。",
  "- `J`はsurvival-weighted economic CF PV、成功寄与、符号付き失敗時settlement寄与の合計。資金調達cashはeconomic CFへ混ぜない。",
  "- `required_funding`は、opening unrestricted cashから開始し、資金調達cashを入れずに月次economic CFだけを反映し、minimumCashを割るたびに必要最小額を補うdrawの非加重合計。pipeline名目額ではない。",
  "- legacy `expected_cumulative_funding`は`survival_weighted_minimum_cash_top_up_need`を意味する。同じdrawを、その月直前までに通過が必要な現行control gateの生存確率で重みづけした合計で、low/base/highを明示する。",
  "- `q_plan_pi0_Hv`を含むpi0派生欄は、完全off-path方針pi0が無いため全PJでtyped N/Aとする。現行controlのgate積は`q_G_pi_d_star`のlegacy欄へproxyとして別表示する。",
  "- 構造値が長いセルは、JSON正本の完全値を失わず、Markdownだけshape・hash・previewへ圧縮する。",
  "",
);

for (const project of projects) {
  const summary = summaries.find((item: any) => item.projectName === project.projectName)!;
  const ledger = asLedger(project);
  markdown.push(`## ${project.projectName} — 103スロット`, "");
  markdown.push(
    `- q_gate_product_proxy（L/B/H）: ${fmtProbability(summary.qGateProductProxy.low)} / ${fmtProbability(summary.qGateProductProxy.base)} / ${fmtProbability(summary.qGateProductProxy.high)}`,
    `- q_stress_proxy（L/B/H）: ${fmtProbability(summary.qStressProxy.low)} / ${fmtProbability(summary.qStressProxy.base)} / ${fmtProbability(summary.qStressProxy.high)}`,
    `- J: ${fmtNumber(summary.JmillionJpy)}百万円`,
    `- 成功条件付き価値: ${summary.conditionalSuccessValueStatus === "not_applicable_historical_terminal" ? "N/A（historical terminal）" : `${fmtNumber(summary.conditionalSuccessValueMillionJpy)}百万円`}`,
    `- 登録中の現行control: ${escapeCell(summary.registeredCurrentControl)}（${escapeCell(summary.controlRegistrationStatus)}）`,
    `- status内訳: ${escapeCell(JSON.stringify(summary.parameterStatusCounts))}`,
    "",
  );
  const projectCutoff = project.cutoff ?? project.informationCutoff ?? asInputs(project)?.cutoff ?? artifact.informationCutoff;
  markdown.push("| # | Section | Parameter | observedStatus | imputed Low | imputed Base | imputed High | Unit | Rule / reason | Source locators | Cutoff | Confidence / precision-loss driver | Used |", "|---:|---|---|---|---|---|---|---|---|---|---|---|---|");
  let index = 0;
  for (const [section, keys] of Object.entries(PARAMETER_SECTIONS)) {
    for (const key of keys) {
      index += 1;
      const slot = ledger[section][key];
      markdown.push(`| ${index} | ${escapeCell(section)} | ${escapeCell(key)} | ${escapeCell(slot.observedStatus)} | ${escapeCell(compactValue(slot.imputed?.low))} | ${escapeCell(compactValue(slot.imputed?.base))} | ${escapeCell(compactValue(slot.imputed?.high))} | ${escapeCell(slot.unit)} | ${escapeCell(compactValue(slot.rule, 260))} | ${escapeCell(compactValue(slot.sourceRefs, 260))} | ${escapeCell(projectCutoff)} | ${escapeCell(compactValue(slot.confidenceDriver, 220))} | ${escapeCell(slot.usedInCalculation)} |`);
    }
  }
  markdown.push("");
}

const canonicalMarkdown = `${markdown.join("\n")}\n`;
if (checkMode) {
  const existingJson = fs.readFileSync(inputPath, "utf8");
  const existingMarkdown = fs.readFileSync(markdownOutput, "utf8");
  const existingAudit = fs.readFileSync(auditOutput, "utf8");
  if (existingJson !== canonicalJson) throw new Error(`${inputPath}: JSON is not canonically formatted`);
  if (existingMarkdown !== canonicalMarkdown) throw new Error(`${markdownOutput}: differs from deterministic render`);
  if (existingAudit !== canonicalAudit) throw new Error(`${auditOutput}: differs from deterministic audit`);
  if (!fs.existsSync(uiProjectionOutputDirectory)) {
    throw new Error(`${uiProjectionOutputDirectory}: generated UI projection directory missing`);
  }
  const expectedUiFiles = new Set(["manifest.json", ...uiProjectFiles.map((row: any) => row.file)]);
  const actualUiFiles = fs.readdirSync(uiProjectionOutputDirectory)
    .filter((fileName) => fileName.endsWith(".json"));
  const unexpectedUiFiles = actualUiFiles.filter((fileName) => !expectedUiFiles.has(fileName));
  const missingUiFiles = [...expectedUiFiles].filter((fileName) => !actualUiFiles.includes(fileName));
  if (unexpectedUiFiles.length || missingUiFiles.length) {
    throw new Error(`UI projection file set differs: unexpected=${unexpectedUiFiles.join(",")}; missing=${missingUiFiles.join(",")}`);
  }
  const existingManifest = fs.readFileSync(path.join(uiProjectionOutputDirectory, "manifest.json"), "utf8");
  if (existingManifest !== canonicalUiManifest) {
    throw new Error("generated UI projection manifest differs from deterministic render");
  }
  for (const row of uiProjectFiles) {
    const existingProjection = fs.readFileSync(path.join(uiProjectionOutputDirectory, row.file), "utf8");
    if (existingProjection !== row.canonical) {
      throw new Error(`${row.file}: generated UI projection differs from deterministic render`);
    }
  }
} else if (writeUiMode) {
  fs.mkdirSync(uiProjectionOutputDirectory, { recursive: true });
  fs.writeFileSync(path.join(uiProjectionOutputDirectory, "manifest.json"), canonicalUiManifest);
  for (const row of uiProjectFiles) {
    fs.writeFileSync(path.join(uiProjectionOutputDirectory, row.file), row.canonical);
  }
} else {
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.mkdirSync(uiProjectionOutputDirectory, { recursive: true });
  fs.writeFileSync(jsonOutput, canonicalJson);
  fs.writeFileSync(markdownOutput, canonicalMarkdown);
  fs.writeFileSync(auditOutput, canonicalAudit);
  fs.writeFileSync(path.join(uiProjectionOutputDirectory, "manifest.json"), canonicalUiManifest);
  for (const row of uiProjectFiles) {
    fs.writeFileSync(path.join(uiProjectionOutputDirectory, row.file), row.canonical);
  }
}
if (!audit.ok) throw new Error(`self-contained audit failed: ${JSON.stringify(audit.summary.failingProjects)}`);
console.log(JSON.stringify({
  mode: checkMode ? "check" : writeUiMode ? "write-ui" : "build-from",
  input: path.basename(inputPath),
  inputSha256: sha256(raw),
  jsonOutput,
  jsonSha256: frozenJsonSha256,
  markdownOutput,
  markdownSha256: sha256(canonicalMarkdown),
  auditOutput,
  auditSha256: sha256(canonicalAudit),
  uiProjectionOutputDirectory,
  uiProjectionManifestSha256: sha256(canonicalUiManifest),
  uiProjectionProjectFiles: uiProjectFiles.map((item: any) => {
    const { canonical, ...row } = item;
    void canonical;
    return row;
  }),
  projects: projects.length,
  slotsPerProject: 103,
  totalSlots: projects.length * 103,
  cutoffIso: normalizeIso(source.informationCutoff, "root.informationCutoff"),
  sourceExtractHashes,
}, null, 2));
