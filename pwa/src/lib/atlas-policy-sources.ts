/**
 * 政府方針シグナル収集 — 省庁ごとの fetcher 群
 *
 * - RSS フィードを持つ省庁: fast-xml-parser で構造化
 * - RSS が無い省庁 (環境省) や独自フォーマット (e-Gov パブコメ): Gemini Flash で HTML → JSON 抽出
 *
 * 共通の出力型 RawPolicyItem を返し、後段の filter / extract が同じ流れで処理できるようにする。
 */
import { XMLParser } from "fast-xml-parser";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface RawPolicyItem {
  ministry: string; // 表示・タグ用「経済産業省」
  ministry_code: string; // 識別「meti」
  url: string; // 元記事URL（プレスリリース or 詳細ページ）
  title: string;
  announced_at: string; // ISO 8601
  raw_summary?: string; // RSS description / HTML 抜粋
  doc_type_hint?: string; // 'press' | 'public_comment' | 'meeting' | 'strategy' など
}

const COMMON_HEADERS = {
  "User-Agent":
    "AMD-Atlas-Bot/1.0 (Atlas policy collector; +https://amd-os-pwa.vercel.app)",
  Accept:
    "application/rss+xml, application/rdf+xml, application/xml, text/xml, text/html;q=0.9",
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  textNodeName: "#text",
});

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function extractText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null) {
    const obj = v as Record<string, unknown>;
    if (typeof obj["#text"] === "string") return obj["#text"] as string;
  }
  return String(v);
}

function safeIso(date: string | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toISOString();
}

/**
 * RSS / RDF フィードをパースして RawPolicyItem 配列に変換する。
 * RSS 1.0 (RDF) と RSS 2.0 の両対応。
 */
async function fetchRssFeed(
  url: string,
  ministry: string,
  ministryCode: string,
  defaultDocType = "press"
): Promise<RawPolicyItem[]> {
  let xml: string;
  try {
    const res = await fetch(url, { headers: COMMON_HEADERS, signal: AbortSignal.timeout(20000) });
    if (!res.ok) {
      console.warn(`[policy-sources] ${ministryCode} RSS ${url}: HTTP ${res.status}`);
      return [];
    }
    xml = await res.text();
  } catch (e) {
    console.warn(`[policy-sources] ${ministryCode} RSS fetch err:`, e);
    return [];
  }

  let obj: Record<string, unknown>;
  try {
    obj = xmlParser.parse(xml) as Record<string, unknown>;
  } catch (e) {
    console.warn(`[policy-sources] ${ministryCode} RSS parse err:`, e);
    return [];
  }

  // RSS 1.0 (RDF)
  const rdf = obj["rdf:RDF"] as Record<string, unknown> | undefined;
  if (rdf) {
    const items = asArray(rdf.item as unknown);
    return items
      .map((raw) => {
        const it = raw as Record<string, unknown>;
        const aboutAttr = (it["@_rdf:about"] as string | undefined) || "";
        const link = extractText(it.link);
        const title = extractText(it.title);
        const date = extractText(it["dc:date"] || it.date || it.pubDate);
        const desc = extractText(it.description);
        return {
          ministry,
          ministry_code: ministryCode,
          url: aboutAttr || link,
          title,
          announced_at: safeIso(date),
          raw_summary: desc,
          doc_type_hint: defaultDocType,
        } as RawPolicyItem;
      })
      .filter((x) => x.url && x.title);
  }

  // RSS 2.0
  const rss = obj.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  if (channel) {
    const items = asArray(channel.item as unknown);
    return items
      .map((raw) => {
        const it = raw as Record<string, unknown>;
        const link = extractText(it.link);
        const title = extractText(it.title);
        const date = extractText(it.pubDate || it["dc:date"]);
        const desc = extractText(it.description);
        return {
          ministry,
          ministry_code: ministryCode,
          url: link,
          title,
          announced_at: safeIso(date),
          raw_summary: desc,
          doc_type_hint: defaultDocType,
        } as RawPolicyItem;
      })
      .filter((x) => x.url && x.title);
  }

  console.warn(`[policy-sources] ${ministryCode}: no RSS structure recognized`);
  return [];
}

/**
 * RSS が無い省庁向け: HTML を Gemini 2.5 Flash で構造化抽出する。
 * 無料枠内で動く想定。HTML が大きい場合は先頭を切る。
 */
