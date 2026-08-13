import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  BZM22_FORMULA_SYMBOLS,
  BZM22_FIXED_POLICY,
  BZM22_TOP_METRICS,
  buildBzm22SharedMonthAxis,
  buildBzm22FormulaTrace,
  calculateBzm22TimingOnlyJ,
  formatMillionJpy,
  locateBzm22TimelineItemMonth,
  type Bzm22PilotProject,
} from "../src/lib/bzm-2-2-pilot-ui.ts";
import {
  BZM22_FORMULA_CATALOG,
  BZM22_PARAMETER_CATALOG,
  BZM22_PARAMETER_FORMULA_REFS,
  BZM22_PARAMETER_RELATION_LABELS,
  BZM22_PARAMETER_RELATIONS,
  BZM22_PARAMETER_THEORY_SYMBOLS,
} from "../src/lib/bzm-2-2-parameter-catalog.ts";

const root = path.resolve(import.meta.dirname, "..");
const artifactPath = path.join(root, "bzm/pilot/bzm-2-2-all-pj-provisional-v0-1.json");
const generatedDirectory = path.join(root, "src/generated/bzm-2-2-pilot");
const manifestPath = path.join(generatedDirectory, "manifest.json");
const apiPath = path.join(root, "src/app/api/project/[projectId]/bzm-2-2-pilot/route.ts");
const loaderPath = path.join(root, "src/lib/bzm-2-2-pilot-ui.server.ts");
const componentPath = path.join(root, "src/components/cockpit/Bzm22ProvisionalObservatory.tsx");
const timeLedgerPath = path.join(root, "src/components/cockpit/Bzm22TimeLedger.tsx");
const scoreDetailPath = path.join(root, "src/components/cockpit/CockpitAmdScoreDetailTab.tsx");
const cockpitSummaryPath = path.join(root, "src/components/cockpit/Bzm22CockpitSummary.tsx");
const cockpitVenturePath = path.join(root, "src/components/cockpit/CockpitVentureStatus.tsx");
const hudVenturePath = path.join(root, "src/components/hud/HudCockpitVentureStatus.tsx");

const sha256 = (value: string | Buffer) =>
  crypto.createHash("sha256").update(value).digest("hex");
const approx = (left: number | null, right: number | null, tolerance = 1e-5) =>
  left === null || right === null ? left === right : Math.abs(left - right) <= tolerance;
const requireText = (filePath: string) => fs.readFileSync(filePath, "utf8");
const requireIncludes = (text: string, snippets: string[], label: string) => {
  const missing = snippets.filter((snippet) => !text.includes(snippet));
  if (missing.length) throw new Error(`${label}: missing ${missing.join(" | ")}`);
};

const artifactRaw = requireText(artifactPath);
const artifactSha256 = sha256(artifactRaw);
const artifact = JSON.parse(artifactRaw) as {
  projectSummary: Array<{ projectIdAux: string; projectName: string }>;
};
const manifest = JSON.parse(requireText(manifestPath)) as {
  schemaVersion: string;
  artifactSha256: string;
  projects: Array<{ projectId: string; projectName: string; file: string }>;
};
if (manifest.schemaVersion !== "bzm2.2-pilot-ui-manifest/v1") {
  throw new Error("BZM 2.2 UI manifest schema mismatch");
}
if (manifest.artifactSha256 !== artifactSha256) {
  throw new Error("BZM 2.2 UI manifest artifact hash mismatch");
}
if (!Array.isArray(manifest.projects) || manifest.projects.length !== 12) {
  throw new Error(`BZM 2.2 UI manifest expected 12 projects, got ${manifest.projects?.length ?? "missing"}`);
}

const expectedSectionCounts: Record<string, number> = {
  version_horizon_rules: 14,
  decision_state: 17,
  action_bundle: 16,
  transition: 9,
  cashflow_ledger: 26,
  intervention: 8,
  derived_outputs: 13,
};
const expectedIdName = new Map(
  artifact.projectSummary.map((row) => [row.projectIdAux, row.projectName] as const),
);

