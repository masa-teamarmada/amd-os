"use client";

import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Filter,
  GanttChartSquare,
  GitBranch,
  Loader2,
  Network,
  Plus,
  Save,
  Search,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

function nodeCenter(task: OsTask) {
  return {
    x: (task.mindmapX || 0) + NODE_WIDTH / 2,
    y: (task.mindmapY || 0) + NODE_CIRCLE_TOP + NODE_RADIUS,
  };
}

function curvedPath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const bend = Math.min(90, Math.max(24, distance * 0.14));
  const normalX = (-dy / distance) * bend;
  const normalY = (dx / distance) * bend;
  const cx = (from.x + to.x) / 2 + normalX;
  const cy = (from.y + to.y) / 2 + normalY;
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

function edgePath(parent: OsTask, child: OsTask) {
  const from = nodeCenter(parent);
  const to = nodeCenter(child);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const unitX = dx / distance;
  const unitY = dy / distance;
  return curvedPath(
    { x: from.x + unitX * (NODE_RADIUS + 8), y: from.y + unitY * (NODE_RADIUS + 8) },
    { x: to.x - unitX * (NODE_RADIUS + 16), y: to.y - unitY * (NODE_RADIUS + 16) },
  );
}

function previewEdgePath(parent: OsTask, to: { x: number; y: number }) {
  const from = nodeCenter(parent);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  return curvedPath(
    { x: from.x + (dx / distance) * (NODE_RADIUS + 8), y: from.y + (dy / distance) * (NODE_RADIUS + 8) },
    to,
  );
}

function nodeTone(status: string) {
  switch (normalizeStatus(status)) {
    case "blocked":
      return {
        circle: "border-rose-300 bg-rose-950/45 text-rose-50 shadow-rose-950/30",
        halo: "border-rose-400/20",
        handle: "border-rose-200 bg-rose-500 text-white",
        status: "text-rose-300",
      };
    case "review":
      return {
        circle: "border-amber-300 bg-amber-950/45 text-amber-50 shadow-amber-950/30",
        halo: "border-amber-400/30",
        handle: "border-amber-100 bg-amber-500 text-black",
        status: "text-amber-300",
      };
    case "done":
      return {
        circle: "border-emerald-300 bg-emerald-950/45 text-emerald-50 shadow-emerald-950/30",
        halo: "border-emerald-400/20",
        handle: "border-emerald-100 bg-emerald-500 text-black",
        status: "text-emerald-300",
      };
    case "doing":
      return {
        circle: "border-blue-300 bg-cyan-950/50 text-blue-50 shadow-cyan-950/30",
        halo: "border-blue-400/25",
        handle: "border-blue-100 bg-blue-500 text-white",
        status: "text-blue-300",
      };
    default:
      return {
        circle: "border-sky-400 bg-emerald-950/45 text-sky-50 shadow-emerald-950/30",
        halo: "border-sky-400/20",
        handle: "border-sky-100 bg-sky-500 text-white",
        status: "text-sky-300",
      };
  }
}

