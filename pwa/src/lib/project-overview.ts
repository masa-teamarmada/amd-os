/**
 * PJ概要タブ（PJ管理）の中身を組み立てる純関数と型。正本は spec 3-23 §9、項目の定義は project-formats.ts（鍵付き）。
 *
 * 2026-10-04 まさ確定「1で進めて」（PJの定義5項目・今の状態4項目）。
 * - PJの定義: 目的はゴールツリーの到達点、相手は PJ・シーズ・Venture Map の登録、関わり方の補足・稼ぎ方・先方の窓口は
 *   project_definitions（書けるのは管理者だけ）から出す。PJを作るときに決めて、めったに変えない。
 * - 今の状態: ゴールツリー・契約・収支・重要な動きのデータから出す。このタブでは書かない。
 * 画面は src/components/cockpit/ProjectOverviewFormat.tsx、読み込みは project-overview-client.ts。ここは純関数だけを置く。
 */

import { AMD_REVENUE_KINDS, type AmdRevenueKindKey } from "./project-formats.ts";
import type { ProposalNode, QuestionNode } from "./question-tree-types.ts";

export type ProjectRevenueStream = { kind: AmdRevenueKindKey; note: string };

export type ProjectDefinition = {
  involvementNote: string | null;
  revenueStreams: ProjectRevenueStream[];
  counterpartContacts: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type ProjectDefinitionInput = {
  involvementNote: string | null;
  revenueStreams: ProjectRevenueStream[];
  counterpartContacts: string | null;
};

export type ProjectOverviewMember = {
  name: string;
  isPl: boolean;
  isPm: boolean;
  isCloser: boolean;
  roleLabel: string | null;
};

export type ProjectOverviewPayload = {
  projectId: string;
  identity: {
    projectName: string;
    displayName: string | null;
    clientName: string | null;
    status: string;
    projectCategory: string | null;
    startYm: string | null;
    endYm: string | null;
  };
  /** Venture Map の登録（大学発SUなど）。無いPJは null。 */
  venture: {
    lane: string | null;
    outcomePattern: string | null;
    foundedAt: string | null;
    originOrg: string | null;
    originPi: string | null;
    amdRole: string | null;
    supportStartedAt: string | null;
    supportEndedAt: string | null;
  } | null;
  company: { legalStatus: string | null; legalName: string | null; incorporatedOn: string | null } | null;
  definition: ProjectDefinition | null;
  members: ProjectOverviewMember[];
  seeds: Array<{ id: string; title: string; orgName: string | null; researcherName: string | null }>;
  signals: Array<{ id: string; date: string | null; title: string; summary: string | null }>;
};

export type ProjectOverviewResponse = {
  ok: true;
  overview: ProjectOverviewPayload;
  viewer: { canEdit: boolean };
};

/** 事業の概要（会社情報 > 会社概要）。正本は project_business_summaries。 */
export type BusinessSummary = {
  summary: string | null;
  detail: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type BusinessSummaryResponse = {
  ok: true;
  business: BusinessSummary | null;
  viewer: { canEdit: boolean };
};

// ---------------------------------------------------------------------------------------------
// 呼び名
// ---------------------------------------------------------------------------------------------

export const PROJECT_CATEGORY_LABELS: Record<string, string> = {
  dtsu: "大学発SU",
  advisor: "顧問",
  new_business: "新規事業",
  ecosystem: "研究機関エコシステム",
};

/** project_ventures.amd_role。呼び名は Venture Map の編集画面と同じ。 */
export const AMD_ROLE_LABELS: Record<string, string> = {
  studio: "スタジオモデル",
  founder_studio: "ファウンダースタジオ",
  support: "サポート参画",
};

/** projects.status。呼び名はポートフォリオ（src/lib/portfolio-pulse.ts）と同じ。 */
export const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: "稼働中",
  sales: "PJ化検討中",
  draft: "PJ化検討中",
  ended: "終了",
  frozen: "停止中",
};

export const VENTURE_LANE_LABELS: Record<string, string> = {
  gx_energy: "GX / エネルギー",
  gx_circular: "GX / サーキュラー",
  materials: "素材 / ナノマテリアル",
  life: "ライフ / 医療",
  robo: "ロボ / 農・モビリティ",
  quantum: "量子 / 光量子",
};

/** project_ventures.outcome_pattern。呼び名は PJ の見出しで使ってきたものと同じ。 */
export const VENTURE_OUTCOME_LABELS: Record<string, string> = {
  tbd: "未確定（Before 0）",
  planning: "計画中（Before 0）",
  stalled: "停滞（Before 0）",
  rocket: "離陸中",
  lifted: "離陸完了",
  deep_pivot: "後付けdeep化",
  zombie: "ゾンビ化",
  smb: "中小企業化",
  burnout: "燃え尽き",
  ue_fail: "UE失敗",
};

export function revenueKindLabel(kind: string): string {
  return AMD_REVENUE_KINDS.find((entry) => entry.key === kind)?.label ?? kind;
}

// ---------------------------------------------------------------------------------------------
// 入力の整形
// ---------------------------------------------------------------------------------------------

const REVENUE_KIND_KEYS = new Set<string>(AMD_REVENUE_KINDS.map((entry) => entry.key));

/** 稼ぎ方の一覧を、定義にある種類と文字列の中身だけへ揃える（DB の CHECK と同じ決まり）。 */
export function normalizeRevenueStreams(value: unknown): ProjectRevenueStream[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const kind = (item as { kind?: unknown }).kind;
    const note = (item as { note?: unknown }).note;
    if (typeof kind !== "string" || !REVENUE_KIND_KEYS.has(kind)) return [];
    return [{ kind: kind as AmdRevenueKindKey, note: typeof note === "string" ? note.trim() : "" }];
  });
}

