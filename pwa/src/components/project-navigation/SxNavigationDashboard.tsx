"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { CircleAlert, CircleCheck, CircleHelp, ExternalLink, Search, ShieldAlert } from "lucide-react";
import {
  navFormatDate,
  navTrackMeta,
  type NavConstraintFlag,
  type NavCriticalPathStep,
  type NavDependencyEdge,
  type NavHeadline,
  type NavMilestoneNode,
  type NavPartnerJourney,
  type NavPendingDecision,
  type NavRecentChange,
  type NavTimelineScaleView,
  type SxNavigationViewModel,
} from "@/lib/sx-navigation";
import styles from "./navigation.module.css";

const ROW_HEIGHT = 44;

type SelectionKind = "milestone" | "partner";
type Selection = { kind: SelectionKind; id: string } | null;

export function SxNavigationDashboard({ model }: { model: SxNavigationViewModel }) {
  const [selection, setSelection] = useState<Selection>(null);

  const nodeIndexBySlug = useMemo(() => new Map(model.nodes.map((node, index) => [node.slug, index])), [model.nodes]);

  const relatedMilestoneSlugs = useMemo(() => {
    if (!selection) return new Set<string>();
    if (selection.kind === "milestone") {
      const node = model.nodes.find((item) => item.id === selection.id);
      return new Set(node ? [node.slug] : []);
    }
    const journey = model.partners.find((item) => item.partnerId === selection.id);
    return new Set(journey?.relatedMilestoneSlugs || []);
  }, [selection, model.nodes, model.partners]);

  const relatedPartnerIds = useMemo(() => {
    if (!selection || selection.kind !== "milestone") return new Set<string>();
    const node = model.nodes.find((item) => item.id === selection.id);
    if (!node) return new Set<string>();
    const slugs = new Set(node.relatedPartnerSlugs);
    return new Set(model.partners.filter((partner) => slugs.has(partner.slug)).map((partner) => partner.partnerId));
  }, [selection, model.nodes, model.partners]);

  if (!model.hasData) return null;

  const totalHeight = Math.max(ROW_HEIGHT, model.nodes.length * ROW_HEIGHT);

  const toggleMilestone = (id: string) => setSelection((current) => (current?.kind === "milestone" && current.id === id ? null : { kind: "milestone", id }));
  const togglePartner = (id: string) => setSelection((current) => (current?.kind === "partner" && current.id === id ? null : { kind: "partner", id }));

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <NavHeader projectId={model.projectId} projectName={model.projectName} asOf={model.asOf} dataIssues={model.dataIssues} />
        <JudgmentReadout headline={model.headline} />
        <DependencyGantt
          nodes={model.nodes}
          edges={model.edges}
          scale={model.timelineScale}
          nodeIndexBySlug={nodeIndexBySlug}
          selection={selection}
          onToggleMilestone={toggleMilestone}
          relatedMilestoneSlugs={relatedMilestoneSlugs}
          totalHeight={totalHeight}
        />
        <CriticalPathSection
          steps={model.criticalPath.steps}
          dagValid={model.criticalPath.dagValid}
          hasCriticalPath={model.criticalPath.hasCriticalPath}
        />
        <PartnerJourneySection
          journeys={model.partners}
          selection={selection}
          onTogglePartner={togglePartner}
          relatedPartnerIds={relatedPartnerIds}
        />
        <ConstraintBoardSection flags={model.constraintFlags} />
        <DecisionsSection pendingDecisions={model.pendingDecisions} recentChanges={model.recentChanges} />
      </div>
    </div>
  );
}

function NavHeader({ projectId, projectName, asOf, dataIssues }: { projectId: string; projectName: string; asOf: string; dataIssues: number }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerMain}>
        <p className={styles.eyebrow}>成立条件ナビゲーション</p>
        <h1>{projectName}</h1>
        <div className={styles.headerMeta}>
          <span>基準日 <b>{navFormatDate(asOf)}</b></span>
          <span className={styles.dataQuality} data-clean={dataIssues === 0}>
            {dataIssues === 0 ? <CircleCheck aria-hidden="true" width={13} height={13} /> : <CircleAlert aria-hidden="true" width={13} height={13} />}
            {dataIssues === 0 ? "主要警告 0件" : `未確認・更新切れ ${dataIssues}件`}
          </span>
        </div>
      </div>
      <nav className={styles.headerLinks} aria-label="関連画面">
        <Link href={`/project/${encodeURIComponent(projectId)}/workspace`}>
          <ExternalLink aria-hidden="true" />
          既存ワークスペース
        </Link>
        <Link href={`/project/${encodeURIComponent(projectId)}/weekly-control`}>
          <ExternalLink aria-hidden="true" />
          週次管制
        </Link>
      </nav>
    </header>
  );
}

