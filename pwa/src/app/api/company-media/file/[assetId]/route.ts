import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

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
    .from("media_assets")
    .select("storage_bucket,storage_path,thumbnail_path")
    .eq("asset_id", assetId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  const path = asset?.thumbnail_path || asset?.storage_path;
  if (!path) {
    return NextResponse.json({ ok: false, error: "asset file not found" }, { status: 404 });
  }

  const { data, error: signError } = await admin.storage
    .from(String(asset.storage_bucket || "company-media"))
    .createSignedUrl(String(path), 60);

  if (signError || !data?.signedUrl) {
    return NextResponse.json({ ok: false, error: signError?.message || "signed URL failed" }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
