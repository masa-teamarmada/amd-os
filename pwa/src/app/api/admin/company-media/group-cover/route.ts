import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const COVER_TAG = "company_photo_group_cover";

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = await request.json().catch(() => null);
  const assetId = typeof body?.assetId === "string" ? body.assetId : null;
  if (!assetId) {
    return NextResponse.json({ error: "assetId is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: selected, error: selectedError } = await admin
    .from("media_assets")
    .select("asset_id,source_ref,storage_path,thumbnail_path,tags")
    .eq("asset_id", assetId)
    .maybeSingle();

  if (selectedError) {
    return NextResponse.json({ error: selectedError.message }, { status: 500 });
  }
  if (!selected) {
    return NextResponse.json({ error: "asset not found" }, { status: 404 });
  }

  const parentKey = parentKeyFromStorage(selected);
  if (!parentKey) {
    return NextResponse.json({ error: "asset has no grouped storage path" }, { status: 400 });
  }

  const { data: candidates, error: candidatesError } = await admin
    .from("media_assets")
    .select("asset_id,source_ref,storage_path,thumbnail_path,tags")
    .eq("source_ref", selected.source_ref);

  if (candidatesError) {
    return NextResponse.json({ error: candidatesError.message }, { status: 500 });
  }

  const groupRows = (candidates ?? []).filter((row) => parentKeyFromStorage(row) === parentKey);
  if (!groupRows.some((row) => row.asset_id === assetId)) {
    return NextResponse.json({ error: "asset group not found" }, { status: 404 });
  }

  for (const row of groupRows) {
    const tags = Array.isArray(row.tags) ? row.tags.map(String) : [];
    const nextTags = row.asset_id === assetId
      ? Array.from(new Set([...tags, COVER_TAG]))
      : tags.filter((tag) => tag !== COVER_TAG);
    const { error } = await admin
      .from("media_assets")
      .update({ tags: nextTags, updated_by: "company_media_group_cover_api" })
      .eq("asset_id", row.asset_id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, assetId, groupSize: groupRows.length });
}

function parentKeyFromStorage(row: { storage_path?: unknown; thumbnail_path?: unknown }) {
  const path = String(row.storage_path || row.thumbnail_path || "");
  const parts = path.split("/");
  return parts.length >= 3 ? parts[1] : null;
}