const projectionResults: Array<{ projectId: string; bytes: number }> = [];
let referenceParameterIds: string[] | null = null;
for (const row of manifest.projects) {
  const filePath = path.join(generatedDirectory, row.file);
  const raw = requireText(filePath);
  const projection = JSON.parse(raw) as Bzm22PilotProject;
  const minifiedBytes = Buffer.byteLength(JSON.stringify({ pilot: projection }));
  projectionResults.push({ projectId: row.projectId, bytes: minifiedBytes });
  if (minifiedBytes > 256 * 1024) {
    throw new Error(`${row.projectId}: member-only UI response exceeds 256 KiB (${minifiedBytes})`);
  }
  if (projection.artifactSha256 !== artifactSha256 || projection.projectId !== row.projectId) {
    throw new Error(`${row.projectId}: projection identity/hash mismatch`);
  }
  if (projection.projectName !== expectedIdName.get(row.projectId)) {
    throw new Error(`${row.projectId}: project name mismatch`);
  }
  const groupCounts = Object.fromEntries(projection.groups.map((group) => [group.key, group.parameters.length]));
  if (JSON.stringify(groupCounts) !== JSON.stringify(expectedSectionCounts)) {
    throw new Error(`${row.projectId}: 7-group parameter counts mismatch ${JSON.stringify(groupCounts)}`);
  }
  const parameters = projection.groups.flatMap((group) => group.parameters);
  if (parameters.length !== 103 || new Set(parameters.map((parameter) => parameter.id)).size !== 103) {
    throw new Error(`${row.projectId}: expected 103 unique parameter rows`);
  }
  const parameterIds = parameters.map((parameter) => parameter.id).sort();
  if (referenceParameterIds === null) {
    referenceParameterIds = parameterIds;
  } else if (JSON.stringify(parameterIds) !== JSON.stringify(referenceParameterIds)) {
    throw new Error(`${row.projectId}: parameter IDs differ from the 103-slot catalog contract`);
  }
  for (const parameter of parameters) {
    for (const field of ["observedStatus", "imputed", "unit", "rule", "sourceRefs", "confidenceDriver", "usedInCalculation", "cutoff"]) {
      if (!(field in parameter)) throw new Error(`${row.projectId}/${parameter.id}: ${field} missing`);
    }
    if (!parameter.imputed || !["low", "base", "high"].every((scenario) => scenario in parameter.imputed)) {
      throw new Error(`${row.projectId}/${parameter.id}: L/B/H missing`);
    }
  }
  const expectedLaneKeys = [
    "confirmed_decisions",
    "registered_policy",
    "future_decisions",
    "business_events",
    "external_events",
  ];
  if (
    !projection.timeline
    || projection.timeline.axis.dateRole !== "shared_calendar_axis"
    || JSON.stringify(projection.timeline.lanes.map((lane) => lane.key)) !== JSON.stringify(expectedLaneKeys)
  ) {
    throw new Error(`${row.projectId}: timeline must expose one shared axis and the exact five lanes`);
  }
  const timelineByKey = Object.fromEntries(projection.timeline.lanes.map((lane) => [lane.key, lane]));
  const confirmed = timelineByKey.confirmed_decisions;
  const registered = timelineByKey.registered_policy;
  const future = timelineByKey.future_decisions;
  const business = timelineByKey.business_events;
  const external = timelineByKey.external_events;
  if (
    confirmed.items.length !== 0
    || confirmed.emptyMessage !== "根拠付きの実行済み意思決定は未収載"
    || registered.items.length !== 1
    || future.items.length !== 0
    || external.items.length !== 0
  ) {
    throw new Error(`${row.projectId}: decision/external timeline lanes must not fabricate items`);
  }
  const policy = registered.items[0];
  if (
    policy.kind !== "registered_current_control_shadow"
    || policy.dateRole !== "registered_evaluation_horizon_band"
    || policy.authorityStatus !== "unconfirmed_not_executable_recommendation"
    || (projection.projectId === "p18"
      ? !policy.description.includes("現在の推奨行動ではない")
      : !policy.description.includes("shadow")
        || !policy.description.includes("最適化結果でも権限確認済みの実行推奨でもない"))
  ) {
    throw new Error(`${row.projectId}: registered policy must stay a fixed non-optimized, authority-unconfirmed band`);
  }
  const gateCount = Array.isArray(parameters.find((parameter) => parameter.id === "transition.p_phys")?.value)
    ? (parameters.find((parameter) => parameter.id === "transition.p_phys")?.value as unknown[]).length
    : 0;
  const financingCount = Array.isArray(parameters.find((parameter) => parameter.id === "action_bundle.financing_status")?.value)
    ? (parameters.find((parameter) => parameter.id === "action_bundle.financing_status")?.value as unknown[]).length
    : 0;
  const fundingItemCount = business.items.filter((item) => item.id.startsWith("funding-event-")).length;
  if (
    business.items.filter((item) => item.id.startsWith("business-event-")).length !== Math.max(0, gateCount - (gateCount > 0 ? 1 : 0))
    || business.items.filter((item) => item.id.startsWith("funding-liquidity-proxy-")).length !== (gateCount > 0 ? 1 : 0)
    || (financingCount > 0 && fundingItemCount !== financingCount)
  ) {
    throw new Error(`${row.projectId}: timeline must preserve every registered gate and every ledger-exposed financing event`);
  }
  for (const item of projection.timeline.lanes.flatMap((lane) => lane.items)) {
    if (
      !item.label.trim()
      || item.label.includes("_")
      || !item.dateRole
      || !item.datePrecision
      || !item.status
      || !item.precision
      || !item.choiceLabel
      || !item.choiceRole
      || !Number.isInteger(item.sourceRefCount)
      || item.sourceRefCount < 0
      || item.kind === "confirmed_decision"
      || item.kind === "future_decision_point"
      || (["conditional", "imputed"].includes(item.occurrenceRole ?? "") && item.kind === "confirmed_external_event")
      || (item.occurrenceRole === "occurred" && item.kind !== "confirmed_external_event")
    ) {
      throw new Error(`${row.projectId}/${item.id}: timeline label/type/date/status/source count contract invalid`);
    }
  }
  const timelineText = JSON.stringify(projection.timeline);
  if (
    timelineText.includes("sourceRefs")
    || timelineText.includes("選択中方針")
    || timelineText.includes("選択済み")
  ) {
    throw new Error(`${row.projectId}: timeline leaks raw refs or overstates selection/cash receipt`);
  }
  if (
    !projection.simulation
    || projection.simulation.saveMode !== "browser_only_not_saved"
    || projection.simulation.currentPolicyId !== projection.summary.registeredCurrentControl
    || projection.simulation.policyOptions.length < 1
    || !projection.simulation.policyOptions.some((option) => option.id === projection.simulation.currentPolicyId)
    || projection.simulation.policyOptions.some((option) => option.registrationRole !== "registered_current"
      && option.registrationRole !== "historical_terminal_shadow"
      && option.registrationRole !== "unregistered_shadow_alternative")
  ) {
    throw new Error(`${row.projectId}: browser-only policy comparison contract invalid`);
  }
  for (const option of projection.simulation.policyOptions) {
    for (const metric of Object.values(option.metrics)) {
      if (!["precomputed", "not_calculable", "not_applicable_historical_terminal"].includes(metric.status)) {
        throw new Error(`${row.projectId}/${option.id}: simulation metric status invalid`);
      }
      if (metric.status === "precomputed" && (!metric.values || ![metric.values.low, metric.values.base, metric.values.high].every(Number.isFinite))) {
        throw new Error(`${row.projectId}/${option.id}: precomputed metric values missing`);
      }
    }
  }
  const trace = projection.calculationTrace;
  if (
    !trace
    || trace.policyId !== projection.summary.registeredCurrentControl
    || trace.inputs.gates.length < 1
    || trace.identities.qTimesPRelation !== "comparison_only_not_identity_with_J"
    || trace.inputs.cashFlow.monthlyEconomicCFMillionJpy.base.length !== trace.inputs.horizonMonths
  ) {
    throw new Error(`${row.projectId}: calculation trace input/identity contract invalid`);
  }
  const sharedMonthAxis = buildBzm22SharedMonthAxis(projection.valuationDate, trace.inputs.horizonMonths);
  if (
    sharedMonthAxis.length !== trace.inputs.horizonMonths + 1
    || sharedMonthAxis[0].month !== 0
    || sharedMonthAxis[0].ym !== projection.valuationDate.slice(0, 7)
    || sharedMonthAxis.at(-1)?.month !== trace.inputs.horizonMonths
  ) {
    throw new Error(`${row.projectId}: shared event/P&L month axis contract invalid`);
  }
  for (const gate of trace.inputs.gates) {
    const timelineItem = business.items.find((item) => item.label === gate.label);
    if (!timelineItem || locateBzm22TimelineItemMonth(timelineItem, sharedMonthAxis) !== gate.month) {
      throw new Error(`${row.projectId}/${gate.id}: gate event must align with the same month column as the calculation trace`);
    }
  }
  for (const scenario of ["low", "base", "high"] as const) {
    const output = trace.outputs[scenario];
    const q = trace.inputs.gates.reduce((value, gate) => value * gate.probabilities[scenario], 1);
    const stressProducts = trace.inputs.stressFamilies.map((family) => family.gateProduct[scenario]).filter((value): value is number => value !== null);
    const s = stressProducts.length ? Math.min(...stressProducts) : null;
    if (
      !approx(output.Q, q)
      || !approx(output.S, s)
      || (output.P !== null && !approx(output.P, output.fullPathPV + output.terminalPV))
      || !approx(output.J, output.pathPV + output.successContribution + output.failureContribution)
      || !approx(output.qTimesP, output.P === null ? null : output.Q * output.P)
    ) {
      throw new Error(`${row.projectId}/${scenario}: calculation trace arithmetic identity mismatch`);
    }
    for (const gate of trace.inputs.gates) {
      if (![gate.probabilities[scenario], gate.cumulativeSurvival[scenario], gate.failureBranchWeight[scenario], gate.signedFailureSettlementMillionJpy[scenario]].every(Number.isFinite)) {
        throw new Error(`${row.projectId}/${gate.id}/${scenario}: gate trace numeric input missing`);
      }
    }
  }
  const originalGateMonths = Object.fromEntries(trace.inputs.gates.map((gate) => [gate.id, gate.month]));
  const reproducedTiming = calculateBzm22TimingOnlyJ(trace, originalGateMonths, "base");
  if (reproducedTiming.status !== "calculated" || !approx(reproducedTiming.J, trace.outputs.base.J)) {
    throw new Error(`${row.projectId}: timing-only calculator must reproduce the frozen base J`);
  }
  if (trace.inputs.gates.length > 1) {
    const reversedMonths = { ...originalGateMonths, [trace.inputs.gates[0].id]: trace.inputs.gates.at(-1)!.month + 1 };
    if (calculateBzm22TimingOnlyJ(trace, reversedMonths, "base").status !== "order_invalid") {
      throw new Error(`${row.projectId}: timing-only calculator must reject a gate-order reversal`);
    }
  }
  for (const scenario of ["low", "base", "high"] as const) {
    const formulaTrace = buildBzm22FormulaTrace(trace, scenario);
    const pathPV = formulaTrace.months.reduce((sum, month) => sum + month.discountedWeightedCashFlowMillionJpy, 0);
    const fullPathPV = formulaTrace.months.reduce((sum, month) => sum + month.discountedFullPathCashFlowMillionJpy, 0);
    const failurePV = formulaTrace.gates.reduce((sum, gate) => sum + gate.discountedFailureContributionMillionJpy, 0);
    if (
      formulaTrace.months.length !== formulaTrace.horizonMonths
      || formulaTrace.gates.length !== trace.inputs.gates.length
      || formulaTrace.stresses.length !== trace.inputs.stressFamilies.length
      || !approx(pathPV, trace.outputs[scenario].pathPV)
      || !approx(fullPathPV, trace.outputs[scenario].fullPathPV)
      || !approx(failurePV, trace.outputs[scenario].failureContribution)
      || !approx(formulaTrace.terminal.discountedValueMillionJpy, trace.outputs[scenario].terminalPV)
      || !approx(formulaTrace.terminal.successContributionMillionJpy, trace.outputs[scenario].successContribution)
    ) throw new Error(`${row.projectId}/${scenario}: complete formula symbol trace mismatch`);
  }
  if (/https?:\/\//i.test(raw) || /rawBody|messageBody|emailAddress|accessToken|refreshToken/i.test(raw)) {
    throw new Error(`${row.projectId}: projection contains forbidden raw/URL surface`);
  }
}

