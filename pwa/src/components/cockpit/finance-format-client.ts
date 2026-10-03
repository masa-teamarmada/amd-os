/**
 * 試算表の標準フォーマット（ProjectFinanceFormat）が読むデータのクライアント層。
 *
 * どれも参照系（月単位でしか変わらない）なので、@/lib/reference-data-cache を通して1回だけ読む。
 * 画面からは素の fetch を書かない（spec 5-10）。保存した画面は該当のキャッシュを捨てる。
 */

import { createClient } from "@/lib/supabase/client";
import { invalidateReferenceData, loadReferenceData, peekReferenceData } from "@/lib/reference-data-cache";
import type { FinanceCashSourceRow } from "@/lib/project-finance-format";

const CASHFLOW_KEY = "cockpit/finance-format/cashflow/";
const CAPITAL_PLAN_KEY = "cockpit/finance-format/capital-plan/";
const GRANTS_KEY = "cockpit/finance-format/grants/";
const FOUNDED_KEY = "cockpit/finance-format/founded/";

const CASHFLOW_COLUMNS = [
  "ym",
  "source_status",
  "operating_cash_flow_yen",
  "investing_cash_flow_yen",
  "equity_funding_yen",
  "grant_receipt_yen",
  "cash_inflow_yen",
  "sbir_payment_yen",
  "nedo_payment_yen",
  "working_capital_payment_yen",
  "free_cash_flow_yen",
  "financing_cash_flow_yen",
  "net_cash_flow_yen",
  "opening_cash_yen",
  "closing_cash_yen",
  "sbir_account_balance_yen",
  "working_capital_balance_yen",
  "bank_borrowing_balance_yen",
  "source_note",
  "planning_details_json",
].join(", ");

/** 月次C/F（資金計画の列を含む）。1,000行の上限を跨いでも黙って切れないよう、500行ずつ読む。 */
export function getCachedFinanceCashflow(projectId: string): FinanceCashSourceRow[] | undefined {
  return peekReferenceData<FinanceCashSourceRow[]>(`${CASHFLOW_KEY}${projectId}`);
}

export function loadFinanceCashflow(projectId: string): Promise<FinanceCashSourceRow[]> {
  return loadReferenceData(`${CASHFLOW_KEY}${projectId}`, async () => {
    const supabase = createClient();
    const rows: FinanceCashSourceRow[] = [];
    for (let from = 0; ; from += 500) {
      const { data, error } = await supabase
        .from("project_monthly_cashflow")
        .select(CASHFLOW_COLUMNS)
        .eq("project_id", projectId)
        .order("ym")
        .range(from, from + 499);
      if (error) throw new Error("資金繰りを読み込めない。再読み込みして。");
      rows.push(...((data ?? []) as unknown as FinanceCashSourceRow[]));
      if ((data?.length ?? 0) < 500) break;
    }
    return rows;
  });
}

/** 有効な資本政策の文書（document_json）。会社設立の月と調達イベントを読むためだけに使う。 */
export function getCachedFinanceCapitalPlan(projectId: string): unknown | null | undefined {
  return peekReferenceData<unknown | null>(`${CAPITAL_PLAN_KEY}${projectId}`);
}

export function loadFinanceCapitalPlan(projectId: string): Promise<unknown | null> {
  return loadReferenceData(`${CAPITAL_PLAN_KEY}${projectId}`, async () => {
    const response = await fetch(`/api/governance/capital-plans?projectId=${encodeURIComponent(projectId)}`);
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null) as { plans?: Array<{ status?: string; document_json?: unknown }> } | null;
    const active = payload?.plans?.find((plan) => plan.status === "active");
    return active?.document_json ?? null;
  });
}

export interface FinanceGrantEvidence {
  grant_name: string;
  agency: string | null;
  amount_yen: number | null;
  disbursed_yen: number | null;
  adopted_date: string | null;
  period_start_ym: string | null;
  period_end_ym: string | null;
}

/** 助成金の採択情報。助成金等入金のセルに「採択情報」として添える。 */
export function getCachedFinanceGrants(projectId: string): FinanceGrantEvidence[] | undefined {
  return peekReferenceData<FinanceGrantEvidence[]>(`${GRANTS_KEY}${projectId}`);
}

export function loadFinanceGrants(projectId: string): Promise<FinanceGrantEvidence[]> {
  return loadReferenceData(`${GRANTS_KEY}${projectId}`, async () => {
    const response = await fetch(`/api/grants?projectId=${encodeURIComponent(projectId)}`);
    if (!response.ok) return [];
    const payload = await response.json().catch(() => null) as { grants?: Array<Record<string, unknown>> } | null;
    return (payload?.grants ?? []).map((grant) => ({
      grant_name: typeof grant.grant_name === "string" ? grant.grant_name : "助成金等",
      agency: typeof grant.agency === "string" ? grant.agency : null,
      amount_yen: grant.amount_yen === null || grant.amount_yen === undefined ? null : Number(grant.amount_yen),
      disbursed_yen: grant.disbursed_yen === null || grant.disbursed_yen === undefined ? null : Number(grant.disbursed_yen),
      adopted_date: typeof grant.adopted_date === "string" ? grant.adopted_date : null,
      period_start_ym: typeof grant.period_start_ym === "string" ? grant.period_start_ym : null,
      period_end_ym: typeof grant.period_end_ym === "string" ? grant.period_end_ym : null,
    }));
  });
}

/** 会社の設立日（project_ventures.founded_at）。設立前PJと会社の会計を分ける月の正本。 */
export function getCachedFinanceFoundedAt(projectId: string): string | null | undefined {
  return peekReferenceData<string | null>(`${FOUNDED_KEY}${projectId}`);
}

export function loadFinanceFoundedAt(projectId: string): Promise<string | null> {
  return loadReferenceData(`${FOUNDED_KEY}${projectId}`, async () => {
    const supabase = createClient();
    const { data, error } = await supabase.from("project_ventures").select("founded_at").eq("project_id", projectId).maybeSingle();
    if (error) return null;
    return typeof data?.founded_at === "string" ? data.founded_at : null;
  });
}

/** 月次C/F・資本政策・助成金・設立日のキャッシュを捨てる（保存した画面が呼ぶ）。 */
export function invalidateFinanceFormatCache(projectId?: string): void {
  for (const prefix of [CASHFLOW_KEY, CAPITAL_PLAN_KEY, GRANTS_KEY, FOUNDED_KEY]) {
    invalidateReferenceData(projectId ? `${prefix}${projectId}` : prefix);
  }
}
