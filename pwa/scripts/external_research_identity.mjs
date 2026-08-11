import crypto from "node:crypto";

const TRACKING_KEYS = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
]);

function isTrackingKey(key) {
  const normalized = String(key || "").toLowerCase();
  return normalized.startsWith("utm_") || TRACKING_KEYS.has(normalized);
}

export function canonicalizeResearchUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return "";
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return "";
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  if ((parsed.protocol === "https:" && parsed.port === "443") || (parsed.protocol === "http:" && parsed.port === "80")) {
    parsed.port = "";
  }
  for (const key of [...parsed.searchParams.keys()]) {
    if (isTrackingKey(key)) parsed.searchParams.delete(key);
  }
  parsed.searchParams.sort();
  parsed.pathname = parsed.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  return parsed.toString();
}

export function normalizeResearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP")
    .replace(/[\p{P}\p{S}\s]+/gu, "")
    .trim();
}

export function normalizeResearchDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/u);
  if (!match) return raw;
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

export function buildExternalResearchIdentity(input) {
  const canonicalUrl = canonicalizeResearchUrl(input?.source_url ?? input?.sourceUrl ?? input?.url);
  const semantic = {
    title: normalizeResearchText(input?.title),
    entity: normalizeResearchText(input?.entity ?? input?.subject ?? input?.organization),
    event_date: normalizeResearchDate(input?.event_date ?? input?.eventDate ?? input?.published_at),
    material_update: normalizeResearchText(input?.material_update ?? input?.materialUpdate),
  };
  if (!semantic.title || !semantic.entity || !semantic.event_date) {
    throw new Error("external research identity requires title, entity, and event_date");
  }
  const sourceHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(semantic))
    .digest("hex");
  const urlHash = canonicalUrl
    ? crypto.createHash("sha256").update(canonicalUrl).digest("hex")
    : "";
  return { canonicalUrl, sourceHash, urlHash, semantic };
}
