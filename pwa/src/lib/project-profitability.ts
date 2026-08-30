// PJ別 利益構造ダッシュボード — service_role 読み取り層。
//
// この画面が答える問い:
//   「配分枠のうち、どれだけが外部への現金支払として出ていき、どれだけが会社に残ったか」
//
// 【報酬モデルの前提】正本 pwa/manual/7-1-reward-calc-spec.md
//   - 請求額 × 65% が PJ メンバー配分枠 (= billing_cycles.budget_yen)。残り35%は
//     AMD運営費30% + クローザー報酬5% の外枠で、reward_summary_json には入らない。
//   - メンバーは MS のポイントを消化して稼働需要 (grossDueYen) を発生させ、配分枠を按分する。
//   - `payoutExcluded` (= members.exclude_from_payout_notice) のメンバーへ按分された分は
//     現金支払されず `companyReserveYen` として会社に残る。まさはこの区分。
//   - つまり **まさがポイントを多く消化するほど、外部メンバーへ配る枠が減り、会社に残る額が増える**。
//     まさの現金支払が0円なのは設計どおりで、放棄でも持ち出しでもない。
//
// 【この画面で使う列の対応】
//   配分枠     = budget_yen + extra_budget_yen        (請求額そのものではない。65%後の額)
//   実効枠     = effectiveCapBudgetYen                 (前月からの未使用枠繰越を含む、実際の按分上限)
//   外部支払   = externalPayoutCapYen                  (支払対象メンバーへ実際に出た現金)
//   会社に残る = companyReserveYen                     (支払対象外メンバーへの非現金配賦)
//   稼働需要   = totalGrossDueYen                      (cap前の請求可能稼働の総額)
//
// 【参照系キャッシュ】billing_cycles は月次締め処理でしか更新されない参照系。
// 年単位でまとめて読み、プロセス内に5分持つ (同時アクセスは1本へ束ねる)。
// 規範: pwa/spec/5-10-reference-data-caching-current-spec.md
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const MASA_MEMBER_ID = "ID001";
/** 請求額のうちメンバー配分枠に回る比率。請求額を逆算するためだけに使う。 */
const MEMBER_SHARE_RATE = 0.65;
/** 稼働需要が実効枠のこの倍数を超えたら「枠に対して稼働が過剰」警報。 */
const DEMAND_OVER_CAP_THRESHOLD = 1.5;
/** billing_cycles を実績とみなさない status。未来の計画月を実績に混ぜない。 */
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

type ProjectRow = { project_id: string; project_name: string | null };
type MemberRow = { member_id: string; code_name: string | null; member_name: string | null };
type EffortRow = {
  project_id: string;
  development_hours: number | string | null;
  meeting_hours: number | string | null;
};

export type ProjectProfitabilityMember = {
  memberId: string;
  memberName: string;
  /** 支払対象外 (= 現金支払されず会社に残る区分)。まさはここ。 */
  payoutExcluded: boolean;
  /** 稼働需要額 (cap前にそのメンバーが本来もらえる額) */
  grossDueYen: number;
  /** 現金で支払われた額 */
  paidYen: number;
  /** 非現金配賦 = 会社に残った額 */
  retainedYen: number;
};

export type ProjectProfitabilityWarnings = {
  /** 稼働需要が実効枠の1.5倍を超えた = 枠に対して稼働が過剰 */
  capOverage: boolean;
  /** 配分枠はあるのに稼働需要が0 = 報酬計算がまだ回っていない */
  noRewardCalc: boolean;
};

export type ProjectProfitabilityRow = {
  projectId: string;
  projectName: string;
  /** 配分枠 = Σ(budget_yen + extra_budget_yen)。請求額の65%であって請求額ではない。 */
  capBudgetYen: number;
  /** 実効枠 = Σ effectiveCapBudgetYen。前月からの未使用枠繰越を含む実際の按分上限。 */
  effectiveCapYen: number;
  /** 請求額(推定) = 配分枠 ÷ 0.65。契約バッファがある月はやや過大に出る。 */
  estimatedRevenueYen: number;
  /** 外部メンバーへ現金で出た額 = Σ externalPayoutCapYen */
  externalPaidYen: number;
  /** 会社に残った配分 = Σ companyReserveYen (支払対象外メンバーへの非現金配賦) */
  retainedYen: number;
  /** 稼働需要総額 = Σ totalGrossDueYen */
  grossDueYen: number;
  /** 会社に残った率 = 会社に残った配分 ÷ 配分枠。高いほど現金が出ていっていない。 */
  retentionRate: number | null;
  /** 働いた分 ÷ 配れる額。1.0を超えるほど、配れる額に対して仕事が多い。 */
  demandCapRatio: number | null;
  /**
   * 外部メンバーへの未払残（最新の実績月の残高スナップショット）。
   * 配れる上限に当たって今月配りきれなかった分が翌月へ送られる。7-1章のとおり
   * stockYen は残高なので月をまたいで合計しない。最新の実績月の値だけを読む。
   */
  unpaidExternalYen: number;
  /** まさ投下時間 (開発+MTG) */
  masaHours: number;
  /** まさ時間あたり請求額(推定) */
  revenuePerMasaHour: number | null;
  monthsActual: number;
  monthsPlanned: number;
  warnings: ProjectProfitabilityWarnings;
  members: ProjectProfitabilityMember[];
};

