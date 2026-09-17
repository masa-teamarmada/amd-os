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

const TABLE_LABELS: Record<string, string> = {
  projects: "PJ台帳",
  members: "メンバー台帳",
  project_members: "PJメンバー",
  project_management_tasks: "PJタスク",
  project_questions: "論点",
  project_question_actions: "TODO",
  project_meeting_summaries: "会議記録",
  project_management_field_audit: "PJ変更記録",
  workspace_documents: "ワークスペース資料",
  institution_workspace_memberships: "研究機関ワークスペース権限",
  project_access_memberships: "個別PJ権限",
  workspace_user_accounts: "外部アカウント",
  value_milestones: "マイルストーン",
  milestone_monthly_progress: "月次進捗",
  project_actions: "PJアクション",
  company_schedule_occurrences: "管理予定",
  company_payment_obligations: "支払予定",
};

const FIELD_LABELS: Record<string, string> = {
  title: "タスク名",
  task_name: "タスク名",
  status: "状態",
  progress_pct: "進捗",
  date_certainty: "日付確度",
  date_precision: "日付確度",
  deadline_precision: "期限精度",
  owner_label: "担当",
  owner_member_id: "担当者",
  last_login_at: "最終ログイン",
  last_verified_at: "最終確認",
  version: "版",
  updated_by: "更新者",
  created_by: "作成者",
  name: "名称",
  project_name: "PJ名",
  code_name: "コード名",
  planned_start: "予定開始",
  planned_end: "予定終了",
  start_date: "開始日",
  end_date: "終了日",
  actual_end: "完了日",
  next_deliverable: "次の成果物",
  blocker: "阻害要因",
  completion_criteria: "完了条件",
  forecast_end: "見込み完了日",
  forecast_change_reason: "見込み変更理由",
  goal: "目的",
  track: "区分",
  confidence: "確度",
  sort_order: "表示順",
  source_kind: "入力元",
  milestone_id: "マイルストーン",
  description: "内容",
  source_ref: "根拠",
  email: "メールアドレス",
  role: "権限",
  active: "有効",
  is_admin: "管理者",
  field_name: "項目",
  old_value: "変更前",
  new_value: "変更後",
  project_id: "PJ",
  entity_id: "対象",
  current_version: "現行版",
  generation_state: "生成状態",
  generated_at: "生成日時",
  last_seen_at: "最終確認日時",
  lifecycle_status: "有効状態",
  superseded_at: "旧版化日時",
  source_observed_at: "元データ確認日時",
  source_fingerprint: "元データ識別子",
  amount_yen: "金額",
  due_on: "期日",
  due_ym: "対象月",
  category: "分類",
};

const VALUE_LABELS: Record<string, string> = {
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
  active: "有効",
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
  return TABLE_LABELS[table] ?? table;
}

export function fieldLabel(field: string) {
  return FIELD_LABELS[field] ?? field.replaceAll("_", " ");
}

