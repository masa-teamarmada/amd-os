// Seeds (研究シーズリスト) 関連の型定義
// migration: scripts/migrations/024_seeds_overhaul.sql
// 設計: pwa/design/seeds.md

export type SeedStatus =
  | "candidate"      // 候補
  | "investigating"  // 調査中
  | "contacted"      // 接触済
  | "discussing"     // 協議中
  | "spun_off"       // スピンアウト/法人化済み。AMD PJとの関係とは別
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
  | "slack"
  | "teams"
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

export type SeedMarketSizeConfidence = "low" | "medium" | "high";

// 全国全研究機関共通のシーズ SPS (M・P・R・S) 時系列評価
// migration: scripts/migrations/187_seed_sps_assessments.sql
// 計算式は pwa/src/lib/seed-sps.ts (calculatePrsScore / PRS_ALPHA_DEFAULT の再利用) に一本化
export type SeedSpsAssessmentStatus = "draft" | "ready" | "incomplete" | "reviewed";

export interface SeedSpsAssessment {
  id: string;
  seed_id: string;
  evaluated_at: string;
  mu_a: number | null;
  mu_i: number | null;
  mu_g: number | null;
  potential: number | null;
  trl: number | null;
  brl: number | null;
  grl: number | null;
  srl: number | null;
  hrl: number | null;
  f_character: number | null;
  f_cap: number | null;
  frl: number | null;
  r_net: number | null;
  shallow_tech_mode: boolean;
  status: SeedSpsAssessmentStatus;
  confidence: SeedMarketSizeConfidence | null;
  axis_evidence: Record<string, unknown> | null;
  missing_axes: string[] | null;
  evaluator: string | null;
  created_at: string;
  updated_at: string;
}

/** 公開面向けに安全な R (Reach) 生軸。TRL/BRL/GRL/SRL/HRL の 0-9 値のみ (evidence は含まない) */
export interface SeedPublicSpsAxes {
  trl: number | null;
  brl: number | null;
  grl: number | null;
  srl: number | null;
  hrl: number | null;
}

/** 公開面向けに安全な SPS 内訳 (M・P・R・S の計算済みコンポーネント値) */
export interface SeedPublicSpsComponents {
  macro: number;
  potential: number;
  reach: number;
  survival: number;
}

/** 公開面向けに安全な SPS サマリ (axis_evidence / evaluator は絶対に含めない) */
export interface SeedPublicSpsAssessment {
  evaluated_at: string;
  status: "ready" | "missing";
  score: number | null;
  confidence: SeedMarketSizeConfidence | null;
  missing_axes: string[];
  axes: SeedPublicSpsAxes;
  components: SeedPublicSpsComponents | null;
}

// 一次選別のスクリーニング帯 (Tier 0) — seed_sps_assessments (本測定系) とは別テーブル。
// migration: scripts/migrations/280_seed_screening_infrastructure.sql
// 設計正本: bzm/BZM_SEED_TIER0_SCREENING_DESIGN_2026-08-15.md
// テーブル seed_screening_bands は RLS ポリシーなし = service_role 専用。
// このファイルの型は API route (/api/seeds/screening-bands) 経由の DTO 用で、
// クライアントコンポーネントから直接テーブルへは触れない。
// 根拠Lv (スコア成熟度) は §6 確定13 の定義どおり DB から機械導出する。
export type SeedEvidenceLevel = 0 | 1 | 2 | 3;

/** 一次選別のスクリーニング帯 11 要因ルーブリックの根拠引用 1 件分 */
export interface SeedScreeningQEvidenceItem {
  id: number | string;
  name: string;
  direction: string;
  evidence: string;
  assessment?: string;
}

/** /seeds 一覧向け: 帯の最新行から表示に必要な値だけを持つ軽量サマリ (q_evidence の全文は含めない) */
export interface SeedScreeningBandSummary {
  assessment_id: string | null;
  seed_id: string;
  /** 現行SPSの価値尺度。現行DTOでは sps-ind-v1 以外を返さない。 */
  measure_version: "sps-ind-v1" | null;
  sps_lower_yen: number | null;
  sps_upper_yen: number | null;
  assessed_at: string | null;
  ruleset_version: string | null;
  frozen: boolean;
  evidence_level: SeedEvidenceLevel;
}