if (referenceParameterIds === null) throw new Error("BZM 2.2 parameter IDs unavailable");
const catalogIds = Object.keys(BZM22_PARAMETER_CATALOG).sort();
const relationIds = Object.keys(BZM22_PARAMETER_RELATIONS).sort();
const theorySymbolIds = Object.keys(BZM22_PARAMETER_THEORY_SYMBOLS).sort();
const formulaRefIds = Object.keys(BZM22_PARAMETER_FORMULA_REFS).sort();
const expectedCatalogSha256 = "9ccfd2512bc9ffa3c7fb9a0af5619e901283e9b4206c42c2e24561768ada5dc2";
const expectedFormulaRefsSha256 = "ae6dcfaa995dacebabdcd2d7155c6cfd89118d8be7e857008e90f89edab14a3f";
if (
  catalogIds.length !== 103
  || JSON.stringify(catalogIds) !== JSON.stringify(referenceParameterIds)
  || JSON.stringify(relationIds) !== JSON.stringify(referenceParameterIds)
  || JSON.stringify(theorySymbolIds) !== JSON.stringify(referenceParameterIds)
  || JSON.stringify(formulaRefIds) !== JSON.stringify(referenceParameterIds)
  || sha256(JSON.stringify(BZM22_PARAMETER_CATALOG)) !== expectedCatalogSha256
  || sha256(JSON.stringify(BZM22_PARAMETER_FORMULA_REFS)) !== expectedFormulaRefsSha256
) {
  throw new Error("BZM 2.2 parameter catalog must keep the reviewed exact mapping for all 103 projection IDs");
}
if (BZM22_FORMULA_SYMBOLS.length !== 26 || new Set(BZM22_FORMULA_SYMBOLS.map((symbol) => symbol.key)).size !== 26) {
  throw new Error("BZM 2.2 top formulas must expose the complete 26-symbol manifest");
}
for (const id of referenceParameterIds) {
  const catalog = BZM22_PARAMETER_CATALOG[id as keyof typeof BZM22_PARAMETER_CATALOG];
  const expectedDataName = String.raw`\mathtt{${id.replaceAll("_", String.raw`\_`)}}`;
  if (
    !catalog
    || !catalog.japaneseName.trim()
    || catalog.dataNameTex !== expectedDataName
    || typeof catalog.symbolTex !== "string"
    || catalog.formulaRefs.length === 0
    || catalog.formulaRefs.some((ref) => !(ref in BZM22_FORMULA_CATALOG))
    || !catalog.formulaConnection.trim()
    || !catalog.roleLabel.trim()
    || catalog.relationLabel !== BZM22_PARAMETER_RELATION_LABELS[catalog.relation]
  ) {
    throw new Error(`${id}: Japanese name / LaTeX data name / formula connection / role / relation mapping incomplete`);
  }
}

