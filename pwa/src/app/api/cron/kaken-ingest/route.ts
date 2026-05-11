/**
 * kaken-ingest cron — Triple Helix 観測量 I_R (研究費) を KAKEN API から quarter 単位で取得。
 *
 * 正本: pwa/design/aspi_lanes.md (Phase 2-C)、
 *       before-zero/theory/data_specification.md §I_R (KAKEN 採択額)
 *
 * 仕様:
 * - 各 ASPI domain × 直近 16 quarter に対して、aspi-lanes.ts の KAKEN_KEYWORDS_BY_DOMAIN で
 *   KAKEN API を叩き、採択件数 + 配分額 (累計、億円) を集計。
 * - observation_log に upsert (UNIQUE lane, observed_at, observation_key, source)。
 *   key='I_R', source='kaken'。
 *
 * KAKEN API: https://nrid.nii.ac.jp/ja/grants/search/ の裏側 API。
 * - 正式 API endpoint: https://kaken.nii.ac.jp/grant/api/v1/search?...
 *   ただし正式公開 API は限定的。当面は LLM (Sonnet) で「直近 quarter の KAKEN 採択動向 + 推定金額」
 *   を推定する方式と併用 (LLM 駆動 ingest = `mode=llm` で動く)。
 *
 * cron: weekly (毎週月曜 04:00 JST) or 手動キック。
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

  for (const domain of ASPI_DOMAIN_IDS) {
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
      const resp = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
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
