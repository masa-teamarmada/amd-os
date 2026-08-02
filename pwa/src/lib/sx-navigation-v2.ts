import { dateDistance, isMissingText } from "./project-management-logic.ts";
import type {
  SxBallSide,
  SxConfidence,
  SxDatePrecision,
  SxEvidence,
  SxHypothesis,
  SxJudgmentKey,
  SxManagementBundle,
  SxManagementDecision,
  SxManagementIssue,
  SxManagementMilestone,
  SxManagementPartner,
  SxMilestoneStatus,
  SxPartnerCommitment,
  SxPartnerInteraction,
  SxPartnerRoleKind,
  SxPartnerWorkItem,
  SxRelationshipState,
  SxTechnicalTest,
  SxTrackKey,
  SxValidationRun,
} from "./sx-management";
import {
  SX_PARTNER_STAGE_ORDER,
  sxPartnerStageIndex,
  sxPartnerStageLabel,
} from "./sx-partner-progress.ts";

/**
 * 「成立条件ナビゲーション」v2 (/project/[projectId]/navigation) の表示モデル導出。
 * 全て純関数。sx-management.ts (server-only) の値はimportせず型だけ借りる。
 * DBにない予定日・状態は捏造しない — 欠損は null / 「未確認」系ラベルで明示する。
 *
 * v1 (旧 sx-navigation.ts) からの設計変更点:
 *  - タスクバーは1行1本 (基準計画+予測延伸+前倒しの3レイヤー重ね描画をやめ、単一バー+末尾色分け+ティック+マーカーへ統合)
 *  - 行階層: 重要経路グループ + 4本柱グループ → ゲート(milestone) → 開発テーマ/技術試験・論点・履歴イベント
 *  - 依存線は重要経路の連続ペアだけを対象にした直角(orthogonal)コネクタ
 *  - 関係先は文字カードでなく、共通7段階ステージ軸上の一行比較
 *  - 選択行の詳細を安全な埋め込みフィールドだけで返す (sourceRef等は含めない)
 */

// ---------------------------------------------------------------------------
// 共通ラベル
// ---------------------------------------------------------------------------

export const NAV_PILLARS: Array<{ key: SxTrackKey; label: string; shortLabel: string }> = [
  { key: "business_development", label: "事業開発", shortLabel: "事業" },
  { key: "technology_development", label: "技術開発", shortLabel: "技術" },
  { key: "funding", label: "資金調達", shortLabel: "資金" },
  { key: "organizational_building", label: "体制構築", shortLabel: "体制" },
];

export function navPillarMeta(track: SxTrackKey) {
  return NAV_PILLARS.find((item) => item.key === track) || NAV_PILLARS[0];
}

const MILESTONE_STATUS_LABEL: Record<SxMilestoneStatus, string> = {
  unassessed: "未評価",
  on_track: "順調",
  attention: "注意",
  at_risk: "遅れ懸念",
  blocked: "停止",
  completed: "完了",
};

export function navMilestoneStatusLabel(status: SxMilestoneStatus) {
  return MILESTONE_STATUS_LABEL[status] || "未評価";
}

export type NavTone = "ok" | "watch" | "danger" | "unknown" | "neutral";

function toneForMilestoneStatus(status: SxMilestoneStatus): NavTone {
  if (status === "blocked") return "danger";
  if (status === "attention" || status === "at_risk") return "watch";
  if (status === "completed" || status === "on_track") return "ok";
  return "unknown";
}

function toneForIssueStatus(status: SxManagementIssue["status"]): NavTone {
  if (status === "decided" || status === "closed") return "ok";
  if (status === "on_hold") return "unknown";
  return "neutral";
}

function toneForTestStatus(status: SxTechnicalTest["status"]): NavTone {
  if (status === "passed") return "ok";
  if (status === "failed" || status === "blocked") return "danger";
  if (status === "running") return "watch";
  if (status === "planned") return "neutral";
  return "unknown";
}

const BALL_SIDE_LABEL: Record<SxBallSide, string> = {
  sx: "当方",
  partner: "先方",
  shared: "共同",
  none: "なし",
  unknown: "未確認",
};

export function navBallSideLabel(side: SxBallSide) {
  return BALL_SIDE_LABEL[side] || "未確認";
}

export function navRelationshipStageLabel(stage: SxManagementPartner["relationshipStage"]) {
  return sxPartnerStageLabel(stage);
}

const AGREEMENT_STATE_LABEL: Record<SxManagementPartner["agreementState"], string> = {
  agreed: "合意済み",
  partial: "部分合意",
  unagreed: "未合意",
};

export function navAgreementStateLabel(state: SxManagementPartner["agreementState"]) {
  return AGREEMENT_STATE_LABEL[state] || "未確認";
}

const ROLE_KIND_LABEL: Record<SxPartnerRoleKind, string> = {
  joint_development: "共同開発",
  contract_manufacturing: "製造委託",
  customer: "顧客",
  shareholder_investor: "株主・投資",
  government: "自治体",
  media: "メディア",
  financial_institution: "金融機関",
  university_research: "大学・研究機関",
  support_organization: "支援機関",
  other: "その他",
  unclassified: "未分類",
};

const RELATIONSHIP_STATE_LABEL: Record<SxRelationshipState, string> = {
  candidate: "候補",
  in_progress: "進行中",
  established: "成立",
  on_hold: "保留",
  ended: "終了",
  unconfirmed: "未確認",
};

const DATE_PRECISION_SUFFIX: Record<SxDatePrecision, string> = {
  day: "",
  month: "（日付未確認）",
  unknown: "",
};

