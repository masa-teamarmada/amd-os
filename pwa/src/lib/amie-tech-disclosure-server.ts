import { createHash } from "node:crypto";
import { amieReadTechDisclosure, AMIE_TECH_LEVELS, type AmieTechDisclosure, type AmieTechDisclosureStatus } from "./amie-tech-disclosure-model";
import { techLedgerTabOf, type TechTopic, type TechEntry } from "./project-tech";

type Entity = "topic" | "entry";
const FIELDS: Record<Entity, string[]> = {
  topic: ["project_id", "tech_topic_id", "block_kind", "title", "summary", "body_md", "tech_domain", "status", "needs_check", "check_reason", "presentation", "source_kind", "source_ref", "source_url"],
  entry: ["project_id", "tech_topic_id", "tech_entry_id", "row_label", "col_label", "value_min", "value_max", "value_text", "unit", "rating", "condition_text", "observed_on", "confidence", "source_kind", "source_ref", "source_url", "note", "needs_check", "check_reason"],
};
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, "en")).map(([key, v]) => [key, stable(v)]));
  return value;
}
/** 内容更新後に古い開示原稿を再利用しない。権限の代わりではなく、内容一致の検査。 */
export function amieTechReviewHash(record: Record<string, unknown>, entity: Entity) {
  return createHash("sha256").update(JSON.stringify(stable(Object.fromEntries(FIELDS[entity].map(key => [key, record[key] ?? null]))))).digest("hex");
}
export function amieTechDisclosureStatus(record: Record<string, unknown>, entity: Entity): AmieTechDisclosureStatus {
  const p = amieReadTechDisclosure(record.disclosure);
  if (!p || !p.dd || (entity === "entry" && !["public", "dd_summary"].includes(p.level))) return "excluded";
  return p.reviewed_hash === amieTechReviewHash(record, entity) ? "included" : "needs_review";
}
/** 編集権限の確認後だけ呼ぶ。reviewed_hashはクライアント入力を採用しない。 */
export function amiePrepareTechDisclosure(record: Record<string, unknown>, entity: Entity, value: unknown): AmieTechDisclosure {
  const p = amieReadTechDisclosure(value);
  if (!p || !AMIE_TECH_LEVELS.includes(p.level) || !p.reason.trim() || p.reason.length > 4000) throw new Error("開示区分と仕分け理由が必要");
  const keys = entity === "topic" ? ["title", "summary", "body_md", "source_label", "check_reason", "value_mode"] : ["row_label", "col_label", "value_text", "condition_text", "note", "source_label", "check_reason", "value_mode"];
  if (p.dd && Object.keys(p.dd).some(key => !keys.includes(key))) throw new Error("DD掲載欄の登録形式が不正");
  if (p.dd?.value_mode && !["source", "text_only"].includes(p.dd.value_mode)) throw new Error("DD数値の表示形式が不正");
  if (p.dd && Object.values(p.dd).some(value => typeof value === "string" && value.length > 60000)) throw new Error("DD掲載欄が長すぎる");
  if (["restricted", "core"].includes(p.level) && p.dd && (entity === "entry" || p.dd.body_md?.trim())) throw new Error("限定技術情報・核心ノウハウの本文・行は通常DDへ掲載できない");
  if (p.dd && !(p.dd[entity === "topic" ? "title" : "row_label"] || "").trim()) throw new Error("DDの見出しが必要");
  return { version: 1, level: p.level, reason: p.reason.trim(), dd: p.dd, ...(p.dd ? { reviewed_hash: amieTechReviewHash(record, entity) } : {}) };
}
export function amieProjectDdTechTopic(topic: TechTopic, entries: TechEntry[]): { topic: TechTopic; entries: TechEntry[] } | null {
  if (techLedgerTabOf(topic) !== "technology") return { topic: { ...topic, created_by: null, updated_by: null }, entries: entries.filter(e => e.tech_topic_id === topic.tech_topic_id).map(e => ({ ...e, created_by: null, updated_by: null })) };
  const policy = amieReadTechDisclosure(topic.disclosure);
  // 見出しと本文も明示レビュー済みの投資家向け原稿だけを返す。
  if (amieTechDisclosureStatus(topic as unknown as Record<string, unknown>, "topic") !== "included" || !policy?.dd) return null;
  const dd = policy.dd;
  const projected = entries.filter(e => e.tech_topic_id === topic.tech_topic_id && e.project_id === topic.project_id && amieTechDisclosureStatus(e as unknown as Record<string, unknown>, "entry") === "included").map(e => {
    const p = amieReadTechDisclosure(e.disclosure)!; const text = p.dd!;
    return { tech_entry_id:e.tech_entry_id, tech_topic_id:e.tech_topic_id, project_id:e.project_id, row_label: text.row_label!, col_label:text.col_label??null,
      value_min:text.value_mode === "text_only" ? null : e.value_min, value_max:text.value_mode === "text_only" ? null : e.value_max, unit:text.value_mode === "text_only" ? null : e.unit, rating:e.rating, observed_on:e.observed_on, confidence:e.confidence, source_kind:e.source_kind, needs_check:e.needs_check || !!text.check_reason, sort_order:e.sort_order,
      created_at:e.created_at, updated_at:e.updated_at, value_text: text.value_text ?? null, condition_text: text.condition_text ?? null, note: text.note ?? null,
      source_ref: text.source_label ?? null, source_url: null, check_reason: e.needs_check || text.check_reason ? text.check_reason || "測定条件・原データ等の追加確認が必要" : null,
      created_by: null, updated_by: null, disclosure: null, disclosure_level:p.level, disclosure_status: "included" as const };
  });
  if (["restricted", "core"].includes(policy.level) && (dd.body_md?.trim() || projected.length === 0)) return null;
  return { topic: { tech_topic_id:topic.tech_topic_id, project_id:topic.project_id, block_kind:topic.block_kind, tech_domain:topic.tech_domain, status:topic.status,
    sort_order:topic.sort_order, source_kind:topic.source_kind, needs_check:topic.needs_check || !!dd.check_reason, created_at:topic.created_at, updated_at:topic.updated_at,
    title: dd.title!, summary: dd.summary ?? null, body_md: dd.body_md ?? null,
    source_ref: dd.source_label ?? null, source_url: null, presentation: null,
    check_reason: topic.needs_check || dd.check_reason ? dd.check_reason || "適用条件・実証データの追加確認が必要" : null,
    confidentiality: policy.level === "public" ? "public" : "confidential", created_by: null, updated_by: null, disclosure: null, disclosure_level:policy.level === "public" ? "public" : "dd_summary", disclosure_status: "included" }, entries: projected };
}
