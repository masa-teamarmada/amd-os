export type ProjectLogoUsageStatus =
  | "approved"
  | "active"
  | "needs_review"
  | "missing"
  | "not_configured"
  | "retired";

export type ProjectLogoVisibility = "internal" | "public" | "admin_only";

export interface ProjectLogoAsset {
  projectId: string;
  pjCode: string;
  logoAssetUrl: string | null;
  logoStoragePath: string | null;
  sourceDriveFileId: string | null;
  sourceUpdatedAt: string | null;
  usageStatus: ProjectLogoUsageStatus;
  visibility: ProjectLogoVisibility;
  alt: string;
}

export interface ProjectLogoLookupInput {
  projectId: string;
  pjCode?: string | null;
  projectName?: string | null;
  logoAssetUrl?: string | null;
  logoStoragePath?: string | null;
  sourceDriveFileId?: string | null;
  sourceUpdatedAt?: string | null;
  usageStatus?: ProjectLogoUsageStatus | null;
  visibility?: ProjectLogoVisibility | null;
}

/**
 * Static read path for reviewed logo assets.
 *
 * Real Drive logo files stay out of source for now. A future importer should
 * write reviewed images to Supabase Storage and then hydrate these fields from
 * DB columns/table instead of embedding Drive URLs in UI code.
 */
export const PROJECT_LOGO_ASSETS: Record<string, ProjectLogoAsset> = {};

export function resolveProjectLogoAsset(input: ProjectLogoLookupInput): ProjectLogoAsset {
  const pjCode = normalizePjCode(input.pjCode || input.projectName || input.projectId);
  const configured =
    PROJECT_LOGO_ASSETS[input.projectId] ||
    PROJECT_LOGO_ASSETS[pjCode.toLowerCase()] ||
    PROJECT_LOGO_ASSETS[pjCode];

  if (configured) return configured;

  return {
    projectId: input.projectId,
    pjCode,
    logoAssetUrl: input.logoAssetUrl || null,
    logoStoragePath: input.logoStoragePath || null,
    sourceDriveFileId: input.sourceDriveFileId || null,
    sourceUpdatedAt: input.sourceUpdatedAt || null,
    usageStatus: input.usageStatus || (input.logoAssetUrl ? "approved" : "not_configured"),
    visibility: input.visibility || "internal",
    alt: `${pjCode} logo`,
  };
}

export function canRenderProjectLogo(asset: ProjectLogoAsset | null | undefined): boolean {
  if (!asset?.logoAssetUrl) return false;
  return asset.usageStatus === "approved" || asset.usageStatus === "active";
}

export function projectLogoInitials(projectName?: string | null, projectId?: string | null, pjCode?: string | null) {
  const code = normalizePjCode(pjCode || projectName || projectId || "PJ");
  const ascii = code.match(/[A-Za-z0-9]+/g)?.join("") ?? "";
  if (ascii) return ascii.slice(0, 4).toUpperCase();
  return (projectId || "PJ").replace(/^p/i, "P").slice(0, 3).toUpperCase();
}

function normalizePjCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "PJ";
  const ascii = trimmed.match(/[A-Za-z0-9]+/g)?.[0];
  return (ascii || trimmed).slice(0, 12);
}
