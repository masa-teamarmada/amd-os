"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Clock3,
  DatabaseZap,
  RotateCcw,
  Search,
} from "lucide-react";
import {
  type ChangeHistoryOperation,
  type ChangeHistoryRow,
  displayFieldValue,
  fieldLabel,
  fieldsFor,
  groupHistoryRows,
  recordKey,
  searchableText,
  summaryForRow,
  tableLabel,
} from "@/lib/change-history-presentation";

type Operation = ChangeHistoryOperation;
type HistoryRow = ChangeHistoryRow;
type HistoryResponse = {
  ok: boolean;
  rows?: HistoryRow[];
  page?: number;
  pageSize?: number;
  total?: number;
  hasMore?: boolean;
  error?: string;
};

const OPERATION_LABEL: Record<Operation, string> = {
  insert: "追加",
  update: "変更",
  delete: "削除",
};

const OPERATION_TONE: Record<Operation, string> = {
  insert: "border-emerald-200 bg-emerald-50 text-emerald-800",
  update: "border-sky-200 bg-sky-50 text-sky-800",
  delete: "border-rose-200 bg-rose-50 text-rose-800",
};

function formatDate(value: string, withSeconds = false) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
  }).format(new Date(value));
}

function DiffValues({ row }: { row: HistoryRow }) {
  const fields = fieldsFor(row);
  const shown = fields.slice(0, 8);
  if (shown.length === 0) {
    return <p className="text-xs text-muted-foreground">差分値なし</p>;
  }

  return (
    <div className="grid gap-px overflow-hidden rounded-md border border-border/70 bg-border/70">
      {shown.map((field) => (
        <div
          key={field}
          className="grid min-w-0 bg-background sm:grid-cols-[140px_minmax(0,1fr)]"
        >
          <div className="border-b border-border/50 bg-muted/35 px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground sm:border-b-0 sm:border-r">
            {fieldLabel(field)}
          </div>
          <div className="grid min-w-0 gap-1 px-2.5 py-1.5 text-xs sm:grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)] sm:items-start">
            {row.operation === "insert" ? (
              <span className="min-w-0 break-words text-emerald-800 sm:col-span-3">
                {displayFieldValue(field, row.after_values[field])}
              </span>
            ) : row.operation === "delete" ? (
              <span className="min-w-0 break-words text-rose-800 line-through sm:col-span-3">
                {displayFieldValue(field, row.before_values[field])}
              </span>
            ) : (
              <>
                <span className="min-w-0 break-words text-muted-foreground">
                  {displayFieldValue(field, row.before_values[field])}
                </span>
                <span className="text-center text-sky-600" aria-hidden="true">
                  →
                </span>
                <span className="min-w-0 break-words font-medium text-foreground">
                  {displayFieldValue(field, row.after_values[field])}
                </span>
              </>
            )}
          </div>
        </div>
      ))}
      {fields.length > shown.length && (
        <div className="bg-background px-2.5 py-1.5 text-[11px] text-muted-foreground">
          ほか {fields.length - shown.length}項目
        </div>
      )}
    </div>
  );
}

function UndoButton({
  row,
  onUndo,
  undoing,
}: {
  row: HistoryRow;
  onUndo: (row: HistoryRow) => void;
  undoing: boolean;
}) {
  if (row.undo_of_history_id || row.undone_by_history_id) {
    return (
      <span
        className="inline-flex min-h-11 items-center gap-1 rounded-md border border-border bg-muted/40 px-2.5 text-xs font-semibold text-muted-foreground sm:min-h-9"
        title={row.undone_at ? `戻し日時: ${formatDate(row.undone_at, true)}` : "この履歴は戻し操作済み"}
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        戻し済み
      </span>
    );
  }
  if (row.undo_supported) {
    return (
      <button
        type="button"
        aria-label="この変更を戻す"
        onClick={() => onUndo(row)}
        disabled={undoing}
        className="inline-flex min-h-11 items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2.5 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-wait disabled:opacity-50 sm:min-h-9"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        {undoing ? "戻し中…" : "戻す"}
      </button>
    );
  }
  return (
    <span
      className="inline-flex min-h-11 max-w-full items-center rounded-md border border-border bg-muted/30 px-2.5 text-xs text-muted-foreground sm:min-h-9"
      title={row.undo_block_reason ?? "安全条件を満たさない"}
    >
      戻し対象外: {row.undo_block_reason ?? "安全条件外"}
    </span>
  );
}

