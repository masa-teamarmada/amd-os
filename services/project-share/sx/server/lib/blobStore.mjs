import { list, del, head, rename, issueSignedToken, presignUrl, getDownloadUrl, createFolder as createFolderBlob, BlobNotFoundError as VercelBlobNotFoundError } from "@vercel/blob";
import { FILES_PREFIX, FOLDER_MARKER, isWithinFilesPrefix, sanitizeBasename, sanitizeFolderPath, buildFolderMarkerPath } from "./pathGuard.mjs";

export const ACCESS_URL_TTL_MS = 5 * 60 * 1000;

export class FolderNotEmptyError extends Error {
  constructor(message = "folder is not empty") {
    super(message);
    this.name = "FolderNotEmptyError";
    this.code = "FOLDER_NOT_EMPTY";
  }
}

export class SameLocationError extends Error {
  constructor(message = "source and destination are the same location") {
    super(message);
    this.name = "SameLocationError";
    this.code = "SAME_LOCATION";
  }
}

export class DestinationExistsError extends Error {
  constructor(message = "a file with the same name already exists at the destination") {
    super(message);
    this.name = "DestinationExistsError";
    this.code = "DESTINATION_EXISTS";
  }
}

async function listAllBlobs(prefix, { listFn = list } = {}) {
  const blobs = [];
  let cursor;
  for (;;) {
    const result = await listFn({ prefix, mode: "expanded", ...(cursor ? { cursor } : {}) });
    blobs.push(...result.blobs);
    if (!result.hasMore || !result.cursor) break;
    cursor = result.cursor;
  }
  return blobs;
}

export async function listFiles({ listFn = list } = {}) {
  const blobs = await listAllBlobs(FILES_PREFIX, { listFn });
  return blobs
    .filter((blob) => blob.pathname !== FILES_PREFIX)
    .filter((blob) => !blob.pathname.endsWith("/"))
    .filter((blob) => !blob.pathname.endsWith(`/${FOLDER_MARKER}`))
    .map((blob) => ({
      pathname: blob.pathname,
      name: blob.pathname.slice(FILES_PREFIX.length),
      size: blob.size,
      uploadedAt: blob.uploadedAt instanceof Date ? blob.uploadedAt.toISOString() : blob.uploadedAt,
    }));
}

export async function listDirectory(folderPath, { listFn = list } = {}) {
  const folder = sanitizeFolderPath(folderPath);
  if (folder === null) throw new Error("invalid folder path");

  const prefix = folder ? `${FILES_PREFIX}${folder}/` : FILES_PREFIX;
  const blobs = await listAllBlobs(prefix, { listFn });

  const folderNames = new Map();
  const files = [];

  for (const blob of blobs) {
    if (blob.pathname === prefix) continue;
    const rest = blob.pathname.slice(prefix.length);
    if (!rest) continue;
    const slashIndex = rest.indexOf("/");
    if (slashIndex === -1) {
      if (rest === FOLDER_MARKER) continue;
      files.push({
        pathname: blob.pathname,
        name: rest,
        size: blob.size,
        uploadedAt: blob.uploadedAt instanceof Date ? blob.uploadedAt.toISOString() : blob.uploadedAt,
      });
    } else {
      const name = rest.slice(0, slashIndex);
      if (!folderNames.has(name)) {
        const path = folder ? `${folder}/${name}` : name;
        folderNames.set(name, { name, path });
      }
    }
  }

  const folders = Array.from(folderNames.values()).sort((a, b) => a.name.localeCompare(b.name, "ja"));

  return { folder, folders, files };
}

export async function createFolder(parentPath, name, { createFolderFn = createFolderBlob } = {}) {
  const parent = sanitizeFolderPath(parentPath);
  if (parent === null) throw new Error("invalid parent path");
  const folderPath = parent ? `${parent}/${name}` : name;
  const folder = sanitizeFolderPath(folderPath);
  if (folder === null || !folder) throw new Error("invalid folder name");

  const nativeFolderPath = `${FILES_PREFIX}${folder}/`;
  await createFolderFn(nativeFolderPath, { access: "private" });

  return { name, path: folder };
}

