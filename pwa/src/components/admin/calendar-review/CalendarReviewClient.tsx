"use client";

import { type FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCopy,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type PlannerMode = "task" | "meeting";

type PlannerPlan = {
  action: string;
  title?: string;
  task_id?: string;
  meeting_id?: string;
  project_id?: string;
  start?: string | null;
  end?: string | null;
  calendar_writes?: unknown[];
  slack_nudge_candidates?: unknown[];
  review_reasons?: string[];
  risk_flags?: string[];
  auto_write_eligible?: boolean;
  requires_review_before_write?: boolean;
  duplicate_match?: { event_id?: string; reason?: string; confidence?: string } | null;
  proposed_payload?: unknown;
};

type PlannerResponse = {
  ok?: boolean;
  error?: string;
  dry_run?: boolean;
  write_enabled?: boolean;
  summary?: Record<string, number>;
  plans?: PlannerPlan[];
};

const TASK_SAMPLE = JSON.stringify({
  tasks: [
    {
      task_id: "demo:sx:proposal-fix",
      project_id: "p00",
      project_code: "SX",
      title: "提案資料を直す",
      description: "MTG next_actions 由来の作業枠候補",
      owner_member_id: "ID001",
      owner_code_name: "masa",
      owner_calendar_id: "primary",
      manager_calendar_id: "primary",
      owner_slack_user_id: "U000000",
      due_at: "2026-06-24T18:00:00+09:00",
      earliest_start: "2026-06-20T09:00:00+09:00",
      estimated_minutes: 120,
      source_kind: "meeting_todo",
      source_id: "demo-meeting-next-action-1",
      source_confidence: 0.92,
      source_url: "https://amd-os-pwa.vercel.app",
      source_excerpt: "次回までに提案資料を更新する",
    },
  ],
  busy_windows: [],
  existing_task_events: [],
}, null, 2);

const MEETING_SAMPLE = JSON.stringify({
  meetings: [
    {
      meeting_id: "demo-meeting-calendar-review",
      project_id: "p00",
      title: "SX 定例MTG",
      meeting_date: "2026-06-20",
      meeting_start_at: "2026-06-20T13:00:00+09:00",
      meeting_end_at: "2026-06-20T14:00:00+09:00",
      source_kinds: "notion+calendar",
      summary_short: "次回MTGと宿題を整理した",
      homework_items: ["提案資料更新", "実証スケジュール確認"],
      date_confidence: "high",
      invite_attendees: false,
      reply_required: false,
    },
  ],
  existing_events: [],
}, null, 2);

const ACTION_TONE: Record<string, string> = {
  schedule_candidate: "border-emerald-200 bg-emerald-50 text-emerald-800",
  create_candidate: "border-emerald-200 bg-emerald-50 text-emerald-800",
  update_existing: "border-sky-200 bg-sky-50 text-sky-800",
  review_required: "border-amber-200 bg-amber-50 text-amber-800",
  hold: "border-zinc-200 bg-zinc-50 text-zinc-700",
  already_scheduled: "border-slate-200 bg-slate-50 text-slate-700",
};

function actionTone(action: string) {
  return ACTION_TONE[action] ?? "border-slate-200 bg-slate-50 text-slate-700";
}

function jst(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function countWrites(plans: PlannerPlan[]) {
  return plans.reduce((sum, plan) => sum + (Array.isArray(plan.calendar_writes) ? plan.calendar_writes.length : plan.proposed_payload ? 1 : 0), 0);
}

function countNudges(plans: PlannerPlan[]) {
  return plans.reduce((sum, plan) => sum + (Array.isArray(plan.slack_nudge_candidates) ? plan.slack_nudge_candidates.length : 0), 0);
}

function compactPlan(plan: PlannerPlan) {
  return {
    id: plan.task_id || plan.meeting_id,
    project_id: plan.project_id,
    action: plan.action,
    title: plan.title,
    start: plan.start,
    end: plan.end,
    calendar_writes: plan.calendar_writes ?? [],
    proposed_payload: plan.proposed_payload ?? null,
    slack_nudge_candidates: plan.slack_nudge_candidates ?? [],
    review_reasons: plan.review_reasons ?? [],
    risk_flags: plan.risk_flags ?? [],
    duplicate_match: plan.duplicate_match ?? null,
    auto_write_eligible: plan.auto_write_eligible ?? false,
    requires_review_before_write: plan.requires_review_before_write ?? true,
  };
}

export function CalendarReviewClient() {
  const [mode, setMode] = useState<PlannerMode>("task");
  const [input, setInput] = useState(TASK_SAMPLE);
  const [response, setResponse] = useState<PlannerResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const plans = useMemo(() => response?.plans ?? [], [response]);
  const writeCount = useMemo(() => countWrites(plans), [plans]);
  const nudgeCount = useMemo(() => countNudges(plans), [plans]);
  const reviewCount = plans.filter((plan) => plan.action === "review_required" || (plan.review_reasons?.length ?? 0) > 0).length;

  function switchMode(next: PlannerMode) {
    setMode(next);
    setInput(next === "task" ? TASK_SAMPLE : MEETING_SAMPLE);
    setResponse(null);
    setError("");
    setCopied(false);
  }

  async function runPlanner(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setCopied(false);
    try {
      const body = JSON.parse(input) as Record<string, unknown>;
      const endpoint = mode === "task" ? "/api/task-calendar/schedule-plan" : "/api/meeting-calendar/upsert-plan";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, dry_run: true }),
      });
      const json = (await res.json().catch(() => ({}))) as PlannerResponse;
      if (!res.ok || json.error) throw new Error(json.error || `planner_failed_${res.status}`);
      setResponse(json);
    } catch (err) {
      setResponse(null);
      setError(err instanceof Error ? err.message : "planner_failed");
    } finally {
      setLoading(false);
    }
  }

  async function copyBundle() {
    const bundle = {
      kind: "amd_os_calendar_review_bundle",
      mode,
      generated_at: new Date().toISOString(),
      dry_run: response?.dry_run ?? true,
      write_enabled: false,
      plans: plans.map(compactPlan),
    };
    await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md border border-sky-200 bg-sky-50 text-sky-700">
              <CalendarClock className="size-4" />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-normal text-slate-950">Calendar Review</h1>
              <p className="text-sm text-slate-500">H-1 planner dry-run queue</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800">dry-run</Badge>
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">external write gate</Badge>
            <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">Asia/Tokyo</Badge>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right">
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
            <div className="text-lg font-semibold text-slate-950">{plans.length}</div>
            <div className="text-[11px] text-slate-500">plans</div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
            <div className="text-lg font-semibold text-slate-950">{writeCount}</div>
            <div className="text-[11px] text-slate-500">writes</div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
            <div className="text-lg font-semibold text-slate-950">{reviewCount}</div>
            <div className="text-[11px] text-slate-500">review</div>
          </div>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)]">
        <section className="flex min-h-[560px] flex-col rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="flex rounded-md border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => switchMode("task")}
                className={cn(
                  "h-7 rounded px-3 text-xs font-medium transition-colors",
                  mode === "task" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900",
                )}
              >
                Task blocks
              </button>
              <button
                type="button"
                onClick={() => switchMode("meeting")}
                className={cn(
                  "h-7 rounded px-3 text-xs font-medium transition-colors",
                  mode === "meeting" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900",
                )}
              >
                MTG cards
              </button>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => switchMode(mode)}>
              <RefreshCw className="size-3.5" />
              Reset
            </Button>
          </div>

          <form onSubmit={runPlanner} className="flex flex-1 flex-col">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              spellCheck={false}
              className="min-h-[440px] flex-1 resize-none rounded-none border-0 bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-100 outline-none focus-visible:ring-0"
            />
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
              <div className="text-xs text-slate-500">{mode === "task" ? "/api/task-calendar/schedule-plan" : "/api/meeting-calendar/upsert-plan"}</div>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                Run planner
              </Button>
            </div>
          </form>
        </section>

        <section className="flex min-h-[560px] flex-col rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">Review bundle</div>
              <div className="text-xs text-slate-500">
                {response ? `nudges ${nudgeCount} / write enabled ${response.write_enabled ? "true" : "false"}` : "waiting"}
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" disabled={!response || plans.length === 0} onClick={copyBundle}>
              {copied ? <CheckCircle2 className="size-3.5" /> : <ClipboardCopy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                <AlertTriangle className="size-4" />
                {error}
              </div>
            )}

            {!response && !error && (
              <div className="flex h-full min-h-[420px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                Planner output appears here
              </div>
            )}

            {response && (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-4">
                  {Object.entries(response.summary ?? {}).map(([key, value]) => (
                    <div key={key} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-sm font-semibold text-slate-950">{value}</div>
                      <div className="truncate text-[11px] text-slate-500">{key}</div>
                    </div>
                  ))}
                </div>

                {plans.map((plan, index) => {
                  const writes = Array.isArray(plan.calendar_writes) ? plan.calendar_writes : plan.proposed_payload ? [plan.proposed_payload] : [];
                  const reviewReasons = [...(plan.review_reasons ?? []), ...(plan.risk_flags ?? [])];
                  return (
                    <article key={`${plan.task_id || plan.meeting_id || index}`} className="rounded-lg border border-slate-200 bg-white">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium ${actionTone(plan.action)}`}>
                              {plan.action}
                            </span>
                            <span className="text-xs text-slate-500">{plan.project_id || "-"}</span>
                          </div>
                          <h2 className="truncate text-sm font-semibold text-slate-950">{plan.title || plan.meeting_id || plan.task_id}</h2>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          <div>{jst(plan.start)}</div>
                          <div>{jst(plan.end)}</div>
                        </div>
                      </div>

                      <div className="grid gap-3 p-4 lg:grid-cols-[1fr_1fr]">
                        <div className="space-y-2">
                          <div className="text-xs font-semibold uppercase text-slate-500">Calendar write</div>
                          <pre className="max-h-64 overflow-auto rounded-md bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">
                            {JSON.stringify(writes, null, 2)}
                          </pre>
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-semibold uppercase text-slate-500">Review gate</div>
                          <div className="min-h-24 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                            {reviewReasons.length > 0 ? (
                              <ul className="space-y-1">
                                {reviewReasons.map((reason) => <li key={reason}>{reason}</li>)}
                              </ul>
                            ) : (
                              <div className="flex items-center gap-2 text-emerald-700">
                                <CheckCircle2 className="size-4" />
                                no review reasons
                              </div>
                            )}
                            {plan.duplicate_match && (
                              <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-2 text-sky-800">
                                duplicate: {plan.duplicate_match.event_id} / {plan.duplicate_match.reason}
                              </div>
                            )}
                          </div>
                          <div className="text-xs font-semibold uppercase text-slate-500">Slack nudge</div>
                          <pre className="max-h-40 overflow-auto rounded-md bg-slate-50 p-3 text-[11px] leading-5 text-slate-700">
                            {JSON.stringify(plan.slack_nudge_candidates ?? [], null, 2)}
                          </pre>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