/** シーズ詳細モーダル向け: 帯の最新行の全項目 + 根拠Lv */
export interface SeedScreeningBandDetail extends SeedScreeningBandSummary {
  evaluator: string;
  /** 'sps-ind-v1' (産業創出価値版・現行) 固定。旧 'sps-eq-v0' (持分価値版) 行はOS非表示のためこのDTOには出てこない */
  measure_version: "sps-ind-v1";
  stage_lower: string | null;
  stage_upper: string | null;
  stage_tag: string | null;
  q_lower_pct: number | null;
  q_upper_pct: number | null;
  q_main_factor: string | null;
  q_evidence: SeedScreeningQEvidenceItem[] | null;
  p_class: string | null;
  p_lower_yen: number | null;
  p_upper_yen: number | null;
  /** P^ind 帯をその桁に置いた判断理由 (一行)。判断層方式には閉じた式が無いので、これが唯一の算出根拠 */
  p_rationale: string | null;
  /** 外需 (国外へ出る度合い) の属性。'高' | '中' | '低' | 'なし' */
  p_external_demand: string | null;
  /** 判断を記録した bzm の md ファイル名 */
  p_basis_doc: string | null;
  notes: string | null;
}

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
  /** 研究機関カタログの正本FK。org_name は表示・旧互換用。 */
  institution_id: string | null;
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
  /** @deprecated AMD PJ関係の正本は seed_projects。既存データ互換のためだけに保持。 */
  spun_off_project_id: string | null;
  source: SeedSource | null;
  source_detail: string | null;
  deep_dive_material_url: string | null;
  discovery_status: SeedDiscoveryStatus;
  // 事業化タイプ (主 + 副)
  primary_commercialization_type: SeedCommercializationType | null;
  secondary_commercialization_types: SeedCommercializationType[] | null;
  // 公開面向け事業化詳細 (internal_notes / source_detail とは別、外部に見せてよい内容のみ)
  // migration 186 の kute_* から全国共通名へ改名 (187)
  envisioned_use_case: string | null;
  first_customer_candidate: string | null;
  market_size_range: string | null;
  market_size_confidence: SeedMarketSizeConfidence | null;
  biggest_bottleneck: string | null;
  ip_status: string | null;
  next_verification_step: string | null;
  // 監査
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface SeedProjectLink {
  project_id: string;
  project_name: string;
  project_status: string;
  commercialization_stage: string | null;
  commercialization_route: string | null;
  venture_name: string | null;
  target_market: string | null;
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
  institution_id: string | null;
  researcher_name: string | null;
  researcher_title: string | null;
  lab_name: string | null;
  domain_lane: SeedDomainLane | null;
  /** シーズ自体の状態。AMD PJの有無とは独立。 */
  status: SeedStatus;
  /** 公開情報からの未確認候補か、人が台帳上で確認済みかを研究機関面でも区別する */
  discovery_status: SeedDiscoveryStatus;
  trl: number | null;
  brl: number | null;
  hrl: number | null;
  deep_dive_material_url: string | null;
  primary_commercialization_type: SeedCommercializationType | null;
  secondary_commercialization_types: SeedCommercializationType[] | null;
  envisioned_use_case: string | null;
  first_customer_candidate: string | null;
  market_size_range: string | null;
  market_size_confidence: SeedMarketSizeConfidence | null;
  biggest_bottleneck: string | null;
  ip_status: string | null;
  next_verification_step: string | null;
  /** 最新の SPS 評価サマリ。評価が一件も無い場合は null */
  latest_sps: SeedPublicSpsAssessment | null;
  /** AMDとのシーズ事業化PJ。seed_projects から合成し、カタログ行に重ねて表示する。 */
  project_links: SeedProjectLink[];
}

/** SeedPublicView の select 用ホワイトリスト列 (internal_notes / source_detail 等を含めない) */
export const SEED_PUBLIC_VIEW_COLUMNS = [
  "id",
  "title",
  "summary",
  "org_name",
  "institution_id",
  "researcher_name",
  "researcher_title",
  "lab_name",
  "domain_lane",
  "status",
  "discovery_status",
  "trl",
  "brl",
  "hrl",
  "deep_dive_material_url",
  "primary_commercialization_type",
  "secondary_commercialization_types",
  "envisioned_use_case",
  "first_customer_candidate",
  "market_size_range",
  "market_size_confidence",
  "biggest_bottleneck",
  "ip_status",
  "next_verification_step",
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
  spun_off_project_name: string | null;  // 旧互換: spun_off_project_id の PJ 名
  project_links: SeedProjectLink[];
}

export interface SeedDetail {
  seed: Seed;
  funding: SeedFunding[];
  news: SeedNews[];
  contact_log: (SeedContactLog & { amd_member_code_name?: string | null })[];
  amd_owner_code_name: string | null;
  spun_off_project_name: string | null; // 旧互換
  project_links: SeedProjectLink[];
}
