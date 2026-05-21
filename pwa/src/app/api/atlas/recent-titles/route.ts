/**
 * GET /api/atlas/recent-titles
 *
 * Routine が web_search する前に呼んで「直近 N 時間の既存 signal タイトル」を取得し、
 * 重複ネタを最初から避けるための補助 API。
 *
 * 既存 /api/cron/atlas-collect は LLM プロンプトに直近 48h の title top 80 を埋め込んで
 * いるが、Routine 版にはこのロジックが無く重複 skip 大量発生 (まさ 2026-05-13 指摘) →
 * Routine も同じ事前情報を取れるようにする。
 *
 * 認証: Authorization: Bearer ${ATLAS_INGEST_SECRET ?? CRON_SECRET}
 * Query:
 *   - hours: 何時間前まで遡るか (default 48, max 168)
 *   - limit: タイトル件数上限 (default 80, max 200)
 *
 * Response:
 *   {
 *     ok: true,
 *     hours: 48,
 *     count: 73,
 *     titles: ["...", "...", ...]   // submitted_at desc
 *   }
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.ATLAS_INGEST_SECRET || process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "env missing" }, { status: 500 });
  }
  const db = createClient(url, key);

  const params = req.nextUrl.searchParams;
  const hours = Math.max(1, Math.min(168, parseInt(params.get("hours") || "48", 10) || 48));
  const limit = Math.max(1, Math.min(200, parseInt(params.get("limit") || "80", 10) || 80));

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("atlas_signals")
    .select("title")
    .gte("submitted_at", since)
    .order("submitted_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const titles = (data ?? [])
    .map((r) => (typeof r.title === "string" ? r.title : ""))
    .filter(Boolean);

  return NextResponse.json({
    ok: true,
    hours,
    count: titles.length,
    titles,
  });
}