function JudgmentReadout({ headline }: { headline: NavHeadline }) {
  const tone = headline.judgmentKey === "on_schedule" ? "ok" : headline.judgmentKey === "needs_intervention" ? "warn" : "unknown";
  const Icon = tone === "ok" ? CircleCheck : tone === "warn" ? ShieldAlert : CircleHelp;
  return (
    <section className={styles.readout} aria-label="一目判定">
      <div className={styles.readoutTop}>
        <span className={styles.judgmentBadge} data-tone={tone}>
          <Icon aria-hidden="true" />
          {headline.judgmentLabel}
        </span>
        <p className={styles.readoutReasons}>{headline.reasons.length > 0 ? headline.reasons.join(" / ") : "判定理由の記録なし"}</p>
      </div>
      <div className={styles.readoutLine}>
        <span className={styles.readoutItem}>
          <span>最終ゲート</span>
          <b>
            {headline.finalGateLabel}
            {headline.finalGateDate ? `（${navFormatDate(headline.finalGateDate)}${headline.finalGateDateCertainty === "provisional" ? "・仮日程" : ""}）` : ""}
          </b>
        </span>
        <span className={styles.readoutItem}>
          <span>次の期限</span>
          <b>{headline.nextDeadlineLabel}</b>
        </span>
        <span className={styles.readoutItem} data-alert={Boolean(headline.bottleneckMilestoneSlug)}>
          <span>最大ボトルネック</span>
          <b>{headline.bottleneckLabel}</b>
        </span>
        {/* 判定信頼度(予定内/要介入/判定不能)とは別軸。全件「判定不能」でも予測遅延だけは見落とさない。 */}
        <span className={styles.readoutItem} data-alert={headline.forecastSlipCount > 0}>
          <span>予測差分（対計画）</span>
          <b>{headline.forecastSlipLabel}</b>
        </span>
        <span className={styles.readoutItem} data-alert={headline.pendingDecisionCount > 0}>
          <span>判断待ち</span>
          <b>{headline.pendingDecisionCount}件</b>
        </span>
      </div>
    </section>
  );
}

function baselineBarStyle(node: NavMilestoneNode, index: number): CSSProperties {
  const top = index * ROW_HEIGHT + ROW_HEIGHT / 2;
  if (!node.baselineSegment) return { top, left: 8, width: "auto", paddingInline: 6 };
  const width = Math.max(0.6, node.baselineSegment.endPct - node.baselineSegment.startPct);
  return { top, left: `${node.baselineSegment.startPct}%`, width: `${width}%` };
}

