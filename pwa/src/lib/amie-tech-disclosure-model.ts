export const AMIE_TECH_LEVELS = ["public", "dd_summary", "restricted", "core"] as const;
export type AmieTechLevel = typeof AMIE_TECH_LEVELS[number];
export const AMIE_TECH_LEVEL_LABEL: Record<AmieTechLevel, string> = {
  public: "1 一般情報", dd_summary: "2 事業・性能情報", restricted: "3 限定技術情報", core: "4 核心ノウハウ",
};
export const AMIE_TECH_LEVEL_HELP: Record<AmieTechLevel, string> = {
  public: "一般説明・案内・公表済み情報。秘密にする具体的な理由がない情報。公開済み・DD掲載済みを意味しない",
  dd_summary: "性能・適用限界・計画・試算。未確認や古い情報であることだけを理由に秘密扱いしない",
  restricted: "個別試験の設定・原データ・顧客情報・装置詳細。提供元と相手に応じた開示条件を確認",
  core: "再現につながる具体的な配合・制御操作・株の導入と選抜・抽出手順",
};
export const AMIE_TECH_FIELDS = ["title", "summary", "body_md", "presentation", "row_label", "col_label", "value_min", "value_max", "unit", "value_text", "rating", "condition_text", "note", "source_ref", "source_url", "check_reason"] as const;
export type AmieTechDisclosure = { version: 1; level: AmieTechLevel; reason: string; dd: Record<string, string | null> | null; reviewed_hash?: string; field_levels?: Record<string, AmieTechLevel>; field_reasons?: Record<string, string> };
export type AmieTechDisclosureStatus = "included" | "excluded" | "needs_review";
export function amieReadTechDisclosure(value: unknown): AmieTechDisclosure | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || !AMIE_TECH_LEVELS.includes(v.level as AmieTechLevel) || typeof v.reason !== "string") return null;
  if (v.dd !== null && (!v.dd || typeof v.dd !== "object" || Array.isArray(v.dd) || Object.values(v.dd).some(x => x !== null && typeof x !== "string"))) return null;
  for (const [key, allowed] of [["field_levels", (x: unknown) => AMIE_TECH_LEVELS.includes(x as AmieTechLevel)], ["field_reasons", (x: unknown) => typeof x === "string" && x.length <= 4000]] as const) {
    const map = v[key];
    if (map !== undefined && (!map || typeof map !== "object" || Array.isArray(map) || Object.entries(map).some(([field, value]) => !AMIE_TECH_FIELDS.includes(field as typeof AMIE_TECH_FIELDS[number]) || !allowed(value)))) return null;
  }
  return v as AmieTechDisclosure;
}
/** 秘密度は掲載文との一致ではなく、当該欄に保存した理由と区分から読む。 */
export function amieTechFieldLevel(record: { disclosure?: unknown; disclosure_level?: AmieTechLevel }, fields: string[]): AmieTechLevel {
  const policy = amieReadTechDisclosure(record.disclosure);
  const source = record as Record<string, unknown>;
  const present = fields.filter(key => source[key] !== null && source[key] !== undefined && source[key] !== "");
  const levels = (present.length ? present : fields).map(key => policy?.field_levels?.[key] ?? record.disclosure_level ?? policy?.level ?? "restricted");
  return levels.reduce((highest, level) => AMIE_TECH_LEVELS.indexOf(level) > AMIE_TECH_LEVELS.indexOf(highest) ? level : highest, "public");
}
export function amieTechFieldReason(record: { disclosure?: unknown }, fields: string[]): string {
  const policy = amieReadTechDisclosure(record.disclosure);
  return [...new Set(fields.map(key => policy?.field_reasons?.[key]).filter(Boolean))].join(" / ") || policy?.reason || "秘密度の確認が必要";
}
export function amieTechContainsLevel(record: { disclosure?: unknown }, level: AmieTechLevel): boolean {
  const policy = amieReadTechDisclosure(record.disclosure);
  if (!policy?.field_levels) return amieTechLevelOf(record) === level;
  const source = record as Record<string, unknown>;
  // 一般的な項目名だけで全行を一致させない。説明・値・条件の内容を対象にする。
  return ["summary", "body_md", "value_min", "value_max", "value_text", "condition_text", "note", "check_reason"].some(key => source[key] !== null && source[key] !== undefined && source[key] !== "" && amieTechFieldLevel(record, [key]) === level);
}
export function amieTechLevelOf(record: { disclosure?: unknown }): AmieTechLevel {
  return amieReadTechDisclosure(record.disclosure)?.level ?? "restricted";
}
