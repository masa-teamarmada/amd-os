/**
 * Notion 生データ抽出 — Integration Token (secret_...) で search を叩く。
 * env: NOTION_API_KEY
 *
 * Integration を該当ページに「招待」しないとアクセスできない。
 * 上位の workspace ページを 1 つ招待しておけば、その配下は全部見える。
 */

import { Client, isFullPage } from "@notionhq/client";

export interface NotionHit {
  id: string;
  title: string;
  url: string;
  last_edited: string | null;
  text: string;            // 簡易テキスト化したページ内容 (最初の数千文字)
}

const MAX_PAGE_TEXT = 4000;   // 1 ページあたりの最大テキスト長

export async function fetchNotionContext(query: string, limit = 10): Promise<NotionHit[]> {
  const token = process.env.NOTION_API_KEY;
  if (!token) {
    console.warn("[notion] NOTION_API_KEY not set — skipping");
    return [];
  }
  const client = new Client({ auth: token });
  try {
    const r = await client.search({
      query,
      page_size: Math.min(limit, 100),
      sort: { direction: "descending", timestamp: "last_edited_time" },
      filter: { property: "object", value: "page" },
    });
    const out: NotionHit[] = [];
    for (const p of r.results) {
      if (!isFullPage(p)) continue;
      const title = extractPageTitle(p);
      const text = await extractPageText(client, p.id);
      out.push({
        id: p.id,
        title,
        url: (p as { url?: string }).url ?? "",
        last_edited: (p as { last_edited_time?: string }).last_edited_time ?? null,
        text,
      });
    }
    return out;
  } catch (e) {
    console.error("[notion] search failed:", e);
    return [];
  }
}

function extractPageTitle(page: { properties?: Record<string, unknown> }): string {
  const props = page.properties ?? {};
  for (const v of Object.values(props)) {
    const p = v as { type?: string; title?: Array<{ plain_text?: string }> };
    if (p.type === "title" && p.title) {
      return p.title.map((t) => t.plain_text ?? "").join("");
    }
  }
  return "(no title)";
}

async function extractPageText(client: Client, pageId: string): Promise<string> {
  try {
    const blocks = await client.blocks.children.list({ block_id: pageId, page_size: 100 });
    const parts: string[] = [];
    for (const b of blocks.results) {
      const text = blockToText(b);
      if (text) parts.push(text);
      if (parts.join("\n").length > MAX_PAGE_TEXT) break;
    }
    return parts.join("\n").slice(0, MAX_PAGE_TEXT);
  } catch (e) {
    console.warn(`[notion] block fetch failed for ${pageId}:`, e);
    return "";
  }
}

function blockToText(block: unknown): string {
  const b = block as { type?: string; [key: string]: unknown };
  if (!b.type) return "";
  const richTextField = b[b.type];
  if (richTextField && typeof richTextField === "object") {
    const rt = (richTextField as { rich_text?: Array<{ plain_text?: string }> }).rich_text;
    if (rt) return rt.map((t) => t.plain_text ?? "").join("");
  }
  return "";
}
