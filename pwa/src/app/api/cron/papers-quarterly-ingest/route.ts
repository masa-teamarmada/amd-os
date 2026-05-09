/**
 * papers-quarterly-ingest cron — Triple Helix 観測量 N (論文流出率) の lane × quarter 時系列。
 *
 * data_specification.md §N に従い、OpenAlex API で 5 lane × 直近 N quarter の論文数を取得して
 * `papers_log` に upsert する (UNIQUE (lane, observed_at))。
 *
 * - lane キーワード: scripts/fetch_papers_openalex.py の LANE_QUERIES と整合
 * - 観測頻度: 四半期 (data_spec §1)
 * - 認証: 不要 (polite mode、User-Agent に mailto)
 * - cron: weekly (毎週月曜 03:20 JST)
 *
 * Phase 3 で BVAR Kalman filter による隠れ状態 μ_A 推定の入力データになる。
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;
export const runtime = "nodejs";

const LANE_QUERIES: Record<string, string> = {
  gx_energy:
    '"hydrogen energy" OR "renewable energy" OR "solar cell" OR "next generation battery" OR "fusion energy"',
  gx_circular: '"circular economy" OR "recycling technology" OR "carbon capture" OR "waste valorization"',
  materials: '"nanomaterial" OR "advanced materials" OR "thermal insulation" OR "superconductor"',
  life: '"drug discovery" OR "gene therapy" OR "regenerative medicine" OR "biopharmaceutical"',
  robo: '"robotics" OR "autonomous robot" OR "agricultural drone" OR "construction automation"',
};

const POLITE_UA = "amd-os-pwa/1.0 (mailto:masa@team-armada.jp)";
const QUARTERS_BACK = 16; // 直近 16 quarter = 4 年分

interface OpenAlexResponse {
  meta?: { count?: number };
}

/** YYYY-MM-DD の quarter 開始日と終了日を返す */
function quarterRange(year: number, quarter: 1 | 2 | 3 | 4): { from: string; to: string; observedAt: string } {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const observedAt = `${year}-${String(startMonth).padStart(2, "0")}-01`;
  const lastDay = new Date(year, endMonth, 0).getDate();
  return {
    from: observedAt,
    to: `${year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    observedAt,
  };
}

/** 直近 N quarter の (year, quarter, range) リスト を返す */
function recentQuarters(n: number): { year: number; quarter: 1 | 2 | 3 | 4; observedAt: string; from: string; to: string }[] {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentQuarter = (Math.floor(now.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  const result: { year: number; quarter: 1 | 2 | 3 | 4; observedAt: string; from: string; to: string }[] = [];
  let year = currentYear;
  let quarter = currentQuarter;
  for (let i = 0; i < n; i++) {
    const range = quarterRange(year, quarter);
    result.push({ year, quarter, ...range });
    quarter = (quarter - 1) as 1 | 2 | 3 | 4;
    if (quarter < 1) {
      quarter = 4;
      year -= 1;
    }
  }
  return result;
}

async function fetchOpenAlexCount(query: string, fromDate: string, toDate: string): Promise<number> {
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("search", query);
  url.searchParams.set("filter", `from-publication-date:${fromDate},to-publication-date:${toDate},type:article`);
  url.searchParams.set("per_page", "1");
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": POLITE_UA, Accept: "application/json" },
  });
  if (!res.ok) {
    console.error(`[papers-quarterly-ingest] OpenAlex ${res.status} ${fromDate}~${toDate}`);
    return 0;
  }
  const json = (await res.json()) as OpenAlexResponse;
  return json.meta?.count ?? 0;
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "env missing" }, { status: 500 });
  }
  const db = createClient(url, key);

  const quarters = recentQuarters(QUARTERS_BACK);
  const summary: Record<string, { fetched: number; upserted: number }> = {};
  const rows: { lane: string; observed_at: string; paper_count: number; source: string; query_hash: string }[] = [];

  for (const [lane, query] of Object.entries(LANE_QUERIES)) {
    let fetched = 0;
    for (const q of quarters) {
      const count = await fetchOpenAlexCount(query, q.from, q.to);
      rows.push({
        lane,
        observed_at: q.observedAt,
        paper_count: count,
        source: "openalex",
        query_hash: `lane:${lane}/quarter:${q.year}-Q${q.quarter}`,
      });
      fetched++;
      // polite delay
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    summary[lane] = { fetched, upserted: 0 };
  }

  // upsert (lane, observed_at) UNIQUE
  const { error } = await db.from("papers_log").upsert(rows, {
    onConflict: "lane,observed_at",
    ignoreDuplicates: false,
  });
  if (error) {
    console.error("[papers-quarterly-ingest] upsert error", error);
    return NextResponse.json({ error: error.message, summary }, { status: 500 });
  }

  for (const lane of Object.keys(LANE_QUERIES)) {
    summary[lane].upserted = quarters.length;
  }

  return NextResponse.json({
    ok: true,
    summary,
    upserted_total: rows.length,
    quarters_back: QUARTERS_BACK,
  });
}
