// PJ別 利益構造ダッシュボード — service_role 読み取り層。
//
// この画面が答える問い (2026-08-30 まさ):
//   「どのPJが儲かっていて、どのPJがまさの稼働で回っているか」
//
// ここでの「儲かっている」は **まさ自身の稼働を織り込んだうえで** の話。
// 現金が出ていかないだけの状態を利益と呼ばない。それはまさの労働の対価を
// 会社へ付け替えているだけで、まさの時間は有限だから。
//
//   まさ込み利益 = 会社に残る現金 − (まさの投下時間 × 時間単価)
//
// 時間単価は画面側で動かせる。だからこの層は **金額と時間までを返し、
// 単価を掛けた値は返さない**。単価はPJ横断で1つだけ使う (PJごとに変えると
// PJ間の比較へ配分設計の差が混ざる)。
//
// 【報酬モデルの前提】正本 pwa/manual/7-1-reward-calc-spec.md
//   請求額 R、契約バッファ B のシーズンで
//     配分原資 P = (R − B) × 65%  ... value_plan_cycles.budget_yen
//     35%枠     = (R − B) × 35%  ... AMD運営費30% + クローザー報酬5%
//   配分原資 P は、支払対象メンバーへの現金 (externalPayoutCapYen) と、
//   支払対象外メンバーへの非現金配賦 (companyReserveYen) に分かれる。
//   クローザーは全PJまさ (project_members.is_closer は13行すべて ID001) なので
//   35%枠も社外へは出ない。したがって社外へ出る現金は次の2つだけ:
//     - 契約バッファ (営業費用・旅費などの実費枠)
//     - 支払対象メンバーへの現金支払
//
// 【この画面が扱わないもの — まさ指摘 2026-08-30】
//   - ポイント (MS pt) と稼働需要 (grossDueYen)。どうMSを設計しても原資を超える
//     支出にはならないので、会社の収支には効かない。需要が原資のN倍という警報は
//     意味を持たないため作らない。
//   - 未払残 (stockYen)。月次の支払タイミングの差でしかなく、収益率にはノイズ。
//   - まさ以外のメンバーの投下時間。tally はまさ専用アプリで他メンバーの行が
//     1件も無い。無いものを推測で埋めない (まさ「りりあききよを差し引けないのは
//     全く問題ないよ」2026-08-30)。
//
// 【参照系キャッシュ】billing_cycles / value_plan_cycles は月次締めでしか更新されない。
// 全件をまとめて1回読み、プロセス内に5分持つ。規範: pwa/spec/5-10-reference-data-caching-current-spec.md
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** tally は まさ専用の週次記録アプリ。他メンバーの行は1件も存在しない。 */
const MASA_MEMBER_ID = "ID001";

/** 請求額のうちメンバー配分枠に回る比率。請求額を逆算するために使う。 */
const MEMBER_SHARE_RATE = 0.65;

/**
 * まさの時間単価の既定値 (円/時)。
 *
 * 根拠: OSがまさの労働へ実際に配賦している額 (members[].companyReserveYen の
 * シーズン合計) を、同じ期間のまさの投下時間で割った実績平均が 25,514円/時
 * (8,306,769円 / 325.6時間、2026-08-30 時点)。それを丸めた値。
 * PJ別では 2,344〜38,913円/時 とばらつくので、PJ横断で1つの単価に固定する。
 * 画面のスライダーで動かせる。
 */
export const DEFAULT_MASA_HOURLY_RATE_YEN = 25000;
export const MASA_HOURLY_RATE_MIN_YEN = 5000;
export const MASA_HOURLY_RATE_MAX_YEN = 60000;

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

// --- 年月 (YYYYMM) の計算 ---------------------------------------------------

