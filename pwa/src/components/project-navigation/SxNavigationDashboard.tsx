"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, CircleAlert, CircleCheck, CircleHelp, ExternalLink, Plus, Search, ShieldAlert, X } from "lucide-react";
import {
  navAgreementStateLabel,
  navBallSideLabel,
  navFormatDate,
  navMilestoneStatusLabel,
  navPillarMeta,
  navRelationshipStageLabel,
  NAV_PARTNER_STAGE_ORDER,
  type NavDetail,
  type NavHeadline,
  type NavPartnerDetail,
  type NavPartnerRow,
  type NavRow,
  type SxNavigationViewModelV2,
} from "@/lib/sx-navigation-v2";
import { InlineForm, useManagementMutation, type EditorField } from "./ManagementEditor";
import styles from "./navigation.module.css";

const ROW_HEIGHT = 44;

const CONFIDENCE_OPTIONS = [
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
  { value: "unknown", label: "未確認" },
];
const MILESTONE_STATUS_OPTIONS = ["unassessed", "on_track", "attention", "at_risk", "blocked", "completed"].map((v) => ({ value: v, label: navMilestoneStatusLabel(v as never) }));
const ISSUE_STATUS_OPTIONS = [
  { value: "open", label: "未着手" }, { value: "validating", label: "検証中" }, { value: "closed", label: "完了" }, { value: "on_hold", label: "保留" },
];
const ISSUE_KIND_OPTIONS = [
  { value: "fact", label: "事実" }, { value: "hypothesis", label: "仮説" }, { value: "decision_needed", label: "要意思決定" },
];
const HYPOTHESIS_STATUS_OPTIONS = [
  { value: "open", label: "未着手" }, { value: "validating", label: "検証中" }, { value: "validated", label: "成立" },
  { value: "rejected", label: "棄却" }, { value: "decided", label: "判断済み" }, { value: "on_hold", label: "保留" },
];
const EVIDENCE_KIND_OPTIONS = [
  { value: "supporting", label: "根拠（支持）" }, { value: "counter", label: "反証" }, { value: "missing", label: "未評価" }, { value: "observation", label: "観測・履歴" },
];
const VALIDATION_STATUS_OPTIONS = [
  { value: "planned", label: "計画" }, { value: "running", label: "実施中" }, { value: "completed", label: "完了" },
  { value: "blocked", label: "停止" }, { value: "cancelled", label: "中止" },
];
const DECISION_STATUS_OPTIONS = [
  { value: "open", label: "未決定" }, { value: "decided", label: "決定済み" }, { value: "deferred", label: "保留" },
];
const ACTION_STATUS_OPTIONS = [
  { value: "open", label: "未着手" }, { value: "in_progress", label: "進行中" }, { value: "completed", label: "完了" }, { value: "blocked", label: "停止" },
];
const TEST_STATUS_OPTIONS = [
  { value: "unassessed", label: "未評価" }, { value: "planned", label: "計画" }, { value: "running", label: "実施中" },
  { value: "passed", label: "合格" }, { value: "failed", label: "不合格" }, { value: "blocked", label: "停止" },
];
const TRACK_OPTIONS = [
  { value: "business_development", label: "事業開発" }, { value: "technology_development", label: "技術開発" }, { value: "funding", label: "資金調達" }, { value: "organizational_building", label: "体制構築" },
];
const BALL_SIDE_OPTIONS = ["sx", "partner", "shared", "none", "unknown"].map((v) => ({ value: v, label: navBallSideLabel(v as never) }));
const DATE_PRECISION_OPTIONS = [{ value: "day", label: "日付確定" }, { value: "month", label: "月まで" }, { value: "unknown", label: "未確認" }];
const PARTNER_STAGE_OPTIONS = ([...NAV_PARTNER_STAGE_ORDER, "on_hold"] as const).map((v) => ({ value: v, label: navRelationshipStageLabel(v) }));
const AGREEMENT_STATE_OPTIONS = [{ value: "agreed", label: "合意済み" }, { value: "partial", label: "部分合意" }, { value: "unagreed", label: "未合意" }];
const WORK_ITEM_SIDE_OPTIONS = [{ value: "sx", label: "当方" }, { value: "partner", label: "先方" }, { value: "shared", label: "共同" }, { value: "unknown", label: "未確認" }];
const WORK_ITEM_KIND_OPTIONS = [
  { value: "task", label: "タスク" }, { value: "question", label: "確認事項" }, { value: "deliverable", label: "成果物" },
  { value: "decision", label: "判断" }, { value: "approval", label: "承認" }, { value: "response", label: "回答" },
];
const WORK_ITEM_STATUS_OPTIONS = [
  { value: "open", label: "未着手" }, { value: "in_progress", label: "進行中" }, { value: "waiting", label: "待ち" },
  { value: "blocked", label: "停止" }, { value: "on_hold", label: "保留" }, { value: "completed", label: "完了" }, { value: "cancelled", label: "中止" },
];

function optionLabel(options: Array<{ value: string; label: string }>, value: string) {
  return options.find((option) => option.value === value)?.label || value;
}

function slugify(input: string) {
  const base = input.trim().toLowerCase().replace(/[^a-z0-9぀-ヿ一-鿿]+/g, "-").replace(/^-+|-+$/g, "");
  return `${base || "manual"}-${Date.now().toString(36)}`;
}

type Selection = { kind: "detail"; id: string } | { kind: "partner"; slug: string } | null;

export function SxNavigationDashboard({ model }: { model: SxNavigationViewModelV2 }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(model.rows.filter((row) => row.hasChildren && row.defaultExpanded).map((row) => row.id)));
  const [selection, setSelection] = useState<Selection>(null);

  const visibleRows = useMemo(() => {
    const hidden = new Set<string>();
    const out: NavRow[] = [];
    for (const row of model.rows) {
      if (row.parentId && (hidden.has(row.parentId) || !expanded.has(row.parentId))) {
        hidden.add(row.id);
        continue;
      }
      out.push(row);
    }
    return out;
  }, [model.rows, expanded]);

  const rowIndexById = useMemo(() => new Map(visibleRows.map((row, index) => [row.id, index])), [visibleRows]);
  const totalHeight = Math.max(ROW_HEIGHT, visibleRows.length * ROW_HEIGHT);

  const toggleExpand = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const selectDetail = (id: string) => setSelection((current) => (current?.kind === "detail" && current.id === id ? null : { kind: "detail", id }));
  const selectPartner = (slug: string) => setSelection((current) => (current?.kind === "partner" && current.slug === slug ? null : { kind: "partner", slug }));

  if (!model.hasData) return null;

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <NavHeader projectId={model.projectId} projectName={model.projectName} asOf={model.asOf} dataIssues={model.dataIssues} />
        <JudgmentBand headline={model.headline} />
        <div className={styles.layout}>
          <div className={styles.main}>
            <HierarchicalGantt
              rows={visibleRows}
              edges={model.edges}
              scale={model.timelineScale}
              rowIndexById={rowIndexById}
              expanded={expanded}
              onToggleExpand={toggleExpand}
              selection={selection}
              onSelectDetail={selectDetail}
              totalHeight={totalHeight}
            />
            <MilestoneCreatePanel projectId={model.projectId} canManage={model.canManage} pillarDefaults={model.pillarDefaults} />
          </div>
          <DetailPane
            model={model}
            selection={selection}
            onClose={() => setSelection(null)}
          />
          <PartnerLane partners={model.partners} selection={selection} onSelectPartner={selectPartner} projectId={model.projectId} canManage={model.canManage} />
        </div>
      </div>
    </div>
  );
}

function NavHeader({ projectId, projectName, asOf, dataIssues }: { projectId: string; projectName: string; asOf: string; dataIssues: number }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerMain}>
        <p className={styles.eyebrow}>PJ管制ダッシュボード</p>
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

