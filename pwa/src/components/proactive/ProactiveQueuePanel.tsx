"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, FileText, Send, ShieldAlert, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type ProactiveQueueItem = {
  outboxId: string;
  loopId: string | null;
  projectId: string;
  projectLabel: string;
  status: ProactiveStatus;
  priority: ProactivePriority;
  dueAt: string;
  triggerType: string;
  ballOwner: string;
  draftType: string;
  recommendedFirstMove: string;
  riskIfLate: string;
  commanderThreadId: string | null;
  blockedReason: string | null;
  sentAt: string | null;
  draftedAt: string | null;
  sentToCounterpartAt: string | null;
  closedAt: string | null;
  draftArtifactRefs: DraftArtifactRef[];
  evidenceRefs: EvidenceRef[];
  eventHistory: ProactiveEvent[];
  sourceKind: string;
  sourceId: string;
  sourceHash: string | null;
  meetingId: string | null;
  calendarEventId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type DraftArtifactRef = {
  artifact: string;
  summary: string;
  addedAt: string;
};

type EvidenceRef = {
  source: string;
  section?: string;
  snippet?: string;
};

type ProactiveEvent = {
  eventId: string;
  eventType: string;
  eventSummary: string;
  actorKind: string;
  actorId: string | null;
  createdAt: string;
};

type ProactiveStatus = "queued" | "sent_to_commander" | "drafted" | "sent_to_counterpart" | "closed" | "blocked";
type ProactivePriority = "red" | "yellow" | "green";

type ProactiveQueuePanelProps = {
  projectId?: string;
  projectLabels?: Record<string, string>;
  variant?: "dashboard" | "cockpit";
  limit?: number;
};

const DASHBOARD_STATUSES: ProactiveStatus[] = ["blocked", "queued", "sent_to_commander"];
const COCKPIT_STATUSES: ProactiveStatus[] = ["blocked", "queued", "sent_to_commander", "drafted"];
const FETCH_MULTIPLIER = 20;

const STATUS_META: Record<ProactiveStatus, { label: string; className: string; icon: typeof Clock3 }> = {
  queued: { label: "未送信", className: "border-slate-300 bg-slate-50 text-slate-700", icon: Clock3 },
  sent_to_commander: { label: "司令塔送信済み", className: "border-sky-300 bg-sky-50 text-sky-800", icon: Send },
  drafted: { label: "資料作成済み", className: "border-violet-300 bg-violet-50 text-violet-800", icon: FileText },
  sent_to_counterpart: { label: "相手へ送信済み", className: "border-emerald-300 bg-emerald-50 text-emerald-800", icon: CheckCircle2 },
  closed: { label: "完了", className: "border-zinc-300 bg-zinc-50 text-zinc-600", icon: CheckCircle2 },
  blocked: { label: "ブロック", className: "border-rose-300 bg-rose-50 text-rose-800", icon: ShieldAlert },
};

const PRIORITY_META: Record<ProactivePriority, { label: string; className: string; rail: string }> = {
  red: { label: "最優先", className: "border-rose-300 bg-rose-50 text-rose-900", rail: "border-l-rose-500" },
  yellow: { label: "近い", className: "border-amber-300 bg-amber-50 text-amber-900", rail: "border-l-amber-500" },
  green: { label: "余裕あり", className: "border-emerald-300 bg-emerald-50 text-emerald-900", rail: "border-l-emerald-500" },
};

const BALL_OWNER_LABEL: Record<string, string> = {
  amd: "AMD",
  counterpart: "相手",
  shared: "双方",
  ambiguous: "曖昧",
};

const DRAFT_TYPE_LABEL: Record<string, string> = {
  email: "メール",
  slack: "Slack",
  agenda: "アジェンダ",
  proposal: "提案",
  roadmap: "ロードマップ",
  next_action_plan: "次アクション整理",
};

const TRIGGER_LABEL: Record<string, string> = {
  meeting_ended: "MTG後",
  minutes_added: "議事録追加",
  ball_ambiguous: "ボール曖昧",
  next_meeting_due: "次回MTG前",
  counterpart_nudge_detected: "相手催促",
  deadline_approaching: "期限接近",
  strategy_signal_needs_action: "経営シグナル",
  report_only_gap: "月次gap",
};

const PROJECT_FALLBACK_LABELS: Record<string, string> = {
  p25: "KUTE",
  p26: "VSX / 香川大",
  p19: "ZMP / OkuDoor",
  zmp: "ZMP / OkuDoor",
  p20: "CX",
  p21: "SX",
  nims_os: "NIMS",
};