/** 空白だけの文字列は null。長すぎるものは切る。 */
export function textOrNull(value: unknown, maxLength = 2000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

// ---------------------------------------------------------------------------------------------
// PJの定義
// ---------------------------------------------------------------------------------------------

type GoalTreeLike = { allQuestions: QuestionNode[]; proposals?: ProposalNode[] } | null | undefined;

const byDue = (a: QuestionNode, b: QuestionNode) =>
  (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") || a.sortOrder - b.sortOrder;

/** 1. PJの目的: ゴールツリーのいちばん上（到達点）。承認済みと承認待ちを分けて返す。中止したものは出さない。 */
export function overviewPurpose(tree: GoalTreeLike) {
  const goals = (tree?.allQuestions ?? []).filter(
    (question) => question.questionKind === "goal" && !question.parentId && question.status !== "dropped",
  );
  return {
    accepted: goals.filter((question) => !question.isProposed).sort(byDue),
    proposed: goals.filter((question) => question.isProposed).sort(byDue),
  };
}

/** 2. 出身: Venture Map の登録を先に、無ければ元になる技術（シーズ）の登録から。 */
export function overviewOrigin(overview: Pick<ProjectOverviewPayload, "venture" | "seeds">) {
  const seed = overview.seeds[0] ?? null;
  return {
    org: overview.venture?.originOrg || seed?.orgName || null,
    person: overview.venture?.originPi || seed?.researcherName || null,
  };
}

function isoMonth(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{6}$/.test(value)) return `${value.slice(0, 4)}-${value.slice(4, 6)}`;
  return /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : null;
}

/** 5. AMDが関わる期間: Venture Map の参画期間を先に、無ければ PJ の期間（projects.start_ym / end_ym）。 */
export function overviewPeriod(overview: Pick<ProjectOverviewPayload, "venture" | "identity">) {
  const ventureStart = isoMonth(overview.venture?.supportStartedAt);
  if (ventureStart) return { start: ventureStart, end: isoMonth(overview.venture?.supportEndedAt), source: "venture" as const };
  const projectStart = isoMonth(overview.identity.startYm);
  if (projectStart) return { start: projectStart, end: isoMonth(overview.identity.endYm), source: "project" as const };
  return null;
}

/** 5. AMD側の担当を、PL・PM・クローザー・ほかのメンバーに分ける。 */
export function overviewTeam(members: ProjectOverviewMember[]) {
  const names = (pick: (member: ProjectOverviewMember) => boolean) => members.filter(pick).map((member) => member.name);
  return {
    pls: names((member) => member.isPl),
    pms: names((member) => member.isPm),
    closers: names((member) => member.isCloser),
    others: names((member) => !member.isPl && !member.isPm && !member.isCloser),
  };
}

// ---------------------------------------------------------------------------------------------
// 今の状態
// ---------------------------------------------------------------------------------------------

/** 6. 段階と設立。設立日は会社概要の登記を先に、無ければ Venture Map の設立年月（未来なら予定）。 */
export function overviewStage(overview: Pick<ProjectOverviewPayload, "venture" | "company" | "identity">, today: string) {
  const outcome = overview.venture?.outcomePattern ? VENTURE_OUTCOME_LABELS[overview.venture.outcomePattern] ?? overview.venture.outcomePattern : null;
  const status = PROJECT_STATUS_LABELS[overview.identity.status] ?? overview.identity.status;
  let founding: { kind: "founded" | "planned" | "none"; date: string | null };
  if (overview.company?.incorporatedOn) founding = { kind: "founded", date: overview.company.incorporatedOn };
  else if (overview.venture?.foundedAt) {
    founding = { kind: overview.venture.foundedAt.slice(0, 10) <= today ? "founded" : "planned", date: overview.venture.foundedAt.slice(0, 10) };
  } else if (overview.company?.legalStatus && overview.company.legalStatus !== "pre_incorporation") founding = { kind: "founded", date: null };
  else founding = { kind: "none", date: null };
  return { outcome, status, founding };
}

/** 6. 次の節目: 承認済みで開いているMSのうち、今日以降でいちばん近い期限のもの。期限切れも返す。 */
export function overviewNextMilestone(tree: GoalTreeLike, today: string) {
  const milestones = (tree?.allQuestions ?? []).filter(
    (question) => question.questionKind === "milestone" && !question.isProposed && question.status === "open",
  );
  const dated = milestones.filter((question) => question.dueDate).sort(byDue);
  return {
    next: dated.find((question) => (question.dueDate ?? "") >= today) ?? null,
    overdue: dated.filter((question) => (question.dueDate ?? "") < today),
    undatedCount: milestones.filter((question) => !question.dueDate).length,
    total: milestones.length,
  };
}

/** 8. まだ決まっていないこと: 承認済みで開いている論点・仮説と、承認待ちの数。 */
export function overviewOpenItems(tree: GoalTreeLike, limit = 3) {
  const open = (tree?.allQuestions ?? []).filter(
    (question) =>
      !question.isProposed &&
      question.status === "open" &&
      (question.questionKind === "open" || question.questionKind === "hypothesis"),
  );
  const dueOf = (question: QuestionNode) => question.nextDueDate ?? question.dueDate ?? "9999-12-31";
  const proposals = tree?.proposals ?? [];
  return {
    openCount: open.length,
    overdueCount: open.filter((question) => question.isOverdue).length,
    top: [...open].sort((a, b) => dueOf(a).localeCompare(dueOf(b)) || a.sortOrder - b.sortOrder).slice(0, limit),
    proposalCount: proposals.length,
    proposalQuestions: proposals.filter((proposal) => proposal.kind === "question").length,
    proposalActions: proposals.filter((proposal) => proposal.kind === "action").length,
  };
}

/** 7. 収支の要約に使うシーズンの数字（「収支」タブと同じ値を読む）。 */
export type SeasonSummarySource = {
  periodStartYm: string;
  periodEndYm: string;
  invoiceTotalYen: number;
  memberBudgetYen: number;
  paidSumYen: number;
  finalStockSumYen: number;
};

/** 7. 今のシーズン（無ければいちばん新しいシーズン）の請求とメンバー原資の消化。消化は「収支」タブの棒と同じく支払済み＋未払い残。 */
export function overviewSeason(seasons: SeasonSummarySource[], todayYm: string) {
  if (seasons.length === 0) return null;
  const current =
    seasons.find((season) => season.periodStartYm <= todayYm && todayYm <= season.periodEndYm) ??
    [...seasons].sort((a, b) => b.periodEndYm.localeCompare(a.periodEndYm))[0];
  const consumedYen = current.paidSumYen + current.finalStockSumYen;
  return {
    periodStartYm: current.periodStartYm,
    periodEndYm: current.periodEndYm,
    isCurrent: current.periodStartYm <= todayYm && todayYm <= current.periodEndYm,
    invoiceTotalYen: current.invoiceTotalYen,
    memberBudgetYen: current.memberBudgetYen,
    consumedYen,
    consumedShare: current.memberBudgetYen > 0 ? consumedYen / current.memberBudgetYen : 0,
  };
}
