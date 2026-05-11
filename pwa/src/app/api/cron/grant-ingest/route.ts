/**
 * grant-ingest cron — Triple Helix 観測量 B (公募予算) を NEDO/JST/AMED 採択動向から quarter 単位で取得。
 *
 * 正本: pwa/design/aspi_lanes.md (Phase 2-D / D2)、
 *       before-zero/theory/data_specification.md §B (NEDO/AMED/JST 採択額)
 *
 * Phase 2-D2 (本実装):
 *   1. NEDO / AMED / JST の最新採択ページを HTML fetch (軽量 regex 抽出、cheerio 不使用)
 *   2. Sonnet に採択タイトル一覧を渡して「ASPI 8 domain 分類 + 概算金額」を batch 判定
 *   3. 現 quarter のデータが取れたら observation_log に source='grant_scrape' で upsert
 *   4. それ以外の quarter / 失敗時は LLM (Sonnet + web_search) 推定で補完 (source='grant')
 *
 * cron: weekly (毎週月曜 04:15 JST) — GAS 154 setupWeeklyAspiTriggers から curl。
 */

import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import {
  ASPI_DOMAIN_IDS,
  ASPI_DOMAIN_LABEL_JP,
  GRANT_KEYWORDS_BY_DOMAIN,
  type AspiDomainId,
} from "@/lib/aspi-lanes";

export const maxDuration = 300;
export const runtime = "nodejs";

const QUARTERS_BACK = 16;
const SCRAPE_USER_AGENT = "AMD-Atlas-Bot/1.0 (+https://amd-os-pwa.vercel.app)";

const GRANT_SCRAPE_SOURCES = [
  // agency_code は raw_meta に保存。URL は採択 公示の代表ページ。
  { agency: "NEDO", url: "https://www.nedo.go.jp/koubo/saitaku_l.html" },
  { agency: "AMED", url: "https://www.amed.go.jp/koubo/saitaku/" },
  { agency: "JST", url: "https://www.jst.go.jp/funding/saitaku.html" },
] as const;

/** HTML から <li> / <tr> / <a> のタイトル候補を抽出 (簡易) */
function extractTitlesFromHtml(html: string): string[] {
  const titles = new Set<string>();
  // <a ...>title</a>
  const reA = /<a [^>]*>([^<]{8,120})<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = reA.exec(html))) {
    const t = m[1].replace(/\s+/g, " ").trim();
    if (!t) continue;
    if (/^https?:\/\//.test(t)) continue;
    titles.add(t);
  }
  // <li>title</li> もしくは <td>title</td>
  const reLi = /<(?:li|td)[^>]*>([^<]{8,200})<\/(?:li|td)>/g;
  while ((m = reLi.exec(html))) {
    const t = m[1].replace(/\s+/g, " ").trim();
    if (!t) continue;
    titles.add(t);
  }
  // 採択 / 助成 / 公募 を含む候補のみ採用
  return Array.from(titles).filter((t) => /(採択|助成|公募|採用|決定|交付)/.test(t)).slice(0, 80);
}

interface ScrapedClassification {
  title: string;
  domain: AspiDomainId;
  amount_oku: number;
  agency: string;
}

