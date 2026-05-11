/**
 * kaken-ingest cron — Triple Helix 観測量 I_R (研究費) を KAKEN OpenSearch API
 * + LLM フォールバックで quarter 単位で取得し observation_log に書き込む。
 *
 * 正本: pwa/design/aspi_lanes.md (Phase 2-C / C2)、
 *       before-zero/theory/data_specification.md §I_R (KAKEN 採択額)
 *
 * Phase 2-C2 (本実装):
 *   1. 各 ASPI 8 domain × 16 quarter に対して、KAKEN OpenSearch
 *      (https://nrid.nii.ac.jp/opensearch/?format=json&kw=<KW>&from=...&until=...)
 *      を keyword ごとに叩いて採択件数 + 配分額 (億円) を集計
 *   2. OpenSearch でデータが取れた場合は source='kaken_api' で upsert
 *   3. 取れなかった (= API 障害 / keyword ヒットゼロ) 場合のみ
 *      LLM (Sonnet + web_search) フォールバック (source='kaken')
 *
 * cron: weekly (毎週月曜 04:00 JST) — GAS 154 setupWeeklyAspiTriggers から curl。
 */

import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import {
  ASPI_DOMAIN_IDS,
  ASPI_DOMAIN_LABEL_JP,
  KAKEN_KEYWORDS_BY_DOMAIN,
  type AspiDomainId,
} from "@/lib/aspi-lanes";

export const maxDuration = 300;
export const runtime = "nodejs";

const QUARTERS_BACK = 16;
const KAKEN_OPENSEARCH_BASE = "https://nrid.nii.ac.jp/opensearch/";
const KAKEN_USER_AGENT = "AMD-Atlas-Bot/1.0 (+https://amd-os-pwa.vercel.app)";

/**
 * KAKEN OpenSearch を keyword + 期間で叩いて (件数, 推定配分額 億円) を返す。
 *
 * KAKEN OpenSearch は基本 ATOM XML だが format=json で JSON も返る (公開仕様)。
 * 個別研究課題の配分額が出るとは限らないため、件数ベース + 領域平均額で推定する。
 * 失敗時は null を返す → 呼び出し側で LLM フォールバック。
 */
