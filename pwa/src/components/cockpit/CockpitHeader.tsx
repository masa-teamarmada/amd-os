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
      <div className="flex-1" />
      {/* ⚠️ 暫定リンク: まさが指す本来の飛び先は不明 (git 履歴で特定不能、要確認)。
         情報を失わないために残す。次セッションで正しい飛び先に直す。詳細は HANDOFF / BUGS 2026-05-06 */}
      <Link
        href={`/admin/projects#${project.projectId}`}
        className="text-[12px] text-[#86868b] hover:text-foreground hover:underline"
        title="config (暫定: PJ 台帳の当該行 — 本来の飛び先要確認)"
      >
        ⚙️ config
      </Link>
    </div>
  );
}
