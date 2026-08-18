export type WeeklyTaskStatus = "open" | "completed";
export type WeeklyTaskAction = "create" | "set-status" | "rollover" | "accept-candidate";
export type WeeklyTaskSource = "manual" | "carryover" | "action_item";

export type MemberWeeklyTask = {
  id: string;
  memberId: string;
  projectId: string | null;
  weekStart: string;
  title: string;
  status: WeeklyTaskStatus;
  completedAt: string | null;
  carriedFromTaskId: string | null;
  candidateKey: string | null;
  source: WeeklyTaskSource;
};

/** 来週へ取り込む前の、本人確認待ちの候補。候補だけでは週次タスクを作らない。 */
export type WeeklyTaskCandidate = {
  candidateKey: string;
  projectId: string | null;
  title: string;
  dueAt: string;
  sourceLabel: "要対応";
};

const WEEK_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

/** JST の日付を YYYY-MM-DD に正規化する。 */
export function dateKeyJst(value: Date) {
  const jst = new Date(value.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${pad2(jst.getUTCMonth() + 1)}-${pad2(jst.getUTCDate())}`;
}

/** JST 月曜始まりの週キー。 */
export function mondayOfWeekJst(value = new Date()) {
  const jst = new Date(value.getTime() + 9 * 60 * 60 * 1000);
  const daysFromMonday = (jst.getUTCDay() + 6) % 7;
  const mondayJst = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()));
  mondayJst.setUTCDate(mondayJst.getUTCDate() - daysFromMonday);
  return `${mondayJst.getUTCFullYear()}-${pad2(mondayJst.getUTCMonth() + 1)}-${pad2(mondayJst.getUTCDate())}`;
}

export function addWeeks(weekStart: string, weeks: number) {
  if (!isMondayWeekKey(weekStart)) throw new Error("weekStart must be a Monday in YYYY-MM-DD format");
  const [year, month, day] = weekStart.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() + weeks * 7);
  return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
}

export function weekBoundsJst(weekStart: string) {
  if (!isMondayWeekKey(weekStart)) throw new Error("weekStart must be a Monday in YYYY-MM-DD format");
  const [year, month, day] = weekStart.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day) - 9 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function isMondayWeekKey(value: string) {
  if (!WEEK_KEY_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day && date.getUTCDay() === 1;
}

export function normalizeTaskTitle(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function validateWeeklyTaskCommand(value: unknown):
  | { ok: true; action: WeeklyTaskAction; weekStart: string | null; title: string | null; taskId: string | null; status: WeeklyTaskStatus | null; projectId: string | null; candidateKey: string | null }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "body must be an object" };
  const body = value as Record<string, unknown>;
  const action = body.action;
  if (action !== "create" && action !== "set-status" && action !== "rollover" && action !== "accept-candidate") return { ok: false, error: "invalid action" };

  const weekStart = typeof body.weekStart === "string" ? body.weekStart : null;
  if ((action === "create" || action === "rollover" || action === "accept-candidate") && (!weekStart || !isMondayWeekKey(weekStart))) {
    return { ok: false, error: "weekStart must be a Monday in YYYY-MM-DD format" };
  }

  const title = action === "create" ? normalizeTaskTitle(body.title) : null;
  if (action === "create" && (!title || title.length > 240)) {
    return { ok: false, error: "title must be between 1 and 240 characters" };
  }

  const taskId = action === "set-status" && typeof body.taskId === "string" ? body.taskId.trim() : null;
  if (action === "set-status" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(taskId || "")) {
    return { ok: false, error: "taskId must be a UUID" };
  }

  const status = action === "set-status" && (body.status === "open" || body.status === "completed") ? body.status : null;
  if (action === "set-status" && !status) return { ok: false, error: "status must be open or completed" };

  const projectId = typeof body.projectId === "string" && body.projectId.trim() ? body.projectId.trim() : null;
  if (projectId && projectId.length > 80) return { ok: false, error: "projectId is too long" };

  const candidateKey = action === "accept-candidate" && typeof body.candidateKey === "string" ? body.candidateKey.trim() : null;
  if (action === "accept-candidate" && !isActionItemCandidateKey(candidateKey || "")) {
    return { ok: false, error: "candidateKey must be an action_item candidate" };
  }

  return { ok: true, action, weekStart, title, taskId, status, projectId, candidateKey };
}

export function actionItemCandidateKey(actionId: string) {
  return `action_item:${encodeURIComponent(actionId)}`;
}

export function isActionItemCandidateKey(value: string) {
  return actionItemIdFromCandidateKey(value) !== null;
}

/** client payload の候補キーを、DB検索に使える action_items.action_id へ安全に戻す。 */
export function actionItemIdFromCandidateKey(value: string) {
  if (!/^action_item:(?:[A-Za-z0-9_.~-]|%[0-9A-Fa-f]{2}){1,540}$/.test(value)) return null;
  try {
    const actionId = decodeURIComponent(value.slice("action_item:".length));
    return actionId && actionId.length <= 180 ? actionId : null;
  } catch {
    return null;
  }
}

/** 既に同じ親タスクから繰越済みなら、再作成しないための純粋な候補化。 */
export function rolloverCandidates<T extends Pick<MemberWeeklyTask, "id" | "status">>(
  previousWeekTasks: T[],
  existingTargetCarriedFromTaskIds: Iterable<string | null | undefined>,
) {
  const alreadyCarried = new Set([...existingTargetCarriedFromTaskIds].filter((id): id is string => Boolean(id)));
  return previousWeekTasks.filter((task) => task.status === "open" && !alreadyCarried.has(task.id));
}