function HistoryGroup({
  group,
  onUndo,
  undoingId,
  expanded,
  onToggle,
}: {
  group: ReturnType<typeof groupHistoryRows>[number];
  onUndo: (row: HistoryRow) => void;
  undoingId: string | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const operations = [...new Set(group.rows.map((row) => row.operation))];
  const detailsLabel = group.rows.length === 1 ? "詳細を展開" : `${group.rows.length}件の詳細を展開`;

  return (
    <li className="min-w-0 py-2.5">
      <div className="grid min-w-0 gap-1.5 lg:grid-cols-[150px_minmax(0,1fr)_auto] lg:items-start lg:gap-4">
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <time className="block" dateTime={group.occurred_at}>{formatDate(group.occurred_at)}</time>
            <span className="mt-0.5 block max-w-full break-words font-semibold text-foreground">{group.actor_label}</span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {operations.map((item) => (
              <span key={item} className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${OPERATION_TONE[item]}`}>
                {OPERATION_LABEL[item]}
              </span>
            ))}
            {group.rows.length > 1 && (
              <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {group.rows.length}件
              </span>
            )}
            <span className="min-w-0 break-words text-sm leading-5 text-foreground">{group.summary}</span>
          </div>
          <p className="mt-0.5 min-w-0 break-words text-[11px] text-muted-foreground">
            {group.target} · {tableLabel(group.table_name)}
          </p>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-1">
          {group.rows.length === 1 && (group.rows[0].undo_supported || group.rows[0].undo_of_history_id || group.rows[0].undone_by_history_id) && (
            <UndoButton row={group.rows[0]} onUndo={onUndo} undoing={undoingId === group.rows[0].id} />
          )}
          <button type="button" aria-expanded={expanded} aria-controls={`change-history-details-${group.id}`} onClick={onToggle} className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:min-h-9">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
            {expanded ? "詳細を閉じる" : detailsLabel}
          </button>
        </div>
      </div>
      {expanded && <div id={`change-history-details-${group.id}`} className="mt-2 min-w-0 border-l-2 border-sky-700/20 pl-2.5 lg:ml-[166px]">
        {group.rows.map((row) => (
          <div key={row.id} className="min-w-0 border-b border-border/60 py-2 last:border-b-0">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 text-[11px] text-muted-foreground">
                <time dateTime={row.occurred_at}>{formatDate(row.occurred_at, true)}</time>
                <span className="mx-1">·</span>
                <span className="break-all font-mono">{recordKey(row.record_pk)}</span>
              </div>
              <UndoButton row={row} onUndo={onUndo} undoing={undoingId === row.id} />
            </div>
            <p className="mt-1 break-words text-xs font-medium text-foreground">{summaryForRow(row)}</p>
            <DiffValues row={row} />
          </div>
        ))}
      </div>}
    </li>
  );
}

export function AdminChangeHistoryClient() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [operation, setOperation] = useState<"" | Operation>("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (operation) params.set("operation", operation);
      const response = await fetch(`/api/admin/change-history?${params}`, { cache: "no-store" });
      const payload = await response.json() as HistoryResponse;
      if (!response.ok || !payload.ok) throw new Error(payload.error || "load_failed");
      setRows(payload.rows ?? []);
      setTotal(payload.total ?? 0);
      setHasMore(Boolean(payload.hasMore));
    } catch {
      setError("変更履歴を読み込めなかった。少し待ってから再読み込みして。 ");
    } finally {
      setLoading(false);
    }
  }, [operation, page]);

  const undo = useCallback(async (row: HistoryRow) => {
    if (!row.undo_supported || row.undo_of_history_id || row.undone_by_history_id) return;
    if (!window.confirm(`${tableLabel(row.table_name)}の変更を戻す？\n\n現在値が履歴の変更後と一致する場合だけ実行する。戻し操作も新しい履歴として残る。`)) return;
    setUndoingId(row.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/change-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "undo", historyId: row.id }),
      });
      const payload = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; reason?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.reason || (payload.error === "undo_conflict" ? "現在値が変わっているため、安全のため戻さなかった" : "変更を戻せなかった"));
        return;
      }
      setMessage("変更を戻した。戻し操作も履歴に追加した。");
      await load();
    } catch {
      setError("変更を戻せなかった。通信状態を確認して再試行して。");
    } finally {
      setUndoingId(null);
    }
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? rows.filter((row) => searchableText(row).includes(needle)) : rows;
  }, [rows, search]);
  const groups = useMemo(() => groupHistoryRows(filteredRows), [filteredRows]);
  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const chooseOperation = (next: "" | Operation) => {
    setOperation(next);
    setPage(0);
  };

  return (
    <div className="mx-auto min-w-0 w-full max-w-[1180px] px-0 py-0 sm:px-2">
      <header className="border-b border-border/70 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-sky-200 bg-sky-50 text-sky-800">
            <DatabaseZap className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-sky-800">管理 / 監査</p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">データ変更履歴</h1>
          </div>
        </div>
        <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">
          誰が、いつ、どのPJの何をどう変えたかを、変更要約で確認する。元の差分と戻す操作は詳細に保管している。
        </p>
      </header>

      <div className="sticky top-0 z-10 mx-0 min-w-0 border-b border-border/70 bg-background/95 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-0.5" role="group" aria-label="操作の絞り込み">
            {(["", "insert", "update", "delete"] as const).map((value) => (
              <button key={value || "all"} type="button" onClick={() => chooseOperation(value)} className={`min-h-11 rounded-md px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:min-h-9 ${operation === value ? "bg-sky-800 text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                {value ? OPERATION_LABEL[value] : "すべて"}
              </button>
            ))}
          </div>
          <label className="relative block min-w-0 sm:w-[min(360px,100%)]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">表示中の履歴を検索</span>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="実行者・PJ・項目で検索" className="min-h-11 w-full rounded-md border border-border bg-muted/30 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-sky-500 focus:ring-2 focus:ring-sky-100 sm:min-h-10" />
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-border/70 py-2 text-xs text-muted-foreground">
        <span>このページ {groups.length}操作 / 対象{new Intl.NumberFormat("ja-JP").format(total)}件</span>
        <span>新しい順</span>
      </div>
      {message && <div role="status" className="my-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>}
      {loading ? <div className="py-12 text-center text-sm text-muted-foreground">変更履歴を読み込み中…</div> : error ? <div role="alert" className="my-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div> : groups.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">該当する変更履歴はない</div> : <ul className="min-w-0 divide-y divide-border/70">{groups.map((group) => <HistoryGroup key={group.id} group={group} onUndo={undo} undoingId={undoingId} expanded={expandedIds.has(group.id)} onToggle={() => toggleExpanded(group.id)} />)}</ul>}
      <nav aria-label="変更履歴のページ" className="flex items-center justify-between border-t border-border/70 py-4">
        <button type="button" disabled={page === 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))} className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 sm:min-h-10"><ArrowLeft className="h-4 w-4" aria-hidden="true" />新しい履歴</button>
        <span className="text-xs text-muted-foreground">{page + 1}ページ</span>
        <button type="button" disabled={!hasMore || loading} onClick={() => setPage((value) => value + 1)} className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 sm:min-h-10">古い履歴<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
      </nav>
    </div>
  );
}
