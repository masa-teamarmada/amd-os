// PJ別 利益構造ダッシュボード — service_role 読み取り層。
//
// この画面が答える問い:
//   「シーズンで決まっている原資のうち、どれだけが外部への現金支払として出ていき、
//     どれだけが会社に残るか」
//
// 【なぜ年ではなくシーズン単位か】2026-08-30 まさ確定。
// シーズン(plan cycle)で払う総額は最初から決まっている (value_plan_cycles.budget_yen)。
// 月ごとの cap 按分は「いつ払うか」を決めているだけで、「いくら払うか」ではない。
// だから月末時点の未払残は収益率を見るうえでノイズにしかならない。
// 実際、配分が進んだシーズンでは 外部支払 + 会社留保 = シーズン原資 にぴったり一致する
// (KUTE 202605-202703 = 4,679,994円、CX 202606-202609 = 585,000円)。
// 総額は固定で、変わるのは外部と社内の配分比だけ。それが収益率そのもの。
// シーズンは年をまたぐ (SX は 202604-202703)。年で切ると1シーズンが分断される。
//
// 【報酬モデルの前提】正本 pwa/manual/7-1-reward-calc-spec.md
//   - シーズン原資 = (請求額 − 契約バッファ) × 65%。残り35%は AMD運営費30% +
//     クローザー報酬5% の外枠で、reward_summary_json には入らない。
//   - メンバーは MS のポイントを消化して稼働需要 (grossDueYen) を発生させ、原資を按分する。
//   - `payoutExcluded` (= members.exclude_from_payout_notice) のメンバーへ按分された分は
//     現金支払されず `companyReserveYen` として会社に残る。まさはこの区分。
//   - つまり **まさがポイントを多く消化するほど、外部メンバーへ配る額が減り、会社に残る額が増える**。
//     まさへの現金支払が0円なのは設計どおりで、配分の放棄でも持ち出しでもない。
//
// 【参照系キャッシュ】billing_cycles / value_plan_cycles は月次締めでしか更新されない参照系。
// 全シーズンをまとめて1回読み、プロセス内に5分持つ (同時アクセスは1本へ束ねる)。
// 規範: pwa/spec/5-10-reference-data-caching-current-spec.md
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const MASA_MEMBER_ID = "ID001";
/** 請求額のうちメンバー配分枠に回る比率。請求額を逆算するためだけに使う。 */
const MEMBER_SHARE_RATE = 0.65;
/** 稼働需要がシーズン原資のこの倍数を超えたら「ポイント設定が原資に対して大きすぎる」警報。 */
const DEMAND_OVER_BUDGET_THRESHOLD = 1.5;

