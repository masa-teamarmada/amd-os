/**
 * 型のみ. /admin/ms-overview の API/Client 両方から参照される。
 * route.ts (server only) からは re-export 用に import される。
 */

export type MsOverviewResponsibility = {
  memberId: string;
  codeName: string;
  share: number;
  role: string;
  taskDescription: string | null;
};

export type MsOverviewProjectMember = {
  memberId: string;
  codeName: string;
};

export type MsOverviewMilestone = {
  milestoneId: string;
  title: string;
  points: number;
  /** "cap_extra" | "normal" | "routine" など。バー色判別に使う */
  tag: string;
  goalLevel: string;
  successCriteria: string;
  sortOrder: number;
  /** cap_extra 系 tag か (別財布扱い) */
  isCapExtra: boolean;
  periodStartYm: string | null;
  targetYm: string | null;
  /** plannedShare ベースの担当一覧 (share 降順) */
  responsibilities: MsOverviewResponsibility[];
};

export type MsOverviewMemberPointTotal = {
  memberId: string;
  codeName: string;
  regularPt: number;
  extraPt: number;
  totalPt: number;
};

/**
 * PJ の健全性。並び替えに使う。
 *   "healthy": projects.status='active' かつ freeze 中でない (= 並びは上)
 *   "frozen":  projects.status='active' だが freeze_from_ym ≤ 今月 < restart_ym (= 並びは中)
 *   "inactive": projects.status != 'active' (例: ended) (= 並びは下)
 */
export type ProjectHealthState = "healthy" | "frozen" | "inactive";

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
  /** PJ の健全性 (= 同 PJ の全 cycle で共通の値、並び替えに使う) */
  healthState: ProjectHealthState;
  /** projects.status の生値 (= "active" / "ended" / "suspended" 等) */
  projectStatus: string;
  /** projects.freeze_from_ym (= freeze 開始月、null なら未設定) */
  projectFreezeFromYm: string | null;
  projectMembers: MsOverviewProjectMember[];
  milestones: MsOverviewMilestone[];
  memberPointTotals: MsOverviewMemberPointTotal[];
};

export type MsOverviewResponse = {
  ok: true;
  planCycles: MsOverviewPlanCycle[];
};
