import catalog from "./change-history-catalog.json" with { type: "json" };

export type ChangeHistoryOperation = "insert" | "update" | "delete";

export type ChangeHistoryRow = {
  id: string;
  occurred_at: string;
  table_name: string;
  operation: ChangeHistoryOperation;
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
  record_context?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
  reference_labels?: Record<string, string>;
  actor_display_label?: string;
  entity_label_source?: "recorded" | "current" | "unavailable";
  project_label?: string | null;
  entity_label?: string | null;
};

export type DisplayFieldValueOptions = {
  compareWith?: unknown;
};

export type ChangeHistoryGroup = {
  id: string;
  rows: ChangeHistoryRow[];
  occurred_at: string;
  last_occurred_at: string;
  actor_label: string;
  actor_source: string;
  table_name: string;
  transaction_id: number;
  summary: string;
  target: string;
  grouping: "single" | "transaction" | "automatic_batch";
};

const TABLE_LABELS: Record<string, string> = Object.fromEntries(Object.entries(catalog.tables).map(([key, value]) => [key, value.label]));
const FIELD_LABELS: Record<string, string> = catalog.fields;

const VALUE_LABELS: Record<string, string> = {
  ...catalog.values,
  pending: "待機中", queued: "待機中", processing: "処理中", running: "実行中", claimed: "処理中",
  sent: "送信済み", delivered: "配信済み", failed: "失敗", skipped: "見送り", suppressed: "通知抑止",
  retry: "再試行待ち", expired: "期限切れ", draft: "下書き", ready: "準備完了", paused: "休止中",
  rejected: "却下", accepted: "採用済み", reviewed: "確認済み", needs_review: "確認待ち",
  manual: "手動", automatic: "自動", automation: "自動処理", system: "システム", user: "利用者",
  readonly: "閲覧のみ", editor: "編集者", admin: "管理者", owner: "管理責任者",
  insert: "追加", update: "変更", delete: "削除", service_role: "OS自動処理",
  true: "はい", false: "いいえ", enabled: "有効", disabled: "無効", yes: "はい", no: "いいえ",
  baseline: "基準時刻", report: "報告", reported: "報告済み", discord: "Discord", app: "アプリ",
  active: "有効",
  tentative: "仮",
  confirmed: "確定",
  uncertain: "不確定",
  provisional: "仮",
  on_track: "順調",
  unknown: "未確認",
  not_started: "未着手",
  in_progress: "進行中",
  completed: "完了",
  done: "完了",
  blocked: "停止中",
  inactive: "無効",
  invited: "招待中",
  suspended: "停止",
  revoked: "剥奪",
  open: "未完了",
  approved: "承認済み",
  cancelled: "中止",
  generated: "生成済み",
  superseded: "旧版",
  needs_source: "根拠待ち",
};

export function tableLabel(table: string) {
  return TABLE_LABELS[table] ?? "追加されたデータ（表示名未登録）";
}

export function fieldLabel(field: string) {
  return FIELD_LABELS[field] ?? "追加された項目（表示名未登録）";
}

export function displayValue(value: unknown, maxLength = 80): string {
  if (value === null) return "未設定";
  if (value === undefined) return "—";
  if (typeof value === "boolean") return value ? "はい" : "いいえ";
  if (typeof value === "string") {
    const label = isOpaqueValue(value) ? "参照先の名称未記録" : value.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "参照先の番号");
    return label.length > maxLength ? `${label.slice(0, maxLength)}…` : label || "空欄";
  }
  if (typeof value === "number") return new Intl.NumberFormat("ja-JP").format(value);
  try {
    const text = JSON.stringify(value);
    return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
  } catch {
    return String(value);
  }
}

const JST_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const JST_DATE_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function isDateOnlyValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isDateField(field: string, value: unknown) {
  if (typeof value !== "string") return false;
  const normalized = field.toLowerCase();
  return /(^|_)(at|on|date)$/.test(normalized) || /t\d{2}:\d{2}/i.test(value);
}

