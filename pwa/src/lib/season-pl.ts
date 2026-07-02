/**
 * シーズン予実表 (Season Budget vs Actual) — 集計純関数
 *
 * 設計正本: pwa/design/season_budget_actual.md
 *
 * 1 PJ × 1 plan cycle = 1 予実表。「そのシーズンで合計いくら入ってきて、内訳がどう
 * なってて、差し引きいくらになるか」を全PJで常時確認できる予実表のサーバ側計算。
 *
 * このモジュールは純粋な集計ロジック (DB I/O は呼び出し側)。`reward-summary.ts` の月次
 * 報酬集計 (buildRewardSummary) を cycle 全期間に集約して、収入 / バッファ内訳 / メンバー
 * 原資 / AMD マージン / メンバー別 pt 比予実 / 検算フラグ を返す。
 *
 * ◆ 検知したい歪み (この表の目的):
 *  - 閉じない:      バッファ + 原資 + マージン ≠ 請求額 → 設定ミス
 *  - 未割当pt:      Σ(earnedPt) < total_points → MS未設定 (SX 0.93pt の穴)
 *  - 原資≠Σ月cap:   value_plan_cycles.budget_yen ≠ Σ billing_cycles.budget_yen → cap/原資不整合 (ZMP)
 *  - pt単価過大:    pt単価 ≠ (請求額−バッファ)×65% ÷ total_points → バッファ未反映バグ
 *  - 役員取りこぼし: 最終月で役員stockが0に収束しない → 役員繰越が効いてない
 */

import {
  buildRewardSummary,
  type RewardLiabilityOffsetInput,
  type RewardSummary,
} from "@/lib/reward-summary";
import { contractBackedClientAmount } from "@/lib/contract-money";
import {
  pointBasisForMilestonePeriod,
  regularPointBasisForCycle,
  roundPt,
  totalPointBasisForCycle,
} from "@/lib/season-point-basis";

// pt単価原資の按分比率。報酬計算正本と一致させる: 原資 = (請求額 − バッファ) × MEMBER_SHARE_RATE。
const MEMBER_SHARE_RATE = 0.65;
const AMD_MARGIN_RATE = 0.35;

// 別財布 (cap_extra) プールに属する MS の tag 集合。reward-summary.ts の CAP_EXTRA_MILESTONE_TAGS と一致させる。
const CAP_EXTRA_MILESTONE_TAGS = new Set(["cap_extra", "extra_contract", "contract_extra", "cap_outside", "uncapped"]);
function isCapExtraTag(tag: unknown): boolean {
  return CAP_EXTRA_MILESTONE_TAGS.has(String(tag ?? "").trim().toLowerCase());
}

function effectiveMilestonePoints(ms: Pick<MilestoneInput, "points" | "tag" | "period_start_ym" | "target_ym">): number {
  if (isCapExtraTag(ms.tag)) {
    const periodPoints = pointBasisForMilestonePeriod(ms);
    if (periodPoints > 0) return periodPoints;
  }
  return roundPt(Math.max(0, numberValue(ms.points)));
}

// 「閉じ検算」「原資=Σ月cap」「pt単価」の許容誤差 (丸め誤差吸収, 円)。
const CLOSE_TOLERANCE_YEN = 5;
// 役員 stock 収束許容誤差 (円)。
const OFFICER_STOCK_TOLERANCE_YEN = 5;
// 未割当 pt 許容誤差 (pt)。MS 0.93pt のような穴をここで検出する。
const UNASSIGNED_PT_TOLERANCE = 0.01;

export type PlanCycleInput = {
  plan_cycle_id: string;
  project_id: string;
  status?: string | null;
  budget_yen?: number | string | null;
  total_points?: number | string | null;
  period_start_ym: string;
  period_end_ym: string;
  buffer_breakdown_json?: unknown;
};

export type ProjectInput = {
  project_id: string;
  project_name?: string | null;
  client_name?: string | null;
  fee_type?: string | null;
  fee_amount?: number | string | null;
  start_ym?: string | null;
  end_ym?: string | null;
  contract_terms_json?: unknown;
};

