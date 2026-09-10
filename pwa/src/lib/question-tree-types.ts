/**
 * 問いの木の型。正本は pwa/spec/3-21-question-tree-current-spec.md。
 * server-only の読み込み層と client component の両方から使うため、型だけをここに置く。
 */

export type QuestionStatus = "open" | "answered" | "dropped";
export type QuestionKind = "open" | "decision";
export type Contribution = "required" | "alternative";
export type ActionStatus = "unassessed" | "not_started" | "running" | "blocked" | "done" | "dropped";
export type ActionKind = "work" | "measure";
export type FindingKind = "supports" | "contradicts" | "neutral" | "missing";
export type Confidence = "high" | "medium" | "low" | "unknown";
export type OriginKind = "manual" | "meeting" | "automation" | "migrated";

/** 問いの状態。表示の主軸。 */
export type QuestionState =
  /** 子とやることが片付き、人が答えを書けば閉じる */
  | "decidable"
  /** 未閉じなのに子もやることも無い。前に進む手が無い */
  | "stalled"
  /** 代替が全滅、または必須の枝が捨てられた。親の答えが出せない */
  | "dead_branch"
  /** 手が動いている */
  | "in_progress"
  | "answered"
  | "dropped";

export const QUESTION_STATE_LABEL: Record<QuestionState, string> = {
  decidable: "判断できる",
  stalled: "手が止まっている",
  dead_branch: "枝が死んだ",
  in_progress: "進行中",
  answered: "答えが出た",
  dropped: "追わない",
};

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  unassessed: "進捗未登録",
  not_started: "未着手",
  running: "実行中",
  blocked: "止まっている",
  done: "完了",
  dropped: "やめた",
};

export const FINDING_KIND_LABEL: Record<FindingKind, string> = {
  supports: "裏づけ",
  contradicts: "反証",
  neutral: "観測",
  missing: "不足",
};

export type ActionNode = {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  detail: string | null;
  actionKind: ActionKind;
  status: ActionStatus;
  ownerLabel: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualEnd: string | null;
  dateCertainty: "confirmed" | "provisional";
  progressPct: number;
  blocker: string | null;
  doneCriteria: string | null;
  doneEvidence: string | null;
  target: string | null;
  actual: string | null;
  unit: string | null;
  originKind: OriginKind;
  originRef: string | null;
  originQuestionId: string | null;
  sortOrder: number;
  lastVerifiedAt: string;
  /** このやることが答えを出そうとしている問い。多対多 */
  questionIds: string[];
  children: ActionNode[];
  findings: FindingNode[];
  isOverdue: boolean;
};

export type FindingNode = {
  id: string;
  projectId: string;
  summary: string;
  findingKind: FindingKind;
  observedOn: string | null;
  sourceLabel: string;
  sourceUrl: string | null;
  confidence: Confidence;
  fromActionId: string | null;
  lastVerifiedAt: string;
  questionIds: string[];
};

export type QuestionNode = {
  id: string;
  projectId: string;
  parentId: string | null;
  contribution: Contribution | null;
  title: string;
  background: string | null;
  questionKind: QuestionKind;
  status: QuestionStatus;
  answer: string | null;
  answeredOn: string | null;
  answeredBy: string | null;
  dropReason: string | null;
  confidence: Confidence;
  ownerLabel: string;
  dueDate: string | null;
  originKind: OriginKind;
  originRef: string | null;
  originQuestionId: string | null;
  sortOrder: number;
  lastVerifiedAt: string;

  children: QuestionNode[];
  /** この問いに直接ぶら下がるやること */
  actions: ActionNode[];
  findings: FindingNode[];
  /** この問いを議論していて生まれた問い */
  derivedQuestionIds: string[];

  // ここから導出値
  state: QuestionState;
  /** 自分と子孫のうち最も近い期限 */
  nextDueDate: string | null;
  /** 自分と子孫の最終更新のうち最新 */
  latestVerifiedAt: string;
  isOverdue: boolean;
  isStale: boolean;
  /** 未完了の「確かめる行為」。自分の直下だけ */
  openMeasureCount: number;
  /** 未閉じの子孫の数 */
  openDescendantCount: number;
  /** 子孫全体の未完了「確かめる行為」の数 */
  openMeasureCountDeep: number;
  depth: number;
};

export type QuestionTreeBundle = {
  projectId: string;
  asOf: string;
  roots: QuestionNode[];
  /** 木に属さないやること。問いに紐づかない実行だけの作業 */
  looseActions: ActionNode[];
  allQuestions: QuestionNode[];
  allActions: ActionNode[];
  findings: FindingNode[];
  dependencies: { predecessorActionId: string; successorActionId: string }[];
  counts: {
    questions: number;
    open: number;
    answered: number;
    dropped: number;
    decidable: number;
    stalled: number;
    deadBranch: number;
    overdue: number;
    actions: number;
    openMeasures: number;
  };
  canManage: boolean;
  hasData: boolean;
};
