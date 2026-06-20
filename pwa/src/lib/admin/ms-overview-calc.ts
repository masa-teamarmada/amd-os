/**
 * MS Overview の計算ロジック共有 util.
 *
 * 編集モードでスライダーを動かすたびに JS 側で再計算するため、route と client の
 * 両方から呼べる純関数として抽出した。算定式は `src/lib/season-pl.ts` の
 * `computeSeasonPl` のメンバー予算配分と完全一致させること。
 *
 * 一致させるべき正本式:
 *   regularPts   = total_points − Σ(cap_extra MS の points)
 *                  (= computeSeasonPl の regularPointsSum)
 *   regularUnit  = floor(budget_yen / regularPts)
 *   extraPts     = Σ(cap_extra MS の points)
 *   extraUnit    = floor(extraPoolBudgetYen / extraPts)  // 別財布がある時のみ
 *   memberYen[m] = Σ over MS of (MS.points × share[m] × (cap_extra ? extraUnit : regularUnit))
 *
 * 月按分は無視 (= MS 設計レビュー画面なので plannedShare × points だけで十分)。
 * `milestone_monthly_contribution_allocations.actual_share` は読まない (= 実消化を見ない)。
 */

import type { MsOverviewMemberYearTotal, MsOverviewMilestone, MsOverviewPlanCycle } from "./ms-overview-types";

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
  /** 編集後の pt 値 */
  points: number;
  /** cap_extra 系 tag か否か (tag 文字列でなく事前に判定したフラグ) */
  isCapExtra: boolean;
  /** 担当 share の plannedShare 配列。share の合計は理想的には 1.0 */
  responsibilities: Array<{ memberId: string; codeName: string; share: number }>;
};

export type RecomputeInput = {
  /** 本契約原資 = value_plan_cycles.budget_yen */
  budgetYen: number;
  /** 別財布原資 = Σ billing_cycles.extra_budget_yen (別財布が無ければ 0) */
  extraPoolBudgetYen: number;
  /** 編集対象の MS 一覧 (= スライダーで動かした最新値) */
  milestones: EditableMilestoneInput[];
};

export type RecomputeResult = {
  /** 合計pt = Σ milestones.points */
  totalPoints: number;
  /** 本契約 pt 合計 = Σ (cap_extra ではない MS の points) */
  regularPoints: number;
  /** 別財布 pt 合計 = Σ (cap_extra MS の points) */
  extraPoints: number;
  /** 本契約 pt単価 (= floor(budget_yen / regularPoints)) */
  regularPtUnitYen: number;
  /** 別財布 pt単価 (= floor(extraPoolBudgetYen / extraPoints))、別財布なしは 0 */
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

/**
 * MS Overview のリアルタイム計算。
 * computeSeasonPl の pt 単価式 (floor 含む) と完全一致させる。
 * editable に渡す points は「編集中の最新値」。memberYearTotals 並びは route の
 * 出力と揃える (= totalYen 降順、totalYen=0 は除外)。
 */
export function recomputeMsOverview(input: RecomputeInput): RecomputeResult {
  const totalPoints = roundPt(input.milestones.reduce((sum, ms) => sum + safeNumber(ms.points), 0));
  const extraPoints = roundPt(
    input.milestones.filter((ms) => ms.isCapExtra).reduce((sum, ms) => sum + safeNumber(ms.points), 0),
  );
  const regularPoints = roundPt(Math.max(0, totalPoints - extraPoints));

  // season-pl.ts と同一: Math.round(memberBudgetYen / regularPointsSum)。
  const regularPtUnitYen = regularPoints > 0 ? Math.round(input.budgetYen / regularPoints) : 0;
  const extraPtUnitYen =
    extraPoints > 0 && input.extraPoolBudgetYen > 0
      ? Math.round(input.extraPoolBudgetYen / extraPoints)
      : 0;

  const ptValueYenByMs = new Map<string, number>();
  type Acc = { regularYen: number; extraYen: number; codeName: string };
  const acc = new Map<string, Acc>();

  for (const ms of input.milestones) {
    const unit = ms.isCapExtra ? extraPtUnitYen : regularPtUnitYen;
    ptValueYenByMs.set(ms.milestoneId, Math.round(safeNumber(ms.points) * unit));
    for (const r of ms.responsibilities) {
      const share = safeNumber(r.share);
      if (share <= 0) continue;
      const earnedYen = Math.round(safeNumber(ms.points) * share * unit);
      if (earnedYen === 0) continue;
      const a = acc.get(r.memberId) ?? { regularYen: 0, extraYen: 0, codeName: r.codeName };
      if (ms.isCapExtra) a.extraYen += earnedYen;
      else a.regularYen += earnedYen;
      // codeName は最後に与えられたものを残す (= route のレスポンスと一致させる)
      a.codeName = r.codeName;
      acc.set(r.memberId, a);
    }
  }

  const memberYearTotals: MsOverviewMemberYearTotal[] = [...acc.entries()]
    .map(([memberId, a]) => ({
      memberId,
      codeName: a.codeName,
      regularYen: a.regularYen,
      extraYen: a.extraYen,
      totalYen: a.regularYen + a.extraYen,
    }))
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

function roundPt(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * `MsOverviewPlanCycle` (= route が返す閲覧モード値) を、編集用入力に変換する。
 * client が初期描画後すぐにリアルタイム計算を回せるようにする。
 */
export function toEditableMilestones(cycle: MsOverviewPlanCycle): EditableMilestoneInput[] {
  return cycle.milestones.map((ms): EditableMilestoneInput => ({
    milestoneId: ms.milestoneId,
    points: ms.points,
    isCapExtra: ms.isCapExtra,
    responsibilities: ms.responsibilities.map((r) => ({
      memberId: r.memberId,
      codeName: r.codeName,
      share: r.share,
    })),
  }));
}

/**
 * スライダーの min/max を MS の初期値から決める。
 * min = 2 (= 完全に 0 にできないよう下限)、max = max(初期値の 2 倍, 30) で常識的な範囲に縛る。
 */
export function sliderRange(initialPoints: number): { min: number; max: number } {
  const init = Math.max(0, Math.round(safeNumber(initialPoints)));
  const max = Math.max(init * 2, 30);
  return { min: 2, max };
}

// 必要な型は再 export しておく (client がここだけ import すれば完結する)。
export type { MsOverviewMilestone, MsOverviewMemberYearTotal };
