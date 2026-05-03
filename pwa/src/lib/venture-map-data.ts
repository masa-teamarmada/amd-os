/**
 * Venture Map データアクセス層
 * Server Component から Supabase の ventures / macro_lane_weights / seeds を読む。
 *
 * macro_index_log / papers_log は Phase 4/5 で実データ投入後に追加する。
 * それまでは VentureMapView 側のハードコード SERIES を使う。
 */

import { createClient } from "@/lib/supabase/server";

export type LaneId = "gx_energy" | "gx_circular" | "materials" | "life" | "robo";

export type OutcomePattern = "rocket" | "lifted" | "deep_pivot" | "burnout" | "ue_fail";

export interface VentureRow {
  id: string;
  display_name: string;
  short_label: string | null;
  lane: LaneId;
  founded_at: string; // ISO date
  status: string;
  outcome_pattern: OutcomePattern;
  origin_org: string | null;
  origin_pi: string | null;
  amd_role: string | null;
  short_description: string | null;
  is_public: boolean;
}

export interface LaneWeightRow {
  lane: LaneId;
  alpha: number;
  beta: number;
  gamma: number;
  delta: number;
  lambda: number | null;
  eta: number | null;
  computed_at: string;
  computed_by: string | null;
}

export interface SeedRow {
  id: string;
  title: string;
  description: string | null;
  origin_org: string | null;
  origin_pi: string | null;
  lane: LaneId | null;
  trl: number | null;
  brl: number | null;
  hrl: number | null;
  status: string;
  is_public: boolean;
}

/** 公開可な venture を全件、設立日昇順で取得 */
export async function fetchVenturesForMap(): Promise<VentureRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ventures")
    .select("id, display_name, short_label, lane, founded_at, status, outcome_pattern, origin_org, origin_pi, amd_role, short_description, is_public")
    .eq("is_public", true)
    .order("founded_at", { ascending: true });
  if (error) {
    console.error("[fetchVenturesForMap]", error);
    return [];
  }
  return (data || []) as VentureRow[];
}

/** 各レーンの最新の重みベクトルを1件ずつ取得 */
export async function fetchLatestLaneWeights(): Promise<Record<LaneId, LaneWeightRow>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("macro_lane_weights")
    .select("lane, alpha, beta, gamma, delta, lambda, eta, computed_at, computed_by")
    .order("computed_at", { ascending: false });
  if (error || !data) {
    console.error("[fetchLatestLaneWeights]", error);
    return {} as Record<LaneId, LaneWeightRow>;
  }
  const latest = new Map<LaneId, LaneWeightRow>();
  for (const row of data as LaneWeightRow[]) {
    if (!latest.has(row.lane)) latest.set(row.lane, row);
  }
  return Object.fromEntries(latest) as Record<LaneId, LaneWeightRow>;
}

export interface MacroIndexRow {
  lane: LaneId;
  observed_at: string; // YYYY-MM-DD
  index_value: number;
  policy_density: number | null;
  raw_signal_count: number | null;
}

export interface PaperRow {
  lane: LaneId;
  observed_at: string; // YYYY-MM-DD
  paper_count: number;
  source: string;
}

/** マクロ指数の時系列を全件取得 */
export async function fetchMacroIndexLog(): Promise<MacroIndexRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("macro_index_log")
    .select("lane, observed_at, index_value, policy_density, raw_signal_count")
    .order("observed_at", { ascending: true });
  if (error) {
    console.error("[fetchMacroIndexLog]", error);
    return [];
  }
  return (data || []).map((r) => ({
    lane: r.lane as LaneId,
    observed_at: r.observed_at as string,
    index_value: Number(r.index_value),
    policy_density: r.policy_density != null ? Number(r.policy_density) : null,
    raw_signal_count: r.raw_signal_count != null ? Number(r.raw_signal_count) : null,
  }));
}

/** 論文数の時系列を全件取得 */
export async function fetchPapersLog(): Promise<PaperRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("papers_log")
    .select("lane, observed_at, paper_count, source")
    .order("observed_at", { ascending: true });
  if (error) {
    console.error("[fetchPapersLog]", error);
    return [];
  }
  return (data || []).map((r) => ({
    lane: r.lane as LaneId,
    observed_at: r.observed_at as string,
    paper_count: Number(r.paper_count),
    source: r.source as string,
  }));
}

/** 公開可な予兆シーズを取得 */
export async function fetchSeedsForMap(): Promise<SeedRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seeds")
    .select("id, title, description, origin_org, origin_pi, lane, trl, brl, hrl, status, is_public")
    .eq("is_public", true)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[fetchSeedsForMap]", error);
    return [];
  }
  return (data || []) as SeedRow[];
}

