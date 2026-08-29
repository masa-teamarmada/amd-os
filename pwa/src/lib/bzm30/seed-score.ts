// BZM 3.0 の案件ごとの入力とスコアの service_role 読み取り層。
//
// テーブル seed_value_ceilings / seed_bzm30_inputs / seed_bzm30_scores（migration 331）は
// member の SELECT を許してあるが、シーズ詳細は他の帯と同じく API route 経由で読む形に揃える
// （画面のクエリ本数を増やさず、プロセス内キャッシュを1か所に置くため）。
//
// 【参照系キャッシュ】書き込みは調査と `model/tools/bzm30_score_seeds.cjs` からしか起きない。
// 規範は /Users/masa/projects/AGENTS.common.reference.md「参照系データの体感速度」。
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ProcessType, RegClass } from "./seed-inputs";

const TTL_MS = 5 * 60 * 1000;

export interface SeedBzm30Ceiling {
  use_case: string;
  market_sales_yen: number | null;
  market_year: number | null;
  value_added_rate: number | null;
  /** 天井 P̄_u（国内の年額の付加価値・円）。調査が要る用途は null */
  ceiling_yen: number | null;
  /** 置き換え分 δ_u（円／年） */
  displacement_yen: number;
  is_primary: boolean;
  source: string | null;
  confidence: "high" | "medium" | "low" | null;
  note: string | null;
}

export interface SeedBzm30InputRow {
  process_type: ProcessType | null;
  reg_class: RegClass | null;
  classification_confidence: "confirmed" | "provisional" | null;
  classification_reason: string | null;
  evidence_stage: number | null;
  evidence_stage_reason: string | null;
  incorporated: boolean | null;
  free_cash_yen: number | null;
  free_cash_as_of: string | null;
  rights_open: number | null;
  under_contract: boolean | null;
  sigma: number | null;
  evangelist_e: number | null;
  kappa_ip: number | null;
  self_revenue_yen_month: number | null;
  self_revenue_note: string | null;
  unit_margin_positive: boolean | null;
  use_case_left: number | null;
  note: string | null;
  // 案件ごとに調べた根拠（migration 332）。画面の「入力の充足」の表の5列目に1件ずつ出す
  free_cash_reason: string | null;
  /**
   * 案件の実績または計画のバーンレート（円／月）。
   * **前向き計算には入らない** — 参照実装は案件ごとのバーンレートを受け取らず、
   * 工程の型と会社化の有無から引く既定値（モデルページ §6.I-9-2）で計算する。
   * 実績と既定値のずれを画面に出すためだけに持つ。
   */
  burn_rate_yen_month: number | null;
  burn_rate_reason: string | null;
  rights_open_reason: string | null;
  under_contract_reason: string | null;
  kappa_ip_reason: string | null;
  sigma_reason: string | null;
  evangelist_e_reason: string | null;
  unit_margin_reason: string | null;
  incorporated_reason: string | null;
  /**
   * 変換能力 c（分野の基準 1.0 に対する倍率。#2026-08-29-1）。
   * 入ると参照実装は事前分布の中心をこの値へ置き換える（幅 GSD 1.65 は保つ）。
   */
  conversion_c: number | null;
  conversion_c_reason: string | null;
  /**
   * 無風期間（ポジティブな公開の動きが出ていない月数。#2026-08-29-1）。
   * 実現の申し出の到来率と撤退の四経路②③に乗数 m_q が掛かる
   * （目盛り: 12か月 0.5・24か月 0.1・36か月以上 0.05。区分線形）。
   */
  quiet_months: number | null;
  quiet_months_reason: string | null;
}

export interface SeedBzm30ScoreRow {
  model_version: string;
  approval_ref: string;
  /** 天井を1に正規化した現在価値 */
  v_lower: number;
  v_median: number;
  v_upper: number;
  /** 天井を掛けた金額（円）。天井が未調査なら null */
  score_lower_yen: number | null;
  score_median_yen: number | null;
  score_upper_yen: number | null;
  ceiling_total_yen: number | null;
  p_reach_m4: number | null;
  months_to_m4: number | null;
  continuation_ratio: number | null;
  outcome: Record<string, number> | null;
  inputs: Record<string, unknown> | null;
  computed_at: string;
}

export interface SeedBzm30Dto {
  input: SeedBzm30InputRow | null;
  ceilings: SeedBzm30Ceiling[];
  /** 最新の1件だけ。過去の版は履歴として残す */
  score: SeedBzm30ScoreRow | null;
}

