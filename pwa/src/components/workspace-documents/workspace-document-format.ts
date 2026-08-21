/**
 * 資料室まわりの表示整形。
 *
 * 一覧 (WorkspaceDocumentRoom) と編集ページ (WorkspaceDocumentEditorWorkbench) の
 * 両方が同じ資料の同じ値を出すので、整形をここへ置いて食い違いを防ぐ。
 * 契約ロジックは `@/lib/workspace-documents-core` 側で、こちらは見た目だけを持つ。
 */

export function formatBytes(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "更新日不明";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

/** 版履歴は同じ日に何度も積むので、日付だけでは版を見分けられない。 */
export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日時不明";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