export interface XrlLogRow {
  id: string;
  venture_id: string;
  observed_at: string; // ISO date
  trl: number | null;
  brl: number | null;
  hrl: number | null;
  grl: number | null;
  srl: number | null;
  bottleneck: string | null;
  milestone_label: string | null;
}

/** SU個別ビュー用: venture_id の XRL 時系列を取得 */
export async function fetchXrlLog(ventureId: string): Promise<XrlLogRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ventures_xrl_log")
    .select("id, venture_id, observed_at, trl, brl, hrl, grl, srl, bottleneck, milestone_label")
    .eq("venture_id", ventureId)
    .order("observed_at", { ascending: true });
  if (error) {
    console.error("[fetchXrlLog]", error);
    return [];
  }
  return (data || []) as XrlLogRow[];
}

/** SU個別ビュー用: 1件の venture を取得 */
export async function fetchVentureById(id: string): Promise<VentureRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ventures")
    .select("id, display_name, short_label, lane, founded_at, status, outcome_pattern, origin_org, origin_pi, amd_role, short_description, is_public")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data as VentureRow;
}

export interface SnapshotData {
  lane: LaneId;
  macro: number;     // 0-1
  papers: number;    // 0-1
  policy: number;    // 0-1
  invest: number;    // 0-1 (投資データ未投入のため当面 macro と相関する仮値)
  seeds: number;     // 0-1
}

const ALL_LANES: LaneId[] = ["gx_energy", "gx_circular", "materials", "life", "robo"];

/** View B 用: 各レーンの最新指標を実データから組み立て */
export async function fetchSnapshot(
  macroLog: MacroIndexRow[],
  papersLog: PaperRow[],
  seeds: SeedRow[]
): Promise<SnapshotData[]> {
  // 各レーンの最新3ヶ月平均をマクロ指数として使う
  const byLaneMacro = new Map<LaneId, MacroIndexRow[]>();
  for (const r of macroLog) {
    if (!byLaneMacro.has(r.lane)) byLaneMacro.set(r.lane, []);
    byLaneMacro.get(r.lane)!.push(r);
  }
  for (const arr of byLaneMacro.values()) {
    arr.sort((a, b) => b.observed_at.localeCompare(a.observed_at));
  }

  // 論文数: 最新年の値を lane の max で正規化
  const latestPapersByLane = new Map<LaneId, number>();
  const maxPapersByLane = new Map<LaneId, number>();
  for (const r of papersLog) {
    maxPapersByLane.set(r.lane, Math.max(maxPapersByLane.get(r.lane) || 0, r.paper_count));
    const existing = latestPapersByLane.get(r.lane);
    const cur = existing == null ? -1 : existing;
    if (r.paper_count >= cur) {
      // 最新年を取る（ここでは observed_at 昇順なので末尾を取る方が綺麗だが配列順依存を避けるため year で判定）
    }
  }
  // 最新年だけ抽出
  const latestYearByLane = new Map<LaneId, { year: number; count: number }>();
  for (const r of papersLog) {
    const year = Number(r.observed_at.slice(0, 4));
    const cur = latestYearByLane.get(r.lane);
    if (!cur || year > cur.year) latestYearByLane.set(r.lane, { year, count: r.paper_count });
  }

  // シーズ在庫: lane × seeds 件数
  const seedCountByLane = new Map<LaneId, number>();
  let maxSeedCount = 0;
  for (const s of seeds) {
    if (!s.lane) continue;
    seedCountByLane.set(s.lane, (seedCountByLane.get(s.lane) || 0) + 1);
    maxSeedCount = Math.max(maxSeedCount, seedCountByLane.get(s.lane)!);
  }

  return ALL_LANES.map((lane) => {
    const recentMacro = (byLaneMacro.get(lane) || []).slice(0, 3);
    const macro = recentMacro.length
      ? recentMacro.reduce((a, b) => a + b.index_value, 0) / recentMacro.length
      : 0;
    const policy = recentMacro.length
      ? recentMacro.reduce((a, b) => a + (b.policy_density || 0), 0) / recentMacro.length
      : 0;

    const latest = latestYearByLane.get(lane);
    const max = maxPapersByLane.get(lane) || 1;
    const papers = latest ? Math.min(1, latest.count / max) : 0;

    const seedScore = maxSeedCount > 0 ? (seedCountByLane.get(lane) || 0) / Math.max(2, maxSeedCount) : 0;

    // 投資密度はデータソース未投入。当面はマクロと論文の中間値を仮置き
    const invest = (macro + papers) / 2;

    return {
      lane,
      macro,
      papers,
      policy,
      invest,
      seeds: seedScore,
    };
  });
}
