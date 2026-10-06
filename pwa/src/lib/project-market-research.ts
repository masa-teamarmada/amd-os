export type ResearchRecord = { id: string; title: string; date: string; kind: string; sourceUrl: string; notice: string; bodyMd: string };
export type ProjectMarketResearch = { version: 1; summaryMd: string; records: ResearchRecord[] };
export function parseMarketResearch(value: unknown): ProjectMarketResearch | null {
  if (value == null || value === "") return null;
  const data = (typeof value === "string" ? JSON.parse(value) : value) as ProjectMarketResearch;
  const text = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  if (!data || data.version !== 1 || !text(data.summaryMd) || !Array.isArray(data.records)
    || data.records.some(r => !r || ![r.id, r.title, r.date, r.kind, r.sourceUrl, r.bodyMd].every(text) || typeof r.notice !== "string" || !/^https:\/\//.test(r.sourceUrl))
    || new Set(data.records.map(r => r.id)).size !== data.records.length) throw new Error("市場調査資料の登録形式が正しくない");
  return { version: 1, summaryMd: data.summaryMd, records: data.records.map(({id,title,date,kind,sourceUrl,notice,bodyMd}) => ({id,title,date,kind,sourceUrl,notice,bodyMd})) };
}
