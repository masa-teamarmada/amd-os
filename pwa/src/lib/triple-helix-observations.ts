/**
 * Triple Helix 観測モデル — 7 観測量 × 3 隠れ状態 (μ_A/I/G) の C 行列計算層。
 *
 * 正本:
 *   - before-zero/theory/state_space_model.md §4.1 (隠れ状態 / 観測量 / C 行列)
 *   - before-zero/theory/data_specification.md §3 (観測量の操作的定義)
 *   - before-zero/theory/bvar_prior.md §3.2 (C 行列 loading prior の数値)
 *   - pwa/design/aspi_lanes.md (lane = ASPI Critical Technology Tracker 8 domain、weighted 集計)
 *
 * Phase 2 (本実装):
 *   - 観測量 N (論文): papers_log (lane × quarter、OpenAlex 経由) ✅
 *   - 観測量 P (政策): atlas_signals.source_type='policy' OR domain LIKE 'B.%' で件数集計 ✅
 *   - 観測量 R (言及): atlas_signals.source_type='news' で lane domain hit のみ ✅
 *   - 観測量 B (公募予算): observation_log (key='B', source='grant') ✅ Phase 2-D で grant-ingest cron が書き込む
 *   - 観測量 V (VC 投資): observation_log (key='V', source='vc_news') ✅ Phase 2-E で vc-investment-ingest cron が書き込む
 *   - 観測量 I_R (研究費): observation_log (key='I_R', source='kaken') ✅ Phase 2-C で kaken-ingest cron が書き込む
 *   - 観測量 C_compete (競合密度): project_ventures.lanes (weighted) で alive count を按分集計 ✅
 *
 * μ 計算:
 *   μ_x = Σ_p c_{xp} ỹ_p / Σ_p c_{xp}     (取れてる観測量だけで重み付き平均、結果は 0-9)
 *   ỹ_p = 9 (y_p - min) / (max - min)     (過去 16 quarter で min-max 正規化)
 *
 * Phase 3 で BVAR Kalman filter による隠れ状態推定に置き換える (state-space.ts と統合)。
 */

import { createClient } from "@/lib/supabase/server";
import { type AspiDomainId, type LaneWeight, weightForDomain } from "@/lib/aspi-lanes";

export type TripleHelixObservationKey = "P" | "B" | "V" | "R" | "I_R" | "N" | "C_compete";

export interface TripleHelixLoading {
  observation: string;
  mu_a: number;
  mu_i: number;
  mu_g: number;
  description: string;
  unit: string;
  data_source: string;
  available: boolean;
  display_order: number;
}

export interface ObservationHistoryPoint {
  quarter: string; // "2025-Q3"
  observed_at: string; // "2025-07-01" (quarter 開始日)
  value: number;
}

export interface ObservationData {
  observation: string;
  loading: TripleHelixLoading;
  current_value: number | null;
  current_quarter: string | null;
  normalized: number | null; // 0-9
  history: ObservationHistoryPoint[];
  /** c_{xp} × ỹ_p (各 μ への寄与値) */
  contribution: { mu_a: number; mu_i: number; mu_g: number };
}

export interface TripleHelixComputed {
  lane: string;
  observations: ObservationData[];
  mu_a: number;
  mu_i: number;
  mu_g: number;
  /** σ_SU = ((μ_A+1)(μ_I+1)(μ_G+1))^(1/3) - 1 */
  sigma_su: number;
  coverage: { covered: number; total: number };
}

const QUARTERS_HISTORY = 16; // 直近 4 年分

/**
 * ASPI 8 domain → atlas_signals.domain プレフィックスのマッピング。
 * lane 個別の P (政策) / R (言及) を集計するため。
 *
 * atlas_signals.domain 既存 15 + 新規 3 カテゴリ:
 *   A.地政学・マクロ経済 / B.規制・政策 / C.素材・原料 / D.エネルギー / E.製造・プロセス /
 *   F.バイオ・医療 / G.モビリティ・ロボティクス / H.建築・インフラ / I.ICT・AI /
 *   J.宇宙・防衛 / K.食・農・水産 / L.金融・資本市場 / M.社会構造・社会課題 /
 *   N.海洋・水資源 / O.サーキュラーエコノミー /
 *   P.量子・量子計算 / Q.センシング・計測 / R.先端通信
 *
 * 2026-05-11: P/Q/R を追加し quantum / sensing_timing_navigation / advanced_ict を本格対応。
 */
