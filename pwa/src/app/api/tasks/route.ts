import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

const STATUSES = new Set(["pending", "todo", "doing", "done", "blocked", "review", "archived"]);
const PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

type TaskPayload = {
  taskId?: string;
  title?: string;
  description?: string | null;
  projectId?: string;
  assigneeMemberId?: string | null;
  status?: string;
  priority?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  progress?: number | string | null;
  parentTaskId?: string | null;
  mindmapX?: number | string | null;
  mindmapY?: number | string | null;
  active?: boolean;
  taskSource?: string | null;
  agentKind?: string | null;
  agentSessionId?: string | null;
  agentSessionUrl?: string | null;
  agentSessionLabel?: string | null;
};

type TaskRow = {
  task_id: string;
  parent_task_id: string | null;
};

type TaskAccessResult =
  | { ok: true; actor: string; accessKind: "user" | "agent"; errorResponse: null }
  | { ok: false; actor: null; accessKind: null; errorResponse: NextResponse };

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function cleanSourceToken(value: unknown, max = 80) {
  const text = cleanText(value, max);
  if (!text) return null;
  const token = text.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, max);
  return token || null;
}

function cleanSessionUrl(value: unknown) {
  const text = cleanText(value, 1000);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (["http:", "https:", "codex:", "claude:", "vscode:", "cursor:"].includes(url.protocol)) return text;
  } catch {
    return null;
  }
  return null;
}

function cleanTitle(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, max);
}

function cleanDate(value: unknown) {
  const text = cleanText(value, 10);
  if (!text) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function cleanNumber(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function cleanCoordinate(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(-5000, Math.min(5000, Math.round(n)));
}

async function requireTaskAccess(req: NextRequest): Promise<TaskAccessResult> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorization = req.headers.get("authorization") || "";
  if (cronSecret && authorization === `Bearer ${cronSecret}`) {
    const agent = cleanText(req.headers.get("x-amd-os-agent"), 120) || "eimi";
    return { ok: true, actor: `agent:${agent}`, accessKind: "agent", errorResponse: null };
  }

  const auth = await requireAuth();
  if (!auth.ok) {
    return { ok: false, actor: null, accessKind: null, errorResponse: auth.errorResponse };
  }
  return { ok: true, actor: auth.user.email, accessKind: "user", errorResponse: null };
}

function makeTaskId() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `task_${stamp}_${suffix}`;
}

function toClientTask(row: Record<string, unknown>) {
  return {
    id: row.id,
    taskId: row.task_id,
    title: row.title,
    description: row.description ?? "",
    projectId: row.project_id,
    assignee: row.assignee ?? "",
    assigneeMemberId: row.assignee_member_id ?? null,
    status: row.status ?? "todo",
    priority: row.priority ?? "medium",
    startDate: row.start_date ?? null,
    dueDate: row.due_date ?? null,
    progress: Number(row.progress) || 0,
    parentTaskId: row.parent_task_id ?? null,
    mindmapX: Number(row.mindmap_x) || 0,
    mindmapY: Number(row.mindmap_y) || 0,
    active: row.active !== false,
    taskSource: row.task_source ?? "manual",
    agentKind: row.agent_kind ?? null,
    agentSessionId: row.agent_session_id ?? null,
    agentSessionUrl: row.agent_session_url ?? null,
    agentSessionLabel: row.agent_session_label ?? null,
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function memberCodeName(db: ReturnType<typeof createAdminClient>, memberId: string | null) {
  if (!memberId) return null;
  const { data } = await db
    .from("members")
    .select("code_name")
    .eq("member_id", memberId)
    .maybeSingle();
  return data?.code_name ?? null;
}

function wouldCreateCycle(tasks: TaskRow[], childTaskId: string, parentTaskId: string | null) {
  if (!parentTaskId) return false;
  if (childTaskId === parentTaskId) return true;
  const parentByTask = new Map(tasks.map((task) => [task.task_id, task.parent_task_id]));
  let cursor: string | null = parentTaskId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === childTaskId) return true;
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = parentByTask.get(cursor) ?? null;
  }
  return false;
}

