import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { ASPI_DOMAIN_IDS, ASPI_DOMAIN_LABEL_JP, type AspiDomainId } from "@/lib/aspi-lanes";

export const maxDuration = 120;

interface WeightSet {
  alpha: number;
  beta: number;
  gamma: number;
  delta: number;
  lambda: number;
  eta: number;
}

/**
 * Phase 6: マクロ指数の領域別重みベクトル (α/β/γ/δ/λ/η) を LLM で再推定する cron。
 *
 * Phase 2 で旧 5 lane (gx_energy/gx_circular/materials/life/robo) から ASPI 8 domain
 * (pwa/design/aspi_lanes.md) に移行。
 *
 * 過去データ:
 *   - macro_index_log (lane × month の atlas_signals 集計)
 *   - papers_log (lane × quarter の OpenAlex 論文数)
 *   - project_ventures (10 PJ の outcome_pattern と founded_at, lanes weighted)
 * を Sonnet に投げて、各 ASPI domain の最も妥当な重みを推定 → macro_lane_weights に新行 INSERT。
 *
 * Bearer ${CRON_SECRET} 認証 + 手動キック対応。
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not set, skipping" }, { status: 200 });
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

  const [macroResp, papersResp, venturesResp] = await Promise.all([
    db
      .from("macro_index_log")
      .select("lane, observed_at, raw_signal_count, policy_density, index_value")
      .order("observed_at", { ascending: true }),
    db
      .from("papers_log")
      .select("lane, observed_at, paper_count, source")
      .order("observed_at", { ascending: true }),
    db
      .from("project_ventures")
      .select("project_id, lane, lanes, founded_at, outcome_pattern")
      .order("founded_at", { ascending: true, nullsFirst: false }),
  ]);

  const macroLog = macroResp.data || [];
  const papersLog = papersResp.data || [];
  const ventures = venturesResp.data || [];

  // 各 ASPI domain の paper trend を集約 (recent 5年)
  const recentYearStart = 2020;
  const paperByDomainYear: Record<string, Record<number, number>> = {};
  for (const r of papersLog) {
    const year = Number(String(r.observed_at).slice(0, 4));
    if (year < recentYearStart) continue;
    const lane = r.lane as string;
    if (!paperByDomainYear[lane]) paperByDomainYear[lane] = {};
    paperByDomainYear[lane][year] = (paperByDomainYear[lane][year] || 0) + Number(r.paper_count);
  }

  const domainList = ASPI_DOMAIN_IDS.map((d) => `${d} (${ASPI_DOMAIN_LABEL_JP[d]})`).join(", ");

  const prompt = `You are an econometric model designer for a Japanese deep-tech venture studio (AMD).

We model the macro trend index per ASPI Critical Tech domain i at time t as:

  M_i(t) = α_i ∫_{t-τ}^{t} P_i(s) · e^{-λ_i (t-s)} ds + β_i B_i(t) + γ_i V_i(t) + δ_i R_i(t)

Then the founding suitability:
  T_i(t) = M_i(t) · S_i^κ · (1 - C_i(t))^{η_i}

Variables:
  P_i = policy density (count of policy signals)
  B_i = grant/budget allocations (NEDO/AMED/JST)
  V_i = VC investment amount in the domain
  R_i = policy mention count (news referencing the policy / domain)
  S_i = seed maturity (constant per domain)
  C_i = competitor density

Domains (ASPI Critical Technology Tracker 8 domains, see pwa/design/aspi_lanes.md):
${domainList}

Past data (truncated):
- macro_index_log lane×month rows: ${macroLog.length}
- papers_log lane×quarter rows: ${papersLog.length}, recent samples per domain: ${JSON.stringify(paperByDomainYear)}
- ventures (AMD past SU outcomes, weighted lanes): ${JSON.stringify(ventures)}

Estimate the most plausible weights for each domain.

Constraints:
- α + β + γ + δ must equal 1.00 (within ±0.02)
- α, β, γ, δ each in [0.05, 0.60]
- λ in [0.05, 0.40] (smaller = policy effect lasts longer)
- η in [0.50, 2.00] (competitor density exponent)

Domain priors to incorporate (Japan context, 2010-2026):
- advanced_ict: サイバーセキュリティ戦略 / 通信基盤政策、γ 高め (民間投資ドリブン)
- advanced_materials_manufacturing: 経済安保 / 半導体・希少金属、γ 高、λ やや高い (政策風化早)
- ai_technologies: AI戦略 2017 / 生成AI 関連、γ 突出 (民間/VC 主導)、η 高め (急増)
- biotechnology: AMED 創設 2015 → β が突出して高い、λ 低い (政策効果長持ち)
- defence_space_robotics_transport: ロボット新戦略 2015 / ドローン規制緩和、バランス型、η 最高 (競合多い)
- energy_environment: GX 政策直撃 (α 高め)、λ 中程度、投資も比較的厚い
- quantum: 量子戦略 2020 / 国家戦略指定、β 高め (公的予算依存)
- sensing_timing_navigation: 準天頂衛星 / IoT、γ 中、η やや低い
- 失敗 SU (burnout, ue_fail) のあった domain は、当時のマクロ指標不足 (TRL/HRL ボトルネック) を考慮して η を上げる

Output STRICT JSON, no preamble, no code fences. Top-level keys = the 8 ASPI domain ids, plus "rationale" (short summary):
${ASPI_DOMAIN_IDS.map((d) => `  "${d}": { "alpha": ..., "beta": ..., "gamma": ..., "delta": ..., "lambda": ..., "eta": ... },`).join("\n")}
  "rationale": "one or two sentence summary"`;

  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = resp.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { type: "text"; text: string }).text)
    .join("\n")
    .trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "no JSON in LLM response", raw: text }, { status: 500 });
  }
  let parsed: Record<string, WeightSet | string>;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    return NextResponse.json(
      { error: "JSON parse failed", raw: text, exception: String(e) },
      { status: 500 }
    );
  }

  const inserts = ASPI_DOMAIN_IDS.map((lane: AspiDomainId) => {
    const w = parsed[lane] as WeightSet | undefined;
    if (!w || typeof w !== "object") return null;
    const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number(x)));
    const alpha = clamp(w.alpha, 0.05, 0.60);
    const beta = clamp(w.beta, 0.05, 0.60);
    const gamma = clamp(w.gamma, 0.05, 0.60);
    const delta = clamp(w.delta, 0.05, 0.60);
    const sum = alpha + beta + gamma + delta;
    return {
      lane,
      alpha: alpha / sum,
      beta: beta / sum,
      gamma: gamma / sum,
      delta: delta / sum,
      lambda: clamp(w.lambda, 0.05, 0.40),
      eta: clamp(w.eta, 0.50, 2.00),
      computed_by: "llm-sonnet-4-5",
      source_data_window_days: 1095,
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  if (inserts.length === 0) {
    return NextResponse.json({ error: "no valid lanes parsed", raw: parsed }, { status: 500 });
  }

  const { error: insErr } = await db.from("macro_lane_weights").insert(inserts);
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    inserted: inserts.length,
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : null,
    weights: inserts,
  });
}