export function displayValue(value: unknown, maxLength = 80): string {
  if (value === null) return "未設定";
  if (value === undefined) return "—";
  if (typeof value === "boolean") return value ? "はい" : "いいえ";
  if (typeof value === "string") {
    const label = VALUE_LABELS[value] ?? value;
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

function values(row: ChangeHistoryRow) {
  return row.operation === "delete" ? row.before_values : row.after_values;
}

function projectKey(row: ChangeHistoryRow) {
  const value = values(row);
  return value.project_id ?? row.record_pk.project_id ?? null;
}

export function targetLabel(row: ChangeHistoryRow) {
  const value = values(row);
  const project = row.project_label || value.project_id || row.record_pk.project_id;
  const entity = value.entity_id || row.record_pk.entity_id;
  const field = value.field_name;
  return [project ? String(project) : null, row.entity_label || (entity ? `対象 ${displayValue(entity, 28)}` : null), field ? `項目 ${fieldLabel(String(field))}` : null]
    .filter(Boolean)
    .join(" · ") || recordKey(row.record_pk);
}

export function recordKey(recordPk: Record<string, unknown>) {
  const entries = Object.entries(recordPk);
  if (entries.length === 0) return "行ID未取得";
  return entries.map(([key, value]) => `${key}: ${displayValue(value, 40)}`).join(" / ");
}

function changedFields(row: ChangeHistoryRow) {
  if (row.operation === "update") return row.changed_fields;
  return Object.keys(values(row)).filter((key) => !["created_at", "updated_at"].includes(key));
}

export function displayFieldValue(field: string, value: unknown, options: DisplayFieldValueOptions = {}) {
  if (isDateField(field, value)) {
    const renderedDate = formatAuditDateTime(value, {
      includeMilliseconds: needsMilliseconds(value, options.compareWith),
    });
    if (renderedDate) return renderedDate;
  }
  const rendered = displayValue(value);
  return field === "progress_pct" && value !== null && value !== undefined ? `${rendered}%` : rendered;
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
  if (rows.length > 0 && rows.every(isMemberLastLoginRow)) return memberLastLoginSummary(rows);
  const first = rows[0];
  const projectKeys = new Set(rows.map(projectKey));
  const value = values(first);
  const project = projectKeys.size === 1 ? first.project_label || value.project_id || first.record_pk.project_id : null;
  const prefix = project ? `${String(project)} ` : "";
  const counts = rows.reduce<Record<ChangeHistoryOperation, number>>((result, row) => {
    result[row.operation] += 1;
    return result;
  }, { insert: 0, update: 0, delete: 0 });
  const parts = [
    counts.insert ? `追加${counts.insert}` : null,
    counts.update ? `変更${counts.update}` : null,
    counts.delete ? `削除${counts.delete}` : null,
  ].filter(Boolean);
  const action = parts.length === 1
    ? first.operation === "insert" ? "追加" : first.operation === "delete" ? "削除" : "変更"
    : `一括処理（${parts.join("・")}）`;
  return `${prefix}${tableLabel(first.table_name)}を${rows.length}件${action}`;
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
  const project = row.project_label || value.project_id || row.record_pk.project_id;
  const prefix = project ? `${String(project)} ` : "";
  const subject = row.entity_label
    ? `${tableLabel(row.table_name)}「${displayValue(row.entity_label, 60)}」`
    : tableLabel(row.table_name);
  if (row.table_name === "project_management_field_audit") {
    const field = value.field_name ? fieldLabel(String(value.field_name)) : "項目";
    return `${prefix}${field}: ${displayValue(value.old_value)} → ${displayValue(value.new_value)}`;
  }
  const fields = changedFields(row);
  const first = fields[0];
  if (row.operation === "update" && first) {
    const changes = fields.slice(0, 2).map((field) => `${fieldLabel(field)}: ${displayFieldValue(field, row.before_values[field])} → ${displayFieldValue(field, row.after_values[field])}`);
    const more = fields.length > changes.length ? ` ほか${fields.length - changes.length}項目` : "";
    return `${prefix}${subject} ${changes.join(" ／ ")}${more}`;
  }
  const action = row.operation === "insert" ? "追加" : "削除";
  const nameField = ["title", "name", "project_name", "code_name", "task_name"].find((field) => value[field] !== undefined && value[field] !== null && value[field] !== "");
  if (nameField) return `${prefix}${tableLabel(row.table_name)}「${displayValue(value[nameField], 60)}」を${action}`;
  const field = first ? fieldLabel(first) : tableLabel(row.table_name);
  return `${prefix}${subject}を${action}（${field}）`;
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
      && previous.actor_label === row.actor_label
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
      && previous.actor_label === row.actor_label
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
      previous.target = sameAutomaticBatch ? "同じ自動処理として集約" : "同じ一括処理として集約";
      continue;
    }
    groups.push({
      id: row.id,
      rows: [row],
      occurred_at: row.occurred_at,
      last_occurred_at: row.occurred_at,
      actor_label: row.actor_label,
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
    summaryForRow(row), targetLabel(row), row.table_name, tableLabel(row.table_name), row.actor_label,
    ...row.changed_fields.map(fieldLabel), recordKey(row.record_pk),
  ].join(" ").toLowerCase();
}

export function fieldsFor(row: ChangeHistoryRow) {
  return changedFields(row);
}
