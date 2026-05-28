/**
 * GET /api/cron/macro-aggregate-indicators
 *
 * 2026-05-12 まさ「マクロ係数の P (= policy_density) 以外のデータが 0 件か未取得」対応。
 * macro_index_log の 6 列 (index_value, policy_density, budget_amount, investment_amount,
 * policy_mention_count, raw_signal_count) のうち、policy_density 以外が全て 0 だったのを
 * observation_log + atlas_signals の集計で埋める cron。
 *
 * 集計ルール:
 *   - budget_amount       = observation_log で source IN ('grant','kaken') の value を lane × month で SUM
 *   - investment_amount   = observation_log で source IN ('vc','vc_investment') の value を lane × month で SUM
 *   - policy_mention_count = atlas_signals で source_type='policy' の件数を 各 ASPI lane × month で COUNT
 *                           (= atlas_signals.domain は ATL 独自分類 A/B/C 等で ASPI lane と直接 1:1 対応無し、
 *                            metadata.lane があればそれを優先、無ければ ATL domain → ASPI lane mapping を簡易適用)
 *   - raw_signal_count    = atlas_signals 全 source_type の件数を ASPI lane × month で COUNT
 *
 * Vercel Cron: 月初 04:00 JST (前月 19:00 UTC) — vercel.json schedule "0 19 1 * *"
 * 認証: Authorization: Bearer CRON_SECRET
 * 手動キック: ?since=2024-01 で開始月指定可 (= デフォルトは 2010-01 から全期間 walk)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ASPI_DOMAIN_IDS, type AspiDomainId } from "@/lib/aspi-lanes";

export const maxDuration = 300;

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "placeholder"
  );
}

/**
 * ATL 独自 domain (= atlas_signals.domain の "A.地政学・マクロ経済" 等) → ASPI 8 domain への簡易 mapping。
 * 完全 1:1 ではない (= 概念軸が違う) ため、近そうな domain にマッピング、無ければ null で除外。
 *
 * 基準: ATL domain ID prefix (A-R) と ASPI 8 domain の意味的類似性で判定。
 *   - I.ICT・AI            → advanced_ict + ai_technologies (両方カウント = 2 倍に乗る、許容)
 *   - C.素材・原料         → advanced_materials_manufacturing
 *   - F.バイオ・医療       → biotechnology
 *   - D.エネルギー         → energy_environment
 *   - O.サーキュラーエコノミー → energy_environment
 *   - G.モビリティ・ロボティクス → defence_space_robotics_transport
 *   - J.宇宙・防衛         → defence_space_robotics_transport
 *   - E.製造・プロセス技術 → advanced_materials_manufacturing
 *   - P.量子・量子計算 → quantum
 *   - Q.センシング・計測 → sensing_timing_navigation
 *   - R.先端通信 → advanced_ict
 *   - A/B/H/K/L/M/N (地政学・規制・建築・食農・金融・社会構造・海洋) → ASPI mapping なし、null で除外
 */
const ATL_DOMAIN_TO_ASPI: Record<string, AspiDomainId[]> = {
  "I.ICT・AI": ["advanced_ict", "ai_technologies"],
  "C.素材・原料": ["advanced_materials_manufacturing"],
  "F.バイオ・医療": ["biotechnology"],
  "D.エネルギー": ["energy_environment"],
  "O.サーキュラーエコノミー": ["energy_environment"],
  "G.モビリティ・ロボティクス": ["defence_space_robotics_transport"],
  "J.宇宙・防衛": ["defence_space_robotics_transport"],
  "E.製造・プロセス技術": ["advanced_materials_manufacturing"],
  "P.量子・量子計算": ["quantum"],
  "Q.センシング・計測": ["sensing_timing_navigation"],
  "R.先端通信": ["advanced_ict"],
};

interface AggregateRow {
  lane: string;
  observed_at: string; // YYYY-MM-01
  budget_amount: number;
  investment_amount: number;
  policy_mention_count: number;
  raw_signal_count: number;
}

