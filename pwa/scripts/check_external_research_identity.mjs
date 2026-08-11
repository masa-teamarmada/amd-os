import assert from "node:assert/strict";
import {
  buildExternalResearchIdentity,
  canonicalizeResearchUrl,
  normalizeResearchDate,
  normalizeResearchText,
} from "./external_research_identity.mjs";

assert.equal(
  canonicalizeResearchUrl("HTTPS://Example.COM/news/item/?utm_source=x&b=2&a=1#section"),
  "https://example.com/news/item?a=1&b=2",
);
assert.equal(canonicalizeResearchUrl("javascript:alert(1)"), "");
assert.equal(normalizeResearchText(" ＮＥＤＯ・公募 開始！ "), "nedo公募開始");
assert.equal(normalizeResearchDate("2026年8月11日"), "2026-08-11");

const first = buildExternalResearchIdentity({
  title: "新制度の公募を開始",
  entity: "NEDO",
  event_date: "2026-08-11",
  source_url: "https://example.com/a?utm_medium=social",
});
const syndicated = buildExternalResearchIdentity({
  title: "新制度の公募を開始！",
  entity: "ＮＥＤＯ",
  event_date: "2026/8/11",
  source_url: "https://mirror.example.net/story",
});
assert.equal(first.sourceHash, syndicated.sourceHash, "URL違いの同一出来事は同じhash");

const followUp = buildExternalResearchIdentity({
  title: "新制度の公募を開始",
  entity: "NEDO",
  event_date: "2026-08-11",
  material_update: "締切が9月30日に確定",
  source_url: "https://example.com/a",
});
assert.notEqual(first.sourceHash, followUp.sourceHash, "重要な事実差分がある続報は別hash");

console.log("external research identity contract: ok");