async function scrapeGrantSources(anthropic: Anthropic): Promise<ScrapedClassification[]> {
  const allTitles: { agency: string; title: string }[] = [];
  for (const src of GRANT_SCRAPE_SOURCES) {
    try {
      const res = await fetch(src.url, {
        headers: { "User-Agent": SCRAPE_USER_AGENT, Accept: "text/html" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const titles = extractTitlesFromHtml(html);
      for (const t of titles) allTitles.push({ agency: src.agency, title: t });
    } catch (e) {
      console.warn(`[grant-ingest] scrape err ${src.url}:`, e);
    }
  }
  if (allTitles.length === 0) return [];

  // Sonnet に一括分類させる
  const prompt = `あなたは日本の公的助成 (NEDO / AMED / JST / SIP / 内閣府ムーンショット) 採択タイトル一覧を分類するアナリストです。
以下の採択タイトル候補について、ASPI Critical Technology Tracker の 8 domain に分類し、1 件あたりの概算採択額 (億円) を推定してください。

ASPI 8 domain (どれか1つ):
- advanced_ict
- advanced_materials_manufacturing
- ai_technologies
- biotechnology
- defence_space_robotics_transport
- energy_environment
- quantum
- sensing_timing_navigation

採択候補 (agency: title):
${allTitles.map((t, i) => `${i + 1}. [${t.agency}] ${t.title}`).join("\n")}

ルール:
- 各 entry に index, domain (上記 8 値のどれか / どの domain にも該当しない場合は null), amount_oku を入れて返す
- 1 件あたりの amount_oku は採択枠の平均的な額 (大型 = 5-30 億、中型 = 0.5-3 億、小型 = 0.05-0.3 億)
- タイトルだけで domain が分からない場合は null

出力 STRICT JSON 配列、preamble なし、code fence なし:
[{"index": 1, "domain": "energy_environment", "amount_oku": 0.5}, ...]`;

  try {
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });
    const text = resp.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { type: "text"; text: string }).text)
      .join("\n");
    const mJson = text.match(/\[[\s\S]*\]/);
    if (!mJson) return [];
    const parsed = JSON.parse(mJson[0]) as { index: number; domain: string | null; amount_oku: number }[];
    const out: ScrapedClassification[] = [];
    for (const p of parsed) {
      const tIdx = p.index - 1;
      if (tIdx < 0 || tIdx >= allTitles.length) continue;
      if (!p.domain || !ASPI_DOMAIN_IDS.includes(p.domain as AspiDomainId)) continue;
      out.push({
        title: allTitles[tIdx].title,
        agency: allTitles[tIdx].agency,
        domain: p.domain as AspiDomainId,
        amount_oku: Math.max(0, Number(p.amount_oku) || 0),
      });
    }
    return out;
  } catch (e) {
    console.error("[grant-ingest] classify err", e);
    return [];
  }
}

