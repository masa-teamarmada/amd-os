"use client";

import { Gauge, Users, Files } from "lucide-react";
import styles from "./ProjectNavigation.module.css";
import Link from "next/link";
import { useEffect, useState } from "react";

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

// 各領域の入口を独立に再照合する。表示結果を他領域の権限へ流用しない。
export function InternalProjectSurfaceNav({ projectId, current, canCockpit = true }: Pick<Props, "projectId" | "current" | "canCockpit" >) {
  const [loaded, setLoaded] = useState<{ projectId: string; canCockpit: boolean; canWorkspace: boolean; ddHref?: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/project-surface/navigation/${encodeURIComponent(projectId)}`, {cache: 'no-store'}).then(async response => {
      if (!response.ok) throw new Error('navigation_unavailable');
      return await response.json() as {canCockpit: boolean; canWorkspace: boolean; ddHref?: string};
    }).then((summary) => {
      if (!cancelled) setLoaded({ ...summary, projectId });
    }).catch(() => {
      if (!cancelled) setLoaded({ projectId, canCockpit: false, canWorkspace: false });
    });
    return () => { cancelled = true; };
  }, [projectId]);
  const summary = loaded?.projectId === projectId ? loaded : null;
  return <ProjectSurfaceNav projectId={projectId} current={current} canCockpit={current === 'cockpit' || (canCockpit && !!summary?.canCockpit)} canWorkspace={current === 'workspace' || !!summary?.canWorkspace} ddHref={summary?.ddHref} />;
}