export async function deleteEmptyFolder(folderPath, { listFn = list, delFn = del } = {}) {
  const folder = sanitizeFolderPath(folderPath);
  if (folder === null || !folder) throw new Error("invalid folder path");

  const markerPath = buildFolderMarkerPath(folder);
  const prefix = `${FILES_PREFIX}${folder}/`;
  const blobs = await listAllBlobs(prefix, { listFn });

  const hasOtherEntries = blobs.some((blob) => blob.pathname !== markerPath && blob.pathname !== prefix);
  if (hasOtherEntries) throw new FolderNotEmptyError();

  const deletablePaths = blobs
    .filter((blob) => blob.pathname === markerPath || blob.pathname === prefix)
    .map((blob) => blob.pathname);
  await Promise.all(deletablePaths.map((pathname) => delFn(pathname)));
}

export async function deleteFile(pathname, { delFn = del } = {}) {
  await delFn(pathname);
}

// Moves a file already stored at `pathname` into `targetFolder`, keeping its basename.
// Uses @vercel/blob's rename(), which copies to the destination first and only removes
// the source after the copy succeeds, so a failed move leaves the source untouched.
export async function moveFile(pathname, targetFolder, { renameFn = rename, headFn = head } = {}) {
  if (!isWithinFilesPrefix(pathname)) throw new Error("invalid source pathname");

  const targetFolderClean = sanitizeFolderPath(targetFolder);
  if (targetFolderClean === null) throw new Error("invalid target folder");

  const rest = pathname.slice(FILES_PREFIX.length);
  const slashIndex = rest.lastIndexOf("/");
  const basename = sanitizeBasename(slashIndex === -1 ? rest : rest.slice(slashIndex + 1));
  const sourceFolder = slashIndex === -1 ? "" : rest.slice(0, slashIndex);
  if (!basename) throw new Error("invalid source basename");

  if (sourceFolder === targetFolderClean) throw new SameLocationError();

  const destination = targetFolderClean
    ? `${FILES_PREFIX}${targetFolderClean}/${basename}`
    : `${FILES_PREFIX}${basename}`;

  const destinationExists = await headFn(destination).then(
    () => true,
    (err) => {
      if (err instanceof VercelBlobNotFoundError) return false;
      throw err;
    }
  );
  if (destinationExists) throw new DestinationExistsError();

  await renameFn(pathname, destination, { access: "private", allowOverwrite: false });
  return { pathname: destination };
}

// Renames a file in place while keeping its current folder.
// The destination is checked before rename so a collision never overwrites an existing file.
export async function renameFile(pathname, newName, { renameFn = rename, headFn = head } = {}) {
  if (!isWithinFilesPrefix(pathname)) throw new Error("invalid source pathname");

  const cleanName = sanitizeBasename(newName);
  if (!cleanName) throw new Error("invalid new file name");

  const rest = pathname.slice(FILES_PREFIX.length);
  const slashIndex = rest.lastIndexOf("/");
  const basename = sanitizeBasename(slashIndex === -1 ? rest : rest.slice(slashIndex + 1));
  const sourceFolder = slashIndex === -1 ? "" : rest.slice(0, slashIndex);
  if (!basename) throw new Error("invalid source basename");
  if (basename === cleanName) throw new SameLocationError("the file name is unchanged");

  const destination = sourceFolder
    ? `${FILES_PREFIX}${sourceFolder}/${cleanName}`
    : `${FILES_PREFIX}${cleanName}`;

  const destinationExists = await headFn(destination).then(
    () => true,
    (err) => {
      if (err instanceof VercelBlobNotFoundError) return false;
      throw err;
    }
  );
  if (destinationExists) throw new DestinationExistsError();

  await renameFn(pathname, destination, { access: "private", allowOverwrite: false });
  return { pathname: destination };
}

export async function createSignedAccessUrl(
  pathname,
  { download = false, issueSignedTokenFn = issueSignedToken, presignUrlFn = presignUrl, getDownloadUrlFn = getDownloadUrl } = {}
) {
  const validUntil = Date.now() + ACCESS_URL_TTL_MS;
  // The signed URL itself remains pathname-specific. Omitting pathname here
  // avoids Vercel Blob's delegation-token decoding mismatch for Unicode names.
  const signedToken = await issueSignedTokenFn({
    operations: ["get"],
    validUntil,
  });
  const { presignedUrl } = await presignUrlFn(signedToken, {
    operation: "get",
    pathname,
    access: "private",
    validUntil,
  });
  const url = download ? getDownloadUrlFn(presignedUrl) : presignedUrl;
  return { url, expiresAt: validUntil };
}
