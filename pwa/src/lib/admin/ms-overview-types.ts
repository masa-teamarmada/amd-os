/**
 * 型のみ. /admin/ms-overview の API/Client 両方から参照される。
 * route.ts (server only) からは re-export 用に import される。
 */

export type MsOverviewResponsibility = {
  memberId: string;
  codeName: string;
  share: number;
};

export type MsOverviewMilestone = {
  milestoneId: string;
  title: string;
  points: number;
  /** "cap_extra" | "normal" | "routine" など。バー色判別に使う */
  tag: string;
  /** cap_extra 系 tag か (別財布扱い) */
  isCapExtra: boolean;
  periodStartYm: string | null;
  targetYm: string | null;
  /** この MS の pt 価値 (円) = points × (cap_extra なら extraPtUnitYen, 違えば regularPtUnitYen) */
  ptValueYen: number;
  /** plannedShare ベースの担当一覧 (share 降順) */
  responsibilities: MsOverviewResponsibility[];
};

export type MsOverviewMemberYearTotal = {
  memberId: string;
  codeName: string;
  regularYen: number;
  extraYen: number;
  totalYen: number;
};

export type MsOverviewPlanCycle = {
  planCycleId: string;
  projectId: string;
  projectName: string;
  clientName: string;
  status: string;
  periodStartYm: string;
  periodEndYm: string;
  budgetYen: number;
  totalPoints: number;
  regularPoints: number;
  extraPoints: number;
  regularPtUnitYen: number;
  extraPtUnitYen: number;
  extraPoolBudgetYen: number;
  milestones: MsOverviewMilestone[];
  memberYearTotals: MsOverviewMemberYearTotal[];
};

export type MsOverviewResponse = {
  ok: true;
  planCycles: MsOverviewPlanCycle[];
};
