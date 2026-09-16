"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Clock3, DatabaseZap, RotateCcw, Search } from "lucide-react";

type Operation = "insert" | "update" | "delete";
type HistoryRow = {
  id: string;
  occurred_at: string;
  table_name: string;
  operation: Operation;
  record_pk: Record<string, unknown>;
  actor_id: string | null;
  actor_label: string;
  actor_source: string;
  changed_fields: string[];
  before_values: Record<string, unknown>;
  after_values: Record<string, unknown>;
  undo_supported: boolean;
  undo_block_reason: string | null;
  undo_of_history_id: string | null;
  undone_by_history_id: string | null;
  undone_at: string | null;
  transaction_id: number;
};

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

const TABLE_LABELS: Record<string, string> = {
  projects: "PJ台帳",
  members: "メンバー台帳",
  project_members: "PJメンバー",
  workspace_user_accounts: "外部アカウント",
  institution_workspace_memberships: "研究機関ワークスペース権限",
  project_access_memberships: "個別PJ権限",
  workspace_documents: "ワークスペース資料",
  value_milestones: "マイルストーン",
  milestone_monthly_progress: "月次進捗",
  project_management_tasks: "PJタスク",
  project_questions: "論点",
  project_question_actions: "TODO",
  project_meeting_summaries: "会議記録",
  contracts: "契約",
  reimbursements: "立替",
  billing_cycles: "請求",
};