const protectedEmptyTheorySymbols = [
  "version_horizon_rules.model_id",
  "version_horizon_rules.model_version",
  "version_horizon_rules.valuation_date",
  "version_horizon_rules.information_cutoff",
  "version_horizon_rules.currency",
  "version_horizon_rules.forward_validation_count",
  "version_horizon_rules.initial_state_id",
  "decision_state.state_id",
  "action_bundle.action_id_bundle_id",
  "action_bundle.authority",
  "action_bundle.consents",
  "transition.transition_id",
  "transition.next_state_id",
  "cashflow_ledger.cashflow_event_id",
  "cashflow_ledger.economic_event_group_key",
  "cashflow_ledger.owner",
  "cashflow_ledger.counterparty",
  "cashflow_ledger.amount_currency",
  "cashflow_ledger.conversion_rate_date",
  "cashflow_ledger.conversion_rate_source_ref",
  "cashflow_ledger.conversion_rule_ref",
  "cashflow_ledger.nominal_or_real",
  "cashflow_ledger.price_base_date",
  "cashflow_ledger.tax_treatment",
  "cashflow_ledger.tax_subject_ref",
  "cashflow_ledger.source_ref",
  "cashflow_ledger.information_cutoff",
  "cashflow_ledger.included_in",
  "cashflow_ledger.perspective_attribution",
  "cashflow_ledger.public_aggregation_input_hash",
  "intervention.intervention_id",
] as const;
for (const id of protectedEmptyTheorySymbols) {
  if (BZM22_PARAMETER_CATALOG[id].symbolTex !== "") {
    throw new Error(`${id}: management/provenance field must not invent a theory symbol`);
  }
}