export type BillingInput = {
  project_id: string;
  ym: string;
  status?: string | null;
  budget_yen?: number | string | null;
  budget_reported_amount?: number | string | null;
  budget_buffer_amount?: number | string | null;
  /** 別財布 (cap_extra) の当月支払上限。NULL=未設定 / 0=全額繰越 / N=上限N円 (設計 §5.1) */
  extra_budget_yen?: number | string | null;
  reward_summary_json?: unknown;
  payment_confirmed_at?: string | null;
};

export type MilestoneInput = {
  milestone_id: string;
  title?: string | null;
  points?: number | string | null;
  tag?: string | null;
  goal_level?: string | null;
  success_criteria?: string | null;
  sort_order?: number | string | null;
  period_start_ym?: string | null;
  target_ym?: string | null;
};

export type ProgressInput = {
  milestone_key: string;
  ym: string;
  progress_pct?: number | string | null;
  consumed_pt?: number | string | null;
  source?: string | null;
};

export type ResponsibilityInput = {
  milestone_id: string;
  member_id: string;
  share?: number | string | null;
};

export type MemberInput = {
  member_id: string;
  code_name?: string | null;
  member_name?: string | null;
  is_officer?: boolean | null;
  exclude_from_payout_notice?: boolean | null;
};

export type RewardLiabilityOffset = RewardLiabilityOffsetInput;

export type BufferItem = { label: string; amount: number };

export type SeasonPlMember = {
  memberId: string;
  memberName: string;
  isOfficer: boolean;
  /** 役員=会社留保 / 非役員=現金支払 (支払通知書区分) */
  reserveKind: "cash" | "company_reserve";
  /** シーズン累計の獲得pt (実績消化分) */
  earnedPt: number;
  /** うち本契約 (regular) プールの獲得pt */
  regularEarnedPt: number;
  /** うち別財布 (cap_extra) プールの獲得pt */
  extraEarnedPt: number;
  /** pt比予算取り分 = regularEarnedPt × regular単価 + extraEarnedPt × extra単価 (別財布プール分離) */
  budgetShareYen: number;
  /** うち別財布 (cap_extra) プール由来の予算取り分。0 なら本契約のみ */
  extraBudgetShareYen: number;
  /** シーズン累計の実支払 (非役員=現金 / 役員=会社留保) */
  paidYen: number;
  /** 最終月末の繰越stock (= 未払い債務)。最終的に 0 に収束するのが正 */
  finalStockYen: number;
  /** 差 (実支払+stock − 予算取り分)。最終月で 0 が正 (= pt比に収束) */
  convergenceDeltaYen: number;
};

export type SeasonPlChecks = {
  /** バッファ + 原資 + マージン == 請求額 か */
  closes: boolean;
  closeDeltaYen: number;
  /**
   * pt単価分母 (total_points) が MS で全部裏打ちされているか。
   * 未割当pt = total_points − Σ(MS points, goal_level≠monthly)。
   * > 0 なら「pt単価は total_points で割っているのに、その pt を消化する MS が足りない」=
   * MS未設定の穴 (SX 120pt 設定なのに MS は 119pt = 1pt 穴 のような歪み)。
   * pt が宙に浮くと、消化されないシーズン末まで原資が配り切れない構造になる。
   */
  ptFullyAssigned: boolean;
  unassignedPt: number;
  /**
   * 消化が進んだのに担当者 (milestone_responsibility) が居ない MS が無いか。
   * share 合計が 0 の MS に points があると、その pt は誰の earnedPt にもならず原資が宙に浮く。
   */
  unownedMilestones: string[];
  /** value_plan_cycles.budget_yen == Σ billing_cycles.budget_yen か */
  budgetMatchesMonthlyCaps: boolean;
  budgetVsMonthlyCapsDeltaYen: number;
  /** pt単価 == (請求額−バッファ)×65% ÷ total_points か */
  ptUnitConsistent: boolean;
  ptUnitExpected: number;
  ptUnitDeltaYen: number;
  /** 最終月で役員stockが0に収束するか */
  officerStockConverges: boolean;
  officerFinalStockYen: number;
};

