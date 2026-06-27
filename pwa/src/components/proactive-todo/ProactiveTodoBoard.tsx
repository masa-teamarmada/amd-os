"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, PauseCircle, Trash2, X, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * ProactiveTodoBoard — 先手 TODO リスト本体
 *
 * 仕様正本: pwa/spec/2-4-proactive-todo-current-spec.md
 *
 * 全PJ横断・期限順・3ボタン完了UI。/proactive ページ専用。
 * dashboard 側はバッジ (= ProactiveTodoBadge.tsx) だけ出す。
 */

type Status = "open" | "done" | "blocked" | "dismissed";
type BallOwner = "amd" | "ambiguous" | "counterpart";

type TodoRow = {
  id: string;
  project_id: string;
  trigger_kind: string;
  source_meeting_id: string | null;
  source_event_id: string | null;
  title: string;
  detail: string | null;
  ball_owner: BallOwner;
  due_at: string;
  priority: "red" | "normal";
  status: Status;
  resolved_note: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_TABS: { key: Status; label: string }[] = [
  { key: "open", label: "未対応" },
  { key: "blocked", label: "ブロック中" },
  { key: "done", label: "完了" },
  { key: "dismissed", label: "関係ない" },
];

function formatDueChip(dueAt: string): { label: string; tone: string; overdue: boolean } {
  const ms = new Date(dueAt).getTime() - Date.now();
  const h = Math.round(ms / 3600_000);
  if (ms < 0) {
    const overdueH = Math.abs(h);
    if (overdueH >= 24) {
      return { label: `${Math.round(overdueH / 24)}日超過`, tone: "bg-red-500/15 text-red-700 border-red-300", overdue: true };
    }
    return { label: `${overdueH}h超過`, tone: "bg-red-500/15 text-red-700 border-red-300", overdue: true };
  }
  if (h <= 24) return { label: `残${h}h`, tone: "bg-amber-500/15 text-amber-700 border-amber-300", overdue: false };
  if (h <= 72) return { label: `残${h}h`, tone: "bg-amber-500/10 text-amber-700 border-amber-200", overdue: false };
  return { label: `残${Math.round(h / 24)}日`, tone: "bg-muted text-muted-foreground border-border", overdue: false };
}

function formatJst(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

const TRIGGER_LABEL: Record<string, string> = {
  meeting_next_action: "MTG決定事項",
  next_meeting_prep: "次回MTG準備",
};

const BALL_LABEL: Record<BallOwner, string> = {
  amd: "AMDボール",
  ambiguous: "ボール曖昧",
  counterpart: "相手ボール",
};

export function ProactiveTodoBoard() {
  const [rows, setRows] = useState<TodoRow[]>([]);
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Status>("open");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [todosRes, projectsRes] = await Promise.all([
      supabase
        .from("proactive_todos")
        .select("*")
        .eq("status", tab)
        .order("priority", { ascending: true })
        .order("due_at", { ascending: true })
        .limit(200),
      supabase.from("projects").select("project_id, project_name"),
    ]);
    if (todosRes.error) {
      setError(todosRes.error.message);
      setLoading(false);
      return;
    }
    setRows((todosRes.data ?? []) as TodoRow[]);
    setProjects(
      Object.fromEntries(
        (projectsRes.data ?? []).map((r) => [String(r.project_id), String(r.project_name)]),
      ),
    );
    setError(null);
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<Status, number> = { open: 0, done: 0, blocked: 0, dismissed: 0 };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);

  const overdueCount = useMemo(
    () => rows.filter((r) => r.status === "open" && new Date(r.due_at).getTime() < Date.now()).length,
    [rows],
  );

  const resolve = async (id: string, action: "done" | "blocked" | "dismissed", note?: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/proactive-todos/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note ?? null }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || res.statusText);
      }
      await load();
      setExpandedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "送信エラー");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-md border px-3 py-1.5 font-medium ${
              tab === t.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted/40"
            }`}
          >
            {t.label}
            {tab === t.key ? <span className="ml-1.5 opacity-80">({counts[t.key] ?? 0})</span> : null}
          </button>
        ))}
        {tab === "open" && overdueCount > 0 ? (
          <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-2 py-1 text-red-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            期限超過 {overdueCount} 件
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          エラー: {error}
        </div>
      ) : null}

      {loading ? (
        <div className="h-32 rounded-md border border-border bg-muted/20 animate-pulse" />
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/10 px-4 py-8 text-center text-xs text-muted-foreground">
          {tab === "open"
            ? "未対応の先手 TODO は無いよ。MTG後の next_action か、3営業日以内の予定MTGがあれば自動で積まれる。"
            : `この状態 (${STATUS_TABS.find((t) => t.key === tab)?.label}) の TODO は無いよ。`}
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const due = formatDueChip(row.due_at);
            const projectName = projects[row.project_id] || row.project_id;
            const expanded = expandedId === row.id;
            const busy = busyId === row.id;
            return (
              <li
                key={row.id}
                className={`rounded-md border bg-card ${
                  row.priority === "red" || due.overdue ? "border-red-200" : "border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : row.id)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted/20"
                >
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${due.tone}`}
                  >
                    {due.label}
                  </span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {TRIGGER_LABEL[row.trigger_kind] ?? row.trigger_kind}
                  </span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {BALL_LABEL[row.ball_owner]}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-foreground">
                    <span className="font-medium">{projectName}</span>
                    <span className="mx-1.5 text-muted-foreground">/</span>
                    <span className="text-foreground/90">{row.title.replace(/^[a-z0-9]+\s/i, "")}</span>
                  </span>
                  {expanded ? (
                    <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>

                {expanded ? (
                  <div className="space-y-3 border-t border-border bg-muted/5 px-3 py-3">
                    {row.detail ? (
                      <div className="rounded border border-border bg-background px-3 py-2 text-xs whitespace-pre-wrap leading-relaxed">
                        {row.detail}
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <Meta label="期限" value={formatJst(row.due_at)} />
                      <Meta label="検知" value={TRIGGER_LABEL[row.trigger_kind] ?? row.trigger_kind} />
                      <Meta label="ボール" value={BALL_LABEL[row.ball_owner]} />
                      <Meta label="優先度" value={row.priority === "red" ? "🔴 red" : "通常"} />
                      <Meta label="作成" value={formatJst(row.created_at)} />
                      <Meta label="更新" value={formatJst(row.updated_at)} />
                      {row.source_meeting_id ? (
                        <Meta label="元MTG" value={row.source_meeting_id} colSpan={2} />
                      ) : null}
                      {row.source_event_id ? (
                        <Meta label="元予定MTG" value={row.source_event_id} colSpan={2} />
                      ) : null}
                      {row.resolved_note ? (
                        <Meta label="メモ" value={row.resolved_note} colSpan={2} />
                      ) : null}
                      {row.resolved_by ? (
                        <Meta label="処理者" value={row.resolved_by} colSpan={2} />
                      ) : null}
                    </div>

                    {row.status === "open" || row.status === "blocked" ? (
                      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void resolve(row.id, "done")}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          完了
                        </button>
                        {row.status === "open" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              const note = window.prompt("ブロック理由 (任意・1行):") ?? "";
                              void resolve(row.id, "blocked", note);
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                          >
                            <PauseCircle className="h-3.5 w-3.5" />
                            ブロック中 (3日後に復帰)
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void resolve(row.id, "dismissed")}
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          関係ない (二度と出さない)
                        </button>
                        {busy ? <span className="self-center text-[11px] text-muted-foreground">送信中…</span> : null}
                      </div>
                    ) : (
                      <ReopenButton id={row.id} busy={busy} onReopen={async () => {
                        setBusyId(row.id);
                        try {
                          // 再開 = status='open' に戻す (resolve API は 4状態だが、open 戻しは別 patch で)
                          const supabase = createClient();
                          await supabase
                            .from("proactive_todos")
                            .update({ status: "open", resolved_note: null, resolved_by: null, resolved_at: null })
                            .eq("id", row.id);
                          await load();
                          setExpandedId(null);
                        } finally {
                          setBusyId(null);
                        }
                      }} />
                    )}

                    <div className="border-t border-border pt-2 text-[11px]">
                      <Link
                        href={`/project/${row.project_id}/cockpit`}
                        className="text-primary hover:underline"
                      >
                        {projectName} の cockpit を開く →
                      </Link>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Meta({ label, value, colSpan = 1 }: { label: string; value: string; colSpan?: 1 | 2 }) {
  return (
    <div
      className={`rounded border border-border bg-background px-2 py-1.5 ${colSpan === 2 ? "col-span-2" : ""}`}
    >
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-xs break-words">{value}</div>
    </div>
  );
}

function ReopenButton({ id, busy, onReopen }: { id: string; busy: boolean; onReopen: () => Promise<void> }) {
  return (
    <div className="flex border-t border-border pt-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => void onReopen()}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40 disabled:opacity-50"
        title={`id=${id}`}
      >
        <Clock3 className="h-3.5 w-3.5" />
        未対応に戻す
      </button>
      {busy ? <X className="ml-2 h-4 w-4 self-center animate-spin text-muted-foreground" /> : null}
    </div>
  );
}
