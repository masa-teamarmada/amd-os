export const PROPER_NOUN_CONFIG_KEY = "proper_noun_spellings";
export const PROPER_NOUN_KINDS = ["person", "organization", "other"] as const;
export type ProperNounEntry = { canonical: string; aliases: string[]; kind: typeof PROPER_NOUN_KINDS[number] };
export type ProperNounDictionary = { entries: ProperNounEntry[]; updatedAt: string | null };
export type ProperNounResponse = { ok: true; dictionary: ProperNounDictionary; canEdit: boolean };

export class ProperNounValidationError extends Error {
  row: number | null;
  field: "canonical" | "aliases" | "kind";
  constructor(message: string, row: number | null = null, field: "canonical" | "aliases" | "kind" = "canonical") { super(message); this.row = row; this.field = field; }
}

export function validateProperNounEntries(raw: unknown): ProperNounEntry[] {
  if (!Array.isArray(raw) || raw.length > 200) throw new ProperNounValidationError("固有名詞は200件以内で登録できます。");
  const seen = new Map<string, number>();
  return raw.map((item: unknown, index) => {
    if (!item || typeof item !== "object") throw new ProperNounValidationError("表記を入力してください。", index);
    const row = item as Record<string, unknown>;
    if (typeof row.canonical !== "string" || !row.canonical.trim() || row.canonical.trim().length > 120 || /[\r\n]/.test(row.canonical)) throw new ProperNounValidationError("正しい表記は1行・120文字以内で入力してください。", index);
    if (!Array.isArray(row.aliases) || row.aliases.length > 20 || row.aliases.some(value => typeof value !== "string" || !value.trim() || value.trim().length > 120 || /[\r\n]/.test(value))) throw new ProperNounValidationError("旧表記は1行に1つ、120文字以内・20個までで入力してください。", index, "aliases");
    if (!(PROPER_NOUN_KINDS as readonly unknown[]).includes(row.kind)) throw new ProperNounValidationError("種類を選択してください。", index, "kind");
    const canonical = row.canonical.trim();
    const aliases = (row.aliases as string[]).map(value => value.trim());
    for (const name of [canonical, ...aliases]) {
      if (seen.has(name)) throw new ProperNounValidationError(`「${name}」が重複しています。別の表記と矛盾しないように修正してください。`, index, name === canonical ? "canonical" : "aliases");
      seen.set(name, index);
    }
    return { canonical, aliases, kind: row.kind as ProperNounEntry["kind"] };
  });
}

export function parseProperNounValue(value: string | null): { entries: ProperNounEntry[]; metadata: Record<string, unknown> } {
  if (value === null) return { entries: [], metadata: {} };
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("固有名詞の保存内容が不正");
  const metadata = parsed as Record<string, unknown>;
  return { entries: validateProperNounEntries(metadata.entries), metadata };
}