function DependencyGantt({
  nodes,
  edges,
  scale,
  nodeIndexBySlug,
  selection,
  onToggleMilestone,
  relatedMilestoneSlugs,
  totalHeight,
}: {
  nodes: NavMilestoneNode[];
  edges: NavDependencyEdge[];
  scale: NavTimelineScaleView;
  nodeIndexBySlug: Map<string, number>;
  selection: Selection;
  onToggleMilestone: (id: string) => void;
  relatedMilestoneSlugs: Set<string>;
  totalHeight: number;
}) {
  const rowsBackgroundStyle: CSSProperties = { height: totalHeight };

  return (
    <section className={styles.gantt} aria-label="全体依存ガント">
      <div className={styles.ganttHead}>
        <h2>依存航路 — 全体依存ガント</h2>
        <div className={styles.legend}>
          <span><i className={styles.legendSwatch} data-kind="plan" aria-hidden="true" />基準計画</span>
          <span><i className={styles.legendSwatch} data-kind="done" aria-hidden="true" />完了範囲</span>
          <span><i className={styles.legendSwatch} data-kind="slip" aria-hidden="true" />予測延伸</span>
          <span><i className={styles.legendSwatch} data-kind="pulled-in" aria-hidden="true" />前倒し</span>
          <span><i className={styles.legendSwatch} data-kind="critical" aria-hidden="true" />重要経路</span>
          <span><i className={styles.legendSwatch} data-kind="premise" aria-hidden="true" />前提のつながり</span>
        </div>
      </div>
      {!scale.hasDates ? (
        <p className={styles.emptyState}>日程データが未設定のため、依存航路は表示できません（未評価）。</p>
      ) : (
        <div className={styles.ganttBody}>
          <div className={styles.ganttLabels}>
            <div className={styles.ganttAxis} aria-hidden="true" />
            {nodes.map((node) => {
              const selected = selection?.kind === "milestone" && selection.id === node.id;
              const related = !selected && relatedMilestoneSlugs.has(node.slug);
              return (
                <button
                  key={node.id}
                  type="button"
                  className={styles.ganttRow}
                  data-selected={selected}
                  data-related={related}
                  onClick={() => onToggleMilestone(node.id)}
                  aria-pressed={selected}
                >
                  <span className={styles.trackChip} style={{ background: navTrackMeta(node.track).accent }} aria-hidden="true" />
                  <span className={styles.ganttLabelText}>
                    <b>{node.isCritical ? "◆ " : ""}{node.title}</b>
                    <small>{navTrackMeta(node.track).shortLabel} ・ {node.statusLabel}{node.ownerLabel ? ` ・ ${node.ownerLabel}` : ""}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <div className={styles.ganttScrollOuter}>
            <div className={styles.ganttScrollInner}>
              <div className={styles.ganttAxis}>
                {scale.axisTicks.map((tick) => (
                  <span key={tick.label} className={styles.ganttAxisTick} style={{ left: `${tick.pct}%` }}>{tick.label}</span>
                ))}
              </div>
              <div className={styles.ganttRows} style={rowsBackgroundStyle}>
                {nodes.map((node, index) => (
                  <span
                    key={`guide-${node.id}`}
                    className={styles.ganttGuide}
                    style={{ top: (index + 1) * ROW_HEIGHT - 1 }}
                    aria-hidden="true"
                  />
                ))}
                {scale.todayPct != null && <div className={styles.ganttToday} style={{ left: `${scale.todayPct}%` }} />}
                <svg className={styles.ganttSvg} width="100%" height={totalHeight} preserveAspectRatio="none" viewBox={`0 0 1000 ${totalHeight}`} aria-hidden="true">
                  {edges.map((edge) => {
                    const fromIndex = nodeIndexBySlug.get(edge.fromSlug);
                    const toIndex = nodeIndexBySlug.get(edge.toSlug);
                    if (fromIndex == null || toIndex == null) return null;
                    const fromNode = nodes[fromIndex];
                    const toNode = nodes[toIndex];
                    const fromEndPct = fromNode.slipSegment?.endPct ?? fromNode.baselineSegment?.endPct;
                    const toStartPct = toNode.baselineSegment?.startPct;
                    if (fromEndPct == null || toStartPct == null) return null;
                    const x1 = fromEndPct * 10;
                    const y1 = fromIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const x2 = toStartPct * 10;
                    const y2 = toIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const midX = (x1 + x2) / 2;
                    return (
                      <path
                        key={edge.id}
                        d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                        fill="none"
                        stroke={edge.isCriticalEdge ? "var(--green)" : "var(--quiet)"}
                        strokeWidth={edge.isCriticalEdge ? 2 : 1}
                        strokeDasharray={edge.isCriticalEdge ? undefined : "4 3"}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                </svg>
                {nodes.map((node, index) => {
                  const selected = selection?.kind === "milestone" && selection.id === node.id;
                  const planWidthPct = node.baselineSegment ? node.baselineSegment.endPct - node.baselineSegment.startPct : 0;
                  const doneWidthPct = node.completeSegment
                    ? Math.min(100, ((node.completeSegment.endPct - node.completeSegment.startPct) / Math.max(0.001, planWidthPct)) * 100)
                    : 0;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      className={styles.ganttBar}
                      data-status={node.status}
                      data-critical={node.isCritical}
                      data-has-dates={node.hasDates}
                      data-selected={selected}
                      style={baselineBarStyle(node, index)}
                      onClick={() => onToggleMilestone(node.id)}
                      aria-pressed={selected}
                      aria-label={`${node.title}: ${node.statusLabel}${node.slipSegment ? `、予定より+${(node.deltaDays ?? 0)}日` : node.pulledInDays ? `、前倒し${node.pulledInDays}日` : ""}`}
                    >
                      {node.baselineSegment ? (
                        <>
                          <span className={styles.ganttBarPlan} />
                          {node.completeSegment && <span className={styles.ganttBarDone} style={{ width: `${doneWidthPct}%` }} />}
                          {node.pulledInDays != null && (
                            <span className={styles.ganttPullMarker} title={`前倒し${node.pulledInDays}日`} />
                          )}
                        </>
                      ) : (
                        <span className={styles.ganttNoDate}>日程未設定</span>
                      )}
                    </button>
                  );
                })}
                {nodes.map((node, index) => node.slipSegment ? (
                  <span
                    key={`slip-${node.id}`}
                    className={styles.ganttSlip}
                    style={{
                      top: index * ROW_HEIGHT + ROW_HEIGHT / 2,
                      left: `${node.slipSegment.startPct}%`,
                      width: `${Math.max(0.6, node.slipSegment.endPct - node.slipSegment.startPct)}%`,
                    }}
                    aria-hidden="true"
                  >
                    <small>+{node.deltaDays}日</small>
                  </span>
                ) : null)}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function CriticalPathSection({ steps, dagValid, hasCriticalPath }: { steps: NavCriticalPathStep[]; dagValid: boolean; hasCriticalPath: boolean }) {
  return (
    <section className={styles.section} aria-label="クリティカルパス">
      <div className={styles.sectionHead}>
        <div>
          <h2>クリティカルパス</h2>
          <p>今日から最終ゲートまでの重要経路。順序・次に詰まる節点・遅延理由・次工程との接続余白を確認する。算出できない場合は数値を作らず「接続余白未算定」と表示する。</p>
        </div>
      </div>
      {!dagValid ? (
        <p className={styles.emptyState}>依存関係が循環しており、重要経路は評価できません（DAG不成立）。</p>
      ) : !hasCriticalPath || steps.length === 0 ? (
        <p className={styles.emptyState}>重要経路が未確定です（依存関係が未登録）。</p>
      ) : (
        <div className={styles.criticalList}>
          {steps.map((step) => (
            <div key={step.slug} className={styles.criticalStep} data-bottleneck={step.isNextBottleneck}>
              <span className={styles.criticalOrder}>{step.order}</span>
              <span>
                <span className={styles.criticalTitle}>{step.title}</span>
                <span className={styles.criticalReason}>{step.delayReason}</span>
              </span>
              <span>{step.statusLabel}{step.isNextBottleneck ? " ・ 次の詰まり" : ""}</span>
              <span>{navTrackMeta(step.track).label}</span>
              <span>{step.bufferLabel}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PartnerJourneySection({
  journeys,
  selection,
  onTogglePartner,
  relatedPartnerIds,
}: {
  journeys: NavPartnerJourney[];
  selection: Selection;
  onTogglePartner: (id: string) => void;
  relatedPartnerIds: Set<string>;
}) {
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => [...journeys].sort((a, b) => {
    if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
    const aBall = a.currentBallSide === "sx";
    const bBall = b.currentBallSide === "sx";
    if (aBall !== bBall) return aBall ? -1 : 1;
    return (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
  }), [journeys]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return sorted;
    return sorted.filter((journey) =>
      journey.name.toLowerCase().includes(term)
      || journey.roleLabel.toLowerCase().includes(term)
      || journey.groupLabel.toLowerCase().includes(term));
  }, [sorted, query]);

  const groups = useMemo(() => {
    const order: string[] = [];
    const byGroup = new Map<string, NavPartnerJourney[]>();
    for (const journey of filtered) {
      if (!byGroup.has(journey.groupLabel)) {
        byGroup.set(journey.groupLabel, []);
        order.push(journey.groupLabel);
      }
      byGroup.get(journey.groupLabel)!.push(journey);
    }
    return order.map((label) => ({ label, items: byGroup.get(label)! }));
  }, [filtered]);

  return (
    <section className={styles.section} aria-label="関係先リスト">
      <div className={styles.sectionHead}>
        <div>
          <h2>関係先リスト（全{journeys.length}件）</h2>
          <p>識別 → 完了済み/直近接点 → 現在（段階・ボール） → 次の受け渡し → 期限・目標の順で確認する。当方がボールを持つ行は左に赤罫線で強調する。</p>
        </div>
        <label className={styles.searchBox}>
          <Search aria-hidden="true" width={14} height={14} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="関係先名・役割・分類で絞り込み"
            aria-label="関係先を絞り込み"
          />
        </label>
      </div>
      {filtered.length === 0 ? (
        <p className={styles.emptyState}>{journeys.length === 0 ? "関係先が未登録です。" : "絞り込み条件に一致する関係先がありません。"}</p>
      ) : (
        groups.map((group) => (
          <div key={group.label} className={styles.partnerGroup}>
            <p className={styles.partnerGroupHeading}>{group.label}（{group.items.length}件）</p>
            <div className={styles.partnerList}>
              {group.items.map((journey) => {
                const selected = selection?.kind === "partner" && selection.id === journey.partnerId;
                const related = !selected && relatedPartnerIds.has(journey.partnerId);
                return (
                  <button
                    key={journey.partnerId}
                    type="button"
                    className={styles.partnerRow}
                    data-ball={journey.currentBallSide}
                    data-selected={selected}
                    data-related={related}
                    onClick={() => onTogglePartner(journey.partnerId)}
                    aria-pressed={selected}
                  >
                    <span className={styles.partnerHead}>
                      <b>{journey.name}</b>
                      <span className={styles.partnerRoleTag}>{journey.roleLabel}{journey.isPriority ? "" : " ・ 保留"}</span>
                    </span>
                    <span className={styles.journeyCol}>
                      <span>完了済み / 直近接点</span>
                      {journey.completedSteps.length === 0
                        ? <b>完了記録なし</b>
                        : journey.completedSteps.map((step) => <b key={step.id}>{step.label}</b>)}
                      {journey.latestInteraction && (
                        <small>直近接点: {journey.latestInteraction.summary}{journey.latestInteraction.occurredOn ? `（${navFormatDate(journey.latestInteraction.occurredOn, journey.latestInteraction.occurredOnPrecision)}）` : ""}</small>
                      )}
                    </span>
                    <span className={styles.journeyCol}>
                      <span>現在</span>
                      <span className={styles.ballTag} data-side={journey.currentBallSide}>{journey.currentStateLabel}</span>
                    </span>
                    <span className={styles.journeyCol}>
                      <span>次の受け渡し</span>
                      <b>{journey.nextHandoffLabel}</b>
                      <small>{journey.nextHandoffDueDate ? `期限 ${navFormatDate(journey.nextHandoffDueDate)}` : "期限未設定"}</small>
                    </span>
                    <span className={styles.journeyCol}>
                      <span>期限・目標</span>
                      <b>{journey.atDeadlineStateLabel}</b>
                      <small>
                        {journey.dueDate ? `期限 ${navFormatDate(journey.dueDate, journey.dueDatePrecision)}` : "期限未設定"}
                        {journey.isOverdue ? " ・ 期限超過" : ""}
                        {" ・ "}{journey.agreementStateLabel}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

const CONSTRAINT_KIND_LABEL: Record<NavConstraintFlag["kind"], string> = {
  capacity: "研究開発人員",
  organization: "体制",
  funding: "資金",
  technical: "技術証明",
};

function ConstraintBoardSection({ flags }: { flags: NavConstraintFlag[] }) {
  return (
    <section className={styles.section} aria-label="制約ボード">
      <div className={styles.sectionHead}>
        <div>
          <h2>制約ボード</h2>
          <p>研究開発人員・資金・技術証明の制約を、根拠のある範囲だけ表示する。カテゴリ間の順位付けはしない。</p>
        </div>
      </div>
      <div className={styles.constraintGrid}>
        {flags.map((flag) => (
          <div key={flag.key} className={styles.constraintCard} data-severity={flag.severity}>
            <p className={styles.constraintKind}>{CONSTRAINT_KIND_LABEL[flag.kind]}</p>
            <b>{flag.label}</b>
            <p>{flag.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DecisionsSection({ pendingDecisions, recentChanges }: { pendingDecisions: NavPendingDecision[]; recentChanges: NavRecentChange[] }) {
  return (
    <section className={styles.section} aria-label="判断待ちと直近変化">
      <div className={styles.sectionHead}>
        <div>
          <h2>判断待ちと直近変化</h2>
          <p>今週決めることと、直近の更新履歴・完了行動を同じ面で確認する。</p>
        </div>
      </div>
      <div className={styles.twoCol}>
        <div className={styles.listPanel} aria-label="判断待ち">
          {pendingDecisions.length === 0 ? (
            <p className={styles.emptyState}>判断待ちの意思決定はありません。</p>
          ) : pendingDecisions.map((decision) => (
            <div key={decision.id} className={styles.listRow}>
              <time>{decision.dueDate ? navFormatDate(decision.dueDate) : "期限未設定"}</time>
              <p>{decision.title}{decision.isThisWeek ? " ・ 今週" : ""}<small>{decision.ownerLabel}</small></p>
            </div>
          ))}
        </div>
        <div className={styles.listPanel} aria-label="直近の変化">
          {recentChanges.length === 0 ? (
            <p className={styles.emptyState}>直近の変化はまだ記録されていません。</p>
          ) : recentChanges.map((change) => (
            <div key={change.id} className={styles.listRow}>
              <time>{navFormatDate(change.changedOn)}</time>
              <p>{change.summary}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