function JudgmentBand({ headline }: { headline: NavHeadline }) {
  const tone = headline.judgmentKey === "on_schedule" ? "ok" : headline.judgmentKey === "needs_intervention" ? "warn" : "unknown";
  const Icon = tone === "ok" ? CircleCheck : tone === "warn" ? ShieldAlert : CircleHelp;
  return (
    <section className={styles.judgmentBand} aria-label="PJ判定帯">
      <span className={styles.judgmentBadge} data-tone={tone}>
        <Icon aria-hidden="true" />
        {headline.judgmentLabel}
      </span>
      <p className={styles.judgmentReasons}>{headline.reasons.length > 0 ? headline.reasons.join(" / ") : "判定理由の記録なし"}</p>
      <div className={styles.judgmentLine}>
        <span className={styles.judgmentItem}>
          <span>最終ゲート</span>
          <b>{headline.finalGateLabel}{headline.finalGateDate ? `（${navFormatDate(headline.finalGateDate)}${headline.finalGateDateCertainty === "provisional" ? "・仮日程" : ""}）` : ""}</b>
        </span>
        <span className={styles.judgmentItem} data-alert={headline.forecastSlipCount > 0}>
          <span>最大遅延（対計画）</span>
          <b>{headline.forecastSlipLabel}</b>
        </span>
        <span className={styles.judgmentItem}>
          <span>次の期限</span>
          <b>{headline.nextDeadlineLabel}</b>
        </span>
        <span className={styles.judgmentItem} data-alert={Boolean(headline.bottleneckMilestoneSlug)}>
          <span>次に詰まる工程</span>
          <b>{headline.bottleneckLabel}</b>
        </span>
        <span className={styles.judgmentItem} data-alert={headline.pendingDecisionCount > 0}>
          <span>判断待ち</span>
          <b>{headline.pendingDecisionCount}件</b>
        </span>
      </div>
    </section>
  );
}

function statusToneAttr(tone: NavRow["tone"]) {
  return tone;
}

function RowLabel({ row }: { row: NavRow }) {
  return (
    <span className={styles.rowBody}>
      <span className={styles.rowLabelLine}>
        {row.isCritical && row.kind !== "critical_group" && <span className={styles.criticalTag}>CRITICAL</span>}
        <span className={styles.rowTitle}>{row.label}</span>
      </span>
      <span className={styles.rowMeta}>
        {row.statusLabel && <span className={styles.statusPill} data-tone={statusToneAttr(row.tone)}>{row.statusLabel}</span>}
        {row.progressLabel && <span className={styles.progressText}>進捗 {row.progressLabel}</span>}
        {row.ownerLabel && <span>{row.ownerLabel}</span>}
      </span>
    </span>
  );
}

