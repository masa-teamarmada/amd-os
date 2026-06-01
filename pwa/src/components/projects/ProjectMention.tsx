"use client";

import type { ReactNode } from "react";
import { ProjectLogo } from "./ProjectLogo";
import type { ProjectLogoAsset } from "@/lib/project-logo-assets";

export interface ProjectMentionProject {
  projectId: string;
  projectName: string;
  pjCode?: string | null;
  logoAssetUrl?: string | null;
  logoAsset?: ProjectLogoAsset | null;
}

interface ProjectMentionProps {
  project: ProjectMentionProject;
  label?: string;
  compact?: boolean;
}

export function ProjectMention({ project, label, compact = false }: ProjectMentionProps) {
  const display = label || project.pjCode || project.projectName || project.projectId;
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 align-baseline text-[0.92em] leading-none text-foreground">
      <ProjectLogo
        projectId={project.projectId}
        projectName={project.projectName}
        pjCode={project.pjCode}
        asset={project.logoAsset}
        logoAssetUrl={project.logoAssetUrl}
        size="xs"
      />
      {!compact && <span className="min-w-0 truncate">{display}</span>}
    </span>
  );
}

/**
 * Explicit renderer for safe prose. It only replaces tokens like [[pj:p06]]
 * or [[pj:CTB]], so ordinary body text is never auto-mutated.
 */
export function ProjectMentionText({
  text,
  projects,
}: {
  text: string;
  projects: ProjectMentionProject[];
}) {
  const byKey = new Map<string, ProjectMentionProject>();
  for (const project of projects) {
    byKey.set(project.projectId.toLowerCase(), project);
    if (project.pjCode) byKey.set(project.pjCode.toLowerCase(), project);
    byKey.set(project.projectName.toLowerCase(), project);
  }

  const parts: ReactNode[] = [];
  const token = /\[\[pj:([A-Za-z0-9_-]+)\]\]/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = token.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const project = byKey.get(match[1].toLowerCase());
    parts.push(project ? <ProjectMention key={`${match.index}-${match[1]}`} project={project} /> : match[0]);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return <>{parts}</>;
}
