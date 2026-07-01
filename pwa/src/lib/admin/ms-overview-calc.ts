/**
 * MS Overview の計算ロジック共有 util.
 *
 * 編集モードでスライダーを動かすたびに JS 側で再計算するため、route と client の
 * 両方から呼べる純関数として抽出した。
 *
 * この画面は MS 設計レビュー専用なので、支払額に見える円換算は出さない。
 * 円の支払額は reward-summary / season-pl / payouts 側を正本にする。
 *
 * 正本式:
 *   regularPts   = シーズン期間の月数 × 10pt
 *   extraPts     = Σ(cap_extra MS の points)
 *   memberPt[m]  = Σ over MS of (MS.points × share[m])
 *
 * 月按分は無視 (= MS 設計レビュー画面なので plannedShare × points だけで十分)。
 * `milestone_monthly_contribution_allocations.actual_share` は読まない (= 実消化を見ない)。
 */

import type { MsOverviewMemberPointTotal, MsOverviewMilestone, MsOverviewPlanCycle } from "./ms-overview-types";
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
  /** 本契約 pt 分母 = シーズン期間の月数 × 10pt */
  regularPointBasis: number;
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
  /** メンバー別の plannedShare pt 配分 (regular/extra 内訳付き)、totalPt 降順 */
  memberPointTotals: MsOverviewMemberPointTotal[];
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
 * editable に渡す points は「編集中の最新値」。memberPointTotals 並びは route の
 * 出力と揃える (= totalPt 降順、totalPt=0 は除外)。
 */
export function recomputeMsOverview(input: RecomputeInput): RecomputeResult {
  const regularPoints = roundPt(Math.max(0, safeNumber(input.regularPointBasis)));
  const extraPoints = roundPt(
    input.milestones.filter((ms) => ms.isCapExtra).reduce((sum, ms) => sum + effectiveEditableMilestonePoints(ms), 0),
  );
  const totalPoints = roundPt(regularPoints + extraPoints);

  type Acc = { regularPt: number; extraPt: number; codeName: string };
  const acc = new Map<string, Acc>();

  for (const ms of input.milestones) {
    const points = effectiveEditableMilestonePoints(ms);
    for (const r of ms.responsibilities) {
      const share = safeNumber(r.share);
      if (share <= 0) continue;
      const earnedPt = points * share;
      if (earnedPt <= 0) continue;
      const a = acc.get(r.memberId) ?? { regularPt: 0, extraPt: 0, codeName: r.codeName };
      if (ms.isCapExtra) a.extraPt += earnedPt;
      else a.regularPt += earnedPt;
      // codeName は最後に与えられたものを残す (= route のレスポンスと一致させる)
      a.codeName = r.codeName;
      acc.set(r.memberId, a);
    }
  }

  const memberPointTotals: MsOverviewMemberPointTotal[] = [...acc.entries()]
    .map(([memberId, a]) => {
      const regularPt = roundPt(a.regularPt);
      const extraPt = roundPt(a.extraPt);
      return {
        memberId,
        codeName: a.codeName,
        regularPt,
        extraPt,
        totalPt: roundPt(regularPt + extraPt),
      };
    })
    .filter((row) => row.totalPt > 0)
    .sort((a, b) => b.totalPt - a.totalPt);

  return {
    totalPoints,
    regularPoints,
    extraPoints,
    memberPointTotals,
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
export type { MsOverviewMilestone, MsOverviewMemberPointTotal };
