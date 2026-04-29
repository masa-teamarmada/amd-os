export interface BillingRow {
  project_code: string;
  project_name: string;
  ym: string;
  status: "open" | "budgeted" | "invoiced" | "paid" | "closed";
  budget_total: number | null;
  budget_reported_amount: number | null;
  fixed_total_yen: number | null;
  invoice_status: string | null;
  invoice_sent_at: string | null;
  payment_confirmed_at: string | null;
  meeting_at: string | null;
  meeting_skipped: boolean | null;
}

export interface MilestoneRow {
  project_code: string;
  project_name: string;
  period_start: string;
  period_end: string;
  milestone_key: string;
  milestone_title: string;
  points: number;
  goal_level: string | null;
  target_ym: string | null;
  progress_ym: string | null;
  progress_pct: number | null;
  consumed_pt: number | null;
  progress_source: string | null;
}

export interface ProtocolRow {
  project_code: string;
  project_name: string;
  decision_point: string;
  decision_criteria: string | null;
  tags: string[] | null;
  importance: string | null;
  source_type: string | null;
  status: string;
  created_at: string;
}

export interface ProjectSummary {
  project_code: string;
  project_name: string;
  billing_status: string;
  budget_total: number | null;
  ms_progress_avg: number;
  active_ms_count: number;
  protocol_count: number;
  next_meeting: string | null;
  health: "green" | "blue" | "amber" | "red";
}

export interface ActionItem {
  severity: "high" | "medium";
  type: "billing" | "milestone" | "protocol" | "meeting";
  project_code: string;
  description: string;
}

export interface HeaderKPIs {
  current_ym: string;
  project_count: number;
  active_ms_count: number;
  billing_pipeline_yen: number;
}
