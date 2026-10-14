import { createHash } from "node:crypto";
import { amieReadTechDisclosure, amieTechFieldLevel, AMIE_TECH_LEVELS, type AmieTechDisclosure, type AmieTechDisclosureStatus } from "./amie-tech-disclosure-model";
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
  // 追加JSONのない既存行のhashは保持。廃液実験を持つ行は画像参照も変更検知する。
  const fields = [...FIELDS[entity], ...(entity === "entry" && record.experiment != null ? ["experiment"] : [])];
  return createHash("sha256").update(JSON.stringify(stable(Object.fromEntries(fields.map(key => [key, record[key] ?? null]))))).digest("hex");
}
export function amieTechDisclosureStatus(record: Record<string, unknown>, entity: Entity): AmieTechDisclosureStatus {
  const p = amieReadTechDisclosure(record.disclosure);
  if (!p || !p.dd || !amieTechDdFieldsAllowed(record, entity, p)) return "excluded";
  return p.reviewed_hash === amieTechReviewHash(record, entity) ? "included" : "needs_review";
}
/** 欄ごとの区分がある場合、行全体の最大秘密度で独立した性能値まで隠さない。 */
function amieTechDdFieldsAllowed(record: Record<string, unknown>, entity: Entity, p: AmieTechDisclosure): boolean {
  if (!p.dd) return false;
  if (!p.field_levels) return !(["restricted", "core"].includes(p.level) && (entity === "entry" || !!p.dd.body_md?.trim()));
  const source = { ...record, disclosure: p };
  if (entity === "entry" && p.dd.value_mode !== "text_only" && ["value_min", "value_max", "unit"].some(key => record[key] != null && ["restricted", "core"].includes(amieTechFieldLevel(source, [key])))) return false;
  // 詳細の原文はコピーできない。別にレビューした概要だけを掲載欄へ保存できる。
  return Object.entries(p.dd).every(([key, value]) => {
    if (!value || key === "value_mode") return true;
    const sourceKey = key === "source_label" ? "source_ref" : key;
    return !["restricted", "core"].includes(amieTechFieldLevel(source, [sourceKey])) || String(record[sourceKey] ?? "").trim() !== value.trim();
  });
}
/** 編集権限の確認後だけ呼ぶ。reviewed_hashはクライアント入力を採用しない。 */
export function amiePrepareTechDisclosure(record: Record<string, unknown>, entity: Entity, value: unknown): AmieTechDisclosure {
  const p = amieReadTechDisclosure(value);
  if (!p || !AMIE_TECH_LEVELS.includes(p.level) || !p.reason.trim() || p.reason.length > 4000) throw new Error("開示区分と仕分け理由が必要");
  const keys = entity === "topic" ? ["title", "summary", "body_md", "source_label", "check_reason", "value_mode"] : ["row_label", "col_label", "value_text", "condition_text", "note", "source_label", "check_reason", "value_mode"];
  if (p.dd && Object.keys(p.dd).some(key => !keys.includes(key))) throw new Error("DD掲載欄の登録形式が不正");
  if (p.dd?.value_mode && !["source", "text_only"].includes(p.dd.value_mode)) throw new Error("DD数値の表示形式が不正");
  if (p.dd && Object.values(p.dd).some(value => typeof value === "string" && value.length > 60000)) throw new Error("DD掲載欄が長すぎる");
  if (p.field_levels && Object.entries(p.field_levels).some(([key, level]) => ["restricted", "core"].includes(level) && !p.field_reasons?.[key]?.trim())) throw new Error("限定技術情報・核心ノウハウには欄ごとの具体的な理由が必要");
  if (p.dd && !amieTechDdFieldsAllowed(record, entity, p)) throw new Error("限定技術情報・核心ノウハウの原文・数値は通常DDへ掲載できない");
  if (p.dd && !(p.dd[entity === "topic" ? "title" : "row_label"] || "").trim()) throw new Error("DDの見出しが必要");
  const level = p.field_levels ? amieTechFieldLevel({ ...record, disclosure: p }, Object.keys(p.field_levels)) : p.level;
  const reasons = p.field_levels ? [...new Set(Object.keys(p.field_levels).filter(key => record[key] != null && record[key] !== "" && p.field_levels?.[key] === level).map(key => p.field_reasons?.[key]).filter(Boolean))].join(" / ") : "";
  return { version: 1, level, reason: (reasons || p.reason).trim().slice(0, 4000), dd: p.dd, ...(p.field_levels ? { field_levels: p.field_levels, field_reasons: p.field_reasons } : {}), ...(p.dd ? { reviewed_hash: amieTechReviewHash(record, entity) } : {}) };
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
      created_by: null, updated_by: null, disclosure: null, disclosure_level:p.level === "public" ? "public" as const : "dd_summary" as const, disclosure_status: "included" as const };
  });
  if (["restricted", "core"].includes(policy.level) && !dd.body_md?.trim() && projected.length === 0) return null;
  return { topic: { tech_topic_id:topic.tech_topic_id, project_id:topic.project_id, block_kind:topic.block_kind, tech_domain:topic.tech_domain, status:topic.status,
    sort_order:topic.sort_order, source_kind:topic.source_kind, needs_check:topic.needs_check || !!dd.check_reason, created_at:topic.created_at, updated_at:topic.updated_at,
    title: dd.title!, summary: dd.summary ?? null, body_md: dd.body_md ?? null,
    source_ref: dd.source_label ?? null, source_url: null, presentation: null,
    check_reason: topic.needs_check || dd.check_reason ? dd.check_reason || "適用条件・実証データの追加確認が必要" : null,
    confidentiality: policy.level === "public" ? "public" : "confidential", created_by: null, updated_by: null, disclosure: null, disclosure_level:policy.level === "public" ? "public" : "dd_summary", disclosure_status: "included" }, entries: projected };
}