export type ProjectProfitabilitySnapshot = {
  year: number;
  storedAt: number;
  rows: ProjectProfitabilityRow[];
};

function computeRow(
  projectId: string,
  projectName: string,
  billings: BillingRow[],
  memberMap: Map<string, string>,
  masaHours: number,
): ProjectProfitabilityRow {
  let capBudgetYen = 0;
  let effectiveCapYen = 0;
  let externalPaidYen = 0;
  let retainedYen = 0;
  let grossDueYen = 0;
  let monthsActual = 0;
  let monthsPlanned = 0;
  let unpaidExternalYen = 0;
  const memberAgg = new Map<
    string,
    { grossDueYen: number; paidYen: number; retainedYen: number; payoutExcluded: boolean }
  >();

  for (const billing of billings) {
    const isFutureStatus = FUTURE_BILLING_STATUSES.has(String(billing.status ?? "").trim());
    const summary = asRecord(billing.reward_summary_json);
    if (isFutureStatus || !summary) {
      monthsPlanned += 1;
      continue;
    }
    monthsActual += 1;
    capBudgetYen += Math.max(0, numberValue(billing.budget_yen)) + Math.max(0, numberValue(billing.extra_budget_yen));
    effectiveCapYen += Math.max(0, numberValue(summary.effectiveCapBudgetYen));
    externalPaidYen += Math.max(0, numberValue(summary.externalPayoutCapYen));
    retainedYen += Math.max(0, numberValue(summary.companyReserveYen));
    grossDueYen += Math.max(0, numberValue(summary.totalGrossDueYen));

    const members = Array.isArray(summary.members) ? summary.members : [];
    // 残高なので加算しない。実績月を新しい順に上書きし、最後に残った値が最新月の未払残になる。
    let monthUnpaidExternal = 0;
    for (const raw of members) {
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
      else monthUnpaidExternal += Math.max(0, numberValue(member.stockYen));
      memberAgg.set(memberId, agg);
    }
    unpaidExternalYen = monthUnpaidExternal;
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

  const retentionRate = capBudgetYen > 0 ? retainedYen / capBudgetYen : null;
  const demandCapRatio = effectiveCapYen > 0 ? grossDueYen / effectiveCapYen : null;
  const estimatedRevenueYen = Math.round(capBudgetYen / MEMBER_SHARE_RATE);
  const revenuePerMasaHour = masaHours > 0 ? estimatedRevenueYen / masaHours : null;

  return {
    projectId,
    projectName,
    capBudgetYen: Math.round(capBudgetYen),
    effectiveCapYen: Math.round(effectiveCapYen),
    estimatedRevenueYen,
    externalPaidYen: Math.round(externalPaidYen),
    retainedYen: Math.round(retainedYen),
    grossDueYen: Math.round(grossDueYen),
    retentionRate,
    demandCapRatio,
    unpaidExternalYen: Math.round(unpaidExternalYen),
    masaHours: Math.round(masaHours * 100) / 100,
    revenuePerMasaHour,
    monthsActual,
    monthsPlanned,
    warnings: {
      capOverage: demandCapRatio !== null && demandCapRatio > DEMAND_OVER_CAP_THRESHOLD,
      noRewardCalc: capBudgetYen > 0 && grossDueYen === 0,
    },
    members,
  };
}

async function loadSnapshotFromDb(year: number): Promise<ProjectProfitabilitySnapshot> {
  const service: ServiceClient = createAdminClient();
  const ymFrom = `${year}01`;
  const ymTo = `${year}12`;

  const [billingRows, projectRows, memberRows, effortRows] = await Promise.all([
    fetchAllRows<BillingRow>("billing_cycles", (from, to) =>
      service
        .from("billing_cycles")
        .select("project_id, ym, status, budget_yen, extra_budget_yen, reward_summary_json, payment_confirmed_at")
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
        .select("project_id, development_hours, meeting_hours")
        .eq("member_id", MASA_MEMBER_ID)
        .gte("week_start", `${year}-01-01`)
        .lte("week_start", `${year}-12-31`)
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

  // 対象年に billing_cycles が1行でもある PJ だけを行にする (完全未稼働PJはノイズ)。
  const rows = [...billingsByProject.keys()]
    .sort()
    .map((projectId) =>
      computeRow(
        projectId,
        projectNameMap.get(projectId) ?? projectId,
        billingsByProject.get(projectId) ?? [],
        memberMap,
        masaHoursByProject.get(projectId) ?? 0,
      ),
    )
    // 配分枠も稼働需要も無い月だけの PJ は出さない。
    .filter((row) => row.capBudgetYen > 0 || row.grossDueYen > 0);

  // 配分枠の大きい順。警報は色で出すので並び順には混ぜない。
  rows.sort((a, b) => b.capBudgetYen - a.capBudgetYen);

  return { year, storedAt: Date.now(), rows };
}

/** 既定5分。月次締めの直後に確認したいときは環境変数で短縮する。 */
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

/** 月次締め・報酬再計算の直後に呼ぶ。引数なしで全年度分。 */
export function invalidateProjectProfitabilityCache(year?: number): void {
  if (year === undefined) {
    snapshots.clear();
    inflight.clear();
    return;
  }
  snapshots.delete(year);
  inflight.delete(year);
}
