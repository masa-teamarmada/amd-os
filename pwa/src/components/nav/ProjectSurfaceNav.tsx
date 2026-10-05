"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadProjectDdSummary, peekProjectDdSummary } from "@/lib/dd-client";

type Surface = "cockpit" | "workspace" | "dd";
type Props = {
  projectId: string;
  current: Surface;
  canCockpit?: boolean;
  canWorkspace?: boolean;
  ddHref?: string;
  inline?: boolean;
};

// 領域の選択を分類・子タブより上に置く。リンクの表示は権限の根拠にはしない。
export function ProjectSurfaceNav({ projectId, current, canCockpit = false, canWorkspace = false, ddHref, inline = false }: Props) {
  const base = `/project/${encodeURIComponent(projectId)}`;
  const surfaces = [
    { key: "cockpit", label: "コックピット", href: `${base}/cockpit`, visible: canCockpit },
    { key: "workspace", label: "ワークスペース", href: `${base}/workspace`, visible: canWorkspace },
    { key: "dd", label: "DDパッケージ", href: ddHref ?? `${base}/dd`, visible: Boolean(ddHref) || current === "dd" },
  ];
  return (
    <nav aria-label="PJの領域" data-testid="project-surface-navigation" className={inline ? "flex w-full flex-wrap items-center gap-1 sm:w-auto" : "flex flex-wrap gap-1 border-b border-[#d2d2d7] pb-2"}>
      {surfaces.filter((surface) => surface.visible).map((surface) => (
        <Link key={surface.key} href={surface.href} aria-current={current === surface.key ? "page" : undefined}
          className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-md border ${inline ? "px-2" : "px-3"} text-[12.5px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#027FDC] sm:min-h-9 ${current === surface.key ? "border-[#027FDC] bg-[#eef6fd] text-[#0267b2]" : "border-transparent text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"}`}>
          {surface.label}
        </Link>
      ))}
    </nav>
  );
}

// 社内画面でのDD入口は、既存の参照系キャッシュ越しに管理権限を確認する。
export function InternalProjectSurfaceNav({ projectId, current, canCockpit = true, inline = false }: Pick<Props, "projectId" | "current" | "canCockpit" | "inline">) {
  const [loaded, setLoaded] = useState<{ projectId: string; canManage: boolean } | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadProjectDdSummary(projectId).then((summary) => {
      if (!cancelled) setLoaded({ projectId, canManage: summary.canManage });
    }).catch(() => {
      if (!cancelled) setLoaded({ projectId, canManage: false });
    });
    return () => { cancelled = true; };
  }, [projectId]);
  const canManage = loaded?.projectId === projectId ? loaded.canManage : peekProjectDdSummary(projectId)?.canManage;
  return <ProjectSurfaceNav projectId={projectId} current={current} canCockpit={canCockpit} canWorkspace ddHref={canManage ? `/project/${encodeURIComponent(projectId)}/dd` : undefined} inline={inline} />;
}
