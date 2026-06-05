#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const NOTION_DB = "/Users/masa/Library/Application Support/Notion/notion.db";
const CACHE_ROOTS = [
  "/Users/masa/Library/Application Support/Notion/Partitions/notion/Cache/Cache_Data",
  "/Users/masa/Library/Application Support/Notion/Partitions/notion/Service Worker/CacheStorage",
];
const PHOTO_COLLECTION_ID = "52da93f5-8748-4b54-aa18-d4ca0a186f30";
const BUCKET = "company-media";

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

const rows = loadPhotoBlocks();
const cacheFiles = listFiles(CACHE_ROOTS);
const fileIds = new Set(rows.map((row) => row.fileId).filter(Boolean));
const cachedByFileId = indexCacheFiles(cacheFiles, fileIds);

await ensureBucket();

let uploaded = 0;
let skipped = 0;
let failed = 0;

for (const row of rows) {
  const cached = row.fileId ? cachedByFileId.get(row.fileId) : null;
  if (!cached) {
    skipped += 1;
    continue;
  }

  const media = extractMedia(cached.buffer);
  if (!media) {
    skipped += 1;
    continue;
  }

  const storagePath = storagePathFor(row, media.ext);
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, media.body, {
      contentType: media.contentType,
      upsert: true,
    });

  if (uploadError) {
    failed += 1;
    console.error(`upload failed: ${row.id} ${uploadError.message}`);
    continue;
  }

  const { error: updateError } = await supabase
    .from("media_assets")
    .update({
      storage_bucket: BUCKET,
      storage_path: storagePath,
      thumbnail_path: null,
      updated_by: "codex_notion_company_photo_storage_import",
    })
    .eq("notion_source_id", row.id);

  if (updateError) {
    failed += 1;
    console.error(`db update failed: ${row.id} ${updateError.message}`);
    continue;
  }

  uploaded += 1;
}

console.log(JSON.stringify({
  notionPhotoBlocks: rows.length,
  cacheFiles: cacheFiles.length,
  uploaded,
  skipped,
  failed,
}, null, 2));

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadPhotoBlocks() {
  const sql = `
with photo_pages as (
  select id
  from block
  where parent_id = '${PHOTO_COLLECTION_ID}' and type = 'page'
),
photo_blocks as (
  select b.id, b.parent_id, b.type, b.properties, b.format
  from block b
  join photo_pages p on p.id = b.parent_id
  where b.type in ('image', 'video')
)
select id, parent_id, type, properties, format
from photo_blocks
order by parent_id, id;
`;
  const raw = execFileSync("sqlite3", [NOTION_DB, "-json", sql], { maxBuffer: 80 * 1024 * 1024 }).toString();
  return JSON.parse(raw).map((row) => {
    const source = sourceFromRow(row);
    const fileId = source.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? null;
    return {
      id: String(row.id),
      parentId: String(row.parent_id),
      type: String(row.type),
      fileId,
    };
  });
}

function sourceFromRow(row) {
  for (const field of ["properties", "format"]) {
    try {
      const value = JSON.parse(row[field] || "{}");
      const source = value.source?.[0]?.[0] || value.display_source;
      if (typeof source === "string") return source;
    } catch {
      // Ignore malformed local cache JSON and try the next field.
    }
  }
  return "";
}

function listFiles(roots) {
  const files = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const stack = [root];
    while (stack.length > 0) {
      const current = stack.pop();
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(fullPath);
        else files.push(fullPath);
      }
    }
  }
  return files;
}

function indexCacheFiles(files, fileIds) {
  const found = new Map();
  for (const filePath of files) {
    if (found.size === fileIds.size) break;
    const buffer = readFileSync(filePath);
    for (const fileId of fileIds) {
      if (found.has(fileId)) continue;
      if (!buffer.includes(Buffer.from(fileId))) continue;
      const media = extractMedia(buffer);
      if (media) found.set(fileId, { filePath, buffer });
    }
  }
  return found;
}

function extractMedia(buffer) {
  const webp = extractWebp(buffer);
  if (webp) return webp;
  const jpeg = extractJpeg(buffer);
  if (jpeg) return jpeg;
  const png = extractPng(buffer);
  if (png) return png;
  const gif = extractGif(buffer);
  if (gif) return gif;
  return null;
}

function extractWebp(buffer) {
  const offset = buffer.indexOf(Buffer.from("RIFF"));
  if (offset < 0 || offset + 12 > buffer.length || buffer.toString("ascii", offset + 8, offset + 12) !== "WEBP") return null;
  const size = buffer.readUInt32LE(offset + 4) + 8;
  if (size <= 12 || offset + size > buffer.length) return null;
  return { body: buffer.subarray(offset, offset + size), ext: "webp", contentType: "image/webp" };
}

function extractJpeg(buffer) {
  const start = buffer.indexOf(Buffer.from([0xff, 0xd8, 0xff]));
  if (start < 0) return null;
  const end = buffer.indexOf(Buffer.from([0xff, 0xd9]), start + 3);
  if (end < 0) return null;
  return { body: buffer.subarray(start, end + 2), ext: "jpg", contentType: "image/jpeg" };
}

function extractPng(buffer) {
  const start = buffer.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (start < 0) return null;
  const iend = buffer.indexOf(Buffer.from("IEND"), start);
  if (iend < 0) return null;
  return { body: buffer.subarray(start, iend + 8), ext: "png", contentType: "image/png" };
}

function extractGif(buffer) {
  const start = buffer.indexOf(Buffer.from("GIF8"));
  if (start < 0) return null;
  const end = buffer.indexOf(Buffer.from([0x3b]), start + 6);
  if (end < 0) return null;
  return { body: buffer.subarray(start, end + 1), ext: "gif", contentType: "image/gif" };
}

function storagePathFor(row, ext) {
  return `notion-photo/${row.parentId}/${row.id}.${ext}`;
}

async function ensureBucket() {
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime"],
  });
  if (error && !/already exists|Duplicate/i.test(error.message)) {
    throw error;
  }
}