export type SeasonPl = {
  planCycleId: string;
  projectId: string;
  projectName: string;
  clientName: string;
  status: string;
  periodStartYm: string;
  periodEndYm: string;
  cycleMonths: number;

  // ① 収入
  /** 請求額 (税抜・シーズン合計, 契約期間内の billing 月を集約) */
  invoiceTotalYen: number;
  /** 入金確認済み合計 (税抜) */
  invoiceConfirmedYen: number;

  // ② 配分
  bufferItems: BufferItem[];
  /** バッファ合計。内訳があればその合計、無ければ原資から逆算 */
  bufferTotalYen: number;
  /** バッファ内訳が明示入力されているか (false = budget_yen から逆算した表示) */
  bufferBreakdownSet: boolean;
  /** メンバー原資 = (請求額 − バッファ) × 65% = value_plan_cycles.budget_yen */
  memberBudgetYen: number;
  /** AMD マージン = (請求額 − バッファ) × 35% */
  amdMarginYen: number;
  /** Σ billing_cycles.budget_yen (= 月次cap合計, 原資との突合用) */
  monthlyCapsSumYen: number;

  // pt
  /** pt単価分母。value_plan_cycles.total_points */
  totalPoints: number;
  /** Σ(MS points, goal_level≠monthly)。total_points と乖離すると未割当ptの穴 */
  msPointsSum: number;
  /** pt単価 = 原資 ÷ total_points。別財布があると regular/extra を混ぜた平均値になるので表示は regularPtUnitYen を主に使う */
  ptUnitYen: number;
  /** 本契約 (regular) プールの pt単価 = 原資 ÷ Σregular pt。別財布があってもここは汚染されない */
  regularPtUnitYen: number;
  /** 別財布 (cap_extra) プールの pt単価 = Σextra_budget_yen ÷ Σextra pt。別財布が無ければ 0 */
  extraPtUnitYen: number;
  /** 別財布 (cap_extra) プールの総原資 = Σ billing_cycles.extra_budget_yen。別財布が無ければ 0 */
  extraPoolBudgetYen: number;
  /** 別財布 (cap_extra) の pt 合計。別財布が無ければ 0 */
  extraPointsSum: number;
  /** Σ(member earnedPt) シーズン累計の実消化pt (期中は total_points 未満が正常) */
  earnedPtSum: number;

  // ③ メンバー別
  members: SeasonPlMember[];
  /** Σ(member paidYen) シーズン累計実支払 */
  paidSumYen: number;
  /** Σ(member finalStockYen) 最終月末の未払い債務合計 */
  finalStockSumYen: number;

  checks: SeasonPlChecks;
};