function numberValue(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

type ServiceClient = ReturnType<typeof createAdminClient>;

/** PostgREST の1レスポンス上限 (既定1000行) を跨いでも取りこぼさないためのページ読み。 */
const PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  label: string,
  buildQuery: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${label} lookup failed: ${error.message}`);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

/** "202604" → "2026-04-01"。まさの投下時間を週次テーブルから引くのに使う。 */
function ymToStartDate(ym: string): string {
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01`;
}
/** "202703" → "2027-03-31"。月末は翌月0日で求める。 */
function ymToEndDate(ym: string): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-${String(last).padStart(2, "0")}`;
}

type PlanCycleRow = {
  id: string;
  plan_cycle_id: string | null;
  project_id: string;
  status: string | null;
  budget_yen: number | string | null;
  period_start_ym: string | null;
  period_end_ym: string | null;
};

type BillingRow = {
  project_id: string;
  ym: string;
  status: string | null;
  reward_summary_json: unknown;
};

type ProjectRow = { project_id: string; project_name: string | null };
type MemberRow = { member_id: string; code_name: string | null; member_name: string | null };
type EffortRow = {
  project_id: string;
  week_start: string;
  development_hours: number | string | null;
  meeting_hours: number | string | null;
};

export type ProjectProfitabilityMember = {
  memberId: string;
  memberName: string;
  /** 支払対象外 (= 現金支払されず会社に残る区分)。まさ・きよはここ。 */
  payoutExcluded: boolean;
  /** シーズン累計の稼働需要額 */
  grossDueYen: number;
  /** シーズン累計の現金支払額 */
  paidYen: number;
  /** シーズン累計の非現金配賦 = 会社に残った額 */
  retainedYen: number;
};

export type ProjectProfitabilityWarnings = {
  /** 稼働需要がシーズン原資の1.5倍超。ポイント設定が原資に対して大きすぎる */
  demandOverBudget: boolean;
  /** 原資はあるが、このシーズンの報酬計算がまだ動いていない */
  noRewardCalc: boolean;
};

export type ProjectProfitabilityRow = {
  planCycleId: string;
  projectId: string;
  projectName: string;
  periodStartYm: string;
  periodEndYm: string;
  /** value_plan_cycles.status。active = 進行中、fixed = 確定済み */
  cycleStatus: string;
  /** シーズン原資 = value_plan_cycles.budget_yen。(請求額 − バッファ) × 65% の確定値 */
  seasonBudgetYen: number;
  /** 請求額(推定) = シーズン原資 ÷ 0.65。契約バッファのぶん実際より小さく出る */
  estimatedRevenueYen: number;
  /** 外部メンバーへ現金で出る額 = Σ externalPayoutCapYen */
  externalPaidYen: number;
  /** 会社に残る額 = Σ companyReserveYen */
  retainedYen: number;
  /** 配分済み合計 = 外部 + 会社。シーズンが進みきると原資に一致する */
  allocatedYen: number;
  /** 会社に残る率 = 会社に残る ÷ シーズン原資 */
  retentionRate: number | null;
  /** 外部へ出る率 = 外部へ現金 ÷ シーズン原資 */
  externalRate: number | null;
  /** 稼働需要総額 = Σ totalGrossDueYen */
  grossDueYen: number;
  /** 稼働需要 ÷ シーズン原資 */
  demandBudgetRatio: number | null;
  /** シーズン期間で billing_cycles が存在する月数 */
  months: number;
  /** うち status='not_started' の未確定月 */
  monthsUnconfirmed: number;
  /** まさ投下時間 (シーズン期間、開発+MTG) */
  masaHours: number;
  /** まさ1時間あたり請求額(推定) */
  revenuePerMasaHour: number | null;
  warnings: ProjectProfitabilityWarnings;
  members: ProjectProfitabilityMember[];
};

export type ProjectProfitabilitySnapshot = {
  storedAt: number;
  rows: ProjectProfitabilityRow[];
};

function computeRow(
  cycle: PlanCycleRow,
  projectName: string,
  billings: BillingRow[],
  memberMap: Map<string, string>,
  masaHours: number,
): ProjectProfitabilityRow {
  let externalPaidYen = 0;
  let retainedYen = 0;
  let grossDueYen = 0;
  let months = 0;
  let monthsUnconfirmed = 0;
  const memberAgg = new Map<
    string,
    { grossDueYen: number; paidYen: number; retainedYen: number; payoutExcluded: boolean }
  >();

  for (const billing of billings) {
    months += 1;
    if (String(billing.status ?? "").trim() === "not_started") monthsUnconfirmed += 1;
    const summary = asRecord(billing.reward_summary_json);
    if (!summary) continue;

    // シーズン全体の試算なので、未確定月 (not_started) の見込みも合算する。
    // 月次の cap 按分は「いつ払うか」でしかなく、シーズン総額は最初から決まっているため。
    externalPaidYen += Math.max(0, numberValue(summary.externalPayoutCapYen));
    retainedYen += Math.max(0, numberValue(summary.companyReserveYen));
    grossDueYen += Math.max(0, numberValue(summary.totalGrossDueYen));

    for (const raw of Array.isArray(summary.members) ? summary.members : []) {
      const member = asRecord(raw);
      if (!member) continue;
      const memberId = typeof member.memberId === "string" ? member.memberId : null;
      if (!memberId) continue;
      const agg = memberAgg.get(memberId) ?? {
        grossDueYen: 0,
        paidYen: 0,
        retainedYen: 0,
        payoutExcluded: false,
      };
      agg.grossDueYen += Math.max(0, numberValue(member.grossDueYen));
      agg.paidYen += Math.max(0, numberValue(member.totalPay));
      agg.retainedYen += Math.max(0, numberValue(member.companyReserveYen));
      if (member.payoutExcluded === true) agg.payoutExcluded = true;
      memberAgg.set(memberId, agg);
    }
  }

  const members: ProjectProfitabilityMember[] = [...memberAgg.entries()]
    .map(([memberId, agg]) => ({
      memberId,
      memberName: memberMap.get(memberId) ?? memberId,
      payoutExcluded: agg.payoutExcluded,
      grossDueYen: Math.round(agg.grossDueYen),
      paidYen: Math.round(agg.paidYen),
      retainedYen: Math.round(agg.retainedYen),
    }))
    .filter((m) => m.grossDueYen > 0 || m.paidYen > 0 || m.retainedYen > 0)
    .sort((a, b) => b.grossDueYen - a.grossDueYen);

  const seasonBudgetYen = Math.max(0, numberValue(cycle.budget_yen));
  const allocatedYen = externalPaidYen + retainedYen;
  const estimatedRevenueYen = Math.round(seasonBudgetYen / MEMBER_SHARE_RATE);

  return {
    planCycleId: cycle.plan_cycle_id || cycle.id,
    projectId: cycle.project_id,
    projectName,
    periodStartYm: cycle.period_start_ym ?? "",
    periodEndYm: cycle.period_end_ym ?? "",
    cycleStatus: cycle.status ?? "",
    seasonBudgetYen,
    estimatedRevenueYen,
    externalPaidYen: Math.round(externalPaidYen),
    retainedYen: Math.round(retainedYen),
    allocatedYen: Math.round(allocatedYen),
    retentionRate: seasonBudgetYen > 0 ? retainedYen / seasonBudgetYen : null,
    externalRate: seasonBudgetYen > 0 ? externalPaidYen / seasonBudgetYen : null,
    grossDueYen: Math.round(grossDueYen),
    demandBudgetRatio: seasonBudgetYen > 0 ? grossDueYen / seasonBudgetYen : null,
    months,
    monthsUnconfirmed,
    masaHours: Math.round(masaHours * 100) / 100,
    revenuePerMasaHour: masaHours > 0 ? estimatedRevenueYen / masaHours : null,
    warnings: {
      demandOverBudget:
        seasonBudgetYen > 0 && grossDueYen / seasonBudgetYen > DEMAND_OVER_BUDGET_THRESHOLD,
      noRewardCalc: seasonBudgetYen > 0 && grossDueYen === 0,
    },
    members,
  };
}

async function loadSnapshotFromDb(): Promise<ProjectProfitabilitySnapshot> {
  const service: ServiceClient = createAdminClient();

  const [cycleRows, billingRows, projectRows, memberRows, effortRows] = await Promise.all([
    fetchAllRows<PlanCycleRow>("value_plan_cycles", (from, to) =>
      service
        .from("value_plan_cycles")
        .select("id, plan_cycle_id, project_id, status, budget_yen, period_start_ym, period_end_ym")
        .order("project_id")
        .range(from, to)),
    fetchAllRows<BillingRow>("billing_cycles", (from, to) =>
      service
        .from("billing_cycles")
        .select("project_id, ym, status, reward_summary_json")
        .order("project_id")
        .order("ym")
        .range(from, to)),
    fetchAllRows<ProjectRow>("projects", (from, to) =>
      service.from("projects").select("project_id, project_name").order("project_id").range(from, to)),
    fetchAllRows<MemberRow>("members", (from, to) =>
      service.from("members").select("member_id, code_name, member_name").order("member_id").range(from, to)),
    fetchAllRows<EffortRow>("tally_weekly_effort_entries", (from, to) =>
      service
        .from("tally_weekly_effort_entries")
        .select("project_id, week_start, development_hours, meeting_hours")
        .eq("member_id", MASA_MEMBER_ID)
        .range(from, to)),
  ]);

  const projectNameMap = new Map<string, string>(
    projectRows.map((r) => [r.project_id, r.project_name || r.project_id]),
  );
  const memberMap = new Map<string, string>(
    memberRows.map((r) => [r.member_id, r.code_name || r.member_name || r.member_id]),
  );

  const billingsByProject = new Map<string, BillingRow[]>();
  for (const row of billingRows) {
    const list = billingsByProject.get(row.project_id) ?? [];
    list.push(row);
    billingsByProject.set(row.project_id, list);
  }
  const effortByProject = new Map<string, EffortRow[]>();
  for (const row of effortRows) {
    const list = effortByProject.get(row.project_id) ?? [];
    list.push(row);
    effortByProject.set(row.project_id, list);
  }

  const rows = cycleRows
    // 原資が入っていないシーズンは収益率を出せないので行にしない。
    .filter((c) => c.period_start_ym && c.period_end_ym && numberValue(c.budget_yen) > 0)
    .map((cycle) => {
      const start = cycle.period_start_ym as string;
      const end = cycle.period_end_ym as string;
      const billings = (billingsByProject.get(cycle.project_id) ?? []).filter(
        (b) => b.ym >= start && b.ym <= end,
      );
      const startDate = ymToStartDate(start);
      const endDate = ymToEndDate(end);
      const masaHours = (effortByProject.get(cycle.project_id) ?? [])
        .filter((e) => e.week_start >= startDate && e.week_start <= endDate)
        .reduce(
          (sum, e) =>
            sum + Math.max(0, numberValue(e.development_hours)) + Math.max(0, numberValue(e.meeting_hours)),
          0,
        );
      return computeRow(
        cycle,
        projectNameMap.get(cycle.project_id) ?? cycle.project_id,
        billings,
        memberMap,
        masaHours,
      );
    });

  // 進行中を上、その中で原資の大きい順。
  rows.sort((a, b) => {
    const aActive = a.cycleStatus === "active";
    const bActive = b.cycleStatus === "active";
    if (aActive !== bActive) return aActive ? -1 : 1;
    return b.seasonBudgetYen - a.seasonBudgetYen;
  });

  return { storedAt: Date.now(), rows };
}

/** 既定5分。月次締めの直後に確認したいときは環境変数で短縮する。 */
export const PROJECT_PROFITABILITY_CACHE_TTL_MS = Number(
  process.env.PROJECT_PROFITABILITY_CACHE_TTL_MS ?? 5 * 60 * 1000,
);

let snapshot: ProjectProfitabilitySnapshot | null = null;
let inflight: Promise<ProjectProfitabilitySnapshot> | null = null;

/** TTL 内はメモリから返し、同時アクセスは1回のロードに束ねる (single-flight)。 */
export async function loadProjectProfitabilitySnapshot(
  options?: { force?: boolean },
): Promise<ProjectProfitabilitySnapshot> {
  if (!options?.force && snapshot && Date.now() - snapshot.storedAt < PROJECT_PROFITABILITY_CACHE_TTL_MS) {
    return snapshot;
  }
  if (options?.force) inflight = null;
  if (!inflight) {
    const pending = loadSnapshotFromDb()
      .then((next) => {
        snapshot = next;
        return next;
      })
      .finally(() => {
        if (inflight === pending) inflight = null;
      });
    inflight = pending;
  }
  return inflight;
}

export function projectProfitabilityCacheAgeMs(): number | null {
  return snapshot ? Date.now() - snapshot.storedAt : null;
}

/** 月次締め・報酬再計算の直後に呼ぶ。 */
export function invalidateProjectProfitabilityCache(): void {
  snapshot = null;
  inflight = null;
}
