// KUTE (PJ cockpit) 向け公開面の純粋ロジック — I/O (Supabase client) を持たないため
// node --experimental-strip-types から直接 import してテストできる。
// data-access 層 (seeds-data.ts) はこのファイルを re-export する。

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

// 旧 100点ルーブリック (kute_score_* 8列 + computeKuteSeedScore) は
// migration 187 で全国共通の seed_sps_assessments (SPS = M・P・R・S) に置き換えた。
// スコア計算は pwa/src/lib/seed-sps.ts の calculateSeedSpsScore に一本化。

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
