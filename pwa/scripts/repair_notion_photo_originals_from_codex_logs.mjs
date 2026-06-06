#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const BUCKET = "company-media";
const NOTION_DB = "/Users/masa/Library/Application Support/Notion/notion.db";
const LOG_ROOTS = [
  "/Users/masa/.codex",
  "/Users/masa/Library/Application Support/Codex",
];

const TARGET_BLOCK_IDS = [
  "d44fef2d-0432-40c1-9244-0613bd870552",
  "13297749-c608-8006-8858-c2954e630c97",
  "14097749-c608-8075-bbd2-d2956a0dee2a",
  "14097749-c608-8009-a1ad-d68a687c73c3",
  "14097749-c608-800d-8ac2-cc3cac2b7324",
  "14097749-c608-804c-9032-e3c9b51260e2",
  "14097749-c608-8066-a2e0-c8795e00f83b",
  "14097749-c608-808a-9c6f-c79226810d6e",
  "14097749-c608-8096-bfe2-e057cea0fcc6",
  "14097749-c608-80bb-a8c9-efb2b048d39c",
  "14097749-c608-80cd-822f-c93337a68f79",
  "14097749-c608-80d0-b827-f5a384afb5c2",
  "14097749-c608-80dc-b7a1-c437b836a36d",
  "14097749-c608-80d5-beec-e343a663433d",
  "10297749-c608-80ff-99a9-d52203645c2f",
];

loadEnv("/Users/masa/projects/AMD/amd-os/pwa/.env.local");
loadEnv(path.resolve("../.vercel/.env.production.local"));
loadEnv(path.resolve(".vercel/.env.production.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const rows = loadTargetRows();
const logFiles = findLogFiles(rows.map((row) => row.fileId));
let repaired = 0;
let missingSignedUrl = 0;
let failed = 0;
const details = [];

for (const row of rows) {
  const signedUrl = findSignedUrlForFileId(row.fileId, logFiles);
  if (!signedUrl) {
    missingSignedUrl += 1;
    details.push({ blockId: row.blockId, fileId: row.fileId, status: "missing_signed_url" });
    continue;
  }

  const response = await fetch(signedUrl);
  if (!response.ok) {
    failed += 1;
    details.push({ blockId: row.blockId, fileId: row.fileId, status: `download_${response.status}` });
    continue;
  }

  const contentType = response.headers.get("content-type") || contentTypeFromUrl(signedUrl) || "image/jpeg";
  const body = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(body).metadata();
  const thumbnail = await sharp(body)
    .rotate()
    .resize({ width: 720, height: 540, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
  const storagePath = `notion-photo/${row.parentId}/${row.blockId}.${extensionFromContentType(contentType) || extensionFromUrl(signedUrl) || "jpg"}`;
  const thumbnailPath = `notion-photo-thumbnail/${row.parentId}/${row.blockId}.webp`;

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, body, { contentType, upsert: true });
  if (storageError) {
    failed += 1;
    details.push({ blockId: row.blockId, fileId: row.fileId, status: "storage_upload_failed" });
    continue;
  }

  const { error: thumbnailError } = await supabase.storage
    .from(BUCKET)
    .upload(thumbnailPath, thumbnail, { contentType: "image/webp", upsert: true });
  if (thumbnailError) {
    failed += 1;
    details.push({ blockId: row.blockId, fileId: row.fileId, status: "thumbnail_upload_failed" });
    continue;
  }

  const { error: updateError } = await supabase
    .from("media_assets")
    .update({
      storage_bucket: BUCKET,
      storage_path: storagePath,
      thumbnail_path: thumbnailPath,
      updated_by: "codex_notion_signed_original_repair",
    })
    .eq("notion_source_id", row.blockId);
  if (updateError) {
    failed += 1;
    details.push({ blockId: row.blockId, fileId: row.fileId, status: "db_update_failed" });
    continue;
  }

  repaired += 1;
  details.push({
    blockId: row.blockId,
    fileId: row.fileId,
    status: "repaired",
    dimensions: `${metadata.width}x${metadata.height}`,
    bytes: body.length,
  });
}

console.log(JSON.stringify({ targets: rows.length, logFiles: logFiles.length, repaired, missingSignedUrl, failed, details }, null, 2));

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

function loadTargetRows() {
  const ids = TARGET_BLOCK_IDS.map((id) => `'${id}'`).join(",");
  const raw = execFileSync("sqlite3", [NOTION_DB, "-json", `
select id, parent_id, properties, format
from block
where id in (${ids})
order by parent_id, id;
`], { maxBuffer: 20 * 1024 * 1024 }).toString();
  return JSON.parse(raw).map((row) => {
    const source = sourceFromRow(row);
    return {
      blockId: String(row.id),
      parentId: String(row.parent_id),
      fileId: notionFileId(source),
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
      // Try next field.
    }
  }
  return "";
}

function notionFileId(source) {
  const ids = [...String(source || "").matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)]
    .map((match) => match[0].toLowerCase());
  return ids.find((id) => id !== "86b83c2f-415f-4d48-90ae-ccca9e69abda") ?? ids[0] ?? "";
}

function findLogFiles(fileIds) {
  const files = new Set();
  for (const fileId of fileIds) {
    for (const root of LOG_ROOTS) {
      if (!existsSync(root)) continue;
      try {
        const output = execFileSync("rg", ["-a", "-l", fileId, root], { maxBuffer: 50 * 1024 * 1024 }).toString();
        for (const line of output.split(/\r?\n/)) {
          if (line.trim()) files.add(line.trim());
        }
      } catch {
        // rg exits 1 when no files match.
      }
    }
  }
  return [...files];
}

function findSignedUrlForFileId(fileId, files) {
  const pattern = new RegExp(`https(?::|\\\\u003a|\\\\\\\\u003a)(?:/|\\\\/|\\\\\\\\/){2}prod-files-secure\\.s3\\.us-west-2\\.amazonaws\\.com[^\\s"'<>)]*${escapeRegExp(fileId)}[^\\s"'<>)]*`, "g");
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const matches = text.match(pattern) || [];
    for (const match of matches.reverse()) {
      const decoded = decodeLoggedUrl(match);
      if (decoded.includes(fileId) && decoded.includes("X-Amz-Signature")) return decoded;
    }
  }
  return null;
}

function decodeLoggedUrl(value) {
  return value
    .replace(/\\\\u0026/g, "&")
    .replace(/\\u0026/g, "&")
    .replace(/\\\\u003d/g, "=")
    .replace(/\\u003d/g, "=")
    .replace(/\\\\u003a/g, ":")
    .replace(/\\u003a/g, ":")
    .replace(/\\\\\//g, "/")
    .replace(/\\\//g, "/")
    .replace(/\\n.*$/s, "")
    .replace(/[\\"]+$/g, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function contentTypeFromUrl(value) {
  const ext = extensionFromUrl(value);
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return null;
}

function extensionFromContentType(value) {
  const type = String(value || "").toLowerCase().split(";")[0].trim();
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return null;
}

function extensionFromUrl(value) {
  const pathname = (() => {
    try { return new URL(value).pathname; } catch { return String(value || ""); }
  })();
  const match = pathname.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase().replace("jpeg", "jpg") : null;
}