function HierarchicalGantt({
  rows,
  edges,
  scale,
  rowIndexById,
  expanded,
  onToggleExpand,
  selection,
  onSelectDetail,
  totalHeight,
}: {
  rows: NavRow[];
  edges: SxNavigationViewModelV2["edges"];
  scale: SxNavigationViewModelV2["timelineScale"];
  rowIndexById: Map<string, number>;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  selection: Selection;
  onSelectDetail: (id: string) => void;
  totalHeight: number;
}) {
  return (
    <section className={styles.ganttPanel} aria-label="階層WBSガント">
      <div className={styles.ganttHead}>
        <h2>階層WBSガント — 重要経路 / 4本柱 / 開発テーマ・技術試験・論点</h2>
        <div className={styles.legend}>
          <span><i className={styles.legendSwatch} data-kind="plan" aria-hidden="true" />予定バー</span>
          <span><i className={styles.legendSwatch} data-kind="delay" aria-hidden="true" />遅延（末尾）</span>
          <span><i className={styles.legendSwatch} data-kind="critical" aria-hidden="true" />重要経路レール</span>
          <span><i className={styles.legendSwatch} data-kind="marker" aria-hidden="true" />論点・試験・履歴の時点</span>
        </div>
      </div>
      {!scale.hasDates ? (
        <p className={styles.emptyState}>日程データが未設定のため、ガントは表示できません（未評価）。</p>
      ) : (
        <div className={styles.ganttBody}>
          <div className={styles.ganttLeft}>
            <div className={styles.ganttLeftAxisSpacer} aria-hidden="true" />
            {rows.map((row) => {
              const selected = selection?.kind === "detail" && selection.id === row.detailId;
              return (
                <div
                  key={row.id}
                  className={`${styles.row} ${styles.rowLeft}`}
                  data-kind={row.kind}
                  data-selected={selected}
                  data-critical={row.isCritical}
                  style={{ paddingLeft: 4 + row.depth * 16, height: ROW_HEIGHT }}
                >
                    {row.hasChildren ? (
                      <button
                        type="button"
                        className={styles.expandBtn}
                        data-open={expanded.has(row.id)}
                        onClick={(event) => { event.stopPropagation(); onToggleExpand(row.id); }}
                        aria-label={expanded.has(row.id) ? "折りたたむ" : "展開する"}
                      >
                        <ChevronRight aria-hidden="true" />
                      </button>
                    ) : (
                      <span className={styles.expandSpacer} aria-hidden="true" />
                    )}
                    {row.selectable && row.detailId ? (
                      <button type="button" className={styles.rowSelect} onClick={() => onSelectDetail(row.detailId as string)} aria-pressed={selected}>
                        <RowLabel row={row} />
                      </button>
                    ) : (
                      <span className={styles.rowSelectStatic}><RowLabel row={row} /></span>
                    )}
                </div>
              );
            })}
          </div>
          <div className={styles.ganttRightOuter}>
            <div className={styles.ganttRightInner}>
              <div className={styles.ganttAxis}>
                {scale.axisTicks.map((tick) => (
                  <span key={tick.label} className={styles.ganttAxisTick} style={{ left: `${tick.pct}%` }}>{tick.label}</span>
                ))}
              </div>
              <div className={styles.trackBg} style={{ height: totalHeight }}>
                {rows.map((row, index) => (
                  <span key={`guide-${row.id}`} className={styles.ganttGuide} style={{ top: (index + 1) * ROW_HEIGHT - 1 }} aria-hidden="true" />
                ))}
                {scale.todayPct != null && <div className={styles.ganttToday} style={{ left: `${scale.todayPct}%` }} />}
                <svg className={styles.ganttSvg} width="100%" height={totalHeight} preserveAspectRatio="none" viewBox={`0 0 1000 ${totalHeight}`} aria-hidden="true">
                  {edges.map((edge) => {
                    const fromIndex = rowIndexById.get(`crit-milestone:${edge.fromSlug}`);
                    const toIndex = rowIndexById.get(`crit-milestone:${edge.toSlug}`);
                    if (fromIndex == null || toIndex == null) return null;
                    const fromRow = rows[fromIndex];
                    const toRow = rows[toIndex];
                    const fromEndPct = fromRow.bar?.delaySegment?.endPct ?? fromRow.bar?.endPct;
                    const toStartPct = toRow.bar?.startPct;
                    if (fromEndPct == null || toStartPct == null) return null;
                    const x1 = fromEndPct * 10;
                    const y1 = fromIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const x2 = toStartPct * 10;
                    const y2 = toIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const midX = Math.max(x1, Math.min(x1 + 30, (x1 + x2) / 2));
                    return (
                      <path
                        key={edge.id}
                        d={`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`}
                        fill="none"
                        stroke="var(--red)"
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                </svg>
                {rows.map((row, index) => {
                  const selected = selection?.kind === "detail" && selection.id === row.detailId;
                  const top = index * ROW_HEIGHT + ROW_HEIGHT / 2;
                  if (row.bar) {
                    return <GanttBar key={row.id} row={row} top={top} selected={selected} onSelectDetail={onSelectDetail} />;
                  }
                  if (row.pointPct != null) {
                    return (
                      <div key={row.id} className={styles.noBarLine} style={{ position: "absolute", top: index * ROW_HEIGHT, left: 0, right: 0, height: ROW_HEIGHT }}>
                        <button
                          type="button"
                          className={styles.pointMarker}
                          data-tone={statusToneAttr(row.tone)}
                          style={{ left: `${row.pointPct}%`, top: "50%" }}
                          onClick={() => (row.detailId ? onSelectDetail(row.detailId) : undefined)}
                          aria-label={`${row.label}${row.pointLabel ? `（${row.pointLabel}）` : ""}`}
                        />
                        {row.pointLabel && <span className={styles.pointLabel} style={{ left: `${row.pointPct}%` }}>{row.pointLabel}</span>}
                      </div>
                    );
                  }
                  return (
                    <div key={row.id} className={styles.noBarLine} data-kind={row.kind} style={row.kind === "critical_group" || row.kind === "pillar_group" ? { background: "var(--panel-quiet)" } : undefined}>
                      {row.dateUnsetLabel && <span className={styles.dateUnsetTag}>{row.dateUnsetLabel}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function GanttBar({ row, top, selected, onSelectDetail }: { row: NavRow; top: number; selected: boolean; onSelectDetail: (id: string) => void }) {
  const bar = row.bar;
  if (!bar) return null;
  const span = Math.max(0.001, bar.endPct - bar.startPct);
  const content = (
    <>
      <span className={styles.barPlan} />
      {bar.delaySegment && (
        <span
          className={styles.barDelay}
          style={{ left: `${((bar.delaySegment.startPct - bar.startPct) / span) * 100}%`, width: `${((bar.delaySegment.endPct - bar.delaySegment.startPct) / span) * 100}%` }}
        >
          <span className={styles.barDelayLabel}>+{bar.delayDays}日</span>
        </span>
      )}
      {bar.plannedEndTickPct != null && <span className={styles.barPlannedTick} style={{ left: `${((bar.plannedEndTickPct - bar.startPct) / span) * 100}%` }} />}
      {bar.progressMarkerPct != null && <span className={styles.barProgressMarker} style={{ left: `${((bar.progressMarkerPct - bar.startPct) / span) * 100}%` }} />}
      {bar.pulledInDays != null && <span className={styles.barPulledLabel}>前倒し{bar.pulledInDays}日</span>}
    </>
  );
  const className = styles.bar;
  const style = { top, left: `${bar.startPct}%`, width: `${Math.max(0.6, span)}%` };
  const status = row.tone === "danger" ? "blocked" : row.tone === "watch" ? "at_risk" : row.tone === "ok" ? "completed" : row.tone === "unknown" ? "unassessed" : "on_track";
  if (!row.detailId) {
    return <div className={className} data-status={status} data-critical={row.isCritical} style={style} aria-hidden="true">{content}</div>;
  }
  return (
    <button
      type="button"
      className={className}
      data-status={status}
      data-critical={row.isCritical}
      data-selected={selected}
      style={style}
      onClick={() => onSelectDetail(row.detailId as string)}
      aria-label={`${row.label}: ${row.statusLabel}${bar.delayDays ? `、予定より+${bar.delayDays}日` : bar.pulledInDays ? `、前倒し${bar.pulledInDays}日` : ""}`}
    >{content}</button>
  );
}

function MilestoneCreatePanel({ projectId, canManage, pillarDefaults }: {
  projectId: string;
  canManage: boolean;
  pillarDefaults: SxNavigationViewModelV2["pillarDefaults"];
}) {
  const [open, setOpen] = useState(false);
  const { submit, pending, error, setError } = useManagementMutation(projectId);
  if (!canManage) return null;
  const fields: EditorField[] = [
    { key: "track", label: "柱", type: "select", options: TRACK_OPTIONS },
    { key: "title", label: "工程名", type: "text" },
    { key: "gate", label: "ゲート条件", type: "textarea" },
    { key: "planned_start", label: "計画開始日", type: "date" },
    { key: "planned_end", label: "計画終了日", type: "date" },
    { key: "forecast_end", label: "予測終了日", type: "date" },
    { key: "date_certainty", label: "日程確度", type: "select", options: [{ value: "provisional", label: "仮置き" }, { value: "confirmed", label: "確定" }] },
    { key: "owner_label", label: "担当", type: "text" },
    { key: "next_deliverable", label: "次の成果物", type: "textarea" },
    { key: "max_issue", label: "最大の論点", type: "textarea" },
    { key: "completion_criteria", label: "完了条件", type: "textarea" },
    { key: "criticality", label: "重要度", type: "select", options: [{ value: "critical", label: "最重要" }, { value: "high", label: "高" }, { value: "medium", label: "中" }, { value: "low", label: "低" }] },
    { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];
  return (
    <section className={styles.createPanel} aria-label="工程を追加">
      {!open ? (
        <button type="button" className={styles.addBtn} onClick={() => setOpen(true)}><Plus width={13} height={13} aria-hidden="true" />工程を手入力</button>
      ) : (
        <InlineForm
          fields={fields}
          defaults={{ track: "business_development", date_certainty: "provisional", criticality: "high", confidence: "unknown" }}
          submitLabel="工程を追加"
          pending={pending}
          error={error}
          onCancel={() => { setOpen(false); setError(null); }}
          onSubmit={async (values) => {
            const track = String(values.track || "business_development") as keyof typeof pillarDefaults;
            const parents = pillarDefaults[track];
            if (!parents) { setError("この柱の親となる成果目標が未登録だよ。先にワークスペースで成果目標を作ってね。"); return; }
            const title = String(values.title || "工程");
            const ok = await submit({ method: "POST", resource: "milestone", fields: { ...values, objective_id: parents.objectiveId, outcome_id: parents.outcomeId, slug: slugify(title) } });
            if (ok) setOpen(false);
          }}
        />
      )}
    </section>
  );
}

function PartnerLane({
  partners,
  selection,
  onSelectPartner,
  projectId,
  canManage,
}: {
  partners: NavPartnerRow[];
  selection: Selection;
  onSelectPartner: (slug: string) => void;
  projectId: string;
  canManage: boolean;
}) {
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [ballFilter, setBallFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const { submit, pending, error, setError } = useManagementMutation(projectId);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return partners.filter((partner) => {
      if (term && !(partner.name.toLowerCase().includes(term) || partner.roleLabel.toLowerCase().includes(term))) return false;
      if (stageFilter !== "all" && (partner.isOnHold ? "on_hold" : String(partner.stageIndex)) !== stageFilter) return false;
      if (ballFilter !== "all" && partner.currentBallSide !== ballFilter) return false;
      return true;
    });
  }, [partners, query, stageFilter, ballFilter]);

  const createFields: EditorField[] = [
    { key: "name", label: "名称", type: "text" },
    { key: "role_label", label: "役割ラベル", type: "text" },
    { key: "primary_track", label: "主担当領域", type: "select", options: TRACK_OPTIONS },
    { key: "relationship_stage", label: "関係段階", type: "select", options: PARTNER_STAGE_OPTIONS },
    { key: "agreement_state", label: "合意状態", type: "select", options: AGREEMENT_STATE_OPTIONS },
    { key: "agreed_scope", label: "合意済み範囲", type: "textarea" },
    { key: "unagreed_scope", label: "未合意範囲", type: "textarea" },
    { key: "next_commitment", label: "次の約束事", type: "textarea" },
    { key: "due_date", label: "期限日", type: "date" },
    { key: "due_date_precision", label: "期限の確度", type: "select", options: DATE_PRECISION_OPTIONS },
    { key: "owner_label", label: "当方担当", type: "text" },
    { key: "current_ball_side", label: "現在のボール", type: "select", options: BALL_SIDE_OPTIONS },
    { key: "target_state", label: "目標状態", type: "text" },
    { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];

  return (
    <section className={styles.section} aria-label="関係先比較レーン">
      <div className={styles.sectionHead}>
        <div>
          <h2>関係先比較レーン（全{partners.length}件）</h2>
          <p>共通7段階（候補→情報交換→条件整理→面談調整→検証準備→合意確認→実行）の関係段階比較。成果達成率ではない。当方ボール・期限超過を上位に表示。</p>
        </div>
        <label className={styles.searchBox}>
          <Search aria-hidden="true" width={14} height={14} />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名称・役割で絞り込み" aria-label="関係先を絞り込み" />
        </label>
      </div>
      <div className={styles.filterRow}>
        <button type="button" className={styles.filterChip} data-active={stageFilter === "all"} onClick={() => setStageFilter("all")}>段階: すべて</button>
        {NAV_PARTNER_STAGE_ORDER.map((stage, index) => (
          <button key={stage} type="button" className={styles.filterChip} data-active={stageFilter === String(index + 1)} onClick={() => setStageFilter(String(index + 1))}>{index + 1}. {navRelationshipStageLabel(stage)}</button>
        ))}
        <button type="button" className={styles.filterChip} data-active={stageFilter === "on_hold"} onClick={() => setStageFilter("on_hold")}>保留</button>
        <button type="button" className={styles.filterChip} data-active={ballFilter === "sx"} onClick={() => setBallFilter(ballFilter === "sx" ? "all" : "sx")}>当方ボールのみ</button>
        {canManage && (
          <button type="button" className={styles.addBtn} onClick={() => setShowCreate((v) => !v)}><Plus width={13} height={13} aria-hidden="true" />関係先を追加</button>
        )}
      </div>
      {showCreate && (
        <InlineForm
          fields={createFields}
          defaults={{ relationship_stage: "candidate", agreement_state: "unagreed", current_ball_side: "unknown", due_date_precision: "unknown", confidence: "unknown" }}
          submitLabel="関係先を追加"
          pending={pending}
          error={error}
          onCancel={() => { setShowCreate(false); setError(null); }}
          onSubmit={async (values) => {
            const ok = await submit({ method: "POST", resource: "partner", fields: { ...values, slug: slugify(String(values.name || "partner")) } });
            if (ok) setShowCreate(false);
          }}
        />
      )}
      {filtered.length === 0 ? (
        <p className={styles.emptyState}>{partners.length === 0 ? "関係先が未登録です。" : "絞り込み条件に一致する関係先がありません。"}</p>
      ) : (
        <div className={styles.partnerPanel}>
          <table className={styles.partnerTable}>
            <thead>
              <tr>
                <th>名称・役割</th>
                <th>関係段階（1〜7）・合意</th>
                <th>現在のボール</th>
                <th>次の受け渡し</th>
                <th>期限</th>
                <th>目標状態</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((partner) => {
                const selected = selection?.kind === "partner" && selection.slug === partner.slug;
                return (
                  <tr
                    key={partner.id}
                    className={styles.partnerRow}
                    data-selected={selected}
                    data-overdue={partner.isOverdue}
                    onClick={() => onSelectPartner(partner.slug)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectPartner(partner.slug); } }}
                    tabIndex={0}
                    role="button"
                    aria-pressed={selected}
                  >
                    <td>
                      <span className={styles.partnerNameCell}>
                        <b>{partner.name}</b>
                        <small>{partner.roleLabel}</small>
                      </span>
                    </td>
                    <td>
                      {partner.isOnHold ? (
                        <span className={styles.stageOnHold}>保留</span>
                      ) : (
                        <span className={styles.stageRail} aria-label={`関係段階 ${partner.stageIndex}/7 ・ ${partner.stageLabel}`}>
                          {NAV_PARTNER_STAGE_ORDER.map((_, index) => (
                            <span key={index} className={styles.stageDot} data-filled={partner.stageIndex != null && index < partner.stageIndex} data-current={partner.stageIndex === index + 1} />
                          ))}
                          <b className={styles.stageCount}>{partner.stageIndex}/7</b>
                        </span>
                      )}
                      <small className={styles.stageMeta}>{partner.stageLabel} ・ {partner.agreementStateLabel}</small>
                    </td>
                    <td className={styles.ballCell} data-side={partner.currentBallSide}>{partner.currentBallSideLabel}{partner.currentBallOwner ? `（${partner.currentBallOwner}）` : ""}</td>
                    <td>{partner.nextHandoffLabel}</td>
                    <td className={styles.dueCell} data-overdue={partner.isOverdue}>{partner.dueDateLabel}{partner.isOverdue ? " ・ 超過" : ""}</td>
                    <td>{partner.targetStateLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DetailPane({
  model,
  selection,
  onClose,
}: {
  model: SxNavigationViewModelV2;
  selection: Selection;
  onClose: () => void;
}) {
  if (!selection) {
    return (
      <aside className={styles.detailPane} aria-label="選択詳細">
        <div className={styles.detailEmpty}>
          <p>左のガント・下の関係先レーンから行を選ぶと、ここに詳細が表示されます。</p>
          <p>論点は「論点 → 仮説 → 根拠・反証 → 検証 → 判断 → アクション」の順で確認できます。</p>
        </div>
      </aside>
    );
  }
  if (selection.kind === "partner") {
    const detail = model.partnerDetails[selection.slug];
    if (!detail) return null;
    return <PartnerDetailPane detail={detail} projectId={model.projectId} canManage={model.canManage} onClose={onClose} />;
  }
  const detail = model.details[selection.id];
  if (!detail) return null;
  if (detail.kind === "milestone") return <MilestoneDetailPane detail={detail} projectId={model.projectId} canManage={model.canManage} onClose={onClose} />;
  if (detail.kind === "issue") return <IssueDetailPane detail={detail} projectId={model.projectId} canManage={model.canManage} onClose={onClose} />;
  if (detail.kind === "technical_test") return <TestDetailPane detail={detail} projectId={model.projectId} canManage={model.canManage} onClose={onClose} />;
  return <HistoryDetailPane detail={detail} projectId={model.projectId} canManage={model.canManage} onClose={onClose} />;
}

function DetailHead({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose: () => void }) {
  return (
    <div className={styles.detailHead}>
      <div>
        <p className={styles.detailEyebrow}>{eyebrow}</p>
        <h3 className={styles.detailTitle}>{title}</h3>
      </div>
      <button type="button" className={styles.detailCloseBtn} onClick={onClose} aria-label="詳細を閉じる"><X width={14} height={14} aria-hidden="true" /></button>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className={styles.detailField}>
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}

function MilestoneDetailPane({ detail, projectId, canManage, onClose }: { detail: Extract<NavDetail, { kind: "milestone" }>; projectId: string; canManage: boolean; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState<"issue" | "technical_test" | null>(null);
  const { submit, pending, error, setError } = useManagementMutation(projectId);
  const editFields: EditorField[] = [
    { key: "status", label: "状態", type: "select", options: MILESTONE_STATUS_OPTIONS },
    { key: "forecast_end", label: "予測終了日", type: "date" },
    { key: "actual_end", label: "実終了日", type: "date" },
    { key: "progress_pct", label: "進捗（%）", type: "number" },
    { key: "next_deliverable", label: "次の成果物", type: "textarea" },
    { key: "max_issue", label: "最大の論点", type: "textarea" },
    { key: "forecast_change_reason", label: "予測変更理由", type: "textarea" },
    { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];
  const issueFields: EditorField[] = [
    { key: "title", label: "論点", type: "textarea" },
    { key: "knowledge_type", label: "種別", type: "select", options: ISSUE_KIND_OPTIONS },
    { key: "status", label: "状態", type: "select", options: ISSUE_STATUS_OPTIONS },
    { key: "owner_label", label: "担当", type: "text" },
    { key: "due_date", label: "期限", type: "date" },
    { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];
  const testFields: EditorField[] = [
    { key: "test_name", label: "試験名", type: "text" },
    { key: "test_condition", label: "試験条件", type: "textarea" },
    { key: "target", label: "目標値", type: "text" },
    { key: "unit", label: "単位", type: "text" },
    { key: "repetition", label: "反復回数", type: "number" },
    { key: "trl_criterion", label: "判定基準", type: "textarea" },
    { key: "evidence", label: "根拠・所見", type: "textarea" },
    { key: "measured_on", label: "測定日", type: "date" },
    { key: "owner_label", label: "担当", type: "text" },
    { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];
  return (
    <aside className={styles.detailPane} aria-label="ゲート詳細">
      <DetailHead eyebrow={`ゲート ・ ${navPillarMeta(detail.track).label}`} title={detail.title} onClose={onClose} />
      <div className={styles.detailMetaRow}>
        <span className={styles.statusPill} data-tone="neutral">{detail.statusLabel}</span>
        <span>{detail.ownerLabel}</span>
      </div>
      <Field label="ゲート条件" value={detail.gate} />
      <Field label="計画期間" value={`${navFormatDate(detail.plannedStart)} 〜 ${navFormatDate(detail.plannedEnd)}`} />
      <Field label="予測終了" value={detail.forecastEnd ? navFormatDate(detail.forecastEnd) : null} />
      <Field label="実終了" value={detail.actualEnd ? navFormatDate(detail.actualEnd) : null} />
      <Field label="進捗" value={`${detail.progressPct}%`} />
      <Field label="完了条件" value={detail.completionCriteria} />
      <Field label="完了証跡" value={detail.completionEvidence} />
      <Field label="次の成果物" value={detail.nextDeliverable} />
      <Field label="最大の論点" value={detail.maxIssue} />
      <Field label="予測変更理由" value={detail.forecastChangeReason} />
      <div className={styles.detailMetaRow}>
        <span>確度: {detail.confidence}</span>
        <span>最終確認: {navFormatDate(detail.lastVerifiedAt)}</span>
      </div>
      {canManage && !editing && <button type="button" className={styles.editBtn} onClick={() => setEditing(true)}>編集</button>}
      {editing && (
        <InlineForm
          fields={editFields}
          defaults={{ status: detail.status, forecast_end: detail.forecastEnd || "", actual_end: detail.actualEnd || "", progress_pct: detail.progressPct, next_deliverable: detail.nextDeliverable, max_issue: detail.maxIssue, forecast_change_reason: detail.forecastChangeReason || "", confidence: detail.confidence }}
          submitLabel="保存"
          pending={pending}
          error={error}
          onCancel={() => { setEditing(false); setError(null); }}
          onSubmit={async (values) => {
            const ok = await submit({ method: "PATCH", resource: "milestone", id: detail.id, patch: values });
            if (ok) setEditing(false);
          }}
        />
      )}
      {canManage && !adding && (
        <div className={styles.detailActionRow}>
          <button type="button" className={styles.addBtn} onClick={() => setAdding("issue")}><Plus width={12} height={12} aria-hidden="true" />論点を追加</button>
          <button type="button" className={styles.addBtn} onClick={() => setAdding("technical_test")}><Plus width={12} height={12} aria-hidden="true" />技術試験を追加</button>
        </div>
      )}
      {adding === "issue" && (
        <InlineForm
          fields={issueFields}
          defaults={{ knowledge_type: "hypothesis", status: "open", confidence: "unknown" }}
          submitLabel="論点を追加"
          pending={pending}
          error={error}
          onCancel={() => { setAdding(null); setError(null); }}
          onSubmit={async (values) => {
            const title = String(values.title || "論点");
            const ok = await submit({ method: "POST", resource: "issue", fields: { ...values, milestone_id: detail.id, outcome_id: detail.outcomeId, track: detail.track, slug: slugify(title) } });
            if (ok) setAdding(null);
          }}
        />
      )}
      {adding === "technical_test" && (
        <InlineForm
          fields={testFields}
          defaults={{ confidence: "unknown" }}
          submitLabel="技術試験を追加"
          pending={pending}
          error={error}
          onCancel={() => { setAdding(null); setError(null); }}
          onSubmit={async (values) => {
            const name = String(values.test_name || "試験");
            const ok = await submit({ method: "POST", resource: "technical_test", fields: { ...values, milestone_id: detail.id, outcome_id: detail.outcomeId, test_slug: slugify(name) } });
            if (ok) setAdding(null);
          }}
        />
      )}
    </aside>
  );
}

function IssueDetailPane({ detail, projectId, canManage, onClose }: { detail: Extract<NavDetail, { kind: "issue" }>; projectId: string; canManage: boolean; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const [openForm, setOpenForm] = useState<null | {
    kind: "hypothesis" | "evidence" | "decision" | "validation" | "action"
      | "edit_hypothesis" | "edit_evidence" | "edit_validation" | "edit_decision" | "edit_action";
    contextId?: string;
  }>(null);
  const { submit, pending, error, setError } = useManagementMutation(projectId);

  const editFields: EditorField[] = [
    { key: "title", label: "論点タイトル", type: "text" },
    { key: "knowledge_type", label: "種別", type: "select", options: ISSUE_KIND_OPTIONS },
    { key: "status", label: "状態", type: "select", options: ISSUE_STATUS_OPTIONS },
    { key: "owner_label", label: "担当", type: "text" },
    { key: "due_date", label: "期限", type: "date" },
    { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];
  const hypothesisFields: EditorField[] = [
    { key: "statement", label: "仮説", type: "textarea" },
    { key: "status", label: "状態", type: "select", options: HYPOTHESIS_STATUS_OPTIONS },
    { key: "owner_label", label: "担当", type: "text" },
    { key: "due_date", label: "期限", type: "date" },
    { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];
  const evidenceFields: EditorField[] = [
    { key: "evidence_kind", label: "種別", type: "select", options: EVIDENCE_KIND_OPTIONS },
    { key: "summary", label: "内容", type: "textarea" },
    { key: "observed_on", label: "観測日", type: "date" },
    { key: "source_label", label: "根拠出典", type: "text" },
    { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];
  const validationFields: EditorField[] = [
    { key: "validation_kind", label: "検証の種類", type: "text" },
    { key: "planned_on", label: "計画日", type: "date" },
    { key: "due_date", label: "期限", type: "date" },
    { key: "completed_on", label: "完了日", type: "date" },
    { key: "status", label: "状態", type: "select", options: VALIDATION_STATUS_OPTIONS },
    { key: "owner_label", label: "担当", type: "text" },
    { key: "method", label: "方法", type: "textarea" },
    { key: "result_summary", label: "結果", type: "textarea" },
    { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];
  const decisionFields: EditorField[] = [
    { key: "title", label: "決定タイトル", type: "text" },
    { key: "context", label: "背景", type: "textarea" },
    { key: "rationale", label: "根拠", type: "textarea" },
    { key: "decision_text", label: "決定内容", type: "textarea" },
    { key: "decided_by", label: "決定者", type: "text" },
    { key: "decided_on", label: "決定日", type: "date" },
    { key: "owner_label", label: "担当", type: "text" },
    { key: "due_date", label: "期限", type: "date" },
    { key: "status", label: "状態", type: "select", options: DECISION_STATUS_OPTIONS },
    { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];
  const actionFields: EditorField[] = [
    { key: "title", label: "アクション", type: "text" },
    { key: "owner_label", label: "担当", type: "text" },
    { key: "due_date", label: "期限", type: "date" },
    { key: "completion_criteria", label: "完了条件", type: "textarea" },
    { key: "next_review_on", label: "次回確認日", type: "date" },
    { key: "status", label: "状態", type: "select", options: ACTION_STATUS_OPTIONS },
  ];

  return (
    <aside className={styles.detailPane} aria-label="論点詳細">
      <DetailHead eyebrow={`論点 ・ ${navPillarMeta(detail.track).label}`} title={detail.title} onClose={onClose} />
      <div className={styles.detailMetaRow}>
        <span className={styles.statusPill} data-tone="neutral">{detail.statusLabel}</span>
        <span>{detail.ownerLabel}</span>
        <span>{detail.dueDate ? `期限 ${navFormatDate(detail.dueDate)}` : "期限未設定"}</span>
      </div>
      {canManage && !editing && <button type="button" className={styles.editBtn} onClick={() => setEditing(true)}>論点を編集</button>}
      {editing && (
        <InlineForm
          fields={editFields}
          defaults={{ title: detail.title, knowledge_type: detail.knowledgeType, status: detail.status, owner_label: detail.ownerLabel, due_date: detail.dueDate || "", confidence: detail.confidence }}
          submitLabel="保存"
          pending={pending}
          error={error}
          onCancel={() => { setEditing(false); setError(null); }}
          onSubmit={async (values) => { const ok = await submit({ method: "PATCH", resource: "issue", id: detail.id, patch: values }); if (ok) setEditing(false); }}
        />
      )}

      <hr className={styles.detailDivider} />
      <p className={styles.detailSub}>仮説</p>
      <div className={styles.chainList}>
        {detail.hypotheses.length === 0 ? <p className={styles.chainItemMeta}>仮説は未登録です。</p> : detail.hypotheses.map((h) => (
          <div key={h.id} className={styles.chainStage}>
            <div className={styles.chainItemHead}>
              <p className={styles.chainItem}>{h.statement}<span className={styles.chainItemMeta}>{optionLabel(HYPOTHESIS_STATUS_OPTIONS, h.status)} ・ {h.ownerLabel}{h.dueDate ? ` ・ 期限${navFormatDate(h.dueDate)}` : ""}</span></p>
              {canManage && <button type="button" className={styles.miniEditBtn} onClick={() => setOpenForm({ kind: "edit_hypothesis", contextId: h.id })}>編集</button>}
            </div>
            {openForm?.kind === "edit_hypothesis" && openForm.contextId === h.id && (
              <InlineForm fields={hypothesisFields} defaults={{ statement: h.statement, status: h.status, owner_label: h.ownerLabel, due_date: h.dueDate || "", confidence: h.confidence }} submitLabel="仮説を保存" pending={pending} error={error} onCancel={() => { setOpenForm(null); setError(null); }}
                onSubmit={async (values) => { const ok = await submit({ method: "PATCH", resource: "hypothesis", id: h.id, patch: values }); if (ok) setOpenForm(null); }} />
            )}
          </div>
        ))}
        {canManage && (openForm?.kind === "hypothesis" ? (
          <InlineForm fields={hypothesisFields} submitLabel="仮説を追加" pending={pending} error={error} onCancel={() => { setOpenForm(null); setError(null); }}
            onSubmit={async (values) => { const ok = await submit({ method: "POST", resource: "hypothesis", fields: { ...values, issue_id: detail.id } }); if (ok) setOpenForm(null); }} />
        ) : (
          <button type="button" className={styles.addBtn} onClick={() => setOpenForm({ kind: "hypothesis" })}><Plus width={12} height={12} aria-hidden="true" />仮説を追加</button>
        ))}
      </div>

      <p className={styles.detailSub}>根拠・反証</p>
      <div className={styles.chainList}>
        {detail.evidence.length === 0 ? <p className={styles.chainItemMeta}>根拠は未登録です。</p> : detail.evidence.map((e) => (
          <div key={e.id} className={styles.chainStage}>
            <div className={styles.chainItemHead}>
              <p className={styles.chainItem}>{e.summary}<span className={styles.chainItemMeta}>{optionLabel(EVIDENCE_KIND_OPTIONS, e.kind)} ・ {e.observedOn ? navFormatDate(e.observedOn) : "日付未確認"}</span></p>
              {canManage && <button type="button" className={styles.miniEditBtn} onClick={() => setOpenForm({ kind: "edit_evidence", contextId: e.id })}>編集</button>}
            </div>
            {openForm?.kind === "edit_evidence" && openForm.contextId === e.id && (
              <InlineForm fields={evidenceFields} defaults={{ evidence_kind: e.kind, summary: e.summary, observed_on: e.observedOn || "", source_label: e.sourceLabel, confidence: e.confidence }} submitLabel="根拠を保存" pending={pending} error={error} onCancel={() => { setOpenForm(null); setError(null); }}
                onSubmit={async (values) => { const ok = await submit({ method: "PATCH", resource: "evidence", id: e.id, patch: values }); if (ok) setOpenForm(null); }} />
            )}
          </div>
        ))}
        {canManage && (openForm?.kind === "evidence" ? (
          <InlineForm fields={evidenceFields} submitLabel="根拠を追加" pending={pending} error={error} onCancel={() => { setOpenForm(null); setError(null); }}
            onSubmit={async (values) => { const ok = await submit({ method: "POST", resource: "evidence", fields: { ...values, issue_id: detail.id } }); if (ok) setOpenForm(null); }} />
        ) : (
          <button type="button" className={styles.addBtn} onClick={() => setOpenForm({ kind: "evidence" })}><Plus width={12} height={12} aria-hidden="true" />根拠・反証を追加</button>
        ))}
      </div>

      <p className={styles.detailSub}>検証</p>
      <div className={styles.chainList}>
        {detail.validations.length === 0 ? <p className={styles.chainItemMeta}>検証は未登録です。</p> : detail.validations.map((v) => (
          <div key={v.id} className={styles.chainStage}>
            <div className={styles.chainItemHead}>
              <p className={styles.chainItem}>{v.validationKind}<span className={styles.chainItemMeta}>{optionLabel(VALIDATION_STATUS_OPTIONS, v.status)} ・ {v.method}{v.resultSummary ? ` ・ 結果: ${v.resultSummary}` : ""}</span></p>
              {canManage && <button type="button" className={styles.miniEditBtn} onClick={() => setOpenForm({ kind: "edit_validation", contextId: v.id })}>編集</button>}
            </div>
            {openForm?.kind === "edit_validation" && openForm.contextId === v.id && (
              <InlineForm fields={validationFields} defaults={{ validation_kind: v.validationKind, planned_on: v.plannedOn || "", due_date: v.dueDate || "", completed_on: v.completedOn || "", status: v.status, owner_label: v.ownerLabel, method: v.method, result_summary: v.resultSummary || "", confidence: v.confidence }} submitLabel="検証を保存" pending={pending} error={error} onCancel={() => { setOpenForm(null); setError(null); }}
                onSubmit={async (values) => { const ok = await submit({ method: "PATCH", resource: "validation", id: v.id, patch: values }); if (ok) setOpenForm(null); }} />
            )}
          </div>
        ))}
        {canManage && detail.hypotheses.length > 0 && (openForm?.kind === "validation" ? (
          <InlineForm fields={validationFields} submitLabel="検証を追加" pending={pending} error={error} onCancel={() => { setOpenForm(null); setError(null); }}
            onSubmit={async (values) => { const ok = await submit({ method: "POST", resource: "validation", fields: { ...values, hypothesis_id: openForm.contextId || detail.hypotheses[0].id } }); if (ok) setOpenForm(null); }} />
        ) : (
          <button type="button" className={styles.addBtn} onClick={() => setOpenForm({ kind: "validation", contextId: detail.hypotheses[0]?.id })}><Plus width={12} height={12} aria-hidden="true" />検証を追加</button>
        ))}
      </div>

      <p className={styles.detailSub}>判断</p>
      <div className={styles.chainList}>
        {detail.decisions.length === 0 ? <p className={styles.chainItemMeta}>判断は未登録です。</p> : detail.decisions.map((d) => (
          <div key={d.id} className={styles.chainStage}>
            <div className={styles.chainItemHead}>
              <p className={styles.chainItem}>{d.title}<span className={styles.chainItemMeta}>{optionLabel(DECISION_STATUS_OPTIONS, d.status)}{d.decisionText ? ` ・ ${d.decisionText}` : ""}{d.dueDate ? ` ・ 期限${navFormatDate(d.dueDate)}` : ""}</span></p>
              {canManage && <button type="button" className={styles.miniEditBtn} onClick={() => setOpenForm({ kind: "edit_decision", contextId: d.id })}>編集</button>}
            </div>
            {openForm?.kind === "edit_decision" && openForm.contextId === d.id && (
              <InlineForm fields={decisionFields} defaults={{ title: d.title, context: d.context, rationale: d.rationale, decision_text: d.decisionText || "", decided_by: d.decidedBy || "", decided_on: d.decidedOn || "", owner_label: d.ownerLabel, due_date: d.dueDate || "", status: d.status, confidence: d.confidence }} submitLabel="判断を保存" pending={pending} error={error} onCancel={() => { setOpenForm(null); setError(null); }}
                onSubmit={async (values) => { const ok = await submit({ method: "PATCH", resource: "decision", id: d.id, patch: values }); if (ok) setOpenForm(null); }} />
            )}
            {d.actionItems.map((a) => (
              <div key={a.id} className={styles.actionLine}>
                <p className={styles.chainItemMeta}>└ {a.title}（{optionLabel(ACTION_STATUS_OPTIONS, a.status)}）</p>
                {canManage && <button type="button" className={styles.miniEditBtn} onClick={() => setOpenForm({ kind: "edit_action", contextId: a.id })}>編集</button>}
                {openForm?.kind === "edit_action" && openForm.contextId === a.id && (
                  <InlineForm fields={actionFields} defaults={{ title: a.title, owner_label: a.ownerLabel, due_date: a.dueDate || "", completion_criteria: a.completionCriteria, next_review_on: a.nextReviewOn || "", status: a.status }} submitLabel="アクションを保存" pending={pending} error={error} onCancel={() => { setOpenForm(null); setError(null); }}
                    onSubmit={async (values) => { const ok = await submit({ method: "PATCH", resource: "action", id: a.id, patch: values }); if (ok) setOpenForm(null); }} />
                )}
              </div>
            ))}
          </div>
        ))}
        {canManage && (openForm?.kind === "decision" ? (
          <InlineForm fields={decisionFields} submitLabel="判断を追加" pending={pending} error={error} onCancel={() => { setOpenForm(null); setError(null); }}
            onSubmit={async (values) => { const ok = await submit({ method: "POST", resource: "decision", fields: { ...values, issue_id: detail.id } }); if (ok) setOpenForm(null); }} />
        ) : (
          <button type="button" className={styles.addBtn} onClick={() => setOpenForm({ kind: "decision" })}><Plus width={12} height={12} aria-hidden="true" />判断を追加</button>
        ))}
        {canManage && detail.decisions.length > 0 && (openForm?.kind === "action" ? (
          <InlineForm fields={actionFields} submitLabel="アクションを追加" pending={pending} error={error} onCancel={() => { setOpenForm(null); setError(null); }}
            onSubmit={async (values) => { const ok = await submit({ method: "POST", resource: "action", fields: { ...values, decision_id: openForm.contextId || detail.decisions[0].id } }); if (ok) setOpenForm(null); }} />
        ) : (
          <button type="button" className={styles.addBtn} onClick={() => setOpenForm({ kind: "action", contextId: detail.decisions[0]?.id })}><Plus width={12} height={12} aria-hidden="true" />アクションを追加</button>
        ))}
      </div>
    </aside>
  );
}

function TestDetailPane({ detail, projectId, canManage, onClose }: { detail: Extract<NavDetail, { kind: "technical_test" }>; projectId: string; canManage: boolean; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const { submit, pending, error, setError } = useManagementMutation(projectId);
  const editFields: EditorField[] = [
    { key: "test_condition", label: "試験条件", type: "textarea" },
    { key: "target", label: "目標値", type: "text" },
    { key: "actual", label: "実測値", type: "text" },
    { key: "unit", label: "単位", type: "text" },
    { key: "repetition", label: "反復回数", type: "number" },
    { key: "trl_criterion", label: "TRL判定基準", type: "textarea" },
    { key: "evidence", label: "根拠・所見", type: "textarea" },
    { key: "status", label: "状態", type: "select", options: TEST_STATUS_OPTIONS },
    { key: "measured_on", label: "測定日", type: "date" },
    { key: "owner_label", label: "担当", type: "text" },
    { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];
  return (
    <aside className={styles.detailPane} aria-label="技術試験詳細">
      <DetailHead eyebrow="技術試験" title={detail.testName} onClose={onClose} />
      <div className={styles.detailMetaRow}>
        <span className={styles.statusPill} data-tone="neutral">{detail.statusLabel}</span>
        <span>{detail.ownerLabel}</span>
      </div>
      <Field label="試験条件" value={detail.testCondition} />
      <Field label="目標 / 実測" value={detail.target || detail.actual ? `${detail.target ?? "未設定"} / ${detail.actual ?? "未測定"}${detail.unit ? ` ${detail.unit}` : ""}` : null} />
      <Field label="TRL判定基準" value={detail.trlCriterion} />
      <Field label="根拠・所見" value={detail.evidence} />
      <Field label="測定日" value={detail.measuredOn ? navFormatDate(detail.measuredOn) : "未測定"} />
      <div className={styles.detailMetaRow}><span>確度: {detail.confidence}</span></div>
      {canManage && !editing && <button type="button" className={styles.editBtn} onClick={() => setEditing(true)}>編集</button>}
      {editing && (
        <InlineForm
          fields={editFields}
          defaults={{ test_condition: detail.testCondition, target: detail.target || "", actual: detail.actual || "", unit: detail.unit, repetition: detail.repetition ?? "", trl_criterion: detail.trlCriterion, evidence: detail.evidence || "", status: detail.status, measured_on: detail.measuredOn || "", owner_label: detail.ownerLabel, confidence: detail.confidence }}
          submitLabel="保存"
          pending={pending}
          error={error}
          onCancel={() => { setEditing(false); setError(null); }}
          onSubmit={async (values) => { const ok = await submit({ method: "PATCH", resource: "technical_test", id: detail.id, patch: values }); if (ok) setEditing(false); }}
        />
      )}
    </aside>
  );
}

function HistoryDetailPane({ detail, projectId, canManage, onClose }: { detail: Extract<NavDetail, { kind: "history_event" }>; projectId: string; canManage: boolean; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const { submit, pending, error, setError } = useManagementMutation(projectId);
  const fields: EditorField[] = [
    { key: "evidence_kind", label: "種別", type: "select", options: EVIDENCE_KIND_OPTIONS },
    { key: "summary", label: "内容", type: "textarea" },
    { key: "observed_on", label: "確認日", type: "date" },
    { key: "source_label", label: "確認元", type: "text" },
    { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];
  return (
    <aside className={styles.detailPane} aria-label="履歴イベント詳細">
      <DetailHead eyebrow="履歴イベント" title={detail.summary} onClose={onClose} />
      <Field label="発生日" value={detail.observedOn ? navFormatDate(detail.observedOn) : "日付未確認"} />
      <div className={styles.detailMetaRow}><span>確度: {detail.confidence}</span></div>
      {canManage && !editing && <button type="button" className={styles.editBtn} onClick={() => setEditing(true)}>履歴を編集</button>}
      {editing && (
        <InlineForm
          fields={fields}
          defaults={{ evidence_kind: detail.evidenceKind, summary: detail.summary, observed_on: detail.observedOn || "", source_label: detail.sourceLabel, confidence: detail.confidence }}
          submitLabel="保存"
          pending={pending}
          error={error}
          onCancel={() => { setEditing(false); setError(null); }}
          onSubmit={async (values) => { const ok = await submit({ method: "PATCH", resource: "evidence", id: detail.id, patch: values }); if (ok) setEditing(false); }}
        />
      )}
    </aside>
  );
}

function PartnerDetailPane({ detail, projectId, canManage, onClose }: { detail: NavPartnerDetail; projectId: string; canManage: boolean; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const [addingWorkItem, setAddingWorkItem] = useState(false);
  const [editingWorkItemId, setEditingWorkItemId] = useState<string | null>(null);
  const { submit, pending, error, setError } = useManagementMutation(projectId);

  const editFields: EditorField[] = [
    { key: "relationship_stage", label: "関係段階", type: "select", options: PARTNER_STAGE_OPTIONS },
    { key: "agreement_state", label: "合意状態", type: "select", options: AGREEMENT_STATE_OPTIONS },
    { key: "current_ball_side", label: "現在のボール", type: "select", options: BALL_SIDE_OPTIONS },
    { key: "current_ball_owner", label: "現在の担当", type: "text" },
    { key: "next_ball_owner", label: "次の担当", type: "text" },
    { key: "next_commitment", label: "次の約束事", type: "textarea" },
    { key: "due_date", label: "期限日", type: "date" },
    { key: "due_date_precision", label: "期限の確度", type: "select", options: DATE_PRECISION_OPTIONS },
    { key: "target_state", label: "目標状態", type: "text" },
    { key: "last_contact_date", label: "直近接点日", type: "date" },
    { key: "owner_label", label: "当方担当", type: "text" },
    { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];
  const workItemFields: EditorField[] = [
    { key: "side", label: "保有側", type: "select", options: WORK_ITEM_SIDE_OPTIONS },
    { key: "item_kind", label: "種類", type: "select", options: WORK_ITEM_KIND_OPTIONS },
    { key: "title", label: "タイトル", type: "text" },
    { key: "detail", label: "詳細", type: "textarea" },
    { key: "owner_label", label: "担当", type: "text" },
    { key: "status", label: "状態", type: "select", options: WORK_ITEM_STATUS_OPTIONS },
    { key: "due_date", label: "期限", type: "date" },
    { key: "due_date_precision", label: "期限の確度", type: "select", options: DATE_PRECISION_OPTIONS },
    { key: "handoff_to", label: "次の受け渡し先", type: "text" },
    { key: "completion_criteria", label: "完了条件", type: "textarea" },
    { key: "completed_on", label: "完了日", type: "date" },
    { key: "completion_evidence", label: "完了証跡", type: "textarea" },
    { key: "accepted_by", label: "受入担当（成果物）", type: "text" },
    { key: "accepted_on", label: "受入日（成果物）", type: "date" },
    { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];

  return (
    <aside className={styles.detailPane} aria-label="関係先詳細">
      <DetailHead eyebrow={detail.roleLabel} title={detail.name} onClose={onClose} />
      <div className={styles.detailMetaRow}>
        <span className={styles.statusPill} data-tone="neutral">{detail.relationshipStageLabel}</span>
        <span>{navAgreementStateLabel(detail.agreementState)}</span>
      </div>
      <Field label="合意済み範囲" value={detail.agreedScope} />
      <Field label="未合意範囲" value={detail.unagreedScope} />
      <Field label="目標状態" value={detail.targetState} />
      <Field label="現在" value={`${navBallSideLabel(detail.currentBallSide)}${detail.currentBallOwner ? `（${detail.currentBallOwner}）` : ""}`} />
      <Field label="次の受け渡し" value={detail.nextCommitment} />
      <Field label="期限" value={detail.dueDate ? navFormatDate(detail.dueDate, detail.dueDatePrecision) : "未設定"} />
      <Field label="直近接点" value={detail.lastContactDate ? navFormatDate(detail.lastContactDate) : "未確認"} />
      {canManage && !editing && <button type="button" className={styles.editBtn} onClick={() => setEditing(true)}>編集</button>}
      {editing && (
        <InlineForm
          fields={editFields}
          defaults={{ relationship_stage: detail.relationshipStage, agreement_state: detail.agreementState, current_ball_side: detail.currentBallSide, current_ball_owner: detail.currentBallOwner || "", next_ball_owner: detail.nextBallOwner || "", next_commitment: detail.nextCommitment, due_date: detail.dueDate || "", due_date_precision: detail.dueDatePrecision, target_state: detail.targetState || "", last_contact_date: detail.lastContactDate || "", owner_label: detail.ownerLabel, confidence: detail.confidence }}
          submitLabel="保存"
          pending={pending}
          error={error}
          onCancel={() => { setEditing(false); setError(null); }}
          onSubmit={async (values) => { const ok = await submit({ method: "PATCH", resource: "partner", id: detail.id, patch: values }); if (ok) setEditing(false); }}
        />
      )}

      <hr className={styles.detailDivider} />
      <p className={styles.detailSub}>直近の履歴</p>
      <div className={styles.chainList}>
        {detail.interactions.length === 0 ? <p className={styles.chainItemMeta}>接点の記録なし。</p> : detail.interactions.slice(0, 6).map((i) => (
          <p key={i.id} className={styles.chainItem}>{i.summary}<span className={styles.chainItemMeta}>{i.occurredOn ? navFormatDate(i.occurredOn, i.occurredOnPrecision) : "日付未確認"}</span></p>
        ))}
      </div>

      <p className={styles.detailSub}>保有事項（当方/先方）</p>
      <div className={styles.chainList}>
        {detail.workItems.length === 0 ? <p className={styles.chainItemMeta}>保有事項の記録なし。</p> : detail.workItems.map((w) => (
          <div key={w.id} className={styles.chainStage}>
            <div className={styles.chainItemHead}>
              <p className={styles.chainItem}>{w.title}<span className={styles.chainItemMeta}>{optionLabel(WORK_ITEM_SIDE_OPTIONS, w.side)} ・ {optionLabel(WORK_ITEM_STATUS_OPTIONS, w.status)}{w.dueDate ? ` ・ 期限${navFormatDate(w.dueDate, w.dueDatePrecision)}` : ""}</span></p>
              {canManage && <button type="button" className={styles.miniEditBtn} onClick={() => setEditingWorkItemId(w.id)}>編集</button>}
            </div>
            {editingWorkItemId === w.id && (
              <InlineForm
                fields={workItemFields}
                defaults={{ side: w.side, item_kind: w.itemKind, title: w.title, detail: w.detail || "", owner_label: w.ownerLabel || "", status: w.status, due_date: w.dueDate || "", due_date_precision: w.dueDatePrecision, handoff_to: w.handoffTo || "", completion_criteria: w.completionCriteria || "", completed_on: w.completedOn || "", completion_evidence: w.completionEvidence || "", accepted_by: w.acceptedBy || "", accepted_on: w.acceptedOn || "", confidence: w.confidence }}
                submitLabel="保有事項を保存"
                pending={pending}
                error={error}
                onCancel={() => { setEditingWorkItemId(null); setError(null); }}
                onSubmit={async (values) => { const ok = await submit({ method: "PATCH", resource: "partner_work_item", id: w.id, patch: values }); if (ok) setEditingWorkItemId(null); }}
              />
            )}
          </div>
        ))}
        {canManage && (addingWorkItem ? (
          <InlineForm fields={workItemFields} defaults={{ side: "unknown", item_kind: "task", status: "open", due_date_precision: "unknown", confidence: "unknown" }} submitLabel="保有事項を追加" pending={pending} error={error} onCancel={() => { setAddingWorkItem(false); setError(null); }}
            onSubmit={async (values) => { const ok = await submit({ method: "POST", resource: "partner_work_item", fields: { ...values, partner_id: detail.id } }); if (ok) setAddingWorkItem(false); }} />
        ) : (
          <button type="button" className={styles.addBtn} onClick={() => setAddingWorkItem(true)}><Plus width={12} height={12} aria-hidden="true" />保有事項を追加</button>
        ))}
      </div>
      <p className={styles.detailSub}>これまでの約束</p>
      <div className={styles.chainList}>
        {detail.commitments.length === 0 ? <p className={styles.chainItemMeta}>約束の記録なし。</p> : detail.commitments.map((commitment) => (
          <p key={commitment.id} className={styles.chainItem}>{commitment.title}<span className={styles.chainItemMeta}>{optionLabel(ACTION_STATUS_OPTIONS, commitment.status)}{commitment.completedOn ? ` ・ 完了 ${navFormatDate(commitment.completedOn)}` : commitment.dueDate ? ` ・ 期限 ${navFormatDate(commitment.dueDate)}` : ""}</span></p>
        ))}
      </div>
    </aside>
  );
}
