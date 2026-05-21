"use client";

import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700",
  sales: "bg-blue-500/10 text-blue-700",
  draft: "bg-violet-500/10 text-violet-700",
  ended: "bg-zinc-200 text-zinc-500",
  frozen: "bg-amber-500/10 text-amber-700",
};

interface Props {
  project: { projectId: string; projectName: string; clientName: string; status: string; projectCategory?: string };
}

const CATEGORY_LABELS: Record<string, string> = {
  dtsu: "DTSU",
  ecosystem: "研究機関エコシステム",
  advisor: "社外役員/顧問",
};

const CATEGORY_COLORS: Record<string, string> = {
  dtsu: "bg-cyan-500/10 text-cyan-700",
  ecosystem: "bg-violet-500/10 text-violet-700",
  advisor: "bg-amber-500/10 text-amber-700",
};

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
      <span className={`text-[11px] px-2 py-0.5 rounded-full ${CATEGORY_COLORS[project.projectCategory || "dtsu"] ?? CATEGORY_COLORS.dtsu}`}>
        {CATEGORY_LABELS[project.projectCategory || "dtsu"] ?? "DTSU"}
      </span>
      <div className="flex-1" />
      <Link
        href={`/project/${project.projectId}/config`}
        className="text-[12px] text-[#86868b] hover:text-foreground hover:underline"
        title="PJ 設定 (基本情報 / メンバー / 契約 / 請求書)"
      >
        ⚙️ config
      </Link>
    </div>
  );
}
