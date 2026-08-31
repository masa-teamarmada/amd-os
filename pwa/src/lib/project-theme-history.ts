/** A reviewed summary, not another meeting/task ledger. All dates are record dates, not freshness claims. */
export type ThemeHistorySource = { kind: "meeting" | "document"; id: string };
export type ThemeHistoryRow = {
  id: string;
  topic: string;
  initial: string;
  developments: string;
  current: string;
  next: string;
  asOf: string | null;
  sourceNote: string;
  sources: ThemeHistorySource[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function bounded(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || value.trim().length > max) throw new Error(`${label}は${max}文字以内で入力してね`);
  return value.trim();
}

export function parseThemeHistory(value: unknown): ThemeHistoryRow[] {
  if (!Array.isArray(value) || value.length > 40) throw new Error("経緯は40行以内で入力してね");
  if (new TextEncoder().encode(JSON.stringify(value)).length > 190000) throw new Error("経緯の文章量が多すぎるよ。元記録への参照を使って要約してね");
  const ids = new Set<string>();
  return value.map((item) => {
    if (!record(item) || typeof item.id !== "string" || !UUID.test(item.id) || ids.has(item.id)) throw new Error("経緯の行IDが不正または重複しているよ");
    ids.add(item.id);
    const topic = bounded(item.topic, "対象", 100);
    if (!topic) throw new Error("対象を入力してね");
    const asOf = item.asOf;
    if (asOf !== null && (typeof asOf !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number.isNaN(Date.parse(asOf)) || new Date(asOf).toISOString().slice(0, 10) !== asOf)) throw new Error("記録時点は実在する日付で入力してね");
    if (!Array.isArray(item.sources) || item.sources.length > 12) throw new Error("元記録は1行につき12件までだよ");
    const sourceIds = new Set<string>();
    const sources = item.sources.map((source): ThemeHistorySource => {
      if (!record(source) || !["meeting", "document"].includes(String(source.kind))) throw new Error("元記録の種類が不正だよ");
      const id = bounded(source.id, "元記録ID", 1024);
      if (!id || (source.kind === "document" && !UUID.test(id))) throw new Error("元記録IDが不正だよ");
      const key = `${source.kind}:${id}`;
      if (sourceIds.has(key)) throw new Error("元記録が重複しているよ");
      sourceIds.add(key);
      return { kind: source.kind as ThemeHistorySource["kind"], id };
    });
    return {
      id: item.id, topic, asOf: asOf as string | null, sources,
      initial: bounded(item.initial, "当初の狙い", 500),
      developments: bounded(item.developments, "動き・結果", 1600),
      current: bounded(item.current, "現在地", 500),
      next: bounded(item.next, "次の確認", 500),
      sourceNote: bounded(item.sourceNote, "確認範囲", 500),
    };
  });
}
