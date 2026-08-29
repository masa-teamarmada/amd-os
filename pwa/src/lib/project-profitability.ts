// PJ別 利益構造ダッシュボード — service_role 読み取り層。
//
// 「どのPJが儲かっていて、どのPJがまさの持ち出しで回っているか」を年単位で判定するための集計。
// billing_cycles.reward_summary_json (月次報酬計算のスナップショット) をそのまま合算する。
// season-pl.ts のような plan_cycle 単位の厳密な検算 (バッファ・pt単価・stock収束) はしない。
// この画面の目的は「配分枠に対して需要が過剰か」「まさが自分の配分を放棄していないか」を
// 年単位でざっくり見張ることで、シーズン内の厳密な整合性は /admin/season-pl の担当。
//
// 【参照系キャッシュ】billing_cycles は月次締め処理でしか更新されない参照系。
// 年単位でテーブル全体をまとめて読み、プロセス内に5分持つ (同時アクセスは1本へ束ねる)。
// 規範: pwa/spec/5-10-reference-data-caching-current-spec.md
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const MASA_MEMBER_ID = "ID001";
/** メンバー原資の按分比率。season-pl.ts の MEMBER_SHARE_RATE と一致させる。 */
const CAP_RATE = 0.65;
/** 需要/枠 比率がこれを超えたら「配分枠に対して稼働が過剰」警報。 */
const CAP_OVERAGE_THRESHOLD = 1.5;
/** まさの grossDueYen>0 かつ totalPay=0 が何ヶ月連続したら持ち出し警報とするか。 */
const PAYOUT_GAP_MIN_MONTHS = 3;
/** billing_cycles を実績とみなす status。design/season_budget_actual.md 相当の未来枠は除く。 */
const FUTURE_BILLING_STATUSES = new Set(["not_started"]);

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

type BillingRow = {
  project_id: string;
  ym: string;
  status: string | null;
  budget_yen: number | string | null;
  extra_budget_yen: number | string | null;
  reward_summary_json: unknown;
  payment_confirmed_at: string | null;
};

type ProjectRow = {
  project_id: string;
  project_name: string | null;
};

type MemberRow = {
  member_id: string;
  code_name: string | null;
  member_name: string | null;
};

type EffortRow = {
  project_id: string;
  week_start: string;
  development_hours: number | string | null;
  meeting_hours: number | string | null;
};

export type ProjectProfitabilityMember = {
  memberId: string;
  memberName: string;
  /** シーズン累計の稼働需要額 (cap前の請求可能額、Σ grossDueYen) */
  grossDueYen: number;
  /** シーズン累計の実支払額 (Σ totalPay) */
  paidYen: number;
  /** 差額 = 稼働需要 − 実支払。プラスが大きいほど「働いた分より少なくしか受け取っていない」 */
  deltaYen: number;
};

export type ProjectProfitabilityWarnings = {
  /** まさの grossDueYen>0 かつ totalPay=0 が3ヶ月以上連続 = 自分の配分を放棄してメンバー分を捻出している */
  payoutGap: boolean;
  /** 対象期間内で観測できた最長の連続月数 */
  payoutGapMonths: number;
  /** 需要/枠 比率が1.5倍を超えた = 配分枠に対して稼働が過剰 */
  capOverage: boolean;
};

export type ProjectProfitabilityRow = {
  projectId: string;
  projectName: string;
  /** 売上 = Σ(budget_yen + extra_budget_yen)、実績月のみ */
  billedYen: number;
  /** 外部メンバー支払 = Σ members[].totalPay、実績月のみ */
  externalPaidYen: number;
  /** 会社・役員留保 = Σ companyReserveYen、実績月のみ */
  officerReserveYen: number;
  /** 稼働需要総額 = Σ totalGrossDueYen (cap前の請求可能稼働の総額)、実績月のみ */
  grossDueYen: number;
  /** 粗利率 = (売上 − 外部メンバー支払) ÷ 売上。売上0ならnull */
  grossMarginRate: number | null;
  /** 需要/枠 比率 = 稼働需要総額 ÷ (売上 × 0.65)。売上0ならnull */
  demandCapRatio: number | null;
  /** まさ投下時間 (開発+MTG、tally_weekly_effort_entries) */
  masaHours: number;
  /** まさ時間あたり売上 = 売上 ÷ まさ投下時間。0時間ならnull */
  revenuePerMasaHour: number | null;
  /** 実績として集計した月数 (reward_summary_json 有り かつ status が未来枠でない) */
  monthsActual: number;
  /** 未来の計画月として除外した月数 */
  monthsPlanned: number;
  warnings: ProjectProfitabilityWarnings;
  /** 年合計のメンバー別内訳 (行クリックの明細用) */
  members: ProjectProfitabilityMember[];
};