function tableLabel(table: string) {
  return TABLE_LABELS[table] ?? table;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function displayValue(value: unknown): string {
  if (value === null) return "未設定";
  if (value === undefined) return "—";
  if (typeof value === "boolean") return value ? "はい" : "いいえ";
  if (typeof value === "string") return value || "空欄";
  if (typeof value === "number") return new Intl.NumberFormat("ja-JP").format(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function recordKey(recordPk: Record<string, unknown>) {
  const entries = Object.entries(recordPk);
  if (entries.length === 0) return "行ID未取得";
  return entries.map(([key, value]) => `${key}: ${displayValue(value)}`).join(" / ");
}

function fieldsFor(row: HistoryRow) {
  if (row.operation === "update") return row.changed_fields;
  const values = row.operation === "delete" ? row.before_values : row.after_values;
  return Object.keys(values).filter((key) => !["created_at", "updated_at"].includes(key));
}

function DiffValues({ row }: { row: HistoryRow }) {
  const fields = fieldsFor(row);
  const shown = fields.slice(0, 8);
  if (shown.length === 0) return <p className="text-xs text-muted-foreground">差分値なし</p>;

  return (
    <div className="grid gap-px overflow-hidden rounded-md border border-border/70 bg-border/70">
      {shown.map((field) => (
        <div key={field} className="grid min-w-0 bg-background sm:grid-cols-[150px_minmax(0,1fr)]">
          <div className="border-b border-border/50 bg-muted/35 px-3 py-2 font-mono text-[11px] text-muted-foreground sm:border-b-0 sm:border-r">
            {field}
          </div>
          <div className="grid min-w-0 gap-1 px-3 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] sm:items-start">
            {row.operation === "insert" ? (
              <span className="min-w-0 break-words text-emerald-800 sm:col-span-3">{displayValue(row.after_values[field])}</span>
            ) : row.operation === "delete" ? (
              <span className="min-w-0 break-words text-rose-800 line-through decoration-rose-300 sm:col-span-3">{displayValue(row.before_values[field])}</span>
            ) : (
              <>
                <span className="min-w-0 break-words text-muted-foreground">{displayValue(row.before_values[field])}</span>
                <ArrowRight className="hidden h-3.5 w-3.5 text-sky-600 sm:block" aria-hidden="true" />
                <span className="min-w-0 break-words font-medium text-foreground">{displayValue(row.after_values[field])}</span>
              </>
            )}
          </div>
        </div>
      ))}
      {fields.length > shown.length && (
        <div className="bg-background px-3 py-2 text-[11px] text-muted-foreground">ほか {fields.length - shown.length}項目</div>
      )}
    </div>
  );
}

function HistoryItem({
  row,
  onUndo,
  undoing,
}: {
  row: HistoryRow;
  onUndo: (row: HistoryRow) => void;
  undoing: boolean;
}) {
  return (
    <li className="grid gap-3 py-4 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-6">
      <div className="min-w-0 border-l-2 border-sky-700/35 pl-3">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          {formatDate(row.occurred_at)}
        </div>
        <p className="mt-1 break-words text-xs font-semibold text-foreground">{row.actor_label}</p>
        {row.actor_source === "service_role" && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">サーバー経由</p>
        )}
      </div>

      <article className="min-w-0">
        <header className="flex flex-wrap items-center gap-2">
          <span className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${OPERATION_TONE[row.operation]}`}>
            {OPERATION_LABEL[row.operation]}
          </span>
          <h2 className="text-sm font-semibold text-foreground">{tableLabel(row.table_name)}</h2>
          {TABLE_LABELS[row.table_name] && (
            <span className="font-mono text-[10px] text-muted-foreground">{row.table_name}</span>
          )}
        </header>
        <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{recordKey(row.record_pk)}</p>

        <details className="mt-3" open={row.operation === "update" && row.changed_fields.length <= 4}>
          <summary className="cursor-pointer list-none text-xs font-semibold text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
            {row.operation === "update" ? `${row.changed_fields.length}項目の差分を見る` : `${OPERATION_LABEL[row.operation]}内容を見る`}
          </summary>
          <div className="mt-2">
            <DiffValues row={row} />
          </div>
        </details>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {row.undo_of_history_id || row.undone_by_history_id ? (
            <span className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 text-xs font-semibold text-muted-foreground" title={row.undone_at ? `戻し日時: ${formatDate(row.undone_at)}` : "この履歴は戻し操作済み"}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />戻し済み
            </span>
          ) : row.undo_supported ? (
            <button
              type="button"
              onClick={() => onUndo(row)}
              disabled={undoing}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-wait disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              {undoing ? "戻し中…" : "この変更を戻す"}
            </button>
          ) : (
            <button
              type="button"
              disabled
              title={row.undo_block_reason ?? "この変更は戻せない"}
              aria-label={row.undo_block_reason ?? "この変更は戻せない"}
              className="inline-flex min-h-9 items-center rounded-md border border-border bg-muted/30 px-3 text-xs text-muted-foreground disabled:cursor-not-allowed disabled:opacity-100"
            >
              戻せない: {row.undo_block_reason ?? "安全条件を満たさない"}
            </button>
          )}
        </div>
      </article>
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
    const confirmed = window.confirm(
      `${tableLabel(row.table_name)}の変更を戻す？\n\n現在値が履歴の変更後と一致する場合だけ実行する。戻し操作も新しい履歴として残る。`,
    );
    if (!confirmed) return;
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
        setError(payload.reason || (payload.error === "undo_conflict"
          ? "現在値が変わっているため、安全のため戻さなかった"
          : "変更を戻せなかった"));
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
    if (!needle) return rows;
    return rows.filter((row) => [
      row.table_name,
      tableLabel(row.table_name),
      row.actor_label,
      ...row.changed_fields,
      recordKey(row.record_pk),
    ].some((value) => value.toLowerCase().includes(needle)));
  }, [rows, search]);

  const chooseOperation = (next: "" | Operation) => {
    setOperation(next);
    setPage(0);
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] px-0 py-0 sm:px-2">
      <header className="border-b border-border/70 pb-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-sky-200 bg-sky-50 text-sky-800">
            <DatabaseZap className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-sky-800">管理 / 監査</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">データ変更履歴</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              OSの各画面・アプリ・自動処理から行われた変更を、実行者・日時・対象・変更前後のセットで確認する。
            </p>
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-10 mx-0 border-b border-border/70 bg-background/95 px-0 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1" role="group" aria-label="操作の絞り込み">
            {(["", "insert", "update", "delete"] as const).map((value) => (
              <button
                key={value || "all"}
                type="button"
                onClick={() => chooseOperation(value)}
                className={`min-h-11 rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 md:min-h-9 ${operation === value ? "bg-sky-800 text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                {value ? OPERATION_LABEL[value] : "すべて"}
              </button>
            ))}
          </div>
          <label className="relative block min-w-0 lg:w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">表示中の履歴を検索</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="実行者・対象・項目で検索"
              className="min-h-11 w-full rounded-md border border-border bg-muted/30 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-border/70 py-3 text-xs text-muted-foreground">
        <span>{new Intl.NumberFormat("ja-JP").format(total)}件</span>
        <span>新しい順</span>
      </div>

      {message && <div role="status" className="my-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">変更履歴を読み込み中…</div>
      ) : error ? (
        <div role="alert" className="my-5 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : filteredRows.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">該当する変更履歴はない</div>
      ) : (
        <ul className="divide-y divide-border/70">
          {filteredRows.map((row) => <HistoryItem key={row.id} row={row} onUndo={undo} undoing={undoingId === row.id} />)}
        </ul>
      )}

      <nav aria-label="変更履歴のページ" className="flex items-center justify-between border-t border-border/70 py-5">
        <button
          type="button"
          disabled={page === 0 || loading}
          onClick={() => setPage((value) => Math.max(0, value - 1))}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />前の80件
        </button>
        <span className="text-xs text-muted-foreground">{page + 1}ページ</span>
        <button
          type="button"
          disabled={!hasMore || loading}
          onClick={() => setPage((value) => value + 1)}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          次の80件<ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}