const LANE_DOMAIN_PREFIXES: Record<AspiDomainId, string[]> = {
  advanced_ict: ["I.", "R."], // ICT・AI + 先端通信 (6G/衛星通信)
  advanced_materials_manufacturing: ["C.", "E."], // 素材・原料 + 製造・プロセス
  ai_technologies: ["I."], // ICT・AI (advanced_ict と重複、後で衝突解消は loading で吸収)
  biotechnology: ["F."], // バイオ・医療
  defence_space_robotics_transport: ["G.", "J."], // モビリティ・ロボティクス + 宇宙・防衛
  energy_environment: ["D.", "O.", "N."], // エネルギー + サーキュラー + 海洋・水資源 (波力等)
  quantum: ["P."], // 量子・量子計算
  sensing_timing_navigation: ["Q."], // センシング・計測・測位・タイミング
};

// =====================================================================
// Quarter helpers
// =====================================================================

function quarterStartDate(year: number, q: number): string {
  const month = (q - 1) * 3 + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function dateToQuarterStart(date: string): { year: number; q: number; observedAt: string; quarter: string } {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const q = Math.floor((month - 1) / 3) + 1;
  return {
    year,
    q,
    observedAt: quarterStartDate(year, q),
    quarter: `${year}-Q${q}`,
  };
}

function recentQuarters(n: number): { year: number; q: number; observedAt: string; quarter: string }[] {
  const now = new Date();
  let year = now.getUTCFullYear();
  let q: 1 | 2 | 3 | 4 = (Math.floor(now.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  const out: { year: number; q: number; observedAt: string; quarter: string }[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      year,
      q,
      observedAt: quarterStartDate(year, q),
      quarter: `${year}-Q${q}`,
    });
    q = (q - 1) as 1 | 2 | 3 | 4;
    if (q < 1) {
      q = 4;
      year -= 1;
    }
  }
  return out.reverse(); // 古い順
}

// =====================================================================
// Normalization
// =====================================================================

function minMaxNormalize(value: number, history: number[]): number {
  if (history.length === 0) return 0;
  const min = Math.min(...history);
  const max = Math.max(...history);
  if (max === min) return value === 0 ? 0 : 4.5;
  return Math.max(0, Math.min(9, (9 * (value - min)) / (max - min)));
}

// =====================================================================
// Public: fetch + compute
// =====================================================================

export async function fetchTripleHelixComputed(lane: string): Promise<TripleHelixComputed> {
  const supabase = await createClient();
  const aspiLane = lane as AspiDomainId;

  // 1. C 行列 loadings
  const { data: loadingsData } = await supabase
    .from("triple_helix_loading")
    .select("observation, mu_a, mu_i, mu_g, description, unit, data_source, available, display_order")
    .order("display_order", { ascending: true });

  const loadings = (loadingsData ?? []) as TripleHelixLoading[];
  const loadingByObs = new Map<string, TripleHelixLoading>();
  for (const l of loadings) loadingByObs.set(l.observation, l);

  const quarters = recentQuarters(QUARTERS_HISTORY);
  const earliestObservedAt = quarters[0]?.observedAt ?? "2022-01-01";

  // 2. N (論文): papers_log lane × quarter
  const { data: papersData } = await supabase
    .from("papers_log")
    .select("observed_at, paper_count")
    .eq("lane", aspiLane)
    .gte("observed_at", earliestObservedAt)
    .order("observed_at", { ascending: true });

  const papersByQ = new Map<string, number>();
  for (const r of (papersData ?? []) as { observed_at: string; paper_count: number }[]) {
    papersByQ.set(r.observed_at, r.paper_count);
  }
  const nHistory: ObservationHistoryPoint[] = quarters.map((q) => ({
    quarter: q.quarter,
    observed_at: q.observedAt,
    value: papersByQ.get(q.observedAt) ?? 0,
  }));

  // 3. P (政策密度) / 4. R (言及): atlas_signals から quarter 集計
  const { data: atlasData } = await supabase
    .from("atlas_signals")
    .select("submitted_at, domain, source_type")
    .eq("status", "accepted")
    .gte("submitted_at", earliestObservedAt);

  // 5. C_compete: project_ventures (全件) を取得して lanes 経由で domain 別 weighted count を計算
  const { data: ventureData } = await supabase
    .from("project_ventures")
    .select("project_id, lane, lanes, founded_at, amd_support_started_at, amd_support_ended_at, outcome_pattern");

  const ventures = (ventureData ?? []) as {
    project_id: string;
    lane: string | null;
    lanes: LaneWeight[] | null;
    founded_at: string | null;
    amd_support_started_at: string | null;
    amd_support_ended_at: string | null;
    outcome_pattern: string;
  }[];

  const cCompeteHistory: ObservationHistoryPoint[] = quarters.map((q) => {
    const qStart = q.observedAt;
    const qEnd = quarterStartDate(q.q === 4 ? q.year + 1 : q.year, q.q === 4 ? 1 : ((q.q + 1) as 1 | 2 | 3 | 4));
    let weightedCount = 0;
    for (const v of ventures) {
      const founded = v.founded_at ?? v.amd_support_started_at;
      if (!founded || founded > qEnd) continue;
      const dead = v.outcome_pattern === "burnout" || v.outcome_pattern === "ue_fail";
      if (dead && v.amd_support_ended_at && v.amd_support_ended_at < qStart) continue;
      // weighted contribution: 当該 domain への lane weight 分だけカウント
      const w = weightForDomain(v.lanes, aspiLane);
      weightedCount += w;
    }
    return {
      quarter: q.quarter,
      observed_at: q.observedAt,
      value: Math.round(weightedCount * 100) / 100,
    };
  });

  const lanePrefixes = LANE_DOMAIN_PREFIXES[aspiLane] ?? [];
  const inLane = (domain: string | null): boolean => {
    if (!domain) return false;
    return lanePrefixes.some((p) => domain.startsWith(p));
  };

  const pCountByQ = new Map<string, number>();
  const rCountByQ = new Map<string, number>();
  for (const r of (atlasData ?? []) as { submitted_at: string | null; domain: string | null; source_type: string | null }[]) {
    if (!r.submitted_at) continue;
    const { observedAt } = dateToQuarterStart(r.submitted_at);
    // P (政策密度): 政府の政策動向は lane 横断的に μ_G に効くため、汎用政策をカウント
    const isPolicy = r.source_type === "policy" || (r.domain && r.domain.startsWith("B."));
    if (isPolicy) {
      pCountByQ.set(observedAt, (pCountByQ.get(observedAt) ?? 0) + 1);
    }
    // R (言及): 当該 lane の domain にヒットする news のみ
    if (r.source_type === "news" && inLane(r.domain)) {
      rCountByQ.set(observedAt, (rCountByQ.get(observedAt) ?? 0) + 1);
    }
  }
  const pHistory: ObservationHistoryPoint[] = quarters.map((q) => ({
    quarter: q.quarter,
    observed_at: q.observedAt,
    value: pCountByQ.get(q.observedAt) ?? 0,
  }));
  const rHistory: ObservationHistoryPoint[] = quarters.map((q) => ({
    quarter: q.quarter,
    observed_at: q.observedAt,
    value: rCountByQ.get(q.observedAt) ?? 0,
  }));

  // 6. B / V / I_R: observation_log (Phase 2 で追加された統合観測量テーブル)
  const { data: obsLogData } = await supabase
    .from("observation_log")
    .select("lane, observed_at, observation_key, value")
    .eq("lane", aspiLane)
    .in("observation_key", ["B", "V", "I_R"])
    .gte("observed_at", earliestObservedAt);

  const obsLogByKey = new Map<string, Map<string, number>>(); // key → (observed_at → value)
  for (const r of (obsLogData ?? []) as { observed_at: string; observation_key: string; value: number }[]) {
    const m = obsLogByKey.get(r.observation_key) ?? new Map();
    m.set(r.observed_at, Number(r.value));
    obsLogByKey.set(r.observation_key, m);
  }

  const buildObsHistory = (key: string): ObservationHistoryPoint[] | null => {
    const m = obsLogByKey.get(key);
    if (!m || m.size === 0) return null;
    return quarters.map((q) => ({
      quarter: q.quarter,
      observed_at: q.observedAt,
      value: m.get(q.observedAt) ?? 0,
    }));
  };

  const bHistory = buildObsHistory("B");
  const vHistory = buildObsHistory("V");
  const iRHistory = buildObsHistory("I_R");

  // 7. 観測量データを組み立て (取れてないものは null)
  const buildObs = (key: string, history: ObservationHistoryPoint[] | null): ObservationData => {
    const loading = loadingByObs.get(key);
    if (!loading) {
      return {
        observation: key,
        loading: {
          observation: key,
          mu_a: 0,
          mu_i: 0,
          mu_g: 0,
          description: "(loading 未定義)",
          unit: "",
          data_source: "",
          available: false,
          display_order: 99,
        },
        current_value: null,
        current_quarter: null,
        normalized: null,
        history: history ?? [],
        contribution: { mu_a: 0, mu_i: 0, mu_g: 0 },
      };
    }
    if (!history || history.length === 0) {
      return {
        observation: key,
        loading,
        current_value: null,
        current_quarter: null,
        normalized: null,
        history: [],
        contribution: { mu_a: 0, mu_i: 0, mu_g: 0 },
      };
    }
    const last = history[history.length - 1];
    const values = history.map((h) => h.value);
    const normalized = minMaxNormalize(last.value, values);
    return {
      observation: key,
      loading,
      current_value: last.value,
      current_quarter: last.quarter,
      normalized,
      history,
      contribution: {
        mu_a: loading.mu_a * normalized,
        mu_i: loading.mu_i * normalized,
        mu_g: loading.mu_g * normalized,
      },
    };
  };

  const observations: ObservationData[] = [
    buildObs("P", pHistory),
    buildObs("B", bHistory),
    buildObs("V", vHistory),
    buildObs("R", rHistory),
    buildObs("I_R", iRHistory),
    buildObs("N", nHistory),
    buildObs("C_compete", cCompeteHistory),
  ].sort((a, b) => a.loading.display_order - b.loading.display_order);

  // 8. μ 計算: 取れてる観測量だけで重み付き平均 (Phase 1 簡易計算 = フォールバック)
  let sumA = 0,
    sumI = 0,
    sumG = 0;
  let weightA = 0,
    weightI = 0,
    weightG = 0;
  for (const o of observations) {
    if (o.normalized == null) continue;
    sumA += o.loading.mu_a * o.normalized;
    sumI += o.loading.mu_i * o.normalized;
    sumG += o.loading.mu_g * o.normalized;
    weightA += o.loading.mu_a;
    weightI += o.loading.mu_i;
    weightG += o.loading.mu_g;
  }
  let mu_a = weightA > 0 ? sumA / weightA : 0;
  let mu_i = weightI > 0 ? sumI / weightI : 0;
  let mu_g = weightG > 0 ? sumG / weightG : 0;
  let sigma_su = Math.cbrt((mu_a + 1) * (mu_i + 1) * (mu_g + 1)) - 1;

  // 9. Phase 3: triple_helix_state_log (BVAR Kalman smoother 結果) を優先表示。
  //    最新 quarter 行 (lane, observed_at の最新) があれば Phase 1 を上書きする。
  //    無ければ Phase 1 簡易計算をそのまま使う。
  const { data: stateRow } = await supabase
    .from("triple_helix_state_log")
    .select("mu_a, mu_i, mu_g, sigma_su, observed_at")
    .eq("lane", aspiLane)
    .order("observed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (stateRow) {
    mu_a = Number(stateRow.mu_a) || 0;
    mu_i = Number(stateRow.mu_i) || 0;
    mu_g = Number(stateRow.mu_g) || 0;
    sigma_su = Number(stateRow.sigma_su) || Math.cbrt((mu_a + 1) * (mu_i + 1) * (mu_g + 1)) - 1;
  }

  const covered = observations.filter((o) => o.normalized != null).length;
  const total = observations.length;

  return {
    lane,
    observations,
    mu_a,
    mu_i,
    mu_g,
    sigma_su,
    coverage: { covered, total },
  };
}
