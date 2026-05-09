/**
 * Scholar (μ_A 学術根拠) 自動収集 cron。
 *
 * 毎日 1 回 Crossref API で 5 lane × 直近 1 年の最新論文を取得して
 * `scholar` テーブルに DOI ユニークで投入する。AmdScoreView の μ_A 行 fallback
 * が参照する。
 *
 * - 認証不要・無料 (polite mode のため User-Agent に mailto を含める)
 * - lane クエリは scripts/fetch_papers_openalex.py の LANE_QUERIES と整合
 * - 重複は scholar.doi UNIQUE で防止 (partial index、doi IS NOT NULL)
 * - source_type='paper', ingested_by='crossref', status='auto'
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;
export const runtime = "nodejs";

const LANE_QUERIES: Record<string, string> = {
  gx_energy: '"hydrogen energy" OR "renewable energy" OR "solar cell" OR "next generation battery" OR "fusion energy"',
  gx_circular: '"circular economy" OR "recycling technology" OR "carbon capture" OR "waste valorization"',
  materials: '"nanomaterial" OR "advanced materials" OR "thermal insulation" OR "superconductor"',
  life: '"drug discovery" OR "gene therapy" OR "regenerative medicine" OR "biopharmaceutical"',
  robo: '"robotics" OR "autonomous robot" OR "agricultural drone" OR "construction automation"',
};

const ROWS_PER_LANE = 20;
const POLITE_UA = "amd-os-pwa/1.0 (mailto:masa@team-armada.jp)";

interface CrossrefAuthor {
  given?: string;
  family?: string;
  name?: string;
}

interface CrossrefDateParts {
  "date-parts"?: number[][];
}

interface CrossrefItem {
  DOI?: string;
  title?: string[];
  author?: CrossrefAuthor[];
  "container-title"?: string[];
  published?: CrossrefDateParts;
  issued?: CrossrefDateParts;
  "published-print"?: CrossrefDateParts;
  "published-online"?: CrossrefDateParts;
  URL?: string;
  type?: string;
  subject?: string[];
}

interface CrossrefResponse {
  message?: {
    items?: CrossrefItem[];
  };
}

interface ScholarRow {
  title: string;
  authors: string[] | null;
  journal: string | null;
  doi: string;
  published_at: string | null;
  lane: string;
  suggested_tags: string[] | null;
  source_type: string;
  source_url: string | null;
  status: string;
  ingested_by: string;
  metadata: Record<string, unknown> | null;
}

function pickDate(item: CrossrefItem): string | null {
  const candidates = [item.published, item.issued, item["published-print"], item["published-online"]];
  for (const c of candidates) {
    const parts = c?.["date-parts"]?.[0];
    if (parts && parts.length >= 1) {
      const y = parts[0];
      const m = parts[1] ?? 1;
      const d = parts[2] ?? 1;
      if (typeof y === "number" && y > 1900) {
        return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      }
    }
  }
  return null;
}

function pickAuthors(item: CrossrefItem): string[] | null {
  if (!item.author || item.author.length === 0) return null;
  const names = item.author
    .map((a) => {
      if (a.name) return a.name;
      const given = a.given ?? "";
      const family = a.family ?? "";
      const full = `${given} ${family}`.trim();
      return full || null;
    })
    .filter((n): n is string => Boolean(n));
  return names.length > 0 ? names : null;
}

async function fetchLaneItems(lane: string, query: string, fromDate: string): Promise<CrossrefItem[]> {
  const url = new URL("https://api.crossref.org/works");
  url.searchParams.set("query", query);
  url.searchParams.set("rows", String(ROWS_PER_LANE));
  url.searchParams.set("filter", `from-pub-date:${fromDate},type:journal-article`);
  url.searchParams.set("sort", "published");
  url.searchParams.set("order", "desc");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": POLITE_UA, Accept: "application/json" },
  });
  if (!res.ok) {
    console.error(`[scholar-ingest] crossref ${lane} ${res.status}`);
    return [];
  }
  const json = (await res.json()) as CrossrefResponse;
  return json.message?.items ?? [];
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

  // 直近 1 年
  const now = new Date();
  const fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // 既存 DOI を pull (重複チェック用)
  const { data: existingRows } = await db.from("scholar").select("doi").not("doi", "is", null);
  const existingDois = new Set<string>(
    (existingRows ?? []).map((r) => (r as { doi: string }).doi.toLowerCase()).filter(Boolean)
  );

  const summary: Record<string, { fetched: number; inserted: number; skipped: number }> = {};
  const inserts: ScholarRow[] = [];

  for (const [lane, query] of Object.entries(LANE_QUERIES)) {
    const items = await fetchLaneItems(lane, query, fromDate);
    let inserted = 0;
    let skipped = 0;
    for (const item of items) {
      const doi = item.DOI?.toLowerCase();
      if (!doi) {
        skipped++;
        continue;
      }
      if (existingDois.has(doi)) {
        skipped++;
        continue;
      }
      existingDois.add(doi);
      const title = item.title?.[0]?.trim();
      if (!title) {
        skipped++;
        continue;
      }
      inserts.push({
        title,
        authors: pickAuthors(item),
        journal: item["container-title"]?.[0] ?? null,
        doi,
        published_at: pickDate(item),
        lane,
        suggested_tags: item.subject ?? null,
        source_type: "paper",
        source_url: item.URL ?? `https://doi.org/${doi}`,
        status: "auto",
        ingested_by: "crossref",
        metadata: { type: item.type ?? null },
      });
      inserted++;
    }
    summary[lane] = { fetched: items.length, inserted, skipped };
  }

  if (inserts.length === 0) {
    return NextResponse.json({ ok: true, summary, inserted_total: 0, message: "no new papers" });
  }

  const { error } = await db.from("scholar").insert(inserts);
  if (error) {
    console.error("[scholar-ingest] insert error", error);
    return NextResponse.json({ error: error.message, summary }, { status: 500 });
  }

  return NextResponse.json({ ok: true, summary, inserted_total: inserts.length });
}
