export const AMIE_TECH_LEVELS = ["public", "dd_summary", "restricted", "core"] as const;
export type AmieTechLevel = typeof AMIE_TECH_LEVELS[number];
export const AMIE_TECH_LEVEL_LABEL: Record<AmieTechLevel, string> = {
  public: "1 公開情報", dd_summary: "2 DD判断情報", restricted: "3 限定技術情報", core: "4 核心ノウハウ",
};
export const AMIE_TECH_LEVEL_HELP: Record<AmieTechLevel, string> = {
  public: "公表済みの原理・概要", dd_summary: "性能・規模・適用条件・未達事項を概要として開示",
  restricted: "試験ごとの条件・原データ。個別確認後の限定共有", core: "配合・制御手順・株の改変と選抜等。通常DDへ掲載しない",
};
export type AmieTechDisclosure = { version: 1; level: AmieTechLevel; reason: string; dd: Record<string, string | null> | null; reviewed_hash?: string };
export type AmieTechDisclosureStatus = "included" | "excluded" | "needs_review";
export function amieReadTechDisclosure(value: unknown): AmieTechDisclosure | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || !AMIE_TECH_LEVELS.includes(v.level as AmieTechLevel) || typeof v.reason !== "string") return null;
  if (v.dd !== null && (!v.dd || typeof v.dd !== "object" || Array.isArray(v.dd) || Object.values(v.dd).some(x => x !== null && typeof x !== "string"))) return null;
  return v as AmieTechDisclosure;
}
export function amieTechLevelOf(record: { disclosure?: unknown }): AmieTechLevel {
  return amieReadTechDisclosure(record.disclosure)?.level ?? "restricted";
}
