export const FILES_PREFIX = "zmp/files/";
export const FOLDER_MARKER = ".folder";

function hasUnsafeSegmentChar(value) {
  if (value.includes("/") || value.includes("\\")) return true;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function sanitizeSegment(value) {
  if (typeof value !== "string") return null;
  if (!value) return null;
  if (value !== value.trim()) return null;
  if (value === "." || value === "..") return null;
  if (hasUnsafeSegmentChar(value)) return null;
  if (value.length > 255) return null;
  return value;
}

export function sanitizeBasename(rawName) {
  const clean = sanitizeSegment(rawName);
  if (clean === null) return null;
  if (clean === FOLDER_MARKER) return null;
  return clean;
}

// Validates a nested folder path made of "/"-separated segments.
// The root (empty string) is a valid folder path representing FILES_PREFIX itself.
export function sanitizeFolderPath(rawFolder) {
  if (rawFolder === undefined || rawFolder === null || rawFolder === "") return "";
  if (typeof rawFolder !== "string") return null;
  const segments = rawFolder.split("/");
  const sanitized = [];
  for (const segment of segments) {
    const clean = sanitizeSegment(segment);
    if (!clean) return null;
    if (clean === FOLDER_MARKER) return null;
    sanitized.push(clean);
  }
  return sanitized.join("/");
}

export function buildFilePathname(folderOrName, maybeName) {
  // One-argument compatibility: buildFilePathname(rawName)
  if (maybeName === undefined) {
    const basename = sanitizeBasename(folderOrName);
    if (!basename) return null;
    return `${FILES_PREFIX}${basename}`;
  }

  const folder = sanitizeFolderPath(folderOrName);
  if (folder === null) return null;
  const basename = sanitizeBasename(maybeName);
  if (!basename) return null;
  return folder ? `${FILES_PREFIX}${folder}/${basename}` : `${FILES_PREFIX}${basename}`;
}

export function buildFolderMarkerPath(rawFolder) {
  const folder = sanitizeFolderPath(rawFolder);
  if (folder === null || !folder) return null;
  return `${FILES_PREFIX}${folder}/${FOLDER_MARKER}`;
}

export function isWithinFilesPrefix(pathname) {
  if (typeof pathname !== "string") return false;
  if (!pathname.startsWith(FILES_PREFIX)) return false;
  const rest = pathname.slice(FILES_PREFIX.length);
  if (!rest) return false;
  const segments = rest.split("/");
  for (const segment of segments) {
    const clean = sanitizeSegment(segment);
    if (!clean) return false;
    if (clean === FOLDER_MARKER) return false;
  }
  return true;
}
