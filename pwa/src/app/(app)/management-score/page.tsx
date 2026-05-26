import { createClient } from "@/lib/supabase/server";
import { GasMonthlySimulationPanel, type GasMonthlyRow, type GasProjectListItem, type GasSimulationResult } from "@/components/management-score/GasMonthlySimulationPanel";
import {
  EvidencePanel,
  type EvidenceRow,
  type DialogueConfirmedSignal,
} from "@/components/management-score/EvidencePanel";
import type { MonthlyPlInputs } from "@/lib/finance/monthly-pl-simulation";

export const dynamic = "force-dynamic";

type BudgetActualRow = {
  ym: string;
  scope: string;
  project_id: string | null;
  category: string;
  account_name: string | null;
  budget_amount_yen: number | null;
  actual_amount_yen: number | null;
  variance_yen: number | null;
  cash_amount_yen: number | null;
  runway_months: number | null;
  budget_payload: Record<string, unknown> | null;
  actual_payload: Record<string, unknown> | null;
};

type AggregatedBudgetActualRow = {
  ym: string;
  category: string;
  budget_amount_yen: number;
  actual_amount_yen: number;
  variance_yen: number;
  cash_amount_yen: number | null;
  runway_months: number | null;
};

type ScoreSnapshot = {
  ym: string;
  total_score: number | null;
  initiative_score: number | null;
  finance_score: number | null;
  retention_score: number | null;
  pipeline_score: number | null;
  direction_score: number | null;
  confidence: number | null;
};

type ScoreSnapshotFull = ScoreSnapshot & {
  id: string;
  inputs_json: Record<string, unknown> | null;
  next_actions_json: unknown;
  summary: string | null;
  finance_cap_applied: string | null;
  updated_at: string | null;
};

type EvidenceQueryRow = {
  id: string;
  axis: string;
  evidence_kind: string;
  summary: string;
  source_type: string | null;
  source_ref: string | null;
  impact: number | string | null;
  confidence: number | string | null;
  payload: Record<string, unknown> | null;
};

type SimulationRun = {
  id: string;
  scenario_id: string | null;
  version: string;
  engine_version: string | null;
  ran_at: string;
};

type VarianceNote = {
  id: string;
  ym: string;
  category: string | null;
  variance_kind: string;
  note: string;
  confidence: number | null;
  status: string;
};

type BudgetInputRow = {
  input_kind: string;
  source_id: string | null;
  label: string | null;
  payload: Record<string, unknown> | null;
};

const SCORE_COMPONENTS: Array<{
  key: keyof Pick<
    ScoreSnapshot,
    "initiative_score" | "finance_score" | "retention_score" | "pipeline_score" | "direction_score"
  >;
  label: string;
  colorClass: string;
}> = [
  { key: "initiative_score", label: "先手力", colorClass: "text-sky-600" },
  { key: "finance_score", label: "財務", colorClass: "text-emerald-600" },
  { key: "retention_score", label: "継続", colorClass: "text-amber-600" },
  { key: "pipeline_score", label: "新規", colorClass: "text-violet-600" },
  { key: "direction_score", label: "方向", colorClass: "text-rose-600" },
];

