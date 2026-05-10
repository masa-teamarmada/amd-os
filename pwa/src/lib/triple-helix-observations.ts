/**
 * Triple Helix 観測モデル — 6 観測量 × 3 隠れ状態 (μ_A/I/G) の C 行列計算層。
 *
 * 正本:
 *   - before-zero/theory/state_space_model.md §4.1 (隠れ状態 / 観測量 / C 行列)
 *   - before-zero/theory/data_specification.md §3 (観測量の操作的定義)
 *   - before-zero/theory/bvar_prior.md §3.2 (C 行列 loading prior の数値)
 *
 * Phase 1 (本実装):
 *   - 観測量 N (論文): papers_log (lane × quarter、OpenAlex 経由) 取得済
 *   - 観測量 P (政策): atlas_signals.domain LIKE 'B.%' で件数集計 (全社共通、lane 区別なし)
 *   - 観測量 R (言及): atlas_signals.status='accepted' の総件数集計
 *   - 観測量 B/V/I_R/C_compete: 未取得 (Phase 2 以降)
 *
 * μ 計算 (Phase 1 簡易版):
 *   μ_x = Σ_p c_{xp} ỹ_p / Σ_p c_{xp}     (取れてる観測量だけで重み付き平均、結果は 0-9)
 *   ỹ_p = 9 (y_p - min) / (max - min)     (過去 16 quarter で min-max 正規化)
 *
 * Phase 3 で BVAR Kalman filter による隠れ状態推定に置き換える (state-space.ts と統合)。
 */

import { createClient } from "@/lib/supabase/server";

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
 * lane → atlas_signals.domain プレフィックスのマッピング (Phase 2-B)。
 * lane 個別の P (政策) / R (言及) を集計するため。
 *
 * - gx_energy: D.エネルギー
 * - gx_circular: O.サーキュラーエコノミー
 * - materials: C.素材・原料 + E.製造・プロセス技術
 * - life: F.バイオ・医療
 * - robo: G.モビリティ・ロボティクス + I.ICT・AI
 *
 * P は当該 lane domain ヒット OR source_type='policy' OR domain LIKE 'B.%' の OR で集計
 * (政府の政策動向は lane 横断的に μ_G に効くため、lane domain と汎用政策の両方を含める)。
 * R は lane domain ヒットのみ (純粋な lane 個別メディア言及)。
 */
const LANE_DOMAIN_PREFIXES: Record<string, string[]> = {
  gx_energy: ["D."],
  gx_circular: ["O."],
  materials: ["C.", "E."],
  life: ["F."],
  robo: ["G.", "I."],
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
  if (max === min) return 4.5; // 履歴に変動がない → 中央値
  return Math.max(0, Math.min(9, (9 * (value - min)) / (max - min)));
}

// =====================================================================
// Public: fetch + compute
// =====================================================================

export async function fetchTripleHelixComputed(lane: string): Promise<TripleHelixComputed> {
  const supabase = await createClient();

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
    .eq("lane", lane)
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

  // 3. P (政策密度): atlas_signals.source_type='policy' OR domain LIKE 'B.%' で quarter 集計
  // 4. R (言及): atlas_signals.source_type='news' で quarter 集計 (純粋なメディア言及)
  // 注: source_type は policy(125) / news(166) / report(10) など atlas-collect-policy cron で設定
  const { data: atlasData } = await supabase
    .from("atlas_signals")
    .select("submitted_at, domain, source_type")
    .eq("status", "accepted")
    .gte("submitted_at", earliestObservedAt);

  // 5. C_compete (競合密度): project_ventures から lane × quarter で生存中 PJ 数を計算
  //    操作的定義 (data_specification.md §C):
  //      C_lane(t) = #{ SU s : lane(s)=lane, alive(s, t) }
  //    alive 判定: founded_at <= quarter end かつ outcome_pattern NOT IN ('burnout', 'ue_fail')
  //                またはまだ AMD 支援中 (amd_support_ended_at IS NULL or >= quarter start)
  const { data: ventureData } = await supabase
    .from("project_ventures")
    .select("lane, founded_at, amd_support_started_at, amd_support_ended_at, outcome_pattern")
    .eq("lane", lane);

  const ventures = (ventureData ?? []) as {
    lane: string;
    founded_at: string | null;
    amd_support_started_at: string | null;
    amd_support_ended_at: string | null;
    outcome_pattern: string;
  }[];

  const cCompeteHistory: ObservationHistoryPoint[] = quarters.map((q) => {
    const qStart = q.observedAt;
    const qEnd = quarterStartDate(q.q === 4 ? q.year + 1 : q.year, q.q === 4 ? 1 : ((q.q + 1) as 1 | 2 | 3 | 4));
    let count = 0;
    for (const v of ventures) {
      // 創業前 (founded_at が null or > quarter end) は除外
      const founded = v.founded_at ?? v.amd_support_started_at;
      if (!founded || founded > qEnd) continue;
      // 死亡パターン (burnout / ue_fail) の場合、AMD 支援終了以降は除外
      const dead = v.outcome_pattern === "burnout" || v.outcome_pattern === "ue_fail";
      if (dead && v.amd_support_ended_at && v.amd_support_ended_at < qStart) continue;
      count++;
    }
    return { quarter: q.quarter, observed_at: q.observedAt, value: count };
  });

  const lanePrefixes = LANE_DOMAIN_PREFIXES[lane] ?? [];
  const inLane = (domain: string | null): boolean => {
    if (!domain) return false;
    return lanePrefixes.some((p) => domain.startsWith(p));
  };

  const pCountByQ = new Map<string, number>();
  const rCountByQ = new Map<string, number>();
  for (const r of (atlasData ?? []) as { submitted_at: string | null; domain: string | null; source_type: string | null }[]) {
    if (!r.submitted_at) continue;
    const { observedAt } = dateToQuarterStart(r.submitted_at);
    // P (政策密度): 政策ドキュメント (source_type='policy') OR 規制 domain (B.*) OR 当該 lane domain
    //   政府の政策動向は lane 横断的に μ_G に効くため、汎用政策 + lane 個別 政策 の両方をカウント
    const isPolicy = r.source_type === "policy" || (r.domain && r.domain.startsWith("B."));
    if (isPolicy || inLane(r.domain)) {
      // ただしニュース/レポートが lane domain にヒットしただけだと「政策」ではない
      // → policy/B. のときだけ P にカウント。lane domain hit は R 側へ流す
      if (isPolicy) {
        pCountByQ.set(observedAt, (pCountByQ.get(observedAt) ?? 0) + 1);
      }
    }
    // R (言及): 当該 lane の domain にヒットする news のみカウント (lane 個別メディア言及)
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

  // 5. 観測量データを組み立て (取れてないものは null)
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
    buildObs("B", null),
    buildObs("V", null),
    buildObs("R", rHistory),
    buildObs("I_R", null),
    buildObs("N", nHistory),
    buildObs("C_compete", cCompeteHistory),
  ].sort((a, b) => a.loading.display_order - b.loading.display_order);

  // 6. μ 計算: 取れてる観測量だけで重み付き平均
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
  const mu_a = weightA > 0 ? sumA / weightA : 0;
  const mu_i = weightI > 0 ? sumI / weightI : 0;
  const mu_g = weightG > 0 ? sumG / weightG : 0;
  const sigma_su = Math.cbrt((mu_a + 1) * (mu_i + 1) * (mu_g + 1)) - 1;

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