function parsedDate(value: unknown) {
  if (typeof value !== "string" || isDateOnlyValue(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function needsMilliseconds(value: unknown, compareWith: unknown) {
  const current = parsedDate(value);
  const other = parsedDate(compareWith);
  if (!current || !other) return false;
  return Math.floor(current.getTime() / 1000) === Math.floor(other.getTime() / 1000)
    && current.getMilliseconds() !== other.getMilliseconds();
}

/** 監査画面の日時は、入力値のoffsetにかかわらず日本時間だけで読む。 */
export function formatAuditDateTime(value: unknown, options: { includeSeconds?: boolean; includeMilliseconds?: boolean } = {}) {
  if (typeof value !== "string") return null;
  if (isDateOnlyValue(value)) {
    const date = new Date(`${value}T00:00:00+09:00`);
    return Number.isFinite(date.getTime()) ? JST_DATE_FORMATTER.format(date) : null;
  }
  const date = parsedDate(value);
  if (!date) return null;
  const includeSeconds = options.includeSeconds ?? true;
  const base = includeSeconds
    ? JST_DATE_TIME_FORMATTER.format(date)
    : new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  return options.includeMilliseconds ? `${base}.${String(date.getMilliseconds()).padStart(3, "0")}` : base;
}

export function historyContext(row: ChangeHistoryRow) {
  return row.record_context?.[row.operation === "delete" ? "before" : "after"] ?? {};
}

function values(row: ChangeHistoryRow) {
  return { ...historyContext(row), ...(row.operation === "delete" ? row.before_values : row.after_values) };
}

function projectKey(row: ChangeHistoryRow) {
  return values(row).project_id ?? row.record_pk.project_id ?? null;
}

export function isOpaqueValue(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value) || /^[0-9a-f]{32,}$/i.test(value);
}

export function actorLabel(row: ChangeHistoryRow) {
  if (row.actor_display_label) return row.actor_display_label;
  return isOpaqueValue(row.actor_label) ? "実行者の名前未記録" : row.actor_label;
}

export function targetLabel(row: ChangeHistoryRow) {
  const value = values(row);
  const project = row.project_label || value.project_id || row.record_pk.project_id;
  const name = row.entity_label || ["title", "name", "display_name", "member_name", "project_name", "task_name", "item_title", "title_snapshot", "short_name", "code_name"]
    .map((field) => value[field]).find((v) => typeof v === "string" && v.trim() && !isOpaqueValue(v));
  const period = value.week_start || value.ym;
  return [project ? displayValue(project, 100) : null, name ? displayValue(name, 160) : null,
    period ? `対象：${displayFieldValue(value.week_start ? "week_start" : "ym", period)}` : null]
    .filter(Boolean).join(" · ") || `${tableLabel(row.table_name)}（対象名の記録なし）`;
}

/** 原値は「記録情報」に限定する。 */
export function recordKey(recordPk: Record<string, unknown>) {
  const entries = Object.entries(recordPk);
  if (entries.length === 0) return "行ID未取得";
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" / ");
}

function changedFields(row: ChangeHistoryRow) {
  return row.operation === "update" ? row.changed_fields : Object.keys(row.operation === "delete" ? row.before_values : row.after_values)
    .filter((key) => !["created_at", "updated_at"].includes(key));
}

export function isRecordField(field: string) {
  return /^(id|revision|report_revision|schedule_revision|version|transaction_id|source_fingerprint|source_dedupe_key)$/.test(field)
    || /(_hash|_sha256|_fingerprint|_token|_ciphertext)$/.test(field);
}

export function displayFieldValue(field: string, value: unknown, options: DisplayFieldValueOptions = {}): string {
  if (isDateField(field, value) || (typeof value === "string" && isDateOnlyValue(value))) {
    const rendered = formatAuditDateTime(value, { includeMilliseconds: needsMilliseconds(value, options.compareWith) });
    if (rendered) return rendered;
  }
  if (Array.isArray(value)) return value.length ? value.map((v) => displayFieldValue(field, v)).join("、") : "なし";
  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, v]) => `${fieldLabel(key)}：${displayFieldValue(key, v)}`).join(" ／ ") || "なし";
  }
  if (typeof value === "string") {
    if (field === "field_name") return fieldLabel(value);
    if (field === "table_name") return tableLabel(value);
    if (catalog.enumFields.includes(field) || /(^|_)(status|state|role|kind|type)$/.test(field)) {
      return VALUE_LABELS[value] ?? (/^[a-z]+(?:_[a-z0-9]+)+$/.test(value) ? "新しい値（表示名未登録）" : displayValue(value, 600));
    }
  }
  const rendered = displayValue(value, 600);
  return field === "progress_pct" && value != null ? `${rendered}%` : rendered;
}

export function rowFieldValue(row: ChangeHistoryRow, field: string, value: unknown, compareWith?: unknown) {
  return row.reference_labels?.[`${field}:${String(value)}`] ?? displayFieldValue(field, value, { compareWith });
}