async function safeSelect<T>(
  run: () => PromiseLike<{ data: T | null; error: { message?: string } | null }>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data, error } = await run();
    return { data: data ?? null, error: error?.message ?? null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

function yen(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function pct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${Math.round(value)}%`;
}

function scoreTone(value: number | null | undefined): string {
  if (value == null) return "text-muted-foreground";
  if (value >= 75) return "text-emerald-600";
  if (value >= 55) return "text-amber-600";
  return "text-red-600";
}

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    revenue: "売上",
    cost_member: "メンバー原価",
    cost_closer: "クローザー原価",
    gross_profit: "粗利",
    fixed_cost: "固定費",
    social_insurance: "社保",
    operating_profit: "営業利益",
    loan_payment: "借入返済",
    loan_interest: "支払利息",
    tax_payment_consumption: "消費税",
    tax_payment_corporate: "法人税",
    net_cash_flow: "純CF",
  };
  return labels[category] ?? category;
}

function ymToDate(ym: string): Date {
  return new Date(Number(ym.slice(0, 4)), Number(ym.slice(4, 6)) - 1, 1);
}

function dateToYm(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(ym: string, delta: number): string {
  const date = ymToDate(ym);
  date.setMonth(date.getMonth() + delta);
  return dateToYm(date);
}

function shortYm(ym: string): string {
  return `${ym.slice(2, 4)}/${ym.slice(4, 6)}`;
}

function centeredMonths(centerYm: string | null, availableYms: string[], before = 12, after = 12): string[] {
  const center = centerYm ?? availableYms.sort().at(-1) ?? dateToYm(new Date());
  return Array.from({ length: before + after + 1 }, (_, index) => addMonths(center, index - before));
}

function aggregateCategoryRows(rows: BudgetActualRow[], ym?: string): AggregatedBudgetActualRow[] {
  const map = new Map<string, AggregatedBudgetActualRow>();
  for (const row of rows) {
    if (ym && row.ym !== ym) continue;
    if (row.scope !== "company" || row.category === "project_revenue") continue;
    const current = map.get(row.category) ?? {
      ym: row.ym,
      category: row.category,
      budget_amount_yen: 0,
      actual_amount_yen: 0,
      variance_yen: 0,
      cash_amount_yen: null,
      runway_months: null,
    };
    current.budget_amount_yen += row.budget_amount_yen ?? 0;
    current.actual_amount_yen += row.actual_amount_yen ?? 0;
    current.cash_amount_yen = current.cash_amount_yen ?? row.cash_amount_yen;
    current.runway_months = current.runway_months ?? row.runway_months;
    map.set(row.category, current);
  }
  return Array.from(map.values()).map((row) => ({
    ...row,
    variance_yen: row.actual_amount_yen - row.budget_amount_yen,
  }));
}

function byMonthCategory(rows: BudgetActualRow[]): Map<string, Map<string, BudgetActualRow[]>> {
  const map = new Map<string, Map<string, BudgetActualRow[]>>();
  for (const row of rows) {
    const month = map.get(row.ym) ?? new Map<string, BudgetActualRow[]>();
    const list = month.get(row.category) ?? [];
    list.push(row);
    month.set(row.category, list);
    map.set(row.ym, month);
  }
  return map;
}

function findAmount(rows: AggregatedBudgetActualRow[], category: string, key: "budget_amount_yen" | "actual_amount_yen" | "variance_yen") {
  return rows.find((row) => row.category === category)?.[key] ?? null;
}

function payloadNumberValue(payload: Record<string, unknown> | null | undefined, key: string): number {
  const value = payload?.[key];
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function companyBudgetRow(categoryRows: Map<string, Map<string, BudgetActualRow[]>>, ym: string, category: string): BudgetActualRow | null {
  return categoryRows.get(ym)?.get(category)?.find((row) => row.budget_amount_yen != null && row.budget_payload !== null) ?? null;
}

function companyBudgetValue(categoryRows: Map<string, Map<string, BudgetActualRow[]>>, ym: string, category: string): number {
  return companyBudgetRow(categoryRows, ym, category)?.budget_amount_yen ?? 0;
}

function fixedCostDetailsForGas(categoryRows: Map<string, Map<string, BudgetActualRow[]>>, ym: string) {
  const details = companyBudgetRow(categoryRows, ym, "fixed_cost")?.budget_payload?.fixedCostDetails;
  if (!Array.isArray(details)) return [];
  return details
    .map((detail) => {
      if (!detail || typeof detail !== "object") return null;
      const row = detail as { name?: unknown; amount?: unknown };
      const amount = Number(row.amount);
      if (!row.name || !Number.isFinite(amount)) return null;
      return { name: String(row.name), amount };
    })
    .filter((row): row is { name: string; amount: number } => row !== null);
}

function buildGasSimulationResult(
  months: string[],
  categoryRows: Map<string, Map<string, BudgetActualRow[]>>,
  rawRows: BudgetActualRow[],
  inputRows: BudgetInputRow[]
): GasSimulationResult {
  const projectInputs = inputRows.filter((row) => row.input_kind === "project" && row.source_id);
  const projectList: GasProjectListItem[] = projectInputs.map((row) => ({
    projectId: row.source_id as string,
    projectName: row.label ?? (row.source_id as string),
    closerInternal: row.payload?.closerInternal === true || row.payload?.closerInternal === "TRUE" || row.payload?.closerInternal === "true",
  }));
  const projectRowsByMonth = new Map<string, BudgetActualRow[]>();
  for (const row of rawRows) {
    if (row.scope !== "project" || row.category !== "project_revenue") continue;
    const list = projectRowsByMonth.get(row.ym) ?? [];
    list.push(row);
    projectRowsByMonth.set(row.ym, list);
  }
  const rows: GasMonthlyRow[] = months.map((ym) => {
    const netCash = companyBudgetRow(categoryRows, ym, "net_cash_flow");
    const revenueRow = companyBudgetRow(categoryRows, ym, "revenue");
    const projectRows = projectRowsByMonth.get(ym) ?? [];
    return {
      ym: Number(ym),
      revenue: companyBudgetValue(categoryRows, ym, "revenue"),
      costMember: companyBudgetValue(categoryRows, ym, "cost_member"),
      costCloser: companyBudgetValue(categoryRows, ym, "cost_closer"),
      grossProfit: companyBudgetValue(categoryRows, ym, "gross_profit"),
      fixedCost: companyBudgetValue(categoryRows, ym, "fixed_cost"),
      socialIns: companyBudgetValue(categoryRows, ym, "social_insurance"),
      operatingProfit: companyBudgetValue(categoryRows, ym, "operating_profit"),
      loanPayment: companyBudgetValue(categoryRows, ym, "loan_payment"),
      loanInterest: companyBudgetValue(categoryRows, ym, "loan_interest"),
      ctaxPayment: companyBudgetValue(categoryRows, ym, "tax_payment_consumption"),
      corpTaxPayment: companyBudgetValue(categoryRows, ym, "tax_payment_corporate"),
      netCashFlow: companyBudgetValue(categoryRows, ym, "net_cash_flow"),
      cashBalance: revenueRow?.cash_amount_yen ?? 0,
      runway: Number(revenueRow?.runway_months ?? 0),
      loanDisbursement: payloadNumberValue(netCash?.budget_payload, "loanDisbursement"),
      spotIncome: payloadNumberValue(netCash?.budget_payload, "spotIncome"),
      spotExpense: payloadNumberValue(netCash?.budget_payload, "spotExpense"),
      cashInflow: payloadNumberValue(netCash?.budget_payload, "cashInflow"),
      cashOutflow: payloadNumberValue(netCash?.budget_payload, "cashOutflow"),
      pjDetails: projectList.map((project) => {
        const projectRow = projectRows.find((row) => row.budget_payload?.gasProjectId === project.projectId || row.account_name === project.projectName);
        return {
          projectId: project.projectId,
          revenue: projectRow?.budget_amount_yen ?? 0,
          externalMember: payloadNumberValue(projectRow?.budget_payload, "externalMember"),
          internalMember: payloadNumberValue(projectRow?.budget_payload, "internalMember"),
        };
      }),
      fixedCostDetails: fixedCostDetailsForGas(categoryRows, ym),
    };
  });
  return {
    params: { rateCloser: 0.05 },
    rows,
    projectList,
  };
}

function buildMonthlyPlInputs(inputRows: BudgetInputRow[]): MonthlyPlInputs | null {
  const payloads = (kind: string): Record<string, unknown>[] =>
    inputRows
      .filter((row) => row.input_kind === kind && row.payload)
      .map((row) => row.payload as Record<string, unknown>);
  const params = inputRows.find((row) => row.input_kind === "params" && row.payload)?.payload;
  if (!params) return null;
  return {
    params: params as unknown as MonthlyPlInputs["params"],
    projects: payloads("project") as unknown as MonthlyPlInputs["projects"],
    fixedCosts: payloads("fixed_cost") as unknown as MonthlyPlInputs["fixedCosts"],
    projectRevenues: payloads("project_revenue") as unknown as MonthlyPlInputs["projectRevenues"],
    varCosts: payloads("var_cost") as unknown as MonthlyPlInputs["varCosts"],
    loans: payloads("loan") as unknown as MonthlyPlInputs["loans"],
    spots: payloads("spot") as unknown as MonthlyPlInputs["spots"],
    scenarios: payloads("scenario") as unknown as MonthlyPlInputs["scenarios"],
  };
}

function currentYmJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function ManagementScorePage() {
  const supabase = await createClient();
  // 未来月の snapshot を除外 (= まさ #76 確定 2026-05-26)。
  // 計算ミスやデータ不足の 6 月 snapshot が「最新」 と判定されて表示されないように、
  // ym <= currentYmJST() で filter する。
  const ymCap = currentYmJST();
  const [scoreRes, scoreHistoryRes, budgetRes, inputRes, runRes, notesRes, evidenceRes, dialogueConfirmedRes] = await Promise.all([
    safeSelect<ScoreSnapshotFull[]>(() =>
      supabase
        .from("amd_management_score_snapshots")
        .select("id,ym,total_score,initiative_score,finance_score,retention_score,pipeline_score,direction_score,confidence,inputs_json,next_actions_json,summary,finance_cap_applied,updated_at")
        .lte("ym", ymCap)
        .order("ym", { ascending: false })
        .limit(1)
    ),
    safeSelect<ScoreSnapshot[]>(() =>
      supabase
        .from("amd_management_score_snapshots")
        .select("ym,total_score,initiative_score,finance_score,retention_score,pipeline_score,direction_score,confidence")
        .lte("ym", ymCap)
        .order("ym", { ascending: false })
        .limit(25)
    ),
    safeSelect<BudgetActualRow[]>(() =>
      supabase
        .from("company_budget_actual_monthly")
        .select("ym,scope,project_id,category,account_name,budget_amount_yen,actual_amount_yen,variance_yen,cash_amount_yen,runway_months,budget_payload,actual_payload")
        .order("ym", { ascending: false })
        .limit(2000)
    ),
    safeSelect<BudgetInputRow[]>(() =>
      supabase
        .from("company_budget_inputs")
        .select("input_kind,source_id,label,payload")
        .eq("source", "gas_monthly_pl")
        .order("input_kind", { ascending: true })
        .limit(500)
    ),
    safeSelect<SimulationRun[]>(() =>
      supabase
        .from("company_budget_simulation_runs")
        .select("id,scenario_id,version,engine_version,ran_at")
        .order("ran_at", { ascending: false })
        .limit(1)
    ),
    safeSelect<VarianceNote[]>(() =>
      supabase
        .from("company_budget_variance_notes")
        .select("id,ym,category,variance_kind,note,confidence,status")
        .order("created_at", { ascending: false })
        .limit(8)
    ),
    safeSelect<(EvidenceQueryRow & { ym: string; snapshot_id: string | null })[]>(() =>
      supabase
        .from("amd_management_score_evidence")
        .select("id,snapshot_id,ym,axis,evidence_kind,summary,source_type,source_ref,impact,confidence,payload")
        .order("created_at", { ascending: false })
        .limit(200)
    ),
    // dialogue で confirmed されたシグナル (= status='confirmed' AND decision_state IN decided/executing/revised)。
    // バイタル計算の新規軸 / 方向軸の入力に流れるので、EvidencePanel に chip 表示して
    // 「議論 → バイタル反映」 の経路を可視化する (= まさ #91 再設計)。
    safeSelect<DialogueConfirmedSignal[]>(() =>
      supabase
        .from("project_strategy_signals")
        .select("signal_id,project_id,ym,signal_type,impact_level,decision_state,title,confirmed_at,polarity")
        .eq("status", "confirmed")
        .in("decision_state", ["decided", "executing", "revised"])
        .lte("ym", ymCap)
        .order("confirmed_at", { ascending: false, nullsFirst: false })
        .limit(40)
    ),
  ]);
  const dialogueConfirmedSignals: DialogueConfirmedSignal[] = dialogueConfirmedRes.data ?? [];

  const score = scoreRes.data?.[0] ?? null;
  const previous = scoreHistoryRes.data && scoreHistoryRes.data.length >= 2 ? scoreHistoryRes.data[1] : null;
  const scoreHistory = (scoreHistoryRes.data ?? []).slice().reverse();
  const budgetRows = budgetRes.data ?? [];
  const scoreInputs = (score?.inputs_json ?? {}) as Record<string, unknown>;
  const financeCap = score?.finance_cap_applied ?? (typeof scoreInputs.financeCap === "string" ? (scoreInputs.financeCap as string) : null);
  const snapshotSummary = score?.summary ?? null;
  const rawSignalCount = typeof scoreInputs.rawSignalCount === "number" ? (scoreInputs.rawSignalCount as number) : null;
  const nextActionsRaw = score?.next_actions_json;
  const nextActions = Array.isArray(nextActionsRaw)
    ? (nextActionsRaw as unknown[]).filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const evidenceRowsRaw = (evidenceRes.data ?? []) as Array<EvidenceQueryRow & { ym: string; snapshot_id: string | null }>;
  const evidenceRows: EvidenceRow[] = evidenceRowsRaw
    .filter((row) => (score?.id ? row.snapshot_id === score.id : score?.ym ? row.ym === score.ym : true))
    .map((row) => ({
      id: row.id,
      axis: row.axis,
      evidence_kind: row.evidence_kind,
      summary: row.summary,
      source_type: row.source_type,
      source_ref: row.source_ref,
      impact: Number(row.impact ?? 0),
      confidence: Number(row.confidence ?? 0),
      payload: row.payload,
    }));
  const selectedYm = score?.ym ?? null;
  const availableBudgetYms = Array.from(new Set(budgetRows.filter((row) => row.scope === "company").map((row) => row.ym)));
  const financeMonths = availableBudgetYms.length > 0 ? availableBudgetYms.sort() : centeredMonths(selectedYm, availableBudgetYms);
  const budgetCategoryRows = byMonthCategory(budgetRows.filter((row) => row.scope === "company"));
  const budgetInputRows = inputRes.data ?? [];
  const gasSimulationResult = buildGasSimulationResult(financeMonths, budgetCategoryRows, budgetRows, budgetInputRows);
  const gasSimulationInputs = buildMonthlyPlInputs(budgetInputRows);
  const latestRows = aggregateCategoryRows(budgetRows, selectedYm ?? undefined);
  const latestYm = latestRows[0]?.ym ?? null;
  const latestRun = runRes.data?.[0] ?? null;
  const runway = latestRows.find((row) => row.runway_months != null)?.runway_months ?? null;
  const cash = latestRows.find((row) => row.cash_amount_yen != null)?.cash_amount_yen ?? null;
  const revenueBudget = findAmount(latestRows, "revenue", "budget_amount_yen");
  const revenueActual = findAmount(latestRows, "revenue", "actual_amount_yen");
  const netCashBudget = findAmount(latestRows, "net_cash_flow", "budget_amount_yen");
  const netCashActual = findAmount(latestRows, "net_cash_flow", "actual_amount_yen");
  const blockingError = scoreRes.error || scoreHistoryRes.error || budgetRes.error || inputRes.error || runRes.error || notesRes.error || evidenceRes.error;
  const totalDelta = score?.total_score != null && previous?.total_score != null ? Number(score.total_score) - Number(previous.total_score) : null;
  function delta(curr: number | null | undefined, prev: number | null | undefined): number | null {
    if (curr == null || prev == null) return null;
    return Number(curr) - Number(prev);
  }
  function deltaLabel(value: number | null): string {
    if (value == null) return "";
    if (value === 0) return "±0";
    const sign = value > 0 ? "+" : "";
    return `${sign}${Math.round(value)}`;
  }
  function deltaTone(value: number | null): string {
    if (value == null) return "text-muted-foreground";
    if (value > 0) return "text-emerald-600";
    if (value < 0) return "text-red-600";
    return "text-muted-foreground";
  }
  function financeCapLabel(cap: string | null): string | null {
    if (!cap) return null;
    if (cap === "runway_lt_2") return "runway <2ヶ月: total max 45";
    if (cap === "runway_lt_4") return "runway <4ヶ月: total max 60";
    return cap;
  }

  return (
    <div className="min-h-[calc(100vh-2.75rem)] bg-background">
      <div className="mx-auto max-w-7xl px-6 py-6 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">AMD Management Score</p>
            <h1 className="text-2xl font-semibold tracking-normal">経営状況</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>対象月 {score?.ym ?? latestYm ?? "-"}</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span>前月比 <span className={`font-semibold tabular-nums ${deltaTone(totalDelta)}`}>{deltaLabel(totalDelta) || "-"}</span></span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span>confidence {score?.confidence != null ? `${Math.round(Number(score.confidence) * 100)}%` : "-"}</span>
            {rawSignalCount != null && (
              <>
                <span className="h-1 w-1 rounded-full bg-border" />
                <span>raw {rawSignalCount}件</span>
              </>
            )}
            <span className="h-1 w-1 rounded-full bg-border" />
            <span>計算 {latestRun ? new Date(latestRun.ran_at).toLocaleString("ja-JP") : score?.updated_at ? new Date(score.updated_at).toLocaleString("ja-JP") : "-"}</span>
          </div>
        </div>

        {snapshotSummary && (
          <section className="rounded-md border bg-card px-4 py-3">
            <div className="text-xs font-semibold text-muted-foreground">今月の結論</div>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground">{snapshotSummary}</p>
          </section>
        )}

        {financeCap && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-900">
            <span className="font-semibold">finance cap 適用中:</span> {financeCapLabel(financeCap)}
          </div>
        )}

        {nextActions.length > 0 && (
          <section className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3">
            <div className="text-xs font-semibold text-primary">次の一手</div>
            <ul className="mt-1.5 space-y-1 text-sm">
              {nextActions.map((action, idx) => (
                <li key={idx} className="leading-snug">・{action}</li>
              ))}
            </ul>
          </section>
        )}

        {blockingError && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            finance schema waiting: {blockingError}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-6">
          <Metric
            label="Total"
            value={score ? pct(score.total_score) : "-"}
            delta={deltaLabel(totalDelta)}
            deltaClassName={deltaTone(totalDelta)}
            className={scoreTone(score?.total_score)}
          />
          <Metric
            label="先手力"
            value={score ? pct(score.initiative_score) : "-"}
            delta={deltaLabel(delta(score?.initiative_score, previous?.initiative_score))}
            deltaClassName={deltaTone(delta(score?.initiative_score, previous?.initiative_score))}
            className={scoreTone(score?.initiative_score)}
          />
          <Metric
            label="財務"
            value={score ? pct(score.finance_score) : "-"}
            delta={deltaLabel(delta(score?.finance_score, previous?.finance_score))}
            deltaClassName={deltaTone(delta(score?.finance_score, previous?.finance_score))}
            className={scoreTone(score?.finance_score)}
          />
          <Metric
            label="継続"
            value={score ? pct(score.retention_score) : "-"}
            delta={deltaLabel(delta(score?.retention_score, previous?.retention_score))}
            deltaClassName={deltaTone(delta(score?.retention_score, previous?.retention_score))}
            className={scoreTone(score?.retention_score)}
          />
          <Metric
            label="新規"
            value={score ? pct(score.pipeline_score) : "-"}
            delta={deltaLabel(delta(score?.pipeline_score, previous?.pipeline_score))}
            deltaClassName={deltaTone(delta(score?.pipeline_score, previous?.pipeline_score))}
            className={scoreTone(score?.pipeline_score)}
          />
          <Metric
            label="方向"
            value={score ? pct(score.direction_score) : "-"}
            delta={deltaLabel(delta(score?.direction_score, previous?.direction_score))}
            deltaClassName={deltaTone(delta(score?.direction_score, previous?.direction_score))}
            className={scoreTone(score?.direction_score)}
          />
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <Metric label="Runway" value={runway == null ? "-" : `${runway.toFixed(1)}ヶ月`} />
          <Metric label="Cash" value={yen(cash)} />
          <Metric label="売上 予算 / 実績" value={`${yen(revenueBudget)} / ${yen(revenueActual)}`} />
          <Metric label="純CF 予算 / 実績" value={`${yen(netCashBudget)} / ${yen(netCashActual)}`} />
        </section>

        <section className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">スコア推移</h2>
          </div>
          <ScoreHistory rows={scoreHistory} />
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {SCORE_COMPONENTS.map((component) => (
            <ScoreComponentTrend
              key={component.key}
              rows={scoreHistory}
              scoreKey={component.key}
              label={component.label}
              colorClass={component.colorClass}
            />
          ))}
        </section>

        <EvidencePanel rows={evidenceRows} dialogueConfirmedSignals={dialogueConfirmedSignals} />

        <GasMonthlySimulationPanel result={gasSimulationResult} inputs={gasSimulationInputs} />

        <section className="grid gap-4 xl:grid-cols-[1fr_0.42fr]">
          <div className="rounded-md border bg-card">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">差分メモ</h2>
            </div>
            <div className="divide-y">
              {(notesRes.data ?? []).length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">データ待ち</div>
              )}
              {(notesRes.data ?? []).map((note) => (
                <div key={note.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{note.ym} / {note.category ? categoryLabel(note.category) : note.variance_kind}</span>
                    <span>{note.status}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed">{note.note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  delta,
  deltaClassName = "",
  className = "",
}: {
  label: string;
  value: string;
  delta?: string;
  deltaClassName?: string;
  className?: string;
}) {
  return (
    <div className="rounded-md border bg-card px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-xs text-muted-foreground">{label}</div>
        {delta && (
          <div className={`text-[11px] font-semibold tabular-nums ${deltaClassName}`}>{delta}</div>
        )}
      </div>
      <div className={`mt-1 text-lg font-semibold tabular-nums tracking-normal ${className}`}>{value}</div>
    </div>
  );
}

function linePoints(values: Array<number | null>, width: number, height: number, minValue: number, maxValue: number): string {
  const range = Math.max(1, maxValue - minValue);
  return values
    .map((value, index) => {
      if (value == null || Number.isNaN(value)) return null;
      const x = values.length <= 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - minValue) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");
}

function ScoreComponentTrend({
  rows,
  scoreKey,
  label,
  colorClass,
}: {
  rows: ScoreSnapshot[];
  scoreKey: keyof Pick<ScoreSnapshot, "initiative_score" | "finance_score" | "retention_score" | "pipeline_score" | "direction_score">;
  label: string;
  colorClass: string;
}) {
  const latest = rows.at(-1)?.[scoreKey] ?? null;
  const points = linePoints(rows.map((row) => row[scoreKey]), 180, 64, 0, 100);
  return (
    <div className="rounded-md border bg-card px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs text-muted-foreground">{label} 推移</div>
        <div className={`text-sm font-semibold tabular-nums ${colorClass}`}>{pct(latest)}</div>
      </div>
      <svg className={`mt-3 h-16 w-full overflow-visible ${colorClass}`} viewBox="0 0 180 64" role="img" aria-label={`${label}の推移`}>
        <line x1="0" x2="180" y1="48" y2="48" className="stroke-border" strokeWidth="1" />
        <line x1="0" x2="180" y1="16" y2="16" className="stroke-border/60" strokeWidth="1" />
        {points && (
          <polyline
            points={points}
            fill="none"
            className="stroke-current"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>{rows[0]?.ym ? shortYm(rows[0].ym) : "-"}</span>
        <span>{rows.at(-1)?.ym ? shortYm(rows.at(-1)?.ym ?? "") : "-"}</span>
      </div>
    </div>
  );
}

function ScoreHistory({ rows }: { rows: ScoreSnapshot[] }) {
  if (rows.length === 0) {
    return <div className="px-4 py-8 text-center text-sm text-muted-foreground">データ待ち</div>;
  }
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px] px-4 py-4">
        <div className="flex items-end gap-2 border-b pb-3">
          {rows.map((row) => {
            const score = row.total_score ?? 0;
            return (
              <div key={row.ym} className="flex min-w-16 flex-1 flex-col items-center gap-2">
                <div className="flex h-24 w-full items-end rounded-sm bg-muted/40 px-2">
                  <div
                    className="w-full rounded-sm bg-primary/75"
                    style={{ height: `${Math.max(4, Math.min(100, score))}%` }}
                    title={`${row.ym}: ${pct(row.total_score)}`}
                  />
                </div>
                <div className="text-xs font-medium tabular-nums">{pct(row.total_score)}</div>
                <div className="text-[11px] text-muted-foreground">{row.ym}</div>
              </div>
            );
          })}
        </div>
        <table className="mt-3 w-full text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 text-left font-medium">月</th>
              <th className="py-1 text-right font-medium">Total</th>
              <th className="py-1 text-right font-medium">先手</th>
              <th className="py-1 text-right font-medium">財務</th>
              <th className="py-1 text-right font-medium">継続</th>
              <th className="py-1 text-right font-medium">新規</th>
              <th className="py-1 text-right font-medium">方向</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice().reverse().map((row) => (
              <tr key={row.ym} className="border-t">
                <td className="py-1">{row.ym}</td>
                <td className="py-1 text-right tabular-nums">{pct(row.total_score)}</td>
                <td className="py-1 text-right tabular-nums">{pct(row.initiative_score)}</td>
                <td className="py-1 text-right tabular-nums">{pct(row.finance_score)}</td>
                <td className="py-1 text-right tabular-nums">{pct(row.retention_score)}</td>
                <td className="py-1 text-right tabular-nums">{pct(row.pipeline_score)}</td>
                <td className="py-1 text-right tabular-nums">{pct(row.direction_score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
