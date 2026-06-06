import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "company-media";
const SOURCE_REF = "amd-os-ui-member-photo-upload";
const DEFAULT_CROP = { x: 0, y: 0, zoom: 1 };
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const form = await request.formData().catch(() => null);
  const memberProfileId = stringValue(form?.get("memberProfileId"));
  const memberId = stringValue(form?.get("memberId"));
  const codeName = stringValue(form?.get("codeName"));
  const file = form?.get("file");

  if (!memberProfileId || !memberId) {
    return NextResponse.json({ error: "memberProfileId and memberId are required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "image file is required" }, { status: 400 });
  }
  if (!CONTENT_TYPES[file.type]) {
    return NextResponse.json({ error: "unsupported image type" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "image file is too large" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("member_profiles")
    .select("member_profile_id,member_id,display_name")
    .eq("member_profile_id", memberProfileId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (!profile || String(profile.member_id) !== memberId) {
    return NextResponse.json({ error: "member profile not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { data: asset, error: assetError } = await admin
    .from("media_assets")
    .insert({
      title: `Member photo review: ${codeName || profile.display_name || memberId}`,
      asset_kind: "photo",
      member_ids: [memberId],
      tags: [
        "member_photo",
        "manual_member_photo_upload",
        "needs_review",
        cropTag(DEFAULT_CROP),
      ],
      visibility: "admin_only",
      status: "needs_review",
      source_confidence: 1,
      usage_permission: "unknown",
      consent_status: "unknown",
      source_kind: "manual",
      source_ref: SOURCE_REF,
      notion_last_synced_at: now,
      created_by: auth.user.email,
      updated_by: auth.user.email,
    })
    .select("asset_id")
    .single();

  if (assetError || !asset?.asset_id) {
    return NextResponse.json({ error: assetError?.message || "asset insert failed" }, { status: 500 });
  }

  const ext = CONTENT_TYPES[file.type];
  const storagePath = `member-profile-upload/${memberId}/${asset.asset_id}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    await admin
      .from("media_assets")
      .update({ status: "rejected", updated_by: "company_member_photo_upload_failed" })
      .eq("asset_id", asset.asset_id);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { error: assetUpdateError } = await admin
    .from("media_assets")
    .update({
      storage_bucket: BUCKET,
      storage_path: storagePath,
      thumbnail_path: null,
      updated_by: auth.user.email,
    })
    .eq("asset_id", asset.asset_id);

  if (assetUpdateError) {
    return NextResponse.json({ error: assetUpdateError.message }, { status: 500 });
  }

  const { error: profileUpdateError } = await admin
    .from("member_profiles")
    .update({
      photo_asset_id: asset.asset_id,
      updated_by: auth.user.email,
    })
    .eq("member_profile_id", memberProfileId);

  if (profileUpdateError) {
    return NextResponse.json({ error: profileUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    assetId: String(asset.asset_id),
    imageUrl: `/api/company-media/file/${asset.asset_id}`,
    crop: DEFAULT_CROP,
  });
}

function stringValue(value: FormDataEntryValue | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cropTag(crop: typeof DEFAULT_CROP) {
  return `company_media_crop:${crop.x},${crop.y},${crop.zoom}`;
}
