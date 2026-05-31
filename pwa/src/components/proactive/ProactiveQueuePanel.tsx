"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, FileText, Send, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type ProactiveQueueItem = {
  outboxId: string;
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
  draftArtifactRefs: unknown[];
};

type ProactiveStatus = "queued" | "sent_to_commander" | "drafted" | "sent_to_counterpart" | "closed" | "blocked";
type ProactivePriority = "red" | "yellow" | "green";

type ProactiveQueuePanelProps = {
  projectId?: string;
  projectLabels?: Record<string, string>;
  variant?: "dashboard" | "cockpit";
  limit?: number;
};

const ACTIVE_STATUSES: ProactiveStatus[] = ["queued", "sent_to_commander", "drafted", "blocked"];

const STATUS_META: Record<ProactiveStatus, { label: string; className: string; icon: typeof Clock3 }> = {
  queued: { label: "未送信", className: "border-slate-300 bg-slate-50 text-slate-700", icon: Clock3 },
  sent_to_commander: { label: "司令塔送信済み", className: "border-sky-300 bg-sky-50 text-sky-800", icon: Send },
  drafted: { label: "下書き済み", className: "border-violet-300 bg-violet-50 text-violet-800", icon: FileText },
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
  limit = 8,
}: ProactiveQueuePanelProps) {
  const [items, setItems] = useState<ProactiveQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const load = async () => {
      setLoading(true);
      setError(null);
      let query = supabase
        .from("proactive_outbox")
        .select(
          "outbox_id,project_id,status,priority,due_at,trigger_type,ball_owner,draft_type,recommended_first_move,risk_if_late,commander_thread_id,blocked_reason,sent_at,drafted_at,sent_to_counterpart_at,closed_at,draft_artifact_refs"
        )
        .in("status", ACTIVE_STATUSES)
        .order("priority", { ascending: true })
        .order("due_at", { ascending: true })
        .limit(limit);
      if (projectId) query = query.eq("project_id", projectId);
      const { data, error: fetchError } = await query;
      if (cancelled) return;
      if (fetchError) {
        setError(fetchError.message);
        setItems([]);
      } else {
        setItems(
          (data || [])
            .map((row) => normalizeRow(row, projectLabels))
            .sort(sortQueueItems)
        );
      }
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [limit, projectId, projectLabels]);

  const todayMove = useMemo(() => items.find((item) => item.status !== "drafted") ?? items[0] ?? null, [items]);
  const overdueCount = items.filter((item) => dueState(item.dueAt) === "overdue").length;
  const draftedCount = items.filter((item) => item.status === "drafted").length;
  const title = variant === "dashboard" ? "今日打つべき一手" : "先手キュー";

  return (
    <section className="rounded-lg border border-border bg-card p-3 flex flex-col gap-2 min-h-[120px]">
      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-tight">{title}</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {projectId ? "このPJの先手outbox" : "期限が近いPJ横断の先手outbox"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1 text-[10px]">
          <span className="rounded border border-border bg-background px-1.5 py-0.5">{items.length} 件</span>
          {overdueCount > 0 && <span className="rounded border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-rose-800">超過 {overdueCount}</span>}
          {draftedCount > 0 && <span className="rounded border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-violet-800">下書き {draftedCount}</span>}
        </div>
      </div>

      {loading ? (
        <div className="my-auto h-16 rounded border border-border/60 bg-muted/20 animate-pulse" />
      ) : error ? (
        <p className="text-xs text-muted-foreground my-auto text-center">先手キューはadmin権限で表示されるよ</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground my-auto text-center">期限が近い先手キューなし</p>
      ) : (
        <>
          {todayMove && variant === "dashboard" && <HeroMove item={todayMove} />}
          <ul className="space-y-1.5">
            {items.slice(variant === "dashboard" ? 0 : 0, limit).map((item) => (
              <QueueRow key={item.outboxId} item={item} compact={variant === "dashboard"} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function HeroMove({ item }: { item: ProactiveQueueItem }) {
  const priority = PRIORITY_META[item.priority] ?? PRIORITY_META.yellow;
  return (
    <Link
      href={`/project/${encodeURIComponent(item.projectId)}/cockpit`}
      className={`block rounded-md border border-l-4 ${priority.rail} bg-background px-2.5 py-2 hover:bg-muted/30 transition-colors`}
    >
      <div className="flex items-center gap-1.5 text-[10px] mb-1">
        <span className={`rounded border px-1.5 py-0.5 ${priority.className}`}>{priority.label}</span>
        <span className="font-mono text-muted-foreground">{item.projectLabel}</span>
        <span className="text-muted-foreground ml-auto">{formatDue(item.dueAt)}</span>
      </div>
      <p className="text-[12px] font-medium leading-snug line-clamp-2">{item.recommendedFirstMove}</p>
    </Link>
  );
}

function QueueRow({ item, compact }: { item: ProactiveQueueItem; compact: boolean }) {
  const status = STATUS_META[item.status] ?? STATUS_META.queued;
  const priority = PRIORITY_META[item.priority] ?? PRIORITY_META.yellow;
  const Icon = status.icon;
  const state = dueState(item.dueAt);
  return (
    <li>
      <Link
        href={`/project/${encodeURIComponent(item.projectId)}/cockpit`}
        className={`block rounded-md border border-l-4 ${priority.rail} bg-background px-2.5 py-2 hover:bg-muted/30 transition-colors`}
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
          <span>下書き: {DRAFT_TYPE_LABEL[item.draftType] ?? item.draftType}</span>
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
      </Link>
    </li>
  );
}

function normalizeRow(row: Record<string, unknown>, projectLabels: Record<string, string>): ProactiveQueueItem {
  const projectId = String(row.project_id || "");
  return {
    outboxId: String(row.outbox_id || ""),
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
    draftArtifactRefs: Array.isArray(row.draft_artifact_refs) ? row.draft_artifact_refs : [],
  };
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
  const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
  if (priorityDiff !== 0) return priorityDiff;
  const dueDiff = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  if (Number.isFinite(dueDiff) && dueDiff !== 0) return dueDiff;
  return statusRank[a.status] - statusRank[b.status];
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
