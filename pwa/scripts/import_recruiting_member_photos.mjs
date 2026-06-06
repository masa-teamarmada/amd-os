#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const BUCKET = "company-media";
const UPDATED_BY = "codex_recruiting_member_photo_import";
const SOURCE_REF = "google-drive:amd-recruiting-member-photo";
const RECRUITING_ROOT = "/Users/masa/Library/CloudStorage/GoogleDrive-masa@team-armada.jp/共有ドライブ/AMD運営/採用";

const PHOTO_IMPORTS = [
  {
    memberId: "ID029",
    codeName: "あき",
    filePath: path.join(RECRUITING_ROOT, "02_吉野茜/screenshot-2024-11-16-141109.png"),
    crop: { x: 0, y: 0, zoom: 1 },
  },
  {
    memberId: "ID009",
    codeName: "あび",
    filePath: path.join(RECRUITING_ROOT, "14_安孫子芽生/T04P8E49NJ0-U08C0P2P5HD-9ff3f2c271ff-512.jpeg"),
    crop: { x: 0, y: 0, zoom: 1 },
  },
  {
    memberId: "ID003",
    codeName: "かる",
    filePath: path.join(RECRUITING_ROOT, "27_輕部琢真/screenshot-2025-06-11-084722.png"),
    crop: { x: 0, y: 0, zoom: 1 },
  },
  {
    memberId: "ID004",
    codeName: "こう",
    filePath: path.join(RECRUITING_ROOT, "28_宮崎航一/screenshot-2025-06-11-084651.png"),
    crop: { x: 0, y: 0, zoom: 1 },
  },
  {
    memberId: "ID007",
    codeName: "ちこ",
    filePath: path.join(RECRUITING_ROOT, "16_遠藤千穂/写真_遠藤千穂/screenshot-2025-03-24-234436.png"),
    crop: { x: 0, y: 0, zoom: 1 },
  },
];

loadEnv("/Users/masa/projects/AMD/amd-os/pwa/.env.local");
loadEnv(path.resolve(".vercel/.env.production.local"));
loadEnv(path.resolve("pwa/.vercel/.env.production.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sharp = require("sharp");

const results = [];
for (const item of PHOTO_IMPORTS) {
  if (!existsSync(item.filePath)) {
    results.push({ memberId: item.memberId, codeName: item.codeName, status: "missing_file" });
    continue;
  }

  const { data: profile, error: profileError } = await supabase
    .from("member_profiles")
    .select("member_profile_id,member_id,display_name")
    .eq("member_id", item.memberId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) {
    results.push({ memberId: item.memberId, codeName: item.codeName, status: "missing_profile" });
    continue;
  }

  const ext = extensionForPath(item.filePath);
  const contentType = contentTypeForExt(ext);
  const notionSourceId = `google-drive-recruiting-member-photo:${item.memberId}`;

  const { data: asset, error: assetError } = await supabase
    .from("media_assets")
    .upsert({
      title: `Member photo review: ${item.codeName}`,
      asset_kind: "photo",
      member_ids: [item.memberId],
      tags: [
        "member_photo",
        "google_drive_recruiting_photo",
        "needs_review",
        cropTag(item.crop),
      ],
      visibility: "admin_only",
      status: "needs_review",
      source_confidence: 0.9,
      usage_permission: "unknown",
      consent_status: "unknown",
      source_kind: "drive",
      source_ref: SOURCE_REF,
      notion_source_id: notionSourceId,
      notion_last_synced_at: new Date().toISOString(),
      updated_by: UPDATED_BY,
    }, { onConflict: "notion_source_id" })
    .select("asset_id")
    .single();
  if (assetError) throw assetError;

  const storagePath = `google-drive-recruiting-member-photo/${item.memberId}/${asset.asset_id}.${ext}`;
  const thumbnailPath = `google-drive-recruiting-member-photo/${item.memberId}/${asset.asset_id}.thumb.webp`;
  const originalBytes = readFileSync(item.filePath);
  const thumbnailBytes = await sharp(originalBytes)
    .rotate()
    .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, originalBytes, { contentType, upsert: true });
  if (uploadError) throw uploadError;

  const { error: thumbnailUploadError } = await supabase.storage
    .from(BUCKET)
    .upload(thumbnailPath, thumbnailBytes, { contentType: "image/webp", upsert: true });
  if (thumbnailUploadError) throw thumbnailUploadError;

  const { error: assetUpdateError } = await supabase
    .from("media_assets")
    .update({
      storage_bucket: BUCKET,
      storage_path: storagePath,
      thumbnail_path: thumbnailPath,
      updated_by: UPDATED_BY,
    })
    .eq("asset_id", asset.asset_id);
  if (assetUpdateError) throw assetUpdateError;

  const { error: profileUpdateError } = await supabase
    .from("member_profiles")
    .update({
      photo_asset_id: asset.asset_id,
      updated_by: UPDATED_BY,
    })
    .eq("member_profile_id", profile.member_profile_id);
  if (profileUpdateError) throw profileUpdateError;

  results.push({
    memberId: item.memberId,
    codeName: item.codeName,
    status: "imported",
    assetId: asset.asset_id,
  });
}

console.log(JSON.stringify({ imported: results.filter((row) => row.status === "imported").length, results }, null, 2));

function cropTag(crop) {
  return `company_media_crop:${roundCrop(crop.x)},${roundCrop(crop.y)},${roundCrop(crop.zoom)}`;
}

function roundCrop(value) {
  return Number(value.toFixed(2));
}

function extensionForPath(filePath) {
  const ext = path.extname(filePath).replace(".", "").toLowerCase();
  if (ext === "jpeg") return "jpg";
  if (["jpg", "png", "webp"].includes(ext)) return ext;
  return "jpg";
}

function contentTypeForExt(ext) {
  const map = {
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  return map[ext] ?? "image/jpeg";
}

function loadEnv(filePath) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx);
    if (process.env[key]) continue;
    let value = trimmed.slice(idx + 1);
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
