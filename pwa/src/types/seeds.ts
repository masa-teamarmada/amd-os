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
  discovery_status: SeedDiscoveryStatus;
  // 監査
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

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