export async function GET(req: NextRequest) {
  const access = await requireTaskAccess(req);
  if (!access.ok) return access.errorResponse;

  const db = createAdminClient();
  const projectId = cleanText(req.nextUrl.searchParams.get("projectId"), 32);
  const assigneeMemberId = cleanText(req.nextUrl.searchParams.get("assigneeMemberId"), 32);
  const status = cleanText(req.nextUrl.searchParams.get("status"), 20);
  const taskSource = cleanSourceToken(req.nextUrl.searchParams.get("taskSource"));
  const agentKind = cleanSourceToken(req.nextUrl.searchParams.get("agentKind"));
  const agentSessionId = cleanText(req.nextUrl.searchParams.get("agentSessionId"), 160);
  const limit = cleanNumber(req.nextUrl.searchParams.get("limit"), 0, 0, 500);
  let tasksQuery = db
    .from("tasks")
    .select("*")
    .eq("active", true);
  if (projectId) tasksQuery = tasksQuery.eq("project_id", projectId);
  if (assigneeMemberId) tasksQuery = tasksQuery.eq("assignee_member_id", assigneeMemberId);
  if (status === "open") tasksQuery = tasksQuery.neq("status", "done").neq("status", "archived");
  else if (status && status !== "all" && STATUSES.has(status)) tasksQuery = tasksQuery.eq("status", status);
  if (taskSource) tasksQuery = tasksQuery.eq("task_source", taskSource);
  if (agentKind) tasksQuery = tasksQuery.eq("agent_kind", agentKind);
  if (agentSessionId) tasksQuery = tasksQuery.eq("agent_session_id", agentSessionId);
  tasksQuery = tasksQuery
    .order("project_id", { ascending: true })
    .order("created_at", { ascending: true });
  if (limit > 0) tasksQuery = tasksQuery.limit(limit);

  const [tasksRes, projectsRes, membersRes, profilesRes, projectMembersRes] = await Promise.all([
    tasksQuery,
    db
      .from("projects")
      .select("project_id,project_name,client_name,status,project_category")
      .order("project_id", { ascending: true }),
    db
      .from("members")
      .select("member_id,code_name,member_name,status,is_admin")
      .order("member_id", { ascending: true }),
    db
      .from("member_profiles")
      .select("member_id,display_name,full_name,internal_title,public_title,status,visibility")
      .order("display_name", { ascending: true }),
    db
      .from("project_members")
      .select("project_id,member_id,role_label,role,is_active,is_pm,is_pl")
      .eq("is_active", true)
      .order("project_id", { ascending: true }),
  ]);

  const firstError = tasksRes.error || projectsRes.error || membersRes.error || profilesRes.error || projectMembersRes.error;
  if (firstError) {
    return NextResponse.json({ ok: false, error: firstError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    tasks: (tasksRes.data ?? []).map((row) => toClientTask(row as Record<string, unknown>)),
    projects: projectsRes.data ?? [],
    members: membersRes.data ?? [],
    memberProfiles: profilesRes.data ?? [],
    projectMembers: projectMembersRes.data ?? [],
  });
}

export async function POST(req: NextRequest) {
  const access = await requireTaskAccess(req);
  if (!access.ok) return access.errorResponse;

  let body: TaskPayload;
  try {
    body = (await req.json()) as TaskPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const title = cleanTitle(body.title, 180) ?? "新規タスク";
  const projectId = cleanText(body.projectId, 32);
  if (!projectId) return NextResponse.json({ ok: false, error: "projectId required" }, { status: 400 });

  const db = createAdminClient();
  const { data: project } = await db
    .from("projects")
    .select("project_id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!project) return NextResponse.json({ ok: false, error: "project not found" }, { status: 404 });

  const assigneeMemberId = cleanText(body.assigneeMemberId, 32);
  const assignee = await memberCodeName(db, assigneeMemberId);
  const row = {
    task_id: makeTaskId(),
    title,
    description: cleanText(body.description, 4000),
    project_id: projectId,
    assignee_member_id: assigneeMemberId,
    assignee,
    status: body.status && STATUSES.has(body.status) ? body.status : "todo",
    priority: body.priority && PRIORITIES.has(body.priority) ? body.priority : "medium",
    start_date: cleanDate(body.startDate),
    due_date: cleanDate(body.dueDate),
    progress: cleanNumber(body.progress, 0, 0, 100),
    parent_task_id: cleanText(body.parentTaskId, 80),
    mindmap_x: cleanCoordinate(body.mindmapX, 80),
    mindmap_y: cleanCoordinate(body.mindmapY, 80),
    active: true,
    task_source: cleanSourceToken(body.taskSource) ?? (access.accessKind === "agent" ? "agent" : "manual"),
    agent_kind: cleanSourceToken(body.agentKind) ?? (access.accessKind === "agent" ? "agent" : null),
    agent_session_id: cleanText(body.agentSessionId, 160),
    agent_session_url: cleanSessionUrl(body.agentSessionUrl),
    agent_session_label: cleanText(body.agentSessionLabel, 160),
    created_by: access.actor,
    updated_by: access.actor,
    position_updated_at: new Date().toISOString(),
  };

  const { data, error } = await db.from("tasks").insert(row).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, task: toClientTask(data as Record<string, unknown>) });
}

export async function PATCH(req: NextRequest) {
  const access = await requireTaskAccess(req);
  if (!access.ok) return access.errorResponse;

  let body: TaskPayload;
  try {
    body = (await req.json()) as TaskPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const taskId = cleanText(body.taskId, 80);
  if (!taskId) return NextResponse.json({ ok: false, error: "taskId required" }, { status: 400 });

  const db = createAdminClient();
  const patch: Record<string, unknown> = {
    updated_by: access.actor,
    updated_at: new Date().toISOString(),
  };

  if (body.title !== undefined) patch.title = cleanTitle(body.title, 180) ?? "";
  if (body.description !== undefined) patch.description = cleanText(body.description, 4000);
  if (body.projectId !== undefined) patch.project_id = cleanText(body.projectId, 32);
  if (body.status !== undefined && STATUSES.has(String(body.status))) patch.status = body.status;
  if (body.priority !== undefined) patch.priority = body.priority && PRIORITIES.has(String(body.priority)) ? body.priority : null;
  if (body.startDate !== undefined) patch.start_date = cleanDate(body.startDate);
  if (body.dueDate !== undefined) patch.due_date = cleanDate(body.dueDate);
  if (body.progress !== undefined) patch.progress = cleanNumber(body.progress, 0, 0, 100);
  if (body.active !== undefined) patch.active = body.active === true;
  if (body.taskSource !== undefined) {
    const taskSource = cleanSourceToken(body.taskSource);
    if (taskSource) patch.task_source = taskSource;
  }
  if (body.agentKind !== undefined) patch.agent_kind = cleanSourceToken(body.agentKind);
  if (body.agentSessionId !== undefined) patch.agent_session_id = cleanText(body.agentSessionId, 160);
  if (body.agentSessionUrl !== undefined) patch.agent_session_url = cleanSessionUrl(body.agentSessionUrl);
  if (body.agentSessionLabel !== undefined) patch.agent_session_label = cleanText(body.agentSessionLabel, 160);

  if (body.assigneeMemberId !== undefined) {
    const assigneeMemberId = cleanText(body.assigneeMemberId, 32);
    patch.assignee_member_id = assigneeMemberId;
    patch.assignee = await memberCodeName(db, assigneeMemberId);
  }

  if (body.mindmapX !== undefined || body.mindmapY !== undefined) {
    if (body.mindmapX !== undefined) patch.mindmap_x = cleanCoordinate(body.mindmapX, 0);
    if (body.mindmapY !== undefined) patch.mindmap_y = cleanCoordinate(body.mindmapY, 0);
    patch.position_updated_at = new Date().toISOString();
  }

  if (body.parentTaskId !== undefined) {
    const parentTaskId = cleanText(body.parentTaskId, 80);
    const { data: allTasks, error: allTasksError } = await db
      .from("tasks")
      .select("task_id,parent_task_id")
      .eq("active", true);
    if (allTasksError) return NextResponse.json({ ok: false, error: allTasksError.message }, { status: 500 });
    if (wouldCreateCycle((allTasks ?? []) as TaskRow[], taskId, parentTaskId)) {
      return NextResponse.json({ ok: false, error: "cycle detected" }, { status: 400 });
    }
    patch.parent_task_id = parentTaskId;
  }

  const { data, error } = await db
    .from("tasks")
    .update(patch)
    .eq("task_id", taskId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, task: toClientTask(data as Record<string, unknown>) });
}
