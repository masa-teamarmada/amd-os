import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBackgroundAnthropic, BackgroundAnthropicDisabledError } from "@/lib/anthropic-client";
import { createClient } from "@supabase/supabase-js";
import { fetchAllPolicySources, type RawPolicyItem } from "@/lib/atlas-policy-sources";
import { filterRelevantPolicyItems } from "@/lib/atlas-policy-filter";
import { extractPolicySignal } from "@/lib/atlas-policy-extract";
import { enrichWithPdf } from "@/lib/atlas-policy-pdf";
import { attachStory } from "@/lib/atlas-stories-server";

export const maxDuration = 300;

/** URL を比較しやすい形に正規化（末尾スラッシュ・query除去） */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    let path = u.pathname.replace(/\/$/, "");
    return `${u.protocol}//${u.host}${path}${u.search}`;
  } catch {
    return url;
  }
}

/** 配列を size ごとのチャンクに分ける */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * 政府方針シグナル収集 cron (毎朝 07:00 JST = 22:00 UTC)
 *
 * Bearer ${CRON_SECRET} 認証。
 * クエリ:
 *   - since=YYYY-MM-DD: 何日以降の発表を対象にするか（デフォルト = 前日 00:00 JST）
 *   - limit=N: 1回の起動で extract する上限（デフォルト 60、初回backfill は分割キック想定）
 *   - dryrun=1: insertしない（filter結果だけ確認）
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthroKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!url || !key || !anthroKey || !geminiKey) {
    return NextResponse.json({ error: "env missing" }, { status: 500 });
  }
  const db = createClient(url, key);
  let anthropic: Anthropic;
  try {
    anthropic = getBackgroundAnthropic("cron/atlas-collect-policy");
  } catch (e) {
    if (e instanceof BackgroundAnthropicDisabledError) {
      return NextResponse.json({ ok: true, disabled: true, reason: "background anthropic disabled" });
    }
    throw e;
  }

  const params = req.nextUrl.searchParams;
  const sinceParam = params.get("since");
  const limit = Math.max(1, Math.min(200, parseInt(params.get("limit") || "60", 10) || 60));
  const dryrun = params.get("dryrun") === "1";
  // step=fetch|dedup|filter|extract|enrich|all (default = all)
  const step = params.get("step") || "all";

  const sinceDate = sinceParam
    ? new Date(`${sinceParam}T00:00:00+09:00`)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);

  const t0 = Date.now();
  const timings: Record<string, number> = {};

  // [1] 各省庁から取得
  const raw = await fetchAllPolicySources(sinceDate, geminiKey);
  timings.fetch_ms = Date.now() - t0;
  console.log(`[atlas-collect-policy] fetched: ${raw.length} in ${timings.fetch_ms}ms`);

  if (step === "fetch") {
    const breakdown: Record<string, number> = {};
    for (const r of raw) {
      breakdown[r.ministry_code] = (breakdown[r.ministry_code] || 0) + 1;
    }
    return NextResponse.json({ ok: true, step, fetched: raw.length, breakdown, timings });
  }

  // [2] バッチ内dedup（URL正規化）
  const seenUrls = new Set<string>();
  const dedupRaw: RawPolicyItem[] = [];
  for (const r of raw) {
    const norm = normalizeUrl(r.url);
    if (seenUrls.has(norm)) continue;
    seenUrls.add(norm);
    dedupRaw.push({ ...r, url: norm });
  }

  // [3] DB既存URL除外（一次防御）
  const tDedup = Date.now();
  let dbDedupRaw = dedupRaw;
  if (dedupRaw.length > 0) {
    const urls = dedupRaw.map((r) => r.url);
    const existing = new Set<string>();
    for (const c of chunk(urls, 200)) {
      const { data } = await db
        .from("atlas_signals")
        .select("source_url")
        .in("source_url", c);
      for (const row of data || []) {
        if (row.source_url) existing.add(row.source_url as string);
      }
    }
    dbDedupRaw = dedupRaw.filter((r) => !existing.has(r.url));
  }
  timings.dedup_ms = Date.now() - tDedup;
  console.log(
    `[atlas-collect-policy] after dedup: ${dbDedupRaw.length} (db existing skipped: ${dedupRaw.length - dbDedupRaw.length})`
  );

  if (step === "dedup") {
    return NextResponse.json({
      ok: true, step, fetched: raw.length, after_dedup: dbDedupRaw.length, timings,
    });
  }

  // [4] Gemini filter（軽量）
  const tFilter = Date.now();
  const filtered = await filterRelevantPolicyItems(dbDedupRaw, geminiKey);
  timings.filter_ms = Date.now() - tFilter;
  console.log(`[atlas-collect-policy] after filter: ${filtered.length} in ${timings.filter_ms}ms`);

  if (step === "filter" || dryrun) {
    return NextResponse.json({
      ok: true,
      step: dryrun ? "dryrun" : step,
      fetched: raw.length,
      after_dedup: dbDedupRaw.length,
      after_filter: filtered.length,
      timings,
      sample: filtered.slice(0, 5).map((f) => ({
        ministry: f.ministry,
        title: f.title,
        relevance: f.relevance,
        url: f.url,
      })),
    });
  }

  // [5] limit 内で extract（並列度=4）
  const tExtract = Date.now();
  const targets = filtered.slice(0, limit);
  const drafts: Array<{ item: (typeof targets)[number]; draft: Awaited<ReturnType<typeof extractPolicySignal>> }> = [];
  const PARALLEL = 4;
  for (let i = 0; i < targets.length; i += PARALLEL) {
    const batch = targets.slice(i, i + PARALLEL);
    const res = await Promise.all(
      batch.map(async (it) => ({
        item: it,
        draft: await extractPolicySignal(it, anthropic),
      }))
    );
    drafts.push(...res);
  }
  timings.extract_ms = Date.now() - tExtract;
  console.log(`[atlas-collect-policy] extract: ${drafts.length} in ${timings.extract_ms}ms`);

  if (step === "extract") {
    const okCount = drafts.filter((d) => d.draft).length;
    return NextResponse.json({
      ok: true, step, fetched: raw.length, after_filter: filtered.length,
      extracted_ok: okCount, extracted_fail: drafts.length - okCount, timings,
    });
  }

  // [6] 重要度 high のみ PDF 強化
  const enriched = await Promise.all(
    drafts.map(async ({ item, draft }) => {
      if (!draft) return { item, draft };
      if (draft.importance !== "high") return { item, draft };
      const better = await enrichWithPdf(draft, anthropic);
      return { item, draft: better };
    })
  );

  // [7] 二次dedup（同省庁・同発表日・タイトル類似はスキップ）
  // ministry × announced_at(YYYY-MM-DD) × title 先頭20字 をキーに
  const recentSince = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: recentRows } = await db
    .from("atlas_signals")
    .select("title, metadata")
    .eq("source_type", "policy")
    .gte("submitted_at", recentSince)
    .limit(500);
  const recentKeys = new Set<string>();
  for (const row of recentRows || []) {
    const meta = (row.metadata as Record<string, unknown> | null) || {};
    const ministry = (meta.ministry_code as string) || "";
    const date = ((meta.announced_at as string) || "").slice(0, 10);
    const titleHead = ((row.title as string) || "").slice(0, 20);
    recentKeys.add(`${ministry}|${date}|${titleHead}`);
  }

  // [8] attachStory + insert（並列度4で attachStory を捌く）
  const validDrafts = enriched
    .map((e) => e.draft)
    .filter((d): d is NonNullable<typeof d> => d !== null);

  // 二次dedup でフィルタ
  const passDrafts: typeof validDrafts = [];
  let dupBlocked = 0;
  for (const draft of validDrafts) {
    const k = `${draft.metadata.ministry_code}|${(draft.metadata.announced_at || "").slice(0, 10)}|${draft.title.slice(0, 20)}`;
    if (recentKeys.has(k)) {
      dupBlocked++;
      continue;
    }
    recentKeys.add(k);
    passDrafts.push(draft);
  }

  const STORY_PARALLEL = 4;
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < passDrafts.length; i += STORY_PARALLEL) {
    const batch = passDrafts.slice(i, i + STORY_PARALLEL);
    const withStories = await Promise.all(
      batch.map(async (draft) => {
        const storyId = await attachStory(
          {
            title: draft.title,
            content: draft.content,
            domain: draft.domain || null,
            tags: draft.tags,
          },
          db,
          anthropic
        );
        return { draft, storyId };
      })
    );
    for (const { draft, storyId } of withStories) {
      rows.push({
        title: draft.title,
        content: draft.content,
        source_url: draft.source_url,
        source_type: "policy",
        domain: draft.domain || null,
        importance: draft.importance,
        suggested_tags: draft.tags,
        status: "inbox",
        story_id: storyId,
        metadata: draft.metadata,
        submitted_at: new Date().toISOString(),
      });
    }
  }

  timings.attach_insert_ms = Date.now() - t0 - (timings.fetch_ms + timings.dedup_ms + timings.filter_ms + timings.extract_ms);

  if (rows.length === 0) {
    return NextResponse.json({
      ok: true,
      inserted: 0,
      fetched: raw.length,
      after_dedup: dbDedupRaw.length,
      after_filter: filtered.length,
      dup_blocked: dupBlocked,
      timings,
    });
  }

  const { data, error } = await db.from("atlas_signals").insert(rows).select("id");
  if (error) {
    return NextResponse.json({ ok: false, error: error.message, timings }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    inserted: data?.length || 0,
    fetched: raw.length,
    after_dedup: dbDedupRaw.length,
    after_filter: filtered.length,
    dup_blocked: dupBlocked,
    timings,
  });
}
