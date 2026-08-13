// 機関ワークスペース「業務デスク」データアクセス層
// - 読み取り/書き込みとも authenticated browser client (RLS: is_admin() の admin FOR ALL)
// - design/db_schema.md の workspace_work_cases / workspace_work_case_deadlines が正本。
//   列名は migration 270 (scripts/migrations/270_workspace_work_desk.sql) を必ず参照すること。

import { createClient as createBrowserSupabase } from "@/lib/supabase/client";

function getClient() {
  return createBrowserSupabase();
}

export type WorkDeskDataStatus = "unconfirmed" | "confirmed" | "stale";
export type WorkDeskDeadlinePrecision = "day" | "month" | "vague";
export type WorkDeskDeadlineStatus = "unconfirmed" | "upcoming" | "done" | "passed" | "cancelled";

export type WorkspaceWorkCase = {
  id: string;
  workspaceId: string;
  caseCode: string;
  title: string;
  domain: string;
  caseKind: string | null;
  statusLabel: string | null;
  frequencyDeadlineNote: string | null;
  stakeholders: string | null;
  nextAction: string | null;
  waitingOn: string | null;
  waitingSince: string | null;
  notes: string | null;
  dataStatus: WorkDeskDataStatus;
  sourceNote: string | null;
  lastConfirmedAt: string | null;
  priorityWave: number | null;
  sortOrder: number | null;
  archivedAt: string | null;
};

export type WorkspaceWorkCaseDeadline = {
  id: string;
  caseId: string;
  label: string;
  dueDate: string | null;
  duePrecision: WorkDeskDeadlinePrecision;
  status: WorkDeskDeadlineStatus;
  sortOrder: number | null;
};

export type WorkDeskWorkspace = {
  id: string;
  slug: string;
  name: string;
  institutionId: string;
};

export type WorkDeskBundle = {
  workspace: WorkDeskWorkspace;
  cases: WorkspaceWorkCase[];
  deadlines: WorkspaceWorkCaseDeadline[];
};

type WorkspaceRow = { id: string; slug: string; name: string; institution_id: string };

type CaseRow = {
  id: string;
  workspace_id: string;
  case_code: string;
  title: string;
  domain: string;
  case_kind: string | null;
  status_label: string | null;
  frequency_deadline_note: string | null;
  stakeholders: string | null;
  next_action: string | null;
  waiting_on: string | null;
  waiting_since: string | null;
  notes: string | null;
  data_status: WorkDeskDataStatus;
  source_note: string | null;
  last_confirmed_at: string | null;
  priority_wave: number | null;
  sort_order: number | null;
  archived_at: string | null;
};

type DeadlineRow = {
  id: string;
  case_id: string;
  label: string;
  due_date: string | null;
  due_precision: WorkDeskDeadlinePrecision;
  status: WorkDeskDeadlineStatus;
  sort_order: number | null;
};

function mapCase(row: CaseRow): WorkspaceWorkCase {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    caseCode: row.case_code,
    title: row.title,
    domain: row.domain,
    caseKind: row.case_kind,
    statusLabel: row.status_label,
    frequencyDeadlineNote: row.frequency_deadline_note,
    stakeholders: row.stakeholders,
    nextAction: row.next_action,
    waitingOn: row.waiting_on,
    waitingSince: row.waiting_since,
    notes: row.notes,
    dataStatus: row.data_status,
    sourceNote: row.source_note,
    lastConfirmedAt: row.last_confirmed_at,
    priorityWave: row.priority_wave,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
  };
}

function mapDeadline(row: DeadlineRow): WorkspaceWorkCaseDeadline {
  return {
    id: row.id,
    caseId: row.case_id,
    label: row.label,
    dueDate: row.due_date,
    duePrecision: row.due_precision,
    status: row.status,
    sortOrder: row.sort_order,
  };
}

/**
 * institutionId (institutions.institution_id, 例 'inst_ehime') から
 * institution_workspaces を引き、紐づく業務ケース + 締切一式を返す。
 * ワークスペースが無ければ null (呼び出し側で空状態を出す)。
 */
