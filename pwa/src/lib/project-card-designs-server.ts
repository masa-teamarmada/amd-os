import "server-only";
import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { google } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMemberAccess } from "@/lib/project-workspace";
import { memberSurfacePermission } from "@/lib/project-surface-permissions";
import { WORKSPACE_DOCUMENTS_BUCKET } from "@/lib/workspace-documents-core";
import { getGoogleAuthAsync } from "@/lib/sources/google";
import {
  CARD_ASSET_ROLES,
  cardText,
  driveCardFileId,
  type CardBundle,
  type CardDesign,
  type CardProject,
} from "./project-card-designs";
export async function amieCardAccess() {
  return getCurrentMemberAccess();
}
export function amieCardCanRead(
  m: NonNullable<Awaited<ReturnType<typeof amieCardAccess>>>,
  p: string,
) {
  return !!memberSurfacePermission(m, p, "cockpit");
}
export function amieCardCanEdit(
  m: NonNullable<Awaited<ReturnType<typeof amieCardAccess>>>,
  p: string,
) {
  return memberSurfacePermission(m, p, "cockpit") === "edit";
}
const checked = (r: { error: unknown; data: unknown }) => {
  if (r.error) throw new Error("名刺台帳を読み込みに失敗しました");
  return r.data;
};
// Stable pagination prevents PostgREST's row ceiling from hiding older versions.
async function amieCardPages<T>(
  make: () => {
    range: (
      a: number,
      b: number,
    ) => PromiseLike<{ data: T[] | null; error: unknown }>;
  },
) {
  const data: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const r = await make().range(offset, offset + 499);
    if (r.error) return { data: null, error: r.error };
    data.push(...(r.data || []));
    if ((r.data?.length || 0) < 500) return { data, error: null };
  }
}
async function amieLoadCardDesignsUncached(
  member: NonNullable<Awaited<ReturnType<typeof amieCardAccess>>>,
  projectId?: string,
): Promise<CardBundle> {
  const db = createAdminClient();
  const projectRows = checked(
    await amieCardPages(() =>
      db
        .from("projects")
        .select("project_id,project_name,display_name,drive_folder_id")
        .order("project_name")
        .order("project_id"),
    ),
  ) as {
    project_id: string;
    project_name: string;
    display_name: string | null;
    drive_folder_id: string | null;
  }[];
  const visible = projectRows.filter((p) =>
    amieCardCanRead(member, p.project_id),
  );
  const projects: CardProject[] = visible.map((p) => ({
    project_id: p.project_id,
    label: p.display_name || p.project_name,
    drive_folder_id: p.drive_folder_id,
    canEdit: amieCardCanEdit(member, p.project_id),
  }));
  if (!projects.length)
    return { designs: [], projects, isAdmin: member.isAdmin };
  const allLinks = checked(
    await amieCardPages(() =>
      db
        .from("project_card_design_projects")
        .select("design_id,project_id")
        .order("design_id")
        .order("project_id")
        .in(
          "project_id",
          projects.map((p) => p.project_id),
        ),
    ),
  ) as { design_id: string; project_id: string }[];
  const ids = [
    ...new Set(
      allLinks
        .filter((l) => !projectId || l.project_id === projectId)
        .map((l) => l.design_id),
    ),
  ];
  if (!ids.length) return { designs: [], projects, isAdmin: member.isAdmin };
  const rows = checked(
    await amieCardPages(() =>
      db
        .from("project_card_designs")
        .select("*")
        .in("design_id", ids)
        .in(
          "owner_project_id",
          projects.map((p) => p.project_id),
        )
        .order("updated_at", { ascending: false })
        .order("design_id"),
    ),
  ) as Omit<CardDesign, "projects" | "versions" | "canEdit">[];
  const designIds = rows.map((d) => d.design_id);
  if (!designIds.length)
    return { designs: [], projects, isAdmin: member.isAdmin };
  const versions = checked(
    await amieCardPages(() =>
      db
        .from("project_card_design_versions")
        .select(
          "version_id,design_id,version_no,revision_label,status,note,print_spec,order_record,created_at,approved_at",
        )
        .in("design_id", designIds)
        .order("version_no", { ascending: false })
        .order("version_id"),
    ),
  ) as CardDesign["versions"];
  const versionIds = versions.map((v) => v.version_id);
  const assets = versionIds.length
    ? (checked(
        await amieCardPages(() =>
          db
            .from("project_card_design_assets")
            .select(
              "asset_id,version_id,project_id,role,file_name,mime_type,byte_size",
            )
            .order("asset_id")
            .in("version_id", versionIds)
            .in(
              "project_id",
              projects.map((p) => p.project_id),
            ),
        ),
      ) as CardDesign["versions"][number]["assets"])
    : [];
  return {
    isAdmin: member.isAdmin,
    projects,
    designs: rows.map((d) => ({
      ...d,
      canEdit: amieCardCanEdit(member, d.owner_project_id),
      projects: allLinks
        .filter((l) => l.design_id === d.design_id)
        .map((l) => ({
          project_id: l.project_id,
          label: projects.find((p) => p.project_id === l.project_id)!.label,
        })),
      versions: versions
        .filter((v) => v.design_id === d.design_id)
        .map((v) => ({
          ...v,
          assets: assets
            .filter((a) => a.version_id === v.version_id)
            .map((a) => ({
              ...a,
              openUrl: `/api/project-card-designs/${d.design_id}/assets/${a.asset_id}/open`,
            })),
        })),
    })),
  };
}
const amieCardCache = new Map<string, { time: number; bundle: CardBundle }>();
const amieCardInflight = new Map<string, Promise<CardBundle>>();
export function amieInvalidateCardCache() {
  amieCardCache.clear();
  amieCardInflight.clear();
}
export async function amieLoadCardDesigns(
  member: NonNullable<Awaited<ReturnType<typeof amieCardAccess>>>,
  projectId?: string,
  fresh = false,
): Promise<CardBundle> {
  // Fresh access is resolved before entry; permission changes produce a different key.
  const key = JSON.stringify([
    member.memberId,
    member.scope,
    member.isAdmin,
    member.surfaceGrants,
    member.projects,
    projectId,
  ]);
  if (fresh) amieInvalidateCardCache();
  const cached = amieCardCache.get(key);
  if (cached && Date.now() - cached.time < 30000) return cached.bundle;
  const pending = amieCardInflight.get(key);
  if (pending) return pending;
  const task = amieLoadCardDesignsUncached(member, projectId)
    .then((bundle) => {
      if (amieCardCache.size > 100) amieCardCache.clear();
      amieCardCache.set(key, { time: Date.now(), bundle });
      return bundle;
    })
    .finally(() => {
      if (amieCardInflight.get(key) === task) amieCardInflight.delete(key);
    });
  amieCardInflight.set(key, task);
  return task;
}
export async function amieValidateCardAssets(
  member: NonNullable<Awaited<ReturnType<typeof amieCardAccess>>>,
  input: Record<string, unknown>,
) {
  const owner = cardText(input.owner_project_id);
  if (!amieCardCanEdit(member, owner)) throw new Error("更新権限がありません");
  const related = Array.isArray(input.related_project_ids)
    ? input.related_project_ids.map((p) => cardText(p)).filter(Boolean)
    : [];
  if (related.some((p) => !amieCardCanEdit(member, p)))
    throw new Error("関連PJの更新権限がありません");
  const projectIds = [...new Set([owner, ...related])];
  if (
    !Array.isArray(input.assets) ||
    input.assets.length < 1 ||
    input.assets.length > 14
  )
    throw new Error("資料を1〜14件登録してください");
  const auth = await getGoogleAuthAsync();
  if (!auth) throw new Error("共有ドライブの認証を確認してください");
  const drive = google.drive({ version: "v3", auth });
  const db = createAdminClient();
  const roles = new Set<string>();
  const assets = [];
  for (const raw of input.assets) {
    const a = raw as Record<string, unknown>;
    const pid = cardText(a.project_id) || owner;
    const role = cardText(a.role);
    if (
      !projectIds.includes(pid) ||
      !amieCardCanEdit(member, pid) ||
      !CARD_ASSET_ROLES.includes(role as (typeof CARD_ASSET_ROLES)[number])
    )
      throw new Error("資料の種類・PJを確認してください");
    const key = `${pid}:${role}`;
    if (roles.has(key)) throw new Error("同じ種類の資料が重複しています");
    roles.add(key);
    const fileId = driveCardFileId(a.drive_file_id);
    if (!fileId) throw new Error("Google Driveの資料URLを確認してください");
    const metadata = await drive.files.get({
      fileId,
      fields: "id,name,mimeType,size,parents,trashed",
      supportsAllDrives: true,
    });
    const f = metadata.data;
    if (
      f.trashed ||
      f.mimeType === "application/vnd.google-apps.folder" ||
      !f.parents?.length
    )
      throw new Error("資料が見つからありません");
    const { data: project, error } = await db
      .from("projects")
      .select("drive_folder_id")
      .eq("project_id", pid)
      .single();
    if (error || !project?.drive_folder_id)
      throw new Error("PJのDriveルートを設定してください");
    const folder = await drive.files.get({
      fileId: f.parents[0],
      fields: "id,name,mimeType,parents,trashed",
      supportsAllDrives: true,
    });
    if (
      folder.data.name !== "0_名刺" ||
      folder.data.mimeType !== "application/vnd.google-apps.folder" ||
      folder.data.trashed ||
      !folder.data.parents?.includes(project.drive_folder_id)
    )
      throw new Error("資料をPJ直下の0_名刺に保存してください");
    const byteSize = Number(f.size || 0);
    if (byteSize > 20 * 1024 * 1024) throw new Error("資料は20MB以内にしてください");
    if (
      ["preview", "front_print", "back_print"].includes(role) &&
      f.mimeType !== "application/pdf"
    )
      throw new Error("確認用・入稿用はPDFを選んでください");
    let sha256: string | null = null,
      storage_path: string | null = null;
    if (f.mimeType === "application/pdf") {
      const download = await drive.files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { responseType: "arraybuffer" },
      );
      const bytes = Buffer.from(download.data as ArrayBuffer);
      if (
        bytes.length > 20 * 1024 * 1024 ||
        bytes.subarray(0, 5).toString() !== "%PDF-"
      )
        throw new Error("PDFを確認できませんでした");
      const pdf = await PDFDocument.load(bytes);
      if (["front_print", "back_print"].includes(role)) {
        const pages = pdf.getPages();
        if (pages.length !== 1)
          throw new Error("表・裏の入稿PDFは各1ページにしてください");
        const { width, height } = pages[0].getSize();
        const mm = 72 / 25.4;
        if (Math.abs(width - 97 * mm) > 1 || Math.abs(height - 61 * mm) > 1)
          throw new Error("入稿PDFは91×55mm＋四辺3mmの塗り足しで保存してください");
      }
      sha256 = createHash("sha256").update(bytes).digest("hex");
      storage_path = `project/${pid}/card-designs/${input.request_key}/${role}/${sha256}.pdf`;
      const existing = await db.storage
        .from(WORKSPACE_DOCUMENTS_BUCKET)
        .download(storage_path);
      if (existing.error) {
        const uploaded = await db.storage
          .from(WORKSPACE_DOCUMENTS_BUCKET)
          .upload(storage_path, bytes, {
            upsert: false,
            contentType: "application/pdf",
          });
        if (uploaded.error) throw new Error("PDFの版を保存に失敗しました");
      }
      const readback = await db.storage
        .from(WORKSPACE_DOCUMENTS_BUCKET)
        .download(storage_path);
      if (
        readback.error ||
        !readback.data ||
        createHash("sha256")
          .update(Buffer.from(await readback.data.arrayBuffer()))
          .digest("hex") !== sha256
      )
        throw new Error("保存したPDFを確認できませんでした");
    }
    assets.push({
      project_id: pid,
      role,
      drive_file_id: fileId,
      drive_folder_id: f.parents[0],
      file_name: f.name,
      mime_type: f.mimeType,
      byte_size: byteSize,
      sha256,
      storage_bucket: storage_path ? WORKSPACE_DOCUMENTS_BUCKET : null,
      storage_path,
    });
  }
  return { owner, related, assets };
}
