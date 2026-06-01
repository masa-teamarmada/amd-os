"use client";

/* eslint-disable @next/next/no-img-element */
import {
  canRenderProjectLogo,
  projectLogoInitials,
  resolveProjectLogoAsset,
  type ProjectLogoAsset,
} from "@/lib/project-logo-assets";

const SIZE_CLASS = {
  xs: "h-4 w-4 text-[8px]",
  sm: "h-5 w-5 text-[9px]",
  md: "h-8 w-8 text-[11px]",
  lg: "h-10 w-10 text-xs",
} as const;

interface ProjectLogoProps {
  projectId: string;
  projectName?: string | null;
  pjCode?: string | null;
  asset?: ProjectLogoAsset | null;
  logoAssetUrl?: string | null;
  usageStatus?: ProjectLogoAsset["usageStatus"] | null;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}

export function ProjectLogo({
  projectId,
  projectName,
  pjCode,
  asset,
  logoAssetUrl,
  usageStatus,
  size = "md",
  className = "",
}: ProjectLogoProps) {
  const resolved = asset ?? resolveProjectLogoAsset({ projectId, projectName, pjCode, logoAssetUrl, usageStatus });
  const initials = projectLogoInitials(projectName, projectId, resolved.pjCode);
  const baseClass = `${SIZE_CLASS[size]} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/70 bg-background text-muted-foreground shadow-sm ${className}`;

  if (canRenderProjectLogo(resolved)) {
    return (
      <span className={baseClass} title={resolved.alt}>
        <img
          src={resolved.logoAssetUrl || ""}
          alt={resolved.alt}
          className="h-full w-full object-contain p-0.5"
          loading="lazy"
          decoding="async"
        />
      </span>
    );
  }

  return (
    <span className={`${baseClass} font-mono font-semibold tracking-normal`} title={`${resolved.pjCode} logo pending`}>
      {initials}
    </span>
  );
}