export type ProjectProfitabilitySnapshot = {
  year: number;
  storedAt: number;
  rows: ProjectProfitabilityRow[];
};

type MonthlyMasaState = { ym: string; grossDue: number; paid: number };

function computePayoutGap(monthly: MonthlyMasaState[]): { payoutGap: boolean; payoutGapMonths: number } {
  const sorted = [...monthly].sort((a, b) => a.ym.localeCompare(b.ym));
  let longest = 0;
  let current = 0;
  for (const m of sorted) {
    const isGapMonth = m.grossDue > 0 && m.paid === 0;
    current = isGapMonth ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return { payoutGap: longest >= PAYOUT_GAP_MIN_MONTHS, payoutGapMonths: longest };
}

function computeRow(
  projectId: string,
  projectName: string,
  billings: BillingRow[],
  memberMap: Map<string, string>,
  masaHours: number,
): ProjectProfitabilityRow {
  let billedYen = 0;
  let externalPaidYen = 0;
  let officerReserveYen = 0;
  let grossDueYen = 0;
  let monthsActual = 0;
  let monthsPlanned = 0;
  const memberAgg = new Map<string, { grossDueYen: number; paidYen: number }>();
  const masaMonthly: MonthlyMasaState[] = [];

  for (const billing of billings) {
    const isFutureStatus = FUTURE_BILLING_STATUSES.has(String(billing.status ?? "").trim());
    const summary = asRecord(billing.reward_summary_json);
    if (isFutureStatus || !summary) {
      monthsPlanned += 1;
      continue;
    }
    monthsActual += 1;
    billedYen += Math.max(0, numberValue(billing.budget_yen)) + Math.max(0, numberValue(billing.extra_budget_yen));
    externalPaidYen += Math.max(0, numberValue(summary.totalPaySum));
    officerReserveYen += Math.max(0, numberValue(summary.companyReserveYen));
    grossDueYen += Math.max(0, numberValue(summary.totalGrossDueYen));

    const members = Array.isArray(summary.members) ? summary.members : [];
    let masaGrossDueThisMonth = 0;
    let masaPaidThisMonth = 0;
    for (const raw of members) {
      const member = asRecord(raw);
      if (!member) continue;
      const memberId = typeof member.memberId === "string" ? member.memberId : null;
      if (!memberId) continue;
      const memberGrossDue = Math.max(0, numberValue(member.grossDueYen));
      const memberPaid = Math.max(0, numberValue(member.totalPay));
      const agg = memberAgg.get(memberId) ?? { grossDueYen: 0, paidYen: 0 };
      agg.grossDueYen += memberGrossDue;
      agg.paidYen += memberPaid;
      memberAgg.set(memberId, agg);
      if (memberId === MASA_MEMBER_ID) {
        masaGrossDueThisMonth = memberGrossDue;
        masaPaidThisMonth = memberPaid;
      }
    }
    masaMonthly.push({ ym: billing.ym, grossDue: masaGrossDueThisMonth, paid: masaPaidThisMonth });
  }

  const members: ProjectProfitabilityMember[] = [...memberAgg.entries()]
    .map(([memberId, agg]) => ({
      memberId,
      memberName: memberMap.get(memberId) ?? memberId,
      grossDueYen: Math.round(agg.grossDueYen),
      paidYen: Math.round(agg.paidYen),
      deltaYen: Math.round(agg.grossDueYen - agg.paidYen),
    }))
    .sort((a, b) => b.grossDueYen - a.grossDueYen);

  const grossMarginRate = billedYen > 0 ? (billedYen - externalPaidYen) / billedYen : null;
  const capBaseYen = billedYen * CAP_RATE;
  const demandCapRatio = capBaseYen > 0 ? grossDueYen / capBaseYen : null;
  const revenuePerMasaHour = masaHours > 0 ? billedYen / masaHours : null;

  const { payoutGap, payoutGapMonths } = computePayoutGap(masaMonthly);
  const capOverage = demandCapRatio !== null && demandCapRatio > CAP_OVERAGE_THRESHOLD;

  return {
    projectId,
    projectName,
    billedYen: Math.round(billedYen),
    externalPaidYen: Math.round(externalPaidYen),
    officerReserveYen: Math.round(officerReserveYen),
    grossDueYen: Math.round(grossDueYen),
    grossMarginRate,
    demandCapRatio,
    masaHours: Math.round(masaHours * 100) / 100,
    revenuePerMasaHour,
    monthsActual,
    monthsPlanned,
    warnings: { payoutGap, payoutGapMonths, capOverage },
    members,
  };
}

async function loadSnapshotFromDb(year: number): Promise<ProjectProfitabilitySnapshot> {
  const service: ServiceClient = createAdminClient();
  const ymFrom = `${year}01`;
  const ymTo = `${year}12`;
  const dateFrom = `${year}-01-01`;
  const dateTo = `${year}-12-31`;

  const [billingRows, projectRows, memberRows, effortRows] = await Promise.all([
    fetchAllRows<BillingRow>("billing_cycles", (from, to) =>
      service
        .from("billing_cycles")
        .select(
          "project_id, ym, status, budget_yen, extra_budget_yen, reward_summary_json, payment_confirmed_at",
        )
        .gte("ym", ymFrom)
        .lte("ym", ymTo)
        .order("project_id", { ascending: true })
        .order("ym", { ascending: true })
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
        .gte("week_start", dateFrom)
        .lte("week_start", dateTo)
        .range(from, to)),
  ]);

  const projectNameMap = new Map<string, string>(
    projectRows.map((row) => [row.project_id, row.project_name || row.project_id]),
  );
  const memberMap = new Map<string, string>(
    memberRows.map((row) => [row.member_id, row.code_name || row.member_name || row.member_id]),
  );

  const billingsByProject = new Map<string, BillingRow[]>();
  for (const row of billingRows) {
    const list = billingsByProject.get(row.project_id) ?? [];
    list.push(row);
    billingsByProject.set(row.project_id, list);
  }

  const masaHoursByProject = new Map<string, number>();
  for (const row of effortRows) {
    const hours = Math.max(0, numberValue(row.development_hours)) + Math.max(0, numberValue(row.meeting_hours));
    masaHoursByProject.set(row.project_id, (masaHoursByProject.get(row.project_id) ?? 0) + hours);
  }

  // 対象年に billing_cycles が1行でもある PJ だけを行として出す (完全未稼働PJはノイズになる)。
  const projectIds = [...billingsByProject.keys()].sort();
  const rows = projectIds.map((projectId) =>
    computeRow(
      projectId,
      projectNameMap.get(projectId) ?? projectId,
      billingsByProject.get(projectId) ?? [],
      memberMap,
      masaHoursByProject.get(projectId) ?? 0,
    ),
  );

  // 警報ありを上、次に売上の大きい順。
  rows.sort((a, b) => {
    const aWarn = a.warnings.payoutGap || a.warnings.capOverage;
    const bWarn = b.warnings.payoutGap || b.warnings.capOverage;
    if (aWarn !== bWarn) return aWarn ? -1 : 1;
    return b.billedYen - a.billedYen;
  });

  return { year, storedAt: Date.now(), rows };
}

/** 既定5分。日次締め処理の直後に確認したいときは環境変数で短縮する。 */
export const PROJECT_PROFITABILITY_CACHE_TTL_MS = Number(
  process.env.PROJECT_PROFITABILITY_CACHE_TTL_MS ?? 5 * 60 * 1000,
);

const snapshots = new Map<number, ProjectProfitabilitySnapshot>();
const inflight = new Map<number, Promise<ProjectProfitabilitySnapshot>>();

/** TTL 内はメモリから返し、同時アクセスは1回のロードに束ねる (single-flight)。 */
export async function loadProjectProfitabilitySnapshot(
  year: number,
  options?: { force?: boolean },
): Promise<ProjectProfitabilitySnapshot> {
  const cached = snapshots.get(year);
  if (!options?.force && cached && Date.now() - cached.storedAt < PROJECT_PROFITABILITY_CACHE_TTL_MS) {
    return cached;
  }
  if (options?.force) inflight.delete(year);
  let pending = inflight.get(year);
  if (!pending) {
    pending = loadSnapshotFromDb(year)
      .then((snapshot) => {
        snapshots.set(year, snapshot);
        return snapshot;
      })
      .finally(() => {
        if (inflight.get(year) === pending) inflight.delete(year);
      });
    inflight.set(year, pending);
  }
  return pending;
}

export function projectProfitabilityCacheAgeMs(year: number): number | null {
  const cached = snapshots.get(year);
  return cached ? Date.now() - cached.storedAt : null;
}

/** 月次締め処理・報酬再計算の直後に呼ぶ。引数なしで全年度分。 */
export function invalidateProjectProfitabilityCache(year?: number): void {
  if (year === undefined) {
    snapshots.clear();
    inflight.clear();
    return;
  }
  snapshots.delete(year);
  inflight.delete(year);
}
