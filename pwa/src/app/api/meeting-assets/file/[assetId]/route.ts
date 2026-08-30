import { Buffer } from "node:buffer";
import { google } from "googleapis";
import { NextResponse } from "next/server";
import { getGoogleAuthAsync } from "@/lib/sources/google";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

const DRIVE_BACKED_BUCKET = "google-drive";

interface RouteContext {
  params: Promise<{ assetId: string }>;
}

export async function GET(_req: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { assetId } = await context.params;
  if (!assetId) {
    return NextResponse.json({ ok: false, error: "assetId is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: asset, error } = await admin
    .from("meeting_assets")
    .select("storage_bucket,storage_path,drive_file_id,web_view_link,file_name,media_type")
    .eq("asset_id", assetId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!asset) {
    return NextResponse.json({ ok: false, error: "asset not found" }, { status: 404 });
  }

  const driveFileId = typeof asset.drive_file_id === "string" ? asset.drive_file_id : "";
  if (driveFileId || asset.storage_bucket === DRIVE_BACKED_BUCKET) {
    // Docs / Sheets / Slides は alt=media で落とせないので、Drive の閲覧画面へ送る。
    const mediaTypeValue = String(asset.media_type || "");
    const webViewLink = typeof asset.web_view_link === "string" ? asset.web_view_link : "";
    if (mediaTypeValue.startsWith("application/vnd.google-apps.") && webViewLink) {
      return NextResponse.redirect(webViewLink);
    }
    const authClient = await getGoogleAuthAsync();
    if (!authClient) {
      return NextResponse.json({ ok: false, error: "Google Drive credential が未設定だよ" }, { status: 500 });
    }
    const drive = google.drive({ version: "v3", auth: authClient });
    const fileId = driveFileId || String(asset.storage_path || "");
    if (!fileId) {
      return NextResponse.json({ ok: false, error: "Drive file id is missing" }, { status: 500 });
    }

    const media = await drive.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
    const fileName = String(asset.file_name || "meeting-asset");
    const mediaType = String(asset.media_type || "application/octet-stream");
    return new Response(Buffer.from(media.data as ArrayBuffer), {
      headers: {
        "Content-Type": mediaType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "private, max-age=60",
      },
    });
  }

  const { data, error: signError } = await admin.storage
    .from(String(asset.storage_bucket || "meeting-assets"))
    .createSignedUrl(String(asset.storage_path), 60);

  if (signError || !data?.signedUrl) {
    return NextResponse.json({ ok: false, error: signError?.message || "signed URL failed" }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
