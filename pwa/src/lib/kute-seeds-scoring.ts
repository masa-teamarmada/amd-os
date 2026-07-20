// KUTE (PJ cockpit) 向け公開面の純粋ロジック — I/O (Supabase client) を持たないため
// node --experimental-strip-types から直接 import してテストできる。
// data-access 層 (seeds-data.ts) はこのファイルを re-export する。

import type { SeedPublicView } from "../types/seeds.ts";

/**
 * project_id → seeds.org_name の研究機関スコープ対応。
 * KUTE 以外の研究機関コックピットも、この境界へ1行追加して同じ取得経路を再利用する。
 */
const RESEARCH_INSTITUTION_SEED_ORG_SCOPE: Record<string, string> = {
  p25: "工学院大学",
};

/** 対象PJで Global Seeds から読む研究機関名。未定義PJは null */
export function researchInstitutionSeedsOrgNameForProject(projectId: string): string | null {
  return RESEARCH_INSTITUTION_SEED_ORG_SCOPE[projectId] ?? null;
}

export interface KuteSeedScoreGroup {
  fields: (number | null)[];
  max: number;
  subtotal: number | null; // グループ内の全項目が評価済みのときだけ合計。欠けがあれば null
  filledCount: number;
  totalCount: number;
}

export interface KuteSeedScore {
  future: KuteSeedScoreGroup; // need + market + technical_advantage + ip_barrier (各15, 計60)
  current: KuteSeedScoreGroup; // trl + brl + hrl (各10, 計30)
  support: KuteSeedScoreGroup; // kute_support (計10)
  total: number | null; // 8項目すべてが評価済みのときだけ総合点。欠けがあれば null
  filledCount: number;
  totalCount: number; // 常に 8
}

function scoreGroup(fields: (number | null)[], maxEach: number): KuteSeedScoreGroup {
  const filled = fields.filter((v): v is number => v != null);
  return {
    fields,
    max: maxEach * fields.length,
    subtotal: filled.length === fields.length ? filled.reduce((a, b) => a + b, 0) : null,
    filledCount: filled.length,
    totalCount: fields.length,
  };
}

/** SeedPublicView の kute_score_* 列から 100点スコア内訳を組み立てる。捏造せず、未確定は null のまま */
export function computeKuteSeedScore(seed: Pick<SeedPublicView,
  | "kute_score_future_need"
  | "kute_score_future_market"
  | "kute_score_future_technical_advantage"
  | "kute_score_future_ip_barrier"
  | "kute_score_current_trl"
  | "kute_score_current_brl"
  | "kute_score_current_hrl"
  | "kute_score_support"
>): KuteSeedScore {
  const future = scoreGroup(
    [seed.kute_score_future_need, seed.kute_score_future_market, seed.kute_score_future_technical_advantage, seed.kute_score_future_ip_barrier],
    15
  );
  const current = scoreGroup(
    [seed.kute_score_current_trl, seed.kute_score_current_brl, seed.kute_score_current_hrl],
    10
  );
  const support = scoreGroup([seed.kute_score_support], 10);
  const filledCount = future.filledCount + current.filledCount + support.filledCount;
  const total = filledCount === 8
    ? (future.subtotal ?? 0) + (current.subtotal ?? 0) + (support.subtotal ?? 0)
    : null;
  return { future, current, support, total, filledCount, totalCount: 8 };
}

export const SEED_COMMERCIALIZATION_TYPE_LABEL: Record<string, string> = {
  large_startup: "大型スタートアップ",
  small_business_1b_yen: "10億円級スモールビジネス",
  license: "ライセンス",
  jv_ma: "JV/M&A",
  joint_research_poc: "共同研究/PoC",
};

export const SEED_COMMERCIALIZATION_TYPE_ORDER: string[] = [
  "large_startup",
  "small_business_1b_yen",
  "license",
  "jv_ma",
  "joint_research_poc",
];

export const SEED_KUTE_MARKET_CONFIDENCE_LABEL: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
};