if (
  BZM22_PARAMETER_CATALOG["decision_state.slack_state"].symbolTex !== ""
  || BZM22_PARAMETER_CATALOG["decision_state.slack_state"].japaneseName === "S"
  || BZM22_PARAMETER_CATALOG["transition.p_phys"].symbolTex !== String.raw`p_i(a)`
  || !BZM22_PARAMETER_CATALOG["transition.p_phys"].formulaConnection.includes("完全な物理遷移核P⁰ではない")
  || BZM22_PARAMETER_CATALOG["action_bundle.C_now"].relation !== "unused"
  || BZM22_PARAMETER_CATALOG["action_bundle.benefit_now"].relation !== "unused"
  || BZM22_PARAMETER_CATALOG["transition.failure_loss"].relation !== "unused"
  || BZM22_PARAMETER_CATALOG["transition.failure_loss"].symbolTex !== ""
  || BZM22_PARAMETER_CATALOG["derived_outputs.pi_d_star"].symbolTex !== String.raw`\pi_{\mathrm{reg}}=a`
  || BZM22_PARAMETER_CATALOG["derived_outputs.q_G_pi_d_star"].symbolTex !== String.raw`Q(a)=\prod_{i\in G}p_i(a)`
) {
  throw new Error("BZM 2.2 protected economic/management mappings drifted");
}