function ymToFirstDay(ym: string): string {
  // ym = "2024-01" or "202401" → "2024-01-01"
  if (ym.includes("-")) return `${ym}-01`;
  return `${ym.slice(0, 4)}-${ym.slice(4)}-01`;
}

function isoMonth(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

async function aggregate(
  supabase: SupabaseClient,
  sinceMonth: string
): Promise<{ rows: AggregateRow[]; observationCount: number; signalCount: number }> {
  // 1) observation_log の集計 (= budget / investment 系)
  const { data: obsRows } = await supabase
    .from("observation_log")
    .select("lane, observed_at, observation_key, value, source")
    .gte("observed_at", sinceMonth);

  // 2) atlas_signals の集計 (= mention / signal_count 系)
  //    submitted_at をベースに月集計、domain → ASPI lane mapping
  const { data: signalRows } = await supabase
    .from("atlas_signals")
    .select("submitted_at, source_type, domain, metadata")
    .gte("submitted_at", sinceMonth)
    .order("submitted_at", { ascending: false })
    .limit(5000);

  // 3) lane × month で集計 map を構築
  type Acc = {
    budget: number;
    investment: number;
    mention: number;
    signal: number;
  };
  const map: Map<string, Acc> = new Map(); // key: `${lane}_${YYYY-MM-01}`

  const ensure = (lane: string, dateStr: string): Acc => {
    const key = `${lane}_${dateStr}`;
    if (!map.has(key)) {
      map.set(key, { budget: 0, investment: 0, mention: 0, signal: 0 });
    }
    return map.get(key)!;
  };

  // observation_log
  for (const o of obsRows ?? []) {
    const lane = String(o.lane ?? "");
    if (!ASPI_DOMAIN_IDS.includes(lane as AspiDomainId)) continue;
    const dateStr = String(o.observed_at).slice(0, 10);
    const monthStr = `${dateStr.slice(0, 7)}-01`;
    const value = Number(o.value) || 0;
    const source = String(o.source ?? "").toLowerCase();
    const acc = ensure(lane, monthStr);
    if (source === "grant" || source === "kaken" || String(o.observation_key) === "B" || String(o.observation_key) === "I_R") {
      acc.budget += value;
    } else if (source === "vc" || source === "vc_investment" || String(o.observation_key) === "V") {
      acc.investment += value;
    }
  }

  // atlas_signals
  for (const s of signalRows ?? []) {
    const dateStr = String(s.submitted_at ?? "").slice(0, 10);
    if (!dateStr) continue;
    const monthStr = `${dateStr.slice(0, 7)}-01`;
    if (monthStr < sinceMonth) continue;

    // metadata.lane を優先 (= 直接 ASPI lane が入ってる場合)、無ければ ATL domain → ASPI mapping
    const meta = (s.metadata ?? {}) as { lane?: string | string[] };
    let lanes: string[] = [];
    if (meta.lane) {
      lanes = Array.isArray(meta.lane) ? meta.lane : [meta.lane];
    } else if (s.domain && ATL_DOMAIN_TO_ASPI[s.domain]) {
      lanes = ATL_DOMAIN_TO_ASPI[s.domain];
    }

    for (const lane of lanes) {
      if (!ASPI_DOMAIN_IDS.includes(lane as AspiDomainId)) continue;
      const acc = ensure(lane, monthStr);
      acc.signal += 1;
      if (String(s.source_type ?? "").toLowerCase() === "policy") {
        acc.mention += 1;
      }
    }
  }

  const rows: AggregateRow[] = Array.from(map.entries()).map(([key, acc]) => {
    const idx = key.lastIndexOf("_");
    return {
      lane: key.slice(0, idx),
      observed_at: key.slice(idx + 1),
      budget_amount: acc.budget,
      investment_amount: acc.investment,
      policy_mention_count: acc.mention,
      raw_signal_count: acc.signal,
    };
  });

  return {
    rows,
    observationCount: (obsRows ?? []).length,
    signalCount: (signalRows ?? []).length,
  };
}

/**
 * macro_index_log への upsert。同じ (lane, observed_at) があれば budget / investment / mention /
 * signal_count を update。無ければ index_value / policy_density は null で INSERT (= macro-backfill が
 * あとから埋める)。
 *
 * macro_index_log には UNIQUE 制約が無いため、SELECT → 振り分け → INSERT/UPDATE を手動でやる。
 */
async function upsertIndicators(
  supabase: SupabaseClient,
  rows: AggregateRow[]
): Promise<{ updated: number; inserted: number; errors: string[] }> {
  if (rows.length === 0) return { updated: 0, inserted: 0, errors: [] };

  const errors: string[] = [];
  const lanes = Array.from(new Set(rows.map((r) => r.lane)));
  const months = Array.from(new Set(rows.map((r) => r.observed_at)));

  // 既存行を一括取得
  const { data: existing, error: selErr } = await supabase
    .from("macro_index_log")
    .select("id, lane, observed_at")
    .in("lane", lanes)
    .in("observed_at", months);
  if (selErr) {
    errors.push(`select: ${selErr.message}`);
    return { updated: 0, inserted: 0, errors };
  }

  const existingMap = new Map<string, string>(); // key: lane_observed_at → id
  for (const e of existing ?? []) {
    existingMap.set(`${e.lane}_${e.observed_at}`, e.id);
  }

  const toUpdate: Array<{ id: string; row: AggregateRow }> = [];
  const toInsert: AggregateRow[] = [];
  for (const r of rows) {
    const id = existingMap.get(`${r.lane}_${r.observed_at}`);
    if (id) toUpdate.push({ id, row: r });
    else toInsert.push(r);
  }

  let updated = 0;
  let inserted = 0;

  // バッチ UPDATE (= 1 件ずつ。Supabase の bulk update は条件式書きにくい)
  for (const u of toUpdate) {
    const { error } = await supabase
      .from("macro_index_log")
      .update({
        budget_amount: u.row.budget_amount,
        investment_amount: u.row.investment_amount,
        policy_mention_count: u.row.policy_mention_count,
        raw_signal_count: u.row.raw_signal_count,
      })
      .eq("id", u.id);
    if (error) errors.push(`update ${u.id}: ${error.message}`);
    else updated += 1;
  }

  // バッチ INSERT (= macro-backfill 未網羅の lane × month、index_value/policy_density null)
  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += 200) {
      const batch = toInsert.slice(i, i + 200).map((r) => ({
        lane: r.lane,
        observed_at: r.observed_at,
        index_value: 0, // NOT NULL なので 0 で初期化、macro-backfill が後で update
        budget_amount: r.budget_amount,
        investment_amount: r.investment_amount,
        policy_mention_count: r.policy_mention_count,
        raw_signal_count: r.raw_signal_count,
      }));
      const { error } = await supabase.from("macro_index_log").insert(batch);
      if (error) errors.push(`insert batch ${i}: ${error.message}`);
      else inserted += batch.length;
    }
  }

  return { updated, inserted, errors };
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = getServiceClient();

  const sinceParam = req.nextUrl.searchParams.get("since");
  // デフォルト: 過去 36 ヶ月 (= 直近 3 年。完全 backfill が必要なら ?since=2010-01 で叩く)
  const defaultSince = (() => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - 36);
    return isoMonth(d);
  })();
  const sinceMonth = sinceParam ? ymToFirstDay(sinceParam) : defaultSince;

  const { rows, observationCount, signalCount } = await aggregate(supabase, sinceMonth);
  const result = await upsertIndicators(supabase, rows);

  return NextResponse.json({
    ok: result.errors.length === 0,
    sinceMonth,
    aggregatedRows: rows.length,
    observationCount,
    signalCount,
    updated: result.updated,
    inserted: result.inserted,
    errorCount: result.errors.length,
    errors: result.errors.slice(0, 10),
    laneCoverage: Array.from(new Set(rows.map((r) => r.lane))).sort(),
  });
}