/** "202604" → 24316。月数の引き算をするための通し番号。 */
function ymIndex(ym: string): number {
  return Number(ym.slice(0, 4)) * 12 + Number(ym.slice(4, 6));
}
/** 期間の月数。両端を含む。 */
function monthSpan(startYm: string, endYm: string): number {
  return Math.max(0, ymIndex(endYm) - ymIndex(startYm) + 1);
}
/** "202604" → "2026-04-01"。tally は week_start (日付) で持っているため。 */
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
/** JST の当月 "YYYYMM"。進行中PJの経過月数を数えるのに使う。 */
function currentYmJst(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

// --- DB 行 -----------------------------------------------------------------

type PlanCycleRow = {
  id: string;
  plan_cycle_id: string | null;
  project_id: string;
  status: string | null;
  budget_yen: number | string | null;
  period_start_ym: string | null;
  period_end_ym: string | null;
  buffer_breakdown_json: unknown;
};

type BillingRow = {
  project_id: string;
  ym: string;
  budget_buffer_amount: number | string | null;
  extra_budget_yen: number | string | null;
  reward_summary_json: unknown;
};

type ProjectRow = {
  project_id: string;
  project_name: string | null;
  status: string | null;
  fee_type: string | null;
  fee_amount: number | string | null;
  fee_payee: string | null;
  start_ym: string | null;
  end_ym: string | null;
};

type EffortRow = {
  project_id: string;
  week_start: string;
  development_hours: number | string | null;
  meeting_hours: number | string | null;
};

// --- 画面へ返す型 -----------------------------------------------------------

/**
 * 会社の売上があるシーズンのうち、報酬計算データが全月そろっているもの。
 * 金額の判断に使えるのはこの行だけ。
 */
export type CompanySeasonRow = {
  planCycleId: string;
  projectId: string;
  projectName: string;
  periodStartYm: string;
  periodEndYm: string;
  /** value_plan_cycles.status。active = 進行中、fixed = 確定済み */
  cycleStatus: string;
  months: number;
  /** 請求額(推定) = (本契約原資 + 別財布原資) ÷ 0.65 + 契約バッファ */
  revenueYen: number;
  /** 契約バッファ = 営業費用・旅費など、請求額から先取りされる実費枠 */
  contractBufferYen: number;
  /** 本契約のシーズン原資 = value_plan_cycles.budget_yen */
  regularPoolYen: number;
  /** 別財布 (cap_extra) の原資 = Σ billing_cycles.extra_budget_yen */
  extraPoolYen: number;
  /** 社外へ出る現金 = Σ externalPayoutCapYen (支払対象メンバーへの現金支払) */
  externalCashOutYen: number;
  /** 会社に残る現金 = 請求額 − 契約バッファ − 社外への現金支払 */
  companyCashLeftYen: number;
  /** シーズン期間に tally へ記録されているまさの投下時間 (開発 + MTG) */
  masaHours: number;
  /** 支払対象外メンバーへの非現金配賦 = Σ companyReserveYen。内訳の参考値 */
  nonCashAllocationYen: number;
};

/**
 * まさ個人へ直接支払われるPJ (projects.fee_payee = 'masa_personal')。
 * 会社の売上には入らないが、まさの時間がいくらの報酬になっているかは同じ問いなので並べる。
 */
export type PersonalFeeRow = {
  projectId: string;
  projectName: string;
  startYm: string;
  endYm: string;
  months: number;
  monthlyFeeYen: number;
  /** まさ個人への報酬総額 = 月額 × 月数 */
  personalIncomeYen: number;
  masaHours: number;
  /** 期間の終わりが projects.end_ym ではなく当月であること (= 進行中) */
  ongoing: boolean;
};

/** まさが時間を投じているのに、収入の記録がOSに1件も無いPJ。 */
export type UnfundedProjectRow = {
  projectId: string;
  projectName: string;
  masaHours: number;
};

/**
 * 報酬計算データがそろっていないシーズン。**金額を判断に使わせない**。
 * 未計算を「未配分の金額」として出すと、払い終わっている報酬を未払いに見せる
 * (まさ「報酬を渡すべき人には渡し終わってるよ。計算ができてないだけ」2026-08-30)。
 */
export type IncompleteSeasonRow = {
  planCycleId: string;
  projectId: string;
  projectName: string;
  periodStartYm: string;
  periodEndYm: string;
  cycleStatus: string;
  months: number;
  /** reward_summary_json.members が1人以上入っている月数 */
  monthsWithRewardCalc: number;
  /** シーズン原資が OS に登録されているか。false なら金額を一切出さない */
  hasSeasonPool: boolean;
  masaHours: number;
};

export type ProjectProfitabilitySnapshot = {
  storedAt: number;
  companySeasons: CompanySeasonRow[];
  personalFees: PersonalFeeRow[];
  unfundedProjects: UnfundedProjectRow[];
  incompleteSeasons: IncompleteSeasonRow[];
  /** tally に記録がある最初の週。これより前のまさの稼働はOSに存在しない */
  masaHoursRecordedFrom: string | null;
  defaultHourlyRateYen: number;
};

// --- 集計 -------------------------------------------------------------------

function sumMasaHours(rows: EffortRow[]): number {
  return rows.reduce(
    (sum, r) => sum + Math.max(0, numberValue(r.development_hours)) + Math.max(0, numberValue(r.meeting_hours)),
    0,
  );
}

function round1(hours: number): number {
  return Math.round(hours * 10) / 10;
}

async function loadSnapshotFromDb(): Promise<ProjectProfitabilitySnapshot> {
  const service: ServiceClient = createAdminClient();

  const [cycleRows, billingRows, projectRows, effortRows] = await Promise.all([
    fetchAllRows<PlanCycleRow>("value_plan_cycles", (from, to) =>
      service
        .from("value_plan_cycles")
        .select(
          "id, plan_cycle_id, project_id, status, budget_yen, period_start_ym, period_end_ym, buffer_breakdown_json",
        )
        .order("project_id")
        .range(from, to)),
    fetchAllRows<BillingRow>("billing_cycles", (from, to) =>
      service
        .from("billing_cycles")
        .select("project_id, ym, budget_buffer_amount, extra_budget_yen, reward_summary_json")
        .order("project_id")
        .order("ym")
        .range(from, to)),
    fetchAllRows<ProjectRow>("projects", (from, to) =>
      service
        .from("projects")
        .select("project_id, project_name, status, fee_type, fee_amount, fee_payee, start_ym, end_ym")
        .order("project_id")
        .range(from, to)),
    fetchAllRows<EffortRow>("tally_weekly_effort_entries", (from, to) =>
      service
        .from("tally_weekly_effort_entries")
        .select("project_id, week_start, development_hours, meeting_hours")
        .eq("member_id", MASA_MEMBER_ID)
        .range(from, to)),
  ]);

  const projectMap = new Map<string, ProjectRow>(projectRows.map((r) => [r.project_id, r]));
  const projectName = (projectId: string) =>
    projectMap.get(projectId)?.project_name || projectId;

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

  const masaHoursIn = (projectId: string, startYm: string, endYm: string) =>
    sumMasaHours(
      (effortByProject.get(projectId) ?? []).filter(
        (e) => e.week_start >= ymToStartDate(startYm) && e.week_start <= ymToEndDate(endYm),
      ),
    );

  const currentYm = currentYmJst();
  const companySeasons: CompanySeasonRow[] = [];
  const incompleteSeasons: IncompleteSeasonRow[] = [];
  /** シーズン行を1つでも持つPJ。収入の記録が無いPJを拾うのに使う。 */
  const projectsWithSeason = new Set<string>();

  for (const cycle of cycleRows) {
    const startYm = cycle.period_start_ym;
    const endYm = cycle.period_end_ym;
    if (!startYm || !endYm) continue;
    projectsWithSeason.add(cycle.project_id);

    const months = monthSpan(startYm, endYm);
    const billings = (billingsByProject.get(cycle.project_id) ?? []).filter(
      (b) => b.ym >= startYm && b.ym <= endYm,
    );

    let externalCashOutYen = 0;
    let nonCashAllocationYen = 0;
    let extraPoolYen = 0;
    let monthlyBufferYen = 0;
    let monthsWithRewardCalc = 0;

    for (const billing of billings) {
      monthlyBufferYen += Math.max(0, numberValue(billing.budget_buffer_amount));
      extraPoolYen += Math.max(0, numberValue(billing.extra_budget_yen));

      const summary = asRecord(billing.reward_summary_json);
      if (!summary) continue;
      // members が空の月は「報酬計算がまだ動いていない」。金額を足さない。
      const members = Array.isArray(summary.members) ? summary.members : [];
      if (members.length === 0) continue;
      monthsWithRewardCalc += 1;

      // externalPayoutCapYen / companyReserveYen は本契約と別財布の合算値。
      externalCashOutYen += Math.max(0, numberValue(summary.externalPayoutCapYen));
      nonCashAllocationYen += Math.max(0, numberValue(summary.companyReserveYen));
    }

    const regularPoolYen = Math.max(0, numberValue(cycle.budget_yen));
    // シーズン原資にバッファ内訳がある PJ は、そちらが正本 (7-1章: 月次側で二重控除しない)。
    const seasonBuffer = asRecord(cycle.buffer_breakdown_json);
    const contractBufferYen = seasonBuffer
      ? Math.max(0, numberValue(seasonBuffer.total))
      : monthlyBufferYen;

    const hasSeasonPool = regularPoolYen > 0;
    const masaHours = round1(masaHoursIn(cycle.project_id, startYm, endYm));

    const base = {
      planCycleId: cycle.plan_cycle_id || cycle.id,
      projectId: cycle.project_id,
      projectName: projectName(cycle.project_id),
      periodStartYm: startYm,
      periodEndYm: endYm,
      cycleStatus: cycle.status ?? "",
      months,
    };

    // 全月そろっている場合だけ、金額を判断に使える行にする。
    if (!hasSeasonPool || monthsWithRewardCalc < months) {
      incompleteSeasons.push({ ...base, monthsWithRewardCalc, hasSeasonPool, masaHours });
      continue;
    }

    const poolYen = regularPoolYen + extraPoolYen;
    const revenueYen = Math.round(poolYen / MEMBER_SHARE_RATE) + contractBufferYen;

    companySeasons.push({
      ...base,
      revenueYen,
      contractBufferYen,
      regularPoolYen,
      extraPoolYen,
      externalCashOutYen: Math.round(externalCashOutYen),
      companyCashLeftYen: Math.round(revenueYen - contractBufferYen - externalCashOutYen),
      masaHours,
      nonCashAllocationYen: Math.round(nonCashAllocationYen),
    });
  }

  // まさ個人へ直接支払われるPJ (会社の売上ではない)。
  const personalFees: PersonalFeeRow[] = [];
  for (const project of projectRows) {
    if (project.fee_payee !== "masa_personal") continue;
    const monthlyFeeYen = Math.max(0, numberValue(project.fee_amount));
    const startYm = project.start_ym;
    if (!startYm || monthlyFeeYen <= 0) continue;

    // end_ym が無い (または未来の) 進行中PJは当月までを数える。
    const closedEndYm = project.end_ym && project.end_ym <= currentYm ? project.end_ym : null;
    const ongoing = closedEndYm === null;
    const endYm = closedEndYm ?? currentYm;
    if (endYm < startYm) continue;
    const months = monthSpan(startYm, endYm);

    personalFees.push({
      projectId: project.project_id,
      projectName: projectName(project.project_id),
      startYm,
      endYm,
      months,
      monthlyFeeYen,
      personalIncomeYen: monthlyFeeYen * months,
      masaHours: round1(masaHoursIn(project.project_id, startYm, endYm)),
      ongoing,
    });
  }
  const personalFeeProjects = new Set(personalFees.map((r) => r.projectId));

  // まさが時間を投じているのに、収入の記録が1件も無いPJ。
  const unfundedProjects: UnfundedProjectRow[] = [];
  for (const [projectId, rows] of effortByProject) {
    if (projectsWithSeason.has(projectId) || personalFeeProjects.has(projectId)) continue;
    const masaHours = round1(sumMasaHours(rows));
    if (masaHours <= 0) continue;
    unfundedProjects.push({ projectId, projectName: projectName(projectId), masaHours });
  }

  // 並び順は画面側で単価を掛けてから決める。ここでは規模の大きい順に置く。
  companySeasons.sort((a, b) => b.companyCashLeftYen - a.companyCashLeftYen);
  personalFees.sort((a, b) => b.personalIncomeYen - a.personalIncomeYen);
  unfundedProjects.sort((a, b) => b.masaHours - a.masaHours);
  incompleteSeasons.sort((a, b) => a.projectId.localeCompare(b.projectId));

  const masaHoursRecordedFrom = effortRows.length
    ? effortRows.reduce((min, r) => (r.week_start < min ? r.week_start : min), effortRows[0].week_start)
    : null;

  return {
    storedAt: Date.now(),
    companySeasons,
    personalFees,
    unfundedProjects,
    incompleteSeasons,
    masaHoursRecordedFrom,
    defaultHourlyRateYen: DEFAULT_MASA_HOURLY_RATE_YEN,
  };
}

// --- プロセス内キャッシュ ----------------------------------------------------

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
