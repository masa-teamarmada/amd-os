import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { fetchNotionContext } from "@/lib/sources/notion";

/**
 * 内部専用: Notion 検索・ページ本文の素通し読み取り。
 * NOTION_API_KEY は Vercel の sensitive env でローカルから読めないため、
 * えいみのローカルセッションや routine が議事録本文を裏取りする時に使う。
 * 認証は CRON_SECRET の Bearer 固定 (未設定なら常に 401)。読み取りのみで LLM は呼ばない。
 *
 *   GET ?q=<検索語>&limit=8        … search してタイトル+冒頭テキストを返す
 *   GET ?pageId=<page_id>&depth=3    … ページの properties と blocks を素で返す\n *   GET ?blockId=<block_id>&depth=3  … ブロック配下(文字起こし等)を素で返す
 */
export const dynamic = "force-dynamic";

async function collectBlocks(client: Client, blockId: string, depth: number, out: unknown[]): Promise<void> {
  if (depth <= 0 || out.length > 1200) return;
  let cursor: string | undefined;
  do {
    const res = await client.blocks.children.list({ block_id: blockId, start_cursor: cursor, page_size: 100 });
    for (const b of res.results) {
      out.push(b);
      const hasChildren = (b as { has_children?: boolean }).has_children;
      if (hasChildren) await collectBlocks(client, b.id, depth - 1, out);
      if (out.length > 1200) return;
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const blockId = req.nextUrl.searchParams.get("blockId")?.trim();
  if (blockId) {
    const token = process.env.NOTION_API_KEY;
    if (!token) return NextResponse.json({ error: "NOTION_API_KEY not set" }, { status: 500 });
    const client = new Client({ auth: token });
    try {
      const depth = Math.max(1, Math.min(4, Number(req.nextUrl.searchParams.get("depth") || 3)));
      const blocks: unknown[] = [];
      await collectBlocks(client, blockId, depth, blocks);
      return NextResponse.json({ ok: true, blockId, blocks });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }
  const pageId = req.nextUrl.searchParams.get("pageId")?.trim();
  if (pageId) {
    const token = process.env.NOTION_API_KEY;
    if (!token) return NextResponse.json({ error: "NOTION_API_KEY not set" }, { status: 500 });
    const client = new Client({ auth: token });
    try {
      const page = await client.pages.retrieve({ page_id: pageId });
      const blocks: unknown[] = [];
      const d = Math.max(1, Math.min(4, Number(req.nextUrl.searchParams.get("depth") || 3)));
      await collectBlocks(client, pageId, d, blocks);
      return NextResponse.json({ ok: true, page, blocks });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "q or pageId required" }, { status: 400 });
  }
  const limit = Math.max(1, Math.min(20, Number(req.nextUrl.searchParams.get("limit") || 8)));
  try {
    const hits = await fetchNotionContext(q, limit);
    return NextResponse.json({ ok: true, query: q, count: hits.length, hits });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