const aliasPairs = [
  ["transition.transition_cf", "cashflow_ledger.model_amount_million_jpy"],
  ["derived_outputs.V_r_pi_d_star", "derived_outputs.J_r"],
  ["derived_outputs.E_V_net_pi_given_G", "derived_outputs.E_V_net_given_G_a"],
  ["derived_outputs.expected_exit_value", "derived_outputs.expected_failure_loss"],
] as const;
for (const [aliasId, canonicalId] of aliasPairs) {
  if (
    BZM22_PARAMETER_CATALOG[aliasId].relation !== "alias"
    || BZM22_PARAMETER_CATALOG[canonicalId].relation === "alias"
  ) {
    throw new Error(`${aliasId}: must remain an alias of ${canonicalId}`);
  }
}

const apiSource = requireText(apiPath);
requireIncludes(apiSource, [
  "requireMember()",
  'export const dynamic = "force-dynamic"',
  'export const runtime = "nodejs"',
  '"Cache-Control": "private, no-store, max-age=0"',
  'view === "summary"',
], "BZM 2.2 member API");

const loaderSource = requireText(loaderPath);
requireIncludes(loaderSource, [
  'import "server-only"',
  "PILOT_LOADERS",
  "parameter",
], "BZM 2.2 server-only loader");

const componentSource = requireText(componentPath);
requireIncludes(componentSource, [
  ">BZM 2.2<",
  "103項目の監査台帳",
  "103項目",
  "慎重な仮定",
  "基準の仮定",
  "強気の仮定",
  'data-testid="bzm22-provisional-primary"',
  'symbol="J"',
  'symbol="P"',
  'symbol="Q"',
  'symbol="S"',
  "<Tex tex={formula}",
  "ParameterMobileCards",
  "ParameterDesktopTable",
  "ParameterIdentity",
  "FormulaIndex",
  "接続式一覧 F0–F14",
  "catalog.symbolTex ?",
  "catalog.formulaConnection",
  "catalog.formulaRefs.map",
  "FormulaRelation",
  "Bzm22TimeLedger",
  "評価日固定の方針比較",
  "元の前提に戻す",
  "この項目を表す記号",
  "計算を再現・監査するための管理情報",
  "3つの前提ケース",
  "参照先はOS未接続",
  "PJ資料室",
  "Gmailで開く",
  "formatUnitValue",
  "formatUnitLabel",
  "式と入力のつながり",
  "各項の直下に、このPJで代入した数値を表示",
  'data-testid="bzm22-formula-substitution-board"',
  "AnnotatedFormula",
  "FormulaTerm",
  "の数式と代入値",
  "式に出てくる全記号",
  "条件ごとの実数を開く",
  "逆風ごとの補正値を開く",
  "60か月すべての CFₜ・dₜ・Wₜ を開く",
  "Q × P はJではない",
  "停止寄与PV",
  "逆風ごとの補正値",
  "実行可能性と経営判断",
  "条件判定月を試す",
  "時期変更後 J",
], "BZM 2.2 observatory UI");