function numberValue(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function ymToMonths(ym: string): number {
  return parseInt(ym.slice(0, 4), 10) * 12 + parseInt(ym.slice(4, 6), 10);
}

function monthsToYm(months: number): string {
  const zeroBased = months - 1;
  const y = Math.floor(zeroBased / 12);
  const m = (zeroBased % 12) + 1;
  return `${y}${String(m).padStart(2, "0")}`;
}

function cycleMonthsRange(planCycle: PlanCycleInput): string[] {
  const start = ymToMonths(planCycle.period_start_ym);
  const end = ymToMonths(planCycle.period_end_ym);
  const out: string[] = [];
  for (let i = start; i <= end; i += 1) out.push(monthsToYm(i));
  return out.length > 0 ? out : [planCycle.period_start_ym];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * value_plan_cycles.buffer_breakdown_json をパース。
 * {items:[{label,amount}], total} 形式。
 */
export function parseBufferBreakdown(value: unknown): { items: BufferItem[]; total: number } | null {
  const record = asRecord(value);
  if (!record) return null;
  const rawItems = Array.isArray(record.items) ? record.items : [];
  const items: BufferItem[] = rawItems
    .map((raw) => {
      const r = asRecord(raw);
      if (!r) return null;
      const label = typeof r.label === "string" ? r.label.trim() : "";
      const amount = Math.max(0, Math.round(numberValue(r.amount)));
      if (!label && amount <= 0) return null;
      return { label: label || "(無題)", amount };
    })
    .filter((item): item is BufferItem => item !== null);
  const total = items.length > 0
    ? items.reduce((sum, item) => sum + item.amount, 0)
    : Math.max(0, Math.round(numberValue(record.total)));
  if (items.length === 0 && total <= 0) return null;
  return { items, total };
}

/**
 * 契約期間内の billing 月を集約した請求額 (税抜, シーズン合計)。
 * contractBackedClientAmount を月ごとに使うので、契約開始前 (まさ事前稼働月など) は
 * 自然に 0 になり、シーズン売上に乗らない。
 */
function computeInvoiceTotals(
  planCycle: PlanCycleInput,
  project: ProjectInput | null,
  billingsByYm: Map<string, BillingInput>
): { invoiceTotalYen: number; invoiceConfirmedYen: number } {
  let invoiceTotalYen = 0;
  let invoiceConfirmedYen = 0;
  for (const ym of cycleMonthsRange(planCycle)) {
    const billing = billingsByYm.get(ym);
    const clientAmount = contractBackedClientAmount({
      ym,
      project,
      reportedAmount: billing?.budget_reported_amount,
      cycleStatus: billing?.status,
    });
    if (clientAmount <= 0) continue;
    invoiceTotalYen += clientAmount;
    if (billing?.payment_confirmed_at) invoiceConfirmedYen += clientAmount;
  }
  return {
    invoiceTotalYen: Math.round(invoiceTotalYen),
    invoiceConfirmedYen: Math.round(invoiceConfirmedYen),
  };
}

/**
 * plan cycle 全期間を月次に回し、各月の capped 報酬サマリ (cap + stock 繰越連鎖済み) を返す。
 * buildRewardSummary は billingsByYm に期間全 billing を渡せば内部で時系列に cap を効かせる。
 */
function buildMonthlySummaries({
  planCycle,
  project,
  milestones,
  progress,
  responsibilities,
  activeMemberIds,
  companyReserveMemberIds,
  payoutExcludedMemberIds,
  memberMap,
  billingsByYm,
  liabilityOffsets,
}: {
  planCycle: PlanCycleInput;
  project: ProjectInput | null;
  milestones: MilestoneInput[];
  progress: ProgressInput[];
  responsibilities: ResponsibilityInput[];
  activeMemberIds: Set<string>;
  companyReserveMemberIds: Set<string>;
  payoutExcludedMemberIds: Set<string>;
  memberMap: Record<string, string>;
  billingsByYm: Map<string, BillingInput>;
  liabilityOffsets?: RewardLiabilityOffsetInput[];
}): Map<string, RewardSummary> {
  const byYm = new Map<string, RewardSummary>();
  // buildRewardSummary は reward-summary.ts の Row 型を期待する。形は互換 (列名一致) なので
  // 構造的部分型としてそのまま渡す。
  const rsBillingsByYm = billingsByYm as unknown as Map<string, Parameters<typeof buildRewardSummary>[0]["billing"]>;
  for (const ym of cycleMonthsRange(planCycle)) {
    const billing = billingsByYm.get(ym);
    if (!billing) continue;
    const summary = buildRewardSummary({
      ym,
      milestones: milestones as Parameters<typeof buildRewardSummary>[0]["milestones"],
      progress: progress as Parameters<typeof buildRewardSummary>[0]["progress"],
      responsibilities: responsibilities as Parameters<typeof buildRewardSummary>[0]["responsibilities"],
      activeMemberIds,
      companyReserveMemberIds,
      payoutExcludedMemberIds,
      memberMap,
      billing: billing as Parameters<typeof buildRewardSummary>[0]["billing"],
      billingsByYm: rsBillingsByYm,
      planCycle: planCycle as Parameters<typeof buildRewardSummary>[0]["planCycle"],
      project: project as Parameters<typeof buildRewardSummary>[0]["project"],
      liabilityOffsets,
    });
    if (summary) byYm.set(ym, summary);
  }
  return byYm;
}

/**
 * シーズン予実表を 1 件計算する純関数。DB I/O は呼び出し側で済ませて配列を渡す。
 */
export function computeSeasonPl({
  planCycle,
  project,
  billings,
  milestones,
  progress,
  responsibilities,
  members,
  activeMemberIds,
  liabilityOffsets,
}: {
  planCycle: PlanCycleInput;
  project: ProjectInput | null;
  billings: BillingInput[];
  milestones: MilestoneInput[];
  progress: ProgressInput[];
  responsibilities: ResponsibilityInput[];
  members: MemberInput[];
  /** project_members.is_active=true のメンバー集合。未指定なら全員 active 扱い */
  activeMemberIds?: Set<string>;
  /** 支払済み/通知済みの過払いを同一メンバー本人の未払残から相殺する台帳 */
  liabilityOffsets?: RewardLiabilityOffsetInput[];
}): SeasonPl {
  const billingsByYm = new Map<string, BillingInput>(billings.map((row) => [row.ym, row]));
  const cycleMonths = cycleMonthsRange(planCycle);

  const memberMap: Record<string, string> = {};
  const officerIds = new Set<string>();
  const companyReserveMemberIds = new Set<string>();
  const payoutExcludedMemberIds = new Set<string>();
  for (const member of members) {
    memberMap[member.member_id] = member.code_name || member.member_name || member.member_id;
    if (member.is_officer) {
      officerIds.add(member.member_id);
      companyReserveMemberIds.add(member.member_id);
    }
    if (member.exclude_from_payout_notice) payoutExcludedMemberIds.add(member.member_id);
  }
  const effectiveActiveMemberIds = activeMemberIds ?? new Set(members.map((m) => m.member_id));

  // ① 収入
  const { invoiceTotalYen, invoiceConfirmedYen } = computeInvoiceTotals(planCycle, project, billingsByYm);

  // ② 配分: 原資 / バッファ / マージン
  const memberBudgetYen = Math.max(0, Math.round(numberValue(planCycle.budget_yen)));

  // 別財布 (cap_extra) プールの pt単価分離 (reward-summary.ts deriveRewardUnits と整合):
  //   regular pt単価 = 本契約原資 ÷ (シーズン期間の月数 × 10pt)。
  //   extra pt単価   = Σ billing.extra_budget_yen ÷ Σextra pt。
  // 別財布が無ければ extra 系は 0 で、regularPtUnitYen は従来の ptUnitYen と一致する。
  const extraPointsSum = Math.round(
    milestones.filter((ms) => isCapExtraTag(ms.tag)).reduce((sum, ms) => sum + effectiveMilestonePoints(ms), 0) * 100
  ) / 100;
  const hasCapExtra = extraPointsSum > 0;
  const regularPointsSum = regularPointBasisForCycle(planCycle);
  const totalPoints = totalPointBasisForCycle(planCycle, extraPointsSum);
  const extraPoolBudgetYen = hasCapExtra
    ? cycleMonths.reduce((sum, ym) => {
        const raw = billingsByYm.get(ym)?.extra_budget_yen;
        // NULL/undefined は「cap 未設定」= 別財布原資なし。明示数値 (0 含む) だけ加算する。
        if (raw === null || raw === undefined || raw === "") return sum;
        const n = numberValue(raw);
        return Number.isFinite(n) ? sum + Math.max(0, Math.round(n)) : sum;
      }, 0)
    : 0;
  const regularPtUnitYen = regularPointsSum > 0 ? Math.round(memberBudgetYen / regularPointsSum) : 0;
  const extraPtUnitYen = hasCapExtra && extraPoolBudgetYen > 0 && extraPointsSum > 0
    ? Math.round(extraPoolBudgetYen / extraPointsSum)
    : 0;
  // 表示用の代表 pt単価。別財布があれば regular を主に使う (regular/extra 混在の平均は意味が薄い)。
  const ptUnitYen = hasCapExtra ? regularPtUnitYen : (totalPoints > 0 ? Math.round(memberBudgetYen / totalPoints) : 0);

  const parsedBuffer = parseBufferBreakdown(planCycle.buffer_breakdown_json);
  // 原資 = (請求額 − バッファ) × 65% より、バッファ = 請求額 − 原資/0.65。
  const derivedBufferTotal = Math.max(0, Math.round(invoiceTotalYen - memberBudgetYen / MEMBER_SHARE_RATE));
  const bufferBreakdownSet = parsedBuffer !== null;
  const bufferItems = parsedBuffer?.items ?? [];
  const bufferTotalYen = bufferBreakdownSet ? parsedBuffer!.total : derivedBufferTotal;

  // AMD マージン = (請求額 − バッファ) × 35%
  const baseAfterBuffer = Math.max(0, invoiceTotalYen - bufferTotalYen);
  const amdMarginYen = Math.round(baseAfterBuffer * AMD_MARGIN_RATE);

  // Σ 月次cap (= billing_cycles.budget_yen の合計, 原資との突合)
  const monthlyCapsSumYen = cycleMonths.reduce((sum, ym) => {
    return sum + Math.max(0, Math.round(numberValue(billingsByYm.get(ym)?.budget_yen)));
  }, 0);

  // ③ メンバー別 pt 比予実: 月次サマリを cycle 集約
  const monthlySummaries = buildMonthlySummaries({
    planCycle,
    project,
    milestones,
    progress,
    responsibilities,
    activeMemberIds: effectiveActiveMemberIds,
    companyReserveMemberIds,
    payoutExcludedMemberIds,
    memberMap,
    billingsByYm,
    liabilityOffsets,
  });

  // buildRewardSummary(ym) の member.earnedPt / totalPay / companyReserveYen は「その単月分」。
  // よってシーズン累計 earnedPt と累計実支払は各月を合算して出す。
  // 一方 stockYen は「その月末の未払い残高 (snapshot)」なので、累計せず最後の月の値を最終 stock とする。
  type Agg = { earnedPt: number; regularEarnedPt: number; extraEarnedPt: number; paidYen: number };
  const aggByMember = new Map<string, Agg>();
  for (const ym of cycleMonths) {
    const summary = monthlySummaries.get(ym);
    if (!summary) continue;
    for (const member of summary.members) {
      const agg = aggByMember.get(member.memberId) ?? { earnedPt: 0, regularEarnedPt: 0, extraEarnedPt: 0, paidYen: 0 };
      agg.earnedPt += numberValue(member.earnedPt);
      // 別財布プール分離: regularEarnedPt / extraEarnedPt は reward-summary が member に持たせる。
      // 旧 snapshot で欠けていれば earnedPt を regular に寄せる (= 別財布なし PJ の従来挙動)。
      const regPt = member.regularEarnedPt;
      const extPt = member.extraEarnedPt;
      if (regPt !== undefined || extPt !== undefined) {
        agg.regularEarnedPt += numberValue(regPt);
        agg.extraEarnedPt += numberValue(extPt);
      } else {
        agg.regularEarnedPt += numberValue(member.earnedPt);
      }
      // 非役員は totalPay (現金支払)、役員は companyReserveYen (会社留保) を実支払とみなす。
      agg.paidYen += officerIds.has(member.memberId)
        ? Math.max(0, Math.round(numberValue(member.companyReserveYen)))
        : Math.max(0, Math.round(member.totalPay));
      aggByMember.set(member.memberId, agg);
    }
  }

  // 最終 stock (= シーズン末の未払い債務 snapshot) は、billing が存在する最後の月のサマリから取る。
  let lastSummary: RewardSummary | null = null;
  for (let i = cycleMonths.length - 1; i >= 0; i -= 1) {
    const s = monthlySummaries.get(cycleMonths[i]);
    if (s) { lastSummary = s; break; }
  }
  const finalStockByMember = new Map<string, number>();
  for (const member of lastSummary?.members ?? []) {
    finalStockByMember.set(member.memberId, Math.max(0, Math.round(numberValue(member.stockYen))));
  }

  const memberIds = new Set<string>([...aggByMember.keys(), ...finalStockByMember.keys()]);
  const seasonMembers: SeasonPlMember[] = [...memberIds]
    .map((memberId): SeasonPlMember => {
      const isOfficer = officerIds.has(memberId);
      const agg = aggByMember.get(memberId);
      const earnedPt = Math.round((agg?.earnedPt ?? 0) * 100) / 100;
      const regularEarnedPt = Math.round((agg?.regularEarnedPt ?? 0) * 100) / 100;
      const extraEarnedPt = Math.round((agg?.extraEarnedPt ?? 0) * 100) / 100;
      const finalStockYen = finalStockByMember.get(memberId) ?? 0;
      const paidYen = agg?.paidYen ?? 0;
      // pt比予算取り分は別財布プールを分離: regular分は regular単価、extra分は extra単価で評価。
      const extraBudgetShareYen = Math.round(extraEarnedPt * extraPtUnitYen);
      const budgetShareYen = Math.round(regularEarnedPt * regularPtUnitYen) + extraBudgetShareYen;
      return {
        memberId,
        memberName: memberMap[memberId] || memberId,
        isOfficer,
        reserveKind: isOfficer ? "company_reserve" : "cash",
        earnedPt,
        regularEarnedPt,
        extraEarnedPt,
        budgetShareYen,
        extraBudgetShareYen,
        paidYen,
        finalStockYen,
        // 差 = (実支払 + 最終未払い残) − pt比予算取り分。0 が正 (= 全額 pt 比どおりに配分済み)。
        convergenceDeltaYen: paidYen + finalStockYen - budgetShareYen,
      };
    })
    .sort((a, b) => b.earnedPt - a.earnedPt || b.budgetShareYen - a.budgetShareYen);

  const earnedPtSum = Math.round(seasonMembers.reduce((sum, m) => sum + m.earnedPt, 0) * 100) / 100;
  const paidSumYen = seasonMembers.reduce((sum, m) => sum + m.paidYen, 0);
  const finalStockSumYen = seasonMembers.reduce((sum, m) => sum + m.finalStockYen, 0);
  const officerFinalStockYen = seasonMembers
    .filter((m) => m.isOfficer)
    .reduce((sum, m) => sum + m.finalStockYen, 0);

  // ◆ 検算フラグ
  // 閉じ検算: バッファ + 原資 + マージン == 請求額
  const closeSum = bufferTotalYen + memberBudgetYen + amdMarginYen;
  const closeDeltaYen = closeSum - invoiceTotalYen;
  const closes = Math.abs(closeDeltaYen) <= CLOSE_TOLERANCE_YEN;

  // 未割当pt: pt単価分母 (total_points) を裏打ちする MS が足りているか。
  // 注意: earnedPt は「シーズン途中までの消化」なので total_points と直接比べると
  // 期中は必ず不足する (= 誤検知)。比べるべきは MS の points 合計 (= 計画上の pt 容量)。
  const msPointsSum = Math.round(
    milestones
      .filter((ms) => String(ms.goal_level || "").toLowerCase() !== "monthly")
      .reduce((sum, ms) => sum + effectiveMilestonePoints(ms), 0) * 100
  ) / 100;
  const unassignedPt = Math.round((totalPoints - msPointsSum) * 100) / 100;
  // 担当者が居ない (share 合計 0) のに points を持つ MS = 誰の earnedPt にもならない宙吊り pt。
  const shareSumByMs = new Map<string, number>();
  for (const resp of responsibilities) {
    shareSumByMs.set(resp.milestone_id, (shareSumByMs.get(resp.milestone_id) ?? 0) + numberValue(resp.share));
  }
  const unownedMilestones = milestones
    .filter((ms) => String(ms.goal_level || "").toLowerCase() !== "monthly")
    .filter((ms) => effectiveMilestonePoints(ms) > 0 && (shareSumByMs.get(ms.milestone_id) ?? 0) <= 0)
    .map((ms) => ms.milestone_id);

  // total_points が MS で裏打ちされ、かつ宙吊り (担当無し) MS も無ければ「pt 完全割当」。
  const ptFullyAssigned =
    totalPoints <= 0 || (Math.abs(unassignedPt) <= UNASSIGNED_PT_TOLERANCE && unownedMilestones.length === 0);

  // 原資 ≠ Σ月cap
  const budgetVsMonthlyCapsDeltaYen = memberBudgetYen - monthlyCapsSumYen;
  const budgetMatchesMonthlyCaps = Math.abs(budgetVsMonthlyCapsDeltaYen) <= CLOSE_TOLERANCE_YEN;

  // pt単価過大: regular pt単価 ≠ (請求額−バッファ)×65% ÷ regular pt。
  // 別財布があると total_points には extra pt が混ざるので、regular 分母 (regularPointsSum) で突合する。
  // これにより別財布の有無に関わらず「本契約 pt単価が原資式どおりか」を一貫して検査できる。
  const expectedBudget = Math.round(baseAfterBuffer * MEMBER_SHARE_RATE);
  const ptUnitExpected = regularPointsSum > 0 ? Math.round(expectedBudget / regularPointsSum) : 0;
  const ptUnitDeltaYen = ptUnitYen - ptUnitExpected;
  const ptUnitConsistent = regularPointsSum <= 0 || Math.abs(ptUnitDeltaYen) <= CLOSE_TOLERANCE_YEN;

  // 役員取りこぼし: 最終月で役員stockが0に収束しない
  const officerStockConverges = officerFinalStockYen <= OFFICER_STOCK_TOLERANCE_YEN;

  const checks: SeasonPlChecks = {
    closes,
    closeDeltaYen,
    ptFullyAssigned,
    unassignedPt,
    unownedMilestones,
    budgetMatchesMonthlyCaps,
    budgetVsMonthlyCapsDeltaYen,
    ptUnitConsistent,
    ptUnitExpected,
    ptUnitDeltaYen,
    officerStockConverges,
    officerFinalStockYen,
  };

  return {
    planCycleId: planCycle.plan_cycle_id,
    projectId: planCycle.project_id,
    projectName: project?.project_name || planCycle.project_id,
    clientName: project?.client_name || "",
    status: planCycle.status || "active",
    periodStartYm: planCycle.period_start_ym,
    periodEndYm: planCycle.period_end_ym,
    cycleMonths: cycleMonths.length,

    invoiceTotalYen,
    invoiceConfirmedYen,

    bufferItems,
    bufferTotalYen,
    bufferBreakdownSet,
    memberBudgetYen,
    amdMarginYen,
    monthlyCapsSumYen,

    totalPoints,
    msPointsSum,
    ptUnitYen,
    regularPtUnitYen,
    extraPtUnitYen,
    extraPoolBudgetYen,
    extraPointsSum,
    earnedPtSum,

    members: seasonMembers,
    paidSumYen,
    finalStockSumYen,

    checks,
  };
}

/** 一覧トップ行の軽量サマリ (詳細を計算せず checks の要点だけ抜く) */
export type SeasonPlListRow = {
  planCycleId: string;
  projectId: string;
  projectName: string;
  clientName: string;
  status: string;
  periodStartYm: string;
  periodEndYm: string;
  invoiceTotalYen: number;
  bufferTotalYen: number;
  memberBudgetYen: number;
  amdMarginYen: number;
  totalPoints: number;
  ptUnitYen: number;
  closes: boolean;
  ptFullyAssigned: boolean;
  unassignedPt: number;
  budgetMatchesMonthlyCaps: boolean;
  budgetVsMonthlyCapsDeltaYen: number;
  ptUnitConsistent: boolean;
  officerStockConverges: boolean;
  /** いずれかの検算が NG (= 注意が必要) */
  hasWarning: boolean;
};

export function toListRow(pl: SeasonPl): SeasonPlListRow {
  const c = pl.checks;
  const hasWarning =
    !c.closes ||
    !c.ptFullyAssigned ||
    !c.budgetMatchesMonthlyCaps ||
    !c.ptUnitConsistent ||
    !c.officerStockConverges;
  return {
    planCycleId: pl.planCycleId,
    projectId: pl.projectId,
    projectName: pl.projectName,
    clientName: pl.clientName,
    status: pl.status,
    periodStartYm: pl.periodStartYm,
    periodEndYm: pl.periodEndYm,
    invoiceTotalYen: pl.invoiceTotalYen,
    bufferTotalYen: pl.bufferTotalYen,
    memberBudgetYen: pl.memberBudgetYen,
    amdMarginYen: pl.amdMarginYen,
    totalPoints: pl.totalPoints,
    ptUnitYen: pl.ptUnitYen,
    closes: c.closes,
    ptFullyAssigned: c.ptFullyAssigned,
    unassignedPt: c.unassignedPt,
    budgetMatchesMonthlyCaps: c.budgetMatchesMonthlyCaps,
    budgetVsMonthlyCapsDeltaYen: c.budgetVsMonthlyCapsDeltaYen,
    ptUnitConsistent: c.ptUnitConsistent,
    officerStockConverges: c.officerStockConverges,
    hasWarning,
  };
}
