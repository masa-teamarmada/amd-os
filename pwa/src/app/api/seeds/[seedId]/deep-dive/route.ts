import { google } from "googleapis";
import { NextResponse } from "next/server";
import { getGoogleAuthAsync } from "@/lib/sources/google";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_MARKDOWN_PREVIEW_BYTES = 2 * 1024 * 1024;
const ALLOWED_DRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com"]);

interface SeedDeepDiveRow {
  id: string;
  title: string;
  deep_dive_material_url: string | null;
}

function driveFileIdFromUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || !ALLOWED_DRIVE_HOSTS.has(url.hostname.toLowerCase())) {
      return null;
    }

    const pathMatch = url.pathname.match(/\/(?:file|document)\/d\/([^/]+)/);
    const candidate = pathMatch?.[1] ?? url.searchParams.get("id");
    return candidate && /^[A-Za-z0-9_-]{10,}$/.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function isMarkdownFile(fileName: string, mimeType: string) {
  const name = fileName.toLowerCase();
  const mime = mimeType.toLowerCase();
  return name.endsWith(".md") || name.endsWith(".markdown") || mime === "text/markdown";
}

function decodeDriveMedia(data: unknown) {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (data instanceof Uint8Array) return Buffer.from(data).toString("utf8");
  return String(data ?? "");
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ seedId: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;

  const { seedId } = await context.params;
  if (!seedId) {
    return NextResponse.json({ ok: false, error: "seedId is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: member, error: memberError } = await admin
    .from("members")
    .select("member_id")
    .eq("email", auth.user.email.toLowerCase())
    .maybeSingle();
  if (memberError) {
    return NextResponse.json({ ok: false, error: "access check failed" }, { status: 500 });
  }
  if (!member?.member_id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("seeds")
    .select("id,title,deep_dive_material_url")
    .eq("id", seedId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false, error: "seed lookup failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "seed not found" }, { status: 404 });
  }

  const row = data as SeedDeepDiveRow;
  if (!row.deep_dive_material_url) {
    return NextResponse.json({ ok: false, error: "deep-dive material not found" }, { status: 404 });
  }

  const fileId = driveFileIdFromUrl(row.deep_dive_material_url);
  if (!fileId) {
    return NextResponse.json({ ok: false, error: "invalid deep-dive material link" }, { status: 400 });
  }

  const googleAuth = await getGoogleAuthAsync();
  if (!googleAuth) {
    return NextResponse.json({ ok: false, error: "Google Drive credential is not configured" }, { status: 500 });
  }

  try {
    const drive = google.drive({ version: "v3", auth: googleAuth });
    const metadata = await drive.files.get({
      fileId,
      fields: "id,name,mimeType,size,webViewLink",
      supportsAllDrives: true,
    });
    const fileName = metadata.data.name || "Markdown";
    const mimeType = metadata.data.mimeType || "text/markdown";
    const fileSizeBytes = Number(metadata.data.size || 0) || 0;

    if (!isMarkdownFile(fileName, mimeType)) {
      return NextResponse.json({ ok: false, error: "markdown preview is only available for .md files" }, { status: 400 });
    }
    if (fileSizeBytes > MAX_MARKDOWN_PREVIEW_BYTES) {
      return NextResponse.json({ ok: false, error: "markdown preview is limited to 2MB" }, { status: 413 });
    }

    const file = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" },
    );
    const markdown = decodeDriveMedia(file.data);
    const actualSizeBytes = Buffer.byteLength(markdown, "utf8");
    if (actualSizeBytes > MAX_MARKDOWN_PREVIEW_BYTES) {
      return NextResponse.json({ ok: false, error: "markdown preview is limited to 2MB" }, { status: 413 });
    }

    return NextResponse.json({
      ok: true,
      seed: { id: row.id, title: row.title },
      document: {
        fileName,
        mimeType,
        fileSizeBytes: fileSizeBytes || actualSizeBytes,
        webViewLink: metadata.data.webViewLink || row.deep_dive_material_url,
      },
      markdown,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "深掘り資料を読み込めなかった" }, { status: 502 });
  }
}