export function navFormatDate(value: string | null, precision: SxDatePrecision = "day") {
  if (!value) return "未設定";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${Number(match[2])}/${Number(match[3])}${DATE_PRECISION_SUFFIX[precision] || ""}`;
}

// ---------------------------------------------------------------------------
// 上段: PJ判定帯
// ---------------------------------------------------------------------------

export type NavJudgmentKey = "on_schedule" | "needs_intervention" | "unassessed";

export type NavHeadline = {
  judgmentKey: NavJudgmentKey;
  judgmentLabel: "予定内" | "要介入" | "判定不能";
  reasons: string[];
  finalGateLabel: string;
  finalGateDate: string | null;
  finalGateDateCertainty: "confirmed" | "provisional" | null;
  nextDeadlineDate: string | null;
  nextDeadlineLabel: string;
  bottleneckLabel: string;
  bottleneckMilestoneSlug: string | null;
  pendingDecisionCount: number;
  dagValid: boolean;
  /** 判定が「未評価」でも見落とさないよう、予定→予測の乖離だけを別軸で持つ。判定信頼度とは混ぜない。 */
  forecastComparableCount: number;
  forecastSlipCount: number;
  maxForecastSlipDays: number | null;
  maxForecastSlipTitle: string | null;
  forecastSlipLabel: string;
};

function navJudgmentFromKey(key: SxJudgmentKey): { key: NavJudgmentKey; label: NavHeadline["judgmentLabel"] } {
  if (key === "on_track") return { key: "on_schedule", label: "予定内" };
  if (key === "unassessed") return { key: "unassessed", label: "判定不能" };
  return { key: "needs_intervention", label: "要介入" };
}

function computeForecastSlip(milestones: readonly SxManagementMilestone[]) {
  const comparable = milestones.filter((milestone) =>
    milestone.status !== "completed"
    && Boolean(milestone.plannedEnd)
    && Boolean(milestone.forecastEnd)
    && milestone.deltaDays != null);
  const slipped = comparable
    .filter((milestone) => (milestone.deltaDays as number) > 0)
    .sort((a, b) => (b.deltaDays as number) - (a.deltaDays as number));
  const worst = slipped[0] || null;
  return {
    forecastComparableCount: comparable.length,
    forecastSlipCount: slipped.length,
    maxForecastSlipDays: worst?.deltaDays ?? null,
    maxForecastSlipTitle: worst?.title ?? null,
  };
}

function navHeadline(input: {
  objective: { title: string; targetDate: string | null; dateCertainty: "confirmed" | "provisional" } | null;
  judgmentKey: SxJudgmentKey;
  judgmentReasons: string[];
  nextDeadline: string | null;
  milestones: readonly SxManagementMilestone[];
  criticalPathSlugs: readonly string[];
  dagValid: boolean;
  decisions: readonly SxManagementDecision[];
}): NavHeadline {
  const judgment = navJudgmentFromKey(input.judgmentKey);
  const milestoneBySlug = new Map(input.milestones.map((milestone) => [milestone.slug, milestone]));
  const bottleneck = input.dagValid
    ? input.criticalPathSlugs.map((slug) => milestoneBySlug.get(slug)).find((milestone) =>
      milestone && milestone.status !== "completed" && milestone.status !== "on_track")
    : undefined;
  const slip = computeForecastSlip(input.milestones);

  return {
    judgmentKey: judgment.key,
    judgmentLabel: judgment.label,
    reasons: input.judgmentReasons,
    finalGateLabel: input.objective?.title || "最終ゲート未設定",
    finalGateDate: input.objective?.targetDate ?? null,
    finalGateDateCertainty: input.objective?.dateCertainty ?? null,
    nextDeadlineDate: input.nextDeadline,
    nextDeadlineLabel: input.nextDeadline ? navFormatDate(input.nextDeadline) : "期限未設定",
    bottleneckLabel: !input.dagValid
      ? "未評価（依存関係が循環）"
      : input.criticalPathSlugs.length === 0
        ? "未評価（重要経路未確定）"
        : bottleneck
          ? `${bottleneck.title}（${navMilestoneStatusLabel(bottleneck.status)}）`
          : "現時点で詰まりなし",
    bottleneckMilestoneSlug: bottleneck?.slug ?? null,
    pendingDecisionCount: input.decisions.filter((decision) => decision.status === "open").length,
    dagValid: input.dagValid,
    forecastComparableCount: slip.forecastComparableCount,
    forecastSlipCount: slip.forecastSlipCount,
    maxForecastSlipDays: slip.maxForecastSlipDays,
    maxForecastSlipTitle: slip.maxForecastSlipTitle,
    forecastSlipLabel: slip.forecastComparableCount === 0
      ? "予測差分未算定"
      : slip.forecastSlipCount === 0
        ? `予測遅延なし（比較${slip.forecastComparableCount}件）`
        : `最大+${slip.maxForecastSlipDays}日 ・ ${slip.forecastSlipCount}件（${slip.maxForecastSlipTitle}）`,
  };
}

// ---------------------------------------------------------------------------
// 時間軸スケール
// ---------------------------------------------------------------------------

export type NavTimelineScale = {
  hasDates: boolean;
  startDate: string | null;
  endDate: string | null;
  totalDays: number;
  pct: (date: string | null | undefined) => number | null;
  todayPct: number | null;
};

const TIMELINE_PADDING_RATIO = 0.06;

function buildNavTimelineScale(dateSamples: readonly (string | null | undefined)[], asOf: string): NavTimelineScale {
  const dates: string[] = [];
  for (const value of dateSamples) {
    if (value) dates.push(value.slice(0, 10));
  }
  if (dates.length === 0) {
    return { hasDates: false, startDate: null, endDate: null, totalDays: 0, pct: () => null, todayPct: null };
  }
  dates.push(asOf);
  dates.sort();
  const rawStart = dates[0];
  const rawEnd = dates[dates.length - 1];
  const spanDays = Math.max(1, dateDistance(rawStart, rawEnd));
  const padDays = Math.max(1, Math.round(spanDays * TIMELINE_PADDING_RATIO));
  const startDate = shiftDate(rawStart, -padDays);
  const endDate = shiftDate(rawEnd, padDays);
  const totalDays = Math.max(1, dateDistance(startDate, endDate));

  const pct = (date: string | null | undefined): number | null => {
    if (!date) return null;
    const offset = dateDistance(startDate, date.slice(0, 10));
    return Math.max(0, Math.min(100, (offset / totalDays) * 100));
  };

  return { hasDates: true, startDate, endDate, totalDays, pct, todayPct: pct(asOf) };
}

function shiftDate(value: string, days: number) {
  const ms = Date.parse(`${value}T00:00:00.000Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export type NavAxisTick = { label: string; pct: number };

function buildNavAxisTicks(scale: NavTimelineScale): NavAxisTick[] {
  if (!scale.hasDates || !scale.startDate || !scale.endDate) return [];
  const start = new Date(`${scale.startDate}T00:00:00.000Z`);
  const end = new Date(`${scale.endDate}T00:00:00.000Z`);
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  if (cursor.getTime() < start.getTime()) cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  const ticks: NavAxisTick[] = [];
  let guard = 0;
  while (cursor.getTime() <= end.getTime() && guard < 84) {
    const iso = cursor.toISOString().slice(0, 10);
    const pct = scale.pct(iso);
    if (pct != null) ticks.push({ label: `${cursor.getUTCFullYear()}/${cursor.getUTCMonth() + 1}`, pct });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    guard += 1;
  }
  return ticks;
}

/** 画面へ渡す、関数を持たないserializable版タイムラインスケール。 */
export type NavTimelineScaleView = {
  hasDates: boolean;
  startDate: string | null;
  endDate: string | null;
  totalDays: number;
  todayPct: number | null;
  axisTicks: NavAxisTick[];
};

function toTimelineScaleView(scale: NavTimelineScale): NavTimelineScaleView {
  return {
    hasDates: scale.hasDates,
    startDate: scale.startDate,
    endDate: scale.endDate,
    totalDays: scale.totalDays,
    todayPct: scale.todayPct,
    axisTicks: buildNavAxisTicks(scale),
  };
}

// ---------------------------------------------------------------------------
// 単一バー (1行1本)
// ---------------------------------------------------------------------------

export type NavBar = {
  startPct: number;
  endPct: number;
  /** 予定終了の位置。予測延伸がある時だけバー内の縦ティックとして描く。 */
  plannedEndTickPct: number | null;
  /** 予測が計画を超えて延びた分 (plannedEnd〜forecastEnd)。存在する時だけ末尾を別色で塗る。 */
  delaySegment: { startPct: number; endPct: number } | null;
  delayDays: number | null;
  /** forecastEndが計画より早い(前倒し)場合の日数。捏造せず、算出できない時はnull。 */
  pulledInDays: number | null;
  progressMarkerPct: number | null;
};

function buildNavBar(
  scale: NavTimelineScale,
  m: Pick<SxManagementMilestone, "plannedStart" | "plannedEnd" | "forecastEnd" | "actualEnd" | "progressPct">,
): NavBar | null {
  const startPct = scale.pct(m.plannedStart);
  const plannedEndPct = scale.pct(m.plannedEnd);
  if (startPct == null || plannedEndPct == null) return null;
  const forecastEndPct = scale.pct(m.forecastEnd);
  const actualEndPct = scale.pct(m.actualEnd);

  let delayDays: number | null = null;
  let pulledInDays: number | null = null;
  let delaySegment: { startPct: number; endPct: number } | null = null;
  let endPct = plannedEndPct;

  if (forecastEndPct != null && m.forecastEnd && m.plannedEnd) {
    if (forecastEndPct > plannedEndPct) {
      delayDays = dateDistance(m.plannedEnd, m.forecastEnd);
      delaySegment = { startPct: plannedEndPct, endPct: forecastEndPct };
      endPct = forecastEndPct;
    } else if (forecastEndPct < plannedEndPct) {
      pulledInDays = dateDistance(m.forecastEnd, m.plannedEnd);
    }
  }

  const span = Math.max(0.001, endPct - startPct);
  let progressMarkerPct: number | null = null;
  if (m.actualEnd && actualEndPct != null) {
    progressMarkerPct = Math.min(endPct, Math.max(startPct, actualEndPct));
  } else if (m.progressPct > 0) {
    progressMarkerPct = startPct + span * (Math.min(100, m.progressPct) / 100);
  }

  return {
    startPct,
    endPct,
    plannedEndTickPct: delaySegment ? plannedEndPct : null,
    delaySegment,
    delayDays,
    pulledInDays,
    progressMarkerPct,
  };
}

// ---------------------------------------------------------------------------
// 行階層 (重要経路グループ / 4本柱グループ → ゲート → テーマ・論点・履歴)
// ---------------------------------------------------------------------------

export type NavRowKind = "critical_group" | "pillar_group" | "milestone" | "technical_test" | "issue" | "history_event";

export type NavRow = {
  id: string;
  kind: NavRowKind;
  parentId: string | null;
  depth: number;
  label: string;
  subLabel: string | null;
  ownerLabel: string | null;
  progressLabel: string | null;
  statusLabel: string;
  tone: NavTone;
  isCritical: boolean;
  isBlocked: boolean;
  hasChildren: boolean;
  defaultExpanded: boolean;
  selectable: boolean;
  /** details マップへのキー。selectable=falseの行はnull。 */
  detailId: string | null;
  bar: NavBar | null;
  /** バーを描けない行の単一時点 (論点期限・履歴イベント日)。 */
  pointPct: number | null;
  pointLabel: string | null;
  dateUnsetLabel: string | null;
};

function buildGroupBar(scale: NavTimelineScale, milestones: readonly SxManagementMilestone[]): NavBar | null {
  const dated = milestones.filter((milestone) => milestone.plannedStart && milestone.plannedEnd);
  if (dated.length === 0) return null;
  const plannedStart = dated.map((milestone) => milestone.plannedStart as string).sort()[0];
  const plannedEnd = dated.map((milestone) => milestone.plannedEnd as string).sort().at(-1) as string;
  const forecastEnds = dated.map((milestone) => milestone.forecastEnd).filter((value): value is string => Boolean(value)).sort();
  return buildNavBar(scale, {
    plannedStart,
    plannedEnd,
    forecastEnd: forecastEnds.at(-1) || plannedEnd,
    actualEnd: null,
    progressPct: 0,
  });
}

// 「回収」開発テーマ (tech-recovery-test) 配下にDy検証4段階をUI側で親子付けする命名規約。
// DBに親子列は追加していない — test_slug prefixだけで判定する。
const DY_PARENT_TEST_SLUG = "tech-recovery-test";
const DY_CHILD_TEST_ORDER = [
  "tech-recovery-dy-adsorption-screening",
  "tech-recovery-dy-real-effluent",
  "tech-recovery-dy-acid-desorption",
  "tech-recovery-dy-cycle-durability",
];

function milestoneDefaultExpanded(m: SxManagementMilestone) {
  return m.status === "attention" || m.status === "at_risk" || m.status === "blocked";
}

function buildMilestoneRow(args: {
  id: string;
  parentId: string;
  depth: number;
  milestone: SxManagementMilestone;
  scale: NavTimelineScale;
  isCritical: boolean;
  hasChildren: boolean;
}): NavRow {
  const { id, parentId, depth, milestone, scale, isCritical, hasChildren } = args;
  const bar = buildNavBar(scale, milestone);
  return {
    id,
    kind: "milestone",
    parentId,
    depth,
    label: milestone.title,
    subLabel: milestone.gate,
    ownerLabel: milestone.ownerLabel,
    progressLabel: `${milestone.progressPct}%`,
    statusLabel: navMilestoneStatusLabel(milestone.status),
    tone: toneForMilestoneStatus(milestone.status),
    isCritical,
    isBlocked: milestone.isBlocked,
    hasChildren,
    defaultExpanded: isCritical || milestoneDefaultExpanded(milestone),
    selectable: true,
    detailId: `milestone:${milestone.slug}`,
    bar,
    pointPct: null,
    pointLabel: null,
    dateUnsetLabel: bar ? null : "日程未設定",
  };
}

function buildTechnicalTestRow(args: {
  id: string;
  parentId: string;
  depth: number;
  test: SxTechnicalTest;
  scale: NavTimelineScale;
  hasChildren: boolean;
}): NavRow {
  const { id, parentId, depth, test, scale, hasChildren } = args;
  const pointPct = test.measuredOn ? scale.pct(test.measuredOn) : null;
  return {
    id,
    kind: "technical_test",
    parentId,
    depth,
    label: test.testName,
    subLabel: test.testCondition,
    ownerLabel: test.ownerLabel,
    progressLabel: null,
    statusLabel: TEST_STATUS_LABEL[test.status] || "未評価",
    tone: toneForTestStatus(test.status),
    isCritical: false,
    isBlocked: test.status === "blocked",
    hasChildren,
    defaultExpanded: test.status === "running" || test.status === "failed" || test.status === "blocked",
    selectable: true,
    detailId: `test:${test.testSlug}`,
    bar: null,
    pointPct,
    pointLabel: test.measuredOn ? `測定 ${navFormatDate(test.measuredOn)}` : null,
    dateUnsetLabel: test.measuredOn ? null : "測定日未設定",
  };
}

const TEST_STATUS_LABEL: Record<SxTechnicalTest["status"], string> = {
  unassessed: "未評価",
  planned: "計画",
  running: "実施中",
  passed: "合格",
  failed: "不合格",
  blocked: "停止",
};

const ISSUE_STATUS_LABEL: Record<SxManagementIssue["status"], string> = {
  open: "未着手",
  validating: "検証中",
  decided: "判断済み",
  closed: "完了",
  on_hold: "保留",
};

function buildIssueRow(args: {
  id: string;
  parentId: string;
  depth: number;
  issue: SxManagementIssue;
  scale: NavTimelineScale;
}): NavRow {
  const { id, parentId, depth, issue, scale } = args;
  const pointPct = issue.dueDate ? scale.pct(issue.dueDate) : null;
  const hasOpenDecision = issue.decisions.some((decision) => decision.status === "open");
  return {
    id,
    kind: "issue",
    parentId,
    depth,
    label: issue.title,
    subLabel: hasOpenDecision ? "意思決定待ち" : null,
    ownerLabel: issue.ownerLabel,
    progressLabel: null,
    statusLabel: ISSUE_STATUS_LABEL[issue.status] || "未確認",
    tone: hasOpenDecision ? "watch" : toneForIssueStatus(issue.status),
    isCritical: false,
    isBlocked: false,
    hasChildren: false,
    defaultExpanded: false,
    selectable: true,
    detailId: `issue:${issue.slug}`,
    bar: null,
    pointPct,
    pointLabel: issue.dueDate ? `期限 ${navFormatDate(issue.dueDate)}` : null,
    dateUnsetLabel: issue.dueDate ? null : "期限未設定",
  };
}

function buildHistoryEventRow(args: {
  id: string;
  parentId: string;
  depth: number;
  evidence: SxEvidence;
  scale: NavTimelineScale;
}): NavRow {
  const { id, parentId, depth, evidence, scale } = args;
  const pointPct = evidence.observedOn ? scale.pct(evidence.observedOn) : null;
  return {
    id,
    kind: "history_event",
    parentId,
    depth,
    label: evidence.summary,
    subLabel: "履歴イベント",
    ownerLabel: null,
    progressLabel: null,
    statusLabel: "確認済み",
    tone: "neutral",
    isCritical: false,
    isBlocked: false,
    hasChildren: false,
    defaultExpanded: false,
    selectable: true,
    detailId: `history:${evidence.id}`,
    bar: null,
    pointPct,
    pointLabel: evidence.observedOn ? navFormatDate(evidence.observedOn) : null,
    dateUnsetLabel: evidence.observedOn ? null : "日付未確認",
  };
}

export type NavDependencyEdge = { id: string; fromSlug: string; toSlug: string; order: number };

function buildCriticalEdges(criticalPathSlugs: readonly string[]): NavDependencyEdge[] {
  const edges: NavDependencyEdge[] = [];
  for (let index = 0; index < criticalPathSlugs.length - 1; index += 1) {
    edges.push({
      id: `edge:${criticalPathSlugs[index]}->${criticalPathSlugs[index + 1]}`,
      fromSlug: criticalPathSlugs[index],
      toSlug: criticalPathSlugs[index + 1],
      order: index,
    });
  }
  return edges;
}

// ---------------------------------------------------------------------------
// 選択詳細ペイン用データ (安全なフィールドだけ埋め込む。sourceRefは含めない)
// ---------------------------------------------------------------------------

export type NavMilestoneDetail = {
  kind: "milestone";
  id: string;
  slug: string;
  /** 論点・技術試験を追加するときの親付け先として、詳細ペインから安全に参照できるIDだけを持つ。 */
  objectiveId: string;
  outcomeId: string;
  title: string;
  gate: string;
  track: SxTrackKey;
  status: SxMilestoneStatus;
  statusLabel: string;
  ownerLabel: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  forecastEnd: string | null;
  actualEnd: string | null;
  progressPct: number;
  completionCriteria: string;
  completionEvidence: string | null;
  nextDeliverable: string;
  maxIssue: string;
  forecastChangeReason: string | null;
  confidence: SxConfidence;
  lastVerifiedAt: string;
  /** Optimistic-concurrency token — sent back as expected_version on PATCH. */
  version: number;
};

export type NavHypothesisDetail = {
  id: string;
  statement: string;
  status: SxHypothesis["status"];
  ownerLabel: string;
  dueDate: string | null;
  confidence: SxConfidence;
};

export type NavEvidenceDetail = {
  id: string;
  hypothesisId: string | null;
  kind: SxEvidence["kind"];
  summary: string;
  observedOn: string | null;
  sourceLabel: string;
  confidence: SxConfidence;
};

export type NavValidationDetail = {
  id: string;
  hypothesisId: string;
  validationKind: string;
  status: SxValidationRun["status"];
  plannedOn: string | null;
  dueDate: string | null;
  completedOn: string | null;
  ownerLabel: string;
  method: string;
  resultSummary: string | null;
  confidence: SxConfidence;
};

export type NavActionDetail = {
  id: string;
  title: string;
  ownerLabel: string;
  dueDate: string | null;
  status: "open" | "in_progress" | "completed" | "blocked";
  completionCriteria: string;
  nextReviewOn: string | null;
  completionNote: string | null;
  completedAt: string | null;
};

export type NavDecisionDetail = {
  id: string;
  hypothesisId: string | null;
  title: string;
  context: string;
  status: "open" | "decided" | "deferred";
  rationale: string;
  decisionText: string | null;
  decidedBy: string | null;
  decidedOn: string | null;
  ownerLabel: string;
  dueDate: string | null;
  isThisWeek: boolean;
  confidence: SxConfidence;
  actionItems: NavActionDetail[];
};

export type NavIssueDetail = {
  kind: "issue";
  id: string;
  slug: string;
  title: string;
  track: SxTrackKey;
  knowledgeType: SxManagementIssue["knowledgeType"];
  status: SxManagementIssue["status"];
  statusLabel: string;
  ownerLabel: string;
  dueDate: string | null;
  confidence: SxConfidence;
  lastVerifiedAt: string;
  hypotheses: NavHypothesisDetail[];
  evidence: NavEvidenceDetail[];
  validations: NavValidationDetail[];
  decisions: NavDecisionDetail[];
};

export type NavTechnicalTestDetail = {
  kind: "technical_test";
  id: string;
  milestoneId: string | null;
  outcomeId: string | null;
  testSlug: string;
  testName: string;
  testCondition: string;
  target: string | null;
  actual: string | null;
  unit: string;
  repetition: number | null;
  trlCriterion: string;
  evidence: string | null;
  status: SxTechnicalTest["status"];
  statusLabel: string;
  measuredOn: string | null;
  ownerLabel: string;
  confidence: SxConfidence;
};

export type NavHistoryEventDetail = {
  kind: "history_event";
  id: string;
  issueId: string;
  hypothesisId: string | null;
  summary: string;
  observedOn: string | null;
  evidenceKind: SxEvidence["kind"];
  sourceLabel: string;
  confidence: SxConfidence;
};

export type NavDetail = NavMilestoneDetail | NavIssueDetail | NavTechnicalTestDetail | NavHistoryEventDetail;

function buildMilestoneDetail(m: SxManagementMilestone): NavMilestoneDetail {
  return {
    kind: "milestone",
    id: m.id,
    slug: m.slug,
    objectiveId: m.objectiveId,
    outcomeId: m.outcomeId,
    title: m.title,
    gate: m.gate,
    track: m.track,
    status: m.status,
    statusLabel: navMilestoneStatusLabel(m.status),
    ownerLabel: m.ownerLabel,
    plannedStart: m.plannedStart,
    plannedEnd: m.plannedEnd,
    forecastEnd: m.forecastEnd,
    actualEnd: m.actualEnd,
    progressPct: m.progressPct,
    completionCriteria: m.completionCriteria,
    completionEvidence: m.completionEvidence,
    nextDeliverable: m.nextDeliverable,
    maxIssue: m.maxIssue,
    forecastChangeReason: m.forecastChangeReason,
    confidence: m.confidence,
    lastVerifiedAt: m.lastVerifiedAt,
    version: m.version,
  };
}

function buildIssueDetail(issue: SxManagementIssue): NavIssueDetail {
  return {
    kind: "issue",
    id: issue.id,
    slug: issue.slug,
    title: issue.title,
    track: issue.track,
    knowledgeType: issue.knowledgeType,
    status: issue.status,
    statusLabel: ISSUE_STATUS_LABEL[issue.status] || "未確認",
    ownerLabel: issue.ownerLabel,
    dueDate: issue.dueDate,
    confidence: issue.confidence,
    lastVerifiedAt: issue.lastVerifiedAt,
    hypotheses: issue.hypotheses.map((h) => ({
      id: h.id, statement: h.statement, status: h.status, ownerLabel: h.ownerLabel, dueDate: h.dueDate, confidence: h.confidence,
    })),
    evidence: issue.evidence.map((e) => ({
      id: e.id, hypothesisId: e.hypothesisId, kind: e.kind, summary: e.summary, observedOn: e.observedOn, sourceLabel: e.sourceLabel, confidence: e.confidence,
    })),
    validations: issue.validationRuns.map((v) => ({
      id: v.id, hypothesisId: v.hypothesisId, validationKind: v.validationKind, status: v.status, plannedOn: v.plannedOn,
      dueDate: v.dueDate, completedOn: v.completedOn, ownerLabel: v.ownerLabel, method: v.method, resultSummary: v.resultSummary, confidence: v.confidence,
    })),
    decisions: issue.decisions.map((d) => ({
      id: d.id, hypothesisId: d.hypothesisId, title: d.title, context: d.context, status: d.status, rationale: d.rationale,
      decisionText: d.decisionText, decidedBy: d.decidedBy, decidedOn: d.decidedOn, ownerLabel: d.ownerLabel, dueDate: d.dueDate,
      isThisWeek: d.isThisWeek,
      confidence: d.confidence,
      actionItems: d.actionItems.map((a) => ({
        id: a.id, title: a.title, ownerLabel: a.ownerLabel, dueDate: a.dueDate, status: a.status,
        completionCriteria: a.completionCriteria, nextReviewOn: a.nextReviewOn, completionNote: a.completionNote, completedAt: a.completedAt,
      })),
    })),
  };
}

function buildTechnicalTestDetail(t: SxTechnicalTest): NavTechnicalTestDetail {
  return {
    kind: "technical_test",
    id: t.id,
    milestoneId: t.milestoneId,
    outcomeId: t.outcomeId,
    testSlug: t.testSlug,
    testName: t.testName,
    testCondition: t.testCondition,
    target: t.target,
    actual: t.actual,
    unit: t.unit,
    repetition: t.repetition,
    trlCriterion: t.trlCriterion,
    evidence: t.evidence,
    status: t.status,
    statusLabel: TEST_STATUS_LABEL[t.status] || "未評価",
    measuredOn: t.measuredOn,
    ownerLabel: t.ownerLabel,
    confidence: t.confidence,
  };
}

function buildHistoryEventDetail(e: SxEvidence): NavHistoryEventDetail {
  return {
    kind: "history_event",
    id: e.id,
    issueId: e.issueId,
    hypothesisId: e.hypothesisId,
    summary: e.summary,
    observedOn: e.observedOn,
    evidenceKind: e.kind,
    sourceLabel: e.sourceLabel,
    confidence: e.confidence,
  };
}

// ---------------------------------------------------------------------------
// 関係先比較レーン: 共通7段階ステージ軸上の一行比較
// ---------------------------------------------------------------------------

export const NAV_PARTNER_STAGE_ORDER: SxManagementPartner["relationshipStage"][] = [...SX_PARTNER_STAGE_ORDER];

export type NavPartnerRow = {
  id: string;
  slug: string;
  name: string;
  roleLabel: string;
  groupKind: "structured_role" | "display_label_poc" | "unclassified";
  isOnHold: boolean;
  /** 1-7 (candidate..executing)。on_holdはnull — 「関係段階 X/7」の比較軸であり、成果達成率ではない。 */
  stageIndex: number | null;
  stageLabel: string;
  agreementStateLabel: string;
  currentBallSide: SxBallSide;
  currentBallSideLabel: string;
  currentBallOwner: string | null;
  isOverdue: boolean;
  dueDate: string | null;
  dueDatePrecision: SxDatePrecision;
  dueDateLabel: string;
  nextHandoffLabel: string;
  targetStateLabel: string;
  lastContactDate: string | null;
  sortPriority: number;
};

function derivePartnerGroup(partner: SxManagementPartner): { label: string; kind: NavPartnerRow["groupKind"] } {
  const primaryRole = partner.roles.find((role) => role.isPrimary) || partner.roles[0];
  if (primaryRole) {
    return {
      label: `${ROLE_KIND_LABEL[primaryRole.roleKind] || "未分類"}（${RELATIONSHIP_STATE_LABEL[primaryRole.relationshipState] || "未確認"}）`,
      kind: "structured_role",
    };
  }
  const displayLabel = partner.roleLabel || "";
  if (displayLabel.includes("PoC候補") || displayLabel.includes("PoC接触")) {
    return { label: "PoC候補・接触（表示ラベル由来）", kind: "display_label_poc" };
  }
  return { label: "役割未分類", kind: "unclassified" };
}

function buildNavPartnerRow(partner: SxManagementPartner, asOf: string): NavPartnerRow {
  const group = derivePartnerGroup(partner);
  const isOnHold = partner.relationshipStage === "on_hold" || partner.deferredLowPriority;
  const stageIndex = isOnHold ? null : sxPartnerStageIndex(partner.relationshipStage);

  const openWorkItems = partner.workItems
    .filter((item) => item.status === "open" || item.status === "in_progress" || item.status === "waiting")
    .sort((left, right) => (left.dueDate || "9999-12-31").localeCompare(right.dueDate || "9999-12-31"));
  const openCommitments = partner.commitments
    .filter((item) => item.status === "open" || item.status === "in_progress")
    .sort((left, right) => (left.dueDate || "9999-12-31").localeCompare(right.dueDate || "9999-12-31"));
  const nextWorkItem = openWorkItems[0];
  const nextCommitment = openCommitments[0];
  const nextHandoffLabel = nextWorkItem
    ? `${nextWorkItem.title}${nextWorkItem.handoffTo ? `（→${nextWorkItem.handoffTo}）` : ""}`
    : nextCommitment
      ? nextCommitment.title
      : partner.nextCommitment && !isMissingText(partner.nextCommitment)
        ? partner.nextCommitment
        : "次の受け渡し未確認";

  const isOverdue = Boolean(
    partner.agreementState !== "agreed"
    && partner.dueDate
    && partner.dueDatePrecision === "day"
    && partner.dueDate < asOf,
  );

  const sortPriority = isOnHold ? 40
    : isOverdue ? 0
      : partner.currentBallSide === "sx" ? 10
        : 20;

  return {
    id: partner.id,
    slug: partner.slug,
    name: partner.name,
    roleLabel: group.label,
    groupKind: group.kind,
    isOnHold,
    stageIndex,
    stageLabel: isOnHold ? "保留" : navRelationshipStageLabel(partner.relationshipStage),
    agreementStateLabel: navAgreementStateLabel(partner.agreementState),
    currentBallSide: partner.currentBallSide,
    currentBallSideLabel: navBallSideLabel(partner.currentBallSide),
    currentBallOwner: partner.currentBallOwner,
    isOverdue,
    dueDate: partner.dueDate,
    dueDatePrecision: partner.dueDatePrecision,
    dueDateLabel: navFormatDate(partner.dueDate, partner.dueDatePrecision),
    nextHandoffLabel,
    targetStateLabel: partner.targetState && !isMissingText(partner.targetState) ? partner.targetState : "目標状態未設定",
    lastContactDate: partner.lastContactDate,
    sortPriority,
  };
}

export type NavPartnerInteractionDetail = {
  id: string;
  interactionKind: SxPartnerInteraction["interactionKind"];
  occurredOn: string | null;
  occurredOnPrecision: SxDatePrecision;
  summary: string;
  outcomeSummary: string | null;
  ballSideAfter: SxBallSide;
  ballOwnerAfter: string | null;
  actorSide: SxPartnerInteraction["actorSide"];
  actorLabel: string | null;
};

export type NavPartnerWorkItemDetail = {
  id: string;
  side: SxPartnerWorkItem["side"];
  itemKind: SxPartnerWorkItem["itemKind"];
  title: string;
  detail: string | null;
  ownerLabel: string | null;
  status: SxPartnerWorkItem["status"];
  dueDate: string | null;
  dueDatePrecision: SxDatePrecision;
  completionCriteria: string | null;
  completedOn: string | null;
  completionEvidence: string | null;
  acceptedBy: string | null;
  acceptedOn: string | null;
  handoffTo: string | null;
  relatedMilestoneId: string | null;
  confidence: SxConfidence;
};

export type NavPartnerCommitmentDetail = {
  id: string;
  title: string;
  commitmentText: string;
  commitmentKind: SxPartnerCommitment["commitmentKind"];
  status: SxPartnerCommitment["status"];
  promisedOn: string | null;
  dueDate: string | null;
  completedOn: string | null;
  ownerLabel: string;
  counterpartyOwner: string | null;
  sxOwner: string | null;
};

export type NavPartnerDetail = {
  id: string;
  slug: string;
  name: string;
  roleLabel: string;
  relationshipStage: SxManagementPartner["relationshipStage"];
  relationshipStageLabel: string;
  agreementState: SxManagementPartner["agreementState"];
  agreedScope: string;
  unagreedScope: string;
  lastContactDate: string | null;
  targetState: string | null;
  dueDate: string | null;
  dueDatePrecision: SxDatePrecision;
  ownerLabel: string;
  currentBallSide: SxBallSide;
  currentBallOwner: string | null;
  nextBallOwner: string | null;
  nextCommitment: string;
  confidence: SxConfidence;
  interactions: NavPartnerInteractionDetail[];
  workItems: NavPartnerWorkItemDetail[];
  commitments: NavPartnerCommitmentDetail[];
};

function buildPartnerDetail(partner: SxManagementPartner): NavPartnerDetail {
  return {
    id: partner.id,
    slug: partner.slug,
    name: partner.name,
    roleLabel: partner.roleLabel,
    relationshipStage: partner.relationshipStage,
    relationshipStageLabel: navRelationshipStageLabel(partner.relationshipStage),
    agreementState: partner.agreementState,
    agreedScope: partner.agreedScope,
    unagreedScope: partner.unagreedScope,
    lastContactDate: partner.lastContactDate,
    targetState: partner.targetState,
    dueDate: partner.dueDate,
    dueDatePrecision: partner.dueDatePrecision,
    ownerLabel: partner.ownerLabel,
    currentBallSide: partner.currentBallSide,
    currentBallOwner: partner.currentBallOwner,
    nextBallOwner: partner.nextBallOwner,
    nextCommitment: partner.nextCommitment,
    confidence: partner.confidence,
    interactions: [...partner.interactions]
      .sort((a, b) => (b.occurredOn || b.createdAt || "").localeCompare(a.occurredOn || a.createdAt || ""))
      .map((i) => ({
        id: i.id, interactionKind: i.interactionKind, occurredOn: i.occurredOn, occurredOnPrecision: i.occurredOnPrecision,
        summary: i.summary, outcomeSummary: i.outcomeSummary, ballSideAfter: i.ballSideAfter, ballOwnerAfter: i.ballOwnerAfter,
        actorSide: i.actorSide, actorLabel: i.actorLabel,
      })),
    workItems: [...partner.workItems]
      .sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31"))
      .map((w) => ({
        id: w.id, side: w.side, itemKind: w.itemKind, title: w.title, detail: w.detail, ownerLabel: w.ownerLabel,
        status: w.status, dueDate: w.dueDate, dueDatePrecision: w.dueDatePrecision, completionCriteria: w.completionCriteria,
        completedOn: w.completedOn, completionEvidence: w.completionEvidence, acceptedBy: w.acceptedBy, acceptedOn: w.acceptedOn,
        handoffTo: w.handoffTo, relatedMilestoneId: w.relatedMilestoneId, confidence: w.confidence,
      })),
    commitments: [...partner.commitments]
      .sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31"))
      .map((c) => ({
        id: c.id, title: c.title, commitmentText: c.commitmentText, commitmentKind: c.commitmentKind, status: c.status,
        promisedOn: c.promisedOn, dueDate: c.dueDate, completedOn: c.completedOn, ownerLabel: c.ownerLabel,
        counterpartyOwner: c.counterpartyOwner, sxOwner: c.sxOwner,
      })),
  };
}

// ---------------------------------------------------------------------------
// 画面専用 view model — Client Componentへ渡す唯一の窓口
// ---------------------------------------------------------------------------

export type SxNavigationViewModelV2 = {
  projectId: string;
  projectName: string;
  asOf: string;
  hasData: boolean;
  canManage: boolean;
  dataIssues: number;
  headline: NavHeadline;
  timelineScale: NavTimelineScaleView;
  rows: NavRow[];
  edges: NavDependencyEdge[];
  details: Record<string, NavDetail>;
  partners: NavPartnerRow[];
  partnerDetails: Record<string, NavPartnerDetail>;
  /** 柱ごとの代表objective/outcome ID。新規ゲート追加フォームの親付け先の初期値にする（機微情報ではない）。 */
  pillarDefaults: Partial<Record<SxTrackKey, { objectiveId: string; outcomeId: string }>>;
};

export function buildSxNavigationViewModel(input: {
  project: { projectId: string; projectName: string };
  sxManagement: SxManagementBundle;
}): SxNavigationViewModelV2 {
  const mgmt = input.sxManagement;
  const asOf = mgmt.asOf;
  const effectiveCriticalPathSlugs = mgmt.judgment.dagValid ? mgmt.judgment.criticalPathSlugs : [];
  const criticalPathSlugSet = new Set(effectiveCriticalPathSlugs);

  const headline = navHeadline({
    objective: mgmt.objective,
    judgmentKey: mgmt.judgment.key,
    judgmentReasons: mgmt.judgment.reasons,
    nextDeadline: mgmt.judgment.nextDeadline,
    milestones: mgmt.milestones,
    criticalPathSlugs: mgmt.judgment.criticalPathSlugs,
    dagValid: mgmt.judgment.dagValid,
    decisions: mgmt.decisions,
  });

  const historyEvidence = mgmt.evidence.filter((e) => e.kind === "observation" && Boolean(e.observedOn));
  const scale = buildNavTimelineScale(
    [
      ...mgmt.milestones.flatMap((m) => [m.plannedStart, m.plannedEnd, m.forecastEnd, m.actualEnd]),
      ...historyEvidence.map((e) => e.observedOn),
    ],
    asOf,
  );

  const issueById = new Map(mgmt.issues.map((issue) => [issue.id, issue]));
  const issuesByMilestoneSlug = new Map<string, SxManagementIssue[]>();
  for (const issue of mgmt.issues) {
    if (!issue.milestoneSlug) continue;
    const list = issuesByMilestoneSlug.get(issue.milestoneSlug) || [];
    list.push(issue);
    issuesByMilestoneSlug.set(issue.milestoneSlug, list);
  }
  const testsByMilestoneId = new Map<string, SxTechnicalTest[]>();
  for (const test of mgmt.technicalTests) {
    if (!test.milestoneId) continue;
    const list = testsByMilestoneId.get(test.milestoneId) || [];
    list.push(test);
    testsByMilestoneId.set(test.milestoneId, list);
  }
  const historyByMilestoneSlug = new Map<string, SxEvidence[]>();
  for (const evidence of historyEvidence) {
    const issue = issueById.get(evidence.issueId);
    if (!issue?.milestoneSlug) continue;
    const list = historyByMilestoneSlug.get(issue.milestoneSlug) || [];
    list.push(evidence);
    historyByMilestoneSlug.set(issue.milestoneSlug, list);
  }

  const rows: NavRow[] = [];
  const details: Record<string, NavDetail> = {};

  const registerMilestoneDetail = (m: SxManagementMilestone) => {
    const key = `milestone:${m.slug}`;
    if (!details[key]) details[key] = buildMilestoneDetail(m);
  };
  const registerIssueDetail = (issue: SxManagementIssue) => {
    const key = `issue:${issue.slug}`;
    if (!details[key]) details[key] = buildIssueDetail(issue);
  };
  const registerTestDetail = (test: SxTechnicalTest) => {
    const key = `test:${test.testSlug}`;
    if (!details[key]) details[key] = buildTechnicalTestDetail(test);
  };
  const registerHistoryDetail = (e: SxEvidence) => {
    const key = `history:${e.id}`;
    if (!details[key]) details[key] = buildHistoryEventDetail(e);
  };

  function childRowsForMilestone(milestoneRowId: string, depth: number, milestone: SxManagementMilestone): NavRow[] {
    const out: NavRow[] = [];
    const history = historyByMilestoneSlug.get(milestone.slug) || [];
    for (const evidence of history) {
      registerHistoryDetail(evidence);
      out.push(buildHistoryEventRow({ id: `${milestoneRowId}/history:${evidence.id}`, parentId: milestoneRowId, depth, evidence, scale }));
    }

    const tests = (testsByMilestoneId.get(milestone.id) || []).filter((t) => !t.testSlug.startsWith("tech-recovery-dy-"));
    for (const test of tests) {
      registerTestDetail(test);
      const testRowId = `${milestoneRowId}/test:${test.testSlug}`;
      const dyChildren = test.testSlug === DY_PARENT_TEST_SLUG
        ? DY_CHILD_TEST_ORDER
          .map((slug) => (testsByMilestoneId.get(milestone.id) || []).find((candidate) => candidate.testSlug === slug))
          .filter((candidate): candidate is SxTechnicalTest => Boolean(candidate))
        : [];
      out.push(buildTechnicalTestRow({ id: testRowId, parentId: milestoneRowId, depth, test, scale, hasChildren: dyChildren.length > 0 }));
      for (const child of dyChildren) {
        registerTestDetail(child);
        out.push(buildTechnicalTestRow({ id: `${testRowId}/test:${child.testSlug}`, parentId: testRowId, depth: depth + 1, test: child, scale, hasChildren: false }));
      }
    }

    const issues = issuesByMilestoneSlug.get(milestone.slug) || [];
    for (const issue of issues) {
      registerIssueDetail(issue);
      out.push(buildIssueRow({ id: `${milestoneRowId}/issue:${issue.slug}`, parentId: milestoneRowId, depth, issue, scale }));
    }
    return out;
  }

  // 重要経路グループ (最上段・専用)
  const criticalMilestones = effectiveCriticalPathSlugs
    .map((slug) => mgmt.milestones.find((m) => m.slug === slug))
    .filter((m): m is SxManagementMilestone => Boolean(m));
  rows.push({
    id: "critical",
    kind: "critical_group",
    parentId: null,
    depth: 0,
    label: "重要経路",
    subLabel: criticalMilestones.length > 0 ? `CRITICAL ・ ${criticalMilestones.length}ゲート` : null,
    ownerLabel: null,
    progressLabel: null,
    statusLabel: criticalMilestones.length > 0 ? "CRITICAL" : "未確定",
    tone: criticalMilestones.length > 0 ? "danger" : "unknown",
    isCritical: criticalMilestones.length > 0,
    isBlocked: false,
    hasChildren: criticalMilestones.length > 0,
    defaultExpanded: true,
    selectable: false,
    detailId: null,
    bar: buildGroupBar(scale, criticalMilestones),
    pointPct: null,
    pointLabel: null,
    dateUnsetLabel: mgmt.judgment.dagValid ? null : "DAG不成立",
  });
  for (const milestone of criticalMilestones) {
    registerMilestoneDetail(milestone);
    rows.push(buildMilestoneRow({
      id: `crit-milestone:${milestone.slug}`,
      parentId: "critical",
      depth: 1,
      milestone,
      scale,
      isCritical: true,
      hasChildren: false,
    }));
  }

  // 4本柱グループ
  for (const pillar of NAV_PILLARS) {
    const pillarMilestones = mgmt.milestones
      .filter((m) => m.track === pillar.key)
      .sort((a, b) => (a.plannedStart || "9999-12-31").localeCompare(b.plannedStart || "9999-12-31"));
    const pillarId = `pillar:${pillar.key}`;
    rows.push({
      id: pillarId,
      kind: "pillar_group",
      parentId: null,
      depth: 0,
      label: pillar.label,
      subLabel: `${pillarMilestones.length}ゲート`,
      ownerLabel: null,
      progressLabel: null,
      statusLabel: "",
      tone: "neutral",
      isCritical: false,
      isBlocked: false,
      hasChildren: pillarMilestones.length > 0,
      defaultExpanded: false,
      selectable: false,
      detailId: null,
      bar: buildGroupBar(scale, pillarMilestones),
      pointPct: null,
      pointLabel: null,
      dateUnsetLabel: null,
    });
    for (const milestone of pillarMilestones) {
      registerMilestoneDetail(milestone);
      const milestoneRowId = `${pillarId}/milestone:${milestone.slug}`;
      const children = childRowsForMilestone(milestoneRowId, 2, milestone);
      rows.push(buildMilestoneRow({
        id: milestoneRowId,
        parentId: pillarId,
        depth: 1,
        milestone,
        scale,
        isCritical: criticalPathSlugSet.has(milestone.slug),
        hasChildren: children.length > 0,
      }));
      rows.push(...children);
    }
  }

  const edges = buildCriticalEdges(effectiveCriticalPathSlugs);

  const partners = mgmt.partners.map((partner) => buildNavPartnerRow(partner, asOf))
    .sort((a, b) => a.sortPriority - b.sortPriority || (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31"));
  const partnerDetails: Record<string, NavPartnerDetail> = {};
  for (const partner of mgmt.partners) {
    partnerDetails[partner.slug] = buildPartnerDetail(partner);
  }

  const dataIssues = mgmt.judgment.provisionalDateCount + mgmt.judgment.staleCount + mgmt.judgment.criticalUnknownCount;

  const pillarDefaults: SxNavigationViewModelV2["pillarDefaults"] = {};
  for (const pillar of NAV_PILLARS) {
    const first = mgmt.milestones.find((m) => m.track === pillar.key);
    if (first) pillarDefaults[pillar.key] = { objectiveId: first.objectiveId, outcomeId: first.outcomeId };
  }

  return {
    projectId: input.project.projectId,
    projectName: input.project.projectName,
    asOf,
    hasData: mgmt.hasData,
    canManage: mgmt.canManage,
    dataIssues,
    headline,
    timelineScale: toTimelineScaleView(scale),
    rows,
    edges,
    details,
    partners,
    partnerDetails,
    pillarDefaults,
  };
}
