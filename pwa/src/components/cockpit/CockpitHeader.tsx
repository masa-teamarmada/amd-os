"use client";

/**
 * PJコックピット最上段の見出し。
 *
 * ここに置くのは、どのタブを開いていても目に入っていてほしい「今どのPJを見ているか」だけ。
 * 契約まわりの前提は 2026-08-28 まさ依頼で「PJ概要」タブ (`CockpitProjectOverview`) へ移した。
 */

import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700",
  sales: "bg-blue-500/10 text-blue-700",
  draft: "bg-violet-500/10 text-violet-700",
  ended: "bg-zinc-200 text-zinc-500",
  frozen: "bg-amber-500/10 text-amber-700",
};

interface Props {
  project: {
    projectId: string;
    projectName: string;
    clientName: string;
    status: string;
    projectCategory?: string;
  };
  members: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  dtsu: "DTSU",
  new_business: "新規事業創出",
  ecosystem: "研究機関エコシステム",
  advisor: "社外役員/顧問",
};

const CATEGORY_COLORS: Record<string, string> = {
  dtsu: "bg-cyan-500/10 text-cyan-700",
  new_business: "bg-emerald-500/10 text-emerald-700",
  ecosystem: "bg-violet-500/10 text-violet-700",
  advisor: "bg-amber-500/10 text-amber-700",
};

export function CockpitHeader({ project, members }: Props) {
  const category = project.projectCategory || "dtsu";
  return (
    <header className="py-1">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold">{project.projectName}</h1>
        {project.clientName && <span className="text-[13px] text-[#86868b]">{project.clientName}</span>}
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_COLORS[project.status] ?? "bg-muted text-muted-foreground"}`}>{project.status === "active" ? "Active" : project.status}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${CATEGORY_COLORS[category] ?? CATEGORY_COLORS.dtsu}`}>{CATEGORY_LABELS[category] ?? "DTSU"}</span>
        <span className="text-[11px] text-[#6e6e73]">PJメンバー {members.length > 0 ? members.join(" / ") : "未設定"}</span>
        <Link
          href={`/project/${encodeURIComponent(project.projectId)}/workspace`}
          className="min-h-8 rounded-md border border-[#c9bfd0] px-2.5 py-1 text-[11px] font-semibold text-[#5f4a66] hover:bg-[#f1edf3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5f4a66]"
        >
          共有ワークスペースへ
        </Link>
      </div>
    </header>
  );
}