export function ProactiveQueuePanel({
  projectId,
  projectLabels = {},
  variant = "dashboard",
  limit,
}: ProactiveQueuePanelProps) {
  const [items, setItems] = useState<ProactiveQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ProactiveQueueItem | null>(null);
  const effectiveLimit = limit ?? (variant === "dashboard" ? 3 : 6);
  const fetchLimit = Math.max(effectiveLimit * FETCH_MULTIPLIER, variant === "dashboard" ? 60 : 80);
  const statuses = variant === "dashboard" ? DASHBOARD_STATUSES : COCKPIT_STATUSES;

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const load = async () => {
      setLoading(true);
      setError(null);
      let query = supabase
        .from("proactive_outbox")
        .select(
          "outbox_id,loop_id,project_id,status,priority,due_at,trigger_type,ball_owner,draft_type,recommended_first_move,risk_if_late,commander_thread_id,blocked_reason,sent_at,drafted_at,sent_to_counterpart_at,closed_at,draft_artifact_refs,evidence_refs,source_kind,source_id,source_hash,meeting_id,calendar_event_id,metadata_json,created_by,created_at,updated_at"
        )
        .in("status", statuses)
        .order("due_at", { ascending: true })
        .limit(fetchLimit);
      if (projectId) query = query.eq("project_id", projectId);
      const { data, error: fetchError } = await query;
      if (cancelled) return;
      if (fetchError) {
        setError(fetchError.message);
        setItems([]);
      } else {
        const normalized = dedupeByOutboxId((data || []).map((row) => normalizeRow(row, projectLabels)))
          .sort(sortQueueItems)
          .slice(0, effectiveLimit);
        const eventHistory = await loadEventHistory(
          supabase,
          normalized.map((item) => item.outboxId)
        );
        if (cancelled) return;
        setItems(normalized.map((item) => ({ ...item, eventHistory: eventHistory[item.outboxId] || [] })));
      }
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [effectiveLimit, fetchLimit, projectId, projectLabels, statuses]);

  const overdueCount = items.filter((item) => dueState(item.dueAt) === "overdue").length;
  const draftedCount = items.filter((item) => item.status === "drafted").length;
  const blockedCount = items.filter((item) => item.status === "blocked").length;
  const title = "TODO";
  const description = projectId ? "このPJの未完TODO" : "今日見る未完TODO";
  const featuredItem = items[0] || null;
  const listItems = featuredItem ? items.filter((item) => item.outboxId !== featuredItem.outboxId) : [];

  return (
    <section className="rounded-lg border border-border bg-card p-3 flex flex-col gap-2 min-h-[120px]">
      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-tight">{title}</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {description}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1 text-[10px]">
          <span className="rounded border border-border bg-background px-1.5 py-0.5">{items.length} 件</span>
          {overdueCount > 0 && <span className="rounded border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-rose-800">超過 {overdueCount}</span>}
          {blockedCount > 0 && <span className="rounded border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-rose-800">停止 {blockedCount}</span>}
          {draftedCount > 0 && <span className="rounded border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-violet-800">資料済 {draftedCount}</span>}
        </div>
      </div>

      {loading ? (
        <div className="my-auto h-16 rounded border border-border/60 bg-muted/20 animate-pulse" />
      ) : error ? (
        <p className="text-xs text-muted-foreground my-auto text-center">TODOはadmin権限で表示されるよ</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground my-auto text-center">今すぐ見るTODOなし</p>
      ) : (
        <>
          {featuredItem && (
            <QueueFocusCard item={featuredItem} compact={variant === "dashboard"} onOpen={() => setSelectedItem(featuredItem)} />
          )}
          {listItems.length > 0 && (
            <ul className="space-y-1.5">
              {listItems.map((item) => (
              <QueueRow key={item.outboxId} item={item} compact={variant === "dashboard"} onOpen={() => setSelectedItem(item)} />
              ))}
            </ul>
          )}
        </>
      )}
      {selectedItem && <TodoDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </section>
  );
}

function QueueFocusCard({ item, compact, onOpen }: { item: ProactiveQueueItem; compact: boolean; onOpen: () => void }) {
  const status = STATUS_META[item.status] ?? STATUS_META.queued;
  const priority = PRIORITY_META[item.priority] ?? PRIORITY_META.yellow;
  const Icon = status.icon;
  const state = dueState(item.dueAt);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full rounded-md border border-l-4 ${priority.rail} bg-muted/20 px-3 py-2.5 text-left transition-colors hover:bg-muted/35`}
    >
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="rounded border border-border bg-background px-1.5 py-0.5 font-medium">優先TODO</span>
        <span className="font-mono text-muted-foreground">{item.projectLabel}</span>
        <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 ${status.className}`}>
          <Icon className="h-3 w-3" />
          {status.label}
        </span>
        <span className={`rounded border px-1.5 py-0.5 ${priority.className}`}>{priority.label}</span>
        <span className={state === "overdue" ? "ml-auto font-medium text-rose-700" : "ml-auto text-muted-foreground"}>
          {formatDue(item.dueAt)}
        </span>
      </div>
      <p className={`mt-1.5 text-[13px] font-semibold leading-snug ${compact ? "line-clamp-2" : ""}`}>
        {item.recommendedFirstMove}
      </p>
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
        <span>ボール: {BALL_OWNER_LABEL[item.ballOwner] ?? item.ballOwner}</span>
        <span>理由: {TRIGGER_LABEL[item.triggerType] ?? item.triggerType}</span>
        <span>{externalSendLabel(item)}</span>
      </div>
      {!compact && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          遅延リスク: {item.riskIfLate}
        </p>
      )}
    </button>
  );
}