export async function fetchWorkDeskBundle(institutionId: string): Promise<WorkDeskBundle | null> {
  const client = getClient();

  const { data: workspaceRow, error: workspaceError } = await client
    .from("institution_workspaces")
    .select("id, slug, name, institution_id")
    .eq("institution_id", institutionId)
    .maybeSingle<WorkspaceRow>();

  if (workspaceError) throw new Error(`workspace lookup failed: ${workspaceError.message}`);
  if (!workspaceRow) return null;

  const { data: caseRows, error: caseError } = await client
    .from("workspace_work_cases")
    .select(
      "id, workspace_id, case_code, title, domain, case_kind, status_label, frequency_deadline_note, stakeholders, next_action, waiting_on, waiting_since, notes, data_status, source_note, last_confirmed_at, priority_wave, sort_order, archived_at",
    )
    .eq("workspace_id", workspaceRow.id)
    .order("domain", { ascending: true })
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("case_code", { ascending: true })
    .returns<CaseRow[]>();

  if (caseError) throw new Error(`work case fetch failed: ${caseError.message}`);

  const caseIds = (caseRows ?? []).map((row) => row.id);
  let deadlineRows: DeadlineRow[] = [];
  if (caseIds.length > 0) {
    const { data, error: deadlineError } = await client
      .from("workspace_work_case_deadlines")
      .select("id, case_id, label, due_date, due_precision, status, sort_order")
      .in("case_id", caseIds)
      .order("due_date", { ascending: true, nullsFirst: false })
      .returns<DeadlineRow[]>();
    if (deadlineError) throw new Error(`work case deadline fetch failed: ${deadlineError.message}`);
    deadlineRows = data ?? [];
  }

  return {
    workspace: {
      id: workspaceRow.id,
      slug: workspaceRow.slug,
      name: workspaceRow.name,
      institutionId: workspaceRow.institution_id,
    },
    cases: (caseRows ?? []).map(mapCase),
    deadlines: deadlineRows.map(mapDeadline),
  };
}

export type WorkCaseEditableFields = Pick<
  WorkspaceWorkCase,
  "nextAction" | "waitingOn" | "waitingSince" | "notes" | "dataStatus" | "lastConfirmedAt"
>;

/** ケース編集パネルからの更新。data_status を confirmed にして last_confirmed_at 未入力なら今日を自動セット。 */
export async function updateWorkCase(
  caseId: string,
  patch: Partial<WorkCaseEditableFields>,
): Promise<void> {
  const client = getClient();
  const nextPatch: Record<string, unknown> = {};
  if ("nextAction" in patch) nextPatch.next_action = patch.nextAction || null;
  if ("waitingOn" in patch) nextPatch.waiting_on = patch.waitingOn || null;
  if ("waitingSince" in patch) nextPatch.waiting_since = patch.waitingSince || null;
  if ("notes" in patch) nextPatch.notes = patch.notes || null;
  if ("lastConfirmedAt" in patch) nextPatch.last_confirmed_at = patch.lastConfirmedAt || null;
  if ("dataStatus" in patch && patch.dataStatus) {
    nextPatch.data_status = patch.dataStatus;
    if (patch.dataStatus === "confirmed" && !patch.lastConfirmedAt) {
      nextPatch.last_confirmed_at = new Date().toISOString().slice(0, 10);
    }
  }

  const { error } = await client.from("workspace_work_cases").update(nextPatch).eq("id", caseId);
  if (error) throw new Error(`work case update failed: ${error.message}`);
}

/** 期限レーダーのインライン状態変更。 */
export async function updateWorkCaseDeadlineStatus(
  deadlineId: string,
  status: WorkDeskDeadlineStatus,
): Promise<void> {
  const client = getClient();
  const { error } = await client
    .from("workspace_work_case_deadlines")
    .update({ status })
    .eq("id", deadlineId);
  if (error) throw new Error(`deadline status update failed: ${error.message}`);
}

export type NewWorkCaseDeadline = {
  label: string;
  dueDate: string | null;
  duePrecision: WorkDeskDeadlinePrecision;
};

/** ケース編集パネルからの締切追加。 */
export async function insertWorkCaseDeadline(
  caseId: string,
  input: NewWorkCaseDeadline,
): Promise<WorkspaceWorkCaseDeadline> {
  const client = getClient();
  const { data, error } = await client
    .from("workspace_work_case_deadlines")
    .insert({
      case_id: caseId,
      label: input.label,
      due_date: input.dueDate || null,
      due_precision: input.duePrecision,
      status: "unconfirmed",
    })
    .select("id, case_id, label, due_date, due_precision, status, sort_order")
    .single<DeadlineRow>();
  if (error) throw new Error(`deadline insert failed: ${error.message}`);
  return mapDeadline(data);
}
