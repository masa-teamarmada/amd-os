import { dateDistance, isMissingText } from "./project-management-logic.ts";
import type {
  SxActionItem,
  SxBallSide,
  SxCapacity,
  SxDatePrecision,
  SxDependency,
  SxFundingSnapshot,
  SxHistory,
  SxJudgmentKey,
  SxManagementBundle,
  SxManagementDecision,
  SxManagementMilestone,
  SxManagementPartner,
  SxMilestoneStatus,
  SxOrganizationRole,
  SxPartnerRoleKind,
  SxRelationshipState,
  SxTechnicalTest,
  SxTrackKey,
} from "./sx-management";

/**
 * 「成立条件ナビゲーション」(/project/[projectId]/navigation) の表示モデル導出。
 * すべて純関数。sx-management.ts (server-only) の値はimportせず、型だけ借りる
 * (このファイル自体はサーバー/クライアントどちらからも安全に読める plain module のまま保つ)。
 * DBにない予定日・成立条件は捏造しない — 欠損は null / "未評価" 系ラベルで明示する。
 *
 * buildSxNavigationViewModel() が唯一のRSC境界越え窓口。ProjectWorkspaceBundle/CurrentMemberAccess
 * 全体をClient Componentへ渡さず、ここで作った serializable な SxNavigationViewModel だけを渡す。
 */

export const NAV_TRACKS: Array<{ key: SxTrackKey; label: string; shortLabel: string; accent: string }> = [
  { key: "business_development", label: "事業開発", shortLabel: "事業", accent: "#2b6f77" },
  { key: "technology_development", label: "技術開発", shortLabel: "技術", accent: "#2f6b4f" },
  { key: "funding", label: "資金調達", shortLabel: "資金", accent: "#8a6a2f" },
  { key: "organizational_building", label: "体制構築", shortLabel: "体制", accent: "#51606b" },
];

export function navTrackMeta(track: SxTrackKey) {
  return NAV_TRACKS.find((item) => item.key === track) || NAV_TRACKS[0];
}

const MILESTONE_STATUS_LABEL: Record<SxMilestoneStatus, string> = {
  unassessed: "未評価",
  on_track: "順調",
  attention: "注意",
  at_risk: "遅れ懸念",
  blocked: "停止",
  completed: "完了",
};

const MILESTONE_REASON_LABEL: Record<string, string> = {
  dependency_blocked: "前提工程が停止",
  dependency_waiting: "前提工程待ち",
  overdue: "期限超過",
  owner_missing: "担当未確認",
  deadline_missing: "期限未設定",
  stale: "情報更新切れ",
  date_provisional: "日程は仮置き",
  completion_criteria_missing: "完了条件未確認",
  kpi_missing: "KPI未設定",
  kpi_threshold_failed: "KPIが基準未達",
  current_evidence_missing: "最新根拠未確認",
  dag_cycle: "依存関係が循環",
  completion_evidence_missing: "完了根拠未確認",
  critical_unknown: "重要項目未確認",
};

function navMilestoneReason(milestone: SxManagementMilestone) {
  if (milestone.reasonCodes.length > 0) {
    return milestone.reasonCodes
      .map((code) => MILESTONE_REASON_LABEL[code] || "理由コード未対応")
      .join(" / ");
  }
  return !isMissingText(milestone.statusReason) ? milestone.statusReason : "理由未確認";
}

