#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const NOTION_DB = "/Users/masa/Library/Application Support/Notion/notion.db";
const CACHE_ROOTS = [
  "/Users/masa/Library/Application Support/Notion/Partitions/notion/Cache/Cache_Data",
  "/Users/masa/Library/Application Support/Notion/Partitions/notion/Service Worker/CacheStorage",
  "/Users/masa/Library/Application Support/Notion/Partitions/notion/File System",
];
const PHOTO_COLLECTION_ID = "52da93f5-8748-4b54-aa18-d4ca0a186f30";
const BUCKET = "company-media";
const NOTION_SPACE_ID = "86b83c2f-415f-4d48-90ae-ccca9e69abda";

loadEnv("/Users/masa/projects/AMD/amd-os/pwa/.env.local");
loadEnv(path.resolve(".vercel/.env.production.local"));
loadEnv(path.resolve("pwa/.vercel/.env.production.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const notionApiKey = process.env.NOTION_API_KEY;
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
let uploadedFromNotionApi = 0;
let skipped = 0;
const skippedRows = [];
let failed = 0;

for (const row of rows) {
  const cached = row.fileId ? cachedByFileId.get(row.fileId) : null;
  const resolvedMedia = await resolveRowMedia(row, cached);
  if (!resolvedMedia.storage && !resolvedMedia.thumbnail) {
    skipped += 1;
    skippedRows.push({ id: row.id, type: row.type });
    continue;
  }

  const storagePath = resolvedMedia.storage ? storagePathFor(row, resolvedMedia.storage.ext) : null;
  const thumbnailPath = resolvedMedia.thumbnail ? thumbnailPathFor(row, resolvedMedia.thumbnail.ext) : null;

  if (resolvedMedia.storage && storagePath) {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, resolvedMedia.storage.body, {
        contentType: resolvedMedia.storage.contentType,
        upsert: true,
      });

    if (uploadError) {
      failed += 1;
      console.error(`upload failed: ${row.id} ${uploadError.message}`);
      continue;
    }
  }

  if (resolvedMedia.thumbnail && thumbnailPath) {
    const { error: thumbnailError } = await supabase.storage
      .from(BUCKET)
      .upload(thumbnailPath, resolvedMedia.thumbnail.body, {
        contentType: resolvedMedia.thumbnail.contentType,
        upsert: true,
      });

    if (thumbnailError) {
      failed += 1;
      console.error(`thumbnail upload failed: ${row.id} ${thumbnailError.message}`);
      continue;
    }
  }

  const updatePatch = {
    storage_bucket: BUCKET,
    thumbnail_path: thumbnailPath,
    updated_by: "codex_notion_company_photo_storage_import",
  };
  if (storagePath || row.type !== "video") {
    updatePatch.storage_path = storagePath;
  }

  const { error: updateError } = await supabase
    .from("media_assets")
    .update(updatePatch)
    .eq("notion_source_id", row.id);

  if (updateError) {
    failed += 1;
    console.error(`db update failed: ${row.id} ${updateError.message}`);
    continue;
  }

  uploaded += 1;
  if (resolvedMedia.fromApi) uploadedFromNotionApi += 1;
}

console.log(JSON.stringify({
  notionPhotoBlocks: rows.length,
  cacheFiles: cacheFiles.length,
  uploaded,
  uploadedFromNotionApi,
  skipped,
  skippedRows,
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
    const fileId = notionFileId(source);
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

function notionFileId(source) {
  const ids = [...String(source || "").matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)]
    .map((match) => match[0].toLowerCase());
  return ids.find((id) => id !== NOTION_SPACE_ID) ?? ids[0] ?? null;
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
    let buffer;
    try {
      buffer = readFileSync(filePath);
    } catch {
      continue;
    }
    for (const fileId of fileIds) {
      if (found.has(fileId)) continue;
      if (!buffer.includes(Buffer.from(fileId))) continue;
      const media = extractImage(buffer) || extractIsoBmff(buffer);
      if (media) found.set(fileId, { filePath, buffer });
    }
  }
  return found;
}

async function resolveRowMedia(row, cached) {
  if (row.type === "video") {
    const storage = cached ? extractVideoNearFileId(cached.buffer, row.fileId) : null;
    const thumbnail = cached ? extractImageNearFileId(cached.buffer, row.fileId) : null;
    const apiStorage = storage ? null : await fetchMediaFromNotionApi(row);
    return {
      storage: apiStorage || storage,
      thumbnail,
      fromApi: Boolean(apiStorage),
    };
  }

  const storage = cached ? extractImageNearFileId(cached.buffer, row.fileId) : null;
  const apiStorage = storage ? null : await fetchMediaFromNotionApi(row);
  return {
    storage: apiStorage || storage,
    thumbnail: null,
    fromApi: Boolean(apiStorage),
  };
}

function extractImage(buffer) {
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

function extractImageNearFileId(buffer, fileId) {
  if (!fileId) return null;
  const offset = buffer.indexOf(Buffer.from(fileId));
  if (offset < 0) return null;

  const before = extractLastImageEndingBefore(buffer, offset);
  if (before) return before;

  const after = extractImage(buffer.subarray(offset));
  if (after) return after;

  const windowStart = Math.max(0, offset - 5 * 1024 * 1024);
  const windowEnd = Math.min(buffer.length, offset + 5 * 1024 * 1024);
  return extractImage(buffer.subarray(windowStart, windowEnd));
}

function extractVideoNearFileId(buffer, fileId) {
  if (!fileId) return null;
  const offset = buffer.indexOf(Buffer.from(fileId));
  if (offset < 0) return null;

  const before = extractLastVideoEndingBefore(buffer, offset);
  if (before) return before;

  const after = extractIsoBmff(buffer.subarray(offset));
  if (after) return after;

  const windowStart = Math.max(0, offset - 5 * 1024 * 1024);
  const windowEnd = Math.min(buffer.length, offset + 5 * 1024 * 1024);
  return extractIsoBmff(buffer.subarray(windowStart, windowEnd));
}

function extractLastImageEndingBefore(buffer, offset) {
  const windowStart = Math.max(0, offset - 80 * 1024 * 1024);
  const window = buffer.subarray(windowStart, offset);
  const candidates = [
    extractLastWebp(window),
    extractLastJpeg(window),
    extractLastPng(window),
    extractLastGif(window),
  ].filter(Boolean);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.start - a.start);
  const best = candidates[0];
  return { body: best.body, ext: best.ext, contentType: best.contentType };
}

function extractLastVideoEndingBefore(buffer, offset) {
  const windowStart = Math.max(0, offset - 80 * 1024 * 1024);
  const window = buffer.subarray(windowStart, offset);
  const best = extractLastIsoBmff(window);
  return best ? { body: best.body, ext: best.ext, contentType: best.contentType } : null;
}

function extractLastWebp(buffer) {
  let start = -1;
  let cursor = 0;
  while (true) {
    const hit = buffer.indexOf(Buffer.from("RIFF"), cursor);
    if (hit < 0) break;
    if (hit + 12 <= buffer.length && buffer.toString("ascii", hit + 8, hit + 12) === "WEBP") start = hit;
    cursor = hit + 4;
  }
  if (start < 0) return null;
  const size = buffer.readUInt32LE(start + 4) + 8;
  if (size <= 12 || start + size > buffer.length) return null;
  return { start, body: buffer.subarray(start, start + size), ext: "webp", contentType: "image/webp" };
}

function extractLastJpeg(buffer) {
  const start = buffer.lastIndexOf(Buffer.from([0xff, 0xd8, 0xff]));
  if (start < 0) return null;
  const end = buffer.indexOf(Buffer.from([0xff, 0xd9]), start + 3);
  if (end < 0 || end > buffer.length) return null;
  return { start, body: buffer.subarray(start, end + 2), ext: "jpg", contentType: "image/jpeg" };
}

function extractLastPng(buffer) {
  const start = buffer.lastIndexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (start < 0) return null;
  const iend = buffer.indexOf(Buffer.from("IEND"), start);
  if (iend < 0 || iend + 8 > buffer.length) return null;
  return { start, body: buffer.subarray(start, iend + 8), ext: "png", contentType: "image/png" };
}

function extractLastGif(buffer) {
  const start = buffer.lastIndexOf(Buffer.from("GIF8"));
  if (start < 0) return null;
  const end = buffer.indexOf(Buffer.from([0x3b]), start + 6);
  if (end < 0) return null;
  return { start, body: buffer.subarray(start, end + 1), ext: "gif", contentType: "image/gif" };
}

function extractLastIsoBmff(buffer) {
  let cursor = buffer.length;
  while (cursor > 0) {
    const ftyp = buffer.lastIndexOf(Buffer.from("ftyp"), cursor - 1);
    if (ftyp < 4) return null;
    const media = extractIsoBmffAt(buffer, ftyp - 4);
    if (media) return { start: ftyp - 4, ...media };
    cursor = ftyp;
  }
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

function extractIsoBmff(buffer) {
  let cursor = 0;
  while (true) {
    const ftyp = buffer.indexOf(Buffer.from("ftyp"), cursor);
    if (ftyp < 4) return null;
    const media = extractIsoBmffAt(buffer, ftyp - 4);
    if (media) return media;
    cursor = ftyp + 4;
  }
}

function extractIsoBmffAt(buffer, start) {
  if (start < 0 || start + 12 > buffer.length) return null;
  const firstType = buffer.toString("ascii", start + 4, start + 8);
  if (firstType !== "ftyp") return null;

  let cursor = start;
  let end = start;
  let boxes = 0;
  while (cursor + 8 <= buffer.length) {
    const type = buffer.toString("ascii", cursor + 4, cursor + 8);
    if (!/^[\x20-\x7e]{4}$/.test(type)) break;

    let size = buffer.readUInt32BE(cursor);
    let headerSize = 8;
    if (size === 1) {
      if (cursor + 16 > buffer.length) break;
      const size64 = buffer.readBigUInt64BE(cursor);
      if (size64 > BigInt(Number.MAX_SAFE_INTEGER)) break;
      size = Number(size64);
      headerSize = 16;
    } else if (size === 0) {
      end = buffer.length;
      boxes += 1;
      break;
    }

    if (size < headerSize || cursor + size > buffer.length) break;
    boxes += 1;
    cursor += size;
    end = cursor;
  }

  const body = buffer.subarray(start, end);
  if (boxes < 2 || body.length < 1024 || (!body.includes(Buffer.from("moov")) && !body.includes(Buffer.from("moof")))) return null;
  const majorBrand = buffer.toString("ascii", start + 8, start + 12).trim().toLowerCase();
  const isQuickTime = majorBrand === "qt";
  return {
    body,
    ext: isQuickTime ? "mov" : "mp4",
    contentType: isQuickTime ? "video/quicktime" : "video/mp4",
  };
}

async function fetchMediaFromNotionApi(row) {
  if (!notionApiKey) return null;

  const blockRes = await fetch(`https://api.notion.com/v1/blocks/${encodeURIComponent(row.id)}`, {
    headers: {
      Authorization: `Bearer ${notionApiKey}`,
      "Notion-Version": "2022-06-28",
    },
  });
  if (!blockRes.ok) return null;

  const block = await blockRes.json();
  const typed = block?.[row.type];
  const fileUrl = typed?.file?.url || typed?.external?.url;
  if (!fileUrl || typed?.type === "external") return null;

  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) return null;
  const contentType = fileRes.headers.get("content-type") || contentTypeFromUrl(fileUrl) || defaultContentType(row.type);
  const body = Buffer.from(await fileRes.arrayBuffer());
  if (body.length === 0) return null;

  return {
    body,
    ext: extensionFromContentType(contentType) || extensionFromUrl(fileUrl) || defaultExtension(row.type),
    contentType,
  };
}

function contentTypeFromUrl(value) {
  const ext = extensionFromUrl(value);
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "mp4") return "video/mp4";
  if (ext === "mov") return "video/quicktime";
  return null;
}

function extensionFromContentType(value) {
  const type = String(value || "").toLowerCase().split(";")[0].trim();
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  if (type === "video/mp4") return "mp4";
  if (type === "video/quicktime") return "mov";
  return null;
}

function extensionFromUrl(value) {
  const pathname = (() => {
    try { return new URL(value).pathname; } catch { return String(value || ""); }
  })();
  const match = pathname.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase().replace("jpeg", "jpg") : null;
}

function defaultContentType(type) {
  return type === "video" ? "video/mp4" : "image/jpeg";
}

function defaultExtension(type) {
  return type === "video" ? "mp4" : "jpg";
}

function storagePathFor(row, ext) {
  return `notion-photo/${row.parentId}/${row.id}.${ext}`;
}

function thumbnailPathFor(row, ext) {
  return `notion-photo-thumbnail/${row.parentId}/${row.id}.${ext}`;
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