function subject(row: ChangeHistoryRow) {
  const name = targetLabel(row);
  return name === `${tableLabel(row.table_name)}（対象名の記録なし）` ? name : `${tableLabel(row.table_name)}「${name}」`;
}

function priorityFields(row: ChangeHistoryRow) {
  const fields = changedFields(row);
  const priority = ["status", "title", "name", "progress_pct", "next_spawn_at", "accepted_report_id", "scheduled_for", "planned_end", "due_on", "amount_yen"];
  return [...fields].sort((a, b) => {
    const score = (f: string) => isRecordField(f) || /^(metadata|payload|raw_meta)/.test(f) ? 1000 : priority.includes(f) ? priority.indexOf(f) : /(_at|_id)$/.test(f) ? 100 : 50;
    return score(a) - score(b);
  });
}

function changeText(row: ChangeHistoryRow, field: string) {
  const short = (value: string) => value.length > 100 ? `${value.slice(0, 100)}…` : value;
  return `${fieldLabel(field)}: ${short(rowFieldValue(row, field, row.before_values[field], row.after_values[field]))} → ${short(rowFieldValue(row, field, row.after_values[field], row.before_values[field]))}`;
}

function memberId(row: ChangeHistoryRow) {
  const value = values(row);
  const id = row.record_pk.member_id ?? value.member_id ?? row.record_pk.id ?? value.id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function isMemberLastLoginRow(row: ChangeHistoryRow) {
  return row.table_name === "members"
    && row.operation === "update"
    && row.changed_fields.length === 1
    && row.changed_fields[0] === "last_login_at";
}

function isMembersRow(row: ChangeHistoryRow) {
  return row.table_name === "members";
}

function memberSubject(row: ChangeHistoryRow) {
  const value = values(row);
  const label = row.entity_label || value.member_name || value.code_name;
  const id = memberId(row);
  const renderedLabel = label ? displayValue(label, 60) : null;
  if (renderedLabel) return renderedLabel;
  const humanReadableId = id && !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id) ? displayValue(id, 32) : null;
  return humanReadableId ? `メンバー（${humanReadableId}）` : "メンバー（氏名未登録）";
}

function memberLastLoginSummary(rows: ChangeHistoryRow[]) {
  const ordered = rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => occurredAtMs(left.row) - occurredAtMs(right.row) || left.index - right.index)
    .map(({ row }) => row);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const before = first.before_values.last_login_at;
  const after = last.after_values.last_login_at;
  const beforeText = displayFieldValue("last_login_at", before, { compareWith: after });
  const afterText = displayFieldValue("last_login_at", after, { compareWith: before });
  const count = rows.length;
  return `メンバー「${memberSubject(first)}」の最終ログインを${count}回更新：${beforeText} → ${afterText}`;
}

function batchSummary(rows: ChangeHistoryRow[]) {
  if (rows.every(isMemberLastLoginRow)) return memberLastLoginSummary(rows);
  const first = rows[0];
  const action = first.operation === "insert" ? "追加" : first.operation === "delete" ? "削除" : "変更";
  if (first.operation !== "update") return `${tableLabel(first.table_name)}を${rows.length}件${action}`;
  // 同じ処理でも内容が異なる場合は、差分の種類と件数を必ず残す。
  const patterns = new Map<string, number>();
  for (const row of rows) {
    const fields = priorityFields(row);
    const text = fields.slice(0, 2).map((f) => changeText(row, f)).join(" ／ ") + (fields.length > 2 ? ` ほか${fields.length - 2}項目` : "");
    patterns.set(text || "変更項目の記録なし", (patterns.get(text || "変更項目の記録なし") ?? 0) + 1);
  }
  const changes = [...patterns].slice(0, 3).map(([text, count]) => `${text}（${count}件）`).join(" ／ ");
  return `${tableLabel(first.table_name)}を${rows.length}件変更：${changes}${patterns.size > 3 ? ` ／ ほか${patterns.size - 3}種類の変更` : ""}`;
}

const AUTOMATIC_BATCH_MAX_GAP_MS = 1_000;

function occurredAtMs(row: ChangeHistoryRow) {
  const value = Date.parse(row.occurred_at);
  return Number.isFinite(value) ? value : 0;
}