function nodeInitial(task: OsTask) {
  const title = task.title.trim();
  return (title ? title.slice(0, 2) : task.projectId).toUpperCase();
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
  const [dragging, setDragging] = useState<{
    taskId: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
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
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());

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
    connectingRef.current = connecting;
  }, [connecting]);

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

  async function mutateTask(method: "POST" | "PATCH", payload: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/tasks", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok || !json.ok) throw new Error(json.error || "task mutation failed");
    const next = json.task as OsTask;
    setBundle((prev) => ({
      ...prev,
      tasks: method === "POST"
        ? [...prev.tasks, next]
        : prev.tasks.map((task) => (task.taskId === next.taskId ? next : task)),
    }));
    return next;
  }

  async function saveForm() {
    if (!form) return;
    try {
      const payload = {
        taskId: form.taskId,
        title: form.title || "新規タスク",
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
      await mutateTask(form.taskId ? "PATCH" : "POST", payload);
      setForm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed");
    }
  }

  function openCreateAt(x: number, y: number, projectId = projectFilter === "all" ? bundle.projects[0]?.project_id : projectFilter) {
    if (!projectId) return;
    setForm(emptyForm(projectId, x, y));
  }

  function canvasPoint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round(clientX - rect.left + canvas.scrollLeft),
      y: Math.round(clientY - rect.top + canvas.scrollTop),
    };
  }

  function handleCanvasClick(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("[data-task-node-id]")) return;
    const point = canvasPoint(event.clientX, event.clientY);
    openCreateAt(Math.max(20, point.x - NODE_WIDTH / 2), Math.max(20, point.y - NODE_CIRCLE_TOP - NODE_RADIUS));
  }

  function taskNodeAt(clientX: number, clientY: number, exceptTaskId: string) {
    for (const [taskId, node] of nodeRefs.current.entries()) {
      if (taskId === exceptTaskId) continue;
      const rect = node.getBoundingClientRect();
      const centerX = rect.left + NODE_WIDTH / 2;
      const centerY = rect.top + NODE_CIRCLE_TOP + NODE_RADIUS;
      const distance = Math.hypot(clientX - centerX, clientY - centerY);
      if (distance <= NODE_RADIUS + 22) {
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
  }

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) => {
      event.preventDefault();
      const dx = event.clientX - dragging.startX;
      const dy = event.clientY - dragging.startY;
      const nextX = Math.max(0, Math.min(CANVAS_WIDTH - NODE_WIDTH, Math.round(dragging.originX + dx)));
      const nextY = Math.max(0, Math.min(CANVAS_HEIGHT - NODE_HEIGHT, Math.round(dragging.originY + dy)));
      setDragging((current) => current && { ...current, moved: current.moved || Math.abs(dx) + Math.abs(dy) > 5 });
      setBundle((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) =>
          task.taskId === dragging.taskId ? { ...task, mindmapX: nextX, mindmapY: nextY } : task,
        ),
      }));
    };
    const onUp = async (event: PointerEvent) => {
      const current = dragging;
      setDragging(null);
      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      const moved = current.moved || Math.abs(dx) + Math.abs(dy) > 5;
      if (!moved) return;
      skipTaskClickRef.current = current.taskId;
      window.setTimeout(() => {
        if (skipTaskClickRef.current === current.taskId) skipTaskClickRef.current = null;
      }, 0);
      const task = latestTasksRef.current.find((candidate) => candidate.taskId === current.taskId);
      if (!task) return;
      try {
        await mutateTask("PATCH", {
          taskId: current.taskId,
          mindmapX: task.mindmapX,
          mindmapY: task.mindmapY,
        });
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
      const childTaskId = taskNodeAt(event.clientX, event.clientY, current.parentTaskId);
      if (!childTaskId || childTaskId === current.parentTaskId) return;
      try {
        await mutateTask("PATCH", {
          taskId: childTaskId,
          parentTaskId: current.parentTaskId,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "edge save failed");
        load();
      }
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [connectingParentTaskId, load]);

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
            <Button size="sm" onClick={() => openCreateAt(120, 120)}>
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
                originX: task.mindmapX || 80,
                originY: task.mindmapY || 80,
                moved: false,
              });
            }}
            onConnectPointerDown={(event, task) => {
              event.stopPropagation();
              event.preventDefault();
              const point = canvasPoint(event.clientX, event.clientY);
              setConnecting({
                parentTaskId: task.taskId,
                currentX: point.x,
                currentY: point.y,
                targetTaskId: null,
              });
            }}
            nodeRefs={nodeRefs}
            connecting={connecting}
            canvasRef={canvasRef}
          />
        ) : (
          <GanttView
            tasks={visibleTasks}
            projects={bundle.projects}
            projectFilter={projectFilter}
            projectName={projectName}
            memberName={memberName}
            onCreate={(projectId) => openCreateAt(120, 120, projectId)}
            onEdit={(task) => setForm(formFromTask(task))}
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
        onChange={setForm}
        onClose={() => setForm(null)}
        onSave={saveForm}
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
  onTaskOpen,
  onTaskPointerDown,
  onConnectPointerDown,
  nodeRefs,
  connecting,
  canvasRef,
}: {
  tasks: OsTask[];
  projectName: (projectId: string) => string;
  memberName: (memberId: string | null, fallback?: string) => string;
  onCanvasClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  onTaskOpen: (task: OsTask) => void;
  onTaskPointerDown: (event: React.PointerEvent<HTMLDivElement>, task: OsTask) => void;
  onConnectPointerDown: (event: React.PointerEvent<HTMLButtonElement>, task: OsTask) => void;
  nodeRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  connecting: {
    parentTaskId: string;
    currentX: number;
    currentY: number;
    targetTaskId: string | null;
  } | null;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}) {
  const layoutTasks = useMemo(
    () =>
      tasks.map((task, index) => {
        if (task.mindmapX !== 0 || task.mindmapY !== 0) return task;
        const fallback = fallbackMindmapPosition(index);
        return { ...task, mindmapX: fallback.x, mindmapY: fallback.y };
      }),
    [tasks],
  );
  const layoutTaskById = useMemo(() => new Map(layoutTasks.map((task) => [task.taskId, task])), [layoutTasks]);
  const visibleIds = new Set(layoutTasks.map((task) => task.taskId));
  const edges = layoutTasks
    .filter((task) => task.parentTaskId && visibleIds.has(task.parentTaskId))
    .map((task) => ({ child: task, parent: layoutTaskById.get(task.parentTaskId as string) }))
    .filter((edge): edge is { child: OsTask; parent: OsTask } => Boolean(edge.parent));
  const connectingParent = connecting ? layoutTaskById.get(connecting.parentTaskId) : null;

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-[#07100f] text-slate-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
        <span>{layoutTasks.length} tasks / {edges.length} edges</span>
        <span>全PJの依存関係</span>
      </div>
      <div ref={canvasRef} className="h-[680px] overflow-auto bg-[radial-gradient(circle_at_20%_10%,rgba(20,184,166,.13),transparent_28%),radial-gradient(circle_at_80%_30%,rgba(245,158,11,.10),transparent_22%),linear-gradient(to_right,rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.045)_1px,transparent_1px)] bg-[size:auto,auto,36px_36px,36px_36px]" onClick={onCanvasClick}>
        <div className="relative" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
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
              nodeRefs={nodeRefs}
              onOpen={onTaskOpen}
              onPointerDown={onTaskPointerDown}
              onConnectPointerDown={onConnectPointerDown}
            />
          ))}
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
  nodeRefs,
  onOpen,
  onPointerDown,
  onConnectPointerDown,
}: {
  task: OsTask;
  projectName: (projectId: string) => string;
  memberName: (memberId: string | null, fallback?: string) => string;
  isConnectTarget: boolean;
  isConnectingSource: boolean;
  nodeRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  onOpen: (task: OsTask) => void;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>, task: OsTask) => void;
  onConnectPointerDown: (event: React.PointerEvent<HTMLButtonElement>, task: OsTask) => void;
}) {
  const meta = statusMeta(task.status);
  const tone = nodeTone(task.status);
  return (
    <div
      ref={(node) => {
        if (node) nodeRefs.current.set(task.taskId, node);
        else nodeRefs.current.delete(task.taskId);
      }}
      data-task-node-id={task.taskId}
      className={cn(
        "group absolute select-none text-center transition-transform active:cursor-grabbing",
        isConnectTarget ? "scale-105" : "hover:scale-[1.02]",
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
        aria-label={`${task.title} から親子関係を作る`}
        className={cn(
          "absolute z-20 grid h-7 w-7 place-items-center rounded-full border text-xs shadow-lg opacity-0 transition-opacity group-hover:opacity-100",
          tone.handle,
          isConnectingSource ? "opacity-100" : "",
        )}
        style={{ left: NODE_WIDTH / 2 + NODE_RADIUS - 8, top: NODE_CIRCLE_TOP + NODE_RADIUS - 14 }}
        onPointerDown={(event) => onConnectPointerDown(event, task)}
        onClick={(event) => event.stopPropagation()}
      >
        <Plus className="h-4 w-4" />
      </button>
      <div
        className={cn(
          "relative mx-auto grid cursor-grab place-items-center rounded-full border-[3px] shadow-2xl transition-all",
          tone.circle,
          isConnectTarget ? "ring-4 ring-amber-300/70" : "",
          isConnectingSource ? "ring-4 ring-amber-300/35" : "",
        )}
        style={{ width: NODE_DIAMETER, height: NODE_DIAMETER, marginTop: NODE_CIRCLE_TOP }}
      >
        <div className={cn("pointer-events-none absolute -inset-4 rounded-full border", tone.halo)} />
        <div className="absolute left-7 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-sky-300/25" />
        <span className="relative max-w-[72px] truncate text-xl font-bold leading-none tracking-normal">{nodeInitial(task)}</span>
      </div>
      <div className="mt-3 px-1">
        <div className="truncate text-[15px] font-semibold leading-tight text-slate-100">{task.title}</div>
        <div className={cn("mt-1 truncate text-xs font-medium", tone.status)}>{meta.label}</div>
        <div className="mt-1 flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <span className="inline-flex min-w-0 items-center gap-1 truncate"><UserRound className="h-3 w-3" />{memberName(task.assigneeMemberId, task.assignee)}</span>
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{formatDate(task.dueDate)}</span>
        </div>
        <div className="mx-auto mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-sky-300" style={{ width: `${Math.max(0, Math.min(100, task.progress || 0))}%` }} />
        </div>
        <div className="mt-1 truncate text-[10px] text-slate-500">{projectName(task.projectId)}</div>
      </div>
    </div>
  );
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
          const projectTasks = (tasksByProject.get(project.project_id) ?? []).sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
          return (
            <div key={project.project_id} className="border-b border-border last:border-b-0">
              <div className="grid grid-cols-[320px_minmax(560px,1fr)] bg-background">
                <div className="border-r border-border px-3 py-2 text-sm font-semibold">{projectName(project.project_id)}</div>
                <button type="button" className="px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/60" onClick={() => onCreate(project.project_id)}>
                  + 空白行から新規タスク
                </button>
              </div>
              {projectTasks.map((task) => (
                <button key={task.taskId} type="button" onClick={() => onEdit(task)} className="grid w-full grid-cols-[320px_minmax(560px,1fr)] text-left hover:bg-muted/35">
                  <div className="min-h-14 border-r border-border px-3 py-2">
                    <div className="truncate text-sm font-medium">{task.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{memberName(task.assigneeMemberId, task.assignee)}</span>
                      <span>{statusMeta(task.status).label}</span>
                      <span>{task.progress}%</span>
                    </div>
                  </div>
                  <div className="relative min-h-14 px-3 py-3">
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
  onChange,
  onClose,
  onSave,
}: {
  form: TaskFormState | null;
  saving: boolean;
  projects: Project[];
  tasks: OsTask[];
  projectMembers: (projectId: string) => Member[];
  memberName: (memberId: string | null, fallback?: string) => string;
  onChange: (form: TaskFormState | null) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!form) return null;
  const members = projectMembers(form.projectId);
  const parentOptions = tasks.filter((task) => task.taskId !== form.taskId && task.projectId === form.projectId);

  function patch(patchValue: Partial<TaskFormState>) {
    onChange({ ...form, ...patchValue } as TaskFormState);
  }

  return (
    <Dialog open={Boolean(form)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{form.taskId ? "タスク編集" : "タスク作成"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>タイトル</Label>
            <Input value={form.title} onChange={(event) => patch({ title: event.target.value })} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>PJ</Label>
            <select className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" value={form.projectId} onChange={(event) => patch({ projectId: event.target.value, assigneeMemberId: "", parentTaskId: "" })}>
              {projects.map((project) => <option key={project.project_id} value={project.project_id}>{project.project_id} {project.project_name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>担当</Label>
            <select className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" value={form.assigneeMemberId} onChange={(event) => patch({ assigneeMemberId: event.target.value })}>
              <option value="">未割当</option>
              {members.map((member) => <option key={member.member_id} value={member.member_id}>{memberName(member.member_id)}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <select className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" value={form.status} onChange={(event) => patch({ status: event.target.value as TaskStatus })}>
              {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <select className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" value={form.priority} onChange={(event) => patch({ priority: event.target.value })}>
              {PRIORITY_OPTIONS.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Start</Label>
            <Input type="date" value={form.startDate} onChange={(event) => patch({ startDate: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Due</Label>
            <Input type="date" value={form.dueDate} onChange={(event) => patch({ dueDate: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Progress</Label>
            <Input type="number" min={0} max={100} value={form.progress} onChange={(event) => patch({ progress: Number(event.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>Parent</Label>
            <select className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" value={form.parentTaskId} onChange={(event) => patch({ parentTaskId: event.target.value })}>
              <option value="">なし</option>
              {parentOptions.map((task) => <option key={task.taskId} value={task.taskId}>{task.title}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(event) => patch({ description: event.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>閉じる</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