function QueueRow({ item, compact, onOpen }: { item: ProactiveQueueItem; compact: boolean; onOpen: () => void }) {
  const status = STATUS_META[item.status] ?? STATUS_META.queued;
  const priority = PRIORITY_META[item.priority] ?? PRIORITY_META.yellow;
  const Icon = status.icon;
  const state = dueState(item.dueAt);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`block w-full text-left rounded-md border border-l-4 ${priority.rail} bg-background px-2.5 py-2 hover:bg-muted/30 transition-colors`}
      >
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="font-mono text-muted-foreground">{item.projectLabel}</span>
          <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 ${status.className}`}>
            <Icon className="h-3 w-3" />
            {status.label}
          </span>
          <span className={`rounded border px-1.5 py-0.5 ${priority.className}`}>{priority.label}</span>
          <span className={state === "overdue" ? "text-rose-700 font-medium ml-auto" : "text-muted-foreground ml-auto"}>
            {formatDue(item.dueAt)}
          </span>
        </div>
        <p className={`mt-1 text-[12px] font-medium leading-snug ${compact ? "line-clamp-2" : ""}`}>
          {item.recommendedFirstMove}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
          <span>ボール: {BALL_OWNER_LABEL[item.ballOwner] ?? item.ballOwner}</span>
          <span>資料: {DRAFT_TYPE_LABEL[item.draftType] ?? item.draftType}</span>
          <span>理由: {TRIGGER_LABEL[item.triggerType] ?? item.triggerType}</span>
          {item.commanderThreadId && <span>司令塔: {shortThread(item.commanderThreadId)}</span>}
        </div>
        {!compact && (
          <div className="mt-1.5 rounded border border-border/60 bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <AlertTriangle className="h-3 w-3" />
              遅れるリスク
            </span>
            <span className="ml-1">{item.riskIfLate}</span>
            {item.blockedReason && <div className="mt-1 text-rose-700">停止理由: {item.blockedReason}</div>}
          </div>
        )}
      </button>
    </li>
  );
}

function TodoDetailModal({ item, onClose }: { item: ProactiveQueueItem; onClose: () => void }) {
  const status = STATUS_META[item.status] ?? STATUS_META.queued;
  const priority = PRIORITY_META[item.priority] ?? PRIORITY_META.yellow;
  const Icon = status.icon;
  const nextAction = nextActionLabel(item.status);
  const sourceLabel = [item.sourceKind, item.sourceId].filter(Boolean).join(" / ") || "未設定";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-3 py-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-border bg-card px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="font-mono text-muted-foreground">{item.projectLabel}</span>
              <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 ${status.className}`}>
                <Icon className="h-3 w-3" />
                {status.label}
              </span>
              <span className={`rounded border px-1.5 py-0.5 ${priority.className}`}>{priority.label}</span>
              <span className="text-muted-foreground">期限 {formatDue(item.dueAt)}</span>
            </div>
            <h3 className="mt-1 text-base font-semibold leading-snug">TODO詳細</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded border border-border p-1.5 text-muted-foreground hover:bg-muted/40"
            aria-label="TODO詳細を閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4 text-sm">
          <section className="rounded-md border border-border/70 bg-muted/10 p-3">
            <h4 className="text-xs font-semibold text-muted-foreground">次にやること</h4>
            <p className="mt-1 leading-relaxed">{item.recommendedFirstMove}</p>
          </section>

          <section className="grid gap-2 md:grid-cols-2">
            <InfoRow label="いまの状態" value={statusExplanation(item.status)} />
            <InfoRow label="誰のボールか" value={BALL_OWNER_LABEL[item.ballOwner] ?? item.ballOwner} />
            <InfoRow label="期限" value={formatDue(item.dueAt)} />
            <InfoRow label="優先度" value={priority.label} />
            <InfoRow label="資料の種類" value={DRAFT_TYPE_LABEL[item.draftType] ?? item.draftType} />
            <InfoRow label="発生理由" value={TRIGGER_LABEL[item.triggerType] ?? item.triggerType} />
            <InfoRow label="司令塔thread" value={item.commanderThreadId || "未設定"} />
            <InfoRow label="外部送付可否" value={externalSendLabel(item)} />
            <InfoRow label="次の期待アクション" value={nextAction} />
            <InfoRow label="source" value={sourceLabel} />
          </section>

          <section>
            <h4 className="text-xs font-semibold text-muted-foreground">遅れた場合のリスク</h4>
            <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">{item.riskIfLate}</p>
          </section>

          {item.draftArtifactRefs.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold text-muted-foreground">えいみ/司令塔が作成済みの資料</h4>
              <div className="mt-2 space-y-2">
                {item.draftArtifactRefs.map((ref, idx) => (
                  <a
                    key={`${ref.artifact}-${idx}`}
                    href={pathToHref(ref.artifact)}
                    className="block rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-violet-950 hover:bg-violet-100"
                  >
                    <span className="inline-flex items-center gap-1 text-xs font-semibold">
                      <ExternalLink className="h-3 w-3" />
                      {ref.artifact}
                    </span>
                    {ref.summary && <p className="mt-1 text-xs leading-relaxed text-violet-900">{ref.summary}</p>}
                  </a>
                ))}
              </div>
            </section>
          )}

          {item.evidenceRefs.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold text-muted-foreground">このTODOが発生した経緯</h4>
              <div className="mt-2 space-y-2">
                {item.evidenceRefs.map((ref, idx) => (
                  <div key={`${ref.source}-${idx}`} className="rounded-md border border-border/70 bg-background px-3 py-2">
                    <div className="text-xs font-semibold">{ref.source}</div>
                    {ref.section && <div className="text-[11px] text-muted-foreground">{ref.section}</div>}
                    {ref.snippet && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{ref.snippet}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h4 className="text-xs font-semibold text-muted-foreground">outbox / 履歴</h4>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <InfoRow label="outbox_id" value={item.outboxId} />
              <InfoRow label="loop_id" value={item.loopId || "未設定"} />
              <InfoRow label="meeting_id" value={item.meetingId || "未設定"} />
              <InfoRow label="calendar_event_id" value={item.calendarEventId || "未設定"} />
              <InfoRow label="created_by" value={item.createdBy || "未設定"} />
              <InfoRow label="created / updated" value={`${formatDue(item.createdAt)} / ${formatDue(item.updatedAt)}`} />
            </div>
            {item.eventHistory.length > 0 ? (
              <div className="mt-2 space-y-2">
                {item.eventHistory.slice(0, 6).map((event) => (
                  <div key={event.eventId} className="rounded-md border border-border/70 bg-background px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="font-semibold">{EVENT_LABEL[event.eventType] ?? event.eventType}</span>
                      <span className="text-muted-foreground">{formatDue(event.createdAt)}</span>
                      <span className="text-muted-foreground">{event.actorKind}{event.actorId ? ` / ${event.actorId}` : ""}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{event.eventSummary}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 rounded-md border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground">
                履歴イベントはまだ読めてないよ。
              </p>
            )}
          </section>

          {item.blockedReason && (
            <section>
              <h4 className="text-xs font-semibold text-rose-700">停止理由</h4>
              <p className="mt-1 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900">{item.blockedReason}</p>
            </section>
          )}

          <section className="flex flex-wrap gap-2 border-t border-border pt-3">
            <a
              href={`/project/${encodeURIComponent(item.projectId)}/cockpit`}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted/40"
            >
              <ExternalLink className="h-3 w-3" />
              PJ cockpitで見る
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-background px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xs font-medium">{value}</div>
    </div>
  );
}

function normalizeRow(row: Record<string, unknown>, projectLabels: Record<string, string>): ProactiveQueueItem {
  const projectId = String(row.project_id || "");
  const metadata = normalizeRecord(row.metadata_json);
  return {
    outboxId: String(row.outbox_id || ""),
    loopId: row.loop_id ? String(row.loop_id) : null,
    projectId,
    projectLabel: projectLabels[projectId] || PROJECT_FALLBACK_LABELS[projectId] || projectId,
    status: normalizeStatus(row.status),
    priority: normalizePriority(row.priority),
    dueAt: String(row.due_at || ""),
    triggerType: String(row.trigger_type || ""),
    ballOwner: String(row.ball_owner || ""),
    draftType: String(row.draft_type || ""),
    recommendedFirstMove: String(row.recommended_first_move || ""),
    riskIfLate: String(row.risk_if_late || ""),
    commanderThreadId: row.commander_thread_id ? String(row.commander_thread_id) : null,
    blockedReason: row.blocked_reason ? String(row.blocked_reason) : null,
    sentAt: row.sent_at ? String(row.sent_at) : null,
    draftedAt: row.drafted_at ? String(row.drafted_at) : null,
    sentToCounterpartAt: row.sent_to_counterpart_at ? String(row.sent_to_counterpart_at) : null,
    closedAt: row.closed_at ? String(row.closed_at) : null,
    draftArtifactRefs: dedupeArtifactRefs([
      ...normalizeArtifactRefs(row.draft_artifact_refs),
      ...normalizeArtifactRefs(metadata.artifact_refs),
      ...normalizeArtifactRefs(metadata.draft_artifact_refs),
    ]),
    evidenceRefs: normalizeEvidenceRefs(row.evidence_refs),
    eventHistory: [],
    sourceKind: String(row.source_kind || ""),
    sourceId: String(row.source_id || ""),
    sourceHash: row.source_hash ? String(row.source_hash) : null,
    meetingId: row.meeting_id ? String(row.meeting_id) : null,
    calendarEventId: row.calendar_event_id ? String(row.calendar_event_id) : null,
    createdBy: String(row.created_by || ""),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

async function loadEventHistory(
  supabase: ReturnType<typeof createClient>,
  outboxIds: string[]
): Promise<Record<string, ProactiveEvent[]>> {
  const ids = outboxIds.filter(Boolean);
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("proactive_loop_events")
    .select("event_id,outbox_id,event_type,event_summary,actor_kind,actor_id,created_at")
    .in("outbox_id", ids)
    .order("created_at", { ascending: false })
    .limit(120);
  if (error || !data) return {};
  const grouped: Record<string, ProactiveEvent[]> = {};
  for (const row of data) {
    const record = row as Record<string, unknown>;
    const outboxId = String(record.outbox_id || "");
    if (!outboxId) continue;
    grouped[outboxId] ||= [];
    grouped[outboxId].push({
      eventId: String(record.event_id || `${outboxId}-${grouped[outboxId].length}`),
      eventType: String(record.event_type || ""),
      eventSummary: String(record.event_summary || ""),
      actorKind: String(record.actor_kind || ""),
      actorId: record.actor_id ? String(record.actor_id) : null,
      createdAt: String(record.created_at || ""),
    });
  }
  return grouped;
}

function normalizeArtifactRefs(value: unknown): DraftArtifactRef[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      return {
        artifact: String(record.artifact || ""),
        summary: String(record.summary || ""),
        addedAt: String(record.added_at || ""),
      };
    })
    .filter((item): item is DraftArtifactRef => Boolean(item?.artifact));
}

function dedupeArtifactRefs(refs: DraftArtifactRef[]) {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.artifact}|${ref.summary}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeEvidenceRefs(value: unknown): EvidenceRef[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): EvidenceRef | null => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const ref: EvidenceRef = {
        source: String(record.source || ""),
      };
      if (record.section) ref.section = String(record.section);
      if (record.snippet) ref.snippet = String(record.snippet);
      return ref;
    })
    .filter((item): item is EvidenceRef => Boolean(item?.source));
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function dedupeByOutboxId(items: ProactiveQueueItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.outboxId) return true;
    if (seen.has(item.outboxId)) return false;
    seen.add(item.outboxId);
    return true;
  });
}

function normalizeStatus(value: unknown): ProactiveStatus {
  const v = String(value || "");
  return (["queued", "sent_to_commander", "drafted", "sent_to_counterpart", "closed", "blocked"] as const).includes(v as ProactiveStatus)
    ? (v as ProactiveStatus)
    : "queued";
}

function normalizePriority(value: unknown): ProactivePriority {
  const v = String(value || "");
  return (["red", "yellow", "green"] as const).includes(v as ProactivePriority) ? (v as ProactivePriority) : "yellow";
}

function sortQueueItems(a: ProactiveQueueItem, b: ProactiveQueueItem) {
  const priorityRank: Record<ProactivePriority, number> = { red: 0, yellow: 1, green: 2 };
  const statusRank: Record<ProactiveStatus, number> = {
    blocked: 0,
    queued: 1,
    sent_to_commander: 2,
    drafted: 3,
    sent_to_counterpart: 4,
    closed: 5,
  };
  const dueRank = (item: ProactiveQueueItem) => (dueState(item.dueAt) === "overdue" ? 0 : dueState(item.dueAt) === "today" ? 1 : 2);
  const dueStateDiff = dueRank(a) - dueRank(b);
  if (dueStateDiff !== 0) return dueStateDiff;
  const statusDiff = statusRank[a.status] - statusRank[b.status];
  if (statusDiff !== 0) return statusDiff;
  const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
  if (priorityDiff !== 0) return priorityDiff;
  const dueDiff = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  if (Number.isFinite(dueDiff) && dueDiff !== 0) return dueDiff;
  return a.outboxId.localeCompare(b.outboxId);
}

function formatDue(iso: string) {
  if (!iso) return "期限未設定";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function dueState(iso: string): "overdue" | "today" | "future" {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "future";
  const now = Date.now();
  if (date.getTime() < now) return "overdue";
  if (date.getTime() - now < 24 * 60 * 60 * 1000) return "today";
  return "future";
}

function shortThread(threadId: string) {
  if (threadId.length <= 10) return threadId;
  return `${threadId.slice(0, 8)}…${threadId.slice(-4)}`;
}

function statusExplanation(status: ProactiveStatus) {
  if (status === "queued") return "まだ司令塔へ投げる前。司令塔に送って着手させる段階。";
  if (status === "sent_to_commander") return "司令塔へ依頼済み。司令塔/workerが内部資料を作る段階。";
  if (status === "drafted") return "内部資料は作成済み。内容レビュー、外部送付、完了判断のどれかへ進める段階。";
  if (status === "blocked") return "止まっている。停止理由を解消する必要がある。";
  if (status === "sent_to_counterpart") return "相手へ送付済み。反応待ちまたは完了判断の段階。";
  return "完了済み。";
}

function nextActionLabel(status: ProactiveStatus) {
  if (status === "queued") return "司令塔へ通知する";
  if (status === "sent_to_commander") return "司令塔/workerの成果物を待つ";
  if (status === "drafted") return "資料を確認して、外部送付・追加修正・完了のどれかを決める";
  if (status === "blocked") return "停止理由を解消する";
  if (status === "sent_to_counterpart") return "相手の反応を確認する";
  return "追加対応なし";
}

function externalSendLabel(item: ProactiveQueueItem) {
  if (item.status === "sent_to_counterpart") return "外部送付済み";
  if (item.status === "closed") return "外部送付不要";
  if (item.status === "blocked") return "外部送付不可: 停止理由の解消が先";
  if (item.status === "drafted" && item.draftArtifactRefs.length > 0) return "外部送付候補: 資料レビュー後に判断";
  if (item.status === "drafted") return "外部送付候補: 資料所在の確認が先";
  if (item.status === "sent_to_commander") return "外部送付前: 司令塔/worker成果物待ち";
  return "外部送付前: まず司令塔へ通知";
}

function pathToHref(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  return `file://${path}`;
}

const EVENT_LABEL: Record<string, string> = {
  detected: "検知",
  queued: "TODO化",
  sent_to_commander: "司令塔送信",
  drafted: "資料作成",
  sent_to_counterpart: "外部送付",
  closed: "完了",
  blocked: "停止",
  sla_breached: "期限超過",
  counterpart_nudge_detected: "相手催促検知",
  deduped: "重複整理",
};
