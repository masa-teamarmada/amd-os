#!/usr/bin/env node
// 共有Drive の日付フォルダにある写真を、ホーム画面の Company Content photo 列へ取り込む。
//
// 使い方:
//   node scripts/import_drive_company_photos.mjs \
//     --dir "/Users/masa/Library/CloudStorage/GoogleDrive-masa@team-armada.jp/共有ドライブ/ARMADA/p20_cx/260826_隔週定例＋BBQ" \
//     --title "CX 暑気払いBBQ" --date 2026-08-26 --group 20260826-cx-bbq --project p20
//
// storage_path は `drive-photo/{group}/{assetId}.{ext}` に固定する。
// ホーム側 (`dashboard/page.tsx` の parentKeyFromStorage) がパス2階層目でグループを組むため、
// 同じ group を渡した写真が1枚のカードにまとまる。
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BUCKET = "company-media";
const SOURCE_REF = "drive:armada-company-photo";
const THUMBNAIL_WIDTH = 960;

const args = parseArgs(process.argv.slice(2));
const sourceDir = args.dir;
const groupTitle = args.title;
const capturedAt = args.date || null;
const groupKey = args.group || slugFromTitle(groupTitle);
const projectIds = args.project ? args.project.split(",").map((value) => value.trim()).filter(Boolean) : [];
const dryRun = Boolean(args["dry-run"]);

if (!sourceDir || !groupTitle) {
  throw new Error("--dir と --title は必須");
}
if (!existsSync(sourceDir)) {
  throw new Error(`フォルダが見つからない: ${sourceDir}`);
}
if (capturedAt && !/^\d{4}-\d{2}-\d{2}$/.test(capturedAt)) {
  throw new Error("--date は YYYY-MM-DD 形式");
}

loadEnv("/Users/masa/projects/AMD/amd-os/pwa/.env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が要る");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CONTENT_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const files = readdirSync(sourceDir)
  .filter((name) => !name.startsWith("."))
  .filter((name) => CONTENT_TYPES[path.extname(name).toLowerCase()])
  .sort((a, b) => a.localeCompare(b, "ja"));

if (files.length === 0) {
  throw new Error(`取り込める画像がない: ${sourceDir}`);
}

// 同じ group を再取り込みしたときに二重登録しない。
const { data: existingRows, error: existingError } = await supabase
  .from("media_assets")
  .select("asset_id,storage_path,title")
  .eq("source_ref", SOURCE_REF)
  .like("storage_path", `drive-photo/${groupKey}/%`);
if (existingError) throw existingError;
const existingTitles = new Set((existingRows ?? []).map((row) => String(row.title)));

console.log(JSON.stringify({ sourceDir, groupTitle, groupKey, capturedAt, projectIds, files, existing: existingRows?.length ?? 0, dryRun }, null, 2));
if (dryRun) process.exit(0);

let imported = 0;
let skipped = 0;

for (const [index, name] of files.entries()) {
  const photoIndex = index + 1;
  const title = `Photo review: ${groupTitle} #${String(photoIndex).padStart(2, "0")}`;
  if (existingTitles.has(title)) {
    skipped += 1;
    continue;
  }

  const ext = path.extname(name).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  const bytes = readFileSync(path.join(sourceDir, name));

  const { data: asset, error: insertError } = await supabase
    .from("media_assets")
    .insert({
      title,
      asset_kind: "photo",
      captured_at: capturedAt,
      project_ids: projectIds,
      member_ids: [],
      tags: [
        "company_photo_group",
        "drive_company_photo",
        `company_photo_group_key:${groupKey}`,
        `photo_index:${photoIndex}`,
        ...(photoIndex === 1 ? ["company_photo_group_cover"] : []),
      ],
      visibility: "admin_only",
      status: "needs_review",
      source_confidence: 1,
      usage_permission: "unknown",
      consent_status: "unknown",
      source_kind: "manual",
      source_ref: SOURCE_REF,
      created_by: "import_drive_company_photos",
      updated_by: "import_drive_company_photos",
    })
    .select("asset_id")
    .single();
  if (insertError || !asset?.asset_id) throw insertError || new Error("asset insert failed");

  const storagePath = `drive-photo/${groupKey}/${asset.asset_id}${ext}`;
  const thumbnailPath = `drive-photo-thumbnail/${groupKey}/${asset.asset_id}.webp`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType, upsert: true });
  if (uploadError) throw uploadError;

  const thumbnail = await sharp(bytes).rotate().resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const { error: thumbnailError } = await supabase.storage
    .from(BUCKET)
    .upload(thumbnailPath, thumbnail, { contentType: "image/webp", upsert: true });
  if (thumbnailError) throw thumbnailError;

  const { error: updateError } = await supabase
    .from("media_assets")
    .update({ storage_bucket: BUCKET, storage_path: storagePath, thumbnail_path: thumbnailPath })
    .eq("asset_id", asset.asset_id);
  if (updateError) throw updateError;

  imported += 1;
  console.log(`imported: ${name} -> ${storagePath}`);
}

console.log(JSON.stringify({ imported, skipped }, null, 2));

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
      continue;
    }
    result[key] = next;
    i += 1;
  }
  return result;
}

function slugFromTitle(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "company-photo";
}

function loadEnv(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx);
    if (process.env[key]) continue;
    let value = trimmed.slice(idx + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
