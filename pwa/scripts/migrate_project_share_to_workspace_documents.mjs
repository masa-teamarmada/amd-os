#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { get, list } from "@vercel/blob";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const DRY_RUN = !APPLY;
const BUCKET = "workspace-files";
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const LEGACY_FOLDER_ROOT = "AMD内部";
const LEGACY_FOLDER_PATH = `${LEGACY_FOLDER_ROOT}/Drive資料`;

const SOURCES = [
  { alias: "vsx", projectId: "p26", tokenEnv: "PROJECT_SHARE_VSX_BLOB_TOKEN" },
  { alias: "cx", projectId: "p20", tokenEnv: "PROJECT_SHARE_CX_BLOB_TOKEN" },
  { alias: "se", projectId: "p10", tokenEnv: "PROJECT_SHARE_SE_BLOB_TOKEN" },
  { alias: "sx", projectId: "p21", tokenEnv: "PROJECT_SHARE_SX_BLOB_TOKEN" },
  { alias: "zmp", projectId: "p19", tokenEnv: "PROJECT_SHARE_ZMP_BLOB_TOKEN" },
  { alias: "kute", projectId: "p25", tokenEnv: "PROJECT_SHARE_KUTE_BLOB_TOKEN" },
];

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw Object.assign(new Error("required environment is missing"), { code: "MISSING_ENV" });
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeName(value) {
  if (typeof value !== "string") return null;
  const result = value.trim();
  if (!result || result.length > 240 || result === "." || result === "..") return null;
  if (result.includes("/") || result.includes("\\") || /[\u0000-\u001f\u007f]/.test(result)) return null;
  return result;
}

function normalizeFolder(value) {
  if (value === "") return "";
  if (typeof value !== "string" || value.length > 1000) return null;
  if (value.startsWith("/") || value.endsWith("/") || value.includes("//") || value.includes("\\")) return null;
  const parts = value.split("/");
  if (parts.length > 32 || parts.some((part) => !normalizeName(part))) return null;
  return parts.join("/");
}

function splitRelativePath(relativePath) {
  const slash = relativePath.lastIndexOf("/");
  const folderPath = slash < 0 ? "" : relativePath.slice(0, slash);
  const displayName = slash < 0 ? relativePath : relativePath.slice(slash + 1);
  if (normalizeFolder(folderPath) === null || !normalizeName(displayName)) return null;
  return { folderPath, displayName };
}

function parentFolder(path) {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash);
}

function folderName(path) {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? path : path.slice(slash + 1);
}

function sourceRef(alias, kind, identity) {
  return `${alias}:${kind}:${sha256(identity)}`;
}

function targetKey(entry) {
  return `${entry.project_id}|${entry.folder_path}|${entry.display_name.toLocaleLowerCase("ja")}`;
}

function sourceKey(entry) {
  return `${entry.source_kind}|${entry.source_ref}`;
}

async function listAll(prefix, token) {
  const blobs = [];
  let cursor;
  for (;;) {
    const result = await list({ prefix, mode: "expanded", token, ...(cursor ? { cursor } : {}) });
    blobs.push(...result.blobs);
    if (!result.hasMore || !result.cursor) return blobs;
    cursor = result.cursor;
  }
}

async function readPrivateBlob(pathname, token) {
  const result = await get(pathname, { access: "private", useCache: false, token });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw Object.assign(new Error("source object unavailable"), { code: "SOURCE_UNAVAILABLE" });
  }
  const bytes = new Uint8Array(await new Response(result.stream).arrayBuffer());
  return {
    bytes,
    contentType: result.blob.contentType || "application/octet-stream",
    size: result.blob.size,
  };
}

function addFolderAndParents(folderMap, { projectId, path, alias, visibility, sourceKind }) {
  if (!path) return;
  const parts = path.split("/");
  for (let index = 0; index < parts.length; index += 1) {
    const fullPath = parts.slice(0, index + 1).join("/");
    const key = `${projectId}|${fullPath}`;
    const entry = {
      scope_kind: "project",
      institution_workspace_id: null,
      project_id: projectId,
      entry_kind: "folder",
      visibility,
      folder_path: parentFolder(fullPath),
      display_name: folderName(fullPath),
      storage_bucket: null,
      storage_path: null,
      external_url: null,
      mime_type: "application/x-directory",
      file_size_bytes: 0,
      upload_status: "active",
      source_kind: sourceKind,
      source_ref: sourceRef(alias, "folder", fullPath),
      content_sha256: null,
      source_updated_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _alias: alias,
    };
    const existing = folderMap.get(key);
    if (!existing || (existing.visibility === "amd_internal" && visibility === "workspace_shared")) {
      folderMap.set(key, entry);
    }
  }
}

