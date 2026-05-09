// VC List 関連の型定義
// migration: scripts/migrations/016_vc_list.sql

export type VcType = "independent" | "cvc" | "gov" | "corporate" | "overseas";

export type VcFundStatus =
  | "raising"
  | "first_closed"
  | "final_closed"
  | "investing"
  | "harvesting"
  | "closed"
  | "unknown";

export type DryPowderSource =
  | "estimated"
  | "heard_from_contact"
  | "public_disclosure";

export type ProjectVcStatus =
  | "not_contacted"
  | "pitching"
  | "evaluating"
  | "dd"
  | "term_sheet"
  | "invested"
  | "passed"
  | "declined";

export type VcNewsKind =
  | "fundraise"
  | "investment"
  | "personnel"
  | "fund_close"
  | "thesis_change"
  | "press"
  | "other";

export type VcNewsIngestSource =
  | "manual"
  | "tsukuyomi"
  | "web_search_cron";

export type VcRound =
  | "pre_seed"
  | "seed"
  | "series_a"
  | "series_b"
  | "series_c"
  | "series_d"
  | "bridge"
  | "growth"
  | "unknown";

export interface Vc {
  id: string;
  name: string;
  name_en: string | null;
  slug: string | null;
  type: VcType | null;
  thesis: string | null;
  stage_focus: string[] | null;
  ticket_min_jpy: number | null;
  ticket_max_jpy: number | null;
  hq: string | null;
  website: string | null;
  logo_url: string | null;
  notes: string | null;
  investment_constraints: string | null;   // 分野限定 / val 固定 / 初回ラウンドのみ 等
  amd_rating: number | null;          // 1-5
  amd_rating_note: string | null;
  amd_rating_updated_by: string | null;
  amd_rating_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VcFund {
  id: string;
  vc_id: string;
  fund_no: number;
  name: string | null;
  size_jpy: number | null;
  size_jpy_low: number | null;
  size_jpy_high: number | null;
  vintage_year: number | null;
  status: VcFundStatus;
  first_close_at: string | null;
  final_close_at: string | null;
  target_close_at: string | null;
  dry_powder_jpy_low: number | null;
  dry_powder_jpy_high: number | null;
  dry_powder_source: DryPowderSource | null;
  dry_powder_heard_from: string | null;
  dry_powder_note: string | null;
  dry_powder_updated_at: string | null;
  source_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VcInvestment {
  id: string;
  vc_id: string;
  fund_id: string | null;
  target_company: string;
  target_company_en: string | null;
  our_project_id: string | null;
  amount_jpy: number | null;
  round: VcRound | null;
  invested_at: string | null;
  is_lead: boolean;
  source_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VcContact {
  id: string;
  vc_id: string;
  name: string;
  name_en: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectVcRelation {
  id: string;
  project_id: string;
  vc_id: string;
  vc_contact_id: string | null;
  amd_owner_member_id: string | null;
  status: ProjectVcStatus;
  first_contact_at: string | null;
  last_touch_at: string | null;
  expected_amount_jpy: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VcNews {
  id: string;
  vc_id: string;
  kind: VcNewsKind;
  title: string;
  body: string | null;
  occurred_on: string | null;
  source_url: string | null;
  ingested_by: VcNewsIngestSource;
  verified: boolean;
  dismissed: boolean;
  related_fund_id: string | null;
  suggested_fund_patch: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// 集約ビュー用 (リスト画面 / カード)

export interface AmdPjInvestmentRef {
  project_id: string;
  project_name: string;
  amount_jpy: number | null;
}

export interface AmdPjContactRef {
  project_id: string;
  project_name: string;
  status: ProjectVcStatus;
  contact_names: string[];           // VC 側担当者の名前 (複数可、漢字・英名混合可)
  last_touch_at: string | null;
}

export interface VcListItem extends Vc {
  active_fund: VcFund | null;          // status='raising' or 'investing' で最新の vintage
  fund_count: number;                   // ファンド数
  pj_relation_count: number;            // 自社 PJ 接点数
  last_touch_at: string | null;         // 最終接触日 (PJ 関係から最大)
  unverified_news_count: number;        // 未確認ニュース数
  total_dry_powder_low: number | null;  // 全 active fund の DPE 合計レンジ下限
  total_dry_powder_high: number | null;
  amd_pj_investments: AmdPjInvestmentRef[];  // この VC が出した自社 PJ への出資 (vc_investments.our_project_id 経由)
  amd_pj_total_amount_jpy: number;           // 自社 PJ への出資合計 (amount_jpy 不明分は 0 扱い)
  amd_pj_contacts: AmdPjContactRef[];        // この VC が AMD PJ に接触した履歴 (出資未完含む)
}

export interface VcDetail {
  vc: Vc;
  funds: VcFund[];
  investments: VcInvestment[];
  contacts: VcContact[];
  relations: (ProjectVcRelation & {
    project_name?: string;
    contact_name?: string | null;
    amd_owner_code_name?: string | null;
  })[];
  news: VcNews[];
}