type Entry = { value: SeedBzm30Dto; storedAt: number };
const cache = new Map<string, Entry>();

export function invalidateSeedBzm30(seedId?: string): void {
  if (seedId) cache.delete(seedId);
  else cache.clear();
}

export async function fetchSeedBzm30(seedId: string, options?: { force?: boolean }): Promise<SeedBzm30Dto> {
  const hit = cache.get(seedId);
  if (!options?.force && hit && Date.now() - hit.storedAt < TTL_MS) return hit.value;

  const supabase = createAdminClient();
  const [inputRes, ceilingRes, scoreRes] = await Promise.all([
    supabase.from("seed_bzm30_inputs").select("*").eq("seed_id", seedId).maybeSingle(),
    supabase.from("seed_value_ceilings").select("*").eq("seed_id", seedId).order("is_primary", { ascending: false }),
    supabase
      .from("seed_bzm30_scores")
      .select("*")
      .eq("seed_id", seedId)
      .order("computed_at", { ascending: false })
      .limit(1),
  ]);

  const value: SeedBzm30Dto = {
    input: (inputRes.data as SeedBzm30InputRow | null) ?? null,
    ceilings: ((ceilingRes.data as SeedBzm30Ceiling[] | null) ?? []).map((c) => ({
      ...c,
      displacement_yen: Number(c.displacement_yen ?? 0),
      ceiling_yen: c.ceiling_yen === null ? null : Number(c.ceiling_yen),
      market_sales_yen: c.market_sales_yen === null ? null : Number(c.market_sales_yen),
    })),
    score: ((scoreRes.data as SeedBzm30ScoreRow[] | null) ?? [])[0] ?? null,
  };

  cache.set(seedId, { value, storedAt: Date.now() });
  return value;
}

// ─────────────────────────────────────────── 一覧向けのサマリ

export interface SeedBzm30Summary {
  seed_id: string;
  score_lower_yen: number | null;
  score_median_yen: number | null;
  score_upper_yen: number | null;
  v_median: number;
  ceiling_total_yen: number | null;
  process_type: ProcessType | null;
  reg_class: RegClass | null;
  evidence_stage: number | null;
  computed_at: string;
}

let summaryCache: { value: Map<string, SeedBzm30Summary>; storedAt: number } | null = null;

export function invalidateSeedBzm30Summaries(): void {
  summaryCache = null;
}

/**
 * 全シーズの最新スコア。一覧の1行1行で引かずに、まとめて1回で読む。
 * 算出済みのシーズだけが入る（未算出は Map に無い）。
 */
export async function fetchSeedBzm30Summaries(options?: { force?: boolean }): Promise<Map<string, SeedBzm30Summary>> {
  if (!options?.force && summaryCache && Date.now() - summaryCache.storedAt < TTL_MS) return summaryCache.value;

  const supabase = createAdminClient();
  const [scoreRes, inputRes] = await Promise.all([
    supabase
      .from("seed_bzm30_scores")
      .select("seed_id, score_lower_yen, score_median_yen, score_upper_yen, v_median, ceiling_total_yen, computed_at")
      .order("computed_at", { ascending: false }),
    supabase.from("seed_bzm30_inputs").select("seed_id, process_type, reg_class, evidence_stage"),
  ]);

  const inputs = new Map(
    ((inputRes.data as { seed_id: string; process_type: ProcessType | null; reg_class: RegClass | null; evidence_stage: number | null }[] | null) ?? [])
      .map((r) => [r.seed_id, r]),
  );

  const out = new Map<string, SeedBzm30Summary>();
  for (const row of (scoreRes.data as Record<string, unknown>[] | null) ?? []) {
    const seedId = row.seed_id as string;
    if (out.has(seedId)) continue;   // computed_at の降順なので最初の1件が最新
    const inp = inputs.get(seedId);
    out.set(seedId, {
      seed_id: seedId,
      score_lower_yen: row.score_lower_yen === null ? null : Number(row.score_lower_yen),
      score_median_yen: row.score_median_yen === null ? null : Number(row.score_median_yen),
      score_upper_yen: row.score_upper_yen === null ? null : Number(row.score_upper_yen),
      v_median: Number(row.v_median),
      ceiling_total_yen: row.ceiling_total_yen === null ? null : Number(row.ceiling_total_yen),
      process_type: inp?.process_type ?? null,
      reg_class: inp?.reg_class ?? null,
      evidence_stage: inp?.evidence_stage ?? null,
      computed_at: row.computed_at as string,
    });
  }

  summaryCache = { value: out, storedAt: Date.now() };
  return out;
}
