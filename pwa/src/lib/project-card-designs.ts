export const CARD_ASSET_ROLES = [
  "preview",
  "front_print",
  "back_print",
  "editable",
  "source_zip",
  "spec",
  "order_evidence",
] as const;
export type CardAssetRole = (typeof CARD_ASSET_ROLES)[number];
export type CardAsset = {
  asset_id: string;
  version_id: string;
  project_id: string;
  role: CardAssetRole;
  file_name: string;
  mime_type: string;
  byte_size: number;
  openUrl: string;
};
export type CardVersion = {
  version_id: string;
  design_id: string;
  version_no: number;
  revision_label: string;
  status: "draft" | "review" | "approved" | "superseded";
  note: string;
  print_spec: Record<string, unknown>;
  order_record: Record<string, unknown>;
  created_at: string;
  approved_at: string | null;
  assets: CardAsset[];
};
export type CardDesign = {
  design_id: string;
  owner_project_id: string;
  holder_label: string;
  holder_key: string;
  variant_key: string;
  brand_label: string;
  version: number;
  latest_draft_version_id: string | null;
  latest_approved_version_id: string | null;
  projects: { project_id: string; label: string }[];
  versions: CardVersion[];
  canEdit: boolean;
};
export type CardProject = {
  project_id: string;
  label: string;
  drive_folder_id: string | null;
  canEdit: boolean;
};
export type CardBundle = {
  designs: CardDesign[];
  projects: CardProject[];
  isAdmin: boolean;
};
export function cardLatest(design: CardDesign) {
  return (
    design.versions.find(
      (v) => v.version_id === design.latest_draft_version_id,
    ) ?? design.versions[0]
  );
}
export function driveCardFileId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (/^[A-Za-z0-9_-]{10,200}$/.test(value)) return value;
  try {
    const u = new URL(value);
    if (
      u.protocol !== "https:" ||
      !["drive.google.com", "docs.google.com"].includes(u.hostname)
    )
      return null;
    return (
      /\/(?:d|folders)\/([A-Za-z0-9_-]{10,200})(?:\/|$)/.exec(
        u.pathname,
      )?.[1] ?? null
    );
  } catch {
    return null;
  }
}
export function cardText(value: unknown, max = 160): string {
  return typeof value === "string"
    ? value
        .trim()
        .replace(/[\u0000-\u001f]/g, "")
        .slice(0, max)
    : "";
}
