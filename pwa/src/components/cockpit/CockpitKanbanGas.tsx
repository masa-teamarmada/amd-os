"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateTaskStatus } from "@/lib/supabase-data";

const COLUMNS = [
  { status: "pending", label: "Pending", dotColor: "bg-zinc-400", borderColor: "border-l-zinc-400" },
  { status: "todo", label: "TODO", dotColor: "bg-blue-400", borderColor: "border-l-blue-400" },
  { status: "doing", label: "Doing", dotColor: "bg-amber-400", borderColor: "border-l-amber-400" },
  { status: "done", label: "Done", dotColor: "bg-emerald-400", borderColor: "border-l-emerald-400" },
] as const;

const STATUS_OPTIONS = COLUMNS.map((c) => ({ value: c.status, label: c.label }));

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  high: { label: "高", color: "text-red-500 bg-red-50" },
  medium: { label: "中", color: "text-amber-600 bg-amber-50" },
  low: { label: "低", color: "text-blue-500 bg-blue-50" },
};

interface Task {
  taskId: string;
  title: string;
  status: string;
  assignee?: string;
  priority?: string;
  description?: string;
  milestoneId?: string;
}

interface Milestone {
  milestoneId: string;
  title: string;
  tag: string;
}

interface Props {
  tasks: Task[];
  milestones?: Milestone[];
  memberMap?: Record<string, string>;
  onTaskStatusChange?: (taskId: string, newStatus: string) => void;
}

export function CockpitKanbanGas({ tasks, milestones = [], memberMap = {} }: Props) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [showDone, setShowDone] = useState(false);
  const dragRef = useRef<HTMLDivElement | null>(null);

  // MS名前引き用マップ
  const msMap = new Map(milestones.map((m) => [m.milestoneId, m]));

  const tasksByStatus = new Map<string, Task[]>();
  for (const col of COLUMNS) {
    tasksByStatus.set(
      col.status,
      localTasks.filter((t) => t.status === col.status)
    );
  }

  // ステータス変更（Supabase書き込み + ローカル更新）
  const changeStatus = useCallback(async (taskId: string, newStatus: string) => {
    // Optimistic update
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.taskId === taskId ? { ...t, status: newStatus } : t
      )
    );
    const ok = await updateTaskStatus(taskId, newStatus);
    if (!ok) {
      // Revert
      setLocalTasks((prev) =>
        prev.map((t) =>
          t.taskId === taskId ? { ...t, status: tasks.find((orig) => orig.taskId === taskId)?.status || t.status } : t
        )
      );
    }
  }, [tasks]);

  function handleDrop(newStatus: string) {
    if (!dragTaskId) return;
    changeStatus(dragTaskId, newStatus);
    setDragTaskId(null);
    setDropTarget(null);
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <h3 className="text-sm font-medium">Tasks</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {COLUMNS.map((col) => {
              const colTasks = tasksByStatus.get(col.status) ?? [];
              const isOver = dropTarget === col.status;
              return (
                <div
                  key={col.status}
                  className={`space-y-2 rounded-lg p-1.5 transition-colors ${
                    isOver ? "bg-[#007aff]/5 ring-1 ring-[#007aff]/30" : ""
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropTarget(col.status);
                  }}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(col.status);
                  }}
                >
                  <div className="flex items-center gap-1.5 pb-1 border-b border-border/50">
                    <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                    <span className="text-xs font-medium text-muted-foreground">
                      {col.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 ml-auto">
                      {colTasks.length}
                    </span>
                    {col.status === "done" && colTasks.length > 0 && (
                      <button
                        onClick={() => setShowDone(!showDone)}
                        className="text-[10px] text-muted-foreground/60 hover:text-[#007aff] transition-colors"
                      >
                        {showDone ? "隠す" : "表示"}
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5 min-h-16">
                    {(col.status === "done" && !showDone ? [] : colTasks).map((task) => {
                      const ms = task.milestoneId ? msMap.get(task.milestoneId) : null;
                      const pri = task.priority ? PRIORITY_LABELS[task.priority] : null;
                      return (
                        <div
                          key={task.taskId}
                          ref={dragTaskId === task.taskId ? dragRef : null}
                          draggable
                          onDragStart={() => setDragTaskId(task.taskId)}
                          onDragEnd={() => {
                            setDragTaskId(null);
                            setDropTarget(null);
                          }}
                          onClick={() => setSelectedTask(task)}
                          className={`p-2 bg-muted/40 rounded-md border-l-2 ${col.borderColor} text-xs cursor-pointer hover:bg-muted/70 transition-colors ${
                            dragTaskId === task.taskId ? "opacity-40" : ""
                          }`}
                        >
                          <p className="font-medium leading-snug">{task.title}</p>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {task.assignee && (
                              <span className="text-[10px] text-muted-foreground">
                                {memberMap[task.assignee] || task.assignee}
                              </span>
                            )}
                            {pri && (
                              <span className={`text-[9px] px-1 rounded ${pri.color}`}>
                                {pri.label}
                              </span>
                            )}
                            {ms && (
                              <span className="text-[9px] text-[#007aff]/70 bg-[#007aff]/5 px-1 rounded truncate max-w-[80px]">
                                {ms.title}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          ms={selectedTask.milestoneId ? msMap.get(selectedTask.milestoneId) : undefined}
          memberMap={memberMap}
          onClose={() => setSelectedTask(null)}
          onStatusChange={(newStatus) => {
            changeStatus(selectedTask.taskId, newStatus);
            setSelectedTask({ ...selectedTask, status: newStatus });
          }}
        />
      )}
    </>
  );
}

function TaskDetailModal({
  task,
  ms,
  memberMap,
  onClose,
  onStatusChange,
}: {
  task: Task;
  ms?: Milestone;
  memberMap: Record<string, string>;
  onClose: () => void;
  onStatusChange: (newStatus: string) => void;
}) {
  const statusCol = COLUMNS.find((c) => c.status === task.status);
  const pri = task.priority ? PRIORITY_LABELS[task.priority] : null;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Status + Priority */}
          <div className="flex items-center gap-2">
            {statusCol && (
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-muted`}>
                <span className={`w-2 h-2 rounded-full ${statusCol.dotColor}`} />
                {statusCol.label}
              </span>
            )}
            {pri && (
              <span className={`text-xs px-2 py-0.5 rounded ${pri.color}`}>
                優先度: {pri.label}
              </span>
            )}
          </div>

          {/* Assignee */}
          {task.assignee && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">担当</p>
              <p className="text-sm">{memberMap[task.assignee] || task.assignee}</p>
            </div>
          )}

          {/* Linked MS */}
          {ms && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">紐付きMS</p>
              <p className="text-sm">
                {ms.title}
                <span className="text-xs text-muted-foreground ml-1">({ms.tag})</span>
              </p>
            </div>
          )}

          {/* Description */}
          {task.description && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">説明</p>
              <div className="text-sm whitespace-pre-wrap bg-muted/30 rounded-lg p-3 max-h-48 overflow-y-auto leading-relaxed">
                {task.description}
              </div>
            </div>
          )}

          {/* Status change buttons */}
          <div>
            <p className="text-[10px] text-muted-foreground mb-1.5">ステータス変更</p>
            <div className="flex gap-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  disabled={opt.value === task.status}
                  onClick={() => onStatusChange(opt.value)}
                  className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                    opt.value === task.status
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white border-border hover:bg-muted/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
