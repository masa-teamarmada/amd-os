export const MANAGEMENT_BIOGRAPHIES_CONFIG_KEY = "management_biographies";
export type ManagementBiography = { id: string; name: string; reading: string; title: string; summary: string[]; positions: string[]; career: { date: string; text: string }[]; awards: string[] };
export type ProjectManagementBiographies = { version: 1; profiles: ManagementBiography[]; sourceRef: string };
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(s => typeof s === "string");
export function parseManagementBiographies(value: unknown): ProjectManagementBiographies | null {
  if (value == null || value === "") return null;
  const d = typeof value === "string" ? JSON.parse(value) : value;
  if (!d || d.version !== 1 || typeof d.sourceRef !== "string" || !Array.isArray(d.profiles) || !d.profiles.every((p: ManagementBiography) => p && [p.id,p.name,p.reading,p.title].every(s => typeof s === "string") && strings(p.summary) && strings(p.positions) && strings(p.awards) && Array.isArray(p.career) && p.career.every(c => c && typeof c.date === "string" && typeof c.text === "string"))) throw new Error("経営陣略歴の登録形式が正しくない");
  return d as ProjectManagementBiographies;
}
