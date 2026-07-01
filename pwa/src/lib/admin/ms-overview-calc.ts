/**
 * MS Overview の計算ロジック共有 util.
 *
 * 編集モードでスライダーを動かすたびに JS 側で再計算するため、route と client の
 * 両方から呼べる純関数として抽出した。算定式は `src/lib/reward-summary.ts` の
 * pt×単価の丸め順に揃えること。
 *
 * 正本式:
 *   regularPts   = シーズン期間の月数 × 10pt
 *   extraPts     = Σ(cap_extra MS の points)
 *   earnedPt     = round(MS.points × share, 2)
 *   memberYen[m] = Σ over MS of round(earnedPt × ptUnit)
 *
 * 月按分は無視 (= MS 設計レビュー画面なので plannedShare × points だけで十分)。
 * `milestone_monthly_contribution_allocations.actual_share` は読まない (= 実消化を見ない)。
 */

import type { MsOverviewMemberYearTotal, MsOverviewMilestone, MsOverviewPlanCycle } from "./ms-overview-types";
import { pointBasisForPeriod, roundPt } from "@/lib/season-point-basis";

// season-pl.ts の CAP_EXTRA_MILESTONE_TAGS と完全一致させる。
export const CAP_EXTRA_MILESTONE_TAGS = new Set([
  "cap_extra",
  "extra_contract",
  "contract_extra",
  "cap_outside",
  "uncapped",
]);

export function isCapExtraTag(tag: unknown): boolean {
  return CAP_EXTRA_MILESTONE_TAGS.has(String(tag ?? "").trim().toLowerCase());
}

export type EditableMilestoneInput = {
  milestoneId: string;
  title: string;
  /** 編集後の pt 値 */
  points: number;
  tag: string;
  goalLevel: string;
  successCriteria: string;
  periodStartYm: string | null;
  targetYm: string | null;
  sortOrder: number;
  /** cap_extra 系 tag か否か (tag 文字列でなく事前に判定したフラグ) */
  isCapExtra: boolean;
  /** 担当 share の plannedShare 配列。share の合計は理想的には 1.0 */
  responsibilities: Array<{
    memberId: string;
    codeName: string;
    share: number;
    role: string;
    taskDescription: string | null;
  }>;
};

export type RecomputeInput = {
  /** 本契約原資 = value_plan_cycles.budget_yen */
  budgetYen: number;
  /** 本契約 pt 分母 = シーズン期間の月数 × 10pt */
  regularPointBasis: number;
  /** 別財布原資 = Σ billing_cycles.extra_budget_yen (別財布が無ければ 0) */
  extraPoolBudgetYen: number;
  /** 編集対象の MS 一覧 (= スライダーで動かした最新値) */
  milestones: EditableMilestoneInput[];
};

export type RecomputeResult = {
  /** 合計pt = regularPointBasis + Σ cap_extra milestones.points */
  totalPoints: number;
  /** 本契約 pt 合計 = シーズン期間の月数 × 10pt */
  regularPoints: number;
  /** 別財布 pt 合計 = Σ (cap_extra MS の points) */
  extraPoints: number;
  /** 本契約 pt単価 (= round(budget_yen / regularPoints)) */
  regularPtUnitYen: number;
  /** 別財布 pt単価 (= round(extraPoolBudgetYen / extraPoints))、別財布なしは 0 */
  extraPtUnitYen: number;
  /** メンバー別の理論年計 (regular/extra 内訳付き)、totalYen 降順 */
  memberYearTotals: MsOverviewMemberYearTotal[];
  /** 各 MS の pt 価値 (= points × pt単価)。milestoneId をキーにした map */
  ptValueYenByMs: Map<string, number>;
};

function safeNumber(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n ?? 0);
  return Number.isFinite(v) ? v : 0;
}

type EffectiveMilestonePointsInput = Pick<EditableMilestoneInput, "points" | "isCapExtra" | "periodStartYm" | "targetYm">;

export function effectiveEditableMilestonePoints(ms: EffectiveMilestonePointsInput): number {
  if (ms.isCapExtra) {
    const periodPoints = pointBasisForPeriod(ms.periodStartYm, ms.targetYm);
    if (periodPoints > 0) return periodPoints;
  }
  return roundPt(Math.max(0, safeNumber(ms.points)));
}

/**
 * MS Overview のリアルタイム計算。
 * editable に渡す points は「編集中の最新値」。memberYearTotals 並びは route の
 * 出力と揃える (= totalYen 降順、totalYen=0 は除外)。
 */
