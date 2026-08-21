// AMD OS Database Types — Supabase PostgreSQL
// Auto-generated types will replace these once `supabase gen types` is run

export type ProjectStatus = "active" | "sales" | "ended" | "frozen" | "lost";
export type MilestoneTag = "normal" | "buffer" | "routine";
export type BillingStatus =
  | "not_started"
  | "reported"
  | "budget_confirmed"
  | "allocation_confirmed"
  | "invoice_sent"
  | "payment_confirmed";
export type TaskStatus = "pending" | "todo" | "doing" | "done";

export interface Member {
  id: string; // UUID
  member_id: string; // legacy memberId
  code_name: string;
  email: string;
  role: string | null;
  status: string;
  slack_id: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  project_id: string; // legacy projectId
  project_name: string;
  client_name: string | null;
  status: ProjectStatus;
  slack_channel_id: string | null;
  /** 資料保存先。生データ抽出rootとは分けて保持する。 */
  drive_folder_id: string | null;
  /** 追加の読み取り専用Drive生データ抽出root。 */
  drive_source_folder_ids: string[];
  freee_partner_id: string | null;
  start_ym: string | null;
  end_ym: string | null;
  contract_terms_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  member_id: string;
  role: string | null;
  is_active: boolean;
  join_ym: string | null;
  leave_ym: string | null;
}

export interface ValuePlanCycle {
  id: string;
  plan_cycle_id: string;
  project_id: string;
  status: string;
  budget_yen: number;
  total_points: number;
  period_start_ym: string;
  period_end_ym: string;
  created_at: string;
}

export interface ValueMilestone {
  id: string;
  milestone_id: string;
  plan_cycle_id: string;
  title: string;
  points: number;
  tag: MilestoneTag;
  goal_level: string | null;
  is_active: boolean;
  success_criteria: string | null;
  sort_order: number;
}

export interface MilestoneMonthlyProgress {
  id: string;
  milestone_key: string;
  ym: string;
  progress_pct: number;
  consumed_pt: number;
  source: string | null;
  confirmed_at: string | null;
}

export interface BillingCycle {
  id: string;
  project_id: string;
  ym: string; // TEXT format: "202604"
  budget_yen: number | null;
  status: BillingStatus;
  meeting_start_at: string | null;
  report_fixed_at: string | null;
  invoice_sent_at: string | null;
  payment_confirmed_at: string | null;
  ms_progress_summary_json: Record<string, unknown> | null;
  member_allocations_json: Record<string, unknown> | null;
  reward_summary_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface MonthlyReport {
  id: string;
  report_id: string;
  project_id: string;
  ym: string;
  draft_content: string | null;
  final_content: string | null;
  status: string;
  generated_at: string | null;
  fixed_at: string | null;
}

export interface Task {
  id: string;
  task_id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignee: string | null;
  priority: string | null;
  created_at: string;
  updated_at: string;
}

export interface TsukuyomiNudge {
  id: string;
  project_id: string;
  ym: string;
  message: string;
  status: string;
  posted_at: string | null;
}