async function fetchKakenForKeyword(
  keyword: string,
  fromDate: string,
  untilDate: string
): Promise<{ count: number; amount_oku_estimate: number } | null> {
  const q = new URLSearchParams({
    format: "json",
    kw: keyword,
    from: fromDate,
    until: untilDate,
    rw: "20", // max results per request (peek only)
  });
  const url = `${KAKEN_OPENSEARCH_BASE}?${q.toString()}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": KAKEN_USER_AGENT,
        Accept: "application/json,text/xml,*/*",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    // OpenSearch totalResults を best-effort で取得
    let total = 0;
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const root = (parsed["@graph"] ?? parsed) as Record<string, unknown>;
      const t = root["totalResults"] ?? root["opensearch:totalResults"];
      if (typeof t === "number") total = t;
      else if (typeof t === "string") total = parseInt(t, 10) || 0;
    } catch {
      // XML フォールバック: <opensearch:totalResults>N</opensearch:totalResults>
      const m = text.match(/<opensearch:totalResults[^>]*>(\d+)<\/opensearch:totalResults>/i);
      if (m) total = parseInt(m[1], 10) || 0;
    }
    if (total === 0) return { count: 0, amount_oku_estimate: 0 };
    // 領域平均: 基盤研究 B/C 比率を想定して 1 件あたり 0.05 億円 (= 500 万円) の概算
    const amount_oku_estimate = Math.round((total * 0.05) * 100) / 100;
    return { count: total, amount_oku_estimate };
  } catch (e) {
    console.warn(`[kaken-ingest] OpenSearch fetch err ${keyword}:`, e);
    return null;
  }
}

function quarterStartDate(year: number, q: 1 | 2 | 3 | 4): string {
  const month = (q - 1) * 3 + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function recentQuarters(n: number): { year: number; q: 1 | 2 | 3 | 4; observedAt: string }[] {
  const now = new Date();
  let year = now.getUTCFullYear();
  let q = (Math.floor(now.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  const out: { year: number; q: 1 | 2 | 3 | 4; observedAt: string }[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ year, q, observedAt: quarterStartDate(year, q) });
    q = (q - 1) as 1 | 2 | 3 | 4;
    if (q < 1) {
      q = 4;
      year -= 1;
    }
  }
  return out.reverse();
}

interface SonnetEstimateRow {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  amount_oku: number;       // 億円
  grant_count: number;      // 採択件数
  reasoning?: string;
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
  const anthroKey = process.env.ANTHROPIC_API_KEY;
  if (!url || !key || !anthroKey) {
    return NextResponse.json({ error: "env missing" }, { status: 500 });
  }
  const db = createClient(url, key);
  const anthropic = new Anthropic({ apiKey: anthroKey });

  const quarters = recentQuarters(QUARTERS_BACK);
  const rows: { lane: string; observed_at: string; observation_key: string; value: number; unit: string; source: string; raw_meta: Record<string, unknown> }[] = [];
  const apiSummary: Record<string, { covered_quarters: number; total_count: number }> = {};

  // =========================================================================
  // Phase 2-C2: KAKEN OpenSearch 実 API 叩き
  // =========================================================================
  for (const domain of ASPI_DOMAIN_IDS) {
    const keywords = KAKEN_KEYWORDS_BY_DOMAIN[domain as AspiDomainId];
    let coveredQ = 0;
    let totalCount = 0;
    for (const q of quarters) {
      const qFrom = quarterStartDate(q.year, q.q);
      const qNextYear = q.q === 4 ? q.year + 1 : q.year;
      const qNextQ = q.q === 4 ? 1 : ((q.q + 1) as 1 | 2 | 3 | 4);
      const qUntil = quarterStartDate(qNextYear, qNextQ);
      let sumCount = 0;
      let sumAmount = 0;
      let anyOk = false;
      for (const kw of keywords) {
        const r = await fetchKakenForKeyword(kw, qFrom, qUntil);
        if (r === null) continue;
        anyOk = true;
        sumCount += r.count;
        sumAmount += r.amount_oku_estimate;
      }
      if (!anyOk) continue;
      coveredQ++;
      totalCount += sumCount;
      rows.push({
        lane: domain,
        observed_at: qFrom,
        observation_key: "I_R",
        value: Math.round(sumAmount * 100) / 100,
        unit: "億円",
        source: "kaken_api",
        raw_meta: {
          grant_count: sumCount,
          keywords,
          source_url: KAKEN_OPENSEARCH_BASE,
          quarter: `${q.year}-Q${q.q}`,
        },
      });
    }
    apiSummary[domain] = { covered_quarters: coveredQ, total_count: totalCount };
  }

  // =========================================================================
  // LLM フォールバック: API でカバーできなかった (domain, quarter) は LLM 推定
  // =========================================================================
  const apiCovered = new Set(rows.map((r) => `${r.lane}|${r.observed_at}`));

  for (const domain of ASPI_DOMAIN_IDS) {
    const missingQuarters = quarters.filter(
      (q) => !apiCovered.has(`${domain}|${quarterStartDate(q.year, q.q)}`)
    );
    if (missingQuarters.length === 0) continue;

    const keywords = KAKEN_KEYWORDS_BY_DOMAIN[domain as AspiDomainId];
    const label = ASPI_DOMAIN_LABEL_JP[domain as AspiDomainId];

    const prompt = `あなたは日本の科研費 (KAKEN) 助成データに精通した研究助成アナリストです。
ASPI Critical Technology Tracker の ${domain} (${label}) 領域について、直近 ${QUARTERS_BACK} 四半期 (${quarters[0].year}-Q${quarters[0].q} 〜 ${quarters[quarters.length - 1].year}-Q${quarters[quarters.length - 1].q}) の、
KAKEN (科学研究費助成事業) における配分額 (億円) を quarter 単位で推定してください。

参考キーワード: ${keywords.join(", ")}

KAKEN は文科省・JSPS の代表的研究費。基盤研究 (S/A/B/C) / 挑戦的研究 / 若手研究 / 学術変革領域研究 等の総和。
- 内閣府ムーンショット、JST CREST/ERATO は別系統 (KAKEN に含まれない)
- 各 domain で年間 100〜数千億円規模になる (例: バイオは年 2000-3000 億円規模、量子は年 100-300 億円規模)
- quarter 単位の配分はおおむね均等 (年度初め Q2 が大型採択発表のため少し高い傾向)

過去の policy / budget milestones を考慮してください:
- 2015 AMED 設立 → biotechnology I_R 急増
- 2017 AI 戦略 → ai_technologies 段階的増
- 2020 量子戦略 → quantum 急増
- 2021 経済安保 → advanced_materials_manufacturing 増
- 2022 安保 3 文書 → defence_space_robotics_transport 増
- 2024 生成 AI 関連 → ai_technologies 再加速

出力 STRICT JSON 配列、preamble なし、code fence なし。配列長は ${QUARTERS_BACK} (古い順):
[
  {"year": 2022, "quarter": 1, "amount_oku": 120.5, "grant_count": 850},
  ...
]`;

    let parsed: SonnetEstimateRow[] | null = null;
    try {
      // hybrid mode: web_search tool で KAKEN/JSPS の公開採択統計を直接調べさせる。
      // Anthropic は server-side で iterate して最終 text block を返す。
      const resp = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4000,
        tools: [{ type: "web_search_20250305" as "web_search_20250305", name: "web_search", max_uses: 3 } as never],
        messages: [{ role: "user", content: prompt + "\n\n参考: KAKEN (https://kaken.nii.ac.jp/) や JSPS 科研費年次配分統計 (https://www.jsps.go.jp/j-grantsinaid/) を web_search で 2-3 件調べて、最新の年間配分額の桁感に揃えてください。" }],
      });
      const text = resp.content
        .filter((c) => c.type === "text")
        .map((c) => (c as { type: "text"; text: string }).text)
        .join("\n")
        .trim();
      const m = text.match(/\[[\s\S]*\]/);
      if (m) parsed = JSON.parse(m[0]) as SonnetEstimateRow[];
    } catch (e) {
      console.error(`[kaken-ingest] ${domain}`, e);
      continue;
    }
    if (!parsed || !Array.isArray(parsed)) continue;

    for (const pt of parsed) {
      const obsAt = quarterStartDate(pt.year, pt.quarter);
      if (apiCovered.has(`${domain}|${obsAt}`)) continue; // API でカバー済みは skip
      rows.push({
        lane: domain,
        observed_at: obsAt,
        observation_key: "I_R",
        value: Math.max(0, Number(pt.amount_oku) || 0),
        unit: "億円",
        source: "kaken",
        raw_meta: {
          grant_count: Math.max(0, Number(pt.grant_count) || 0),
          estimator: "anthropic:claude-sonnet-4-5-20250929",
          quarter: `${pt.year}-Q${pt.quarter}`,
          fallback_reason: "kaken_api_no_data",
        },
      });
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, message: "no rows" });
  }

  const { error } = await db.from("observation_log").upsert(rows, {
    onConflict: "lane,observed_at,observation_key,source",
    ignoreDuplicates: false,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    inserted: rows.length,
    domains: ASPI_DOMAIN_IDS.length,
    quarters: QUARTERS_BACK,
    api_summary: apiSummary,
  });
}
