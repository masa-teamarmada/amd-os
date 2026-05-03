import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 120;

const LANES = ["gx_energy", "gx_circular", "materials", "life", "robo"] as const;
type LaneId = (typeof LANES)[number];

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
 * 過去データ:
 *   - macro_index_log (lane × month の atlas_signals 集計)
 *   - papers_log (lane × year の OpenAlex 論文数)
 *   - ventures (9社の outcome_pattern と founded_at)
 * を LLM (Sonnet 4.6/4.7) に投げて、各レーンの最も妥当な重みを推定 → macro_lane_weights に新行 INSERT。
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
      .from("ventures")
      .select("id, lane, founded_at, outcome_pattern, status")
      .order("founded_at", { ascending: true }),
  ]);

  const macroLog = macroResp.data || [];
  const papersLog = papersResp.data || [];
  const ventures = venturesResp.data || [];

  // 各レーンの paper trend を集約（recent 5年）
  const recentYearStart = 2020;
  const paperByLaneYear: Record<string, Record<number, number>> = {};
  for (const r of papersLog) {
    const year = Number(String(r.observed_at).slice(0, 4));
    if (year < recentYearStart) continue;
    const lane = r.lane as string;
    if (!paperByLaneYear[lane]) paperByLaneYear[lane] = {};
    paperByLaneYear[lane][year] = (paperByLaneYear[lane][year] || 0) + Number(r.paper_count);
  }

  const prompt = `You are an econometric model designer for a Japanese deep-tech venture studio (AMD).

We model the macro trend index per industry lane i at time t as:

  M_i(t) = α_i ∫_{t-τ}^{t} P_i(s) · e^{-λ_i (t-s)} ds + β_i B_i(t) + γ_i V_i(t) + δ_i R_i(t)

Then the founding suitability ("temperature"):
  T_i(t) = M_i(t) · S_i^κ · (1 - C_i(t))^{η_i}

Variables:
  P_i = policy density (count of policy signals)
  B_i = grant/budget allocations
  V_i = VC investment amount in the lane
  R_i = policy mention count (non-policy news referencing the policy / lane)
  S_i = seed maturity (constant per lane)
  C_i = competitor density

Five lanes: gx_energy (renewables, hydrogen, batteries, DC cooling, fusion), gx_circular (waste, recycling, ESG, water), materials (rare earth, semiconductors, nano), life (drug discovery, regenerative medicine, AMED priorities), robo (drones, agri-robots, construction DX).

Past data (truncated):
- macro_index_log lane×month rows: ${macroLog.length}
- papers_log lane×year rows: ${papersLog.length}, recent samples per lane: ${JSON.stringify(paperByLaneYear)}
- ventures (AMD past SU outcomes): ${JSON.stringify(ventures)}

Estimate the most plausible weights for each lane.

Constraints:
- α + β + γ + δ must equal 1.00 (within ±0.02)
- α, β, γ, δ each in [0.05, 0.60]
- λ in [0.05, 0.40] (smaller = policy effect lasts longer)
- η in [0.50, 2.00] (competitor density exponent)

Domain priors to incorporate:
- gx_energy: GX政策が直撃するため α 高め、λ 中程度。投資も比較的厚い
- gx_circular: 規制ドリブン、α 最も高く β/γ も中程度
- materials: 投資額の効きが大きい (γ 高め)、λ やや高い (政策の風化が早い)
- life: AMED予算が決定的なので β が突出して高い、λ 低い (政策効果が長持ち)
- robo: バランス型、ηを最も高く（競合が増えやすい）
- 失敗SU (burnout, ue_fail) のあったレーンは、当時のマクロ指標の不足 (TRL/HRL ボトルネック) を考慮して η を上げる

Output STRICT JSON, no preamble, no code fences:
{
  "gx_energy":   { "alpha": ..., "beta": ..., "gamma": ..., "delta": ..., "lambda": ..., "eta": ... },
  "gx_circular": { "alpha": ..., "beta": ..., "gamma": ..., "delta": ..., "lambda": ..., "eta": ... },
  "materials":   { "alpha": ..., "beta": ..., "gamma": ..., "delta": ..., "lambda": ..., "eta": ... },
  "life":        { "alpha": ..., "beta": ..., "gamma": ..., "delta": ..., "lambda": ..., "eta": ... },
  "robo":        { "alpha": ..., "beta": ..., "gamma": ..., "delta": ..., "lambda": ..., "eta": ... },
  "rationale":   "one or two sentence summary"
}`;

  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = resp.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { type: "text"; text: string }).text)
    .join("\n")
    .trim();

  // JSON を抽出
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

  // 各レーンの行を INSERT
  const inserts = LANES.map((lane) => {
    const w = parsed[lane] as WeightSet | undefined;
    if (!w || typeof w !== "object") return null;
    // クランプ
    const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number(x)));
    const alpha = clamp(w.alpha, 0.05, 0.60);
    const beta = clamp(w.beta, 0.05, 0.60);
    const gamma = clamp(w.gamma, 0.05, 0.60);
    const delta = clamp(w.delta, 0.05, 0.60);
    // 正規化 α+β+γ+δ = 1
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
      source_data_window_days: 720,
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
