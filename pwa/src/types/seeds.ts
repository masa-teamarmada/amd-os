// Seeds (研究シーズリスト) 関連の型定義
// migration: scripts/migrations/024_seeds_overhaul.sql
// 設計: pwa/design/seeds.md

export type SeedStatus =
  | "candidate"      // 候補
  | "investigating"  // 調査中
  | "contacted"      // 接触済
  | "discussing"     // 協議中
  | "spun_off"       // PJ化
  | "declined";      // 見送り

export type SeedDiscoveryStatus =
  | "reviewed"     // 人が確認済 (デフォルト)
  | "discovered"   // cron が新規発見、未確認
  | "dismissed";   // ノイズ扱い

export type SeedOrgType =
  | "university"
  | "national_lab"
  | "kosen"
  | "private_lab"
  | "other";

export type SeedDomainLane =
  | "gx_energy"
  | "gx_circular"
  | "life"
  | "materials"
  | "robo"
  | "ict"
  | "other";

export type SeedSource =
  | "introduction"
  | "web_search"
  | "conference"
  | "referral"
  | "cold"
  | "grant_db"
  | "researchmap"
  | "other";

export type SeedFundingStatus =
  | "awarded"
  | "ongoing"
  | "completed"
  | "rejected"
  | "pending";

export type SeedNewsKind =
  | "publication"
  | "press"
  | "grant"
  | "patent"
  | "event"
  | "other";

export type SeedNewsIngestSource =
  | "manual"
  | "tsukuyomi"
  | "web_search_cron";

export type SeedContactMethod =
  | "email"
  | "phone"
  | "meeting"
  | "event"
  | "referral"
  | "visit"
  | "other";

// KUTE 等の事業化面談向け事業化タイプ (主 + 副、複数可)
// migration: scripts/migrations/186_kute_seeds_commercialization_score.sql
export type SeedCommercializationType =
  | "large_startup"          // 大型スタートアップ
  | "small_business_1b_yen"  // 10億円級スモールビジネス
  | "license"                // ライセンス
  | "jv_ma"                  // JV/M&A
  | "joint_research_poc";    // 共同研究/PoC

export type SeedKuteMarketSizeConfidence = "low" | "medium" | "high";