async function fetchHtmlViaGemini(
  url: string,
  ministry: string,
  ministryCode: string,
  geminiKey: string,
  defaultDocType = "press"
): Promise<RawPolicyItem[]> {
  let html: string;
  try {
    const res = await fetch(url, { headers: COMMON_HEADERS, signal: AbortSignal.timeout(25000) });
    if (!res.ok) {
      console.warn(`[policy-sources] ${ministryCode} HTML ${url}: HTTP ${res.status}`);
      return [];
    }
    html = await res.text();
  } catch (e) {
    console.warn(`[policy-sources] ${ministryCode} HTML fetch err:`, e);
    return [];
  }

  // HTML を 200KB 程度に制限（先頭 + 本文目安）
  const trimmed = html.length > 200_000 ? html.slice(0, 200_000) : html;

  const prompt = `次のHTMLは日本の省庁公式サイトの報道発表/プレスリリース一覧ページです。
最新50件以内の項目について、JSON 配列で抽出してください。各項目は次のフィールドを持つ:
- "title": タイトル文字列
- "url": 詳細ページの絶対URL（相対なら ${url} の origin と結合して絶対化）
- "announced_at": 発表日（ISO 8601、時刻不明なら 00:00:00 で OK）

省庁: ${ministry}
ベースURL: ${url}

ルール:
- ヘッダーやサイドバーのリンクは除外（報道発表本体だけ）
- 同じ日付グルーピングで複数件あれば全部含める
- 不明な項目はスキップ
- 出力は \`\`\`json ... \`\`\` で囲んだ JSON 配列のみ。前置き不要

HTML:
${trimmed}
`;

  try {
    const gen = new GoogleGenerativeAI(geminiKey);
    const model = gen.getGenerativeModel({ model: "gemini-2.5-flash" });
    const r = await model.generateContent(prompt);
    const text = r.response.text();
    const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\])/);
    if (!m) {
      console.warn(`[policy-sources] ${ministryCode} Gemini: no JSON in response`);
      return [];
    }
    const arr = JSON.parse(m[1]);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((raw: unknown) => {
        const x = raw as Record<string, unknown>;
        return {
          ministry,
          ministry_code: ministryCode,
          url: String(x.url || ""),
          title: String(x.title || ""),
          announced_at: safeIso(String(x.announced_at || "")),
          doc_type_hint: defaultDocType,
        } as RawPolicyItem;
      })
      .filter((x) => x.url && x.title);
  } catch (e) {
    console.warn(`[policy-sources] ${ministryCode} Gemini err:`, e);
    return [];
  }
}

/**
 * 各省庁の Source 定義。
 * RSS のある省庁は RSS、無い省庁は Gemini HTML パースに自動分岐。
 */
export interface PolicySource {
  ministry: string;
  ministry_code: string;
  kind: "rss" | "html";
  url: string;
  doc_type_hint?: string;
}

export const POLICY_SOURCES: PolicySource[] = [
  // RSS のある省庁
  // 経産省は WebFetch でも timeout する（Vercel からも到達不可の可能性）→ Phase 2 で別策
  // { ministry: "経済産業省", ministry_code: "meti", kind: "rss", url: "https://www.meti.go.jp/rss/news.rdf" },
  { ministry: "厚生労働省", ministry_code: "mhlw", kind: "rss", url: "https://www.mhlw.go.jp/stf/news.rdf" },
  { ministry: "国土交通省", ministry_code: "mlit", kind: "rss", url: "https://www.mlit.go.jp/pressrelease.rdf" },
  { ministry: "内閣府", ministry_code: "cao", kind: "rss", url: "https://www.cao.go.jp/rss/news.rdf" },
  { ministry: "首相官邸", ministry_code: "kantei", kind: "rss", url: "https://www.kantei.go.jp/index-jnews.rdf" },
  { ministry: "文部科学省", ministry_code: "mext", kind: "rss", url: "https://www.mext.go.jp/b_menu/news/index.rdf" },
  // RSS 提供無し → HTML を Gemini で抽出
  // env は 200KB 超のHTMLを Gemini に投げるため遅い → Phase 2 で別 cron 化検討
  // 一時的にコメントアウト（fetcher 単体でも10秒以上かかる）
  // { ministry: "環境省", ministry_code: "env", kind: "html", url: "https://www.env.go.jp/press/" },
];

export async function fetchSource(
  source: PolicySource,
  geminiKey: string
): Promise<RawPolicyItem[]> {
  if (source.kind === "rss") {
    return fetchRssFeed(source.url, source.ministry, source.ministry_code, source.doc_type_hint);
  }
  return fetchHtmlViaGemini(
    source.url,
    source.ministry,
    source.ministry_code,
    geminiKey,
    source.doc_type_hint
  );
}

/**
 * 全 Source を並列実行して直近 sinceDate 以降のアイテムだけ返す。
 * announced_at が空のアイテムは「日付不明」として通す（filter で title から推定 or 弾く）。
 */
export async function fetchAllPolicySources(
  sinceDate: Date,
  geminiKey: string
): Promise<RawPolicyItem[]> {
  const results = await Promise.allSettled(
    POLICY_SOURCES.map((s) => fetchSource(s, geminiKey))
  );
  const all: RawPolicyItem[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const code = POLICY_SOURCES[i].ministry_code;
    if (r.status === "fulfilled") {
      console.log(`[policy-sources] ${code}: ${r.value.length} items`);
      all.push(...r.value);
    } else {
      console.warn(`[policy-sources] ${code} rejected:`, r.reason);
    }
  }
  // 日付フィルタ（不明日付は通す）
  const sinceMs = sinceDate.getTime();
  return all.filter((it) => {
    if (!it.announced_at) return true;
    const ms = new Date(it.announced_at).getTime();
    return isNaN(ms) ? true : ms >= sinceMs;
  });
}