function validHttpUrl(value) {
  if (typeof value !== "string" || value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function validTimestamp(value, fallback) {
  const parsed = typeof value === "string" || value instanceof Date ? new Date(value) : null;
  return parsed && Number.isFinite(parsed.getTime()) ? parsed.toISOString() : fallback;
}

async function inventoryProjectShare() {
  const entries = [];
  const folders = new Map();
  const byAlias = {};

  for (const source of SOURCES) {
    const token = requiredEnv(source.tokenEnv);
    const filePrefix = `${source.alias}/files/`;
    const linkPrefix = `${source.alias}/links/`;
    const fileBlobs = await listAll(filePrefix, token);
    const linkBlobs = await listAll(linkPrefix, token);
    let fileCount = 0;
    let linkCount = 0;

    for (const blob of fileBlobs) {
      if (blob.pathname === filePrefix) continue;
      const relative = blob.pathname.slice(filePrefix.length);
      if (!relative) continue;

      if (blob.pathname.endsWith("/") || relative === ".folder" || relative.endsWith("/.folder")) {
        const folderPath = relative === ".folder"
          ? ""
          : relative.replace(/\/$/, "").replace(/\/.folder$/, "");
        if (folderPath && normalizeFolder(folderPath) === null) {
          throw Object.assign(new Error("invalid source folder"), { code: "INVALID_SOURCE_FOLDER" });
        }
        addFolderAndParents(folders, {
          projectId: source.projectId,
          path: folderPath,
          alias: source.alias,
          visibility: "workspace_shared",
          sourceKind: "project_share_folder",
        });
        continue;
      }

      const path = splitRelativePath(relative);
      if (!path || blob.size > MAX_FILE_BYTES) {
        throw Object.assign(new Error("invalid source file"), { code: "INVALID_SOURCE_FILE" });
      }
      addFolderAndParents(folders, {
        projectId: source.projectId,
        path: path.folderPath,
        alias: source.alias,
        visibility: "workspace_shared",
        sourceKind: "project_share_folder",
      });
      const timestamp = validTimestamp(blob.uploadedAt, new Date().toISOString());
      entries.push({
        scope_kind: "project",
        institution_workspace_id: null,
        project_id: source.projectId,
        entry_kind: "file",
        visibility: "workspace_shared",
        folder_path: path.folderPath,
        display_name: path.displayName,
        storage_bucket: BUCKET,
        storage_path: null,
        external_url: null,
        mime_type: "application/octet-stream",
        file_size_bytes: Number(blob.size || 0),
        upload_status: "active",
        source_kind: "project_share_file",
        source_ref: sourceRef(source.alias, "file", blob.pathname),
        content_sha256: null,
        source_updated_at: timestamp,
        created_at: timestamp,
        updated_at: timestamp,
        _alias: source.alias,
        _sourcePathname: blob.pathname,
        _token: token,
      });
      fileCount += 1;
    }

    for (const blob of linkBlobs) {
      if (!blob.pathname.endsWith(".json")) continue;
      const payload = await readPrivateBlob(blob.pathname, token);
      let link;
      try {
        link = JSON.parse(new TextDecoder().decode(payload.bytes));
      } catch {
        throw Object.assign(new Error("invalid source link"), { code: "INVALID_SOURCE_LINK" });
      }
      const folderPath = normalizeFolder(link?.folder);
      const displayName = normalizeName(link?.name);
      const externalUrl = validHttpUrl(link?.url);
      if (!folderPath && folderPath !== "" || !displayName || !externalUrl) {
        throw Object.assign(new Error("invalid source link"), { code: "INVALID_SOURCE_LINK" });
      }
      addFolderAndParents(folders, {
        projectId: source.projectId,
        path: folderPath,
        alias: source.alias,
        visibility: "workspace_shared",
        sourceKind: "project_share_folder",
      });
      const createdAt = validTimestamp(link.createdAt, new Date().toISOString());
      const updatedAt = validTimestamp(link.updatedAt, createdAt);
      entries.push({
        scope_kind: "project",
        institution_workspace_id: null,
        project_id: source.projectId,
        entry_kind: "link",
        visibility: "workspace_shared",
        folder_path: folderPath,
        display_name: displayName,
        storage_bucket: null,
        storage_path: null,
        external_url: externalUrl,
        mime_type: "text/uri-list",
        file_size_bytes: 0,
        upload_status: "active",
        source_kind: "project_share_link",
        source_ref: sourceRef(source.alias, "link", String(link.id || blob.pathname)),
        content_sha256: null,
        source_updated_at: updatedAt,
        created_at: createdAt,
        updated_at: updatedAt,
        _alias: source.alias,
      });
      linkCount += 1;
    }

    byAlias[source.alias] = { files: fileCount, links: linkCount };
  }

  return { entries, folders, byAlias };
}

async function inventoryLegacyDrive(db, folderMap) {
  const projectIds = SOURCES.map((source) => source.projectId);
  const { data, error } = await db
    .from("project_documents")
    .select("document_id,project_id,web_view_link,file_name,mime_type,file_size_bytes,created_at,updated_at")
    .in("project_id", projectIds)
    .eq("upload_status", "active");
  if (error) throw Object.assign(new Error("legacy document query failed"), { code: "LEGACY_QUERY_FAILED" });

  const entries = [];
  const projectsWithDocuments = new Set((data || []).map((row) => String(row.project_id)));
  for (const projectId of projectsWithDocuments) {
    addFolderAndParents(folderMap, {
      projectId,
      path: LEGACY_FOLDER_PATH,
      alias: `legacy-${projectId}`,
      visibility: "amd_internal",
      sourceKind: "legacy_drive_folder",
    });
  }

  for (const row of data || []) {
    const displayName = normalizeName(row.file_name);
    const externalUrl = validHttpUrl(row.web_view_link);
    if (!displayName || !externalUrl) {
      throw Object.assign(new Error("invalid legacy document"), { code: "INVALID_LEGACY_DOCUMENT" });
    }
    const createdAt = validTimestamp(row.created_at, new Date().toISOString());
    const updatedAt = validTimestamp(row.updated_at, createdAt);
    entries.push({
      scope_kind: "project",
      institution_workspace_id: null,
      project_id: String(row.project_id),
      entry_kind: "link",
      visibility: "amd_internal",
      folder_path: LEGACY_FOLDER_PATH,
      display_name: displayName,
      storage_bucket: null,
      storage_path: null,
      external_url: externalUrl,
      mime_type: String(row.mime_type || "application/octet-stream"),
      file_size_bytes: Number(row.file_size_bytes || 0),
      upload_status: "active",
      source_kind: "legacy_project_document",
      source_ref: `project_documents:${row.document_id}`,
      content_sha256: null,
      source_updated_at: updatedAt,
      created_at: createdAt,
      updated_at: updatedAt,
      _alias: "legacy-drive",
    });
  }
  return entries;
}

function serializableRow(entry) {
  return Object.fromEntries(Object.entries(entry).filter(([key]) => !key.startsWith("_")));
}

async function existingWorkspaceRows(db) {
  const projectIds = SOURCES.map((source) => source.projectId);
  const { data, error } = await db
    .from("workspace_documents")
    .select("document_id,project_id,folder_path,display_name,entry_kind,upload_status,source_kind,source_ref,storage_path,content_sha256,file_size_bytes")
    .in("project_id", projectIds);
  if (error) throw Object.assign(new Error("workspace document query failed"), { code: "WORKSPACE_QUERY_FAILED" });
  return data || [];
}

function preparePlan(planned, existing) {
  const existingSources = new Map(existing.filter((row) => row.source_ref).map((row) => [sourceKey(row), row]));
  const occupied = new Map(
    existing
      .filter((row) => row.upload_status === "active" || row.upload_status === "pending")
      .map((row) => [targetKey(row), row]),
  );
  const plan = [];
  let skipped = 0;
  let conflicts = 0;

  for (const entry of planned) {
    if (existingSources.has(sourceKey(entry))) {
      skipped += 1;
      continue;
    }
    const key = targetKey(entry);
    if (occupied.has(key)) {
      conflicts += 1;
      continue;
    }
    occupied.set(key, entry);
    plan.push(entry);
  }
  return { plan, skipped, conflicts };
}

async function insertMetadata(db, entry) {
  const { data, error } = await db
    .from("workspace_documents")
    .insert(serializableRow(entry))
    .select("document_id,storage_path,content_sha256,file_size_bytes")
    .single();
  if (error) throw Object.assign(new Error("metadata insert failed"), { code: "METADATA_INSERT_FAILED" });
  return data;
}

async function applyEntry(db, entry) {
  if (entry.entry_kind !== "file") return insertMetadata(db, entry);

  const source = await readPrivateBlob(entry._sourcePathname, entry._token);
  // Private Blobのget()は一部objectでblob.size=0を返す一方、stream本体はlist時の
  // sizeと一致する。移行判定は実際にhash対象となるbody byte数を正本にする。
  if (source.bytes.byteLength !== entry.file_size_bytes) {
    throw Object.assign(new Error("source size changed"), {
      code: "SOURCE_SIZE_CHANGED",
      alias: entry._alias,
      expectedBytes: entry.file_size_bytes,
      metadataBytes: source.size,
      bodyBytes: source.bytes.byteLength,
    });
  }
  const documentId = randomUUID();
  const storagePath = `project/${entry.project_id}/${documentId}`;
  const checksum = sha256(source.bytes);
  const row = {
    ...entry,
    document_id: documentId,
    storage_path: storagePath,
    mime_type: source.contentType,
    content_sha256: checksum,
  };

  const { error: uploadError } = await db.storage.from(BUCKET).upload(storagePath, source.bytes, {
    contentType: source.contentType,
    upsert: false,
    cacheControl: "3600",
  });
  if (uploadError) throw Object.assign(new Error("target upload failed"), { code: "TARGET_UPLOAD_FAILED" });

  try {
    return await insertMetadata(db, row);
  } catch (error) {
    await db.storage.from(BUCKET).remove([storagePath]);
    throw error;
  }
}

async function verifyApplied(db, expectedEntries) {
  const refs = new Map(expectedEntries.map((entry) => [sourceKey(entry), entry]));
  const rows = await existingWorkspaceRows(db);
  const relevant = rows.filter((row) => refs.has(sourceKey(row)));
  if (relevant.length !== refs.size) {
    throw Object.assign(new Error("metadata verification failed"), { code: "VERIFY_ROW_COUNT" });
  }

  let verifiedFiles = 0;
  for (const row of relevant) {
    if (row.entry_kind !== "file") continue;
    if (!row.storage_path || !row.content_sha256) {
      throw Object.assign(new Error("file evidence missing"), { code: "VERIFY_FILE_EVIDENCE" });
    }
    const { data, error } = await db.storage.from(BUCKET).download(row.storage_path);
    if (error || !data) throw Object.assign(new Error("target download failed"), { code: "VERIFY_DOWNLOAD" });
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (bytes.byteLength !== Number(row.file_size_bytes) || sha256(bytes) !== row.content_sha256) {
      throw Object.assign(new Error("target checksum mismatch"), { code: "VERIFY_CHECKSUM" });
    }
    verifiedFiles += 1;
  }
  return { rows: relevant.length, files: verifiedFiles };
}

function countKinds(entries) {
  return entries.reduce(
    (counts, entry) => ({ ...counts, [entry.entry_kind]: (counts[entry.entry_kind] || 0) + 1 }),
    { file: 0, link: 0, folder: 0 },
  );
}

async function main() {
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const projectShare = await inventoryProjectShare();
  const legacy = await inventoryLegacyDrive(db, projectShare.folders);
  const planned = [...projectShare.folders.values(), ...projectShare.entries, ...legacy];
  const existing = await existingWorkspaceRows(db);
  const prepared = preparePlan(planned, existing);

  const summary = {
    mode: DRY_RUN ? "dry-run" : "apply",
    source: projectShare.byAlias,
    legacyDriveLinks: legacy.length,
    planned: countKinds(planned),
    toInsert: countKinds(prepared.plan),
    skippedExisting: prepared.skipped,
    conflicts: prepared.conflicts,
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  if (prepared.conflicts > 0) {
    throw Object.assign(new Error("target conflicts found"), { code: "TARGET_CONFLICTS" });
  }
  if (DRY_RUN) return;

  const inserted = [];
  for (const entry of prepared.plan) {
    await applyEntry(db, entry);
    inserted.push(entry);
  }
  const verification = await verifyApplied(db, planned);
  process.stdout.write(`${JSON.stringify({ status: "ok", inserted: inserted.length, verification })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    status: "error",
    code: error?.code || "MIGRATION_FAILED",
    ...(error?.alias ? { alias: error.alias } : {}),
    ...(Number.isFinite(error?.expectedBytes) ? { expectedBytes: error.expectedBytes } : {}),
    ...(Number.isFinite(error?.metadataBytes) ? { metadataBytes: error.metadataBytes } : {}),
    ...(Number.isFinite(error?.bodyBytes) ? { bodyBytes: error.bodyBytes } : {}),
  })}\n`);
  process.exitCode = 1;
});
