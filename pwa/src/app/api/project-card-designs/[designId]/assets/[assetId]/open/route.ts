import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  amieCardAccess,
  amieCardCanRead,
} from "@/lib/project-card-designs-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ designId: string; assetId: string }> },
) {
  const member = await amieCardAccess();
  if (!member)
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  const { designId, assetId } = await params;
  const db = createAdminClient();
  const { data: design } = await db
    .from("project_card_designs")
    .select("owner_project_id")
    .eq("design_id", designId)
    .maybeSingle();
  if (!design || !amieCardCanRead(member, design.owner_project_id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: asset } = await db
    .from("project_card_design_assets")
    .select("*")
    .eq("asset_id", assetId)
    .maybeSingle();
  if (!asset || !amieCardCanRead(member, asset.project_id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: version } = await db
    .from("project_card_design_versions")
    .select("design_id")
    .eq("version_id", asset.version_id)
    .maybeSingle();
  if (version?.design_id !== designId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (asset.storage_path && asset.storage_bucket) {
    if (asset.byte_size > 4 * 1024 * 1024) {
      const signed = await db.storage
        .from(asset.storage_bucket)
        .createSignedUrl(asset.storage_path, 60);
      if (signed.error || !signed.data)
        return NextResponse.json(
          { error: "資料を開けませんでした" },
          { status: 503 },
        );
      return NextResponse.redirect(signed.data.signedUrl, 303);
    }
    const { data, error } = await db.storage
      .from(asset.storage_bucket)
      .download(asset.storage_path);
    if (error || !data)
      return NextResponse.json(
        { error: "資料を開けませんでした" },
        { status: 503 },
      );
    const bytes = await data.arrayBuffer();
    return new Response(bytes, {
      headers: {
        "Content-Type": asset.mime_type,
        "Content-Disposition": `${new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(asset.file_name).replace(/'/g, "%27")}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "frame-ancestors 'self'",
      },
    });
  }
  const url =
    asset.mime_type === "application/vnd.google-apps.presentation"
      ? `https://docs.google.com/presentation/d/${asset.drive_file_id}/edit`
      : `https://drive.google.com/file/d/${asset.drive_file_id}/view`;
  return NextResponse.redirect(url, 303);
}
