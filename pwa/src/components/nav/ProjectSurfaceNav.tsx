"use client";

import { Gauge, Users, Files } from "lucide-react";
import styles from "./ProjectNavigation.module.css";
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
};

// 左メニューの先頭で領域を選ぶ。リンクの表示は権限の根拠にはしない。
export function ProjectSurfaceNav({ projectId, current, canCockpit = false, canWorkspace = false, ddHref }: Props) {
  const base = `/project/${encodeURIComponent(projectId)}`;
  const surfaces = [
    { key: "cockpit", label: "コックピット", icon: Gauge, href: `${base}/cockpit`, visible: canCockpit },
    { key: "workspace", label: "ワークスペース", icon: Users, href: `${base}/workspace`, visible: canWorkspace },
    { key: "dd", label: "DDパッケージ", icon: Files, href: ddHref ?? `${base}/dd`, visible: Boolean(ddHref) || current === "dd" },
  ];
  return (
    <nav aria-label="PJの領域" data-testid="project-surface-navigation" className={styles.surfaces}>
      {surfaces.filter((surface) => surface.visible).map((surface) => (
        <Link key={surface.key} href={surface.href} aria-current={current === surface.key ? "page" : undefined}
          className={`${styles.row} ${styles.surface}`}>
          <surface.icon className="h-4 w-4 shrink-0" aria-hidden="true" />{surface.label}
        </Link>
      ))}
    </nav>
  );
}

// 社内画面でのDD入口は、既存の参照系キャッシュ越しに管理権限を確認する。
export function InternalProjectSurfaceNav({ projectId, current, canCockpit = true }: Pick<Props, "projectId" | "current" | "canCockpit" >) {
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
  return <ProjectSurfaceNav projectId={projectId} current={current} canCockpit={canCockpit} canWorkspace ddHref={canManage ? `/project/${encodeURIComponent(projectId)}/dd` : undefined} />;
}
