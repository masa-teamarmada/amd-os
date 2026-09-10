import crypto from "node:crypto";

export const MAX_PROPOSALS_PER_PROJECT = 5;
export const QUESTION_TREE_TOKEN_NAMESPACE = "6d491aed-d3bd-5b7d-96f8-31c971c6fdb4";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

function uuidBytes(value) {
  return Buffer.from(value.replaceAll("-", ""), "hex");
}

function formatUuid(bytes) {
  const hex = Buffer.from(bytes).toString("hex");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}

export function uuidV5(name, namespace = QUESTION_TREE_TOKEN_NAMESPACE) {
  if (!isUuid(namespace)) throw new Error("client token namespace が UUID ではない");
  const digest = crypto
    .createHash("sha1")
    .update(Buffer.concat([uuidBytes(namespace), Buffer.from(String(name), "utf8")]))
    .digest()
    .subarray(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  return formatUuid(digest);
}

export function normalizeProposalText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildQuestionTreeClientToken({ projectId, sourceRef, kind, content }) {
  const parts = [projectId, sourceRef, kind, normalizeProposalText(content)];
  if (parts.some((part) => !String(part ?? "").trim())) {
    throw new Error("client token の生成に projectId / sourceRef / kind / content が必要");
  }
  return uuidV5(parts.join("\u0000"));
}

export function proposalCount(payload) {
  return [payload?.questions, payload?.actions, payload?.findings]
    .filter(Array.isArray)
    .reduce((total, rows) => total + rows.length, 0);
}

export function assertProposalLimit(payload) {
  const count = proposalCount(payload);
  if (count > MAX_PROPOSALS_PER_PROJECT) {
    throw new Error(`1 PJ の提案は最大 ${MAX_PROPOSALS_PER_PROJECT} 件（受信 ${count} 件）`);
  }
  return count;
}

export function dedupeRowsByClientToken(rows, existingTokens = new Set()) {
  const seen = new Set(existingTokens);
  const kept = [];
  let duplicateCount = 0;
  for (const row of rows) {
    if (!isUuid(row.client_token) || seen.has(row.client_token)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(row.client_token);
    kept.push(row);
  }
  return { rows: kept, duplicateCount };
}