export interface Seed {
  id: string;
  // 識別
  title: string;
  summary: string | null;
  // 機関
  org_name: string;
  org_type: SeedOrgType | null;
  org_region: string | null;
  org_url: string | null;
  // 研究者
  researcher_name: string | null;
  researcher_title: string | null;
  lab_name: string | null;
  researcher_url: string | null;
  // 分類
  domain_lane: SeedDomainLane | null;
  industry_target: string[] | null;
  keywords: string[] | null;
  // 成熟度
  trl: number | null;
  brl: number | null;
  hrl: number | null;
  // AMD 視点
  status: SeedStatus;
  amd_rating: number | null;
  amd_rating_note: string | null;
  amd_owner_member_id: string | null;
  next_action: string | null;
  internal_notes: string | null;
  public_summary: string | null;
  is_public: boolean;
  // 関連
  spun_off_project_id: string | null;
  source: SeedSource | null;
  source_detail: string | null;
  deep_dive_material_url: string | null;
  discovery_status: SeedDiscoveryStatus;
  // 事業化タイプ (主 + 副)
  primary_commercialization_type: SeedCommercializationType | null;
  secondary_commercialization_types: SeedCommercializationType[] | null;
  // KUTE 公開面向け項目 (internal_notes / source_detail とは別、外部に見せてよい内容のみ)
  kute_envisioned_use_case: string | null;
  kute_first_customer_candidate: string | null;
  kute_market_size_range: string | null;
  kute_market_size_confidence: SeedKuteMarketSizeConfidence | null;
  kute_biggest_bottleneck: string | null;
  kute_ip_status: string | null;
  kute_next_verification_step: string | null;
  // 100点スコア内訳 (future 60 = need/market/technical_advantage/ip_barrier 各15、current 30 = trl/brl/hrl 各10、support 10)
  kute_score_future_need: number | null;
  kute_score_future_market: number | null;
  kute_score_future_technical_advantage: number | null;
  kute_score_future_ip_barrier: number | null;
  kute_score_current_trl: number | null;
  kute_score_current_brl: number | null;
  kute_score_current_hrl: number | null;
  kute_score_support: number | null;
  // 監査
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

/**
 * KUTE 等の外部研究機関向け公開面で安全に見せてよいフィールドのみのビュー。
 * internal_notes / source_detail / amd_rating_note / amd_owner_member_id 等は含めない。
 */
export interface SeedPublicView {
  id: string;
  title: string;
  summary: string | null;
  org_name: string;
  researcher_name: string | null;
  researcher_title: string | null;
  lab_name: string | null;
  domain_lane: SeedDomainLane | null;
  trl: number | null;
  brl: number | null;
  hrl: number | null;
  deep_dive_material_url: string | null;
  primary_commercialization_type: SeedCommercializationType | null;
  secondary_commercialization_types: SeedCommercializationType[] | null;
  kute_envisioned_use_case: string | null;
  kute_first_customer_candidate: string | null;
  kute_market_size_range: string | null;
  kute_market_size_confidence: SeedKuteMarketSizeConfidence | null;
  kute_biggest_bottleneck: string | null;
  kute_ip_status: string | null;
  kute_next_verification_step: string | null;
  kute_score_future_need: number | null;
  kute_score_future_market: number | null;
  kute_score_future_technical_advantage: number | null;
  kute_score_future_ip_barrier: number | null;
  kute_score_current_trl: number | null;
  kute_score_current_brl: number | null;
  kute_score_current_hrl: number | null;
  kute_score_support: number | null;
}

/** SeedPublicView の select 用ホワイトリスト列 (internal_notes / source_detail 等を含めない) */
export const SEED_PUBLIC_VIEW_COLUMNS = [
  "id",
  "title",
  "summary",
  "org_name",
  "researcher_name",
  "researcher_title",
  "lab_name",
  "domain_lane",
  "trl",
  "brl",
  "hrl",
  "deep_dive_material_url",
  "primary_commercialization_type",
  "secondary_commercialization_types",
  "kute_envisioned_use_case",
  "kute_first_customer_candidate",
  "kute_market_size_range",
  "kute_market_size_confidence",
  "kute_biggest_bottleneck",
  "kute_ip_status",
  "kute_next_verification_step",
  "kute_score_future_need",
  "kute_score_future_market",
  "kute_score_future_technical_advantage",
  "kute_score_future_ip_barrier",
  "kute_score_current_trl",
  "kute_score_current_brl",
  "kute_score_current_hrl",
  "kute_score_support",
] as const;

export interface SeedFunding {
  id: string;
  seed_id: string;
  program: string;
  program_short: string | null;
  amount_jpy: number | null;
  fiscal_year: number | null;
  status: SeedFundingStatus | null;
  source_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeedNews {
  id: string;
  seed_id: string;
  kind: SeedNewsKind;
  title: string;
  body: string | null;
  occurred_on: string | null;
  source_url: string | null;
  ingested_by: SeedNewsIngestSource;
  verified: boolean;
  dismissed: boolean;
  created_at: string;
  updated_at: string;
}

export interface SeedContactLog {
  id: string;
  seed_id: string;
  contacted_on: string;
  method: SeedContactMethod | null;
  amd_member_id: string | null;
  note: string;
  next_action: string | null;
  created_at: string;
  updated_at: string;
}

// 集約ビュー用 (リスト画面)

export interface SeedListItem extends Seed {
  funding_count: number;       // 採択補助金件数
  funding_total_jpy: number;   // 採択補助金合計
  funding_programs: { program: string; year: number | null }[];  // 採択プログラム short 名 + 年度 (年度 desc 順、program で重複排除)
  news_count: number;          // ニュース件数
  contact_log_count: number;   // 接触履歴件数
  last_contacted_on: string | null;  // 最終接触日
  amd_owner_code_name: string | null;  // AMD 担当者の code_name
  spun_off_project_name: string | null;  // PJ 化されてる場合の PJ 名
}

export interface SeedDetail {
  seed: Seed;
  funding: SeedFunding[];
  news: SeedNews[];
  contact_log: (SeedContactLog & { amd_member_code_name?: string | null })[];
  amd_owner_code_name: string | null;
  spun_off_project_name: string | null;
}
