import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const MEETING_ASSETS_BUCKET = "meeting-assets";
const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const ACCEPTED_ASSET_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);
const ASSET_KINDS = new Set(["upload", "paste", "screen_capture", "notion_image", "generated"]);

type AdminClient = ReturnType<typeof createAdminClient>;

interface MeetingAssetRow {
  asset_id: string;
  meeting_id: string;
  project_id: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  media_type: string;
  file_size_bytes: number;
  asset_kind: string;
  caption: string | null;
  extracted_text: string | null;
  source_url: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function requiredText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function nullableText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function normalizeAssetKind(value: unknown): string {
  const kind = requiredText(value, 40);
  return ASSET_KINDS.has(kind) ? kind : "upload";
}

function safeFileName(name: string): string {
  return name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 120) || "meeting-asset";
}

function safePathPart(value: string): string {
  return value.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 160) || "meeting";
}

function contentTypeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function isAcceptedFile(file: File): { ok: true; mediaType: string } | { ok: false; error: string } {
  const mediaType = file.type || contentTypeFromName(file.name);
  if (!ACCEPTED_ASSET_TYPES.has(mediaType)) {
    return { ok: false, error: `${file.name}: PNG/JPG/WebP/GIF/PDF だけアップロードできる` };
  }
  if (file.size > MAX_ASSET_BYTES) {
    return { ok: false, error: `${file.name}: 25MB 以内にしてね` };
  }
  return { ok: true, mediaType };
}

async function toClientAsset(admin: AdminClient, row: MeetingAssetRow) {
  const { data } = await admin.storage
    .from(row.storage_bucket || MEETING_ASSETS_BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);

  return {
    assetId: row.asset_id,
    meetingId: row.meeting_id,
    projectId: row.project_id,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mediaType: row.media_type,
    fileSizeBytes: row.file_size_bytes,
    assetKind: row.asset_kind,
    caption: row.caption ?? "",
    extractedText: row.extracted_text ?? "",
    sourceUrl: row.source_url ?? null,
    sortOrder: row.sort_order,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    signedUrl: data?.signedUrl ?? `/api/meeting-assets/file/${row.asset_id}`,
    fileUrl: `/api/meeting-assets/file/${row.asset_id}`,
  };
}

async function listAssets(admin: AdminClient, meetingId: string) {
  const { data, error } = await admin
    .from("meeting_assets")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return Promise.all(((data ?? []) as MeetingAssetRow[]).map((row) => toClientAsset(admin, row)));
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const url = new URL(req.url);
  const meetingId = requiredText(url.searchParams.get("meeting_id"), 300);
  if (!meetingId) {
    return NextResponse.json({ ok: false, error: "meeting_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  try {
    const assets = await listAssets(admin, meetingId);
    return NextResponse.json({ ok: true, assets });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "unknown" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ ok: false, error: "invalid form data" }, { status: 400 });
  }

  const meetingId = requiredText(form.get("meeting_id"), 300);
  const assetKind = normalizeAssetKind(form.get("asset_kind"));
  const caption = nullableText(form.get("caption"), 1000);
  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!meetingId || files.length === 0) {
    return NextResponse.json({ ok: false, error: "meeting_id and files are required" }, { status: 400 });
  }

  for (const file of files) {
    const validation = isAcceptedFile(file);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
    }
  }

  const admin = createAdminClient();
  const { data: meeting, error: meetingError } = await admin
    .from("project_meeting_summaries")
    .select("meeting_id,project_id")
    .eq("meeting_id", meetingId)
    .maybeSingle();

  if (meetingError) {
    return NextResponse.json({ ok: false, error: meetingError.message }, { status: 500 });
  }
  if (!meeting) {
    return NextResponse.json({ ok: false, error: "meeting not found" }, { status: 404 });
  }

  const { data: lastAsset } = await admin
    .from("meeting_assets")
    .select("sort_order")
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextSortOrder = typeof lastAsset?.sort_order === "number" ? lastAsset.sort_order + 10 : 10;
  const uploadedPaths: string[] = [];
  const rows: Array<Record<string, unknown>> = [];
  const projectId = String(meeting.project_id);
  const meetingPath = safePathPart(meetingId);

  try {
    for (const [index, file] of files.entries()) {
      const validation = isAcceptedFile(file);
      if (!validation.ok) throw new Error(validation.error);

      const assetId = crypto.randomUUID();
      const safeName = safeFileName(file.name || `${assetKind}-${index + 1}.png`);
      const storagePath = `${safePathPart(projectId)}/${meetingPath}/${assetId}-${safeName}`;
      const body = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await admin.storage.from(MEETING_ASSETS_BUCKET).upload(storagePath, body, {
        cacheControl: "3600",
        contentType: validation.mediaType,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      uploadedPaths.push(storagePath);
      rows.push({
        asset_id: assetId,
        meeting_id: meetingId,
        project_id: projectId,
        storage_bucket: MEETING_ASSETS_BUCKET,
        storage_path: storagePath,
        file_name: file.name || safeName,
        media_type: validation.mediaType,
        file_size_bytes: file.size,
        asset_kind: assetKind,
        caption,
        sort_order: nextSortOrder,
        created_by: auth.user.email,
      });
      nextSortOrder += 10;
    }

    const { error: insertError } = await admin.from("meeting_assets").insert(rows);
    if (insertError) throw insertError;

    const assets = await listAssets(admin, meetingId);
    return NextResponse.json({ ok: true, assets });
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await admin.storage.from(MEETING_ASSETS_BUCKET).remove(uploadedPaths);
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "unknown" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const assetId = requiredText(body.asset_id, 80);
  if (!assetId) {
    return NextResponse.json({ ok: false, error: "asset_id is required" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("caption" in body) update.caption = nullableText(body.caption, 1000);
  if ("sort_order" in body) {
    const order = Number(body.sort_order);
    if (Number.isFinite(order)) update.sort_order = Math.round(order);
  }
  if ("extracted_text" in body) update.extracted_text = nullableText(body.extracted_text, 12000);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("meeting_assets")
    .update(update)
    .eq("asset_id", assetId)
    .select("*")
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ ok: false, error: error.message }, { status });
  }

  return NextResponse.json({ ok: true, asset: await toClientAsset(admin, data as MeetingAssetRow) });
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const url = new URL(req.url);
  const assetId = requiredText(url.searchParams.get("asset_id"), 80);
  if (!assetId) {
    return NextResponse.json({ ok: false, error: "asset_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: asset, error: selectError } = await admin
    .from("meeting_assets")
    .select("*")
    .eq("asset_id", assetId)
    .maybeSingle();

  if (selectError) {
    return NextResponse.json({ ok: false, error: selectError.message }, { status: 500 });
  }
  if (!asset) {
    return NextResponse.json({ ok: false, error: "asset not found" }, { status: 404 });
  }

  const row = asset as MeetingAssetRow;
  const { error: storageError } = await admin.storage.from(row.storage_bucket || MEETING_ASSETS_BUCKET).remove([row.storage_path]);
  if (storageError) {
    return NextResponse.json({ ok: false, error: storageError.message }, { status: 500 });
  }

  const { error: deleteError } = await admin.from("meeting_assets").delete().eq("asset_id", assetId);
  if (deleteError) {
    return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deletedAssetId: assetId, meetingId: row.meeting_id });
}
