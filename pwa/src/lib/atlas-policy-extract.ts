/**
 * 政府方針シグナル — 本文取得 + 要約 + タグ + メタ抽出（Claude Sonnet 4.6）
 *
 * Filter を通過した RawPolicyItem の詳細ページ HTML を取得し、
 * AMD 事業判断視点の要約を生成して atlas_signals にそのまま入れられる SignalDraft 型にする。
 */
import Anthropic from "@anthropic-ai/sdk";
import type { FilteredPolicyItem } from "./atlas-policy-filter";

export interface PolicySignalDraft {
  title: string;
  content: string;
  source_url: string;
  source_type: "policy";
  domain: string;
  tags: string[];
  importance: "high" | "medium" | "low";
  metadata: {
    ministry: string;
    ministry_code: string;
    doc_type: string; // strategy/cabinet_decision/press/public_comment/budget/ordinance など
    announced_at: string;
    raw_url: string;
    pdf_url?: string;
    filter_relevance: "high" | "medium";
  };
}

const COMMON_HEADERS = {
  "User-Agent":
    "AMD-Atlas-Bot/1.0 (Atlas policy collector; +https://amd-os-pwa.vercel.app)",
  Accept: "text/html,application/xhtml+xml",
};

const DOMAINS = [
  "A.地政学・マクロ経済",
  "B.規制・政策",
  "C.素材・原料",
  "D.エネルギー",
  "E.製造・プロセス技術",
  "F.バイオ・医療",
  "G.モビリティ・ロボティクス",
  "H.建築・インフラ",
  "I.ICT・AI",
  "J.宇宙・防衛",
  "K.食・農・水産",
  "L.金融・資本市場",
  "M.社会構造・社会課題",
  "N.海洋・水資源",
  "O.サーキュラーエコノミー",
];

/** HTMLから本文っぽい部分を抜く（script/style/タグ除去）*/
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** HTMLから .pdf リンクを1件だけ拾う（最も「本文っぽい」最初の.pdf）*/
function extractPdfUrl(html: string, baseUrl: string): string | undefined {
  const re = /<a[^>]+href=["']([^"']+\.pdf)["']/gi;
  const found: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && found.length < 5) {
    let href = m[1];
    if (href.startsWith("//")) href = "https:" + href;
    else if (href.startsWith("/")) {
      try {
        const base = new URL(baseUrl);
        href = `${base.protocol}//${base.host}${href}`;
      } catch {
        continue;
      }
    } else if (!/^https?:/.test(href)) {
      try {
        href = new URL(href, baseUrl).toString();
      } catch {
        continue;
      }
    }
    found.push(href);
  }
  return found[0];
}

async function fetchPageHtml(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: COMMON_HEADERS,
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return "";
    return await res.text();
  } catch (e) {
    console.warn(`[policy-extract] page fetch err ${url}:`, e);
    return "";
  }
}

/**
 * 1件の FilteredPolicyItem を Sonnet で構造化シグナルに変換。
 * HTML取得失敗時は raw_summary だけで頑張る。
 */
export async function extractPolicySignal(
  item: FilteredPolicyItem,
  anthropic: Anthropic
): Promise<PolicySignalDraft | null> {
  const html = await fetchPageHtml(item.url);
  const body = html ? stripHtml(html).slice(0, 6000) : item.raw_summary || "";
  const pdfUrl = html ? extractPdfUrl(html, item.url) : undefined;

  const prompt = `あなたはAMD（armada — 新規事業開発・伴走支援）の政策アナリスト。
日本政府の発表内容を読み、AMDの事業判断（新規シーズ開拓 / 既存PJの前提揺らぎ）に効く形で要約してください。

省庁: ${item.ministry}
発表日: ${item.announced_at || "不明"}
発表元URL: ${item.url}
${pdfUrl ? `添付PDF: ${pdfUrl}` : ""}

タイトル原文: ${item.title}

本文（抜粋・最大6000字）:
${body || "(本文取得失敗)"}

次の JSON のみで返す（前置き不要、\`\`\`json で囲む）:
{
  "title": "60字以内、原文を踏まえつつ要点を圧縮した見出し",
  "content": "200-400字。何が決まった/発表されたか / 数字・期限などの一次情報 / 産業界・AMDへの示唆",
  "domain": "${DOMAINS.join(" / ")} のいずれか1つ",
  "tags": ["6-12個", "一般名詞", "横串検索しやすい粒度", "省庁名はタグに入れない（メタで持つ）"],
  "importance": "high(直接判断材料) / medium(注視) / low",
  "doc_type": "strategy(戦略文書) / cabinet_decision(閣議決定) / law(法令・施行令) / public_comment(パブコメ) / budget(予算・補助金公募) / press(通常プレスリリース) / meeting(審議会・会議資料) のどれか"
}
`;

  let parsed: {
    title?: string;
    content?: string;
    domain?: string;
    tags?: unknown;
    importance?: string;
    doc_type?: string;
  };
  try {
    const r = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const block = r.content[0];
    const text = block?.type === "text" ? block.text : "";
    const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    parsed = JSON.parse(m[1] || m[0]);
  } catch (e) {
    console.warn(`[policy-extract] LLM err for ${item.url}:`, e);
    return null;
  }

  if (!parsed.title || !parsed.content || !parsed.domain) return null;

  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 16)
    : [];
  const importance = (["high", "medium", "low"] as const).includes(
    parsed.importance as "high" | "medium" | "low"
  )
    ? (parsed.importance as "high" | "medium" | "low")
    : "medium";

  return {
    title: parsed.title.slice(0, 120),
    content: parsed.content,
    source_url: item.url,
    source_type: "policy",
    domain: parsed.domain,
    tags,
    importance,
    metadata: {
      ministry: item.ministry,
      ministry_code: item.ministry_code,
      doc_type: parsed.doc_type || item.doc_type_hint || "press",
      announced_at: item.announced_at,
      raw_url: item.url,
      pdf_url: pdfUrl,
      filter_relevance: item.relevance as "high" | "medium",
    },
  };
}
