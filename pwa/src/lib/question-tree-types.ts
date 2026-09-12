/**
 * ゴールツリーの型。正本は pwa/spec/3-21-question-tree-current-spec.md と
 * pwa/spec/3-22-goal-tree-plan.md（到達点・MS・ptの型）。
 * server-only の読み込み層と client component の両方から使うため、型だけをここに置く。
 */

export type QuestionStatus = "open" | "answered" | "dropped";
/**
 * goal（到達点）は根だけ、milestone（MS）は goal の直下だけ。
 * DBのCHECKとtrigger、APIの検査、画面の選択肢の3か所で同じ決まりを守る。
 */
export type QuestionKind = "open" | "decision" | "goal" | "milestone";
export type Contribution = "required" | "alternative";
export type ActionStatus = "unassessed" | "not_started" | "running" | "blocked" | "done" | "dropped";
export type ActionKind = "work" | "measure";
export type FindingKind = "supports" | "contradicts" | "neutral" | "missing";
export type Confidence = "high" | "medium" | "low" | "unknown";
export type OriginKind = "manual" | "meeting" | "automation" | "migrated";
/** TODOの受託の段階（3-22 §7）。Phase 0 で動くのは担当の付け外しによる unassigned ⇄ assigned だけ。 */
export type AcceptState = "unassigned" | "assigned" | "accepted" | "negotiating";

export const QUESTION_KIND_LABEL: Record<QuestionKind, string> = {
  goal: "到達点",
  milestone: "MS",
  open: "論点",
  decision: "決めること",
};

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

/** TODOの担当。1件のTODOに複数付く（3-22 §6 メンバーへの配分）。 */
export type ActionOwner = {
  memberId: string;
  displayName: string;
  /** null は「均等」。人数で割った値として読む */
  share: number | null;
};

export type ActionNode = {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  detail: string | null;
  actionKind: ActionKind;
  status: ActionStatus;
  /** 旧・自由記述の担当。表示互換で残す。正本は owners */
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

  /** 見積pt。アサインのときにPMが付ける。0 は「やるがptは付かない」（3-22 §6 原則6・原則10） */
  estimatedPt: number | null;
  /** 確定pt。検収のときに検収者が付ける（Phase 2） */
  acceptedPt: number | null;
  acceptState: AcceptState;
  owners: ActionOwner[];
  /**
   * 担当か期限が空。会議中に種類とタイトルだけで足したまま、まだアサインされていない状態。
   * ガントの「日程未設定」行と木の印が同じ判定を使う（3-22 §4）。
   */
  isUnassigned: boolean;
  /** 緊急。タスクタブで上に出し、行をオレンジにする（OSスイートの やること と同じ） */
  urgent: boolean;
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

/** つくよみが拾ったまま、人がまだ見ていないもの。木へはつながず別枠で出す。 */
export type ProposalNode = {
  kind: "question" | "action" | "finding";
  id: string;
  title: string;
  detail: string | null;
  /** つくよみが推定した親の問い */
  proposedParentId: string | null;
  proposedParentTitle: string | null;
  proposedContribution: Contribution | null;
  /** なぜそこへ付くと考えたか */
  reason: string | null;
  /** 拾った元（議事録など） */
  originRef: string | null;
  createdAt: string;
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
  /**
   * この問いが対応するシーズンのMS（value_milestones.milestone_id）。
   * question_kind='milestone' のときだけ入る。多対多（project_question_milestones）
   */
  milestoneIds: string[];

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

  /**
   * この枝にぶら下がるTODOの集計。ひとつのTODOが複数の問いに効くときは、
   * 木を上から歩いて最初に出会った枝でだけ数える（同じptを二重に積まない）。
   */
  assignedPt: number;
  todoCount: number;
  unassignedCount: number;
};

export type QuestionTreeBundle = {
  projectId: string;
  asOf: string;
  roots: QuestionNode[];
  /** 木に属さないやること。問いに紐づかない実行だけの作業 */
  looseActions: ActionNode[];
  /** つくよみが拾った未確認。人が承認するまで木へ入らない */
  proposals: ProposalNode[];
  allQuestions: QuestionNode[];
  allActions: ActionNode[];
  findings: FindingNode[];
  dependencies: { predecessorActionId: string; successorActionId: string }[];
  /** 担当に選べる人。TODOのアサインで使う */
  members: { memberId: string; displayName: string }[];
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
    /** 担当か期限が空のTODO。会議後のアサイン待ち */
    unassignedActions: number;
    /** TODOへ配った見積ptの合計。MSの枠との突き合わせは Phase 1 */
    assignedPt: number;
  };
  canManage: boolean;
  hasData: boolean;
};
