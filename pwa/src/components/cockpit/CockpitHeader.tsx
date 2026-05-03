"use client";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700",
  sales: "bg-blue-500/10 text-blue-700",
  draft: "bg-violet-500/10 text-violet-700",
  ended: "bg-zinc-200 text-zinc-500",
  frozen: "bg-amber-500/10 text-amber-700",
};

interface Props {
  project: { projectId: string; projectName: string; clientName: string; status: string };
}

export function CockpitHeader({ project }: Props) {
  return (
    <div className="flex items-center gap-3 py-1">
      <h1 className="text-lg font-bold">{project.projectName}</h1>
      {project.clientName && (
        <span className="text-[13px] text-[#86868b]">{project.clientName}</span>
      )}
      <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_COLORS[project.status] ?? "bg-muted text-muted-foreground"}`}>
        {project.status === "active" ? "Active" : project.status}
      </span>
    </div>
  );
}
