"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  FileWarning,
  ListTodo,
  Radar,
  ShieldQuestion,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DashBillingStatus, DashProject } from "@/lib/supabase-data";

type SensorKey = "meeting" | "todo" | "signal" | "gap" | "monthly";
type SensorTone = "ok" | "watch" | "risk" | "quiet";
type RadarLevel = "ahead" | "watch" | "push" | "critical";

interface ProactiveRadarBoardProps {
  projects: DashProject[];
  billingStatus: Record<string, DashBillingStatus>;
}

interface ProactiveTodoRow {
  project_id: string;
  trigger_kind: string;
  title: string;
  detail: string | null;
  ball_owner: string;
  due_at: string;
  priority: string;
  status: string;
  created_at: string;
}

interface StrategySignalRow {
  project_id: string;
  signal_date: string | null;
  signal_type: string;
  title: string;
  summary: string;
  impact_level: string;
  decision_state: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface CoverageGapRow {
  project_id: string | null;
  title: string | null;
  summary: string | null;
  salience_score: number | string | null;
  proposed_target_l2: string | null;
  gap_class: string | null;
  scope: string | null;
  due_at: string | null;
  review_status: string | null;
  detected_at: string | null;
}

interface MeetingSummaryRow {
  project_id: string;
  meeting_id: string;
  title: string;
  meeting_date: string;
  meeting_start_at: string | null;
  source_kinds: string | null;
  prep_readiness_score: number | null;
  prep_worker_status: string | null;
  prep_status: string | null;
  prep_worker_ready_at: string | null;
  updated_at: string;
}

interface SensorState {
  tone: SensorTone;
  label: string;
  detail: string;
}

interface RadarSuggestion {
  kind: "visible" | "latent";
  title: string;
  reason: string;
  dueAt?: string | null;
  href: string;
}

interface ProjectRadar {
  project: DashProject;
  level: RadarLevel;
  sensors: Record<SensorKey, SensorState>;
  suggestion: RadarSuggestion;
  riskCount: number;
  watchCount: number;
}

interface RadarData {
  todos: ProactiveTodoRow[];
  signals: StrategySignalRow[];
  gaps: CoverageGapRow[];
  meetings: MeetingSummaryRow[];
}

const SENSOR_META: Record<SensorKey, { label: string; Icon: LucideIcon }> = {
  meeting: { label: "MTG", Icon: CalendarClock },
  todo: { label: "一手", Icon: ListTodo },
  signal: { label: "経営", Icon: Sparkles },
  gap: { label: "不在", Icon: ShieldQuestion },
  monthly: { label: "月次", Icon: FileWarning },
};

const LEVEL_META: Record<RadarLevel, { label: string; className: string; railClassName: string }> = {
  ahead: {
    label: "先行中",
    className: "border-[rgba(37,108,85,0.24)] bg-[rgba(223,238,230,0.72)] text-[var(--desk-green)]",
    railClassName: "border-l-[var(--desk-green)]",
  },
  watch: {
    label: "見張り",
    className: "border-[rgba(44,95,131,0.24)] bg-[rgba(222,235,242,0.72)] text-[var(--desk-blue)]",
    railClassName: "border-l-[var(--desk-blue)]",
  },
  push: {
    label: "要押し",
    className: "border-[rgba(168,100,22,0.26)] bg-[rgba(246,232,205,0.82)] text-[var(--desk-amber)]",
    railClassName: "border-l-[var(--desk-amber)]",
  },
  critical: {
    label: "危険",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    railClassName: "border-l-rose-500",
  },
};

const SENSOR_TONE_CLASS: Record<SensorTone, string> = {
  ok: "border-[rgba(37,108,85,0.18)] bg-[rgba(223,238,230,0.58)] text-[var(--desk-green)]",
  watch: "border-[rgba(168,100,22,0.2)] bg-[rgba(246,232,205,0.7)] text-[var(--desk-amber)]",
  risk: "border-rose-200 bg-rose-50 text-rose-700",
  quiet: "border-[var(--desk-line)] bg-[rgba(247,245,238,0.58)] text-[var(--desk-muted)]",
};

const ACTIVE_RADAR_STATUSES = new Set(["active", "sales", "draft", "frozen"]);
const HIGH_IMPACTS = new Set(["high", "critical"]);

export function ProactiveRadarBoard({ projects, billingStatus }: ProactiveRadarBoardProps) {
  const [data, setData] = useState<RadarData | null>(null);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const email = user?.email?.toLowerCase() ?? "";
      if (!email) {
        if (!cancelled) {
          setHidden(true);
          setLoading(false);
        }
        return;
      }

      const { data: member } = await supabase
        .from("members")
        .select("is_admin")
        .eq("email", email)
        .maybeSingle();
      if (!member?.is_admin) {
        if (!cancelled) {
          setHidden(true);
          setLoading(false);
        }
        return;
      }

      const now = new Date();
      const thirtyDaysAhead = toDateKey(addDays(now, 30));
      const fortyFiveDaysAgo = toDateKey(addDays(now, -45));

      const [todoRes, signalRes, gapRes, meetingRes] = await Promise.all([
        supabase
          .from("proactive_todos")
          .select("project_id,trigger_kind,title,detail,ball_owner,due_at,priority,status,created_at")
          .in("status", ["open", "blocked"])
          .order("due_at", { ascending: true })
          .limit(220),
        supabase
          .from("project_strategy_signals")
          .select("project_id,signal_date,signal_type,title,summary,impact_level,decision_state,status,created_at,updated_at")
          .in("status", ["candidate", "confirmed"])
          .gte("created_at", addDays(now, -60).toISOString())
          .order("created_at", { ascending: false })
          .limit(260),
        supabase
          .from("l2_coverage_gaps")
          .select("project_id,title,summary,salience_score,proposed_target_l2,gap_class,scope,due_at,review_status,detected_at")
          .eq("review_status", "candidate")
          .order("detected_at", { ascending: false })
          .limit(160),
        supabase
          .from("project_meeting_summaries")
          .select("project_id,meeting_id,title,meeting_date,meeting_start_at,source_kinds,prep_readiness_score,prep_worker_status,prep_status,prep_worker_ready_at,updated_at")
          .gte("meeting_date", fortyFiveDaysAgo)
          .lte("meeting_date", thirtyDaysAhead)
          .order("meeting_date", { ascending: true })
          .limit(320),
      ]);

      if (!cancelled) {
        setData({
          todos: ((todoRes.data ?? []) as ProactiveTodoRow[]),
          signals: ((signalRes.data ?? []) as StrategySignalRow[]),
          gaps: ((gapRes.data ?? []) as CoverageGapRow[]),
          meetings: ((meetingRes.data ?? []) as MeetingSummaryRow[]),
        });
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const radarRows = useMemo(() => {
    if (!data) return [];
    return buildRadarRows(projects, billingStatus, data);
  }, [projects, billingStatus, data]);

  if (hidden) return null;
  if (loading) {
    return <section className="h-36 rounded-[8px] border border-[var(--desk-line)] bg-[rgba(255,253,247,0.54)] animate-pulse" />;
  }

  const visibleRows = radarRows.slice(0, 14);
  const latentCount = radarRows.filter((row) => row.suggestion.kind === "latent").length;
  const criticalCount = radarRows.filter((row) => row.level === "critical").length;
  const pushCount = radarRows.filter((row) => row.level === "push").length;

  return (
    <section className="dashboard-desk-section">
      <div className="mb-3 flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-[rgba(44,95,131,0.18)] bg-[rgba(222,235,242,0.72)] text-[var(--desk-blue)]">
            <Radar className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="dashboard-desk-section-title mb-1">PJ先手レーダー</div>
            <p className="text-[11px] leading-relaxed text-[var(--desk-muted)]">
              未処理だけでなく、まだ明示されていない空白から「いま打つと効く一手」をPJごとに提案する。
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
          <RadarStat label="危険" value={criticalCount} tone="risk" />
          <RadarStat label="要押し" value={pushCount} tone="watch" />
          <RadarStat label="空白提案" value={latentCount} tone="latent" />
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <div className="rounded-[8px] border border-[var(--desk-line)] bg-[rgba(255,253,247,0.72)] px-3 py-4 text-center text-[11px] text-[var(--desk-muted)]">
          監視対象PJは落ち着いてる。次のMTG・Coverage gap・経営ハイライトで自動的に浮上する。
        </div>
      ) : (
        <div className="space-y-1.5">
          {visibleRows.map((row) => (
            <RadarProjectRow key={row.project.projectId} row={row} />
          ))}
          {radarRows.length > visibleRows.length ? (
            <div className="px-2 pt-1 text-[10px] text-[var(--desk-muted)]">
              他 {radarRows.length - visibleRows.length} PJ は平常監視に折りたたみ。
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function RadarProjectRow({ row }: { row: ProjectRadar }) {
  const levelMeta = LEVEL_META[row.level];
  const dueLabel = row.suggestion.dueAt ? formatDue(row.suggestion.dueAt) : null;

  return (
    <div
      className={`grid gap-2 rounded-[8px] border border-[var(--desk-line)] border-l-4 ${levelMeta.railClassName} bg-[rgba(255,253,247,0.8)] px-2.5 py-2 lg:grid-cols-[minmax(150px,0.9fr)_minmax(250px,1.7fr)_minmax(320px,1.35fr)_auto] lg:items-center`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] text-[var(--desk-muted)]">{row.project.projectId}</span>
          <Link href={`/project/${row.project.projectId}/cockpit`} className="truncate text-[13px] font-semibold hover:underline">
            {row.project.projectName}
          </Link>
          <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${levelMeta.className}`}>{levelMeta.label}</span>
        </div>
        <div className="mt-0.5 truncate text-[10px] text-[var(--desk-muted)]">{row.project.clientName || row.project.status}</div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${
              row.suggestion.kind === "latent"
                ? "border-[rgba(44,95,131,0.22)] bg-[rgba(222,235,242,0.7)] text-[var(--desk-blue)]"
                : "border-[rgba(168,100,22,0.24)] bg-[rgba(246,232,205,0.78)] text-[var(--desk-amber)]"
            }`}
          >
            {row.suggestion.kind === "latent" ? "空白提案" : "未処理"}
          </span>
          {dueLabel ? <span className="text-[10px] text-[var(--desk-muted)]">{dueLabel}</span> : null}
        </div>
        <div className="mt-1 truncate text-[12px] font-medium text-[var(--desk-ink)]" title={row.suggestion.title}>
          {row.suggestion.title}
        </div>
        <div className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-[var(--desk-muted)]">{row.suggestion.reason}</div>
      </div>

      <div className="grid grid-cols-5 gap-1">
        {(Object.keys(SENSOR_META) as SensorKey[]).map((key) => (
          <SensorPill key={key} sensorKey={key} state={row.sensors[key]} />
        ))}
      </div>

      <Link
        href={row.suggestion.href}
        className="flex h-8 w-8 items-center justify-center justify-self-end rounded-[7px] border border-[var(--desk-line)] bg-[var(--desk-panel-raised)] text-[var(--desk-muted)] transition-colors hover:bg-[var(--desk-sheet)] hover:text-[var(--desk-ink)] lg:justify-self-auto"
        title="根拠を見る"
      >
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function SensorPill({ sensorKey, state }: { sensorKey: SensorKey; state: SensorState }) {
  const meta = SENSOR_META[sensorKey];
  const Icon = meta.Icon;
  return (
    <span
      className={`min-w-0 rounded-[7px] border px-1.5 py-1 leading-tight ${SENSOR_TONE_CLASS[state.tone]}`}
      title={`${meta.label}: ${state.detail}`}
    >
      <span className="flex items-center justify-center gap-1">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate text-[9px] font-semibold">{state.label}</span>
      </span>
    </span>
  );
}

function RadarStat({ label, value, tone }: { label: string; value: number; tone: "risk" | "watch" | "latent" }) {
  const className =
    tone === "risk"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "watch"
        ? "border-[rgba(168,100,22,0.22)] bg-[rgba(246,232,205,0.72)] text-[var(--desk-amber)]"
        : "border-[rgba(44,95,131,0.2)] bg-[rgba(222,235,242,0.72)] text-[var(--desk-blue)]";
  return (
    <div className={`min-w-[68px] rounded-[8px] border px-2 py-1 ${className}`}>
      <div className="font-mono text-lg font-bold leading-none">{value}</div>
      <div className="mt-0.5 text-[9px] font-semibold">{label}</div>
    </div>
  );
}

function buildRadarRows(
  projects: DashProject[],
  billingStatus: Record<string, DashBillingStatus>,
  data: RadarData
): ProjectRadar[] {
  const now = new Date();
  const todosByProject = groupBy(data.todos, (row) => row.project_id);
  const signalsByProject = groupBy(data.signals, (row) => row.project_id);
  const gapsByProject = groupBy(
    data.gaps.filter((row) => row.project_id),
    (row) => row.project_id || ""
  );
  const meetingsByProject = groupBy(data.meetings, (row) => row.project_id);

  return projects
    .map((project) => {
      const projectTodos = todosByProject.get(project.projectId) ?? [];
      const projectSignals = signalsByProject.get(project.projectId) ?? [];
      const projectGaps = gapsByProject.get(project.projectId) ?? [];
      const projectMeetings = meetingsByProject.get(project.projectId) ?? [];
      const billing = billingStatus[project.projectId];

      const sensors = {
        meeting: buildMeetingSensor(projectMeetings, now, project.status),
        todo: buildTodoSensor(projectTodos, now),
        signal: buildSignalSensor(projectSignals),
        gap: buildGapSensor(projectGaps, now),
        monthly: buildMonthlySensor(billing, now, project.status),
      } satisfies Record<SensorKey, SensorState>;

      const suggestion = buildSuggestion({
        project,
        todos: projectTodos,
        signals: projectSignals,
        gaps: projectGaps,
        meetings: projectMeetings,
        billing,
        sensors,
        now,
      });

      const riskCount = Object.values(sensors).filter((sensor) => sensor.tone === "risk").length;
      const watchCount = Object.values(sensors).filter((sensor) => sensor.tone === "watch").length;
      const level: RadarLevel = riskCount > 0 ? "critical" : watchCount >= 2 ? "push" : watchCount === 1 ? "watch" : "ahead";

      return { project, level, sensors, suggestion, riskCount, watchCount };
    })
    .filter((row) => {
      if (ACTIVE_RADAR_STATUSES.has(row.project.status)) return true;
      return row.riskCount > 0 || row.watchCount > 0 || row.suggestion.kind === "visible";
    })
    .sort((a, b) => {
      const levelDelta = levelRank(b.level) - levelRank(a.level);
      if (levelDelta !== 0) return levelDelta;
      if (a.suggestion.kind !== b.suggestion.kind) return a.suggestion.kind === "latent" ? -1 : 1;
      const aDue = a.suggestion.dueAt ? new Date(a.suggestion.dueAt).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.suggestion.dueAt ? new Date(b.suggestion.dueAt).getTime() : Number.POSITIVE_INFINITY;
      if (aDue !== bDue) return aDue - bDue;
      return a.project.projectId.localeCompare(b.project.projectId);
    });
}

function buildMeetingSensor(meetings: MeetingSummaryRow[], now: Date, projectStatus: string): SensorState {
  const upcoming = meetings
    .filter((meeting) => isUpcomingMeeting(meeting) && new Date(meeting.meeting_date).getTime() >= startOfDay(now).getTime())
    .sort((a, b) => new Date(a.meeting_start_at || a.meeting_date).getTime() - new Date(b.meeting_start_at || b.meeting_date).getTime());
  const recentHeld = meetings
    .filter((meeting) => !isUpcomingMeeting(meeting) && new Date(meeting.meeting_date).getTime() <= now.getTime())
    .sort((a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime());
  const next = upcoming[0];

  if (next) {
    const days = daysBetween(now, new Date(next.meeting_start_at || next.meeting_date));
    const readiness = next.prep_readiness_score;
    const workerReady = next.prep_worker_status === "ready" || Boolean(next.prep_worker_ready_at);
    const workerStatus = formatPrepWorkerStatus(next.prep_worker_status);
    if (days <= 3 && ((readiness ?? 0) < 50 || !workerReady)) {
      return { tone: "risk", label: `${days}日`, detail: `次回MTGが近い。準備点 ${readiness ?? "未算定"} / 支援準備 ${workerStatus}` };
    }
    if (days <= 7 && ((readiness ?? 0) < 80 || !workerReady)) {
      return { tone: "watch", label: `${days}日`, detail: `次回MTG前に論点表を先に置く余地あり。準備点 ${readiness ?? "未算定"}` };
    }
    return { tone: "ok", label: `${days}日`, detail: `次回MTGあり。準備状態は大きな警告なし。` };
  }

  const last = recentHeld[0];
  if (!last && (projectStatus === "active" || projectStatus === "sales" || projectStatus === "draft")) {
    return { tone: "watch", label: "空白", detail: "直近45日のMTG記録が薄い。接点を先につくる候補。" };
  }
  if (last) {
    const daysSince = daysBetween(new Date(last.meeting_date), now);
    if (daysSince > 30 && projectStatus === "active") {
      return { tone: "watch", label: `${daysSince}日前`, detail: "直近MTGから30日超。こちらから進捗整理を出す候補。" };
    }
    return { tone: "quiet", label: `${daysSince}日前`, detail: "直近MTGあり。次回予定は未検知。" };
  }

  return { tone: "quiet", label: "なし", detail: "MTG由来の先手材料なし。" };
}

function buildTodoSensor(todos: ProactiveTodoRow[], now: Date): SensorState {
  if (todos.length === 0) return { tone: "quiet", label: "0", detail: "未対応の先手なし。" };
  const overdue = todos.filter((todo) => new Date(todo.due_at).getTime() < now.getTime());
  const red = todos.filter((todo) => todo.priority === "red");
  const blocked = todos.filter((todo) => todo.status === "blocked");
  if (overdue.length > 0 || red.length > 0) {
    return { tone: "risk", label: `${todos.length}`, detail: `期限超過 ${overdue.length} / 赤 ${red.length} / 停止 ${blocked.length}` };
  }
  if (blocked.length > 0) {
    return { tone: "watch", label: `${todos.length}`, detail: `停止中 ${blocked.length}。3日後に再浮上する。` };
  }
  return { tone: "watch", label: `${todos.length}`, detail: "未対応の先手あり。" };
}

function buildSignalSensor(signals: StrategySignalRow[]): SensorState {
  const candidates = signals.filter((signal) => signal.status === "candidate");
  const highCandidates = candidates.filter((signal) => HIGH_IMPACTS.has(signal.impact_level));
  const proposed = signals.filter((signal) => signal.decision_state === "proposed" || signal.signal_type === "next_move");

  if (highCandidates.some((signal) => signal.impact_level === "critical")) {
    return { tone: "risk", label: `${highCandidates.length}`, detail: "最重要の未確認経営ハイライトあり。先に判断か提案化が必要。" };
  }
  if (highCandidates.length > 0) {
    return { tone: "watch", label: `${highCandidates.length}`, detail: "重要度高の未確認経営ハイライトあり。次の一手へ変換候補。" };
  }
  if (proposed.length > 0) {
    return { tone: "watch", label: `${proposed.length}`, detail: "提案状態の経営ハイライトあり。一手化前の先手候補。" };
  }
  const recentConfirmed = signals.filter((signal) => signal.status === "confirmed").length;
  if (recentConfirmed > 0) return { tone: "ok", label: `${recentConfirmed}`, detail: "直近の確認済み経営ハイライトあり。" };
  return { tone: "quiet", label: "0", detail: "直近60日の経営ハイライトは薄い。" };
}

function buildGapSensor(gaps: CoverageGapRow[], now: Date): SensorState {
  if (gaps.length === 0) return { tone: "quiet", label: "0", detail: "未処理の不在検知なし。" };
  const due = gaps.filter((gap) => gap.due_at && new Date(gap.due_at).getTime() < now.getTime());
  const structural = gaps.filter((gap) => gap.gap_class === "structural_gap" || gap.gap_class === "uncertain");
  const hot = gaps.filter((gap) => gapSalience(gap) >= 0.75);
  if (due.length > 0 || structural.length > 0 || hot.length > 0) {
    return { tone: "risk", label: `${gaps.length}`, detail: `不在検知 ${gaps.length}件。構造未整理 ${structural.length} / 重要度高 ${hot.length}` };
  }
  return { tone: "watch", label: `${gaps.length}`, detail: "OS化先が未確定の候補あり。" };
}

function buildMonthlySensor(billing: DashBillingStatus | undefined, now: Date, projectStatus: string): SensorState {
  if (!billing || !ACTIVE_RADAR_STATUSES.has(projectStatus)) {
    return { tone: "quiet", label: "—", detail: "月次監視対象外、または当月cycleなし。" };
  }
  const missing = [
    !billing.budgetDone && "確定",
    !billing.reportDone && "報告",
    !billing.invoiceDone && "請求",
    !billing.paymentDone && "入金",
  ].filter(Boolean) as string[];
  if (missing.length === 0) return { tone: "ok", label: "完了", detail: `${billing.ym} の月次4点は完了。` };
  const day = now.getDate();
  if (day >= 24) return { tone: "risk", label: `${missing.length}`, detail: `${billing.ym} の未完了: ${missing.join(" / ")}` };
  if (day >= 15) return { tone: "watch", label: `${missing.length}`, detail: `${billing.ym} の月次未完了: ${missing.join(" / ")}` };
  return { tone: "quiet", label: `${missing.length}`, detail: `月前半の未完了: ${missing.join(" / ")}` };
}

function buildSuggestion(args: {
  project: DashProject;
  todos: ProactiveTodoRow[];
  signals: StrategySignalRow[];
  gaps: CoverageGapRow[];
  meetings: MeetingSummaryRow[];
  billing?: DashBillingStatus;
  sensors: Record<SensorKey, SensorState>;
  now: Date;
}): RadarSuggestion {
  const { project, todos, signals, gaps, meetings, billing, sensors, now } = args;
  const cockpitHref = `/project/${project.projectId}/cockpit`;
  const urgentTodo = [...todos].sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())[0];
  if (urgentTodo) {
    return {
      kind: "visible",
      title: urgentTodo.title,
      reason: urgentTodo.detail || `${formatTriggerKind(urgentTodo.trigger_kind)} 由来の先手。`,
      dueAt: urgentTodo.due_at,
      href: "/proactive",
    };
  }

  const next = meetings
    .filter((meeting) => isUpcomingMeeting(meeting) && new Date(meeting.meeting_date).getTime() >= startOfDay(now).getTime())
    .sort((a, b) => new Date(a.meeting_start_at || a.meeting_date).getTime() - new Date(b.meeting_start_at || b.meeting_date).getTime())[0];
  if (next && sensors.meeting.tone !== "ok") {
    return {
      kind: "latent",
      title: "次回MTG前に、論点表と着地仮説を先に置く",
      reason: `次回「${next.title}」が近いのに準備状態が弱い。相手が議論をリードする前に、AMD側の進行案を出す。`,
      dueAt: next.meeting_start_at || next.meeting_date,
      href: `${cockpitHref}?meeting=${encodeURIComponent(next.meeting_id)}`,
    };
  }

  const highSignal = signals.find((signal) => signal.status === "candidate" && HIGH_IMPACTS.has(signal.impact_level))
    || signals.find((signal) => signal.decision_state === "proposed" || signal.signal_type === "next_move");
  if (highSignal) {
    return {
      kind: "latent",
      title: "経営ハイライトを、次の提案か実行一手へ変換する",
      reason: `「${highSignal.title}」がある。観測で止めず、誰に何を出すかまで先に形にする。`,
      dueAt: highSignal.signal_date,
      href: cockpitHref,
    };
  }

  const hotGap = gaps.find((gap) => gap.gap_class === "structural_gap" || gap.gap_class === "uncertain")
    || gaps.find((gap) => gapSalience(gap) >= 0.75)
    || gaps[0];
  if (hotGap) {
    return {
      kind: "latent",
      title: "不在検知を放置せず、OS化先を先に決める",
      reason: `${hotGap.title || "未分類の重要候補"} が未ルート。取りこぼしになる前に、実行・経営ハイライト・統治のどこへ入れるか決める。`,
      dueAt: hotGap.due_at || hotGap.detected_at,
      href: "/notifications",
    };
  }

  if (billing && sensors.monthly.tone !== "ok" && sensors.monthly.tone !== "quiet") {
    return {
      kind: "latent",
      title: "月次・請求・入金の詰まりを先に潰す",
      reason: sensors.monthly.detail,
      dueAt: null,
      href: cockpitHref,
    };
  }

  if (sensors.meeting.tone === "watch" && (project.status === "active" || project.status === "sales" || project.status === "draft")) {
    return {
      kind: "latent",
      title: project.status === "active" ? "こちらから進捗整理か次回接点を作る" : "提案仮説を置いて、次の接点を作る",
      reason: sensors.meeting.detail,
      dueAt: null,
      href: cockpitHref,
    };
  }

  return {
    kind: "latent",
    title: "現時点は平常監視。次のMTG・シグナル・gapで再浮上",
    reason: "見えている未処理は薄い。先手材料が出たらこの行が上がる。",
    dueAt: null,
    href: cockpitHref,
  };
}

function isUpcomingMeeting(meeting: MeetingSummaryRow) {
  const source = meeting.source_kinds || "";
  return source.includes("upcoming") || meeting.meeting_id.startsWith("upcoming:");
}

function formatTriggerKind(kind: string) {
  const lower = kind.toLowerCase();
  if (lower.includes("meeting") || lower.includes("prep")) return "MTG準備";
  if (lower.includes("monthly") || lower.includes("billing") || lower.includes("invoice")) return "月次";
  if (lower.includes("signal") || lower.includes("strategy")) return "経営ハイライト";
  if (lower.includes("gap") || lower.includes("coverage")) return "不在検知";
  if (lower.includes("contract")) return "契約";
  return "先手センサー";
}

function gapSalience(gap: CoverageGapRow) {
  const value = typeof gap.salience_score === "string" ? Number(gap.salience_score) : gap.salience_score;
  return Number.isFinite(value) ? Number(value) : 0;
}

function formatPrepWorkerStatus(status: string | null) {
  if (!status) return "未準備";
  const lower = status.toLowerCase();
  if (lower === "ready") return "準備済み";
  if (lower === "running" || lower === "working") return "作業中";
  if (lower === "queued" || lower === "pending") return "待機中";
  if (lower === "failed" || lower === "error") return "失敗";
  if (lower === "blocked") return "停止中";
  return "未分類";
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

function levelRank(level: RadarLevel) {
  return level === "critical" ? 4 : level === "push" ? 3 : level === "watch" ? 2 : 1;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysBetween(from: Date, to: Date) {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.max(0, Math.ceil(ms / 86400000));
}

function formatDue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const now = new Date();
  const diff = startOfDay(date).getTime() - startOfDay(now).getTime();
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return `期限超過 ${Math.abs(days)}日`;
  if (days === 0) return "今日";
  if (days === 1) return "明日";
  return `${days}日後`;
}