export function recomputeMsOverview(input: RecomputeInput): RecomputeResult {
  const regularPoints = roundPt(Math.max(0, safeNumber(input.regularPointBasis)));
  const extraPoints = roundPt(
    input.milestones.filter((ms) => ms.isCapExtra).reduce((sum, ms) => sum + effectiveEditableMilestonePoints(ms), 0),
  );
  const totalPoints = roundPt(regularPoints + extraPoints);

  const regularPtUnitYen = regularPoints > 0 ? Math.round(safeNumber(input.budgetYen) / regularPoints) : 0;
  const extraPtUnitYen =
    extraPoints > 0 && safeNumber(input.extraPoolBudgetYen) > 0
      ? Math.round(safeNumber(input.extraPoolBudgetYen) / extraPoints)
      : 0;

  const ptValueYenByMs = new Map<string, number>();
  type Acc = { regularPt: number; extraPt: number; regularYen: number; extraYen: number; codeName: string };
  const acc = new Map<string, Acc>();

  for (const ms of input.milestones) {
    const points = effectiveEditableMilestonePoints(ms);
    const unit = ms.isCapExtra ? extraPtUnitYen : regularPtUnitYen;
    ptValueYenByMs.set(ms.milestoneId, Math.round(points * unit));
    for (const r of ms.responsibilities) {
      const share = safeNumber(r.share);
      if (share <= 0) continue;
      const earnedPt = roundPt(points * share);
      if (earnedPt <= 0) continue;
      const earnedYen = Math.round(earnedPt * unit);
      const a = acc.get(r.memberId) ?? { regularPt: 0, extraPt: 0, regularYen: 0, extraYen: 0, codeName: r.codeName };
      if (ms.isCapExtra) {
        a.extraPt += earnedPt;
        a.extraYen += earnedYen;
      } else {
        a.regularPt += earnedPt;
        a.regularYen += earnedYen;
      }
      // codeName は最後に与えられたものを残す (= route のレスポンスと一致させる)
      a.codeName = r.codeName;
      acc.set(r.memberId, a);
    }
  }

  const memberYearTotals: MsOverviewMemberYearTotal[] = [...acc.entries()]
    .map(([memberId, a]) => {
      const regularPt = roundPt(a.regularPt);
      const extraPt = roundPt(a.extraPt);
      return {
        memberId,
        codeName: a.codeName,
        regularPt,
        extraPt,
        totalPt: roundPt(regularPt + extraPt),
        regularYen: Math.round(a.regularYen),
        extraYen: Math.round(a.extraYen),
        totalYen: Math.round(a.regularYen + a.extraYen),
      };
    })
    .filter((row) => row.totalYen > 0)
    .sort((a, b) => b.totalYen - a.totalYen);

  return {
    totalPoints,
    regularPoints,
    extraPoints,
    regularPtUnitYen,
    extraPtUnitYen,
    memberYearTotals,
    ptValueYenByMs,
  };
}

/**
 * `MsOverviewPlanCycle` (= route が返す閲覧モード値) を、編集用入力に変換する。
 * client が初期描画後すぐにリアルタイム計算を回せるようにする。
 */
export function toEditableMilestones(cycle: MsOverviewPlanCycle): EditableMilestoneInput[] {
  return cycle.milestones.map((ms): EditableMilestoneInput => {
    const base: EditableMilestoneInput = {
      milestoneId: ms.milestoneId,
      title: ms.title,
      points: ms.points,
      tag: ms.tag,
      goalLevel: ms.goalLevel,
      successCriteria: ms.successCriteria,
      periodStartYm: ms.periodStartYm,
      targetYm: ms.targetYm,
      sortOrder: ms.sortOrder,
      isCapExtra: ms.isCapExtra,
      responsibilities: ms.responsibilities.map((r) => ({
        memberId: r.memberId,
        codeName: r.codeName,
        share: r.share,
        role: r.role,
        taskDescription: r.taskDescription,
      })),
    };
    return { ...base, points: effectiveEditableMilestonePoints(base) };
  });
}

/**
 * スライダーの min/max を編集開始時点の最大ptから固定する。
 * max が現在値に追従するとドラッグ中に 1px あたりのpt幅が変わるため、
 * 「最大pt × 1.5」を右端にして操作感を一定にする。
 */
export function sliderRange(maxReferencePoints: number): { min: number; max: number } {
  const reference = Math.max(0, safeNumber(maxReferencePoints));
  const max = Math.max(2, Math.ceil(reference * 1.5));
  return { min: 2, max };
}

// 必要な型は再 export しておく (client がここだけ import すれば完結する)。
export type { MsOverviewMilestone, MsOverviewMemberYearTotal };
