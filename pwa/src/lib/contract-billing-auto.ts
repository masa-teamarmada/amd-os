import type { SupabaseClient } from "@supabase/supabase-js";
import { REWARD_RATE } from "@/lib/contracts-apply";
import { basePayoutCapYen, resolveContractReserveBufferYen } from "@/lib/contract-money";

/**
 * 契約由来の「当月の請求額 (税抜)」を決定する。
 *
 * 出所の優先順位 (すべて契約 apply 済みデータ):
 *   1. schedule_based 契約 … billing_cycles.budget_yen ÷ 0.65 で請求額に逆算
 *      (Contract Apply が月別 budget_yen を contract_source_term_id 付きで書き込んでいる)
 *   2. monthly_fixed 契約 … projects.fee_amount をそのまま
 *
 * 契約データが無い (fee_amount も契約由来 budget_yen も無い) PJ は null を返す = 自動確定しない。
 */
export type ContractBillingResolution = {
  projectId: string;
  ym: string;
  /** 請求額 (税抜) = OS 売上 = budget_reported_amount に入れる額 */
  invoiceYen: number;
  /** 契約台帳にある会社回収バッファの当月消化額 */
  bufferYen: number;
  /** メンバー支払/stock返済に回せる当月cap (= invoice * 65% - buffer) */
  budgetYen: number;
  source: "monthly_fixed" | "schedule_based";
  feeType: string;
};

type ProjectRow = {
  project_id: string;
  project_name: string | null;
  fee_type: string | null;
  fee_amount: number | string | null;
  start_ym: string | null;
  end_ym: string | null;
  slack_channel_id: string | null;
  contract_terms_json: unknown;
};

type CycleRow = {
  project_id: string;
  ym: string;
  status: string | null;
  budget_yen: number | string | null;
  budget_reported_amount: number | string | null;
  budget_buffer_amount: number | string | null;
  contract_source_term_id: string | null;
};

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function ymInt(ym: string | null): number {
  return ym && /^\d{6}$/.test(ym) ? Number(ym) : 0;
}

/** 契約期間内か (start/end inclusive)。end_ym=null は「無期限計上事故」防止のため対象外にする */
export function isWithinContractPeriod(project: ProjectRow, ym: string): boolean {
  const t = ymInt(ym);
  if (!t) return false;
  const s = ymInt(project.start_ym);
  const e = ymInt(project.end_ym);
  if (s && t < s) return false;
  if (!e) return false; // end_ym 未設定の契約は自動確定の対象にしない
  if (t > e) return false;
  return true;
}

function withContractBuffer(
  project: ProjectRow,
  cycles: CycleRow[],
  ym: string,
  invoiceYen: number,
  source: ContractBillingResolution["source"],
): ContractBillingResolution {
  const bufferYen = resolveContractReserveBufferYen({ project, cycles, ym, invoiceYen });
  return {
    projectId: project.project_id,
    ym,
    invoiceYen,
    bufferYen,
    budgetYen: basePayoutCapYen(invoiceYen, bufferYen),
    source,
    feeType: source === "monthly_fixed" ? "monthly_fixed" : project.fee_type || "variable",
  };
}

export function resolveContractBilling(project: ProjectRow, cycle: CycleRow | null, ym: string, cycles: CycleRow[] = []): ContractBillingResolution | null {
  if (!isWithinContractPeriod(project, ym)) return null;

  // schedule_based: 契約 apply が刻んだ月別 budget_yen を請求額へ逆算
  if (cycle?.contract_source_term_id && (num(cycle.budget_yen) > 0 || num(cycle.budget_reported_amount) > 0)) {
    const reportedInvoice = num(cycle.budget_reported_amount);
    const invoiceYen = reportedInvoice > 0 ? reportedInvoice : Math.round(num(cycle.budget_yen) / REWARD_RATE);
    return withContractBuffer(project, cycles, ym, invoiceYen, "schedule_based");
  }

  // monthly_fixed: projects.fee_amount
  if ((project.fee_type || "").toLowerCase() === "monthly_fixed" && num(project.fee_amount) > 0) {
    return withContractBuffer(project, cycles, ym, num(project.fee_amount), "monthly_fixed");
  }

  return null;
}

export type AutoConfirmCandidate = {
  resolution: ContractBillingResolution;
  project: ProjectRow;
  cycle: CycleRow | null;
  /** すでに reported 以降に人が進めている → 自動確定はスキップ (人の入力を尊重) */
  alreadyProgressed: boolean;
};

const PROGRESSED_STATUSES = new Set([
  "reported",
  "budget_confirmed",
  "allocation_confirmed",
  "invoice_sent",
  "invoice_issued",
  "payment_confirmed",
  "budget_rejected",
]);

/**
 * 指定 ym で「契約由来額で自動確定できる候補」を全 active PJ から集める。
 * cron / dry-run の両方から使う。
 */
export async function collectAutoConfirmCandidates(db: SupabaseClient, ym: string): Promise<AutoConfirmCandidate[]> {
  const { data: projects, error: pErr } = await db
    .from("projects")
    .select("project_id, project_name, fee_type, fee_amount, start_ym, end_ym, slack_channel_id, contract_terms_json")
    .eq("status", "active");
  if (pErr) throw pErr;

  const projectIds = (projects ?? []).map((p: ProjectRow) => p.project_id);
  if (projectIds.length === 0) return [];

  const { data: cycles, error: cErr } = await db
    .from("billing_cycles")
    .select("project_id, ym, status, budget_yen, budget_reported_amount, budget_buffer_amount, contract_source_term_id")
    .lte("ym", ym)
    .in("project_id", projectIds);
  if (cErr) throw cErr;

  const cycleByPj = new Map<string, CycleRow>();
  const cyclesByPj = new Map<string, CycleRow[]>();
  for (const c of (cycles ?? []) as CycleRow[]) {
    const list = cyclesByPj.get(c.project_id) ?? [];
    list.push(c);
    cyclesByPj.set(c.project_id, list);
    if (c.ym === ym) cycleByPj.set(c.project_id, c);
  }

  const out: AutoConfirmCandidate[] = [];
  for (const project of (projects ?? []) as ProjectRow[]) {
    const cycle = cycleByPj.get(project.project_id) ?? null;
    const resolution = resolveContractBilling(project, cycle, ym, cyclesByPj.get(project.project_id) ?? []);
    if (!resolution) continue;
    const alreadyProgressed = PROGRESSED_STATUSES.has(cycle?.status || "");
    out.push({ resolution, project, cycle, alreadyProgressed });
  }
  return out;
}
