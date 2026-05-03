"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Task, TaskStatus } from "@/types/database";

const COLUMNS: { status: TaskStatus; label: string; dotColor: string }[] = [
  { status: "pending", label: "Pending", dotColor: "bg-zinc-400" },
  { status: "todo", label: "TODO", dotColor: "bg-blue-400" },
  { status: "doing", label: "Doing", dotColor: "bg-amber-400" },
  { status: "done", label: "Done", dotColor: "bg-emerald-400" },
];

const PRIORITY_INDICATOR: Record<string, string> = {
  high: "border-l-red-400",
  medium: "border-l-amber-400",
  low: "border-l-zinc-300",
};

interface CockpitKanbanProps {
  tasks: Task[];
  projectId: string;
}

export function CockpitKanban({ tasks }: CockpitKanbanProps) {
  const tasksByStatus = new Map<TaskStatus, Task[]>();
  for (const col of COLUMNS) {
    tasksByStatus.set(
      col.status,
      tasks.filter((t) => t.status === col.status)
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Tasks</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-3">
          {COLUMNS.map((col) => {
            const colTasks = tasksByStatus.get(col.status) ?? [];
            return (
              <div key={col.status} className="space-y-2">
                <div className="flex items-center gap-1.5 pb-1 border-b border-border/50">
                  <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                  <span className="text-xs font-medium text-muted-foreground">
                    {col.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60 ml-auto">
                    {colTasks.length}
                  </span>
                </div>
                <div className="space-y-1.5 min-h-16">
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`p-2 bg-muted/40 rounded-md border-l-2 text-xs cursor-pointer hover:bg-muted/70 transition-colors ${
                        PRIORITY_INDICATOR[task.priority ?? "low"] ?? "border-l-transparent"
                      }`}
                    >
                      <p className="font-medium leading-snug">{task.title}</p>
                      {task.assignee && (
                        <p className="text-muted-foreground mt-1">
                          {task.assignee}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