function quarterStartDate(year: number, q: 1 | 2 | 3 | 4): string {
  const month = (q - 1) * 3 + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function recentQuarters(n: number): { year: number; q: 1 | 2 | 3 | 4 }[] {
  const now = new Date();
  let year = now.getUTCFullYear();
  let q = (Math.floor(now.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  const out: { year: number; q: 1 | 2 | 3 | 4 }[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ year, q });
    q = (q - 1) as 1 | 2 | 3 | 4;
    if (q < 1) {
      q = 4;
      year -= 1;
    }
  }
  return out.reverse();
}

interface SonnetGrantRow {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  amount_oku: number;
  adopted_count: number;
  agency_mix?: Record<string, number>; // NEDO/JST/AMED/SIP/MIRAI 等の按分 (％)
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

  // =========================================================================
  // Phase 2-D2: NEDO/AMED/JST HTML scrape → 現 quarter の domain 別 sum
  // =========================================================================
  const scraped = await scrapeGrantSources(anthropic);
  const currentQuarter = quarters[quarters.length - 1];
  const currentQuarterStart = quarterStartDate(currentQuarter.year, currentQuarter.q);

  if (scraped.length > 0) {
    const byDomain = new Map<AspiDomainId, { sum: number; count: number; titles: string[] }>();
    for (const s of scraped) {
      if (!s.domain) continue;
      const cur = byDomain.get(s.domain) ?? { sum: 0, count: 0, titles: [] };
      cur.sum += s.amount_oku;
      cur.count += 1;
      cur.titles.push(`[${s.agency}] ${s.title}`);
      byDomain.set(s.domain, cur);
    }
    for (const [domain, agg] of byDomain.entries()) {
      rows.push({
        lane: domain,
        observed_at: currentQuarterStart,
        observation_key: "B",
        value: Math.round(agg.sum * 100) / 100,
        unit: "億円",
        source: "grant_scrape",
        raw_meta: {
          adopted_count: agg.count,
          titles: agg.titles.slice(0, 30),
          quarter: `${currentQuarter.year}-Q${currentQuarter.q}`,
          sources: GRANT_SCRAPE_SOURCES.map((s) => s.agency),
        },
      });
    }
  }

  const scrapeCovered = new Set(rows.map((r) => `${r.lane}|${r.observed_at}`));

  // =========================================================================
  // LLM 推定 (Phase 2-D 初版): 他 quarter / scrape カバー外を補完
  // =========================================================================
  for (const domain of ASPI_DOMAIN_IDS) {
    const keywords = GRANT_KEYWORDS_BY_DOMAIN[domain as AspiDomainId];
    const label = ASPI_DOMAIN_LABEL_JP[domain as AspiDomainId];

    const prompt = `あなたは日本の公的研究助成 (NEDO / JST / AMED / SIP / 内閣府ムーンショット 等) の動向を熟知した政策アナリストです。
ASPI Critical Technology Tracker の ${domain} (${label}) 領域について、直近 ${QUARTERS_BACK} 四半期 (${quarters[0].year}-Q${quarters[0].q} 〜 ${quarters[quarters.length - 1].year}-Q${quarters[quarters.length - 1].q}) の、
公的助成 公募予算 (採択額) を quarter 単位で推定してください。

参考キーワード: ${keywords.join(", ")}

カバー機関:
- NEDO (新エネ・産業技術): GX / 半導体 / 環境
- JST (CREST/ERATO/ムーンショット/A-STEP)
- AMED (医療・バイオ)
- 内閣府 SIP (Society 5.0 / GX 系)
- 防衛装備庁・宇宙開発機構 (defence_space_robotics_transport)

各 domain で年間規模:
- energy_environment: 年 3000-5000 億円 (GX 関連大型予算)
- biotechnology: 年 1500-2000 億円 (AMED 主体)
- advanced_materials_manufacturing: 年 1000-1500 億円 (半導体・希少金属)
- ai_technologies: 年 300-1000 億円 (GENIAC 等で 2024 以降急増)
- defence_space_robotics_transport: 年 1500-3000 億円 (2022 安保 3 文書以降急増)
- advanced_ict: 年 200-500 億円
- quantum: 年 100-300 億円 (2020 戦略以降増)
- sensing_timing_navigation: 年 200-500 億円

過去 milestones を考慮:
- 2015 AMED 設立 → biotechnology 増
- 2020 カーボンニュートラル / 量子戦略
- 2022 GX 推進法 / 安保 3 文書 / プラ法
- 2023 経済安保 / 量子コンピュータ稼働
- 2024 GENIAC / GX-ETS / CBAM

出力 STRICT JSON 配列、preamble なし、code fence なし。配列長は ${QUARTERS_BACK} (古い順):
[
  {"year": 2022, "quarter": 1, "amount_oku": 250.0, "adopted_count": 45, "agency_mix": {"NEDO": 50, "JST": 30, "SIP": 20}},
  ...
]`;

    let parsed: SonnetGrantRow[] | null = null;
    try {
      // hybrid mode: web_search tool で NEDO / JST / AMED の最新採択ニュース・公募情報を直接調べさせる。
      const resp = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4000,
        tools: [{ type: "web_search_20250305" as "web_search_20250305", name: "web_search", max_uses: 3 } as never],
        messages: [{
          role: "user",
          content: prompt + "\n\n参考: 直近の採択動向を web_search で 2-3 件確認してください。例えば NEDO 採択 (https://www.nedo.go.jp/koubo/), JST 戦略目標 (https://www.jst.go.jp/funding/), AMED 採択 (https://www.amed.go.jp/koubo/saitaku/) 等。最新 quarter の桁感に揃える。"
        }],
      });
      const text = resp.content
        .filter((c) => c.type === "text")
        .map((c) => (c as { type: "text"; text: string }).text)
        .join("\n")
        .trim();
      const m = text.match(/\[[\s\S]*\]/);
      if (m) parsed = JSON.parse(m[0]) as SonnetGrantRow[];
    } catch (e) {
      console.error(`[grant-ingest] ${domain}`, e);
      continue;
    }
    if (!parsed || !Array.isArray(parsed)) continue;

    for (const pt of parsed) {
      const obsAt = quarterStartDate(pt.year, pt.quarter);
      // scrape でカバー済 (current quarter のみ) ならその domain は skip
      if (scrapeCovered.has(`${domain}|${obsAt}`)) continue;
      rows.push({
        lane: domain,
        observed_at: obsAt,
        observation_key: "B",
        value: Math.max(0, Number(pt.amount_oku) || 0),
        unit: "億円",
        source: "grant",
        raw_meta: {
          adopted_count: Math.max(0, Number(pt.adopted_count) || 0),
          agency_mix: pt.agency_mix ?? {},
          estimator: "anthropic:claude-sonnet-4-5-20250929",
          quarter: `${pt.year}-Q${pt.quarter}`,
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
    scrape_classified: scraped.length,
    scrape_covered_domains: Array.from(new Set(scraped.map((s) => s.domain).filter(Boolean))),
  });
}
