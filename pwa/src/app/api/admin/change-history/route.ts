import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPERATIONS = new Set(["insert", "update", "delete"]);
// DB内部の一括生成は1行ずつ別transactionになるため、狭いraw pageだと同じ処理が
// 複数pageへ分断される。表示側で一括処理へ集約できる幅をまとめて返す。
const PAGE_SIZE = 1000;
const IN_FILTER_CHUNK_SIZE = 100;

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

async function resolveAdminActor(db: ReturnType<typeof createAdminClient>, email: string) {
  const { data, error } = await db
    .from("members")
    .select("member_id")
    .match({ email: email.toLowerCase(), status: "active", is_admin: true })
    .maybeSingle();
  if (error || !data?.member_id) return null;
  return data.member_id as string;
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const url = new URL(request.url);
  const operation = url.searchParams.get("operation") || "";
  const pageRaw = Number(url.searchParams.get("page") || "0");
  const page = Number.isInteger(pageRaw) && pageRaw >= 0 ? Math.min(pageRaw, 1000) : 0;
  if (operation && !OPERATIONS.has(operation)) {
    return NextResponse.json({ ok: false, error: "invalid_operation" }, { status: 400 });
  }

  const db = createAdminClient();
  let query = db
    .from("amd_os_data_change_history")
    .select(
      "id,occurred_at,table_name,operation,record_pk,actor_id,actor_label,actor_source,changed_fields,before_values,after_values,undo_supported,undo_block_reason,undo_of_history_id,transaction_id",
      { count: "exact" },
    )
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false });
  // field_auditはタスク編集画面の意味付け用ログで、DB triggerも同じ行を記録する。
  // 両方を表示すると本体変更が埋もれるため、追記専用の生ログを残したまま一覧から除く。
  query = query.neq("table_name", "project_management_field_audit");
  if (operation) query = query.eq("operation", operation);

  const from = page * PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) {
    console.error("[admin/change-history] load failed:", error.message);
    return NextResponse.json({ ok: false, error: "load_failed" }, { status: 500 });
  }

  const historyRows = (data ?? []) as Array<{
    id: string;
    table_name: string;
    record_pk?: Record<string, unknown>;
    before_values?: Record<string, unknown>;
    after_values?: Record<string, unknown>;
  }>;
  const historyIds = historyRows.map((row) => row.id).filter(Boolean);
  const undoneByHistoryId = new Map<string, { id: string; occurred_at: string }>();
  if (historyIds.length > 0) {
    const undoResults = await Promise.all(chunks(historyIds, IN_FILTER_CHUNK_SIZE).map((historyIdChunk) => db
      .from("amd_os_data_change_history")
      .select("id,undo_of_history_id,occurred_at")
      .in("undo_of_history_id", historyIdChunk)));
    const undoError = undoResults.find((result) => result.error)?.error;
    if (undoError) {
      console.error("[admin/change-history] undo links load failed:", undoError.message);
      return NextResponse.json({ ok: false, error: "load_failed" }, { status: 500 });
    }
    const undoRows = undoResults.flatMap((result) => result.data ?? []);
    for (const undoRow of undoRows as Array<{ id: string; undo_of_history_id: string | null; occurred_at: string }>) {
      if (undoRow.undo_of_history_id) {
        undoneByHistoryId.set(undoRow.undo_of_history_id, { id: undoRow.id, occurred_at: undoRow.occurred_at });
      }
    }
  }

  const entityMetadata = new Map<string, { label: string; projectId: string | null }>();
  const taskIds = historyRows
    .filter((row) => row.table_name === "project_management_tasks")
    .map((row) => row.record_pk?.id)
    .filter((value): value is string => typeof value === "string");
  const actionIds = historyRows
    .filter((row) => row.table_name === "project_actions")
    .map((row) => row.record_pk?.id)
    .filter((value): value is string => typeof value === "string");
  const [taskResult, actionResult] = await Promise.all([
    taskIds.length > 0
      ? db.from("project_management_tasks").select("id,title,project_id").in("id", [...new Set(taskIds)])
      : Promise.resolve({ data: [], error: null }),
    actionIds.length > 0
      ? db.from("project_actions").select("id,title,project_id").in("id", [...new Set(actionIds)])
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (taskResult.error || actionResult.error) {
    console.error("[admin/change-history] entity labels load failed:", taskResult.error?.message ?? actionResult.error?.message);
  }
  for (const task of (taskResult.data ?? []) as Array<{ id: string; title: string | null; project_id: string | null }>) {
    if (task.title) entityMetadata.set(`project_management_tasks:${task.id}`, { label: task.title, projectId: task.project_id });
  }
  for (const action of (actionResult.data ?? []) as Array<{ id: string; title: string | null; project_id: string | null }>) {
    if (action.title) entityMetadata.set(`project_actions:${action.id}`, { label: action.title, projectId: action.project_id });
  }

  const projectIds = [...new Set(historyRows.flatMap((row) => {
    const values = [row.record_pk, row.before_values, row.after_values];
    const recordId = typeof row.record_pk?.id === "string" ? row.record_pk.id : null;
    const entityProjectId = recordId ? entityMetadata.get(`${row.table_name}:${recordId}`)?.projectId : null;
    return [...values.flatMap((value) => value?.project_id), entityProjectId].filter((value): value is string => typeof value === "string");
  }))];
  const projectLabels = new Map<string, string>();
  if (projectIds.length > 0) {
    const { data: projects, error: projectsError } = await db
      .from("projects")
      .select("project_id,project_name")
      .in("project_id", projectIds);
    if (projectsError) {
      console.error("[admin/change-history] project labels load failed:", projectsError.message);
    } else {
      for (const project of (projects ?? []) as Array<{ project_id: string; project_name: string | null }>) {
        projectLabels.set(project.project_id, `${project.project_id}${project.project_name ? ` ${project.project_name}` : ""}`);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    rows: historyRows.map((row) => {
      const recordId = typeof row.record_pk?.id === "string" ? row.record_pk.id : null;
      const entity = recordId ? entityMetadata.get(`${row.table_name}:${recordId}`) : null;
      const projectId = [row.record_pk, row.before_values, row.after_values]
        .map((value) => value?.project_id)
        .find((value): value is string => typeof value === "string") ?? entity?.projectId;
      return {
        ...row,
        project_label: projectId ? projectLabels.get(projectId) ?? null : null,
        entity_label: entity?.label ?? null,
        undone_by_history_id: undoneByHistoryId.get(row.id)?.id ?? null,
        undone_at: undoneByHistoryId.get(row.id)?.occurred_at ?? null,
      };
    }),
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
    hasMore: from + PAGE_SIZE < (count ?? 0),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const action = (body as Record<string, unknown>).action;
  const historyId = (body as Record<string, unknown>).historyId;
  if (action !== "undo" || typeof historyId !== "string" || !/^[0-9a-f-]{36}$/i.test(historyId)) {
    return NextResponse.json({ ok: false, error: "invalid_undo_request" }, { status: 400 });
  }

  const db = createAdminClient();
  const actorMemberId = await resolveAdminActor(db, auth.user.email);
  if (!actorMemberId) {
    return NextResponse.json({ ok: false, error: "admin_actor_missing" }, { status: 403 });
  }

  const { data, error } = await db.rpc("amd_os_undo_data_change", {
    p_history_id: historyId,
    p_actor_member_id: actorMemberId,
  });
  if (error) {
    const message = error.message || "undo_failed";
    const status = /conflict|一致|存在|changed|primary key|identity|cannot be undone|戻せない/i.test(message) ? 409 : 500;
    console.error("[admin/change-history] undo failed:", message);
    return NextResponse.json({ ok: false, error: status === 409 ? "undo_conflict" : "undo_failed" }, { status });
  }
  const result = data as { ok?: boolean; conflict?: boolean; reason?: string; undoHistoryId?: string } | null;
  if (!result?.ok) {
    return NextResponse.json({ ok: false, error: result?.conflict ? "undo_conflict" : "undo_failed", reason: result?.reason }, { status: 409 });
  }
  return NextResponse.json({ ok: true, result });
}
