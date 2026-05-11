/**
 * grant-ingest cron — Triple Helix 観測量 B (公募予算) を NEDO/JST/AMED 採択動向から quarter 単位で取得。
 *
 * 正本: pwa/design/aspi_lanes.md (Phase 2-D)、
 *       before-zero/theory/data_specification.md §B (NEDO/AMED/JST 採択額)
 *
 * 仕様:
 * - 各 ASPI domain × 直近 16 quarter に対して、Sonnet に「直近 quarter の NEDO/JST/AMED/SIP 採択動向 + 配分額」
 *   を推定させる。
 * - observation_log に upsert (key='B', source='grant')。
 *
 * 注: NEDO/JST/AMED の公開 採択リストは HTML scrape ベースで機関ごとに構造異なる。
 *      Phase 2-D 初版は LLM 推定で代替し、将来 Phase 2-D2 で HTML scrape を組み込む。
 *
 * cron: weekly (毎週月曜 04:15 JST) or 手動キック。
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
  });
}