export function navMilestoneStatusLabel(status: SxMilestoneStatus) {
  return MILESTONE_STATUS_LABEL[status] || "未評価";
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

const RELATIONSHIP_STAGE_LABEL: Record<SxManagementPartner["relationshipStage"], string> = {
  candidate: "候補",
  information_exchange: "情報交換",
  condition_alignment: "条件整理",
  meeting_coordination: "面談調整",
  validation_preparation: "検証準備",
  agreement_confirmation: "合意確認",
  executing: "実行中",
  on_hold: "保留",
};

export function navRelationshipStageLabel(stage: SxManagementPartner["relationshipStage"]) {
  return RELATIONSHIP_STAGE_LABEL[stage] || "未確認";
}

const AGREEMENT_STATE_LABEL: Record<SxManagementPartner["agreementState"], string> = {
  agreed: "合意済み",
  partial: "一部合意",
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
// 一目判定帯
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

export function navJudgmentFromKey(key: SxJudgmentKey): { key: NavJudgmentKey; label: NavHeadline["judgmentLabel"] } {
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

export function navHeadline(input: {
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
// 依存航路（全体依存ガント）
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

export function buildNavTimelineScale(
  milestones: readonly Pick<SxManagementMilestone, "plannedStart" | "plannedEnd" | "forecastEnd" | "actualEnd">[],
  asOf: string,
): NavTimelineScale {
  const dates: string[] = [];
  for (const milestone of milestones) {
    for (const value of [milestone.plannedStart, milestone.plannedEnd, milestone.forecastEnd, milestone.actualEnd]) {
      if (value) dates.push(value.slice(0, 10));
    }
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

export function buildNavAxisTicks(scale: NavTimelineScale): NavAxisTick[] {
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

export type NavBarSegment = { startPct: number; endPct: number };

export type NavMilestoneNode = {
  id: string;
  slug: string;
  title: string;
  track: SxTrackKey;
  status: SxMilestoneStatus;
  statusLabel: string;
  gate: string;
  ownerLabel: string;
  progressPct: number;
  isCritical: boolean;
  isBlocked: boolean;
  isWaiting: boolean;
  isOverdue: boolean;
  hasDates: boolean;
  dateCertainty: "confirmed" | "provisional";
  plannedStart: string | null;
  plannedEnd: string | null;
  forecastEnd: string | null;
  actualEnd: string | null;
  deltaDays: number | null;
  /** 基準計画 (plannedStart〜plannedEnd)。予測延伸を混ぜない純粋な計画枠。 */
  baselineSegment: NavBarSegment | null;
  /** 予測が計画を超えて延びた分 (plannedEnd〜forecastEnd)。存在する時だけ延伸を可視化する。 */
  slipSegment: NavBarSegment | null;
  /** forecastEndが計画より早い(前倒し)場合の日数。捏造せず、算出できない時はnull。 */
  pulledInDays: number | null;
  completeSegment: NavBarSegment | null;
  relatedPartnerSlugs: readonly string[];
  relatedIssueSlugs: readonly string[];
  dependencySlugs: readonly string[];
};

export function buildNavMilestoneNode(
  milestone: SxManagementMilestone,
  scale: NavTimelineScale,
  criticalPathSlugSet: ReadonlySet<string>,
): NavMilestoneNode {
  const plannedStartPct = scale.pct(milestone.plannedStart);
  const plannedEndPct = scale.pct(milestone.plannedEnd);
  const forecastEndPct = scale.pct(milestone.forecastEnd);
  const actualEndPct = scale.pct(milestone.actualEnd);

  const baselineSegment = plannedStartPct != null && plannedEndPct != null
    ? { startPct: Math.min(plannedStartPct, plannedEndPct), endPct: Math.max(plannedStartPct, plannedEndPct) }
    : null;

  let slipSegment: NavBarSegment | null = null;
  let pulledInDays: number | null = null;
  if (baselineSegment && forecastEndPct != null) {
    if (forecastEndPct > baselineSegment.endPct) {
      slipSegment = { startPct: baselineSegment.endPct, endPct: forecastEndPct };
    } else if (forecastEndPct < baselineSegment.endPct && milestone.plannedEnd && milestone.forecastEnd) {
      pulledInDays = dateDistance(milestone.forecastEnd, milestone.plannedEnd);
    }
  }

  const overallEndPct = slipSegment ? slipSegment.endPct : baselineSegment?.endPct ?? null;
  let completeSegment: NavBarSegment | null = null;
  if (baselineSegment) {
    if (milestone.actualEnd && actualEndPct != null) {
      completeSegment = {
        startPct: baselineSegment.startPct,
        endPct: Math.max(baselineSegment.startPct, Math.min(actualEndPct, overallEndPct ?? actualEndPct)),
      };
    } else if (milestone.progressPct > 0 && overallEndPct != null) {
      const span = overallEndPct - baselineSegment.startPct;
      completeSegment = { startPct: baselineSegment.startPct, endPct: baselineSegment.startPct + span * (milestone.progressPct / 100) };
    }
  }

  return {
    id: milestone.id,
    slug: milestone.slug,
    title: milestone.title,
    track: milestone.track,
    status: milestone.status,
    statusLabel: navMilestoneStatusLabel(milestone.status),
    gate: milestone.gate,
    ownerLabel: milestone.ownerLabel,
    progressPct: milestone.progressPct,
    isCritical: criticalPathSlugSet.has(milestone.slug),
    isBlocked: milestone.isBlocked,
    isWaiting: !milestone.isBlocked && milestone.status === "attention" && milestone.reasonCodes.includes("dependency_waiting"),
    isOverdue: milestone.isOverdue,
    hasDates: Boolean(milestone.plannedStart && milestone.plannedEnd),
    dateCertainty: milestone.dateCertainty,
    plannedStart: milestone.plannedStart,
    plannedEnd: milestone.plannedEnd,
    forecastEnd: milestone.forecastEnd,
    actualEnd: milestone.actualEnd,
    deltaDays: milestone.deltaDays,
    baselineSegment,
    slipSegment,
    pulledInDays,
    completeSegment,
    relatedPartnerSlugs: milestone.relatedPartnerSlugs,
    relatedIssueSlugs: milestone.relatedIssueSlugs,
    dependencySlugs: milestone.dependencySlugs,
  };
}

export type NavDependencyEdge = {
  id: string;
  fromSlug: string;
  toSlug: string;
  required: boolean;
  isCriticalEdge: boolean;
};

export function buildNavDependencyEdges(
  dependencies: readonly SxDependency[],
  criticalPathSlugs: readonly string[],
): NavDependencyEdge[] {
  const criticalPairs = new Set<string>();
  for (let index = 0; index < criticalPathSlugs.length - 1; index += 1) {
    criticalPairs.add(`${criticalPathSlugs[index]}→${criticalPathSlugs[index + 1]}`);
  }
  return dependencies.map((dependency) => ({
    id: dependency.id,
    fromSlug: dependency.predecessorSlug,
    toSlug: dependency.successorSlug,
    required: dependency.required,
    isCriticalEdge: criticalPairs.has(`${dependency.predecessorSlug}→${dependency.successorSlug}`),
  }));
}

// ---------------------------------------------------------------------------
// クリティカルパス
// ---------------------------------------------------------------------------

export type NavCriticalPathStep = {
  order: number;
  slug: string;
  title: string;
  track: SxTrackKey;
  status: SxMilestoneStatus;
  statusLabel: string;
  isNextBottleneck: boolean;
  bufferDays: number | null;
  bufferLabel: string;
  delayReason: string;
};

export function buildNavCriticalPath(
  milestones: readonly SxManagementMilestone[],
  criticalPathSlugs: readonly string[],
  dependencies: readonly SxDependency[],
  dagValid: boolean,
): NavCriticalPathStep[] {
  if (!dagValid || criticalPathSlugs.length === 0) return [];
  const milestoneBySlug = new Map(milestones.map((milestone) => [milestone.slug, milestone]));
  const lagBySlugPair = new Map(dependencies.map((dependency) => [`${dependency.predecessorSlug}→${dependency.successorSlug}`, dependency.lagDays]));
  let bottleneckAssigned = false;

  return criticalPathSlugs.map((slug, index) => {
    const milestone = milestoneBySlug.get(slug);
    const nextSlug = criticalPathSlugs[index + 1];
    const nextMilestone = nextSlug ? milestoneBySlug.get(nextSlug) : undefined;
    const thisEnd = milestone?.forecastEnd || milestone?.plannedEnd || null;
    const nextStart = nextMilestone?.plannedStart || null;
    const lagDays = lagBySlugPair.get(`${slug}→${nextSlug}`) ?? 0;
    let bufferDays: number | null = null;
    if (thisEnd && nextStart) bufferDays = dateDistance(thisEnd, nextStart) - lagDays;

    const isNextBottleneck = !bottleneckAssigned
      && milestone?.status !== "completed"
      && milestone?.status !== "on_track";
    if (isNextBottleneck) bottleneckAssigned = true;

    return {
      order: index + 1,
      slug,
      title: milestone?.title || "節点未確認",
      track: milestone?.track || "business_development",
      status: milestone?.status || "unassessed",
      statusLabel: navMilestoneStatusLabel(milestone?.status || "unassessed"),
      isNextBottleneck,
      bufferDays,
      bufferLabel: !nextSlug
        ? "最終節点"
        : bufferDays == null
          ? "接続余白未算定"
          : bufferDays < 0
            ? `${Math.abs(bufferDays)}日不足`
            : `接続余白 ${bufferDays}日`,
      delayReason: milestone ? navMilestoneReason(milestone) : "理由未確認",
    };
  });
}

// ---------------------------------------------------------------------------
// 関係先: 識別 → 完了済み/直近接点 → 現在(段階・ボール) → 次の受け渡し → 期限・目標
// ---------------------------------------------------------------------------

export type NavPartnerJourneyStep = {
  id: string;
  label: string;
  occurredOn: string | null;
};

export type NavPartnerLatestInteraction = {
  id: string;
  summary: string;
  occurredOn: string | null;
  occurredOnPrecision: SxDatePrecision;
};

export type NavPartnerGroupKind = "structured_role" | "display_label_poc" | "unclassified";

export type NavPartnerJourney = {
  partnerId: string;
  slug: string;
  name: string;
  roleLabel: string;
  track: SxTrackKey;
  isPriority: boolean;
  groupLabel: string;
  groupKind: NavPartnerGroupKind;
  relationshipStage: SxManagementPartner["relationshipStage"];
  relationshipStageLabel: string;
  agreementState: SxManagementPartner["agreementState"];
  agreementStateLabel: string;
  completedSteps: NavPartnerJourneyStep[];
  latestInteraction: NavPartnerLatestInteraction | null;
  currentBallSide: SxBallSide;
  currentBallSideLabel: string;
  currentBallOwner: string | null;
  currentStateLabel: string;
  nextHandoffLabel: string;
  nextHandoffDueDate: string | null;
  atDeadlineStateLabel: string;
  dueDate: string | null;
  dueDatePrecision: SxDatePrecision;
  relatedMilestoneSlugs: readonly string[];
  isOverdue: boolean;
};

function derivePartnerGroup(partner: SxManagementPartner): { label: string; kind: NavPartnerGroupKind } {
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

export function buildNavPartnerJourney(partner: SxManagementPartner, asOf: string): NavPartnerJourney {
  const completedSteps: NavPartnerJourneyStep[] = [
    ...partner.commitments.filter((item) => item.status === "completed").map((item) => ({ id: item.id, label: item.title, occurredOn: item.completedOn })),
    ...partner.workItems.filter((item) => item.status === "completed").map((item) => ({ id: item.id, label: item.title, occurredOn: item.completedOn })),
  ].sort((left, right) => (left.occurredOn || "").localeCompare(right.occurredOn || "")).slice(-3);

  const latestInteractionRow = [...partner.interactions].sort((left, right) =>
    (left.occurredOn || left.createdAt || "").localeCompare(right.occurredOn || right.createdAt || "")).at(-1) || null;
  const latestInteraction: NavPartnerLatestInteraction | null = latestInteractionRow ? {
    id: latestInteractionRow.id,
    summary: latestInteractionRow.summary,
    occurredOn: latestInteractionRow.occurredOn,
    occurredOnPrecision: latestInteractionRow.occurredOnPrecision,
  } : null;

  const openWorkItems = partner.workItems
    .filter((item) => item.status === "open" || item.status === "in_progress" || item.status === "waiting")
    .sort((left, right) => (left.dueDate || "9999-12-31").localeCompare(right.dueDate || "9999-12-31"));
  const openCommitments = partner.commitments
    .filter((item) => item.status === "open" || item.status === "in_progress")
    .sort((left, right) => (left.dueDate || "9999-12-31").localeCompare(right.dueDate || "9999-12-31"));

  const nextWorkItem = openWorkItems[0];
  const nextCommitment = openCommitments[0];
  const next = nextWorkItem
    ? { label: `${nextWorkItem.title}${nextWorkItem.handoffTo ? `（→${nextWorkItem.handoffTo}）` : ""}`, dueDate: nextWorkItem.dueDate }
    : nextCommitment
      ? { label: nextCommitment.title, dueDate: nextCommitment.dueDate }
      : partner.nextCommitment && !isMissingText(partner.nextCommitment)
        ? { label: partner.nextCommitment, dueDate: partner.dueDate }
        : null;

  const group = derivePartnerGroup(partner);

  return {
    partnerId: partner.id,
    slug: partner.slug,
    name: partner.name,
    roleLabel: partner.roleLabel,
    track: partner.track,
    isPriority: !partner.deferredLowPriority,
    groupLabel: group.label,
    groupKind: group.kind,
    relationshipStage: partner.relationshipStage,
    relationshipStageLabel: navRelationshipStageLabel(partner.relationshipStage),
    agreementState: partner.agreementState,
    agreementStateLabel: navAgreementStateLabel(partner.agreementState),
    completedSteps,
    latestInteraction,
    currentBallSide: partner.currentBallSide,
    currentBallSideLabel: navBallSideLabel(partner.currentBallSide),
    currentBallOwner: partner.currentBallOwner,
    currentStateLabel: partner.currentBallOwner
      ? `${navRelationshipStageLabel(partner.relationshipStage)} ・ ${navBallSideLabel(partner.currentBallSide)}（${partner.currentBallOwner}）`
      : `${navRelationshipStageLabel(partner.relationshipStage)} ・ ${navBallSideLabel(partner.currentBallSide)}`,
    nextHandoffLabel: next?.label || "次の受け渡し未確認",
    nextHandoffDueDate: next?.dueDate ?? null,
    atDeadlineStateLabel: partner.targetState && !isMissingText(partner.targetState) ? partner.targetState : "目標状態未設定",
    dueDate: partner.dueDate,
    dueDatePrecision: partner.dueDatePrecision,
    relatedMilestoneSlugs: partner.relatedMilestoneSlugs,
    isOverdue: Boolean(
      partner.agreementState !== "agreed"
      && partner.dueDate
      && partner.dueDatePrecision === "day"
      && partner.dueDate < asOf,
    ),
  };
}

// ---------------------------------------------------------------------------
// 制約ボード: 人員・資金・技術証明
// ---------------------------------------------------------------------------

export type NavConstraintSeverity = "ok" | "watch" | "unknown";

export type NavConstraintFlag = {
  key: string;
  kind: "capacity" | "organization" | "funding" | "technical";
  label: string;
  detail: string;
  severity: NavConstraintSeverity;
};

export function buildNavConstraintFlags(input: {
  capacity: readonly SxCapacity[];
  organizationRoles: readonly SxOrganizationRole[];
  fundingSnapshots: readonly SxFundingSnapshot[];
  technicalTests: readonly SxTechnicalTest[];
}): NavConstraintFlag[] {
  const flags: NavConstraintFlag[] = [];

  if (input.capacity.length === 0) {
    flags.push({ key: "capacity-none", kind: "capacity", label: "研究開発人員", detail: "工数データ未登録", severity: "unknown" });
  } else {
    for (const row of input.capacity) {
      const shortfall = row.requiredPeople - row.confirmedPeople;
      flags.push({
        key: `capacity-${row.id}`,
        kind: "capacity",
        label: row.roleLabel,
        detail: shortfall > 0 ? `必要${row.requiredPeople}名中${row.confirmedPeople}名確保（${shortfall}名不足）` : `${row.confirmedPeople}/${row.requiredPeople}名確保`,
        severity: shortfall > 0 ? "watch" : "ok",
      });
    }
  }

  const requiredRoles = input.organizationRoles.filter((role) => role.required);
  if (requiredRoles.length === 0) {
    flags.push({ key: "role-none", kind: "organization", label: "体制", detail: "必須役割の登録なし", severity: "unknown" });
  } else {
    for (const role of requiredRoles) {
      flags.push({
        key: `role-${role.id}`,
        kind: "organization",
        label: role.roleName,
        detail: role.vacancy ? `空席（候補: ${role.candidate || "未確認"}）` : `充足（${role.candidate || role.commitment || "確定"}）`,
        severity: role.vacancy ? "watch" : role.confidence === "unknown" ? "unknown" : "ok",
      });
    }
  }

  const funding = input.fundingSnapshots[0];
  if (!funding) {
    flags.push({ key: "funding-none", kind: "funding", label: "資金", detail: "資金スナップショット未登録", severity: "unknown" });
  } else {
    const gap = funding.requiredAmount != null && funding.securedAmount != null ? funding.requiredAmount - funding.securedAmount : null;
    flags.push({
      key: "funding-latest",
      kind: "funding",
      label: `資金（${funding.snapshotDate}時点）`,
      detail: gap == null ? "必要額・確保額いずれか未確認" : gap > 0 ? `必要額に対し${gap.toLocaleString("ja-JP")}円未確保` : "必要額を確保",
      severity: gap == null ? "unknown" : gap > 0 ? "watch" : "ok",
    });
    if (funding.runwayMonths != null) {
      flags.push({
        key: "funding-runway",
        kind: "funding",
        label: "資金残存月数",
        detail: `残り${funding.runwayMonths}か月`,
        severity: funding.runwayMonths < 3 ? "watch" : "ok",
      });
    }
  }

  const criticalTests = input.technicalTests.filter((test) => test.status !== "unassessed");
  if (input.technicalTests.length === 0) {
    flags.push({ key: "technical-none", kind: "technical", label: "技術証明", detail: "技術試験未登録", severity: "unknown" });
  } else {
    const failed = criticalTests.filter((test) => test.status === "failed" || test.status === "blocked");
    const unassessedCount = input.technicalTests.length - criticalTests.length;
    flags.push({
      key: "technical-summary",
      kind: "technical",
      label: "技術証明",
      detail: failed.length > 0
        ? `${failed.length}件が不合格・停止（全${input.technicalTests.length}件中）`
        : unassessedCount > 0
          ? `${unassessedCount}件が未評価（全${input.technicalTests.length}件中）`
          : `全${input.technicalTests.length}件が評価済み`,
      severity: failed.length > 0 ? "watch" : unassessedCount > 0 ? "unknown" : "ok",
    });
  }

  return flags;
}

// ---------------------------------------------------------------------------
// 判断待ち（最小フィールドだけ画面へ渡す）
// ---------------------------------------------------------------------------

export type NavPendingDecision = {
  id: string;
  title: string;
  dueDate: string | null;
  ownerLabel: string;
  isThisWeek: boolean;
};

export function buildNavPendingDecisions(decisions: readonly SxManagementDecision[]): NavPendingDecision[] {
  return decisions
    .filter((decision) => decision.status === "open")
    .map((decision) => ({ id: decision.id, title: decision.title, dueDate: decision.dueDate, ownerLabel: decision.ownerLabel, isThisWeek: decision.isThisWeek }))
    .sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31"));
}

// ---------------------------------------------------------------------------
// 直近変化
// ---------------------------------------------------------------------------

export type NavRecentChange = {
  id: string;
  kind: "history" | "action_completed";
  summary: string;
  changedOn: string;
};

export function buildNavRecentChanges(
  history: readonly SxHistory[],
  actions: readonly SxActionItem[],
  limit = 8,
): NavRecentChange[] {
  const fromHistory: NavRecentChange[] = history.map((entry) => ({
    id: entry.id,
    kind: "history",
    summary: entry.summary,
    changedOn: entry.changedOn,
  }));
  const fromActions: NavRecentChange[] = actions
    .filter((action) => action.status === "completed" && action.completedAt)
    .map((action) => ({
      id: `action-${action.id}`,
      kind: "action_completed",
      summary: `${action.title}を完了`,
      changedOn: action.completedAt as string,
    }));
  return [...fromHistory, ...fromActions]
    .sort((left, right) => right.changedOn.localeCompare(left.changedOn))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// 画面専用 view model — Client Componentへ渡す唯一の窓口
// ---------------------------------------------------------------------------

export type SxNavigationViewModel = {
  projectId: string;
  projectName: string;
  asOf: string;
  hasData: boolean;
  dataIssues: number;
  headline: NavHeadline;
  timelineScale: NavTimelineScaleView;
  nodes: NavMilestoneNode[];
  edges: NavDependencyEdge[];
  criticalPath: { dagValid: boolean; hasCriticalPath: boolean; steps: NavCriticalPathStep[] };
  partners: NavPartnerJourney[];
  constraintFlags: NavConstraintFlag[];
  pendingDecisions: NavPendingDecision[];
  recentChanges: NavRecentChange[];
};

export function buildSxNavigationViewModel(input: {
  project: { projectId: string; projectName: string };
  sxManagement: SxManagementBundle;
}): SxNavigationViewModel {
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

  const orderedMilestones = [...mgmt.milestones].sort((a, b) =>
    (a.plannedStart || "9999-12-31").localeCompare(b.plannedStart || "9999-12-31")
    || a.title.localeCompare(b.title, "ja"));

  const scale = buildNavTimelineScale(orderedMilestones, asOf);
  const nodes = orderedMilestones.map((milestone) => buildNavMilestoneNode(milestone, scale, criticalPathSlugSet));
  const edges = buildNavDependencyEdges(mgmt.dependencies, effectiveCriticalPathSlugs);
  const criticalSteps = buildNavCriticalPath(mgmt.milestones, mgmt.judgment.criticalPathSlugs, mgmt.dependencies, mgmt.judgment.dagValid);
  const partners = mgmt.partners.map((partner) => buildNavPartnerJourney(partner, asOf));
  const constraintFlags = buildNavConstraintFlags({
    capacity: mgmt.capacity,
    organizationRoles: mgmt.organizationRoles,
    fundingSnapshots: mgmt.fundingSnapshots,
    technicalTests: mgmt.technicalTests,
  });
  const pendingDecisions = buildNavPendingDecisions(mgmt.decisions);
  const recentChanges = buildNavRecentChanges(mgmt.history, mgmt.actions);
  const dataIssues = mgmt.judgment.provisionalDateCount + mgmt.judgment.staleCount + mgmt.judgment.criticalUnknownCount;

  return {
    projectId: input.project.projectId,
    projectName: input.project.projectName,
    asOf,
    hasData: mgmt.hasData,
    dataIssues,
    headline,
    timelineScale: toTimelineScaleView(scale),
    nodes,
    edges,
    criticalPath: {
      dagValid: mgmt.judgment.dagValid,
      hasCriticalPath: mgmt.judgment.criticalPathSlugs.length > 0,
      steps: criticalSteps,
    },
    partners,
    constraintFlags,
    pendingDecisions,
    recentChanges,
  };
}
