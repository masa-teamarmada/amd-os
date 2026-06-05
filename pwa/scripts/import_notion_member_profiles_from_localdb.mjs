#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const NOTION_DB = "/Users/masa/Library/Application Support/Notion/notion.db";
const MEMBER_COLLECTION_ID = "4f13723c-7383-4834-9b48-9ede8b59f014";
const BUCKET = "company-media";
const CACHE_ROOTS = [
  "/Users/masa/Library/Application Support/Notion/Partitions/notion/Cache/Cache_Data",
  "/Users/masa/Library/Application Support/Notion/Partitions/notion/Service Worker/CacheStorage",
  "/Users/masa/Library/Application Support/Notion/Partitions/notion/File System",
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

const memberPages = loadMemberPages();
const cacheFiles = listFiles(CACHE_ROOTS);
const photoSearchTokens = new Set(
  memberPages.flatMap((row) => row.photoFiles.flatMap((file) => file.searchTokens)).filter(Boolean),
);
const cachedByToken = indexCacheFiles(cacheFiles, photoSearchTokens);

let updatedProfiles = 0;
let photoAssets = 0;
let uploadedPhotos = 0;
let skippedPhotos = 0;

for (const page of memberPages) {
  const existing = await findExistingProfile(page.id, page.displayName);
  if (!existing) continue;

  const profilePatch = {
    display_name: page.displayName,
    full_name: page.fullName,
    public_title: page.titleLabel,
    internal_title: page.titleLabel,
    notion_status: page.notionStatus,
    joined_on: page.joinedOn,
    effort: page.effort,
    bio_short: page.bioShort,
    bio_long: page.bioLong,
    mbti_tags: page.mbtiTags,
    origin_label: page.originLabel,
    residence_label: page.residenceLabel,
    join_context: page.joinContext,
    off_time_note: page.offTimeNote,
    favorite_food: page.favoriteFood,
    bucket_list: page.bucketList,
    visibility: "internal",
    status: "approved_internal",
    source_confidence: 0.96,
    source_kind: "notion",
    source_ref: "notion:team-armada-member-list",
    tags: [
      "notion_member_list",
      "notion_member_profile_full",
      "verified_2026_06_05",
      page.notionStatus ? `notion_status:${page.notionStatus}` : null,
      page.photoFiles.length > 0 ? "photo_present" : null,
    ].filter(Boolean),
    notion_source_id: page.id,
    notion_last_synced_at: new Date().toISOString(),
    reviewed_by: "codex_notion_member_profile_full_import",
    reviewed_at: new Date().toISOString(),
    updated_by: "codex_notion_member_profile_full_import",
  };

  const { error: profileError } = await supabase
    .from("member_profiles")
    .update(profilePatch)
    .eq("member_profile_id", existing.member_profile_id);
  if (profileError) throw profileError;
  updatedProfiles += 1;

  if (page.photoFiles.length === 0) continue;

  for (const [index, photoFile] of page.photoFiles.entries()) {
    const photoNotionSourceId = index === 0 ? `${page.id}:photo` : `${page.id}:photo:${index + 1}`;
    const memberIds = existing.member_id ? [existing.member_id] : [];
    const { data: asset, error: assetError } = await supabase
      .from("media_assets")
      .upsert({
        title: `Member photo review: ${page.displayName}${index === 0 ? "" : ` #${index + 1}`}`,
        asset_kind: "photo",
        member_ids: memberIds,
        tags: ["notion_member_photo", "notion_member_profile_full", "needs_review"],
        visibility: "admin_only",
        status: "needs_review",
        source_confidence: 0.96,
        usage_permission: "unknown",
        consent_status: "unknown",
        source_kind: "notion",
        source_ref: "notion:team-armada-member-list:photo-present",
        notion_source_id: photoNotionSourceId,
        notion_last_synced_at: new Date().toISOString(),
        updated_by: "codex_notion_member_profile_full_import",
      }, { onConflict: "notion_source_id" })
      .select("asset_id")
      .single();
    if (assetError) throw assetError;
    photoAssets += 1;

    const cached = findCachedPhoto(photoFile);
    const media = cached ? extractMediaNearTokens(cached.buffer, photoFile.searchTokens) || extractMedia(cached.buffer) : null;
    if (media) {
      const storagePath = `notion-member-photo/${page.id}/${asset.asset_id}.${media.ext}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, media.body, { contentType: media.contentType, upsert: true });
      if (uploadError) throw uploadError;

      const { error: storageUpdateError } = await supabase
        .from("media_assets")
        .update({
          storage_bucket: BUCKET,
          storage_path: storagePath,
          thumbnail_path: null,
          updated_by: "codex_notion_member_profile_full_import",
        })
        .eq("asset_id", asset.asset_id);
      if (storageUpdateError) throw storageUpdateError;
      uploadedPhotos += 1;
    } else {
      skippedPhotos += 1;
    }

    if (index === 0) {
      const { error: linkError } = await supabase
        .from("member_profiles")
        .update({
          photo_asset_id: asset.asset_id,
          updated_by: "codex_notion_member_profile_full_import",
        })
        .eq("member_profile_id", existing.member_profile_id);
      if (linkError) throw linkError;
    }
  }
}

console.log(JSON.stringify({
  notionMemberPages: memberPages.length,
  updatedProfiles,
  photoAssets,
  uploadedPhotos,
  skippedPhotos,
}, null, 2));

async function findExistingProfile(notionSourceId, displayName) {
  const byNotion = await supabase
    .from("member_profiles")
    .select("member_profile_id,member_id")
    .eq("notion_source_id", notionSourceId)
    .maybeSingle();
  if (byNotion.error) throw byNotion.error;
  if (byNotion.data) return byNotion.data;

  const byName = await supabase
    .from("member_profiles")
    .select("member_profile_id,member_id")
    .eq("display_name", displayName)
    .maybeSingle();
  if (byName.error) throw byName.error;
  return byName.data;
}

function loadMemberPages() {
  const sql = `
select id, properties
from block
where parent_id = '${MEMBER_COLLECTION_ID}' and type = 'page'
order by id;
`;
  const raw = execFileSync("sqlite3", [NOTION_DB, "-json", sql], { maxBuffer: 80 * 1024 * 1024 }).toString();
  return JSON.parse(raw).map((row) => {
    const properties = JSON.parse(row.properties || "{}");
    const displayName = textProp(properties.title) || "(untitled)";
    const values = {
      id: String(row.id),
      displayName,
      fullName: textProp(properties.RdVL),
      titleLabel: textProp(properties["hOQf"]),
      notionStatus: textProp(properties["?}Az"]),
      joinedOn: dateProp(properties["\\FkQ"]),
      effort: numberProp(properties["^st;"]),
      bioShort: stripLabel(textProp(properties["_S@z"]), "略歴"),
      mbtiTags: multiTextProp(properties["gQI]"]),
      originLabel: stripLabel(textProp(properties.WRtw), "出身"),
      residenceLabel: stripLabel(textProp(properties["|Fd{"]), "居住地"),
      joinContext: stripLabel(textProp(properties.AeFR), "参画の経緯"),
      offTimeNote: stripLabel(textProp(properties["Rrz@"]), "オフのときなにしてる？"),
      favoriteFood: stripLabel(textProp(properties.xmrD), "好きなたべもの"),
      bucketList: stripLabel(textProp(properties[":ePr"]), "バケットリスト"),
      photoFiles: fileAssetsProp(properties["?_Q~"]),
    };
    values.bioLong = buildBioLong(values);
    return values;
  });
}

function textProp(value) {
  if (!Array.isArray(value)) return null;
  const text = value.flat(Infinity)
    .filter((part) => typeof part === "string")
    .filter((part) => !/^[puda]$/.test(part))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function multiTextProp(value) {
  const text = textProp(value);
  return text ? text.split(/\s*,\s*/).filter(Boolean) : [];
}

function dateProp(value) {
  const json = JSON.stringify(value ?? null);
  return json.match(/"start_date":"([^"]+)"/)?.[1] ?? null;
}

function numberProp(value) {
  const text = textProp(value);
  if (text == null) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function fileIdProp(value) {
  const json = JSON.stringify(value ?? null);
  const ids = [...json.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)]
    .map((match) => match[0].toLowerCase());
  if (ids.length === 0) return null;

  // Notion file URLs can contain both the workspace UUID and the actual file UUID.
  // The file UUID is the useful key for local cache lookup.
  const nonWorkspaceId = ids.find((id) => id !== "86b83c2f-415f-4d48-90ae-ccca9e69abda");
  return nonWorkspaceId ?? ids[0];
}

function fileAssetsProp(value) {
  const json = JSON.stringify(value ?? null);
  if (json === "null") return [];

  const fileNames = [...json.matchAll(/([^/\\?"']+\.(?:jpe?g|png|gif|webp|heic))/gi)]
    .map((match) => decodeURIComponent(match[1]))
    .filter(Boolean);
  const urls = [...json.matchAll(/https?:\\?\/\\?\/[^"\\]+/g)]
    .map((match) => match[0].replaceAll("\\/", "/"));

  const files = urls.map((url, index) => {
    const fileName = decodeURIComponent(url.split(/[/?#]/)[0].split("/").at(-1) || fileNames[index] || `photo-${index + 1}`);
    const fileId = fileIdProp(url);
    return {
      fileId,
      fileName,
      searchTokens: unique([fileId, fileName]),
    };
  });

  if (files.length > 0) return uniqueFiles(files);
  return uniqueFiles(fileNames.map((fileName) => ({ fileId: null, fileName, searchTokens: [fileName] })));
}

function stripLabel(value, label) {
  if (!value) return null;
  return value
    .replace(new RegExp(`^【${escapeRegExp(label)}】`), "")
    .trim() || null;
}

function buildBioLong(row) {
  const sections = [
    ["氏名", row.fullName],
    ["タイトル", row.titleLabel],
    ["ステータス", row.notionStatus],
    ["チーム加入日", row.joinedOn],
    ["エフォート", row.effort == null ? null : String(row.effort)],
    ["MBTI", row.mbtiTags.join(", ")],
    ["出身地", row.originLabel],
    ["居住地", row.residenceLabel],
    ["略歴", row.bioShort],
    ["参画の経緯", row.joinContext],
    ["オフのときなにしてる？", row.offTimeNote],
    ["好きなたべもの", row.favoriteFood],
    ["バケットリスト", row.bucketList],
  ].filter(([, value]) => value);
  return sections.map(([label, value]) => `【${label}】${value}`).join("\n");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function loadEnv(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx);
    if (process.env[key]) continue;
    let value = trimmed.slice(idx + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function listFiles(roots) {
  const files = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const stack = [root];
    while (stack.length) {
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
      if (found.has(fileId) || !buffer.includes(Buffer.from(fileId))) continue;
      const media = extractMedia(buffer);
      if (media) found.set(fileId, { filePath, buffer });
    }
  }
  return found;
}

function findCachedPhoto(photoFile) {
  for (const token of photoFile.searchTokens) {
    const cached = cachedByToken.get(token);
    if (cached) return cached;
  }
  return null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function uniqueFiles(files) {
  const seen = new Set();
  const uniqueRows = [];
  for (const file of files) {
    const key = file.fileId || file.fileName;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueRows.push(file);
  }
  return uniqueRows;
}

function extractMedia(buffer) {
  return extractWebp(buffer) || extractJpeg(buffer) || extractPng(buffer) || extractGif(buffer);
}

function extractMediaNearTokens(buffer, tokens) {
  const offsets = tokens
    .map((token) => buffer.indexOf(Buffer.from(token)))
    .filter((offset) => offset >= 0);
  for (const offset of offsets) {
    const windowStart = Math.max(0, offset - 1024 * 1024);
    const windowEnd = Math.min(buffer.length, offset + 5 * 1024 * 1024);
    const media = extractMedia(buffer.subarray(windowStart, windowEnd));
    if (media) return media;
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