const timeLedgerSource = requireText(timeLedgerPath);
requireIncludes(timeLedgerSource, [
  'data-testid="bzm22-time-ledger"',
  'data-testid="bzm22-shared-month-scroll"',
  "buildBzm22SharedMonthAxis",
  "イベントと月次試算",
  "事業価値の時間軸",
  "月次試算表",
  "単位：百万円",
  "C/F・資金繰り",
  "設備投資",
  "株式調達",
  "融資実行",
  "助成金等入金（計画）",
  "月次純C/F",
  "月末資金残高（簡易）",
  "BZM経済CF",
  "上のイベントと下のP/L・C/Fは、同じ月の列で揃っている。",
  "fetchPlMonthly",
  "upsertPlMonthly",
  "deletePlMonthly",
  "CockpitPlHearingModal",
  "gateMonths",
  "[--bzm-ledger-label-width:132px]",
  "sm:[--bzm-ledger-label-width:220px]",
], "BZM 2.2 shared event/monthly ledger");
if (timeLedgerSource.includes('`${value < 0 ? "-" : ""}¥${rounded.toLocaleString("ja-JP")}M`')) {
  throw new Error("BZM 2.2 monthly ledger must put the million-yen unit outside data cells");
}
for (const forbidden of [
  "BZM 2.2 暫定主表示",
  "未検証・低精度",
  "影の比較のみ",
  "現在値",
  "L / B / H",
  "L/B/H 全値",
  "{pilot.modelVersion}",
  "精度低下:",
]) {
  if (componentSource.includes(forbidden)) throw new Error(`BZM 2.2 UI still exposes legacy wording: ${forbidden}`);
}
if (componentSource.includes("parameter.usedInCalculation")) {
  throw new Error("BZM 2.2 UI must use six-way formula relation, not usedInCalculation boolean");
}
if (componentSource.includes("`${symbol}(a)`")) {
  throw new Error("BZM 2.2 primary metric heading must stay exactly J/P/Q/S");
}
if (
  BZM22_TOP_METRICS.J.title !== "全分岐込み現在価値"
  || BZM22_TOP_METRICS.P.title !== "全条件通過時の現在価値"
  || BZM22_TOP_METRICS.Q.title !== "基準到達指数"
  || BZM22_TOP_METRICS.S.title !== "逆風耐久指数"
  || BZM22_FIXED_POLICY.formula !== String.raw`a\equiv\pi_{\mathrm{reg}}`
  || !BZM22_TOP_METRICS.J.formula.includes(String.raw`d_{t_i}W_{t_i^-}`)
  || BZM22_TOP_METRICS.J.formula.includes(String.raw`s_t(a)`)
  || BZM22_TOP_METRICS.J.formula.includes(String.raw`d_i`)
  || !BZM22_TOP_METRICS.P.formula.includes(String.raw`\sum_{t=1}^{H}d_tCF_t(a)+d_HTV(a)`)
  || BZM22_TOP_METRICS.Q.description.includes("gate積proxy")
  || BZM22_TOP_METRICS.S.description.includes("gate積proxy")
) {
  throw new Error("BZM 2.2 top metric symbol/formula contract mismatch");
}
if (componentSource.includes("百万円")) {
  throw new Error("BZM 2.2 monetary UI must use ¥#,###M instead of 百万円");
}
if (
  formatMillionJpy(4009.5) !== "¥4,010M"
  || formatMillionJpy(-138.5) !== "-¥139M"
  || formatMillionJpy(0.49) !== "¥0M"
) {
  throw new Error("BZM 2.2 monetary UI rounding/format contract mismatch");
}
if (/generated\/bzm-2-2-pilot|bzm-2-2-all-pj-provisional-v0-1\.json/.test(componentSource)) {
  throw new Error("BZM 2.2 client component must not import generated/raw artifacts");
}

