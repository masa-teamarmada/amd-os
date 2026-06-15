"use client";

import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Filter,
  GanttChartSquare,
  GitBranch,
  Loader2,
  Minus,
  Network,
  Plus,
  Save,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type TaskStatus = "pending" | "todo" | "doing" | "review" | "blocked" | "done";
type ViewMode = "mindmap" | "gantt";

type OsTask = {
  taskId: string;
  title: string;
  description: string;
  projectId: string;
  assignee: string;
  assigneeMemberId: string | null;
  status: TaskStatus | string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  progress: number;
  parentTaskId: string | null;
  mindmapX: number;
  mindmapY: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type Project = {
  project_id: string;
  project_name: string;
  client_name: string | null;
  status: string;
  project_category: string | null;
};

type Member = {
  member_id: string;
  code_name: string;
  member_name: string | null;
  status: string;
  is_admin: boolean;
};

type MemberProfile = {
  member_id: string | null;
  display_name: string;
  full_name: string | null;
  internal_title: string | null;
  public_title: string | null;
};

type ProjectMember = {
  project_id: string;
  member_id: string;
  role_label: string | null;
  role: string | null;
  is_active: boolean;
  is_pm: boolean;
  is_pl: boolean;
};

type TaskBundle = {
  tasks: OsTask[];
  projects: Project[];
  members: Member[];
  memberProfiles: MemberProfile[];
  projectMembers: ProjectMember[];
};

type TaskFormState = {
  taskId?: string;
  title: string;
  description: string;
  projectId: string;
  assigneeMemberId: string;
  status: TaskStatus;
  priority: string;
  startDate: string;
  dueDate: string;
  progress: number;
  parentTaskId: string;
  mindmapX: number;
  mindmapY: number;
};

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string; className: string }> = [
  { value: "pending", label: "Pending", className: "border-zinc-300 bg-zinc-50 text-zinc-700" },
  { value: "todo", label: "TODO", className: "border-sky-200 bg-sky-50 text-sky-700" },
  { value: "doing", label: "Doing", className: "border-amber-200 bg-amber-50 text-amber-800" },
  { value: "review", label: "Review", className: "border-indigo-200 bg-indigo-50 text-indigo-700" },
  { value: "blocked", label: "Blocked", className: "border-rose-200 bg-rose-50 text-rose-700" },
  { value: "done", label: "Done", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const CANVAS_WIDTH = 2200;
const CANVAS_HEIGHT = 1300;
const NODE_WIDTH = 220;
const NODE_HEIGHT = 174;
const NODE_DIAMETER = 96;
const NODE_RADIUS = NODE_DIAMETER / 2;
const NODE_CIRCLE_TOP = 12;
const NODE_GAP_X = 280;
const NODE_GAP_Y = 200;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.25;
const WHEEL_ZOOM_SENSITIVITY = 0.00045;
const TOUCH_PINCH_ZOOM_EXPONENT = 0.45;
const ZOOM_BUTTON_FACTOR = 1.08;
const TASK_DIALOG_WIDTH = 480;
const TASK_DIALOG_MARGIN = 12;
const TASK_DIALOG_MIN_VISIBLE_HEIGHT = 180;
const TASK_DIALOG_VERTICAL_OFFSET = 144;
const NODE_REPEL_DISTANCE = NODE_DIAMETER * 2.05;

type FloatingPosition = {
  x: number;
  y: number;
};

type DragItem = {
  taskId: string;
  originX: number;
  originY: number;
};

type TaskUndoEntry =
  | { kind: "create"; taskId: string }
  | { kind: "delete"; task: OsTask }
  | { kind: "patch"; before: OsTask; after: OsTask }
  | { kind: "patch-many"; before: OsTask[]; after: OsTask[] };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function emptyForm(projectId: string, x = 140, y = 120): TaskFormState {
  return {
    title: "",
    description: "",
    projectId,
    assigneeMemberId: "",
    status: "todo",
    priority: "medium",
    startDate: todayIso(),
    dueDate: addDaysIso(14),
    progress: 0,
    parentTaskId: "",
    mindmapX: x,
    mindmapY: y,
  };
}

function formFromTask(task: OsTask): TaskFormState {
  return {
    taskId: task.taskId,
    title: task.title,
    description: task.description || "",
    projectId: task.projectId,
    assigneeMemberId: task.assigneeMemberId || "",
    status: normalizeStatus(task.status),
    priority: task.priority || "medium",
    startDate: task.startDate || "",
    dueDate: task.dueDate || "",
    progress: task.progress || 0,
    parentTaskId: task.parentTaskId || "",
    mindmapX: task.mindmapX || 80,
    mindmapY: task.mindmapY || 80,
  };
}

function normalizeStatus(status: string): TaskStatus {
  return STATUS_OPTIONS.some((option) => option.value === status) ? (status as TaskStatus) : "todo";
}

function statusMeta(status: string) {
  return STATUS_OPTIONS.find((option) => option.value === status) ?? STATUS_OPTIONS[1];
}

function dateValue(date: string | null) {
  if (!date) return null;
  const time = new Date(`${date}T00:00:00`).getTime();
  return Number.isFinite(time) ? time : null;
}

function formatDate(date: string | null) {
  if (!date) return "未設定";
  return date.slice(5).replace("-", "/");
}

function fallbackMindmapPosition(index: number) {
  return {
    x: 40 + (index % 6) * NODE_GAP_X,
    y: 40 + Math.floor(index / 6) * NODE_GAP_Y,
  };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampMindmapX(value: number) {
  return clampNumber(value, 0, CANVAS_WIDTH - NODE_WIDTH);
}

function clampMindmapY(value: number) {
  return clampNumber(value, 0, CANVAS_HEIGHT - NODE_HEIGHT);
}

function clampFloatingPosition(position: FloatingPosition): FloatingPosition {
  if (typeof window === "undefined") return position;
  const maxX = Math.max(TASK_DIALOG_MARGIN, window.innerWidth - TASK_DIALOG_WIDTH - TASK_DIALOG_MARGIN);
  const maxY = Math.max(TASK_DIALOG_MARGIN, window.innerHeight - TASK_DIALOG_MIN_VISIBLE_HEIGHT - TASK_DIALOG_MARGIN);
  return {
    x: Math.round(clampNumber(position.x, TASK_DIALOG_MARGIN, maxX)),
    y: Math.round(clampNumber(position.y, TASK_DIALOG_MARGIN, maxY)),
  };
}

function nodeCenter(task: OsTask) {
  return {
    x: (task.mindmapX || 0) + NODE_WIDTH / 2,
    y: (task.mindmapY || 0) + NODE_CIRCLE_TOP + NODE_RADIUS,
  };
}

function linePath(from: { x: number; y: number }, to: { x: number; y: number }) {
  return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
}

function edgePath(parent: OsTask, child: OsTask) {
  const from = nodeCenter(child);
  const to = nodeCenter(parent);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const unitX = dx / distance;
  const unitY = dy / distance;
  return linePath(
    { x: from.x + unitX * (NODE_RADIUS + 8), y: from.y + unitY * (NODE_RADIUS + 8) },
    { x: to.x - unitX * (NODE_RADIUS + 16), y: to.y - unitY * (NODE_RADIUS + 16) },
  );
}

function repelMindmapTasks(tasks: OsTask[]) {
  const arranged = tasks.map((task) => ({ ...task }));
  if (arranged.length < 2) return arranged;

  for (let pass = 0; pass < 7; pass += 1) {
    let moved = false;
    for (let i = 0; i < arranged.length; i += 1) {
      for (let j = i + 1; j < arranged.length; j += 1) {
        const a = arranged[i];
        const b = arranged[j];
        const ac = nodeCenter(a);
        const bc = nodeCenter(b);
        let dx = bc.x - ac.x;
        let dy = bc.y - ac.y;
        let distance = Math.hypot(dx, dy);
        if (distance >= NODE_REPEL_DISTANCE) continue;

        if (distance < 0.1) {
          const angle = (((i + 1) * 53 + (j + 1) * 29) * Math.PI) / 180;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }

        const ux = dx / distance;
        const uy = dy / distance;
        const push = (NODE_REPEL_DISTANCE - distance) * 0.42;
        a.mindmapX = clampMindmapX((a.mindmapX || 0) - ux * push);
        a.mindmapY = clampMindmapY((a.mindmapY || 0) - uy * push);
        b.mindmapX = clampMindmapX((b.mindmapX || 0) + ux * push);
        b.mindmapY = clampMindmapY((b.mindmapY || 0) + uy * push);
        moved = true;
      }
    }
    if (!moved) break;
  }

  return arranged.map((task) => ({
    ...task,
    mindmapX: Math.round(task.mindmapX || 0),
    mindmapY: Math.round(task.mindmapY || 0),
  }));
}

function previewEdgePath(parent: OsTask, to: { x: number; y: number }) {
  const parentCenter = nodeCenter(parent);
  const dx = parentCenter.x - to.x;
  const dy = parentCenter.y - to.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  return linePath(
    to,
    {
      x: parentCenter.x - (dx / distance) * (NODE_RADIUS + 8),
      y: parentCenter.y - (dy / distance) * (NODE_RADIUS + 8),
    },
  );
}

function dragDeltaForItems(items: DragItem[], dx: number, dy: number) {
  if (!items.length) return { dx: 0, dy: 0 };
  const minX = Math.min(...items.map((item) => item.originX));
  const maxX = Math.max(...items.map((item) => item.originX));
  const minY = Math.min(...items.map((item) => item.originY));
  const maxY = Math.max(...items.map((item) => item.originY));
  return {
    dx: Math.round(clampNumber(dx, -minX, CANVAS_WIDTH - NODE_WIDTH - maxX)),
    dy: Math.round(clampNumber(dy, -minY, CANVAS_HEIGHT - NODE_HEIGHT - maxY)),
  };
}

function nextDragPositions(items: DragItem[], dx: number, dy: number) {
  const delta = dragDeltaForItems(items, dx, dy);
  return items.map((item) => ({
    taskId: item.taskId,
    mindmapX: Math.round(item.originX + delta.dx),
    mindmapY: Math.round(item.originY + delta.dy),
  }));
}

function nodeTone(status: string) {
  if (normalizeStatus(status) === "done") {
    return {
      circle: "border-blue-300 bg-blue-950/55 text-blue-50 shadow-blue-950/30",
      halo: "border-blue-300/25",
      handle: "border-blue-100 bg-blue-500 text-white",
      status: "text-blue-300",
      progress: "bg-blue-300",
    };
  }
  return {
    circle: "border-yellow-300 bg-yellow-950/55 text-yellow-50 shadow-yellow-950/30",
    halo: "border-yellow-300/30",
    handle: "border-yellow-100 bg-yellow-400 text-black",
    status: "text-yellow-300",
    progress: "bg-yellow-300",
  };
}

function nodeInitial(task: OsTask) {
  const title = task.title.trim();
  return (title ? title.slice(0, 2) : task.projectId).toUpperCase();
}

function nodeTitle(task: OsTask) {
  return task.title.trim();
}

function makeOptimisticTaskId() {
  return `task_local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function isOptimisticTaskId(taskId: string) {
  return taskId.startsWith("task_local_");
}

function editableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input,textarea,select,[contenteditable='true']"));
}

export function TasksClient() {
  const [bundle, setBundle] = useState<TaskBundle>({
    tasks: [],
    projects: [],
    members: [],
    memberProfiles: [],
    projectMembers: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("mindmap");
  const [projectFilter, setProjectFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("open");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<TaskFormState | null>(null);
  const [formPosition, setFormPosition] = useState<FloatingPosition | null>(null);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState<{
    taskId: string;
    startX: number;
    startY: number;
    items: DragItem[];
    moved: boolean;
  } | null>(null);
  const [connecting, setConnecting] = useState<{
    parentTaskId: string;
    currentX: number;
    currentY: number;
    targetTaskId: string | null;
  } | null>(null);
  const connectingParentTaskId = connecting?.parentTaskId ?? null;
  const connectingRef = useRef<typeof connecting>(null);
  const latestTasksRef = useRef<OsTask[]>([]);
  const skipTaskClickRef = useRef<string | null>(null);
  const suppressNextCanvasClickRef = useRef(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const zoomRef = useRef(zoom);
  const formRef = useRef<TaskFormState | null>(form);
  const touchPointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{
    distance: number;
    zoom: number;
    focus: { clientX: number; clientY: number } | null;
  } | null>(null);
  const pendingCreateRef = useRef(new Map<string, Promise<OsTask>>());
  const optimisticServerIdRef = useRef(new Map<string, string>());
  const canceledCreateIdsRef = useRef(new Set<string>());
  const undoStackRef = useRef<TaskUndoEntry[]>([]);
  const taskMutationSeqRef = useRef(new Map<string, number>());
  const undoLastTaskActionRef = useRef<() => Promise<void>>(async () => undefined);
  const patchTaskOptimisticRef = useRef<(taskId: string, patch: Partial<OsTask>, pushHistory?: boolean) => Promise<void>>(
    async () => undefined,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "tasks load failed");
      setBundle({
        tasks: json.tasks || [],
        projects: json.projects || [],
        members: json.members || [],
        memberProfiles: json.memberProfiles || [],
        projectMembers: json.projectMembers || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "tasks load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    latestTasksRef.current = bundle.tasks;
  }, [bundle.tasks]);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    connectingRef.current = connecting;
  }, [connecting]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const projectById = useMemo(() => new Map(bundle.projects.map((project) => [project.project_id, project])), [bundle.projects]);
  const memberById = useMemo(() => new Map(bundle.members.map((member) => [member.member_id, member])), [bundle.members]);
  const profileByMemberId = useMemo(
    () => new Map(bundle.memberProfiles.filter((profile) => profile.member_id).map((profile) => [profile.member_id as string, profile])),
    [bundle.memberProfiles],
  );

  const visibleTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bundle.tasks.filter((task) => {
      if (projectFilter !== "all" && task.projectId !== projectFilter) return false;
      if (memberFilter !== "all" && (task.assigneeMemberId || "") !== memberFilter) return false;
      if (statusFilter === "open" && normalizeStatus(task.status) === "done") return false;
      if (statusFilter !== "all" && statusFilter !== "open" && task.status !== statusFilter) return false;
      if (!q) return true;
      const project = projectById.get(task.projectId);
      const member = task.assigneeMemberId ? memberById.get(task.assigneeMemberId) : null;
      return [task.title, task.description, project?.project_name, member?.code_name, task.assignee]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [bundle.tasks, memberById, memberFilter, projectById, projectFilter, query, statusFilter]);

  const stats = useMemo(() => {
    const open = bundle.tasks.filter((task) => normalizeStatus(task.status) !== "done").length;
    const blocked = bundle.tasks.filter((task) => normalizeStatus(task.status) === "blocked").length;
    const withDates = bundle.tasks.filter((task) => task.startDate || task.dueDate).length;
    return { total: bundle.tasks.length, open, blocked, withDates };
  }, [bundle.tasks]);

  function projectName(projectId: string) {
    const project = projectById.get(projectId);
    return project ? `${project.project_id} ${project.project_name}` : projectId;
  }

  function memberName(memberId: string | null, fallback?: string) {
    if (!memberId) return fallback || "未割当";
    const profile = profileByMemberId.get(memberId);
    const member = memberById.get(memberId);
    return profile?.display_name || member?.code_name || fallback || memberId;
  }

  function projectMembers(projectId: string) {
    const ids = new Set(bundle.projectMembers.filter((pm) => pm.project_id === projectId).map((pm) => pm.member_id));
    const scoped = bundle.members.filter((member) => ids.has(member.member_id));
    return scoped.length ? scoped : bundle.members.filter((member) => member.status !== "inactive");
  }

  function pushUndo(entry: TaskUndoEntry) {
    undoStackRef.current = [...undoStackRef.current, entry].slice(-50);
  }

  function remapTaskIdentity(task: OsTask, fromTaskId: string, toTaskId: string) {
    return {
      ...task,
      taskId: task.taskId === fromTaskId ? toTaskId : task.taskId,
      parentTaskId: task.parentTaskId === fromTaskId ? toTaskId : task.parentTaskId,
    };
  }

  function remapUndoTaskId(fromTaskId: string, toTaskId: string) {
    undoStackRef.current = undoStackRef.current.map((entry) => {
      if (entry.kind === "create") {
        return entry.taskId === fromTaskId ? { ...entry, taskId: toTaskId } : entry;
      }
      if (entry.kind === "delete") {
        return { ...entry, task: remapTaskIdentity(entry.task, fromTaskId, toTaskId) };
      }
      if (entry.kind === "patch-many") {
        return {
          ...entry,
          before: entry.before.map((task) => remapTaskIdentity(task, fromTaskId, toTaskId)),
          after: entry.after.map((task) => remapTaskIdentity(task, fromTaskId, toTaskId)),
        };
      }
      return {
        ...entry,
        before: remapTaskIdentity(entry.before, fromTaskId, toTaskId),
        after: remapTaskIdentity(entry.after, fromTaskId, toTaskId),
      };
    });
  }

  function bumpTaskMutationSeq(taskId: string) {
    const next = (taskMutationSeqRef.current.get(taskId) ?? 0) + 1;
    taskMutationSeqRef.current.set(taskId, next);
    return next;
  }

  function isCurrentTaskMutation(taskId: string, seq: number, serverTaskId?: string | null) {
    return taskMutationSeqRef.current.get(taskId) === seq || (
      Boolean(serverTaskId) && taskMutationSeqRef.current.get(serverTaskId as string) === seq
    );
  }

  function dragItemsForTask(rootTask: OsTask): DragItem[] {
    const tasks = latestTasksRef.current.length ? latestTasksRef.current : bundle.tasks;
    const childrenByParentId = new Map<string, OsTask[]>();
    for (const task of tasks) {
      if (!task.parentTaskId) continue;
      const list = childrenByParentId.get(task.parentTaskId) ?? [];
      list.push(task);
      childrenByParentId.set(task.parentTaskId, list);
    }

    const items: DragItem[] = [];
    const visited = new Set<string>();
    const stack: OsTask[] = [rootTask];
    while (stack.length) {
      const task = stack.pop();
      if (!task || visited.has(task.taskId)) continue;
      visited.add(task.taskId);
      items.push({
        taskId: task.taskId,
        originX: task.taskId === rootTask.taskId ? (rootTask.mindmapX || 80) : (task.mindmapX || 80),
        originY: task.taskId === rootTask.taskId ? (rootTask.mindmapY || 80) : (task.mindmapY || 80),
      });
      stack.push(...(childrenByParentId.get(task.taskId) ?? []));
    }
    return items;
  }

  async function requestTask(method: "POST" | "PATCH", payload: Record<string, unknown>) {
    const res = await fetch("/api/tasks", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error || "task mutation failed");
    return json.task as OsTask;
  }

  async function mutateTask(method: "POST" | "PATCH", payload: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const next = await requestTask(method, payload);
      setBundle((prev) => ({
        ...prev,
        tasks: method === "POST"
          ? [...prev.tasks, next]
          : next.active === false
            ? prev.tasks.filter((task) => task.taskId !== next.taskId)
            : prev.tasks.map((task) => (task.taskId === next.taskId ? next : task)),
      }));
      return next;
    } finally {
      setSaving(false);
    }
  }

  async function resolveTaskIdForServer(taskId: string) {
    if (!isOptimisticTaskId(taskId)) return taskId;
    const resolvedTaskId = optimisticServerIdRef.current.get(taskId);
    if (resolvedTaskId && !canceledCreateIdsRef.current.has(taskId)) return resolvedTaskId;
    const pending = pendingCreateRef.current.get(taskId);
    if (!pending) return null;
    try {
      const serverTask = await pending;
      if (canceledCreateIdsRef.current.has(taskId)) return null;
      return serverTask.taskId;
    } catch {
      return null;
    }
  }

  function replaceOptimisticTask(optimisticTaskId: string, serverTask: OsTask) {
    setBundle((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => {
        if (task.taskId === optimisticTaskId) {
          if (taskMutationSeqRef.current.has(optimisticTaskId)) {
            return {
              ...serverTask,
              title: task.title,
              description: task.description,
              projectId: task.projectId,
              assignee: task.assignee,
              assigneeMemberId: task.assigneeMemberId,
              status: task.status,
              priority: task.priority,
              startDate: task.startDate,
              dueDate: task.dueDate,
              progress: task.progress,
              parentTaskId: task.parentTaskId,
              mindmapX: task.mindmapX,
              mindmapY: task.mindmapY,
            };
          }
          return serverTask;
        }
        if (task.parentTaskId === optimisticTaskId) return { ...task, parentTaskId: serverTask.taskId };
        return task;
      }),
    }));
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        taskId: current.taskId === optimisticTaskId ? serverTask.taskId : current.taskId,
        parentTaskId: current.parentTaskId === optimisticTaskId ? serverTask.taskId : current.parentTaskId,
      };
    });
    const seq = taskMutationSeqRef.current.get(optimisticTaskId);
    if (seq !== undefined) taskMutationSeqRef.current.set(serverTask.taskId, seq);
    remapUndoTaskId(optimisticTaskId, serverTask.taskId);
  }

  async function saveForm() {
    if (!form) return;
    const payload = {
      taskId: form.taskId,
      title: form.title,
      description: form.description,
      projectId: form.projectId,
      assigneeMemberId: form.assigneeMemberId || null,
      status: form.status,
      priority: form.priority || null,
      startDate: form.startDate || null,
      dueDate: form.dueDate || null,
      progress: form.progress,
      parentTaskId: form.parentTaskId || null,
      mindmapX: form.mindmapX,
      mindmapY: form.mindmapY,
    };
    if (!form.taskId) {
      try {
        await mutateTask("POST", payload);
        setForm(null);
        setFormPosition(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "save failed");
      }
      return;
    }

    const taskId = form.taskId;
    const mutationSeq = bumpTaskMutationSeq(taskId);
    const before = latestTasksRef.current.find((task) => task.taskId === taskId);
    const nextLocal = before ? {
      ...before,
      title: form.title,
      description: form.description,
      projectId: form.projectId,
      assigneeMemberId: form.assigneeMemberId || null,
      status: form.status,
      priority: form.priority || "medium",
      startDate: form.startDate || null,
      dueDate: form.dueDate || null,
      progress: form.progress,
      parentTaskId: form.parentTaskId || null,
      mindmapX: form.mindmapX,
      mindmapY: form.mindmapY,
      updatedAt: new Date().toISOString(),
    } : null;

    if (before && nextLocal) {
      pushUndo({ kind: "patch", before, after: nextLocal });
      setBundle((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) => task.taskId === taskId ? nextLocal : task),
      }));
    }
    setForm(null);
    setFormPosition(null);

    void (async () => {
      try {
        const serverTaskId = await resolveTaskIdForServer(taskId);
        if (!serverTaskId) return;
        const serverParentTaskId = form.parentTaskId ? await resolveTaskIdForServer(form.parentTaskId) : null;
        const patchedTask = await requestTask("PATCH", {
          ...payload,
          taskId: serverTaskId,
          parentTaskId: serverParentTaskId || null,
        });
        if (!isCurrentTaskMutation(taskId, mutationSeq, serverTaskId)) return;
        setBundle((prev) => ({
          ...prev,
          tasks: prev.tasks.map((task) => (
            task.taskId === taskId || task.taskId === serverTaskId ? patchedTask : task
          )),
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "save failed");
      }
    })();
  }

  function createTaskAt(
    x: number,
    y: number,
    projectId = projectFilter === "all" ? bundle.projects[0]?.project_id : projectFilter,
    parentTaskId: string | null = null,
    assigneeMemberId: string | null = null,
  ) {
    if (!projectId) return;
    const draft = emptyForm(projectId, Math.round(clampMindmapX(x)), Math.round(clampMindmapY(y)));
    const now = new Date().toISOString();
    const optimisticTask: OsTask = {
      taskId: makeOptimisticTaskId(),
      title: draft.title,
      description: draft.description,
      projectId: draft.projectId,
      assignee: assigneeMemberId ? memberName(assigneeMemberId) : "",
      assigneeMemberId,
      status: draft.status,
      priority: draft.priority,
      startDate: draft.startDate,
      dueDate: draft.dueDate,
      progress: draft.progress,
      parentTaskId,
      mindmapX: draft.mindmapX,
      mindmapY: draft.mindmapY,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    setError(null);
    setBundle((prev) => ({ ...prev, tasks: [...prev.tasks, optimisticTask] }));
    setForm(formFromTask(optimisticTask));
    setFormPosition(modalPositionForCanvasNode(optimisticTask.mindmapX, optimisticTask.mindmapY));
    pushUndo({ kind: "create", taskId: optimisticTask.taskId });

    const createPromise = (async () => {
      const serverParentTaskId = parentTaskId ? await resolveTaskIdForServer(parentTaskId) : null;
      if (parentTaskId && isOptimisticTaskId(parentTaskId) && !serverParentTaskId) {
        throw new Error("parent task save canceled");
      }
      return requestTask("POST", {
        title: optimisticTask.title,
        description: optimisticTask.description,
        projectId: optimisticTask.projectId,
        assigneeMemberId,
        status: optimisticTask.status,
        priority: optimisticTask.priority,
        startDate: optimisticTask.startDate,
        dueDate: optimisticTask.dueDate,
        progress: optimisticTask.progress,
        parentTaskId: serverParentTaskId,
        mindmapX: optimisticTask.mindmapX,
        mindmapY: optimisticTask.mindmapY,
      });
    })();

    pendingCreateRef.current.set(optimisticTask.taskId, createPromise);
    createPromise
      .then(async (serverTask) => {
        pendingCreateRef.current.delete(optimisticTask.taskId);
        optimisticServerIdRef.current.set(optimisticTask.taskId, serverTask.taskId);
        if (canceledCreateIdsRef.current.has(optimisticTask.taskId)) {
          await requestTask("PATCH", { taskId: serverTask.taskId, active: false }).catch(() => undefined);
          return;
        }
        replaceOptimisticTask(optimisticTask.taskId, serverTask);
      })
      .catch((err) => {
        pendingCreateRef.current.delete(optimisticTask.taskId);
        if (!canceledCreateIdsRef.current.has(optimisticTask.taskId)) {
          setBundle((prev) => ({ ...prev, tasks: prev.tasks.filter((task) => task.taskId !== optimisticTask.taskId) }));
          if (formRef.current?.taskId === optimisticTask.taskId) {
            setForm(null);
            setFormPosition(null);
          }
          setError(err instanceof Error ? err.message : "create failed");
        }
      });
  }

  function createChildTask(parent: OsTask) {
    const childCount = latestTasksRef.current.filter((task) => task.parentTaskId === parent.taskId).length;
    const nextX = clampMindmapX((parent.mindmapX || 80) + NODE_GAP_X);
    const nextY = clampMindmapY((parent.mindmapY || 80) + childCount * 130);
    createTaskAt(nextX, nextY, parent.projectId, parent.taskId, parent.assigneeMemberId);
  }

  const canvasPointAt = useCallback((clientX: number, clientY: number, currentZoom = zoomRef.current) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round((clientX - rect.left + canvas.scrollLeft) / currentZoom),
      y: Math.round((clientY - rect.top + canvas.scrollTop) / currentZoom),
    };
  }, []);

  const canvasPoint = useCallback((clientX: number, clientY: number) => {
    return canvasPointAt(clientX, clientY, zoomRef.current);
  }, [canvasPointAt]);

  function modalPositionForCanvasNode(x: number, y: number) {
    const canvas = canvasRef.current;
    if (!canvas) return clampFloatingPosition({ x: 260, y: 88 });
    const rect = canvas.getBoundingClientRect();
    const currentZoom = zoomRef.current;
    return clampFloatingPosition({
      x: rect.left + (x + NODE_WIDTH + 16) * currentZoom - canvas.scrollLeft,
      y: rect.top + y * currentZoom - canvas.scrollTop - TASK_DIALOG_VERTICAL_OFFSET,
    });
  }

  function modalPositionForTask(task: OsTask) {
    const node = nodeRefs.current.get(task.taskId);
    if (node) {
      const rect = node.getBoundingClientRect();
      return clampFloatingPosition({ x: rect.right + 16, y: rect.top - TASK_DIALOG_VERTICAL_OFFSET });
    }
    return modalPositionForCanvasNode(task.mindmapX || 80, task.mindmapY || 80);
  }

  function setZoomAroundPoint(nextZoom: number, focus?: { clientX: number; clientY: number }) {
    const canvas = canvasRef.current;
    const currentZoom = zoomRef.current;
    const clampedZoom = Math.round(clampNumber(nextZoom, MIN_ZOOM, MAX_ZOOM) * 100) / 100;
    if (Math.abs(clampedZoom - currentZoom) < 0.01) return;
    const focusPoint = focus;
    const focalPoint = focusPoint && canvas ? canvasPointAt(focusPoint.clientX, focusPoint.clientY, currentZoom) : null;
    zoomRef.current = clampedZoom;
    setZoom(clampedZoom);
    if (focalPoint && canvas && focusPoint) {
      window.requestAnimationFrame(() => {
        const rect = canvas.getBoundingClientRect();
        canvas.scrollLeft = focalPoint.x * clampedZoom - (focusPoint.clientX - rect.left);
        canvas.scrollTop = focalPoint.y * clampedZoom - (focusPoint.clientY - rect.top);
      });
    }
  }

  function zoomFromCenter(factor: number) {
    const canvas = canvasRef.current;
    if (!canvas) {
      setZoomAroundPoint(zoomRef.current * factor);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    setZoomAroundPoint(zoomRef.current * factor, {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });
  }

  function handleCanvasWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const factor = clampNumber(Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY), 0.94, 1.06);
    setZoomAroundPoint(zoomRef.current * factor, { clientX: event.clientX, clientY: event.clientY });
  }

  function handleCanvasPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") return;
    touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touchPointersRef.current.size === 2) {
      const points = Array.from(touchPointersRef.current.values());
      pinchRef.current = {
        distance: Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)),
        zoom: zoomRef.current,
        focus: {
          clientX: (points[0].x + points[1].x) / 2,
          clientY: (points[0].y + points[1].y) / 2,
        },
      };
    }
  }

  function handleCanvasPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch" || !touchPointersRef.current.has(event.pointerId)) return;
    touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pinch = pinchRef.current;
    if (!pinch || touchPointersRef.current.size < 2) return;
    event.preventDefault();
    const points = Array.from(touchPointersRef.current.values());
    const distance = Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y));
    const easedRatio = Math.pow(distance / pinch.distance, TOUCH_PINCH_ZOOM_EXPONENT);
    setZoomAroundPoint(pinch.zoom * easedRatio, pinch.focus ?? undefined);
  }

  function handleCanvasPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") return;
    touchPointersRef.current.delete(event.pointerId);
    if (touchPointersRef.current.size < 2) pinchRef.current = null;
  }

  function handleCanvasClick(event: React.MouseEvent<HTMLDivElement>) {
    if (suppressNextCanvasClickRef.current) {
      suppressNextCanvasClickRef.current = false;
      return;
    }
    if ((event.target as HTMLElement).closest("[data-task-node-id]")) return;
    const point = canvasPoint(event.clientX, event.clientY);
    void createTaskAt(point.x - NODE_WIDTH / 2, point.y - NODE_CIRCLE_TOP - NODE_RADIUS);
  }

  function taskNodeAt(clientX: number, clientY: number, exceptTaskId: string) {
    for (const [taskId, node] of nodeRefs.current.entries()) {
      if (taskId === exceptTaskId) continue;
      const rect = node.getBoundingClientRect();
      const currentZoom = zoomRef.current;
      const centerX = rect.left + (NODE_WIDTH / 2) * currentZoom;
      const centerY = rect.top + (NODE_CIRCLE_TOP + NODE_RADIUS) * currentZoom;
      const distance = Math.hypot(clientX - centerX, clientY - centerY);
      if (distance <= (NODE_RADIUS + 22) * currentZoom) {
        return taskId;
      }
    }
    return null;
  }

  function openTask(task: OsTask) {
    if (skipTaskClickRef.current === task.taskId) {
      skipTaskClickRef.current = null;
      return;
    }
    setForm(formFromTask(task));
    setFormPosition(modalPositionForTask(task));
  }

  async function deleteTask(taskId: string) {
    const task = latestTasksRef.current.find((candidate) => candidate.taskId === taskId);
    if (!task) return;
    pushUndo({ kind: "delete", task });
    bumpTaskMutationSeq(taskId);
    setError(null);
    setBundle((prev) => ({ ...prev, tasks: prev.tasks.filter((candidate) => candidate.taskId !== taskId) }));
    if (formRef.current?.taskId === taskId) {
      setForm(null);
      setFormPosition(null);
    }

    if (isOptimisticTaskId(taskId)) {
      canceledCreateIdsRef.current.add(taskId);
      return;
    }

    try {
      await requestTask("PATCH", { taskId, active: false });
    } catch (err) {
      setBundle((prev) => ({ ...prev, tasks: prev.tasks.some((candidate) => candidate.taskId === taskId) ? prev.tasks : [...prev.tasks, task] }));
      setError(err instanceof Error ? err.message : "delete failed");
    }
  }

  async function patchTaskOptimistic(taskId: string, patch: Partial<OsTask>, pushHistory = true) {
    const before = latestTasksRef.current.find((candidate) => candidate.taskId === taskId);
    if (!before) return;
    const after = { ...before, ...patch, updatedAt: new Date().toISOString() };
    if (pushHistory) pushUndo({ kind: "patch", before, after });
    const mutationSeq = bumpTaskMutationSeq(taskId);
    setError(null);
    setBundle((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => task.taskId === taskId ? after : task),
    }));

    try {
      const serverTaskId = await resolveTaskIdForServer(taskId);
      if (!serverTaskId) return;
      const parentTaskId = patch.parentTaskId !== undefined && patch.parentTaskId
        ? await resolveTaskIdForServer(patch.parentTaskId)
        : patch.parentTaskId;
      const payload: Record<string, unknown> = { taskId: serverTaskId };
      if (patch.parentTaskId !== undefined) payload.parentTaskId = parentTaskId || null;
      if (patch.mindmapX !== undefined) payload.mindmapX = patch.mindmapX;
      if (patch.mindmapY !== undefined) payload.mindmapY = patch.mindmapY;
      if (patch.active !== undefined) payload.active = patch.active;
      const serverTask = await requestTask("PATCH", payload);
      if (!isCurrentTaskMutation(taskId, mutationSeq, serverTask.taskId)) return;
      setBundle((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) => task.taskId === taskId || task.taskId === serverTask.taskId ? serverTask : task),
      }));
    } catch (err) {
      setBundle((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) => task.taskId === taskId ? before : task),
      }));
      setError(err instanceof Error ? err.message : "task update failed");
    }
  }

  async function undoLastTaskAction() {
    const entry = undoStackRef.current.pop();
    if (!entry) return;

    if (entry.kind === "create") {
      await deleteTaskWithoutUndo(entry.taskId);
      return;
    }

    if (entry.kind === "delete") {
      const restored = { ...entry.task, active: true };
      if (isOptimisticTaskId(restored.taskId)) {
        canceledCreateIdsRef.current.delete(restored.taskId);
      }
      bumpTaskMutationSeq(restored.taskId);
      setBundle((prev) => ({
        ...prev,
        tasks: prev.tasks.some((task) => task.taskId === restored.taskId) ? prev.tasks : [...prev.tasks, restored],
      }));
      const serverTaskId = await resolveTaskIdForServer(restored.taskId);
      if (serverTaskId) {
        await requestTask("PATCH", { taskId: serverTaskId, active: true }).catch((err) => {
          setError(err instanceof Error ? err.message : "undo failed");
        });
      }
      return;
    }

    if (entry.kind === "patch-many") {
      const beforeTaskById = new Map(entry.before.map((task) => [task.taskId, task]));
      setBundle((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) => beforeTaskById.get(task.taskId) ?? task),
      }));
      for (const before of entry.before) bumpTaskMutationSeq(before.taskId);
      await Promise.all(entry.before.map(async (before) => {
        const serverTaskId = await resolveTaskIdForServer(before.taskId);
        if (!serverTaskId) return;
        const serverParentTaskId = before.parentTaskId ? await resolveTaskIdForServer(before.parentTaskId) : null;
        await requestTask("PATCH", {
          taskId: serverTaskId,
          parentTaskId: serverParentTaskId || null,
          mindmapX: before.mindmapX,
          mindmapY: before.mindmapY,
        });
      })).catch((err) => {
        setError(err instanceof Error ? err.message : "undo failed");
      });
      return;
    }

    setBundle((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => task.taskId === entry.before.taskId ? entry.before : task),
    }));
    bumpTaskMutationSeq(entry.before.taskId);
    const serverTaskId = await resolveTaskIdForServer(entry.before.taskId);
    if (!serverTaskId) return;
    const serverParentTaskId = entry.before.parentTaskId ? await resolveTaskIdForServer(entry.before.parentTaskId) : null;
    await requestTask("PATCH", {
      taskId: serverTaskId,
      parentTaskId: serverParentTaskId || null,
      mindmapX: entry.before.mindmapX,
      mindmapY: entry.before.mindmapY,
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "undo failed");
    });
  }

  async function deleteTaskWithoutUndo(taskId: string) {
    const task = latestTasksRef.current.find((candidate) => candidate.taskId === taskId);
    bumpTaskMutationSeq(taskId);
    setBundle((prev) => ({ ...prev, tasks: prev.tasks.filter((candidate) => candidate.taskId !== taskId) }));
    if (formRef.current?.taskId === taskId) {
      setForm(null);
      setFormPosition(null);
    }
    if (isOptimisticTaskId(taskId)) {
      canceledCreateIdsRef.current.add(taskId);
      return;
    }
    await requestTask("PATCH", { taskId, active: false }).catch((err) => {
      if (task) setBundle((prev) => ({ ...prev, tasks: prev.tasks.some((candidate) => candidate.taskId === taskId) ? prev.tasks : [...prev.tasks, task] }));
      setError(err instanceof Error ? err.message : "undo failed");
    });
  }

  useEffect(() => {
    undoLastTaskActionRef.current = undoLastTaskAction;
    patchTaskOptimisticRef.current = patchTaskOptimistic;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.shiftKey || event.key.toLowerCase() !== "z") return;
      if (editableTarget(event.target)) return;
      event.preventDefault();
      void undoLastTaskActionRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) => {
      event.preventDefault();
      const dx = (event.clientX - dragging.startX) / zoomRef.current;
      const dy = (event.clientY - dragging.startY) / zoomRef.current;
      const nextPositions = nextDragPositions(dragging.items, dx, dy);
      const nextPositionByTaskId = new Map(nextPositions.map((position) => [position.taskId, position]));
      setDragging((current) => current && { ...current, moved: current.moved || Math.abs(dx) + Math.abs(dy) > 5 });
      setBundle((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) => {
          const position = nextPositionByTaskId.get(task.taskId);
          return position ? { ...task, mindmapX: position.mindmapX, mindmapY: position.mindmapY } : task;
        }),
      }));
    };
    const onUp = async (event: PointerEvent) => {
      const current = dragging;
      setDragging(null);
      const dx = (event.clientX - current.startX) / zoomRef.current;
      const dy = (event.clientY - current.startY) / zoomRef.current;
      const moved = current.moved || Math.abs(dx) + Math.abs(dy) > 5;
      if (!moved) return;
      const nextPositions = nextDragPositions(current.items, dx, dy);
      const nextPositionByTaskId = new Map(nextPositions.map((position) => [position.taskId, position]));
      skipTaskClickRef.current = current.taskId;
      window.setTimeout(() => {
        if (skipTaskClickRef.current === current.taskId) skipTaskClickRef.current = null;
      }, 0);
      const taskById = new Map(latestTasksRef.current.map((task) => [task.taskId, task]));
      const beforeTasks = current.items
        .map((item) => {
          const task = taskById.get(item.taskId);
          return task ? { ...task, mindmapX: item.originX, mindmapY: item.originY } : null;
        })
        .filter((task): task is OsTask => Boolean(task));
      if (!beforeTasks.length) return;
      const now = new Date().toISOString();
      const afterTasks = beforeTasks.map((task) => {
        const position = nextPositionByTaskId.get(task.taskId);
        return position ? { ...task, mindmapX: position.mindmapX, mindmapY: position.mindmapY, updatedAt: now } : task;
      });
      for (const task of beforeTasks) bumpTaskMutationSeq(task.taskId);
      const afterTaskById = new Map(afterTasks.map((task) => [task.taskId, task]));
      setBundle((prev) => ({
        ...prev,
        tasks: prev.tasks.map((candidate) => afterTaskById.get(candidate.taskId) ?? candidate),
      }));
      pushUndo(afterTasks.length === 1
        ? { kind: "patch", before: beforeTasks[0], after: afterTasks[0] }
        : { kind: "patch-many", before: beforeTasks, after: afterTasks });
      try {
        await Promise.all(afterTasks.map(async (task) => {
          const serverTaskId = await resolveTaskIdForServer(task.taskId);
          if (!serverTaskId) return;
          await requestTask("PATCH", {
            taskId: serverTaskId,
            mindmapX: task.mindmapX,
            mindmapY: task.mindmapY,
          });
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "drag save failed");
        load();
      }
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, load]);

  useEffect(() => {
    if (!connectingParentTaskId) return;
    const onMove = (event: PointerEvent) => {
      event.preventDefault();
      const point = canvasPoint(event.clientX, event.clientY);
      const targetTaskId = taskNodeAt(event.clientX, event.clientY, connectingParentTaskId);
      setConnecting((current) => {
        if (!current) return null;
        const next = { ...current, currentX: point.x, currentY: point.y, targetTaskId };
        connectingRef.current = next;
        return next;
      });
    };
    const onUp = async (event: PointerEvent) => {
      event.preventDefault();
      const current = connectingRef.current;
      setConnecting(null);
      if (!current) return;
      window.setTimeout(() => {
        suppressNextCanvasClickRef.current = false;
      }, 0);
      const childTaskId = taskNodeAt(event.clientX, event.clientY, current.parentTaskId);
      if (!childTaskId || childTaskId === current.parentTaskId) return;
      void patchTaskOptimisticRef.current(childTaskId, { parentTaskId: current.parentTaskId });
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [canvasPoint, connectingParentTaskId, load]);

  return (
    <div className="min-h-[calc(100vh-44px)] bg-background">
      <div className="mx-auto flex max-w-[1760px] flex-col gap-4 p-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <Network className="h-3.5 w-3.5" />
              OS task control
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">タスク</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Metric label="total" value={stats.total} />
            <Metric label="open" value={stats.open} />
            <Metric label="blocked" value={stats.blocked} tone={stats.blocked > 0 ? "danger" : "default"} />
            <Metric label="dated" value={stats.withDates} />
            <Button size="sm" onClick={() => void createTaskAt(120, 120)}>
              <Plus className="h-4 w-4" />
              新規
            </Button>
          </div>
        </header>

        <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
              <option value="all">全PJ</option>
              {bundle.projects.map((project) => (
                <option key={project.project_id} value={project.project_id}>{project.project_id} {project.project_name}</option>
              ))}
            </select>
            <select className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)}>
              <option value="all">全員</option>
              {bundle.members.map((member) => (
                <option key={member.member_id} value={member.member_id}>{memberName(member.member_id)}</option>
              ))}
            </select>
            <select className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="open">未完了</option>
              <option value="all">全status</option>
              {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="title / PJ / member" />
            </div>
          </div>
          <div className="inline-flex h-10 items-center rounded-lg border border-border bg-card p-1">
            <button
              type="button"
              onClick={() => setMode("mindmap")}
              className={cn("flex h-8 items-center gap-1 rounded-md px-3 text-sm transition-colors", mode === "mindmap" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
            >
              <GitBranch className="h-4 w-4" />
              マインドマップ
            </button>
            <button
              type="button"
              onClick={() => setMode("gantt")}
              className={cn("flex h-8 items-center gap-1 rounded-md px-3 text-sm transition-colors", mode === "gantt" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
            >
              <GanttChartSquare className="h-4 w-4" />
              ガント
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}

        {loading ? (
          <div className="grid h-[620px] place-items-center rounded-lg border border-border bg-card">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : mode === "mindmap" ? (
          <MindmapView
            tasks={visibleTasks}
            projectName={projectName}
            memberName={memberName}
            onCanvasClick={handleCanvasClick}
            onTaskOpen={openTask}
            onTaskPointerDown={(event, task) => {
              event.stopPropagation();
              setDragging({
                taskId: task.taskId,
                startX: event.clientX,
                startY: event.clientY,
                items: dragItemsForTask(task),
                moved: false,
              });
            }}
            onConnectPointerDown={(event, task) => {
              event.stopPropagation();
              event.preventDefault();
              suppressNextCanvasClickRef.current = true;
              const point = canvasPoint(event.clientX, event.clientY);
              setConnecting({
                parentTaskId: task.taskId,
                currentX: point.x,
                currentY: point.y,
                targetTaskId: null,
              });
            }}
            onTaskChildCreate={(event, task) => {
              event.stopPropagation();
              event.preventDefault();
              connectingRef.current = null;
              setConnecting(null);
              suppressNextCanvasClickRef.current = false;
              createChildTask(task);
            }}
            nodeRefs={nodeRefs}
            connecting={connecting}
            canvasRef={canvasRef}
            zoom={zoom}
            onWheel={handleCanvasWheel}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onZoomIn={() => zoomFromCenter(ZOOM_BUTTON_FACTOR)}
            onZoomOut={() => zoomFromCenter(1 / ZOOM_BUTTON_FACTOR)}
          />
        ) : (
          <GanttView
            tasks={visibleTasks}
            projects={bundle.projects}
            projectFilter={projectFilter}
            projectName={projectName}
            memberName={memberName}
            onCreate={(projectId) => void createTaskAt(120, 120, projectId)}
            onEdit={openTask}
          />
        )}
      </div>

      <TaskDialog
        form={form}
        saving={saving}
        projects={bundle.projects}
        tasks={bundle.tasks}
        projectMembers={projectMembers}
        memberName={memberName}
        position={formPosition}
        onPositionChange={setFormPosition}
        onChange={setForm}
        onClose={() => {
          setForm(null);
          setFormPosition(null);
        }}
        onSave={saveForm}
        onDelete={deleteTask}
      />
    </div>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "danger" }) {
  return (
    <div className={cn("rounded-md border px-3 py-1.5 text-xs", tone === "danger" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-border bg-card text-muted-foreground")}>
      <span className="font-mono text-sm font-semibold text-foreground">{value}</span> {label}
    </div>
  );
}

function MindmapView({
  tasks,
  projectName,
  memberName,
  onCanvasClick,
  onWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onTaskOpen,
  onTaskPointerDown,
  onConnectPointerDown,
  onTaskChildCreate,
  onZoomIn,
  onZoomOut,
  nodeRefs,
  connecting,
  canvasRef,
  zoom,
}: {
  tasks: OsTask[];
  projectName: (projectId: string) => string;
  memberName: (memberId: string | null, fallback?: string) => string;
  onCanvasClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  onWheel: (event: React.WheelEvent<HTMLDivElement>) => void;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onTaskOpen: (task: OsTask) => void;
  onTaskPointerDown: (event: React.PointerEvent<HTMLDivElement>, task: OsTask) => void;
  onConnectPointerDown: (event: React.PointerEvent<HTMLButtonElement>, task: OsTask) => void;
  onTaskChildCreate: (event: React.PointerEvent<HTMLButtonElement>, task: OsTask) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  nodeRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  connecting: {
    parentTaskId: string;
    currentX: number;
    currentY: number;
    targetTaskId: string | null;
  } | null;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
}) {
  const layoutTasks = useMemo(
    () =>
      repelMindmapTasks(tasks.map((task, index) => {
        if (task.mindmapX !== 0 || task.mindmapY !== 0) return task;
        const fallback = fallbackMindmapPosition(index);
        return { ...task, mindmapX: fallback.x, mindmapY: fallback.y };
      })),
    [tasks],
  );
  const layoutTaskById = useMemo(() => new Map(layoutTasks.map((task) => [task.taskId, task])), [layoutTasks]);
  const visibleIds = new Set(layoutTasks.map((task) => task.taskId));
  const childCountByParentId = new Map<string, number>();
  for (const task of layoutTasks) {
    if (!task.parentTaskId || !visibleIds.has(task.parentTaskId)) continue;
    childCountByParentId.set(task.parentTaskId, (childCountByParentId.get(task.parentTaskId) ?? 0) + 1);
  }
  const edges = layoutTasks
    .filter((task) => task.parentTaskId && visibleIds.has(task.parentTaskId))
    .map((task) => ({ child: task, parent: layoutTaskById.get(task.parentTaskId as string) }))
    .filter((edge): edge is { child: OsTask; parent: OsTask } => Boolean(edge.parent));
  const connectingParent = connecting ? layoutTaskById.get(connecting.parentTaskId) : null;

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-[#07100f] text-slate-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
        <span>{layoutTasks.length} tasks / {edges.length} edges</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="zoom out"
            className="grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            onClick={onZoomOut}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-12 text-center font-mono text-[11px] text-slate-300">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            aria-label="zoom in"
            className="grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            onClick={onZoomIn}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div
        ref={canvasRef}
        className="touch-none h-[680px] overflow-auto bg-[radial-gradient(circle_at_20%_10%,rgba(20,184,166,.13),transparent_28%),radial-gradient(circle_at_80%_30%,rgba(245,158,11,.10),transparent_22%),linear-gradient(to_right,rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.045)_1px,transparent_1px)] bg-[size:auto,auto,36px_36px,36px_36px]"
        onClick={onCanvasClick}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="relative" style={{ width: CANVAS_WIDTH * zoom, height: CANVAS_HEIGHT * zoom }}>
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: `scale(${zoom})` }}
          >
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              <defs>
                <marker id="task-arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="strokeWidth">
                  <path d="M 1 1 L 11 6 L 1 11 Z" fill="rgba(226,232,240,.78)" />
                </marker>
                <marker id="task-arrow-preview" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="strokeWidth">
                  <path d="M 1 1 L 11 6 L 1 11 Z" fill="rgba(251,191,36,.95)" />
                </marker>
              </defs>
              {edges.map(({ child, parent }) => {
                return (
                  <path
                    key={`${parent.taskId}-${child.taskId}`}
                    d={edgePath(parent, child)}
                    fill="none"
                    markerEnd="url(#task-arrow)"
                    stroke="rgba(226,232,240,.45)"
                    strokeDasharray="6 8"
                    strokeLinecap="round"
                    strokeWidth="2.2"
                  />
                );
              })}
              {connecting && connectingParent && (
                <path
                  d={previewEdgePath(connectingParent, { x: connecting.currentX, y: connecting.currentY })}
                  fill="none"
                  markerEnd="url(#task-arrow-preview)"
                  stroke="rgba(251,191,36,.92)"
                  strokeLinecap="round"
                  strokeWidth="3"
                />
              )}
            </svg>
            {layoutTasks.map((task) => (
              <TaskNode
                key={task.taskId}
                task={task}
                projectName={projectName}
                memberName={memberName}
                isConnectTarget={connecting?.targetTaskId === task.taskId}
                isConnectingSource={connecting?.parentTaskId === task.taskId}
                childCount={childCountByParentId.get(task.taskId) ?? 0}
                nodeRefs={nodeRefs}
                onOpen={onTaskOpen}
                onPointerDown={onTaskPointerDown}
                onConnectPointerDown={onConnectPointerDown}
                onChildCreate={onTaskChildCreate}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TaskNode({
  task,
  projectName,
  memberName,
  isConnectTarget,
  isConnectingSource,
  childCount,
  nodeRefs,
  onOpen,
  onPointerDown,
  onConnectPointerDown,
  onChildCreate,
}: {
  task: OsTask;
  projectName: (projectId: string) => string;
  memberName: (memberId: string | null, fallback?: string) => string;
  isConnectTarget: boolean;
  isConnectingSource: boolean;
  childCount: number;
  nodeRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  onOpen: (task: OsTask) => void;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>, task: OsTask) => void;
  onConnectPointerDown: (event: React.PointerEvent<HTMLButtonElement>, task: OsTask) => void;
  onChildCreate: (event: React.PointerEvent<HTMLButtonElement>, task: OsTask) => void;
}) {
  const meta = statusMeta(task.status);
  const tone = nodeTone(task.status);
  const title = nodeTitle(task);
  const isHub = childCount >= 3;
  return (
    <div
      ref={(node) => {
        if (node) nodeRefs.current.set(task.taskId, node);
        else nodeRefs.current.delete(task.taskId);
      }}
      data-task-node-id={task.taskId}
      data-child-count={childCount}
      data-task-hub={isHub ? "true" : undefined}
      className={cn(
        "group absolute select-none text-center active:cursor-grabbing",
        isConnectTarget ? "z-10" : "",
      )}
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT, transform: `translate(${task.mindmapX || 0}px, ${task.mindmapY || 0}px)` }}
      onPointerDown={(event) => onPointerDown(event, task)}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(task);
      }}
    >
      <button
        type="button"
        aria-label={`${title} の子タスクを作る`}
        className={cn(
          "absolute z-20 grid h-7 w-7 place-items-center rounded-full border text-xs shadow-lg opacity-0 transition-opacity group-hover:opacity-100",
          tone.handle,
          isConnectingSource ? "opacity-100" : "",
        )}
        style={{ left: NODE_WIDTH / 2 + NODE_RADIUS - 8, top: NODE_CIRCLE_TOP + NODE_RADIUS - 14 }}
        onPointerDown={(event) => onConnectPointerDown(event, task)}
        onPointerUp={(event) => onChildCreate(event, task)}
        onClick={(event) => event.stopPropagation()}
      >
        <Plus className="h-4 w-4" />
      </button>
      <div
        className={cn(
          "transition-transform duration-150 ease-out group-hover:scale-[1.025]",
          isConnectTarget ? "scale-[1.04]" : "",
        )}
        style={{ transformOrigin: `${NODE_WIDTH / 2}px ${NODE_CIRCLE_TOP + NODE_RADIUS}px` }}
      >
        <div
          className={cn(
            "relative mx-auto grid cursor-grab place-items-center rounded-full border-[3px] shadow-2xl transition-all",
            tone.circle,
            isHub ? "ring-[5px] ring-cyan-300/70 shadow-cyan-300/30" : "",
            isConnectTarget ? "ring-4 ring-amber-300/70" : "",
            isConnectingSource ? "ring-4 ring-amber-300/35" : "",
          )}
          style={{ width: NODE_DIAMETER, height: NODE_DIAMETER, marginTop: NODE_CIRCLE_TOP }}
        >
          <div className={cn("pointer-events-none absolute -inset-4 rounded-full border", tone.halo, isHub ? "border-cyan-200/70" : "")} />
          {isHub && (
            <div className="absolute -right-3 -top-3 grid h-8 min-w-8 place-items-center rounded-full border border-cyan-100 bg-cyan-400 px-2 text-[11px] font-bold leading-none text-slate-950 shadow-lg shadow-cyan-950/30">
              {childCount}
            </div>
          )}
          <div className="absolute left-7 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-sky-300/25" />
          <span className="relative max-w-[72px] truncate text-xl font-bold leading-none tracking-normal">{nodeInitial(task)}</span>
        </div>
        <div className="mt-3 px-1">
          <div className="h-[18px] truncate text-[15px] font-semibold leading-tight text-slate-100">{title}</div>
          <div className={cn("mt-1 truncate text-xs font-medium", tone.status)}>{meta.label}</div>
          <div className="mt-1 flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <span className="inline-flex min-w-0 items-center gap-1 truncate"><UserRound className="h-3 w-3" />{memberName(task.assigneeMemberId, task.assignee)}</span>
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{formatDate(task.dueDate)}</span>
          </div>
          <div className="mx-auto mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
            <div className={cn("h-full rounded-full", tone.progress)} style={{ width: `${Math.max(0, Math.min(100, task.progress || 0))}%` }} />
          </div>
          <div className="mt-1 truncate text-[10px] text-slate-500">{projectName(task.projectId)}</div>
        </div>
      </div>
    </div>
  );
}

type GanttTaskRow = {
  task: OsTask;
  depth: number;
  childCount: number;
  hasVisibleParent: boolean;
};

function sortGanttTasks(a: OsTask, b: OsTask) {
  return (a.startDate || "").localeCompare(b.startDate || "")
    || (a.dueDate || "").localeCompare(b.dueDate || "")
    || a.title.localeCompare(b.title)
    || a.taskId.localeCompare(b.taskId);
}

function buildGanttTaskRows(projectTasks: OsTask[]): GanttTaskRow[] {
  const visibleIds = new Set(projectTasks.map((task) => task.taskId));
  const childrenByParentId = new Map<string, OsTask[]>();
  const roots: OsTask[] = [];
  for (const task of projectTasks) {
    if (task.parentTaskId && visibleIds.has(task.parentTaskId)) {
      const list = childrenByParentId.get(task.parentTaskId) ?? [];
      list.push(task);
      childrenByParentId.set(task.parentTaskId, list);
    } else {
      roots.push(task);
    }
  }
  for (const list of childrenByParentId.values()) list.sort(sortGanttTasks);
  roots.sort(sortGanttTasks);

  const rows: GanttTaskRow[] = [];
  const visited = new Set<string>();
  function visit(task: OsTask, depth: number) {
    if (visited.has(task.taskId)) return;
    visited.add(task.taskId);
    const children = childrenByParentId.get(task.taskId) ?? [];
    rows.push({
      task,
      depth,
      childCount: children.length,
      hasVisibleParent: Boolean(task.parentTaskId && visibleIds.has(task.parentTaskId)),
    });
    for (const child of children) visit(child, depth + 1);
  }

  for (const root of roots) visit(root, 0);
  for (const task of [...projectTasks].sort(sortGanttTasks)) visit(task, 0);
  return rows;
}

function GanttView({
  tasks,
  projects,
  projectFilter,
  projectName,
  memberName,
  onCreate,
  onEdit,
}: {
  tasks: OsTask[];
  projects: Project[];
  projectFilter: string;
  projectName: (projectId: string) => string;
  memberName: (memberId: string | null, fallback?: string) => string;
  onCreate: (projectId: string) => void;
  onEdit: (task: OsTask) => void;
}) {
  const datedValues = tasks.flatMap((task) => [dateValue(task.startDate), dateValue(task.dueDate)]).filter((value): value is number => value !== null);
  const start = datedValues.length ? Math.min(...datedValues) : new Date(`${todayIso()}T00:00:00`).getTime();
  const end = datedValues.length ? Math.max(...datedValues) : new Date(`${addDaysIso(60)}T00:00:00`).getTime();
  const rangeStart = start - 3 * 86400000;
  const rangeEnd = Math.max(end + 7 * 86400000, rangeStart + 30 * 86400000);
  const span = rangeEnd - rangeStart;
  const visibleProjects = projects.filter((project) => projectFilter === "all" || project.project_id === projectFilter);
  const tasksByProject = new Map<string, OsTask[]>();
  for (const task of tasks) {
    const list = tasksByProject.get(task.projectId) ?? [];
    list.push(task);
    tasksByProject.set(task.projectId, list);
  }

  function barStyle(task: OsTask) {
    const s = dateValue(task.startDate) ?? dateValue(task.dueDate) ?? rangeStart;
    const e = dateValue(task.dueDate) ?? dateValue(task.startDate) ?? s + 86400000;
    const left = ((Math.max(s, rangeStart) - rangeStart) / span) * 100;
    const width = Math.max(2, ((Math.min(e, rangeEnd) - Math.max(s, rangeStart)) / span) * 100);
    return { left: `${left}%`, width: `${width}%` };
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid grid-cols-[320px_minmax(560px,1fr)] border-b border-border bg-muted/35 text-xs text-muted-foreground">
        <div className="border-r border-border px-3 py-2">PJ / task</div>
        <div className="grid grid-cols-4 px-3 py-2">
          <span>{new Date(rangeStart).toISOString().slice(0, 10)}</span>
          <span className="text-center">{new Date(rangeStart + span * 0.33).toISOString().slice(0, 10)}</span>
          <span className="text-center">{new Date(rangeStart + span * 0.66).toISOString().slice(0, 10)}</span>
          <span className="text-right">{new Date(rangeEnd).toISOString().slice(0, 10)}</span>
        </div>
      </div>
      <div className="max-h-[680px] overflow-auto">
        {visibleProjects.map((project) => {
          const projectRows = buildGanttTaskRows(tasksByProject.get(project.project_id) ?? []);
          return (
            <div key={project.project_id} className="border-b border-border last:border-b-0">
              <div className="grid grid-cols-[320px_minmax(560px,1fr)] bg-background">
                <div className="border-r border-border px-3 py-2 text-sm font-semibold">{projectName(project.project_id)}</div>
                <button type="button" className="px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/60" onClick={() => onCreate(project.project_id)}>
                  + 空白行から新規タスク
                </button>
              </div>
              {projectRows.map(({ task, depth, childCount, hasVisibleParent }) => (
                <button key={task.taskId} type="button" onClick={() => onEdit(task)} className="grid w-full grid-cols-[320px_minmax(560px,1fr)] text-left hover:bg-muted/35">
                  <div className="min-h-12 border-r border-border px-3 py-1.5">
                    <div className="flex min-w-0 items-center gap-1.5" style={{ paddingLeft: depth * 18 }}>
                      {hasVisibleParent && <span className="h-4 w-3 shrink-0 rounded-bl-sm border-b border-l border-muted-foreground/35" />}
                      <span className={cn("min-w-0 truncate text-[13px] font-medium", depth > 0 ? "text-foreground/85" : "text-foreground")}>{task.title.trim() || "新規タスク"}</span>
                      {childCount > 0 && (
                        <span className="shrink-0 rounded-full border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-cyan-700">
                          子{childCount}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground" style={{ paddingLeft: depth * 18 + (hasVisibleParent ? 18 : 0) }}>
                      <span className="truncate">{memberName(task.assigneeMemberId, task.assignee)}</span>
                      <span>{statusMeta(task.status).label}</span>
                      <span>{task.progress}%</span>
                    </div>
                  </div>
                  <div className="relative min-h-12 px-3 py-2.5">
                    <div className="absolute inset-x-3 top-1/2 h-px bg-border" />
                    <div className="absolute top-1/2 h-5 -translate-y-1/2 rounded-md bg-foreground" style={barStyle(task)}>
                      <div className="h-full rounded-md bg-emerald-500" style={{ width: `${task.progress || 0}%` }} />
                    </div>
                    <span className="absolute right-3 top-1 text-[10px] text-muted-foreground">{formatDate(task.startDate)} - {formatDate(task.dueDate)}</span>
                  </div>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TaskDialog({
  form,
  saving,
  projects,
  tasks,
  projectMembers,
  memberName,
  position,
  onPositionChange,
  onChange,
  onClose,
  onSave,
  onDelete,
}: {
  form: TaskFormState | null;
  saving: boolean;
  projects: Project[];
  tasks: OsTask[];
  projectMembers: (projectId: string) => Member[];
  memberName: (memberId: string | null, fallback?: string) => string;
  position: FloatingPosition | null;
  onPositionChange: (position: FloatingPosition | null) => void;
  onChange: (form: TaskFormState | null) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: (taskId: string) => void;
}) {
  const dialogDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  if (!form) return null;
  const members = projectMembers(form.projectId);
  const parentOptions = tasks.filter((task) => task.taskId !== form.taskId && task.projectId === form.projectId);
  const dialogPosition = position ?? clampFloatingPosition({ x: 260, y: 40 });
  const labelClass = "text-[10px] font-medium leading-none text-muted-foreground sm:text-right";
  const controlClass = "h-7 w-full rounded-md border border-input bg-background px-2 text-[12px] leading-none";
  const inputClass = "h-7 px-2 text-[12px] leading-none";

  function patch(patchValue: Partial<TaskFormState>) {
    onChange({ ...form, ...patchValue } as TaskFormState);
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      tabIndex={-1}
      className="fixed z-50 overflow-hidden rounded-lg border border-border bg-popover text-xs text-popover-foreground shadow-2xl ring-1 ring-foreground/10"
      onPointerDown={(event) => {
        if (editableTarget(event.target) || (event.target as HTMLElement).closest("button")) return;
        event.currentTarget.focus();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Backspace" || !form.taskId || editableTarget(event.target)) return;
        event.preventDefault();
        onDelete(form.taskId);
      }}
      style={{
        left: dialogPosition.x,
        top: dialogPosition.y,
        width: `min(${TASK_DIALOG_WIDTH}px, calc(100vw - ${TASK_DIALOG_MARGIN * 2}px))`,
        maxHeight: `calc(100vh - ${dialogPosition.y + TASK_DIALOG_MARGIN}px)`,
      }}
    >
      <div
        className="flex cursor-move items-center justify-between gap-2 border-b border-border bg-muted/45 px-2.5 py-1.5"
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button,input,select,textarea")) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          dialogDragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: dialogPosition.x,
            originY: dialogPosition.y,
          };
        }}
        onPointerMove={(event) => {
          const drag = dialogDragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          event.preventDefault();
          onPositionChange(clampFloatingPosition({
            x: drag.originX + event.clientX - drag.startX,
            y: drag.originY + event.clientY - drag.startY,
          }));
        }}
        onPointerUp={(event) => {
          const drag = dialogDragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          dialogDragRef.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={(event) => {
          const drag = dialogDragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          dialogDragRef.current = null;
        }}
      >
        <div className="min-w-0">
          <div className="truncate font-heading text-[13px] font-medium leading-none">{form.taskId ? "タスク編集" : "タスク作成"}</div>
          {form.title.trim() && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{form.title}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {form.taskId && (
            <Button className="h-7 px-2 text-xs" variant="destructive" size="sm" onClick={() => onDelete(form.taskId as string)} disabled={saving}>
              <Trash2 className="h-3.5 w-3.5" />
              削除
            </Button>
          )}
          <Button className="h-7 w-7" variant="ghost" size="icon-sm" onClick={onClose} aria-label="close task detail">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="max-h-[calc(100vh-92px)] overflow-y-auto p-2.5">
        <div className="grid gap-x-2 gap-y-1.5 sm:grid-cols-[52px_minmax(0,1fr)_58px_minmax(0,1fr)] sm:items-center">
          <Label className={labelClass}>タイトル</Label>
          <Input
            className={cn(inputClass, "sm:col-span-3")}
            value={form.title}
            onChange={(event) => patch({ title: event.target.value })}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
              event.preventDefault();
              onSave();
            }}
            autoFocus
          />
          <Label className={labelClass}>PJ</Label>
          <select className={controlClass} value={form.projectId} onChange={(event) => patch({ projectId: event.target.value, assigneeMemberId: "", parentTaskId: "" })}>
            {projects.map((project) => <option key={project.project_id} value={project.project_id}>{project.project_id} {project.project_name}</option>)}
          </select>
          <Label className={labelClass}>担当</Label>
          <select className={controlClass} value={form.assigneeMemberId} onChange={(event) => patch({ assigneeMemberId: event.target.value })}>
            <option value="">未割当</option>
            {members.map((member) => <option key={member.member_id} value={member.member_id}>{memberName(member.member_id)}</option>)}
          </select>
          <Label className={labelClass}>Status</Label>
          <select className={controlClass} value={form.status} onChange={(event) => patch({ status: event.target.value as TaskStatus })}>
            {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
          <Label className={labelClass}>Priority</Label>
          <select className={controlClass} value={form.priority} onChange={(event) => patch({ priority: event.target.value })}>
            {PRIORITY_OPTIONS.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
          </select>
          <Label className={labelClass}>Start</Label>
          <Input className={inputClass} type="date" value={form.startDate} onChange={(event) => patch({ startDate: event.target.value })} />
          <Label className={labelClass}>Due</Label>
          <Input className={inputClass} type="date" value={form.dueDate} onChange={(event) => patch({ dueDate: event.target.value })} />
          <Label className={labelClass}>Progress</Label>
          <Input className={inputClass} type="number" min={0} max={100} value={form.progress} onChange={(event) => patch({ progress: Number(event.target.value) })} />
          <Label className={labelClass}>Parent</Label>
          <select className={controlClass} value={form.parentTaskId} onChange={(event) => patch({ parentTaskId: event.target.value })}>
            <option value="">なし</option>
            {parentOptions.map((task) => <option key={task.taskId} value={task.taskId}>{task.title}</option>)}
          </select>
          <Label className={labelClass}>Description</Label>
          <Textarea className="min-h-14 py-1.5 text-[12px] leading-snug sm:col-span-3" value={form.description} onChange={(event) => patch({ description: event.target.value })} />
        </div>
      </div>
      <div className="flex justify-end gap-1.5 border-t border-border bg-muted/45 p-2">
        <Button className="h-7 px-2 text-xs" variant="outline" size="sm" onClick={onClose}>閉じる</Button>
        <Button className="h-7 px-2 text-xs" size="sm" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          保存
        </Button>
      </div>
    </div>
  );
}
