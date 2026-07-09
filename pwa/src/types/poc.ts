export type PocCompanyStatus =
  | "candidate"
  | "listed"
  | "contacted"
  | "hearing"
  | "poc_ready"
  | "archived";

export type PocMatchStatus =
  | "candidate"
  | "hearing_design"
  | "introduced"
  | "hearing_done"
  | "poc_design"
  | "poc_running"
  | "deal"
  | "archived";

export type PocPriority = "high" | "medium" | "low";

export interface PocCompany {
  id: string;
  company_name: string;
  company_size: string | null;
  industry_tags: string[];
  region: string | null;
  poc_profile: string | null;
  poc_history_note: string | null;
  incentive_note: string | null;
  source_kind: string | null;
  source_ref: string | null;
  owner_member_id: string | null;
  status: PocCompanyStatus;
  next_action: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface PocMatch {
  id: string;
  seed_id: string | null;
  company_id: string | null;
  project_id: string | null;
  match_title: string;
  fit_hypothesis: string | null;
  hearing_questions: string[];
  poc_goal: string | null;
  reward_plan: string | null;
  contract_plan: string | null;
  funding_plan: string | null;
  revenue_share_note: string | null;
  status: PocMatchStatus;
  priority: PocPriority;
  owner_member_id: string | null;
  next_action: string | null;
  source_note: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface PocSeedRef {
  id: string;
  title: string;
  org_name: string;
  domain_lane: string | null;
  industry_target: string[] | null;
  status: string;
  amd_rating: number | null;
  updated_at: string;
}

export interface PocProjectRef {
  project_id: string;
  project_name: string;
  status: string;
  project_category: string | null;
}

export interface PocMemberRef {
  member_id: string;
  code_name: string;
}

export interface PocMatchListItem extends PocMatch {
  seed: PocSeedRef | null;
  company: PocCompany | null;
  project: PocProjectRef | null;
  owner_code_name: string | null;
}

export interface PocCompanyListItem extends PocCompany {
  owner_code_name: string | null;
  match_count: number;
  active_match_count: number;
}

export interface PocHubData {
  companies: PocCompanyListItem[];
  matches: PocMatchListItem[];
  seeds: PocSeedRef[];
  projects: PocProjectRef[];
  members: PocMemberRef[];
}
