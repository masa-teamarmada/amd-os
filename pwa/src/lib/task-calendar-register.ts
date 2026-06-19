import { createHash } from "node:crypto";

export type TaskRegistrationSource = {
  task_id?: string | null;
  taskId?: string | null;
  project_id?: string | null;
  projectId?: string | null;
  project_code?: string | null;
  projectCode?: string | null;
  title?: string | null;
  description?: string | null;
  owner_member_id?: string | null;
  ownerMemberId?: string | null;
  owner_code_name?: string | null;
  ownerCodeName?: string | null;
  owner_slack_user_id?: string | null;
  ownerSlackUserId?: string | null;
  due_at?: string | null;
  dueAt?: string | null;
  earliest_start?: string | null;
  earliestStart?: string | null;
  estimated_minutes?: number | null;
  estimatedMinutes?: number | null;
  priority?: string | null;
  source_kind?: string | null;
  sourceKind?: string | null;
  source_id?: string | null;
  sourceId?: string | null;
  source_url?: string | null;
  sourceUrl?: string | null;
  source_confidence?: number | null;
  sourceConfidence?: number | null;
  source_excerpt?: string | null;
  sourceExcerpt?: string | null;
};

export type NormalizedTaskRegistrationSource = {
  taskId: string;
  projectId: string;
  projectCode: string | null;
  title: string;
  description: string | null;
  ownerMemberId: string | null;
  ownerCodeName: string | null;
  ownerSlackUserId: string | null;
  dueAt: string | null;
  earliestStart: string | null;
  estimatedMinutes: number | null;
  priority: "low" | "medium" | "high" | "urgent";
  sourceKind: string;
  sourceId: string | null;
  sourceUrl: string | null;
  sourceConfidence: number | null;
  sourceExcerpt: string | null;
  sourceKey: string;
};

export type TaskRegistrationRow = {
  task_id: string;
  title: string;
  description: string | null;
  project_id: string;
  assignee_member_id: string | null;
  assignee: string | null;
  status: "todo";
  priority: "low" | "medium" | "high" | "urgent";
  start_date: string | null;
  due_date: string | null;
  progress: 0;
  active: true;
  task_source: string;
  agent_kind: "h1_meeting_flow";
  agent_session_id: string | null;
  agent_session_url: string | null;
  agent_session_label: string | null;
  created_by: string;
  updated_by: string;
  position_updated_at: string;
};

const PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function cleanToken(value: unknown, max = 80): string | null {
  const text = cleanText(value, max);
  if (!text) return null;
  const token = text.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, max);
  return token || null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeIso(value: unknown): string | null {
  const text = cleanText(value, 80);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function jstDateOnly(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function hashedTaskId(source: {
  projectId: string;
  title: string;
  sourceKind: string;
  sourceId: string | null;
  sourceUrl: string | null;
}) {
  const seed = [
    source.projectId,
    source.sourceKind,
    source.sourceId,
    source.sourceUrl,
    source.title,
  ].filter(Boolean).join("|");
  const hash = createHash("sha256").update(seed).digest("hex").slice(0, 16);
  return `h1_task_${hash}`;
}

function buildSourceKey(sourceKind: string, sourceId: string | null, taskId: string) {
  return sourceId ? `amd-os:${sourceKind}:${sourceId}` : `amd-os:task:${taskId}`;
}

export function normalizeTaskRegistrationSource(value: unknown): NormalizedTaskRegistrationSource | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as TaskRegistrationSource;
  const projectId = cleanText(rec.project_id ?? rec.projectId, 32);
  const title = cleanText(rec.title, 180);
  if (!projectId || !title) return null;

  const sourceKind = cleanToken(rec.source_kind ?? rec.sourceKind, 60) || "meeting_todo";
  const sourceId = cleanText(rec.source_id ?? rec.sourceId, 180);
  const sourceUrl = cleanText(rec.source_url ?? rec.sourceUrl, 1000);
  const explicitTaskId = cleanToken(rec.task_id ?? rec.taskId, 80);
  const taskId = explicitTaskId || hashedTaskId({ projectId, title, sourceKind, sourceId, sourceUrl });
  const priority = cleanToken(rec.priority, 20);

  return {
    taskId,
    projectId,
    projectCode: cleanText(rec.project_code ?? rec.projectCode, 40),
    title,
    description: cleanText(rec.description, 2000),
    ownerMemberId: cleanText(rec.owner_member_id ?? rec.ownerMemberId, 32),
    ownerCodeName: cleanText(rec.owner_code_name ?? rec.ownerCodeName, 80),
    ownerSlackUserId: cleanText(rec.owner_slack_user_id ?? rec.ownerSlackUserId, 80),
    dueAt: normalizeIso(rec.due_at ?? rec.dueAt),
    earliestStart: normalizeIso(rec.earliest_start ?? rec.earliestStart),
    estimatedMinutes: numberOrNull(rec.estimated_minutes ?? rec.estimatedMinutes),
    priority: PRIORITIES.has(priority || "") ? priority as NormalizedTaskRegistrationSource["priority"] : "medium",
    sourceKind,
    sourceId,
    sourceUrl,
    sourceConfidence: numberOrNull(rec.source_confidence ?? rec.sourceConfidence),
    sourceExcerpt: cleanText(rec.source_excerpt ?? rec.sourceExcerpt, 500),
    sourceKey: buildSourceKey(sourceKind, sourceId, taskId),
  };
}

export function buildTaskRegistrationRow(args: {
  source: NormalizedTaskRegistrationSource;
  assigneeCodeName: string | null;
  actor: string;
  nowIso?: string;
  sessionId?: string | null;
  sessionUrl?: string | null;
  sessionLabel?: string | null;
}): TaskRegistrationRow {
  const { source, assigneeCodeName, actor } = args;
  const nowIso = args.nowIso || new Date().toISOString();
  const description = [
    source.description,
    source.sourceExcerpt ? `Source excerpt: ${source.sourceExcerpt}` : null,
    source.sourceUrl ? `Source URL: ${source.sourceUrl}` : null,
    source.estimatedMinutes ? `Estimated minutes: ${source.estimatedMinutes}` : null,
    source.sourceConfidence !== null ? `Source confidence: ${source.sourceConfidence}` : null,
    `Source key: ${source.sourceKey}`,
  ].filter(Boolean).join("\n");

  return {
    task_id: source.taskId,
    title: source.title,
    description: description || null,
    project_id: source.projectId,
    assignee_member_id: source.ownerMemberId,
    assignee: assigneeCodeName || source.ownerCodeName,
    status: "todo",
    priority: source.priority,
    start_date: jstDateOnly(source.earliestStart),
    due_date: jstDateOnly(source.dueAt),
    progress: 0,
    active: true,
    task_source: source.sourceKind,
    agent_kind: "h1_meeting_flow",
    agent_session_id: args.sessionId || null,
    agent_session_url: args.sessionUrl || null,
    agent_session_label: args.sessionLabel || null,
    created_by: actor,
    updated_by: actor,
    position_updated_at: nowIso,
  };
}

export function buildTaskOwnerSlackNudge(args: {
  source: NormalizedTaskRegistrationSource;
  appUrl: string;
  taskId: string;
  projectName?: string | null;
}) {
  const { source, appUrl, taskId } = args;
  const projectLabel = source.projectCode || args.projectName || source.projectId;
  const lines = [
    `AMD OSでタスクを自動登録したよ: ${source.title}`,
    `PJ: ${projectLabel}`,
    source.dueAt ? `期限: ${jstDateOnly(source.dueAt)}` : null,
    source.sourceUrl ? `元: ${source.sourceUrl}` : null,
    `${appUrl.replace(/\/$/, "")}/tasks`,
    "",
    "内容・期限・担当が違ってたら /tasks で直してね。Calendar作業枠は本人確認を優先して、外部返信や招待は送らないよ。",
    `task_id: ${taskId}`,
  ].filter(Boolean);
  return lines.join("\n").slice(0, 2800);
}