const cockpitSummarySource = requireText(cockpitSummaryPath);
requireIncludes(cockpitSummarySource, [
  'data-testid="cockpit-bzm22-primary"',
  "BZM22_TOP_METRICS",
  "?view=summary",
  'symbol="J"',
  'symbol="P"',
  'symbol="Q"',
  'symbol="S"',
  "103パラメータと計算を見る",
], "cockpit BZM 2.2 primary summary");
if (cockpitSummarySource.includes("`${symbol}(a)`")) {
  throw new Error("cockpit BZM 2.2 primary metric heading must stay exactly J/P/Q/S");
}
const cockpitVentureSource = requireText(cockpitVenturePath);
requireIncludes(cockpitVentureSource, [
  "Bzm22CockpitSummary",
  "SPS履歴（旧モデル）",
  "旧SPS履歴を開く",
  "legacyScoreHistoryOpen",
], "cockpit BZM 2.2 primary ordering");
if (cockpitVentureSource.includes("CockpitPlMonthlyModal") || cockpitVentureSource.includes("📊 試算表")) {
  throw new Error("cockpit header must not keep the detached monthly P&L button/modal");
}
const hudVentureSource = requireText(hudVenturePath);
if (hudVentureSource.includes("CockpitPlMonthlyModal") || hudVentureSource.includes("📊 試算表")) {
  throw new Error("HUD cockpit header must not keep the detached monthly P&L button/modal");
}

const scoreDetailSource = requireText(scoreDetailPath);
requireIncludes(scoreDetailSource, [
  "Bzm22ProvisionalObservatory",
  "現行SPS / BZM 2.1",
  "BZM 2.0",
  "SPS 1.0 / Legacy AMD",
  "LazyArchiveDisclosure",
], "score-detail model ordering");
const bzm22Index = scoreDetailSource.indexOf("<Bzm22ProvisionalObservatory");
const currentSpsIndex = scoreDetailSource.indexOf('title="現行SPS / BZM 2.1"');
const bzm20Index = scoreDetailSource.indexOf('title="BZM 2.0"');
const legacyIndex = scoreDetailSource.indexOf('title="SPS 1.0 / Legacy AMD"');
if (!(bzm22Index >= 0 && bzm22Index < currentSpsIndex && currentSpsIndex < bzm20Index && bzm20Index < legacyIndex)) {
  throw new Error("score-detail model order must be BZM2.2 -> current SPS2.1 -> BZM2.0 -> BZM1.0/legacy");
}

console.log(JSON.stringify({
  ok: true,
  artifactSha256,
  projects: manifest.projects.length,
  parametersPerProject: 103,
  maxMinifiedResponseBytes: Math.max(...projectionResults.map((row) => row.bytes)),
}, null, 2));