export function summaryForRow(row: ChangeHistoryRow) {
  if (isMemberLastLoginRow(row)) {
    const before = row.before_values.last_login_at;
    const after = row.after_values.last_login_at;
    return `メンバー「${memberSubject(row)}」の最終ログイン：${displayFieldValue("last_login_at", before, { compareWith: after })} → ${displayFieldValue("last_login_at", after, { compareWith: before })}`;
  }
  const value = values(row);
  if (row.table_name === "project_management_field_audit") {
    const field = value.field_name ? fieldLabel(String(value.field_name)) : "項目";
    return `${targetLabel(row)} ${field}: ${displayFieldValue(String(value.field_name ?? ""), value.old_value)} → ${displayFieldValue(String(value.field_name ?? ""), value.new_value)}`;
  }
  if (row.operation !== "update") return `${subject(row)}を${row.operation === "insert" ? "追加" : "削除"}`;
  const fields = priorityFields(row);
  const changes = fields.slice(0, 2).map((field) => changeText(row, field));
  return `${subject(row)} ${changes.join(" ／ ") || "変更項目の記録なし"}${fields.length > 2 ? ` ほか${fields.length - 2}項目` : ""}`;
}

export function groupHistoryRows(rows: ChangeHistoryRow[]): ChangeHistoryGroup[] {
  const groups: ChangeHistoryGroup[] = [];
  for (const row of rows) {
    const previous = groups[groups.length - 1];
    const previousMemberId = previous ? memberId(previous.rows[0]) : null;
    const currentMemberId = isMembersRow(row) ? memberId(row) : null;
    const sameMember = previous && isMembersRow(previous.rows[0]) && currentMemberId !== null
      && previousMemberId === currentMemberId;
    const sameTransaction = previous
      && previous.transaction_id === row.transaction_id
      && previous.actor_label === actorLabel(row)
      && previous.rows[0].actor_id === row.actor_id
      && previous.table_name === row.table_name
      && previous.rows[0].operation === row.operation
      && projectKey(previous.rows[0]) === projectKey(row)
      && (!isMembersRow(previous.rows[0]) || sameMember);
    const previousRow = previous?.rows[previous.rows.length - 1];
    // service_roleのバッチは1行ずつ別transactionになる処理がある。
    // 表示上だけ、同じ実行者・tableで連続した処理をまとめる。戻し操作は詳細内で1件ずつ行う。
    const sameAutomaticBatch = previous
      && previousRow
      && previousRow.actor_source === "service_role"
      && row.actor_source === "service_role"
      && previous.actor_label === actorLabel(row)
      && previous.rows[0].actor_id === row.actor_id
      && previous.table_name === row.table_name
      && previous.rows[0].operation === row.operation
      && projectKey(previous.rows[0]) === projectKey(row)
      && Math.abs(occurredAtMs(previousRow) - occurredAtMs(row)) <= AUTOMATIC_BATCH_MAX_GAP_MS
      && (!isMembersRow(previousRow)
        || (isMemberLastLoginRow(previousRow)
          && isMemberLastLoginRow(row)
          && memberId(previousRow) !== null
          && memberId(previousRow) === memberId(row)));
    if (sameTransaction || sameAutomaticBatch) {
      previous.rows.push(row);
      previous.last_occurred_at = row.occurred_at;
      previous.summary = batchSummary(previous.rows);
      previous.grouping = sameAutomaticBatch ? "automatic_batch" : "transaction";
      const targets = [...new Set(previous.rows.map(targetLabel))];
      const parts = targets[0].split(" / ");
      while (parts.length && !targets.every((target) => target === parts.join(" / ") || target.startsWith(`${parts.join(" / ")} / `))) parts.pop();
      previous.target = parts.length ? parts.join(" / ") : targets.slice(0, 2).join(" ／ ") + (targets.length > 2 ? ` ほか${targets.length - 2}対象` : "");
      continue;
    }
    groups.push({
      id: row.id,
      rows: [row],
      occurred_at: row.occurred_at,
      last_occurred_at: row.occurred_at,
      actor_label: actorLabel(row),
      actor_source: row.actor_source,
      table_name: row.table_name,
      transaction_id: row.transaction_id,
      summary: summaryForRow(row),
      target: targetLabel(row),
      grouping: "single",
    });
  }
  return groups;
}

export function searchableText(row: ChangeHistoryRow) {
  return [
    summaryForRow(row), targetLabel(row), row.table_name, tableLabel(row.table_name), row.actor_label, actorLabel(row),
    ...row.changed_fields.map(fieldLabel), recordKey(row.record_pk),
  ].join(" ").toLowerCase();
}

export function fieldsFor(row: ChangeHistoryRow) {
  return priorityFields(row);
}
