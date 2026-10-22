import type { CockpitData } from "@/lib/supabase-data";
import type { ProjectWorkspaceBundle } from "@/lib/project-workspace";

// 開発用の表示データ。実PJ・実経営会議・本番DBには接続しない。
export const previewCockpit = {
  project: { projectId: "preview", projectName: "確認用PJ", clientName: "", status: "active", projectCategory: "new_business" },
  currentYm: "2026-10", billingCycles: [], planCycle: null, milestones: [], progress: [], reports: [],
  members: [], nudges: [], tasks: [], subItems: [], responsibilities: [], memberMap: {},
  pastPlanCycles: [], msActivities: [], memberActivities: [], strategySignals: [], msChangeHistory: [], seasonFinance: null,
} as CockpitData;

const zeroCategories = { basic: 0, applied: 0, development: 0, su: 0, coordination: 0 };
export const previewWorkspace = {
  project: { projectId: "preview", projectName: "確認用PJ", clientName: null, status: "active", projectCategory: "new_business", displayName: "確認用PJ" },
  currentWeekStart: "2026-10-19", currentMonth: "2026-10", memberCount: 0, evidenceCount: 0,
  effort: { plannedHours: 0, actualHours: 0, calendarHours: 0, enteredHours: 0, tallyDevelopmentHours: 0, tallyMeetingHours: 0, tallyTotalHours: 0, tallySyncedAt: null, categories: zeroCategories, hasEntries: false, links: [] },
  members: [], milestones: [], themes: [], tracks: [], allMeetings: [], evidenceByMonth: [], evidenceBySource: [], weeklyTrend: [],
  sxManagement: {
    asOf: "2026-10-22", horizonMonths: [], objectives: [], objective: null, outcomes: [], kpis: [], dependencies: [], scheduleDependencies: [],
    dag: { valid: true, cycles: [], criticalPath: [], blockedMilestoneIds: [], waitingMilestoneIds: [] },
    judgment: { key: "unassessed", label: "未評価", reasons: [], decisionQueue: [], nextDeadline: null, lastVerifiedAt: null, completenessPct: 0, staleCount: 0, overdueCount: 0, criticalUnknownCount: 0, blockedCount: 0, provisionalDateCount: 0, dagValid: true, criticalPathSlugs: [] },
    tracks: [], milestones: [], tasks: [], issues: [], hypotheses: [], evidence: [], validationRuns: [], decisions: [], actions: [], partners: [], partnerCommitments: [], partnerInteractions: [], partnerRoles: [], partnerWorkItems: [], technicalTests: [], fundingSnapshots: [], organizationRoles: [], raci: [], capacity: [], history: [], fieldAudit: [], canManage: false, hasData: false,
  },
} as ProjectWorkspaceBundle;
