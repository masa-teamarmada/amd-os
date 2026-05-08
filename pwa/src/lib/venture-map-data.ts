/**
 * Venture Map データアクセス層
 * Server Component から Supabase の project_ventures / macro_lane_weights を読む。
 *
 * macro_index_log / papers_log は Phase 4/5 で実データ投入後に追加する。
 * それまでは VentureMapView 側のハードコード SERIES を使う。
 *
 * 旧 seeds (Venture Map 予兆プロット用 4 件) は 024_seeds_overhaul で破棄され、
 * シーズリスト本体に再構築された (pwa/design/seeds.md)。
 */

import { createClient } from "@/lib/supabase/server";

export type LaneId = "gx_energy" | "gx_circular" | "materials" | "life" | "robo";

export type OutcomePattern = "rocket" | "lifted" | "deep_pivot" | "burnout" | "ue_fail";

export interface VentureRow {
  /** projects.project_id (例: 'p03', 'p11')。旧 ventures.id ('tiem' 等) は廃止済み (008 migration) */
  project_id: string;
  display_name: string;
  short_label: string | null;
  lane: LaneId;
  founded_at: string | null; // ISO date (pre-founding は null)
  status: string;            // projects.status 由来 ('active' | 'sales' | 'ended' | 'frozen' | 'lost')
  outcome_pattern: OutcomePattern;
  origin_org: string | null;
  origin_pi: string | null;
  amd_role: string | null;
  short_description: string | null;
  is_public: boolean;
  amd_support_started_at: string | null; // AMD 支援開始 (背景帯の左端)
  amd_support_ended_at: string | null;   // AMD 支援終了 (null = 継続中)
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

type RawVentureRow = {
  project_id: string;
  display_name: string;
  short_label: string | null;
  lane: LaneId;
  founded_at: string | null;
  outcome_pattern: OutcomePattern;
  origin_org: string | null;
  origin_pi: string | null;
  amd_role: string | null;
  short_description: string | null;
  is_public: boolean;
  amd_support_started_at: string | null;
  amd_support_ended_at: string | null;
  projects: { status: string } | { status: string }[] | null;
};

function flattenVentureRow(r: RawVentureRow): VentureRow {
  const project = Array.isArray(r.projects) ? r.projects[0] : r.projects;
  return {
    project_id: r.project_id,
    display_name: r.display_name,
    short_label: r.short_label,
    lane: r.lane,
    founded_at: r.founded_at,
    status: project?.status ?? "active",
    outcome_pattern: r.outcome_pattern,
    origin_org: r.origin_org,
    origin_pi: r.origin_pi,
    amd_role: r.amd_role,
    short_description: r.short_description,
    is_public: r.is_public,
    amd_support_started_at: r.amd_support_started_at,
    amd_support_ended_at: r.amd_support_ended_at,
  };
}

const VENTURE_SELECT =
  "project_id, display_name, short_label, lane, founded_at, outcome_pattern, origin_org, origin_pi, amd_role, short_description, is_public, amd_support_started_at, amd_support_ended_at, projects(status)";

/** 公開可な PJ (SU 系) を全件、設立日昇順で取得 */
export async function fetchVenturesForMap(): Promise<VentureRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_ventures")
    .select(VENTURE_SELECT)
    .eq("is_public", true)
    .order("founded_at", { ascending: true, nullsFirst: false });
  if (error) {
    console.error("[fetchVenturesForMap]", error);
    return [];
  }
  return (data || []).map((r) => flattenVentureRow(r as unknown as RawVentureRow));
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

export interface XrlLogRow {
  id: string;
  project_id: string;
  observed_at: string; // ISO date
  trl: number | null;
  brl: number | null;
  hrl: number | null;
  grl: number | null;
  srl: number | null;
  bottleneck: string | null;
  milestone_label: string | null;
}

/** PJ コックピット用: project_id の XRL 時系列を取得 */
export async function fetchXrlLog(projectId: string): Promise<XrlLogRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_xrl_log")
    .select("id, project_id, observed_at, trl, brl, hrl, grl, srl, bottleneck, milestone_label")
    .eq("project_id", projectId)
    .order("observed_at", { ascending: true });
  if (error) {
    console.error("[fetchXrlLog]", error);
    return [];
  }
  return (data || []) as XrlLogRow[];
}

/** Timeline 3D 用: 全 SU 系 PJ と XRL 時系列をまとめて取得 (1 PJ = 1 折れ線) */
export async function fetchAllVenturesWithXrl(opts?: {
  activeOnly?: boolean;
}): Promise<{ venture: VentureRow; xrl: XrlLogRow[] }[]> {
  const supabase = await createClient();

  const { data: rawRows, error: vErr } = await supabase
    .from("project_ventures")
    .select(VENTURE_SELECT)
    .eq("is_public", true)
    .order("founded_at", { ascending: true, nullsFirst: false });

  if (vErr || !rawRows) {
    console.error("[fetchAllVenturesWithXrl] project_ventures", vErr);
    return [];
  }

  const ventures = (rawRows as unknown as RawVentureRow[]).map(flattenVentureRow);

  const filtered = ventures.filter((v) => {
    if (!opts?.activeOnly) return true;
    return v.status === "active";
  });

  if (filtered.length === 0) return [];

  const ids = filtered.map((v) => v.project_id);
  const { data: xrlRows, error: xErr } = await supabase
    .from("project_xrl_log")
    .select("id, project_id, observed_at, trl, brl, hrl, grl, srl, bottleneck, milestone_label")
    .in("project_id", ids)
    .order("observed_at", { ascending: true });

  if (xErr) {
    console.error("[fetchAllVenturesWithXrl] xrl_log", xErr);
  }

  const byProject = new Map<string, XrlLogRow[]>();
  for (const row of (xrlRows || []) as XrlLogRow[]) {
    if (!byProject.has(row.project_id)) byProject.set(row.project_id, []);
    byProject.get(row.project_id)!.push(row);
  }

  return filtered.map((venture) => ({
    venture,
    xrl: byProject.get(venture.project_id) || [],
  }));
}

/** PJ 個別ビュー用: 1 件の SU 系 PJ を取得 */
export async function fetchVentureById(projectId: string): Promise<VentureRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_ventures")
    .select(VENTURE_SELECT)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error || !data) return null;
  return flattenVentureRow(data as unknown as RawVentureRow);
}

export interface SnapshotData {
  lane: LaneId;
  macro: number;     // 0-1
  papers: number;    // 0-1
  policy: number;    // 0-1
  invest: number;    // 0-1 (投資データ未投入のため当面 macro と相関する仮値)
}

const ALL_LANES: LaneId[] = ["gx_energy", "gx_circular", "materials", "life", "robo"];

/** View B 用: 各レーンの最新指標を実データから組み立て */
export async function fetchSnapshot(
  macroLog: MacroIndexRow[],
  papersLog: PaperRow[]
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

    // 投資密度はデータソース未投入。当面はマクロと論文の中間値を仮置き
    const invest = (macro + papers) / 2;

    return {
      lane,
      macro,
      papers,
      policy,
      invest,
    };
  });
}
