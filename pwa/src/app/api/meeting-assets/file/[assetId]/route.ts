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
    .from("meeting_assets")
    .select("storage_bucket,storage_path")
    .eq("asset_id", assetId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!asset) {
    return NextResponse.json({ ok: false, error: "asset not found" }, { status: 404 });
  }

  const { data, error: signError } = await admin.storage
    .from(String(asset.storage_bucket || "meeting-assets"))
    .createSignedUrl(String(asset.storage_path), 60);

  if (signError || !data?.signedUrl) {
    return NextResponse.json({ ok: false, error: signError?.message || "signed URL failed" }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
