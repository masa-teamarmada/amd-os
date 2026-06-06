import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const COVER_TAG = "company_photo_group_cover";
const POSITION_TAG_PREFIX = "company_photo_cover_position:";
const CROP_TAG_PREFIX = "company_media_crop:";
const DEFAULT_CROP = { x: 0, y: 0, zoom: 1 };

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = await request.json().catch(() => null);
  const assetId = typeof body?.assetId === "string" ? body.assetId : null;
  const crop = normalizeCrop(body?.crop);
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
    const baseTags = tags.filter((tag) => (
      tag !== COVER_TAG
      && !tag.startsWith(POSITION_TAG_PREFIX)
      && !tag.startsWith(CROP_TAG_PREFIX)
    ));
    const nextTags = row.asset_id === assetId
      ? Array.from(new Set([...baseTags, COVER_TAG, cropTag(crop)]))
      : baseTags;
    const { error } = await admin
      .from("media_assets")
      .update({ tags: nextTags, updated_by: "company_media_group_cover_api" })
      .eq("asset_id", row.asset_id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, assetId, crop, groupSize: groupRows.length });
}

function parentKeyFromStorage(row: { storage_path?: unknown; thumbnail_path?: unknown }) {
  const path = String(row.storage_path || row.thumbnail_path || "");
  const parts = path.split("/");
  return parts.length >= 3 ? parts[1] : null;
}

function normalizeCrop(value: unknown) {
  if (!value || typeof value !== "object") return DEFAULT_CROP;
  const record = value as Record<string, unknown>;
  return {
    x: clampNumber(record.x, -100, 100, DEFAULT_CROP.x),
    y: clampNumber(record.y, -100, 100, DEFAULT_CROP.y),
    zoom: clampNumber(record.zoom, 1, 4, DEFAULT_CROP.zoom),
  };
}

function cropTag(crop: typeof DEFAULT_CROP) {
  return `${CROP_TAG_PREFIX}${roundCrop(crop.x)},${roundCrop(crop.y)},${roundCrop(crop.zoom)}`;
}

function roundCrop(value: number) {
  return Number(value.toFixed(2));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}
